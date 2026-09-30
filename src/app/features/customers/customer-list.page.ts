import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { Paged, emptyPage } from '../../core/http/api.models';
import { describeError } from '../../core/interceptors/error.interceptor';
import { LocalizedDatePipe } from '../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { HasPermissionDirective } from '../../core/permissions/has-permission.directive';
import { Permissions } from '../../core/permissions/permissions';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/state.components';
import { CustomersApi } from './customers.api';
import {
  BranchOption,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  CustomerListItem,
  CustomerListQuery,
  CustomerSortField,
} from './customers.models';

const PAGE_SIZE = 25;

/** `/customers`: searchable, sortable, filterable server-paged list (GET /customers). */
@Component({
  selector: 'app-customer-list-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TranslatePipe,
    LocalizedDatePipe,
    HasPermissionDirective,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'customers.list.title' | t" [subtitle]="'customers.list.subtitle' | t">
      <a mat-flat-button routerLink="new" *appHasPermission="permissions.customersCreate">
        <mat-icon>person_add</mat-icon>{{ 'customers.list.new' | t }}
      </a>
    </app-page-header>

    <div class="crm-toolbar">
      <mat-form-field class="search" subscriptSizing="dynamic">
        <mat-label>{{ 'customers.list.search' | t }}</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [formControl]="searchControl" autocomplete="off" />
        @if (searchControl.value) {
          <button matSuffix mat-icon-button type="button" (click)="searchControl.setValue('')" [attr.aria-label]="'core.actions.clear' | t">
            <mat-icon>close</mat-icon>
          </button>
        }
      </mat-form-field>
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>{{ 'customers.fields.status' | t }}</mat-label>
        <mat-select [value]="query().status" (selectionChange)="setFilter({ status: $event.value })">
          <mat-option [value]="null">{{ 'core.states.all' | t }}</mat-option>
          @for (status of statuses; track status) {
            <mat-option [value]="status">{{ 'customers.status.' + status | t }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>{{ 'customers.fields.type' | t }}</mat-label>
        <mat-select [value]="query().type" (selectionChange)="setFilter({ type: $event.value })">
          <mat-option [value]="null">{{ 'core.states.all' | t }}</mat-option>
          @for (type of types; track type) {
            <mat-option [value]="type">{{ 'customers.type.' + type | t }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>{{ 'customers.fields.branch' | t }}</mat-label>
        <mat-select [value]="query().branchId" (selectionChange)="setFilter({ branchId: $event.value, departmentId: null })">
          <mat-option [value]="null">{{ 'core.states.all' | t }}</mat-option>
          @for (branch of branches(); track branch.id) {
            <mat-option [value]="branch.id">{{ branch.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      @if (departments().length) {
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>{{ 'customers.fields.department' | t }}</mat-label>
          <mat-select [value]="query().departmentId" (selectionChange)="setFilter({ departmentId: $event.value })">
            <mat-option [value]="null">{{ 'core.states.all' | t }}</mat-option>
            @for (department of departments(); track department.id) {
              <mat-option [value]="department.id">{{ department.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>{{ 'customers.fields.tag' | t }}</mat-label>
        <input matInput [formControl]="tagControl" autocomplete="off" />
      </mat-form-field>
      @if (hasFilters()) {
        <button mat-button type="button" (click)="clearFilters()">{{ 'customers.list.clearFilters' | t }}</button>
      }
    </div>

    @if (error(); as message) {
      <app-error-state [message]="message" (retry)="load()" />
    } @else if (loading() && !page().items.length) {
      <app-loading />
    } @else {
      <div class="crm-table-wrap">
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        <table mat-table [dataSource]="page().items" matSort [matSortActive]="query().sortBy ?? 'name'" [matSortDirection]="query().sortDirection ?? 'asc'" (matSortChange)="sort($event)">
          <ng-container matColumnDef="number">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'customers.fields.number' | t }}</th>
            <td mat-cell *matCellDef="let row">{{ row.number }}</td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'customers.fields.name' | t }}</th>
            <td mat-cell *matCellDef="let row">
              <div class="name">{{ row.name }}</div>
              @if (row.companyName) {
                <div class="crm-muted small">{{ row.companyName }}</div>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="contact">
            <th mat-header-cell *matHeaderCellDef>{{ 'customers.list.contact' | t }}</th>
            <td mat-cell *matCellDef="let row">
              @if (row.primaryEmail) {
                <div class="ltr-value">{{ row.primaryEmail }}</div>
              }
              @if (row.primaryPhone) {
                <div class="ltr-value crm-muted small">{{ row.primaryPhone }}</div>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef>{{ 'customers.fields.type' | t }}</th>
            <td mat-cell *matCellDef="let row">{{ 'customers.type.' + row.type | t }}</td>
          </ng-container>
          <ng-container matColumnDef="branch">
            <th mat-header-cell *matHeaderCellDef>{{ 'customers.fields.branch' | t }}</th>
            <td mat-cell *matCellDef="let row">
              {{ row.branchName }}
              @if (row.departmentName) {
                <div class="crm-muted small">{{ row.departmentName }}</div>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="openTickets">
            <th mat-header-cell *matHeaderCellDef>{{ 'customers.list.openTickets' | t }}</th>
            <td mat-cell *matCellDef="let row">{{ row.openTickets }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>{{ 'customers.fields.status' | t }}</th>
            <td mat-cell *matCellDef="let row">
              <span class="crm-pill" [class.crm-pill--success]="row.status === 'Active'">{{ 'customers.status.' + row.status | t }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>{{ 'customers.fields.createdAt' | t }}</th>
            <td mat-cell *matCellDef="let row">{{ row.createdAt | localDate: 'shortDate' }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns" class="crm-row-link" tabindex="0" (click)="open(row)" (keydown.enter)="open(row)"></tr>
        </table>
        @if (!page().items.length && !loading()) {
          <app-empty-state icon="groups" [message]="(hasFilters() ? 'customers.list.noMatches' : 'customers.list.empty') | t" />
        }
        <mat-paginator
          [length]="page().meta.totalCount"
          [pageIndex]="query().page - 1"
          [pageSize]="query().pageSize"
          [pageSizeOptions]="[10, 25, 50, 100]"
          (page)="changePage($event)"
        />
      </div>
    }
  `,
  styles: `
    .search { flex: 1 1 280px; }
    .name { font-weight: 500; }
    .small { font: var(--mat-sys-body-small); }
    .ltr-value { direction: ltr; unicode-bidi: plaintext; text-align: start; }
  `,
})
export class CustomerListPage implements OnInit {
  private readonly api = inject(CustomersApi);
  private readonly router = inject(Router);
  private readonly translations = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;

  readonly permissions = Permissions;
  readonly statuses = CUSTOMER_STATUSES;
  readonly types = CUSTOMER_TYPES;
  readonly columns = ['number', 'name', 'contact', 'type', 'branch', 'openTickets', 'status', 'createdAt'];

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly tagControl = new FormControl('', { nonNullable: true });

  readonly query = signal<CustomerListQuery>({
    page: 1,
    pageSize: PAGE_SIZE,
    search: null,
    status: null,
    type: null,
    branchId: null,
    departmentId: null,
    tag: null,
    sortBy: 'name',
    sortDirection: 'asc',
  });
  readonly page = signal<Paged<CustomerListItem>>(emptyPage<CustomerListItem>(PAGE_SIZE));
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly branches = signal<BranchOption[]>([]);

  readonly departments = computed(() => this.branches().find((b) => b.id === this.query().branchId)?.departments ?? []);
  readonly hasFilters = computed(() => {
    const q = this.query();
    return !!(q.search || q.status || q.type || q.branchId || q.departmentId || q.tag);
  });

  ngOnInit(): void {
    this.api.branches().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (branches) => this.branches.set(branches) });
    this.searchControl.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => this.setFilter({ search: search.trim() || null }));
    this.tagControl.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((tag) => this.setFilter({ tag: tag.trim() || null }));
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
    this.load();
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.api.list(this.query()).subscribe({
      next: (page) => {
        this.page.set(page);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(describeError(ApiError.from(error), this.translations));
      },
    });
  }

  setFilter(changes: Partial<CustomerListQuery>): void {
    this.query.update((q) => ({ ...q, ...changes, page: 1 }));
    this.load();
  }

  clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.tagControl.setValue('', { emitEvent: false });
    this.setFilter({ search: null, status: null, type: null, branchId: null, departmentId: null, tag: null });
  }

  sort(sort: Sort): void {
    const active = sort.direction ? (sort.active as CustomerSortField) : 'name';
    this.setFilter({ sortBy: active, sortDirection: sort.direction || 'asc' });
  }

  changePage(event: PageEvent): void {
    this.query.update((q) => ({ ...q, page: event.pageIndex + 1, pageSize: event.pageSize }));
    this.load();
  }

  open(row: CustomerListItem): void {
    void this.router.navigate(['/customers', row.id]);
  }
}
