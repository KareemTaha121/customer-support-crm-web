import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { Subscription, filter, switchMap } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { LocalizedDatePipe } from '../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { ConfirmService } from '../../shared/confirm-dialog.component';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/state.components';
import { DashboardApi, isOverdue } from './dashboard.api';
import { AgentTask, TaskStatusFilter } from './dashboard.models';
import { TaskDialogComponent, TaskDialogData } from './task-dialog.component';

type TaskView = 'open' | 'overdue' | 'dueToday' | 'completed' | 'all';

const VIEW_STATUS: Record<TaskView, TaskStatusFilter> = {
  open: 'open',
  overdue: 'open',
  dueToday: 'open',
  completed: 'completed',
  all: 'all',
};

/** `/dashboard/tasks`: the agent's tasks and reminders. */
@Component({
  selector: 'app-tasks-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatIconModule,
    MatMenuModule,
    TranslatePipe,
    LocalizedDatePipe,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'dashboard.tasks.title' | t" [subtitle]="'dashboard.tasks.subtitle' | t" backLink="/dashboard">
      <button mat-flat-button type="button" (click)="openDialog(null)">
        <mat-icon>add</mat-icon>{{ 'dashboard.tasks.new' | t }}
      </button>
    </app-page-header>

    <div class="crm-toolbar">
      <mat-button-toggle-group [value]="view()" (change)="setView($event.value)" [attr.aria-label]="'core.actions.filter' | t" hideSingleSelectionIndicator>
        @for (option of views; track option) {
          <mat-button-toggle [value]="option">{{ 'dashboard.tasks.filters.' + option | t }}</mat-button-toggle>
        }
      </mat-button-toggle-group>
      <span class="crm-spacer"></span>
      <span class="crm-muted">{{ 'dashboard.tasks.count' | t: { count: visible().length } }}</span>
    </div>

    @if (loading()) {
      <app-loading />
    } @else if (error()) {
      <app-error-state [message]="error()" (retry)="load()" />
    } @else if (!visible().length) {
      <app-empty-state icon="checklist" [message]="'dashboard.tasks.empty' | t">
        <button mat-stroked-button type="button" (click)="openDialog(null)">{{ 'dashboard.tasks.new' | t }}</button>
      </app-empty-state>
    } @else {
      <ul class="task-list">
        @for (task of visible(); track task.id) {
          <li class="crm-card task" [class.task--done]="!!task.completedAt" [class.task--overdue]="isOverdue(task)">
            <mat-checkbox
              [checked]="!!task.completedAt"
              [disabled]="busyId() === task.id"
              (change)="toggle(task)"
              [aria-label]="(task.completedAt ? 'dashboard.tasks.reopen' : 'dashboard.tasks.markComplete') | t"
            />
            <div class="task__body">
              <span class="task__title">{{ task.title }}</span>
              @if (task.notes) {
                <span class="task__notes crm-muted">{{ task.notes }}</span>
              }
              <span class="task__meta">
                @if (task.completedAt) {
                  <span class="crm-pill crm-pill--success">{{ 'dashboard.tasks.completedAt' | t: { date: (task.completedAt | localDate: 'short') } }}</span>
                } @else if (task.dueAt) {
                  <span class="crm-pill" [class.crm-pill--danger]="isOverdue(task)">
                    <mat-icon aria-hidden="true">event</mat-icon>
                    {{ (isOverdue(task) ? 'dashboard.tasks.overdueSince' : 'dashboard.tasks.dueAt') | t: { date: (task.dueAt | localDate: 'short') } }}
                  </span>
                }
                @if (task.remindAt && !task.completedAt) {
                  <span class="crm-pill crm-pill--info">
                    <mat-icon aria-hidden="true">notifications</mat-icon>
                    {{ task.remindAt | localDate: 'short' }}
                  </span>
                }
                @if (task.ticketId) {
                  <a class="crm-pill crm-pill--primary" [routerLink]="['/tickets', task.ticketId]">
                    <mat-icon aria-hidden="true">confirmation_number</mat-icon>{{ task.ticketNumber }}
                  </a>
                }
                @if (task.customerId && task.customerName) {
                  <a class="crm-pill" [routerLink]="['/customers', task.customerId]">
                    <mat-icon aria-hidden="true">person</mat-icon>{{ task.customerName }}
                  </a>
                }
              </span>
            </div>
            <button mat-icon-button type="button" [matMenuTriggerFor]="menu" [attr.aria-label]="'core.actions.more' | t">
              <mat-icon>more_vert</mat-icon>
            </button>
            <mat-menu #menu="matMenu" xPosition="before">
              <button mat-menu-item type="button" (click)="openDialog(task)">
                <mat-icon>edit</mat-icon>{{ 'core.actions.edit' | t }}
              </button>
              <button mat-menu-item type="button" (click)="toggle(task)">
                <mat-icon>{{ task.completedAt ? 'undo' : 'task_alt' }}</mat-icon>
                {{ (task.completedAt ? 'dashboard.tasks.reopen' : 'dashboard.tasks.markComplete') | t }}
              </button>
              <button mat-menu-item type="button" (click)="remove(task)">
                <mat-icon>delete</mat-icon>{{ 'core.actions.delete' | t }}
              </button>
            </mat-menu>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .task-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .task { display: flex; align-items: flex-start; gap: 8px; padding-block: 8px; }
    .task--overdue { border-inline-start: 4px solid var(--crm-danger); }
    .task--done .task__title { text-decoration: line-through; color: var(--mat-sys-on-surface-variant); }
    .task__body { flex: 1 1 auto; display: flex; flex-direction: column; gap: 4px; min-width: 0; padding-top: 10px; }
    .task__title { font: var(--mat-sys-title-small); overflow-wrap: anywhere; }
    .task__notes { white-space: pre-line; overflow-wrap: anywhere; font: var(--mat-sys-body-medium); }
    .task__meta { display: flex; flex-wrap: wrap; gap: 6px; }
    .task__meta mat-icon { font-size: 16px; width: 16px; height: 16px; }
    a.crm-pill { text-decoration: none; }
  `,
})
export class TasksPage {
  private readonly api = inject(DashboardApi);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly views: readonly TaskView[] = ['open', 'overdue', 'dueToday', 'completed', 'all'];
  readonly view = signal<TaskView>('open');
  readonly tasks = signal<AgentTask[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

  readonly visible = computed(() => {
    const view = this.view();
    const tasks = this.tasks();
    if (view === 'overdue') {
      return tasks.filter(isOverdue);
    }
    if (view === 'dueToday') {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return tasks.filter((t) => !t.completedAt && !!t.dueAt && new Date(t.dueAt).getTime() <= end.getTime());
    }
    return tasks;
  });

  private request: Subscription | null = null;

  constructor() {
    this.load();
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  setView(view: TaskView): void {
    const reload = VIEW_STATUS[view] !== VIEW_STATUS[this.view()];
    this.view.set(view);
    if (reload) {
      this.load();
    }
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.api.tasks(VIEW_STATUS[this.view()], { silent: true }).subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(describeError(ApiError.from(error), this.translations));
      },
    });
  }

  isOverdue(task: AgentTask): boolean {
    return isOverdue(task);
  }

  openDialog(task: AgentTask | null): void {
    this.dialog
      .open<TaskDialogComponent, TaskDialogData, AgentTask>(TaskDialogComponent, {
        data: { task },
        width: '600px',
        maxWidth: '95vw',
        direction: this.translations.direction(),
      })
      .afterClosed()
      .pipe(filter((saved): saved is AgentTask => !!saved))
      .subscribe(() => this.load());
  }

  toggle(task: AgentTask): void {
    if (this.busyId()) {
      return;
    }
    this.busyId.set(task.id);
    const call = task.completedAt ? this.api.reopenTask(task.id) : this.api.completeTask(task.id);
    call.subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(task.completedAt ? 'dashboard.tasks.reopened' : 'dashboard.tasks.completed');
        this.load();
      },
      error: () => {
        this.busyId.set(null);
        this.load();
      },
    });
  }

  remove(task: AgentTask): void {
    this.confirm
      .ask({ title: 'dashboard.tasks.deleteTitle', message: 'dashboard.tasks.deleteMessage', params: { title: task.title }, confirmText: 'core.actions.delete', destructive: true })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.deleteTask(task.id)),
      )
      .subscribe(() => {
        this.toast.success('core.states.deleted');
        this.tasks.update((items) => items.filter((t) => t.id !== task.id));
      });
  }
}
