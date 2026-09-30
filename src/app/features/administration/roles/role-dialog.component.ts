import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { formSubmitError } from '../admin-errors';
import { AdministrationApi } from '../administration.api';
import { AdminErrorCodes, PermissionResponse, RoleResponse } from '../administration.models';

export interface RoleDialogData {
  /** Null = create. */
  role: RoleResponse | null;
  permissions: PermissionResponse[];
}

interface PermissionGroup {
  group: string;
  codes: string[];
}

/** Create/edit a role with a permission checklist grouped by feature. System roles open read-only. */
@Component({
  selector: 'app-role-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatCheckboxModule, MatButtonModule, MatIconModule, TranslatePipe, FormErrorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../admin.scss',
  template: `
    <h2 mat-dialog-title>{{ (role ? (readOnly ? 'admin.roles.viewTitle' : 'admin.roles.editTitle') : 'admin.roles.createTitle') | t }}</h2>
    <mat-dialog-content>
      @if (readOnly) {
        <div class="admin-banner admin-banner--info"><mat-icon>lock</mat-icon><span>{{ 'admin.errors.ROLE_IS_SYSTEM' | t }}</span></div>
      }
      @if (errorMessage(); as message) {
        <div class="admin-banner" role="alert"><mat-icon>error_outline</mat-icon><span>{{ message }}</span></div>
      }
      <form [formGroup]="form" id="role-form" (ngSubmit)="save()" novalidate class="crm-form-grid">
        <mat-form-field>
          <mat-label>{{ 'core.fields.name' | t }}</mat-label>
          <input matInput formControlName="name" maxlength="100" required />
          <mat-error>{{ form.controls.name | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'core.fields.description' | t }}</mat-label>
          <input matInput formControlName="description" maxlength="500" />
          <mat-error>{{ form.controls.description | formError }}</mat-error>
        </mat-form-field>
      </form>

      <div class="perm-head">
        <h3>{{ 'admin.roles.permissions' | t }}</h3>
        <span class="crm-muted">{{ 'admin.roles.selectedCount' | t: { count: selected().size, total: data.permissions.length } }}</span>
      </div>
      <div class="perm-groups">
        @for (group of groups(); track group.group) {
          <fieldset class="perm-group">
            <legend>
              <mat-checkbox
                [checked]="groupState(group) === 'all'"
                [indeterminate]="groupState(group) === 'some'"
                [disabled]="readOnly"
                (change)="toggleGroup(group, $event.checked)"
              >
                <strong>{{ groupLabel(group.group) }}</strong>
              </mat-checkbox>
            </legend>
            @for (code of group.codes; track code) {
              <mat-checkbox [checked]="selected().has(code)" [disabled]="readOnly" (change)="toggle(code, $event.checked)">
                {{ permissionLabel(code) }}
                <span class="perm-code" dir="ltr">{{ code }}</span>
              </mat-checkbox>
            }
          </fieldset>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ (readOnly ? 'core.actions.close' : 'core.actions.cancel') | t }}</button>
      @if (!readOnly) {
        <button mat-flat-button type="submit" form="role-form" [disabled]="busy()">{{ (role ? 'core.actions.save' : 'core.actions.create') | t }}</button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .perm-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-top: 8px; }
    h3 { margin: 8px 0; font: var(--mat-sys-title-small); }
    .perm-groups { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .perm-group { display: flex; flex-direction: column; margin: 0; padding: 4px 8px 8px; border: 1px solid var(--mat-sys-outline-variant); border-radius: 8px; }
    legend { padding: 0 4px; }
    .perm-code { display: block; font-size: 11px; color: var(--mat-sys-on-surface-variant); text-align: start; }
  `,
})
export class RoleDialogComponent {
  readonly data = inject<RoleDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<RoleDialogComponent, RoleResponse>>(MatDialogRef);
  private readonly api = inject(AdministrationApi);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly role = this.data.role;
  readonly readOnly = !!this.role?.isSystem;
  readonly busy = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly selected = signal(new Set<string>(this.role?.permissions ?? []));

  readonly groups = computed<PermissionGroup[]>(() => {
    const map = new Map<string, string[]>();
    for (const permission of this.data.permissions) {
      const list = map.get(permission.group) ?? [];
      list.push(permission.code);
      map.set(permission.group, list);
    }
    return [...map.entries()].map(([group, codes]) => ({ group, codes }));
  });

  readonly form = inject(NonNullableFormBuilder).group({
    name: [this.role?.name ?? '', [Validators.required, Validators.maxLength(100)]],
    description: [this.role?.description ?? '', [Validators.maxLength(500)]],
  });

  constructor() {
    if (this.readOnly) {
      this.form.disable();
    }
  }

  groupLabel(group: string): string {
    const key = `admin.permissionGroups.${group}`;
    return this.translations.has(key) ? this.translations.t(key) : group;
  }

  permissionLabel(code: string): string {
    const key = `admin.permissions.${code}`;
    return this.translations.has(key) ? this.translations.t(key) : code;
  }

  groupState(group: PermissionGroup): 'all' | 'some' | 'none' {
    const selected = this.selected();
    const count = group.codes.filter((c) => selected.has(c)).length;
    return count === 0 ? 'none' : count === group.codes.length ? 'all' : 'some';
  }

  toggle(code: string, checked: boolean): void {
    this.update([code], checked);
  }

  toggleGroup(group: PermissionGroup, checked: boolean): void {
    this.update(group.codes, checked);
  }

  save(): void {
    if (this.readOnly || this.busy()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const request = { name: value.name.trim(), description: value.description.trim() || null, permissions: [...this.selected()] };
    this.busy.set(true);
    this.errorMessage.set(null);
    const call = this.role ? this.api.updateRole(this.role.id, request) : this.api.createRole(request);
    call.subscribe({
      next: (saved) => {
        this.toast.success(this.role ? 'core.states.saved' : 'core.states.created');
        this.dialogRef.close(saved);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.errorMessage.set(formSubmitError(this.form, error, this.translations, { [AdminErrorCodes.roleNameTaken]: 'name' }));
      },
    });
  }

  private update(codes: string[], checked: boolean): void {
    this.selected.update((current) => {
      const next = new Set(current);
      for (const code of codes) {
        if (checked) {
          next.add(code);
        } else {
          next.delete(code);
        }
      }
      return next;
    });
  }
}
