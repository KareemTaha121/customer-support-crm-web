import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Subscription, debounceTime, merge } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { LocalizedDatePipe } from '../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { RealtimeEvents, StaffHubService } from '../../core/realtime/staff-hub.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { ErrorStateComponent, LoadingComponent } from '../../shared/state.components';
import { DashboardApi, isOverdue } from './dashboard.api';
import { AgentDashboard, AgentDashboardCounts, AgentTask } from './dashboard.models';
import { DashboardTicketListComponent } from './dashboard-ticket-list.component';

interface Kpi {
  key: keyof AgentDashboardCounts;
  icon: string;
  tone: 'primary' | 'warning' | 'danger' | 'success' | 'info';
  /** `null` for counts without a list page (notifications open from the toolbar bell). */
  link: string | null;
}

const KPIS: readonly Kpi[] = [
  { key: 'myOpen', icon: 'assignment_ind', tone: 'primary', link: '/tickets' },
  { key: 'myPendingCustomer', icon: 'hourglass_top', tone: 'info', link: '/tickets' },
  { key: 'myAtRisk', icon: 'warning', tone: 'danger', link: '/tickets' },
  { key: 'myResolvedToday', icon: 'task_alt', tone: 'success', link: '/tickets' },
  { key: 'unassignedInScope', icon: 'person_off', tone: 'warning', link: '/tickets' },
  { key: 'escalatedInScope', icon: 'trending_up', tone: 'danger', link: '/tickets' },
  { key: 'openTasks', icon: 'checklist', tone: 'primary', link: '/dashboard/tasks' },
  { key: 'overdueTasks', icon: 'alarm', tone: 'danger', link: '/dashboard/tasks' },
  { key: 'unreadNotifications', icon: 'notifications_active', tone: 'info', link: null },
];

/** Agent home screen (`/dashboard`): live counts, ticket lists, recent customers and tasks. */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatProgressBarModule,
    TranslatePipe,
    LocalizedDatePipe,
    PageHeaderComponent,
    LoadingComponent,
    ErrorStateComponent,
    DashboardTicketListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  private readonly api = inject(DashboardApi);
  private readonly auth = inject(AuthService);
  private readonly translations = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly kpis = KPIS;
  readonly data = signal<AgentDashboard | null>(null);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly error = signal<string | null>(null);
  readonly forbidden = signal(false);
  readonly busyTaskId = signal<string | null>(null);
  readonly lastUpdated = signal<Date | null>(null);

  readonly userName = computed(() => this.auth.currentUser()?.displayName ?? '');
  readonly greetingKey = computed(() => {
    // Re-evaluated on every refresh so the greeting follows the time of day.
    this.lastUpdated();
    const hour = new Date().getHours();
    return hour < 12 ? 'dashboard.home.greetingMorning' : hour < 18 ? 'dashboard.home.greetingAfternoon' : 'dashboard.home.greetingEvening';
  });

  private request: Subscription | null = null;

  constructor() {
    this.load();
    const hub = inject(StaffHubService);
    merge(hub.on<unknown>(RealtimeEvents.ticketUpdated), hub.on<unknown>(RealtimeEvents.notificationCreated))
      .pipe(debounceTime(1500), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load(true));
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  /** `background` keeps the current content visible while reloading. */
  load(background = false): void {
    this.request?.unsubscribe();
    if (background && this.data()) {
      this.refreshing.set(true);
    } else {
      this.loading.set(true);
      this.error.set(null);
    }
    this.request = this.api.agentDashboard({ silent: true }).subscribe({
      next: (data) => {
        this.data.set(data);
        this.forbidden.set(false);
        this.error.set(null);
        this.loading.set(false);
        this.refreshing.set(false);
        this.lastUpdated.set(new Date());
      },
      error: (error: unknown) => {
        const apiError = ApiError.from(error);
        this.loading.set(false);
        this.refreshing.set(false);
        if (apiError.status === 403) {
          this.forbidden.set(true);
        } else if (!this.data()) {
          this.error.set(describeError(apiError, this.translations));
        }
      },
    });
  }

  count(key: keyof AgentDashboardCounts): number {
    return this.data()?.counts[key] ?? 0;
  }

  isOverdue(task: AgentTask): boolean {
    return isOverdue(task);
  }

  complete(task: AgentTask): void {
    if (this.busyTaskId()) {
      return;
    }
    this.busyTaskId.set(task.id);
    this.api.completeTask(task.id).subscribe({
      next: () => {
        this.busyTaskId.set(null);
        this.data.update((d) =>
          d
            ? {
                ...d,
                myTasks: d.myTasks.filter((t) => t.id !== task.id),
                counts: {
                  ...d.counts,
                  openTasks: Math.max(0, d.counts.openTasks - 1),
                  overdueTasks: Math.max(0, d.counts.overdueTasks - (isOverdue(task) ? 1 : 0)),
                },
              }
            : d,
        );
      },
      error: () => {
        this.busyTaskId.set(null);
        this.load(true);
      },
    });
  }
}
