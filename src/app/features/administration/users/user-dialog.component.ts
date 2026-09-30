import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Observable, concat, toArray } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiError } from '../../../core/http/api-error';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { LocalizedDatePipe } from '../../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { ConfirmService } from '../../../shared/confirm-dialog.component';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordValidators } from '../../../shared/password';
import { formSubmitError } from '../admin-errors';
import { AdministrationApi } from '../administration.api';
import { AdminErrorCodes, BranchResponse, DepartmentResponse, RoleResponse, UserDetail, UserScopeRequest } from '../administration.models';

export interface UserDialogData {
  /** Null = create. */
  user: UserDetail | null;
  roles: RoleResponse[];
  branches: BranchResponse[];
  currentUserId: string | null;
}

/** Create or edit a staff user: identity, roles, branch/department scopes and password reset. Closes with `true` when anything changed. */
@Component({
  selector: 'app-user-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressBarModule,
    TranslatePipe,
    FormErrorPipe,
    LocalizedDatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../admin.scss',
  template: `
    <h2 mat-dialog-title>{{ (user ? 'admin.users.editTitle' : 'admin.users.createTitle') | t }}</h2>
    <mat-dialog-content>
      @if (busy()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (errorMessage(); as message) {
        <div class="admin-banner" role="alert"><mat-icon>error_outline</mat-icon><span>{{ message }}</span></div>
      }
      @if (user) {
        <p class="status-line">
          <span class="crm-pill" [class.crm-pill--success]="user.status === 'Active'" [class.crm-pill--danger]="user.status !== 'Active'">
            {{ 'admin.status.' + user.status | t }}
          </span>
          @if (user.isLockedOut) {
            <span class="crm-pill crm-pill--warning">{{ 'admin.users.lockedOut' | t }}</span>
          }
          <span class="crm-muted">
            {{ 'admin.users.lastLogin' | t }}: {{ user.lastLoginAt ? (user.lastLoginAt | localDate) : ('admin.users.never' | t) }}
          </span>
        </p>
      }

      <form [formGroup]="form" id="user-form" (ngSubmit)="save()" novalidate class="crm-form-grid">
        <mat-form-field>
          <mat-label>{{ 'admin.users.displayName' | t }}</mat-label>
          <input matInput formControlName="displayName" maxlength="200" required />
          <mat-error>{{ form.controls.displayName | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'core.fields.email' | t }}</mat-label>
          <input matInput type="email" formControlName="email" dir="ltr" autocomplete="off" required />
          <mat-error>{{ form.controls.email | formError }}</mat-error>
        </mat-form-field>
        @if (!user) {
          <mat-form-field class="crm-span-all">
            <mat-label>{{ 'admin.users.password' | t }}</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" required />
            <mat-hint>{{ 'admin.users.passwordHint' | t: passwordRange }}</mat-hint>
            <mat-error>{{ form.controls.password | formError }}</mat-error>
          </mat-form-field>
        }
      </form>

      <h3>{{ 'admin.users.roles' | t }}</h3>
      <div class="role-list">
        @for (role of data.roles; track role.id) {
          <mat-checkbox [checked]="selectedRoles().has(role.id)" (change)="toggleRole(role.id, $event.checked)">
            <span>{{ role.name }}</span>
            @if (role.description) {
              <span class="crm-muted role-desc">{{ role.description }}</span>
            }
          </mat-checkbox>
        } @empty {
          <p class="crm-muted">{{ 'admin.roles.empty' | t }}</p>
        }
      </div>

      <h3>{{ 'admin.users.scopes' | t }}</h3>
      <p class="admin-hint">{{ 'admin.users.scopesHint' | t }}</p>
      @for (scope of scopes(); track $index; let i = $index) {
        <div class="scope-row">
          <mat-form-field>
            <mat-label>{{ 'admin.organization.branch' | t }}</mat-label>
            <mat-select [value]="scope.branchId" (selectionChange)="setScopeBranch(i, $event.value)">
              @for (branch of data.branches; track branch.id) {
                <mat-option [value]="branch.id">{{ branch.name }}{{ branch.isActive ? '' : ' (' + ('admin.status.Inactive' | t) + ')' }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'admin.organization.department' | t }}</mat-label>
            <mat-select [value]="scope.departmentId" (selectionChange)="setScopeDepartment(i, $event.value)">
              <mat-option [value]="null">{{ 'admin.users.wholeBranch' | t }}</mat-option>
              @for (department of departmentsOf(scope.branchId); track department.id) {
                <mat-option [value]="department.id">{{ department.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button mat-icon-button type="button" (click)="removeScope(i)" [attr.aria-label]="'core.actions.delete' | t">
            <mat-icon>delete_outline</mat-icon>
          </button>
        </div>
      }
      @if (data.branches.length) {
        <button mat-stroked-button type="button" (click)="addScope()"><mat-icon>add</mat-icon>{{ 'admin.users.addScope' | t }}</button>
      }

      @if (user) {
        <mat-divider class="divider" />
        <h3>{{ 'admin.users.resetPassword' | t }}</h3>
        <p class="admin-hint">{{ 'admin.users.resetPasswordHint' | t }}</p>
        <div class="reset-row">
          <mat-form-field>
            <mat-label>{{ 'admin.users.newPassword' | t }}</mat-label>
            <input matInput type="password" [formControl]="newPassword" autocomplete="new-password" />
            <mat-hint>{{ 'admin.users.passwordHint' | t: passwordRange }}</mat-hint>
            <mat-error>{{ newPassword | formError }}</mat-error>
          </mat-form-field>
          <button mat-stroked-button type="button" (click)="resetPassword()" [disabled]="busy()">{{ 'admin.users.resetPassword' | t }}</button>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="close()">{{ 'core.actions.cancel' | t }}</button>
      <button mat-flat-button type="submit" form="user-form" [disabled]="busy()">
        {{ (user ? 'core.actions.save' : 'core.actions.create') | t }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    h3 { margin: 16px 0 8px; font: var(--mat-sys-title-small); }
    .status-line { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 12px; }
    .role-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 4px 12px; }
    .role-desc { display: block; font: var(--mat-sys-body-small); }
    .scope-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: start; }
    .reset-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; }
    .reset-row mat-form-field { flex: 1 1 240px; }
    .reset-row button { margin-top: 8px; }
    .divider { margin-top: 16px; }
    @media (max-width: 600px) { .scope-row { grid-template-columns: 1fr; } }
  `,
})
export class UserDialogComponent {
  readonly data = inject<UserDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<UserDialogComponent, boolean>>(MatDialogRef);
  private readonly api = inject(AdministrationApi);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly user = this.data.user;
  readonly passwordRange = { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH };
  readonly busy = signal(false);
  readonly errorMessage = signal<string | null>(null);
  private changed = false;

  readonly form = inject(NonNullableFormBuilder).group({
    displayName: [this.user?.displayName ?? '', [Validators.required, Validators.maxLength(200)]],
    email: [{ value: this.user?.email ?? '', disabled: !!this.user }, [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', this.user ? [] : passwordValidators],
  });

  readonly newPassword = new FormControl('', { nonNullable: true, validators: passwordValidators });

  private readonly initialRoles = new Set(this.user?.roles.map((r) => r.id) ?? []);
  readonly selectedRoles = signal(new Set(this.initialRoles));

  private readonly initialScopes: UserScopeRequest[] = this.user?.scopes.map((s) => ({ branchId: s.branchId, departmentId: s.departmentId })) ?? [];
  readonly scopes = signal<UserScopeRequest[]>([...this.initialScopes]);

  constructor() {
    this.dialogRef.disableClose = true;
    this.dialogRef.backdropClick().subscribe(() => this.close());
  }

  departmentsOf(branchId: string): DepartmentResponse[] {
    return this.data.branches.find((b) => b.id === branchId)?.departments ?? [];
  }

  toggleRole(roleId: string, checked: boolean): void {
    this.selectedRoles.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(roleId);
      } else {
        next.delete(roleId);
      }
      return next;
    });
  }

  addScope(): void {
    const branch = this.data.branches.find((b) => b.isActive) ?? this.data.branches[0];
    if (branch) {
      this.scopes.update((list) => [...list, { branchId: branch.id, departmentId: null }]);
    }
  }

  removeScope(index: number): void {
    this.scopes.update((list) => list.filter((_, i) => i !== index));
  }

  setScopeBranch(index: number, branchId: string): void {
    this.scopes.update((list) => list.map((s, i) => (i === index ? { branchId, departmentId: null } : s)));
  }

  setScopeDepartment(index: number, departmentId: string | null): void {
    this.scopes.update((list) => list.map((s, i) => (i === index ? { ...s, departmentId } : s)));
  }

  save(): void {
    if (this.busy()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage.set(null);
    const roleIds = [...this.selectedRoles()];
    const scopes = uniqueScopes(this.scopes());
    const value = this.form.getRawValue();

    if (!this.user) {
      this.busy.set(true);
      this.api
        .createUser({ email: value.email.trim(), displayName: value.displayName.trim(), password: value.password, roleIds, scopes: scopes.length ? scopes : null })
        .subscribe({
          next: () => {
            this.toast.success('admin.users.created');
            this.dialogRef.close(true);
          },
          error: (error: unknown) => this.fail(error),
        });
      return;
    }

    const user = this.user;
    const rolesChanged = !sameSet(this.initialRoles, this.selectedRoles());
    const steps: Observable<unknown>[] = [];
    if (value.displayName.trim() !== user.displayName) {
      steps.push(this.api.updateUser(user.id, value.displayName.trim()));
    }
    if (rolesChanged) {
      steps.push(this.api.setUserRoles(user.id, roleIds));
    }
    if (!sameScopes(this.initialScopes, scopes)) {
      steps.push(this.api.setUserScopes(user.id, scopes));
    }
    if (steps.length === 0) {
      this.dialogRef.close(this.changed);
      return;
    }
    this.busy.set(true);
    concat(...steps)
      .pipe(toArray())
      .subscribe({
        next: () => {
          if (rolesChanged && user.id === this.data.currentUserId) {
            this.auth.reloadCurrentUser().subscribe();
          }
          this.toast.success('core.states.saved');
          this.dialogRef.close(true);
        },
        error: (error: unknown) => {
          // Earlier steps may have succeeded; make the list refresh on close.
          this.changed = true;
          this.fail(error);
        },
      });
  }

  resetPassword(): void {
    const user = this.user;
    if (!user || this.busy()) {
      return;
    }
    if (this.newPassword.invalid) {
      this.newPassword.markAsTouched();
      return;
    }
    this.confirm
      .ask({ title: 'admin.users.resetPasswordTitle', message: 'admin.users.resetPasswordMessage', params: { name: user.displayName }, destructive: true })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.busy.set(true);
        this.errorMessage.set(null);
        this.api.resetUserPassword(user.id, this.newPassword.value).subscribe({
          next: () => {
            this.busy.set(false);
            this.newPassword.reset();
            this.toast.success('admin.users.passwordReset');
          },
          error: (error: unknown) => {
            this.busy.set(false);
            const serverField = ApiError.from(error).fieldErrors['newPassword'];
            if (serverField) {
              this.newPassword.setErrors({ server: serverField });
            } else {
              this.fail(error);
            }
          },
        });
      });
  }

  close(): void {
    this.dialogRef.close(this.changed);
  }

  private fail(error: unknown): void {
    this.busy.set(false);
    this.errorMessage.set(formSubmitError(this.form, error, this.translations, { [AdminErrorCodes.emailTaken]: 'email' }));
  }
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

function scopeKey(scope: UserScopeRequest): string {
  return `${scope.branchId}/${scope.departmentId ?? '*'}`;
}

function uniqueScopes(scopes: UserScopeRequest[]): UserScopeRequest[] {
  const seen = new Map<string, UserScopeRequest>();
  for (const scope of scopes) {
    seen.set(scopeKey(scope), scope);
  }
  return [...seen.values()];
}

function sameScopes(a: UserScopeRequest[], b: UserScopeRequest[]): boolean {
  return sameSet(new Set(a.map(scopeKey)), new Set(b.map(scopeKey)));
}
