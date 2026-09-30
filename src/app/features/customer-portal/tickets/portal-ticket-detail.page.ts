import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { forkJoin, switchMap } from 'rxjs';
import { ApiError } from '../../../core/http/api-error';
import { AttachmentResponse } from '../../../core/http/api.models';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { LocalizedDatePipe } from '../../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { ConfirmService } from '../../../shared/confirm-dialog.component';
import { FileSizePipe } from '../../../shared/file-size.pipe';
import { saveBlob } from '../../../shared/file-utils';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { applyServerErrors } from '../../../shared/form-errors';
import { PageHeaderComponent } from '../../../shared/page-header.component';
import { ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { PortalTicketsApi } from '../customer-portal.api';
import { PortalMessage, PortalTicket, ticketStatusTone } from '../customer-portal.models';
import { PortalFilePickerComponent } from './portal-file-picker.component';

/** One ticket: public thread, reply, attachments, close and CSAT feedback. */
@Component({
  selector: 'app-portal-ticket-detail-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    TranslatePipe,
    LocalizedDatePipe,
    FileSizePipe,
    FormErrorPipe,
    PageHeaderComponent,
    LoadingComponent,
    ErrorStateComponent,
    PortalFilePickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-ticket-detail.page.html',
  styleUrl: './portal-ticket-detail.page.scss',
})
export class PortalTicketDetailPage {
  /** Route parameter `:id` (component input binding). */
  readonly id = input.required<string>();

  private readonly api = inject(PortalTicketsApi);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly ticket = signal<PortalTicket | null>(null);
  readonly messages = signal<PortalMessage[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly sending = signal(false);
  readonly closing = signal(false);
  readonly savingFeedback = signal(false);
  readonly downloading = signal<string | null>(null);
  readonly files = signal<File[]>([]);
  readonly rating = signal(0);
  /** A rated ticket shows the rating read-only until the customer chooses to change it. */
  readonly editingFeedback = signal(false);
  readonly stars = [1, 2, 3, 4, 5];

  readonly isResolved = computed(() => this.ticket()?.status === 'Resolved');
  readonly showFeedbackForm = computed(() => {
    const ticket = this.ticket();
    return !!ticket && ticket.canGiveFeedback && (ticket.satisfactionRating === null || this.editingFeedback());
  });

  readonly replyForm = this.fb.group({
    body: ['', [Validators.required, Validators.maxLength(10000)]],
  });

  readonly feedbackForm = this.fb.group({
    comment: ['', Validators.maxLength(2000)],
  });

  constructor() {
    // Reload when the route parameter changes (the component is reused between tickets).
    effect(() => {
      this.id();
      untracked(() => this.load());
    });
  }

  tone(status: string): string {
    return ticketStatusTone(status);
  }

  savedRating(ticket: PortalTicket): number {
    return ticket.satisfactionRating ?? 0;
  }

  isMine(message: PortalMessage): boolean {
    return message.authorType === 'Customer';
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ ticket: this.api.get(this.id()), messages: this.api.messages(this.id()) }).subscribe({
      next: ({ ticket, messages }) => {
        this.applyTicket(ticket);
        this.messages.set(messages);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(describeError(ApiError.from(error), this.translations));
      },
    });
  }

  download(attachment: AttachmentResponse): void {
    if (this.downloading()) {
      return;
    }
    this.downloading.set(attachment.id);
    this.api.download(this.id(), attachment.id).subscribe({
      next: (file) => {
        this.downloading.set(null);
        saveBlob(file.blob, attachment.fileName || file.fileName);
      },
      error: () => this.downloading.set(null),
    });
  }

  reply(): void {
    if (this.replyForm.invalid || this.sending()) {
      this.replyForm.markAllAsTouched();
      return;
    }
    const id = this.id();
    const body = this.replyForm.getRawValue().body.trim();
    this.sending.set(true);
    this.api
      .uploadAll(id, this.files())
      .pipe(switchMap((attachments) => this.api.reply(id, body, attachments.map((a) => a.id))))
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.replyForm.reset();
          this.files.set([]);
          this.toast.success('portal.ticket.replySent');
          this.refresh();
        },
        error: (error: unknown) => {
          this.sending.set(false);
          this.showError(this.replyForm, error);
        },
      });
  }

  close(): void {
    const resolved = this.isResolved();
    this.confirm
      .ask({
        title: resolved ? 'portal.ticket.closeTitle' : 'portal.ticket.resolveTitle',
        message: resolved ? 'portal.ticket.closeMessage' : 'portal.ticket.resolveMessage',
        confirmText: resolved ? 'portal.ticket.close' : 'portal.ticket.resolve',
      })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.closing.set(true);
        this.api.close(this.id()).subscribe({
          next: (ticket) => {
            this.closing.set(false);
            this.applyTicket(ticket);
            this.toast.success(resolved ? 'portal.ticket.closed' : 'portal.ticket.resolved');
          },
          error: () => this.closing.set(false),
        });
      });
  }

  setRating(value: number): void {
    this.rating.set(value);
  }

  editFeedback(): void {
    this.editingFeedback.set(true);
  }

  cancelFeedback(): void {
    const ticket = this.ticket();
    if (ticket) {
      this.applyTicket(ticket);
    }
  }

  submitFeedback(): void {
    const rating = this.rating();
    if (rating < 1 || this.feedbackForm.invalid || this.savingFeedback()) {
      this.feedbackForm.markAllAsTouched();
      if (rating < 1) {
        this.toast.error('portal.feedback.ratingRequired');
      }
      return;
    }
    const comment = this.feedbackForm.getRawValue().comment.trim();
    this.savingFeedback.set(true);
    this.api.feedback(this.id(), rating, comment || null).subscribe({
      next: (ticket) => {
        this.savingFeedback.set(false);
        this.applyTicket(ticket);
        this.toast.success('portal.feedback.thanks');
      },
      error: (error: unknown) => {
        this.savingFeedback.set(false);
        this.showError(this.feedbackForm, error);
        // Not allowed / already changed on the server: show the current state.
        if (!ApiError.from(error).isValidation) {
          this.refresh();
        }
      },
    });
  }

  private refresh(): void {
    forkJoin({ ticket: this.api.get(this.id()), messages: this.api.messages(this.id()) }).subscribe({
      next: ({ ticket, messages }) => {
        this.applyTicket(ticket);
        this.messages.set(messages);
      },
      error: (error: unknown) => this.toast.error(describeError(ApiError.from(error), this.translations)),
    });
  }

  private applyTicket(ticket: PortalTicket): void {
    this.ticket.set(ticket);
    this.editingFeedback.set(false);
    this.rating.set(ticket.satisfactionRating ?? 0);
    this.feedbackForm.reset({ comment: ticket.satisfactionComment ?? '' });
  }

  private showError(form: Parameters<typeof applyServerErrors>[0], error: unknown): void {
    const apiError = ApiError.from(error);
    const unmatched = applyServerErrors(form, apiError);
    if (!apiError.isValidation || unmatched.length) {
      this.toast.error(unmatched[0] ?? describeError(apiError, this.translations));
    }
  }
}
