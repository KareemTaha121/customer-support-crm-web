import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiError } from '../../core/http/api-error';
import { AttachmentResponse } from '../../core/http/api.models';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { LocalizedDatePipe } from '../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { PermissionService } from '../../core/permissions/permission.service';
import { Permissions } from '../../core/permissions/permissions';
import { FileSizePipe } from '../../shared/file-size.pipe';
import { saveBlob } from '../../shared/file-utils';
import { EmptyStateComponent } from '../../shared/state.components';
import { QuickReplyPickerComponent } from '../dashboard/quick-reply-picker.component';
import { TicketsApi } from './tickets.api';
import { Ticket, TicketLimits, TicketMessage, TicketMessageDelivery } from './tickets.models';

/**
 * Ticket conversation: public replies and internal notes (visually distinct), plus the reply box
 * with attachments and quick replies. Parents call `insert(text)` to add AI suggestions.
 */
@Component({
  selector: 'app-ticket-conversation',
  imports: [
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    TranslatePipe,
    LocalizedDatePipe,
    FileSizePipe,
    EmptyStateComponent,
    QuickReplyPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="description crm-card">
      <header>
        <strong>{{ ticket().customer.name }}</strong>
        <span class="crm-muted">{{ ticket().createdAt | localDate }}</span>
      </header>
      <p class="body">{{ ticket().description || ('tickets.details.noDescription' | t) }}</p>
    </section>

    <ol class="thread" [attr.aria-label]="'tickets.details.conversation' | t">
      @for (message of messages(); track message.id) {
        <li
          class="message"
          [class.message--internal]="message.isInternal"
          [class.message--customer]="message.authorType === 'Customer'"
          [class.message--system]="message.authorType === 'System'"
        >
          <header>
            <mat-icon class="author-icon">{{ message.isInternal ? 'lock' : message.authorType === 'Customer' ? 'person' : message.authorType === 'System' ? 'smart_toy' : 'support_agent' }}</mat-icon>
            <strong>{{ message.authorName }}</strong>
            <span class="crm-muted">{{ 'tickets.authorType.' + message.authorType | t }}</span>
            @if (message.isInternal) {
              <span class="crm-pill crm-pill--warning">{{ 'tickets.reply.internalNote' | t }}</span>
            } @else if (message.channel && message.channel !== 'Agent') {
              <span class="crm-pill">{{ 'tickets.channel.' + message.channel | t }}</span>
            }
            @if (!message.isInternal && message.delivery; as d) {
              <span [class]="deliveryClass(d)" [matTooltip]="d.status === 'Sent' && d.sentAt ? (d.sentAt | localDate) : deliveryTooltip(d)">
                <mat-icon class="delivery-icon" aria-hidden="true">{{ deliveryIcon(d) }}</mat-icon>{{ deliveryLabel(d) | t }}
              </span>
              @if (canRetryDelivery && d.status === 'Failed') {
                <button mat-button type="button" class="delivery-retry" (click)="retryDelivery(d)" [disabled]="retrying() === d.outboundMessageId">
                  <mat-icon>replay</mat-icon>{{ 'tickets.delivery.retry' | t }}
                </button>
              }
            }
            <span class="time crm-muted" [matTooltip]="message.createdAt | localDate">{{ message.createdAt | localDate: 'relative' }}</span>
          </header>
          <p class="body">{{ message.body }}</p>
          @if (message.attachments.length) {
            <mat-chip-set>
              @for (file of message.attachments; track file.id) {
                <mat-chip (click)="download(file)" [matTooltip]="'core.actions.download' | t">
                  <mat-icon matChipAvatar>attach_file</mat-icon>
                  {{ file.fileName }} ({{ file.size | fileSize }})
                </mat-chip>
              }
            </mat-chip-set>
          }
        </li>
      } @empty {
        <app-empty-state icon="forum" [message]="'tickets.details.noMessages' | t" />
      }
    </ol>

    @if (canReply) {
      <section class="reply crm-card" [class.reply--internal]="internal()">
        <div class="reply-toolbar">
          <mat-button-toggle-group [value]="internal() ? 'note' : 'reply'" (change)="internal.set($event.value === 'note')" [attr.aria-label]="'tickets.reply.mode' | t">
            <mat-button-toggle value="reply"><mat-icon>reply</mat-icon> {{ 'tickets.reply.publicReply' | t }}</mat-button-toggle>
            <mat-button-toggle value="note"><mat-icon>lock</mat-icon> {{ 'tickets.reply.internalNote' | t }}</mat-button-toggle>
          </mat-button-toggle-group>
          <span class="crm-spacer"></span>
          <app-quick-reply-picker [ticketId]="ticket().id" (selected)="insert($event)" />
        </div>
        @if (ticket().status === 'Closed') {
          <p class="hint crm-muted"><mat-icon>info</mat-icon> {{ 'tickets.reply.closedHint' | t }}</p>
        }
        <mat-form-field class="full">
          <mat-label>{{ (internal() ? 'tickets.reply.notePlaceholder' : 'tickets.reply.replyPlaceholder') | t }}</mat-label>
          <textarea #bodyInput matInput rows="5" [ngModel]="body()" (ngModelChange)="body.set($event)" [maxlength]="limits.message"></textarea>
          @if (internal()) {
            <mat-hint>{{ 'tickets.reply.noteHint' | t }}</mat-hint>
          }
        </mat-form-field>
        @if (uploading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        @if (pending().length) {
          <mat-chip-set [attr.aria-label]="'tickets.attachments.title' | t">
            @for (file of pending(); track file.id) {
              <mat-chip (removed)="removePending(file)">
                <mat-icon matChipAvatar>attach_file</mat-icon>
                {{ file.fileName }} ({{ file.size | fileSize }})
                <button matChipRemove type="button" [attr.aria-label]="'core.actions.delete' | t"><mat-icon>cancel</mat-icon></button>
              </mat-chip>
            }
          </mat-chip-set>
        }
        <div class="reply-actions">
          <input #fileInput type="file" multiple hidden (change)="onFiles(fileInput)" />
          <button mat-stroked-button type="button" (click)="fileInput.click()" [disabled]="uploading() || pending().length >= limits.attachmentsPerMessage">
            <mat-icon>attach_file</mat-icon>
            {{ 'tickets.reply.attach' | t }}
          </button>
          <span class="crm-spacer"></span>
          <button mat-flat-button type="button" (click)="send()" [disabled]="!canSend()">
            <mat-icon class="rtl-flip">send</mat-icon>
            {{ (internal() ? 'tickets.reply.addNote' : 'tickets.reply.send') | t }}
          </button>
        </div>
      </section>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-block-end: 6px; }
    .body { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    .thread { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .message { border: 1px solid var(--mat-sys-outline-variant); border-radius: var(--crm-radius); padding: 12px 14px; background: var(--mat-sys-surface); border-inline-start: 4px solid var(--mat-sys-primary); }
    .message--customer { border-inline-start-color: var(--crm-info); background: var(--mat-sys-surface-container-low); }
    .message--system { border-inline-start-color: var(--mat-sys-outline); opacity: .9; }
    .message--internal { border-inline-start-color: var(--crm-warning); background: #fff8e1; border-style: dashed; border-inline-start-style: solid; }
    .author-icon { font-size: 20px; inline-size: 20px; block-size: 20px; color: var(--mat-sys-on-surface-variant); }
    .message--internal .author-icon { color: var(--crm-warning); }
    .time { margin-inline-start: auto; font: var(--mat-sys-body-small); }
    mat-chip-set { display: block; margin-block-start: 8px; }
    .reply { display: flex; flex-direction: column; gap: 8px; border-inline-start: 4px solid var(--mat-sys-primary); }
    .reply--internal { border-inline-start-color: var(--crm-warning); background: #fffdf5; }
    .reply-toolbar, .reply-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .full { inline-size: 100%; }
    .hint { display: flex; align-items: center; gap: 6px; margin: 0; }
    .crm-spacer { flex: 1 1 auto; }
    .delivery-icon { font-size: 14px; inline-size: 14px; block-size: 14px; margin-inline-end: 2px; vertical-align: -2px; }
    .delivery-retry { min-height: 28px; }
  `,
})
export class TicketConversationComponent {
  private readonly api = inject(TicketsApi);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly bodyInput = viewChild<ElementRef<HTMLTextAreaElement>>('bodyInput');

  readonly ticket = input.required<Ticket>();
  readonly messages = input.required<TicketMessage[]>();
  /** A message was added or the attachment set changed; the parent reloads. */
  readonly changed = output<void>();

  readonly limits = TicketLimits;
  readonly canReply = inject(PermissionService).has(Permissions.ticketsUpdate);
  readonly internal = signal(false);
  readonly body = signal('');
  readonly pending = signal<AttachmentResponse[]>([]);
  readonly uploading = signal(false);
  readonly sending = signal(false);
  readonly canSend = computed(() => !!this.body().trim() && !this.sending() && !this.uploading());
  readonly canRetryDelivery = inject(PermissionService).has(Permissions.channelsManage);
  readonly retrying = signal<string | null>(null);

  constructor() {
    // The outbox dispatcher runs every 15 s: reload once so a "Queued" chip turns into Sent / Not delivered.
    effect((onCleanup) => {
      const waiting = this.messages().some((m) => m.delivery?.status === 'Pending' && m.delivery.channelConfigured);
      if (waiting) {
        const timer = setTimeout(() => this.changed.emit(), 20_000);
        onCleanup(() => clearTimeout(timer));
      }
    });
  }

  /** "Not delivered" also covers a queued reply whose channel is not configured: it can only fail. */
  private deliveryFailed(d: TicketMessageDelivery): boolean {
    return d.status === 'Failed' || (d.status === 'Pending' && !d.channelConfigured);
  }

  deliveryLabel(d: TicketMessageDelivery): string {
    return d.status === 'Sent' ? 'tickets.delivery.Sent' : this.deliveryFailed(d) ? 'tickets.delivery.Failed' : 'tickets.delivery.Pending';
  }

  deliveryClass(d: TicketMessageDelivery): string {
    return d.status === 'Sent' ? 'crm-pill crm-pill--success' : this.deliveryFailed(d) ? 'crm-pill crm-pill--danger' : 'crm-pill crm-pill--info';
  }

  deliveryIcon(d: TicketMessageDelivery): string {
    return d.status === 'Sent' ? 'done_all' : this.deliveryFailed(d) ? 'error_outline' : 'schedule';
  }

  deliveryTooltip(d: TicketMessageDelivery): string {
    if (!d.channelConfigured && d.status !== 'Sent') {
      return this.translations.t('tickets.delivery.notConfigured', { channel: this.translations.t('tickets.channel.' + d.channel) });
    }
    if (d.status === 'Failed') {
      return d.lastError ?? this.translations.t('tickets.delivery.failedHint');
    }
    return '';
  }

  retryDelivery(d: TicketMessageDelivery): void {
    this.retrying.set(d.outboundMessageId);
    this.api.retryDelivery(d.outboundMessageId).subscribe({
      next: () => {
        this.retrying.set(null);
        this.toast.success('tickets.delivery.retried');
        this.changed.emit();
      },
      // The global error snackbar explains the failure.
      error: () => this.retrying.set(null),
    });
  }

  /** Appends text to the reply box (quick replies, AI suggestions). */
  insert(text: string): void {
    if (!text) {
      return;
    }
    const current = this.body();
    this.body.set(current.trim() ? `${current.replace(/\s+$/, '')}\n\n${text}` : text);
    this.bodyInput()?.nativeElement.focus();
  }

  onFiles(input: HTMLInputElement): void {
    const files = Array.from(input.files ?? []);
    input.value = '';
    const room = this.limits.attachmentsPerMessage - this.pending().length;
    if (files.length > room) {
      this.toast.info('tickets.reply.tooManyFiles', { max: this.limits.attachmentsPerMessage });
    }
    this.uploadNext(files.slice(0, Math.max(0, room)));
  }

  removePending(file: AttachmentResponse): void {
    this.pending.update((items) => items.filter((f) => f.id !== file.id));
    this.api.deleteAttachment(this.ticket().id, file.id).subscribe({ next: () => this.changed.emit(), error: () => undefined });
  }

  download(file: AttachmentResponse): void {
    this.api.downloadAttachment(file).subscribe({ next: ({ blob, fileName }) => saveBlob(blob, fileName || file.fileName), error: () => undefined });
  }

  send(): void {
    const body = this.body().trim();
    if (!body || this.sending()) {
      return;
    }
    this.sending.set(true);
    this.api
      .addMessage(this.ticket().id, { body, isInternal: this.internal(), mentionedUserIds: [], attachmentIds: this.pending().map((f) => f.id) })
      .subscribe({
        next: (message) => {
          this.sending.set(false);
          this.body.set('');
          this.pending.set([]);
          const delivery = message?.delivery;
          if (!this.internal() && delivery && !delivery.channelConfigured) {
            this.toast.error('tickets.reply.sentNotDelivered', { channel: this.translations.t('tickets.channel.' + delivery.channel) });
          } else {
            this.toast.success(this.internal() ? 'tickets.reply.noteAdded' : 'tickets.reply.sent');
          }
          this.changed.emit();
        },
        error: (error: unknown) => {
          this.sending.set(false);
          const apiError = ApiError.from(error);
          this.toast.error(apiError.fieldErrors['body'] ?? describeError(apiError, this.translations));
        },
      });
  }

  private uploadNext(queue: File[]): void {
    const [file, ...rest] = queue;
    if (!file) {
      this.uploading.set(false);
      this.changed.emit();
      return;
    }
    this.uploading.set(true);
    this.api.uploadAttachment(this.ticket().id, file).subscribe({
      next: (attachment) => {
        this.pending.update((items) => [...items, attachment]);
        this.uploadNext(rest);
      },
      error: () => this.uploadNext(rest),
    });
  }
}
