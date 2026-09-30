import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { HubConnectionState } from '@microsoft/signalr';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { LocalizedDatePipe } from '../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { HasPermissionDirective } from '../../core/permissions/has-permission.directive';
import { RealtimeEvents, StaffHubService } from '../../core/realtime/staff-hub.service';
import { ConfirmService } from '../../shared/confirm-dialog.component';
import { FormErrorPipe } from '../../shared/form-error.pipe';
import { applyServerErrors } from '../../shared/form-errors';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/state.components';
import { QuickReplyPickerComponent } from '../dashboard/quick-reply-picker.component';
import { ChannelsApi } from './channels.api';
import {
  CHAT_FILTERS,
  CHAT_MESSAGE_MAX_LENGTH,
  ChannelErrorCodes,
  ChatConversation,
  ChatFilter,
  ChatMessage,
  ChatMessageEvent,
  ChatStatus,
  ChatUpdatedEvent,
} from './channels.models';

/** Agent live chat console: queue on the start side, the open conversation on the end side. */
@Component({
  selector: 'app-chat-console-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
    TranslatePipe,
    LocalizedDatePipe,
    FormErrorPipe,
    HasPermissionDirective,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    QuickReplyPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-console.page.html',
  styleUrl: './chat-console.page.scss',
})
export class ChatConsolePage {
  private readonly api = inject(ChannelsApi);
  private readonly hub = inject(StaffHubService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(NotificationToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly translations = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private listRequest: Subscription | null = null;
  private joinedId: string | null = null;
  private readonly queueRefresh$ = new Subject<void>();

  readonly filters = CHAT_FILTERS;
  readonly maxLength = CHAT_MESSAGE_MAX_LENGTH;

  readonly filter = signal<ChatFilter>('waiting');
  readonly conversations = signal<ChatConversation[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly current = signal<ChatConversation | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly messagesLoading = signal(false);
  readonly messagesError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly sending = signal(false);

  readonly offline = computed(() => this.hub.state() !== HubConnectionState.Connected);
  readonly isClosed = computed(() => this.current()?.status === 'Closed');
  readonly isMine = computed(() => {
    const conversation = this.current();
    return !!conversation && conversation.agentId === this.auth.currentUser()?.id;
  });

  readonly composer = inject(NonNullableFormBuilder).group({
    body: ['', [Validators.required, Validators.maxLength(CHAT_MESSAGE_MAX_LENGTH)]],
  });

  constructor() {
    this.loadQueue();

    this.hub
      .on<ChatUpdatedEvent>(RealtimeEvents.chatUpdated)
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        this.applyUpdate(event);
        this.queueRefresh$.next();
      });

    this.queueRefresh$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.loadQueue(true));

    this.hub
      .on<ChatMessageEvent>(RealtimeEvents.chatMessage)
      .pipe(takeUntilDestroyed())
      .subscribe((event) => this.appendMessage(event));

    afterRenderEffect(() => {
      this.messages();
      const element = this.scroller()?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });

    this.destroyRef.onDestroy(() => this.leave());
  }

  statusClass(status: ChatStatus): string {
    switch (status) {
      case 'Waiting':
        return 'crm-pill crm-pill--warning';
      case 'Active':
        return 'crm-pill crm-pill--success';
      default:
        return 'crm-pill';
    }
  }

  setFilter(filter: ChatFilter): void {
    this.filter.set(filter);
    this.loadQueue();
  }

  loadQueue(silent = false): void {
    this.listRequest?.unsubscribe();
    if (!silent) {
      this.loading.set(true);
    }
    this.error.set(null);
    this.listRequest = this.api.listChats(this.filter(), silent).subscribe({
      next: (items) => {
        this.conversations.set(items);
        this.loading.set(false);
        const current = this.current();
        const fresh = current ? items.find((c) => c.id === current.id) : undefined;
        if (fresh) {
          this.current.set(fresh);
        }
      },
      error: (error: unknown) => {
        this.loading.set(false);
        if (!silent) {
          this.error.set(describeError(ApiError.from(error), this.translations));
        }
      },
    });
  }

  open(conversation: ChatConversation): void {
    if (this.current()?.id === conversation.id) {
      return;
    }
    this.leave();
    this.current.set(conversation);
    this.composer.reset();
    this.joinedId = conversation.id;
    this.hub.invoke('JoinConversation', conversation.id).catch(() => undefined);
    this.loadMessages();
  }

  back(): void {
    this.leave();
    this.current.set(null);
    this.messages.set([]);
  }

  loadMessages(): void {
    const conversation = this.current();
    if (!conversation) {
      return;
    }
    this.messagesLoading.set(true);
    this.messagesError.set(null);
    this.api.messages(conversation.id).subscribe({
      next: (items) => {
        if (this.current()?.id !== conversation.id) {
          return;
        }
        this.messages.set(items.filter((m) => !m.isInternal));
        this.messagesLoading.set(false);
      },
      error: (error: unknown) => {
        if (this.current()?.id !== conversation.id) {
          return;
        }
        this.messagesLoading.set(false);
        this.messages.set([]);
        this.messagesError.set(describeError(ApiError.from(error), this.translations));
      },
    });
  }

  accept(): void {
    const conversation = this.current();
    if (!conversation || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.api.accept(conversation.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.markMine(conversation.id);
        this.toast.success('channels.chat.accepted');
        this.loadQueue(true);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.showError(error);
      },
    });
  }

  close(): void {
    const conversation = this.current();
    if (!conversation || this.busy()) {
      return;
    }
    this.confirm
      .ask({ title: 'channels.chat.closeTitle', message: 'channels.chat.closeMessage', confirmText: 'channels.chat.close', destructive: true })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.busy.set(true);
        this.api.close(conversation.id).subscribe({
          next: () => {
            this.busy.set(false);
            this.patchCurrent(conversation.id, { status: 'Closed' });
            this.toast.success('channels.chat.closed');
            this.loadQueue(true);
          },
          error: (error: unknown) => {
            this.busy.set(false);
            this.showError(error);
          },
        });
      });
  }

  send(): void {
    const conversation = this.current();
    const body = this.composer.controls.body.value.trim();
    if (!conversation || this.sending() || this.isClosed()) {
      return;
    }
    if (this.composer.invalid || !body) {
      this.composer.markAllAsTouched();
      return;
    }
    this.sending.set(true);
    this.api.send(conversation.id, body).subscribe({
      next: () => {
        this.sending.set(false);
        this.composer.reset();
        if (conversation.status === 'Waiting') {
          this.markMine(conversation.id);
          this.loadQueue(true);
        }
        if (this.offline()) {
          this.loadMessages();
        }
      },
      error: (error: unknown) => {
        this.sending.set(false);
        const apiError = ApiError.from(error);
        const unmatched = applyServerErrors(this.composer, apiError);
        if (!apiError.isValidation || unmatched.length) {
          this.showError(apiError, unmatched[0]);
        }
      },
    });
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.send();
    }
  }

  insertQuickReply(text: string): void {
    const control = this.composer.controls.body;
    const value = control.value;
    control.setValue(value ? `${value}${value.endsWith('\n') ? '' : '\n'}${text}` : text);
    control.markAsDirty();
  }

  private appendMessage(event: ChatMessageEvent): void {
    const current = this.current();
    if (!current || event.conversationId !== current.id) {
      return;
    }
    if (this.messages().some((m) => m.id === event.messageId)) {
      return;
    }
    const authorName =
      event.authorType === 'Customer'
        ? current.visitorName
        : event.authorType === 'Agent'
          ? (current.agentName ?? this.translations.t('channels.authorType.Agent'))
          : this.translations.t('channels.authorType.System');
    this.messages.update((list) => [
      ...list,
      { id: event.messageId, authorType: event.authorType, authorName, body: event.body, isInternal: false, createdAt: event.createdAt },
    ]);
  }

  private applyUpdate(event: ChatUpdatedEvent): void {
    const current = this.current();
    if (current?.id === event.conversationId) {
      this.patchCurrent(current.id, {
        status: event.status,
        ...(event.agentName ? { agentName: event.agentName } : {}),
      });
    }
  }

  private markMine(id: string): void {
    const user = this.auth.currentUser();
    this.patchCurrent(id, { status: 'Active', agentId: user?.id ?? null, agentName: user?.displayName ?? null });
  }

  private patchCurrent(id: string, patch: Partial<ChatConversation>): void {
    this.current.update((c) => (c && c.id === id ? { ...c, ...patch } : c));
  }

  private leave(): void {
    if (this.joinedId) {
      this.hub.invoke('LeaveConversation', this.joinedId).catch(() => undefined);
      this.joinedId = null;
    }
  }

  private showError(error: unknown, fallback?: string): void {
    const apiError = ApiError.from(error);
    if (apiError.hasCode(ChannelErrorCodes.chatClosed)) {
      this.toast.error('channels.errors.chatClosed');
      this.patchCurrent(this.current()?.id ?? '', { status: 'Closed' });
      return;
    }
    if (apiError.hasCode(ChannelErrorCodes.chatNotFound)) {
      this.toast.error('channels.errors.chatNotFound');
      return;
    }
    this.toast.error(fallback ?? describeError(apiError, this.translations));
  }
}
