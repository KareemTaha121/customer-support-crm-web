import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged, forkJoin, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { Paged, emptyPage } from '../../../core/http/api.models';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { LocalizedDatePipe } from '../../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { ConfirmService } from '../../../shared/confirm-dialog.component';
import { PageHeaderComponent } from '../../../shared/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { AdminDialogs } from '../admin-dialog';
import { adminErrorMessage } from '../admin-errors';
import { AdministrationApi, UserListQuery } from '../administration.api';
import { UserListItem, UserSortField, UserStatus } from '../administration.models';
import { UserDialogComponent, UserDialogData } from './user-dialog.component';

/** `/admin/users`: staff accounts with search, status filter, sorting and paging. */
@Component({
  selector: 'app-users-page',
  imports: [
    ReactiveFormsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslatePipe,
    LocalizedDatePipe,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../admin.scss',
  template: `
    <app-page-header [title]="'admin.users.title' | t" [subtitle]="'admin.users.subtitle' | t">
      <button mat-flat-button type="button" (click)="create()" [disabled]="opening()">
        <mat-icon>person_add</mat-icon>{{ 'admin.users.new' | t }}
      </button>
    </app-page-header>

    <div class="crm-toolbar">
      <mat-form-field>
        <mat-label>{{ 'core.actions.search' | t }}</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [formControl]="search" [placeholder]="'admin.users.searchHint' | t" />
      </mat-form-field>
      <mat-form-field>
        <mat-label>{{ 'core.fields.status' | t }}</mat-label>
        <mat-select [value]="query().status" (selectionChange)="setStatus($event.value)">
          <mat-option [value]="null">{{ 'core.states.all' | t }}</mat-option>
          <mat-option value="Active">{{ 'admin.status.Active' | t }}</mat-option>
          <mat-option value="Disabled">{{ 'admin.status.Disabled' | t }}</mat-option>
        </mat-select>
      </mat-form-field>
    </div>

    @if (error()) {
      <app-error-state [message]="error()" (retry)="load()" />
    } @else {
      <div class="crm-table-wrap">
        <table
          mat-table
          [dataSource]="page().items"
          matSort
          [matSortActive]="query().sortBy ?? 'displayName'"
          [matSortDirection]="query().sortDirection ?? 'asc'"
          matSortDisableClear
          (matSortChange)="sort($event)"
        >
          <ng-container matColumnDef="displayName">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'admin.users.displayName' | t }}</th>
            <td mat-cell *matCellDef="let user">{{ user.displayName }}</td>
          </ng-container>
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'core.fields.email' | t }}</th>
            <td mat-cell *matCellDef="let user" dir="ltr" class="email-cell">{{ user.email }}</td>
          </ng-container>
          <ng-container matColumnDef="roles">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.users.roles' | t }}</th>
            <td mat-cell *matCellDef="let user">
              <span class="admin-chips">
                @for (role of rolesOf(user); track role) {
                  <span class="crm-pill crm-pill--primary">{{ role }}</span>
                } @empty {
                  <span class="crm-muted">{{ 'core.states.none' | t }}</span>
                }
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>{{ 'core.fields.status' | t }}</th>
            <td mat-cell *matCellDef="let user">
              <span class="crm-pill" [class.crm-pill--success]="isActive(user)" [class.crm-pill--danger]="!isActive(user)">
                {{ 'admin.status.' + statusOf(user) | t }}
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="lastLoginAt">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'admin.users.lastLogin' | t }}</th>
            <td mat-cell *matCellDef="let user">
              {{ lastLoginOf(user) ? (lastLoginOf(user) | localDate: 'relative') : ('admin.users.never' | t) }}
            </td>
          </ng-container>
          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'core.fields.createdAt' | t }}</th>
            <td mat-cell *matCellDef="let user">{{ createdOf(user) | localDate: 'shortDate' }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef><span class="cdk-visually-hidden">{{ 'core.actions.more' | t }}</span></th>
            <td mat-cell *matCellDef="let user" class="admin-actions-cell">
              <button mat-icon-button type="button" [matTooltip]="'core.actions.edit' | t" [attr.aria-label]="'core.actions.edit' | t" (click)="edit(user)">
                <mat-icon>edit</mat-icon>
              </button>
              @if (isActive(user)) {
                <button mat-icon-button type="button" [matTooltip]="'core.actions.deactivate' | t" [attr.aria-label]="'core.actions.deactivate' | t" (click)="toggle(user)">
                  <mat-icon>person_off</mat-icon>
                </button>
              } @else {
                <button mat-icon-button type="button" [matTooltip]="'core.actions.activate' | t" [attr.aria-label]="'core.actions.activate' | t" (click)="toggle(user)">
                  <mat-icon>how_to_reg</mat-icon>
                </button>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
        @if (loading()) {
          <app-loading />
        } @else if (page().items.length === 0) {
          <app-empty-state icon="group" [message]="'admin.users.empty' | t" />
        }
      </div>
      <mat-paginator
        [length]="page().meta.totalCount"
        [pageIndex]="query().page - 1"
        [pageSize]="query().pageSize"
        [pageSizeOptions]="[10, 25, 50, 100]"
        (page)="changePage($event)"
      />
    }
  `,
  styles: `.email-cell { text-align: start; }`,
})
export class UsersPage {
  private readonly api = inject(AdministrationApi);
  private readonly dialogs = inject(AdminDialogs);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly columns = ['displayName', 'email', 'roles', 'status', 'lastLoginAt', 'createdAt', 'actions'];
  readonly search = new FormControl('', { nonNullable: true });
  readonly query = signal<UserListQuery>({ page: 1, pageSize: 25, search: null, status: null, sortBy: 'displayName', sortDirection: 'asc' });
  readonly page = signal<Paged<UserListItem>>(emptyPage<UserListItem>());
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly opening = signal(false);

  constructor() {
    this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed()).subscribe((value) => {
      this.query.update((q) => ({ ...q, search: value.trim() || null, page: 1 }));
      this.load();
    });
    this.load();
  }

  // Typed accessors: mat-table row context is untyped (`any`).
  rolesOf(user: UserListItem): string[] {
    return user.roles;
  }
  statusOf(user: UserListItem): UserStatus {
    return user.status;
  }
  isActive(user: UserListItem): boolean {
    return user.status === 'Active';
  }
  lastLoginOf(user: UserListItem): string | null {
    return user.lastLoginAt;
  }
  createdOf(user: UserListItem): string {
    return user.createdAt;
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listUsers(this.query())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.page.set(page);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(adminErrorMessage(error, this.translations));
        },
      });
  }

  setStatus(status: UserStatus | null): void {
    this.query.update((q) => ({ ...q, status, page: 1 }));
    this.load();
  }

  sort(sort: Sort): void {
    this.query.update((q) => ({
      ...q,
      sortBy: (sort.active as UserSortField) || 'displayName',
      sortDirection: sort.direction || 'asc',
      page: 1,
    }));
    this.load();
  }

  changePage(event: PageEvent): void {
    this.query.update((q) => ({ ...q, page: event.pageIndex + 1, pageSize: event.pageSize }));
    this.load();
  }

  create(): void {
    this.openDialog(null);
  }

  edit(user: UserListItem): void {
    this.openDialog(user.id);
  }

  toggle(user: UserListItem): void {
    const activate = user.status !== 'Active';
    this.confirm
      .ask({
        title: activate ? 'admin.users.activateTitle' : 'admin.users.deactivateTitle',
        message: activate ? 'admin.users.activateMessage' : 'admin.users.deactivateMessage',
        confirmText: activate ? 'core.actions.activate' : 'core.actions.deactivate',
        destructive: !activate,
        params: { name: user.displayName },
      })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        const request = activate ? this.api.enableUser(user.id) : this.api.disableUser(user.id);
        request.subscribe({
          next: () => {
            this.toast.success(activate ? 'admin.users.activated' : 'admin.users.deactivated', { name: user.displayName });
            this.load();
          },
          error: (error: unknown) => this.toast.error(adminErrorMessage(error, this.translations)),
        });
      });
  }

  private openDialog(userId: string | null): void {
    this.opening.set(true);
    forkJoin({
      roles: this.api.listRoles(),
      branches: this.api.listBranches(true),
      user: userId ? this.api.getUser(userId) : of(null),
    }).subscribe({
      next: (result) => {
        this.opening.set(false);
        const data: UserDialogData = {
          user: result.user,
          roles: result.roles,
          branches: result.branches,
          currentUserId: this.auth.currentUser()?.id ?? null,
        };
        this.dialogs.open<UserDialogComponent, UserDialogData, boolean>(UserDialogComponent, data, '720px').subscribe((changed) => {
          if (changed) {
            this.load();
          }
        });
      },
      error: () => this.opening.set(false),
    });
  }
}
