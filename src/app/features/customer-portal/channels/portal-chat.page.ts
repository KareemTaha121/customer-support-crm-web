import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormGroupDirective, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { PortalAuthService } from '../../../core/auth/portal-auth.service';
import { BrandingService } from '../../../core/branding/branding.service';
import { FeatureFlags } from '../../../core/branding/feature-flags';
import { API_ORIGIN } from '../../../core/config/app-config';
import { ApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { LocalizedDatePipe } from '../../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { ConfirmService } from '../../../shared/confirm-dialog.component';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { applyServerErrors } from '../../../shared/form-errors';
import { PageHeaderComponent } from '../../../shared/page-header.component';
import { ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { PortalPublicApi } from '../customer-portal.api';
import { ChatMessage, ChatMessageEvent, ChatUpdatedEvent, StoredChat, VisitorChat, withoutFieldPrefix } from '../customer-portal.models';
import { PortalUnavailableComponent } from './portal-unavailable.component';

const STORAGE_KEY = 'crm.portal.chat';

type LiveState = 'offline' | 'connecting' | 'connected';

/**
 * Visitor live chat: starts a conversation (POST /public/chat/conversations), keeps its id and
 * access token in sessionStorage, sends over HTTP and receives over the anonymous `/hubs/chat`.
 */
@Component({
  selector: 'app-portal-chat-page',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TranslatePipe,
    LocalizedDatePipe,
    FormErrorPipe,
    PageHeaderComponent,
    LoadingComponent,
    ErrorStateComponent,
    PortalUnavailableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-chat.page.html',
  styleUrl: './portal-chat.page.scss',
})
export class PortalChatPage implements OnInit {
  private readonly api = inject(PortalPublicApi);
  private readonly branding = inject(BrandingService);
  private readonly portal = inject(PortalAuthService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);
  private connection: HubConnection | null = null;

  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');

  readonly enabled = computed(() => this.branding.isEnabled(FeatureFlags.liveChat));
  readonly stored = signal<StoredChat | null>(readStored());
  readonly chat = signal<VisitorChat | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly starting = signal(false);
  readonly sending = signal(false);
  readonly live = signal<LiveState>('offline');
  readonly isClosed = computed(() => this.chat()?.status === 'Closed');

  readonly startForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email]],
    message: ['', [Validators.required, Validators.maxLength(5000)]],
  });

  /** Resetting through the directive also clears `submitted`, so the emptied field is not shown as invalid. */
  private readonly messageFormRef = viewChild<FormGroupDirective>('messageFormRef');

  readonly messageForm = this.fb.group({
    body: ['', [Validators.required, Validators.maxLength(5000)]],
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => void this.stopHub());
    // Keep the newest message in view.
    afterRenderEffect(() => {
      this.messages();
      const element = this.thread()?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }

  ngOnInit(): void {
    this.prefill();
    if (this.enabled() && this.stored()) {
      this.resume();
    }
  }

  isMine(message: ChatMessage): boolean {
    return message.authorType === 'Customer';
  }

  start(): void {
    if (this.startForm.invalid || this.starting()) {
      this.startForm.markAllAsTouched();
      return;
    }
    const value = this.startForm.getRawValue();
    this.starting.set(true);
    this.api
      .startChat({ name: value.name.trim(), email: value.email.trim(), message: value.message.trim(), language: this.translations.language() })
      .subscribe({
        next: (started) => {
          this.starting.set(false);
          const stored: StoredChat = { conversationId: started.conversationId, accessToken: started.accessToken, ticketNumber: started.ticketNumber };
          writeStored(stored);
          this.stored.set(stored);
          this.startForm.controls.message.reset();
          this.resume();
        },
        error: (error: unknown) => {
          this.starting.set(false);
          const apiError = withoutFieldPrefix(error, 'request');
          const unmatched = applyServerErrors(this.startForm, apiError);
          if (!apiError.isValidation || unmatched.length) {
            this.toast.error(unmatched[0] ?? describeError(apiError, this.translations));
          }
        },
      });
  }

  resume(): void {
    const stored = this.stored();
    if (!stored) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.getChat(stored.conversationId, stored.accessToken).subscribe({
      next: (chat) => {
        this.loading.set(false);
        this.applyChat(chat);
        if (chat.status !== 'Closed') {
          void this.startHub(stored);
        }
      },
      error: (error: unknown) => {
        this.loading.set(false);
        const apiError = ApiError.from(error);
        if (apiError.status === 404 || apiError.hasCode('CHAT_NOT_FOUND')) {
          this.forget();
          this.toast.info('portal.chat.expired');
        } else {
          this.error.set(describeError(apiError, this.translations));
        }
      },
    });
  }

  send(): void {
    const stored = this.stored();
    if (!stored || this.messageForm.invalid || this.sending() || this.isClosed()) {
      this.messageForm.markAllAsTouched();
      return;
    }
    const body = this.messageForm.getRawValue().body.trim();
    if (!body) {
      return;
    }
    this.sending.set(true);
    this.api.sendChatMessage(stored.conversationId, stored.accessToken, body).subscribe({
      next: () => {
        this.sending.set(false);
        this.resetMessage();
        this.refresh();
      },
      error: (error: unknown) => {
        this.sending.set(false);
        const apiError = ApiError.from(error);
        const unmatched = applyServerErrors(this.messageForm, apiError);
        if (!apiError.isValidation || unmatched.length) {
          this.toast.error(unmatched[0] ?? describeError(apiError, this.translations));
        }
      },
    });
  }

  /** Enter sends, Shift+Enter adds a new line. */
  onComposerKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.send();
    }
  }

  end(): void {
    const stored = this.stored();
    if (!stored) {
      return;
    }
    this.confirm.ask({ title: 'portal.chat.endTitle', message: 'portal.chat.endMessage', confirmText: 'portal.chat.end', destructive: true }).subscribe((ok) => {
      if (!ok) {
        return;
      }
      this.api.closeChat(stored.conversationId, stored.accessToken).subscribe({
        next: () => {
          this.chat.update((chat) => (chat ? { ...chat, status: 'Closed' } : chat));
          void this.stopHub();
        },
        error: (error: unknown) => this.toast.error(describeError(ApiError.from(error), this.translations)),
      });
    });
  }

  newChat(): void {
    this.forget();
    this.prefill();
  }

  refresh(): void {
    const stored = this.stored();
    if (!stored) {
      return;
    }
    this.api.getChat(stored.conversationId, stored.accessToken).subscribe({
      next: (chat) => this.applyChat(chat),
      error: () => undefined,
    });
  }

  private applyChat(chat: VisitorChat): void {
    this.chat.set(chat);
    this.messages.set(chat.messages);
  }

  private onMessage(event: ChatMessageEvent): void {
    if (event.conversationId !== this.stored()?.conversationId || this.messages().some((m) => m.id === event.messageId)) {
      return;
    }
    const authorName = event.authorType === 'Customer' ? '' : (this.chat()?.agentName ?? '');
    this.messages.update((list) => [...list, { id: event.messageId, authorType: event.authorType, authorName, body: event.body, createdAt: event.createdAt }]);
  }

  private onUpdated(event: ChatUpdatedEvent): void {
    if (event.conversationId !== this.stored()?.conversationId) {
      return;
    }
    this.chat.update((chat) => (chat ? { ...chat, status: event.status, agentName: event.agentName ?? chat.agentName } : chat));
    if (event.status === 'Closed') {
      void this.stopHub();
    }
  }

  private async startHub(stored: StoredChat): Promise<void> {
    if (this.connection) {
      return;
    }
    const connection = new HubConnectionBuilder()
      .withUrl(`${API_ORIGIN}/hubs/chat`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
    connection.on('chatMessage', (payload: ChatMessageEvent) => this.onMessage(payload));
    connection.on('chatUpdated', (payload: ChatUpdatedEvent) => this.onUpdated(payload));
    connection.onreconnecting(() => this.live.set('connecting'));
    connection.onreconnected(() => {
      void this.join(connection, stored);
      this.refresh();
    });
    connection.onclose(() => {
      if (this.connection === connection) {
        this.live.set('offline');
      }
    });
    this.connection = connection;
    this.live.set('connecting');
    try {
      await connection.start();
      await this.join(connection, stored);
    } catch (error) {
      console.warn('Live chat realtime connection failed; falling back to manual refresh', error);
      if (this.connection === connection) {
        this.live.set('offline');
      }
    }
  }

  private async join(connection: HubConnection, stored: StoredChat): Promise<void> {
    try {
      await connection.invoke('JoinConversation', stored.conversationId, stored.accessToken);
      this.live.set('connected');
    } catch {
      this.live.set('offline');
    }
  }

  private async stopHub(): Promise<void> {
    const connection = this.connection;
    this.connection = null;
    this.live.set('offline');
    if (connection) {
      await connection.stop().catch(() => undefined);
    }
  }

  private forget(): void {
    void this.stopHub();
    writeStored(null);
    this.stored.set(null);
    this.chat.set(null);
    this.messages.set([]);
    this.error.set(null);
  }

  private prefill(): void {
    const profile = this.portal.profile();
    if (profile && !this.startForm.controls.name.value) {
      this.startForm.patchValue({ name: profile.name, email: profile.email });
    }
  }

  private resetMessage(): void {
    const directive = this.messageFormRef();
    if (directive) {
      directive.resetForm();
    } else {
      this.messageForm.reset();
    }
  }
}

function readStored(): StoredChat | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const value = raw ? (JSON.parse(raw) as Partial<StoredChat>) : null;
    return value?.conversationId && value.accessToken ? { conversationId: value.conversationId, accessToken: value.accessToken, ticketNumber: value.ticketNumber ?? '' } : null;
  } catch {
    return null;
  }
}

function writeStored(value: StoredChat | null): void {
  try {
    if (value) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage unavailable: the conversation lasts for this page only.
  }
}
