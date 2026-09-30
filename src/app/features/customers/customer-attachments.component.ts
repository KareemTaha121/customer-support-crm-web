import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiError } from '../../core/http/api-error';
import { AttachmentResponse } from '../../core/http/api.models';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { LocalizedDatePipe } from '../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { HasPermissionDirective } from '../../core/permissions/has-permission.directive';
import { Permissions } from '../../core/permissions/permissions';
import { ConfirmService } from '../../shared/confirm-dialog.component';
import { FileSizePipe } from '../../shared/file-size.pipe';
import { saveBlob } from '../../shared/file-utils';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/state.components';
import { CustomersApi } from './customers.api';

/** Attachments tab: list, upload, download, delete (GET/POST/DELETE /customers/{id}/attachments). */
@Component({
  selector: 'app-customer-attachments',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    TranslatePipe,
    LocalizedDatePipe,
    FileSizePipe,
    HasPermissionDirective,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head" *appHasPermission="permissions.customerAttachmentsManage">
      <input #fileInput type="file" multiple hidden (change)="upload(fileInput)" />
      <button mat-stroked-button type="button" [disabled]="uploading()" (click)="fileInput.click()">
        <mat-icon>upload_file</mat-icon>{{ 'customers.attachments.upload' | t }}
      </button>
    </div>
    @if (uploading()) {
      <mat-progress-bar mode="indeterminate" />
    }

    @if (error(); as message) {
      <app-error-state [message]="message" (retry)="load()" />
    } @else if (loading()) {
      <app-loading />
    } @else {
      <ul class="crm-card list">
        @for (file of items(); track file.id) {
          <li>
            <mat-icon class="icon">{{ iconFor(file.contentType) }}</mat-icon>
            <div class="info">
              <span class="name">{{ file.fileName }}</span>
              <span class="crm-muted small">
                {{ file.size | fileSize }} · {{ file.createdAt | localDate }}
                @if (file.uploadedByName) {
                  · {{ file.uploadedByName }}
                }
              </span>
            </div>
            <button mat-icon-button type="button" [disabled]="downloadingId() === file.id" (click)="download(file)" [matTooltip]="'core.actions.download' | t" [attr.aria-label]="'core.actions.download' | t">
              <mat-icon>download</mat-icon>
            </button>
            <button mat-icon-button type="button" (click)="remove(file)" *appHasPermission="permissions.customerAttachmentsManage" [matTooltip]="'core.actions.delete' | t" [attr.aria-label]="'core.actions.delete' | t">
              <mat-icon>delete</mat-icon>
            </button>
          </li>
        } @empty {
          <li class="empty"><app-empty-state icon="attach_file" [message]="'customers.attachments.empty' | t" /></li>
        }
      </ul>
    }
  `,
  styles: `
    .head { display: flex; justify-content: flex-end; margin-block-end: 12px; }
    .list { list-style: none; margin: 0; padding: 0; }
    li { display: flex; align-items: center; gap: 12px; padding: 8px 16px; border-block-start: 1px solid var(--mat-sys-outline-variant); }
    li:first-child { border-block-start: 0; }
    li.empty { display: block; }
    .icon { color: var(--mat-sys-on-surface-variant); flex: none; }
    .info { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
    .name { overflow-wrap: anywhere; }
    .small { font: var(--mat-sys-body-small); }
  `,
})
export class CustomerAttachmentsComponent implements OnInit {
  private readonly api = inject(CustomersApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly customerId = input.required<string>();

  readonly permissions = Permissions;
  readonly items = signal<AttachmentResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly uploading = signal(false);
  readonly downloadingId = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listAttachments(this.customerId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.items.set(items);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(describeError(ApiError.from(error), this.translations));
        },
      });
  }

  upload(element: HTMLInputElement): void {
    const files = Array.from(element.files ?? []);
    element.value = '';
    if (!files.length) {
      return;
    }
    this.uploading.set(true);
    this.uploadNext(files, 0, 0);
  }

  download(file: AttachmentResponse): void {
    this.downloadingId.set(file.id);
    this.api.downloadAttachment(this.customerId(), file.id).subscribe({
      next: ({ blob, fileName }) => {
        this.downloadingId.set(null);
        saveBlob(blob, fileName || file.fileName);
      },
      error: () => this.downloadingId.set(null),
    });
  }

  remove(file: AttachmentResponse): void {
    this.confirm
      .ask({ title: 'customers.attachments.deleteTitle', message: 'customers.attachments.deleteMessage', params: { name: file.fileName }, destructive: true, confirmText: 'core.actions.delete' })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.api.deleteAttachment(this.customerId(), file.id).subscribe({
          next: () => {
            this.items.update((items) => items.filter((i) => i.id !== file.id));
            this.toast.success('core.states.deleted');
          },
        });
      });
  }

  iconFor(contentType: string): string {
    if (contentType.startsWith('image/')) {
      return 'image';
    }
    if (contentType === 'application/pdf') {
      return 'picture_as_pdf';
    }
    if (contentType.startsWith('text/') || contentType.includes('word') || contentType.includes('sheet')) {
      return 'description';
    }
    return 'insert_drive_file';
  }

  /** Uploads sequentially so one failure (size/type) does not hide the others' results. */
  private uploadNext(files: File[], index: number, succeeded: number): void {
    if (index >= files.length) {
      this.uploading.set(false);
      if (succeeded) {
        this.toast.success('customers.attachments.uploaded', { count: succeeded });
      }
      return;
    }
    this.api
      .uploadAttachment(this.customerId(), files[index])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (attachment) => {
          this.items.update((items) => [attachment, ...items]);
          this.uploadNext(files, index + 1, succeeded + 1);
        },
        error: () => this.uploadNext(files, index + 1, succeeded),
      });
  }
}
