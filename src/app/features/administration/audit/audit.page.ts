import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { Paged, emptyPage } from '../../../core/http/api.models';
import { LocalizedDatePipe } from '../../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { PermissionService } from '../../../core/permissions/permission.service';
import { Permissions } from '../../../core/permissions/permissions';
import { saveBlob } from '../../../shared/file-utils';
import { PageHeaderComponent } from '../../../shared/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { AdminDialogs } from '../admin-dialog';
import { adminErrorMessage } from '../admin-errors';
import { AdministrationApi } from '../administration.api';
import { AUDIT_ENTITY_TYPES, AuditLogResponse, AuditQuery, UserLookup } from '../administration.models';
import { AuditDetailDialogComponent } from './audit-detail-dialog.component';

/** `/admin/audit`: who changed what, with filters, paging, details and CSV export. */
@Component({
  selector: 'app-audit-page',
  imports: [
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
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
    <app-page-header [title]="'admin.audit.title' | t" [subtitle]="'admin.audit.subtitle' | t">
      @if (canExport) {
        <button mat-stroked-button type="button" (click)="export()" [disabled]="exporting()">
          <mat-icon>download</mat-icon>{{ 'core.actions.export' | t }}
        </button>
      }
    </app-page-header>

    <form class="crm-card filters" [formGroup]="filters" (ngSubmit)="apply()">
      <div class="crm-toolbar">
        <mat-form-field>
          <mat-label>{{ 'core.fields.from' | t }}</mat-label>
          <input matInput type="date" formControlName="from" dir="ltr" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'core.fields.to' | t }}</mat-label>
          <input matInput type="date" formControlName="to" dir="ltr" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'admin.audit.actor' | t }}</mat-label>
          <input matInput [formControl]="actor" [matAutocomplete]="actorAuto" [placeholder]="'admin.audit.actorHint' | t" />
          <mat-autocomplete #actorAuto="matAutocomplete" [displayWith]="displayUser">
            @for (user of actorOptions(); track user.id) {
              <mat-option [value]="user">{{ user.displayName }} <span class="crm-muted" dir="ltr">{{ user.email }}</span></mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'admin.audit.action' | t }}</mat-label>
          <input matInput formControlName="action" dir="ltr" placeholder="users.created" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'admin.audit.entityType' | t }}</mat-label>
          <mat-select formControlName="entityType">
            <mat-option value="">{{ 'core.states.all' | t }}</mat-option>
            @for (type of entityTypes; track type) {
              <mat-option [value]="type">{{ type }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'admin.audit.entityId' | t }}</mat-label>
          <input matInput formControlName="entityId" dir="ltr" />
        </mat-form-field>
      </div>
      <div class="crm-actions">
        @if (canExport) {
          <span class="admin-hint export-hint">{{ 'admin.audit.exportHint' | t }}</span>
        }
        <button mat-button type="button" (click)="clear()">{{ 'core.actions.clear' | t }}</button>
        <button mat-flat-button type="submit"><mat-icon>filter_list</mat-icon>{{ 'core.actions.apply' | t }}</button>
      </div>
    </form>

    @if (error()) {
      <app-error-state [message]="error()" (retry)="load()" />
    } @else {
      <div class="crm-table-wrap">
        <table mat-table [dataSource]="page().items">
          <ng-container matColumnDef="occurredAt">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.audit.occurredAt' | t }}</th>
            <td mat-cell *matCellDef="let entry">{{ entryOf(entry).occurredAt | localDate: 'short' }}</td>
          </ng-container>
          <ng-container matColumnDef="actor">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.audit.actor' | t }}</th>
            <td mat-cell *matCellDef="let entry">{{ entryOf(entry).actorDisplayName ?? ('admin.audit.system' | t) }}</td>
          </ng-container>
          <ng-container matColumnDef="action">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.audit.action' | t }}</th>
            <td mat-cell *matCellDef="let entry"><span class="admin-mono" dir="ltr">{{ entryOf(entry).action }}</span></td>
          </ng-container>
          <ng-container matColumnDef="entity">
            <th mat-header-cell *matHeaderCellDef>{{ 'admin.audit.entity' | t }}</th>
            <td mat-cell *matCellDef="let entry">
              {{ entryOf(entry).entityType }}
              @if (entryOf(entry).entityId; as id) {
                <div class="admin-mono crm-muted" dir="ltr">{{ id }}</div>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef><span class="cdk-visually-hidden">{{ 'core.actions.more' | t }}</span></th>
            <td mat-cell *matCellDef="let entry" class="admin-actions-cell">
              <button mat-icon-button type="button" [matTooltip]="'core.actions.view' | t" [attr.aria-label]="'core.actions.view' | t" (click)="open(entry); $event.stopPropagation()">
                <mat-icon>visibility</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns" class="crm-row-link" (click)="open(row)"></tr>
        </table>
        @if (loading()) {
          <app-loading />
        } @else if (page().items.length === 0) {
          <app-empty-state icon="history" [message]="'admin.audit.empty' | t" />
        }
      </div>
      <mat-paginator
        [length]="page().meta.totalCount"
        [pageIndex]="query().page - 1"
        [pageSize]="query().pageSize"
        [pageSizeOptions]="[25, 50, 100]"
        (page)="changePage($event)"
      />
    }
  `,
  styles: `
    .filters { margin-bottom: var(--crm-gap); }
    .export-hint { margin: 0; margin-inline-end: auto; align-self: center; }
  `,
})
export class AuditPage {
  private readonly api = inject(AdministrationApi);
  private readonly dialogs = inject(AdminDialogs);
  private readonly translations = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canExport = inject(PermissionService).has(Permissions.auditExport);
  readonly entityTypes = AUDIT_ENTITY_TYPES;
  readonly columns = ['occurredAt', 'actor', 'action', 'entity', 'actions'];

  readonly filters = inject(NonNullableFormBuilder).group({ from: '', to: '', action: '', entityType: '', entityId: '' });
  readonly actor = new FormControl<string | UserLookup>('', { nonNullable: true });
  readonly actorOptions = signal<UserLookup[]>([]);

  readonly query = signal<AuditQuery>({ page: 1, pageSize: 25, action: null, entityType: null, entityId: null, actorUserId: null, from: null, to: null });
  readonly page = signal<Paged<AuditLogResponse>>(emptyPage<AuditLogResponse>());
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly exporting = signal(false);

  readonly displayUser = (value: string | UserLookup | null): string => (typeof value === 'string' ? value : (value?.displayName ?? ''));

  constructor() {
    this.actor.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((value) => (typeof value === 'string' ? this.api.lookupUsers(value.trim() || null).pipe(catchError(() => of([]))) : of(this.actorOptions()))),
        takeUntilDestroyed(),
      )
      .subscribe((users) => this.actorOptions.set(users));
    this.load();
  }

  entryOf(entry: AuditLogResponse): AuditLogResponse {
    return entry;
  }

  apply(): void {
    const v = this.filters.getRawValue();
    const actor = this.actor.value;
    this.query.update((q) => ({
      ...q,
      page: 1,
      from: startOfDay(v.from),
      to: endOfDay(v.to),
      action: v.action.trim() || null,
      entityType: v.entityType || null,
      entityId: v.entityId.trim() || null,
      actorUserId: typeof actor === 'string' ? null : actor.id,
    }));
    this.load();
  }

  clear(): void {
    this.filters.reset();
    this.actor.setValue('');
    this.apply();
  }

  changePage(event: PageEvent): void {
    this.query.update((q) => ({ ...q, page: event.pageIndex + 1, pageSize: event.pageSize }));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listAuditLogs(this.query())
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

  open(entry: AuditLogResponse): void {
    this.dialogs.open<AuditDetailDialogComponent, AuditLogResponse, void>(AuditDetailDialogComponent, entry, '760px').subscribe();
  }

  /** The CSV endpoint only supports from, to and action. */
  export(): void {
    const q = this.query();
    this.exporting.set(true);
    this.api.exportAuditLogs(q.from, q.to, q.action).subscribe({
      next: (file) => {
        this.exporting.set(false);
        saveBlob(file.blob, file.fileName);
      },
      error: () => this.exporting.set(false),
    });
  }
}

function startOfDay(date: string): string | null {
  return date ? new Date(`${date}T00:00:00`).toISOString() : null;
}

function endOfDay(date: string): string | null {
  return date ? new Date(`${date}T23:59:59.999`).toISOString() : null;
}
