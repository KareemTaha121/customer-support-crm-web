import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabChangeEvent, MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { Observable, Subscription, catchError, filter, forkJoin, of } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { AttachmentResponse } from '../../core/http/api.models';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { PermissionService } from '../../core/permissions/permission.service';
import { Permissions } from '../../core/permissions/permissions';
import { RealtimeEvents, StaffHubService } from '../../core/realtime/staff-hub.service';
import { ConfirmService } from '../../shared/confirm-dialog.component';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { ErrorStateComponent, LoadingComponent } from '../../shared/state.components';
import { AiCategorySuggestion, TicketAiPanelComponent } from '../ai/ticket-ai-panel.component';
import { TicketAttachmentsComponent } from './ticket-attachments.component';
import { TicketConversationComponent } from './ticket-conversation.component';
import { TicketEditDialog, TicketEscalateDialog, TicketTransferDialog } from './ticket-dialogs';
import { TicketHistoryComponent } from './ticket-history.component';
import { TicketSidePanelComponent } from './ticket-side-panel.component';
import { TicketsApi } from './tickets.api';
import {
  TICKET_PRIORITIES,
  Ticket,
  TicketCategory,
  TicketErrorCodes,
  TicketHistoryEntry,
  TicketMessage,
  TransferTicketRequest,
  priorityTone,
  statusTone,
  ticketIdFromPayload,
} from './tickets.models';

interface StatusAction {
  target: string;
  label: string;
  icon: string;
}

const HISTORY_TAB = 2;

/** `/tickets/:id`: conversation, attachments, history, side panel and status actions. */
@Component({
  selector: 'app-ticket-details-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    MatTabsModule,
    MatTooltipModule,
    TranslatePipe,
    PageHeaderComponent,
    LoadingComponent,
    ErrorStateComponent,
    TicketConversationComponent,
    TicketAttachmentsComponent,
    TicketHistoryComponent,
    TicketSidePanelComponent,
    TicketAiPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-details.page.html',
  styleUrl: './ticket-details.page.scss',
})
export class TicketDetailsPage {
  private readonly api = inject(TicketsApi);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly permissions = inject(PermissionService);
  private readonly conversation = viewChild(TicketConversationComponent);
  private request: Subscription | null = null;

  /** Route parameter (component input binding). */
  readonly id = input.required<string>();

  readonly ticket = signal<Ticket | null>(null);
  readonly messages = signal<TicketMessage[]>([]);
  readonly attachments = signal<AttachmentResponse[]>([]);
  readonly history = signal<TicketHistoryEntry[] | null>(null);
  readonly categories = signal<TicketCategory[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly tabIndex = signal(0);

  readonly statusTone = statusTone;
  readonly priorityTone = priorityTone;
  readonly canUpdate = this.permissions.has(Permissions.ticketsUpdate);
  readonly canEscalate = this.permissions.has(Permissions.ticketsEscalate);
  readonly canDelete = this.permissions.has(Permissions.ticketsDelete);
  readonly canTransfer = this.permissions.has(Permissions.ticketsAssign);
  readonly canUseAi = this.permissions.has(Permissions.aiUse);

  /** Transitions the server allows from the current status (`TicketResponse.allowedStatuses`). */
  readonly statusActions = computed<StatusAction[]>(() => {
    const ticket = this.ticket();
    if (!ticket || !this.canUpdate) {
      return [];
    }
    return ticket.allowedStatuses.map((target) => {
      switch (target) {
        case 'Resolved':
          return { target, label: 'tickets.actions.resolve', icon: 'task_alt' };
        case 'Closed':
          return { target, label: 'tickets.actions.close', icon: 'lock' };
        case 'Reopen':
          return { target, label: 'tickets.actions.reopen', icon: 'lock_open' };
        default:
          return { target, label: `tickets.actions.moveTo.${target}`, icon: 'swap_horiz' };
      }
    });
  });

  /** The main button next to the menu: resolve, close or reopen when available. */
  readonly primaryAction = computed(() => {
    const actions = this.statusActions();
    return actions.find((a) => a.target === 'Resolved') ?? actions.find((a) => a.target === 'Closed') ?? actions.find((a) => a.target === 'Reopen') ?? null;
  });
  readonly otherActions = computed(() => this.statusActions().filter((a) => a !== this.primaryAction()));

  readonly escalatable = computed(() => {
    const status = this.ticket()?.status;
    return this.canEscalate && !!status && status !== 'Resolved' && status !== 'Closed';
  });
  readonly editable = computed(() => this.canUpdate && this.ticket()?.status !== 'Closed');
  readonly hasMenu = computed(() => this.otherActions().length > 0 || this.escalatable() || this.editable() || this.canTransfer || this.canDelete);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.ticket.set(null);
        this.history.set(null);
        this.tabIndex.set(0);
        this.load(id);
      });
    });

    this.api.categories(true).subscribe({ next: (items) => this.categories.set(items), error: () => undefined });

    inject(StaffHubService)
      .on<unknown>(RealtimeEvents.ticketUpdated)
      .pipe(
        filter((payload) => {
          const id = ticketIdFromPayload(payload);
          return id === null || id === this.id();
        }),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.refresh());
  }

  load(id = this.id()): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = forkJoin({
      ticket: this.api.get(id, true),
      messages: this.api.messages(id).pipe(catchError(() => of<TicketMessage[]>([]))),
      attachments: this.api.attachments(id).pipe(catchError(() => of<AttachmentResponse[]>([]))),
    }).subscribe({
      next: ({ ticket, messages, attachments }) => {
        this.ticket.set(ticket);
        this.messages.set(messages);
        this.attachments.set(attachments);
        this.loading.set(false);
        if (this.tabIndex() === HISTORY_TAB) {
          this.loadHistory();
        }
      },
      error: (error: unknown) => {
        const apiError = ApiError.from(error);
        this.loading.set(false);
        this.error.set(
          apiError.hasCode(TicketErrorCodes.notFound) || apiError.status === 404
            ? this.translations.t('tickets.details.notFound')
            : describeError(apiError, this.translations),
        );
      },
    });
  }

  /** Reloads without the full-page spinner (after actions and realtime pushes). */
  refresh(): void {
    const id = this.id();
    forkJoin({
      ticket: this.api.get(id, true),
      messages: this.api.messages(id),
      attachments: this.api.attachments(id),
    }).subscribe({
      next: ({ ticket, messages, attachments }) => {
        this.ticket.set(ticket);
        this.messages.set(messages);
        this.attachments.set(attachments);
        if (this.history() !== null) {
          this.loadHistory();
        }
      },
      error: (error: unknown) => {
        if (ApiError.from(error).status === 404) {
          this.error.set(this.translations.t('tickets.details.notFound'));
        }
      },
    });
  }

  /** History is loaded lazily when its tab opens, then kept fresh after changes. */
  loadHistory(): void {
    const id = this.id();
    this.api.history(id).subscribe({
      next: (entries) => {
        if (id === this.id()) {
          this.history.set(entries);
        }
      },
      error: () => {
        if (this.history() === null) {
          this.history.set([]);
        }
      },
    });
  }

  onTab(event: MatTabChangeEvent): void {
    this.tabIndex.set(event.index);
    if (event.index === HISTORY_TAB && this.history() === null) {
      this.loadHistory();
    }
  }

  onUpdated(ticket: Ticket): void {
    this.ticket.set(ticket);
    if (this.history() !== null) {
      this.loadHistory();
    }
  }

  changeStatus(action: StatusAction): void {
    const ticket = this.ticket();
    if (!ticket) {
      return;
    }
    const run = () => this.runAction(this.api.changeStatus(ticket.id, action.target), `tickets.messages.status.${action.target}`);
    if (action.target === 'Closed') {
      this.confirm.ask({ title: 'tickets.dialogs.closeTitle', message: 'tickets.dialogs.closeMessage', confirmText: 'tickets.actions.close' }).subscribe((ok) => ok && run());
    } else {
      run();
    }
  }

  escalate(): void {
    const ticket = this.ticket();
    if (!ticket) {
      return;
    }
    this.dialog
      .open<TicketEscalateDialog, unknown, string>(TicketEscalateDialog, { width: '520px', maxWidth: '95vw', direction: this.translations.direction() })
      .afterClosed()
      .subscribe((reason) => {
        if (reason) {
          this.runAction(this.api.escalate(ticket.id, reason), 'tickets.messages.escalated');
        }
      });
  }

  edit(): void {
    const ticket = this.ticket();
    if (!ticket) {
      return;
    }
    this.dialog
      .open<TicketEditDialog, Ticket, Ticket>(TicketEditDialog, { data: ticket, width: '680px', maxWidth: '95vw', direction: this.translations.direction() })
      .afterClosed()
      .subscribe((updated) => {
        if (updated) {
          this.toast.success('core.states.saved');
          this.onUpdated(updated);
        }
      });
  }

  transfer(): void {
    const ticket = this.ticket();
    if (!ticket) {
      return;
    }
    this.dialog
      .open<TicketTransferDialog, Ticket, TransferTicketRequest>(TicketTransferDialog, { data: ticket, width: '480px', maxWidth: '95vw', direction: this.translations.direction() })
      .afterClosed()
      .subscribe((body) => {
        if (body) {
          this.runAction(this.api.transfer(ticket.id, body), 'tickets.messages.transferred');
        }
      });
  }

  remove(): void {
    const ticket = this.ticket();
    if (!ticket) {
      return;
    }
    this.confirm
      .ask({ title: 'tickets.dialogs.deleteTitle', message: 'tickets.dialogs.deleteMessage', params: { number: ticket.number }, confirmText: 'core.actions.delete', destructive: true })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.busy.set(true);
        this.api.delete(ticket.id).subscribe({
          next: () => {
            this.busy.set(false);
            this.toast.success('tickets.messages.deleted', { number: ticket.number });
            void this.router.navigate(['/tickets']);
          },
          error: () => this.busy.set(false),
        });
      });
  }

  /** AI panel: reply text goes into the reply box. */
  insertReply(text: string): void {
    this.tabIndex.set(0);
    this.conversation()?.insert(text);
  }

  /** AI panel: apply the suggested category/priority through PUT /tickets/{id}. */
  applySuggestion(suggestion: AiCategorySuggestion): void {
    const ticket = this.ticket();
    if (!ticket || !this.editable()) {
      return;
    }
    const categoryId = suggestion.categoryId && this.categories().some((c) => c.id === suggestion.categoryId) ? suggestion.categoryId : ticket.categoryId;
    const priority = suggestion.priority && (TICKET_PRIORITIES as readonly string[]).includes(suggestion.priority) ? suggestion.priority : ticket.priority;
    if (categoryId === ticket.categoryId && priority === ticket.priority) {
      return;
    }
    this.runAction(
      this.api.update(ticket.id, { subject: ticket.subject, description: ticket.description, categoryId, priority, tags: ticket.tags }),
      'tickets.messages.suggestionApplied',
    );
  }

  private runAction(request: Observable<Ticket>, successKey: string): void {
    this.busy.set(true);
    request.subscribe({
      next: (ticket) => {
        this.busy.set(false);
        this.toast.success(successKey);
        this.onUpdated(ticket);
        this.api.messages(ticket.id).subscribe({ next: (messages) => this.messages.set(messages), error: () => undefined });
      },
      error: (error: unknown) => {
        this.busy.set(false);
        // INVALID_STATUS_TRANSITION / TICKET_CLOSED: someone else changed the ticket; refresh the allowed actions.
        const apiError = ApiError.from(error);
        if (apiError.hasCode(TicketErrorCodes.invalidTransition) || apiError.hasCode(TicketErrorCodes.closed) || apiError.status === 409) {
          this.refresh();
        }
      },
    });
  }
}
