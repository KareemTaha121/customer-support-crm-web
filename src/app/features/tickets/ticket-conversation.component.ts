import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
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
import { Ticket, TicketLimits, TicketMessage } from './tickets.models';

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
            } @else if (message.channel) {
              <span class="crm-pill">{{ 'tickets.channel.' + message.channel | t }}</span>
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
          <app-quick-reply-picker (selected)="insert($event)" />
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
        next: () => {
          this.sending.set(false);
          this.body.set('');
          this.pending.set([]);
          this.toast.success(this.internal() ? 'tickets.reply.noteAdded' : 'tickets.reply.sent');
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
