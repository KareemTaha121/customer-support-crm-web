import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AttachmentResponse } from '../../core/http/api.models';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { LocalizedDatePipe } from '../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { HasPermissionDirective } from '../../core/permissions/has-permission.directive';
import { ConfirmService } from '../../shared/confirm-dialog.component';
import { FileSizePipe } from '../../shared/file-size.pipe';
import { saveBlob } from '../../shared/file-utils';
import { EmptyStateComponent } from '../../shared/state.components';
import { TicketsApi } from './tickets.api';

/** All files of a ticket: download and delete (`/tickets/{id}/attachments`). */
@Component({
  selector: 'app-ticket-attachments',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, TranslatePipe, LocalizedDatePipe, FileSizePipe, HasPermissionDirective, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="files">
      @for (file of attachments(); track file.id) {
        <li>
          <mat-icon class="icon">description</mat-icon>
          <div class="meta">
            <strong>{{ file.fileName }}</strong>
            <small class="crm-muted">
              {{ file.size | fileSize }} · {{ file.uploadedByName ?? ('tickets.attachments.unknownUploader' | t) }} · {{ file.createdAt | localDate: 'short' }}
            </small>
          </div>
          <span [class]="file.isPublic ? 'crm-pill crm-pill--info' : 'crm-pill crm-pill--warning'">
            {{ (file.isPublic ? 'tickets.attachments.public' : 'tickets.attachments.internal') | t }}
          </span>
          <button mat-icon-button type="button" (click)="download(file)" [matTooltip]="'core.actions.download' | t" [attr.aria-label]="'core.actions.download' | t">
            <mat-icon>download</mat-icon>
          </button>
          <button
            *appHasPermission="'tickets.update'"
            mat-icon-button
            type="button"
            (click)="remove(file)"
            [matTooltip]="'core.actions.delete' | t"
            [attr.aria-label]="'core.actions.delete' | t"
          >
            <mat-icon>delete</mat-icon>
          </button>
        </li>
      } @empty {
        <app-empty-state icon="attach_file" [message]="'tickets.attachments.empty' | t" />
      }
    </ul>
  `,
  styles: `
    .files { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    li { display: flex; align-items: center; gap: 12px; padding: 8px 4px; border-block-end: 1px solid var(--mat-sys-outline-variant); }
    li:last-child { border-block-end: 0; }
    .icon { color: var(--mat-sys-on-surface-variant); flex: none; }
    .meta { display: flex; flex-direction: column; min-inline-size: 0; flex: 1 1 auto; }
    .meta strong { overflow-wrap: anywhere; }
  `,
})
export class TicketAttachmentsComponent {
  private readonly api = inject(TicketsApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);

  readonly ticketId = input.required<string>();
  readonly attachments = input.required<AttachmentResponse[]>();
  readonly changed = output<void>();

  download(file: AttachmentResponse): void {
    this.api.downloadAttachment(file).subscribe({ next: ({ blob, fileName }) => saveBlob(blob, fileName || file.fileName), error: () => undefined });
  }

  remove(file: AttachmentResponse): void {
    this.confirm
      .ask({ title: 'tickets.attachments.deleteTitle', message: 'tickets.attachments.deleteMessage', params: { name: file.fileName }, confirmText: 'core.actions.delete', destructive: true })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.api.deleteAttachment(this.ticketId(), file.id).subscribe({
          next: () => {
            this.toast.success('core.states.deleted');
            this.changed.emit();
          },
          error: () => undefined,
        });
      });
  }
}
