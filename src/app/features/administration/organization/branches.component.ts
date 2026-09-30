import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable } from 'rxjs';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { ConfirmService } from '../../../shared/confirm-dialog.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { AdminDialogs } from '../admin-dialog';
import { adminErrorMessage } from '../admin-errors';
import { AdministrationApi } from '../administration.api';
import { BranchResponse, DepartmentResponse } from '../administration.models';
import { UnitDialogComponent, UnitDialogData } from './unit-dialog.component';

/** Branches with their departments; editing needs `organization.manage`. */
@Component({
  selector: 'app-admin-branches',
  imports: [MatExpansionModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslatePipe, LoadingComponent, EmptyStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../admin.scss',
  template: `
    <section class="crm-card">
      <div class="admin-section__head">
        <h2>{{ 'admin.organization.branches' | t }}</h2>
        @if (canManage()) {
          <button mat-flat-button type="button" (click)="editBranch(null)"><mat-icon>add</mat-icon>{{ 'admin.organization.newBranch' | t }}</button>
        }
      </div>
      @if (!canManage()) {
        <p class="admin-hint">{{ 'admin.organization.branchesReadOnly' | t }}</p>
      }
      @if (loading()) {
        <app-loading />
      } @else if (error()) {
        <app-error-state [message]="error()" (retry)="load()" />
      } @else {
        <mat-accordion multi>
          @for (branch of branches(); track branch.id) {
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <span class="admin-mono code">{{ branch.code }}</span>
                  <span>{{ branch.name }}</span>
                </mat-panel-title>
                <mat-panel-description>
                  <span class="crm-pill" [class.crm-pill--success]="branch.isActive" [class.crm-pill--danger]="!branch.isActive">
                    {{ (branch.isActive ? 'admin.status.Active' : 'admin.status.Inactive') | t }}
                  </span>
                  <span>{{ 'admin.organization.departmentCount' | t: { count: branch.departments.length } }}</span>
                </mat-panel-description>
              </mat-expansion-panel-header>

              @if (branch.address || branch.phone) {
                <p class="crm-muted details">
                  @if (branch.address) {
                    <span><mat-icon inline>place</mat-icon> {{ branch.address }}</span>
                  }
                  @if (branch.phone) {
                    <span dir="ltr"><mat-icon inline>call</mat-icon> {{ branch.phone }}</span>
                  }
                </p>
              }

              <ul class="dept-list">
                @for (department of branch.departments; track department.id) {
                  <li>
                    <span class="admin-mono code">{{ department.code }}</span>
                    <span class="dept-name">
                      {{ department.name }}
                      @if (department.email) {
                        <span class="crm-muted" dir="ltr">· {{ department.email }}</span>
                      }
                    </span>
                    <span class="crm-pill" [class.crm-pill--success]="department.isActive" [class.crm-pill--danger]="!department.isActive">
                      {{ (department.isActive ? 'admin.status.Active' : 'admin.status.Inactive') | t }}
                    </span>
                    @if (canManage()) {
                      <button mat-icon-button type="button" [matTooltip]="'core.actions.edit' | t" [attr.aria-label]="'core.actions.edit' | t" (click)="editDepartment(branch, department)">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button type="button"
                        [matTooltip]="(department.isActive ? 'core.actions.deactivate' : 'core.actions.activate') | t"
                        [attr.aria-label]="(department.isActive ? 'core.actions.deactivate' : 'core.actions.activate') | t"
                        (click)="toggleDepartment(department)">
                        <mat-icon>{{ department.isActive ? 'toggle_on' : 'toggle_off' }}</mat-icon>
                      </button>
                    }
                  </li>
                } @empty {
                  <li class="crm-muted">{{ 'admin.organization.noDepartments' | t }}</li>
                }
              </ul>

              @if (canManage()) {
                <mat-action-row>
                  <button mat-button type="button" (click)="editDepartment(branch, null)"><mat-icon>add</mat-icon>{{ 'admin.organization.newDepartment' | t }}</button>
                  <button mat-button type="button" (click)="editBranch(branch)"><mat-icon>edit</mat-icon>{{ 'core.actions.edit' | t }}</button>
                  <button mat-button type="button" (click)="toggleBranch(branch)">
                    {{ (branch.isActive ? 'core.actions.deactivate' : 'core.actions.activate') | t }}
                  </button>
                </mat-action-row>
              }
            </mat-expansion-panel>
          } @empty {
            <app-empty-state icon="apartment" [message]="'admin.organization.noBranches' | t" />
          }
        </mat-accordion>
      }
    </section>
  `,
  styles: `
    .code { margin-inline-end: 8px; color: var(--mat-sys-on-surface-variant); }
    mat-panel-description { justify-content: flex-end; gap: 12px; }
    .details { display: flex; flex-wrap: wrap; gap: 16px; margin: 0 0 8px; }
    .dept-list { list-style: none; margin: 0; padding: 0; }
    .dept-list li { display: flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .dept-list li:last-child { border-bottom: 0; }
    .dept-name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  `,
})
export class BranchesComponent {
  private readonly api = inject(AdministrationApi);
  private readonly dialogs = inject(AdminDialogs);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly canManage = input(false);
  readonly branches = signal<BranchResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listBranches(true).subscribe({
      next: (branches) => {
        this.branches.set(branches);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(adminErrorMessage(error, this.translations));
      },
    });
  }

  editBranch(branch: BranchResponse | null): void {
    this.openDialog({ kind: 'branch', branchId: branch?.id ?? null, unit: branch });
  }

  editDepartment(branch: BranchResponse, department: DepartmentResponse | null): void {
    this.openDialog({ kind: 'department', branchId: branch.id, unit: department });
  }

  toggleBranch(branch: BranchResponse): void {
    this.toggle(branch.name, branch.isActive, 'admin.organization.deactivateBranchMessage', () => this.api.setBranchActive(branch.id, !branch.isActive));
  }

  toggleDepartment(department: DepartmentResponse): void {
    this.toggle(department.name, department.isActive, 'admin.organization.deactivateDepartmentMessage', () =>
      this.api.setDepartmentActive(department.id, !department.isActive),
    );
  }

  private toggle(name: string, isActive: boolean, message: string, action: () => Observable<unknown>): void {
    const run = () =>
      action().subscribe({
        next: () => {
          this.toast.success('core.states.saved');
          this.load();
        },
        error: (error: unknown) => this.toast.error(adminErrorMessage(error, this.translations)),
      });
    if (!isActive) {
      run();
      return;
    }
    this.confirm
      .ask({ title: 'admin.organization.deactivateTitle', message, params: { name }, confirmText: 'core.actions.deactivate', destructive: true })
      .subscribe((ok) => {
        if (ok) {
          run();
        }
      });
  }

  private openDialog(data: UnitDialogData): void {
    this.dialogs.open<UnitDialogComponent, UnitDialogData, boolean>(UnitDialogComponent, data, '520px').subscribe((saved) => {
      if (saved) {
        this.load();
      }
    });
  }
}
