import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormGroupDirective, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { Paged, emptyPage } from '../../core/http/api.models';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { LocalizedDatePipe } from '../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { FormErrorPipe } from '../../shared/form-error.pipe';
import { applyServerErrors } from '../../shared/form-errors';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/state.components';
import { ChannelsApi } from './channels.api';
import {
  ChannelStatus,
  OUTBOUND_STATUSES,
  OUTBOX_PAGE_SIZE,
  OutboundMessage,
  OutboundStatus,
  TEST_CHANNELS,
  channelIcon,
} from './channels.models';

/** Channel administration: provider status, test messages and the delivery outbox. */
@Component({
  selector: 'app-channels-admin-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
    TranslatePipe,
    LocalizedDatePipe,
    FormErrorPipe,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './channels-admin.page.html',
  styleUrl: './channels-admin.page.scss',
})
export class ChannelsAdminPage {
  private readonly api = inject(ChannelsApi);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private outboxRequest: Subscription | null = null;

  readonly testChannels = TEST_CHANNELS;
  readonly outboundStatuses = OUTBOUND_STATUSES;
  readonly pageSize = OUTBOX_PAGE_SIZE;
  readonly columns = ['createdAt', 'channel', 'to', 'subject', 'status', 'attempts', 'lastError', 'actions'];
  readonly channelIcon = channelIcon;

  readonly statuses = signal<ChannelStatus[]>([]);
  readonly statusLoading = signal(true);
  readonly statusError = signal<string | null>(null);

  readonly sendingTest = signal(false);
  readonly testForm = inject(NonNullableFormBuilder).group({
    channel: ['Email', Validators.required],
    to: ['', [Validators.required, Validators.maxLength(320)]],
  });

  readonly outbox = signal<Paged<OutboundMessage>>(emptyPage<OutboundMessage>(OUTBOX_PAGE_SIZE));
  readonly outboxLoading = signal(true);
  readonly outboxError = signal<string | null>(null);
  readonly statusFilter = signal<OutboundStatus | null>(null);
  readonly page = signal(1);
  readonly failedCount = signal(0);
  readonly retrying = signal<string | null>(null);

  constructor() {
    this.loadStatus();
    this.loadOutbox();
  }

  loadStatus(): void {
    this.statusLoading.set(true);
    this.statusError.set(null);
    this.api.channelStatus().subscribe({
      next: (items) => {
        this.statuses.set(items);
        this.statusLoading.set(false);
      },
      error: (error: unknown) => {
        this.statusLoading.set(false);
        this.statusError.set(describeError(ApiError.from(error), this.translations));
      },
    });
  }

  /** Failed deliveries across all pages, for the banner; refreshed with the table. */
  private loadFailedCount(): void {
    this.api.outbox('Failed', 1).subscribe({
      next: (result) => this.failedCount.set(result.meta.totalCount),
      error: () => this.failedCount.set(0),
    });
  }

  loadOutbox(): void {
    this.loadFailedCount();
    this.outboxRequest?.unsubscribe();
    this.outboxLoading.set(true);
    this.outboxError.set(null);
    this.outboxRequest = this.api.outbox(this.statusFilter(), this.page()).subscribe({
      next: (result) => {
        this.outbox.set(result);
        this.outboxLoading.set(false);
      },
      error: (error: unknown) => {
        this.outboxLoading.set(false);
        this.outboxError.set(describeError(ApiError.from(error), this.translations));
      },
    });
  }

  setStatusFilter(status: OutboundStatus | null): void {
    this.statusFilter.set(status);
    this.page.set(1);
    this.loadOutbox();
  }

  onPage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.loadOutbox();
  }

  canRetry(message: OutboundMessage): boolean {
    return message.status === 'Failed' || (message.status === 'Pending' && message.attempts > 0);
  }

  statusClass(status: OutboundStatus): string {
    switch (status) {
      case 'Sent':
        return 'crm-pill crm-pill--success';
      case 'Failed':
        return 'crm-pill crm-pill--danger';
      default:
        return 'crm-pill crm-pill--info';
    }
  }

  retry(message: OutboundMessage): void {
    if (this.retrying()) {
      return;
    }
    this.retrying.set(message.id);
    this.api.retry(message.id).subscribe({
      next: () => {
        this.retrying.set(null);
        this.toast.success('channels.admin.outbox.retried');
        this.loadOutbox();
      },
      error: () => {
        this.retrying.set(null);
        this.loadOutbox();
      },
    });
  }

  sendTest(formDirective: FormGroupDirective): void {
    if (this.testForm.invalid || this.sendingTest()) {
      this.testForm.markAllAsTouched();
      return;
    }
    const { channel, to } = this.testForm.getRawValue();
    this.sendingTest.set(true);
    this.api.sendTest({ channel, to: to.trim() }).subscribe({
      next: () => {
        this.sendingTest.set(false);
        formDirective.resetForm({ channel, to: '' });
        this.toast.success('channels.admin.test.queued');
        if (this.page() === 1) {
          this.loadOutbox();
        }
      },
      error: (error: unknown) => {
        this.sendingTest.set(false);
        const apiError = ApiError.from(error);
        const unmatched = applyServerErrors(this.testForm, apiError);
        if (!apiError.isValidation || unmatched.length) {
          this.toast.error(unmatched[0] ?? describeError(apiError, this.translations));
        }
      },
    });
  }
}
