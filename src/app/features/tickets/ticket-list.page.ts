import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { Subscription, debounceTime } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { Paged, SortDirection, emptyPage } from '../../core/http/api.models';
import { describeError } from '../../core/interceptors/error.interceptor';
import { LocalizedDatePipe } from '../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { HasPermissionDirective } from '../../core/permissions/has-permission.directive';
import { RealtimeEvents, StaffHubService } from '../../core/realtime/staff-hub.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/state.components';
import { TicketAgentPickerComponent } from './agent-picker.component';
import { TicketsApi } from './tickets.api';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TicketCategory,
  TicketListItem,
  TicketListQuery,
  UserLookup,
  buildCategoryTree,
  categoryLabel,
  dayToIso,
  priorityTone,
  slaTone,
  statusTone,
} from './tickets.models';

type AssigneeMode = '' | 'me' | 'unassigned' | 'agent';

const SORTABLE = ['number', 'priority', 'dueAt', 'createdAt', 'updatedAt'];

/** `/tickets`: filterable, sortable, paged ticket list. Filters live in the query string. */
@Component({
  selector: 'app-ticket-list-page',
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
    MatTooltipModule,
    TranslatePipe,
    LocalizedDatePipe,
    HasPermissionDirective,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    TicketAgentPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-list.page.html',
  styles: `
    .filters { display: grid; gap: 8px 12px; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); align-items: start; margin-bottom: 12px; }
    .filters .search { grid-column: span 2; }
    @media (max-width: 600px) { .filters .search { grid-column: auto; } }
    .filters-actions { display: flex; gap: 8px; align-items: center; min-block-size: 56px; }
    .subject { display: flex; flex-direction: column; gap: 2px; min-inline-size: 220px; }
    .subject a { color: inherit; font-weight: 500; text-decoration: none; }
    .subject small { color: var(--mat-sys-on-surface-variant); }
    .number { font-family: monospace; white-space: nowrap; }
    .sla { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; }
    .sla small { color: var(--mat-sys-on-surface-variant); white-space: nowrap; }
    .escalated { color: var(--crm-danger); font-size: 18px; inline-size: 18px; block-size: 18px; vertical-align: middle; margin-inline-start: 4px; }
    .indent { display: inline-block; }
  `,
})
export class TicketListPage {
  private readonly api = inject(TicketsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly hub = inject(StaffHubService);
  private readonly translations = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);
  private request: Subscription | null = null;

  readonly statuses = TICKET_STATUSES;
  readonly priorities = TICKET_PRIORITIES;
  readonly columns = ['number', 'subject', 'status', 'priority', 'category', 'assignee', 'dueAt', 'createdAt'];
  readonly statusTone = statusTone;
  readonly priorityTone = priorityTone;
  readonly slaTone = slaTone;

  readonly page = signal<Paged<TicketListItem>>(emptyPage<TicketListItem>());
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(25);
  readonly sortBy = signal('createdAt');
  readonly sortDirection = signal<SortDirection>('desc');
  readonly categories = signal<TicketCategory[]>([]);
  readonly agent = signal<UserLookup | null>(null);
  readonly agentName = signal<string | null>(null);

  readonly categoryTree = computed(() => buildCategoryTree(this.categories()));
  readonly language = this.translations.language;

  readonly filters = inject(NonNullableFormBuilder).group({
    search: [''],
    statuses: [[] as string[]],
    priorities: [[] as string[]],
    categoryId: [''],
    assignee: ['' as AssigneeMode],
    createdFrom: [''],
    createdTo: [''],
  });

  constructor() {
    this.readQueryParams(this.route.snapshot.queryParams);
    this.api.categories().subscribe({ next: (items) => this.categories.set(items), error: () => undefined });

    this.filters.valueChanges.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => {
      this.pageIndex.set(0);
      this.load();
    });

    this.hub
      .on<unknown>(RealtimeEvents.ticketUpdated)
      .pipe(debounceTime(1000), takeUntilDestroyed())
      .subscribe(() => this.load(true));

    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
    this.load();
  }

  categoryName(category: TicketCategory): string {
    return categoryLabel(category, this.language());
  }

  load(background = false): void {
    this.request?.unsubscribe();
    if (!background) {
      this.loading.set(true);
    }
    this.error.set(null);
    const query = this.buildQuery();
    this.writeQueryParams();
    this.request = this.api.list(query).subscribe({
      next: (page) => {
        this.page.set(page);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        if (!background) {
          this.error.set(describeError(ApiError.from(error), this.translations));
        }
      },
    });
  }

  onSort(sort: Sort): void {
    this.sortBy.set(sort.direction ? sort.active : 'createdAt');
    this.sortDirection.set(sort.direction === 'asc' ? 'asc' : 'desc');
    this.pageIndex.set(0);
    this.load();
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  onAgentPicked(user: UserLookup | null): void {
    this.agent.set(user);
    this.agentName.set(user?.displayName ?? null);
    if (this.filters.controls.assignee.value === 'agent') {
      this.pageIndex.set(0);
      this.load();
    }
  }

  resetFilters(): void {
    this.agent.set(null);
    this.agentName.set(null);
    this.filters.reset();
  }

  open(ticket: TicketListItem): void {
    void this.router.navigate(['/tickets', ticket.id]);
  }

  private buildQuery(): TicketListQuery {
    const value = this.filters.getRawValue();
    const statuses = value.statuses.includes('active') ? 'active' : value.statuses.join(',');
    let assignee: string | null = null;
    if (value.assignee === 'me' || value.assignee === 'unassigned') {
      assignee = value.assignee;
    } else if (value.assignee === 'agent') {
      assignee = this.agent()?.id ?? null;
    }
    return {
      page: this.pageIndex() + 1,
      pageSize: this.pageSize(),
      search: value.search.trim() || null,
      status: statuses || null,
      priority: value.priorities.join(',') || null,
      assignee,
      categoryId: value.categoryId || null,
      createdFrom: dayToIso(value.createdFrom, false),
      createdTo: dayToIso(value.createdTo, true),
      sortBy: this.sortBy(),
      sortDirection: this.sortDirection(),
    };
  }

  private readQueryParams(params: Params): void {
    const list = (key: string): string[] => (typeof params[key] === 'string' && params[key] ? (params[key] as string).split(',') : []);
    const text = (key: string): string => (typeof params[key] === 'string' ? (params[key] as string) : '');
    const assignee = text('assignee');
    const mode: AssigneeMode = assignee === 'me' || assignee === 'unassigned' ? assignee : assignee ? 'agent' : '';
    if (mode === 'agent') {
      this.agent.set({ id: assignee, displayName: text('assigneeName'), email: '' });
      this.agentName.set(text('assigneeName') || null);
    }
    this.filters.setValue(
      {
        search: text('search'),
        statuses: list('status').filter((s) => s === 'active' || (TICKET_STATUSES as readonly string[]).includes(s)),
        priorities: list('priority').filter((p) => (TICKET_PRIORITIES as readonly string[]).includes(p)),
        categoryId: text('categoryId'),
        assignee: mode,
        createdFrom: text('from'),
        createdTo: text('to'),
      },
      { emitEvent: false },
    );
    const page = Number(text('page'));
    const size = Number(text('pageSize'));
    if (page > 0) {
      this.pageIndex.set(page - 1);
    }
    if ([10, 25, 50, 100].includes(size)) {
      this.pageSize.set(size);
    }
    if (SORTABLE.includes(text('sortBy'))) {
      this.sortBy.set(text('sortBy'));
    }
    if (text('sortDirection') === 'asc') {
      this.sortDirection.set('asc');
    }
  }

  private writeQueryParams(): void {
    const value = this.filters.getRawValue();
    const agent = value.assignee === 'agent' ? this.agent() : null;
    const queryParams: Params = {
      search: value.search || null,
      status: value.statuses.join(',') || null,
      priority: value.priorities.join(',') || null,
      categoryId: value.categoryId || null,
      assignee: value.assignee === 'agent' ? (agent?.id ?? null) : value.assignee || null,
      assigneeName: agent?.displayName || null,
      from: value.createdFrom || null,
      to: value.createdTo || null,
      page: this.pageIndex() > 0 ? this.pageIndex() + 1 : null,
      pageSize: this.pageSize() !== 25 ? this.pageSize() : null,
      sortBy: this.sortBy() !== 'createdAt' ? this.sortBy() : null,
      sortDirection: this.sortDirection() === 'asc' ? 'asc' : null,
    };
    void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
  }
}
