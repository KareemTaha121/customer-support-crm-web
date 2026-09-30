import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { ConfirmService } from '../../../shared/confirm-dialog.component';
import { PageHeaderComponent } from '../../../shared/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { AdminDialogs } from '../admin-dialog';
import { adminErrorMessage } from '../admin-errors';
import { AdministrationApi } from '../administration.api';
import { PermissionResponse, RoleResponse } from '../administration.models';
import { RoleDialogComponent, RoleDialogData } from './role-dialog.component';

/** `/admin/roles`: roles with their permission sets; system roles are read-only. */
@Component({
  selector: 'app-roles-page',
  imports: [MatTableModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslatePipe, PageHeaderComponent, LoadingComponent, EmptyStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../admin.scss',
  template: `
    <app-page-header [title]="'admin.roles.title' | t" [subtitle]="'admin.roles.subtitle' | t">
      <button mat-flat-button type="button" (click)="open(null)" [disabled]="loading()"><mat-icon>add</mat-icon>{{ 'admin.roles.new' | t }}</button>
    </app-page-header>

    @if (loading()) {
      <app-loading />
    } @else if (error()) {
      <app-error-state [message]="error()" (retry)="load()" />
    } @else if (roles().length === 0) {
      <app-empty-state icon="admin_panel_settings" [message]="'admin.roles.empty' | t" />
    } @else {
      <div class="crm-table-wrap">
        <table mat-table [dataSource]="roles()">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>{{ 'core.fields.name' | t }}</th>
            <td mat-cell *matCellDef="let role">
              <strong>{{ role.name }}</strong>
              @if (isSystem(role)) {
                <span class="crm-pill crm-pill--info system-pill"><mat-icon inline>lock</mat-icon>{{ 'admin.roles.system' | t }}</span>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="description">
            <th mat-header-cell *matHeaderCellDef>{{ 'core.fields.description' | t }}</th>
            <td mat-cell *matCellDef="let role" class="crm-muted">{{ role.description }}</td>
          </ng-container>
          <ng-container matColumnDef="permissions">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.roles.permissions' | t }}</th>
            <td mat-cell *matCellDef="let role">{{ 'admin.roles.permissionCount' | t: { count: permissionCount(role) } }}</td>
          </ng-container>
          <ng-container matColumnDef="users">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.roles.users' | t }}</th>
            <td mat-cell *matCellDef="let role">{{ role.userCount }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef><span class="cdk-visually-hidden">{{ 'core.actions.more' | t }}</span></th>
            <td mat-cell *matCellDef="let role" class="admin-actions-cell">
              @if (isSystem(role)) {
                <button mat-icon-button type="button" [matTooltip]="'core.actions.view' | t" [attr.aria-label]="'core.actions.view' | t" (click)="open(role)">
                  <mat-icon>visibility</mat-icon>
                </button>
              } @else {
                <button mat-icon-button type="button" [matTooltip]="'core.actions.edit' | t" [attr.aria-label]="'core.actions.edit' | t" (click)="open(role)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button type="button" [matTooltip]="'core.actions.delete' | t" [attr.aria-label]="'core.actions.delete' | t" (click)="remove(role)">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      </div>
    }
  `,
  styles: `.system-pill { margin-inline-start: 8px; }`,
})
export class RolesPage {
  private readonly api = inject(AdministrationApi);
  private readonly dialogs = inject(AdminDialogs);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly auth = inject(AuthService);

  readonly columns = ['name', 'description', 'permissions', 'users', 'actions'];
  readonly roles = signal<RoleResponse[]>([]);
  readonly permissions = signal<PermissionResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  isSystem(role: RoleResponse): boolean {
    return role.isSystem;
  }

  permissionCount(role: RoleResponse): number {
    return role.permissions.length;
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ roles: this.api.listRoles(), permissions: this.api.listPermissions() }).subscribe({
      next: ({ roles, permissions }) => {
        this.roles.set(roles);
        this.permissions.set(permissions);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(adminErrorMessage(error, this.translations));
      },
    });
  }

  open(role: RoleResponse | null): void {
    this.dialogs
      .open<RoleDialogComponent, RoleDialogData, RoleResponse>(RoleDialogComponent, { role, permissions: this.permissions() }, '760px')
      .subscribe((saved) => {
        if (!saved) {
          return;
        }
        // Editing a role the signed-in user holds changes their permissions.
        if (this.auth.currentUser()?.roles.includes(role?.name ?? saved.name)) {
          this.auth.reloadCurrentUser().subscribe();
        }
        this.load();
      });
  }

  remove(role: RoleResponse): void {
    this.confirm
      .ask({ title: 'admin.roles.deleteTitle', message: 'admin.roles.deleteMessage', params: { name: role.name }, confirmText: 'core.actions.delete', destructive: true })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.api.deleteRole(role.id).subscribe({
          next: () => {
            this.toast.success('core.states.deleted');
            this.load();
          },
          error: (error: unknown) => this.toast.error(adminErrorMessage(error, this.translations)),
        });
      });
  }
}
