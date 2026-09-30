import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { LocalizedDatePipe } from '../../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { adminErrorMessage } from '../admin-errors';
import { AdministrationApi } from '../administration.api';
import { WebhookDeliveryResponse, WebhookResponse } from '../administration.models';

export interface DeliveriesDialogData {
  webhook: WebhookResponse;
}

type DeliveryState = 'Delivered' | 'Failed' | 'Pending';

/** Latest deliveries (up to 100) of one webhook, with retry for undelivered ones. */
@Component({
  selector: 'app-deliveries-dialog',
  imports: [MatDialogModule, MatTableModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslatePipe, LocalizedDatePipe, LoadingComponent, EmptyStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../admin.scss',
  template: `
    <h2 mat-dialog-title>{{ 'admin.integrations.deliveriesTitle' | t: { name: data.webhook.name } }}</h2>
    <mat-dialog-content>
      @if (loading()) {
        <app-loading />
      } @else if (error()) {
        <app-error-state [message]="error()" (retry)="load()" />
      } @else if (deliveries().length === 0) {
        <app-empty-state icon="outbox" [message]="'admin.integrations.noDeliveries' | t" />
      } @else {
        <div class="crm-table-wrap">
          <table mat-table [dataSource]="deliveries()">
            <ng-container matColumnDef="createdAt">
              <th mat-header-cell *matHeaderCellDef>{{ 'core.fields.createdAt' | t }}</th>
              <td mat-cell *matCellDef="let d">{{ createdOf(d) | localDate: 'short' }}</td>
            </ng-container>
            <ng-container matColumnDef="eventType">
              <th mat-header-cell *matHeaderCellDef>{{ 'admin.integrations.event' | t }}</th>
              <td mat-cell *matCellDef="let d"><span class="admin-mono" dir="ltr">{{ eventOf(d) }}</span></td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>{{ 'core.fields.status' | t }}</th>
              <td mat-cell *matCellDef="let d">
                <span class="crm-pill" [class.crm-pill--success]="stateOf(d) === 'Delivered'" [class.crm-pill--danger]="stateOf(d) === 'Failed'"
                  [class.crm-pill--warning]="stateOf(d) === 'Pending'">{{ 'admin.integrations.deliveryStatus.' + stateOf(d) | t }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="attempts">
              <th mat-header-cell *matHeaderCellDef>{{ 'admin.integrations.attempts' | t }}</th>
              <td mat-cell *matCellDef="let d">{{ attemptsOf(d) }}</td>
            </ng-container>
            <ng-container matColumnDef="response">
              <th mat-header-cell *matHeaderCellDef>{{ 'admin.integrations.response' | t }}</th>
              <td mat-cell *matCellDef="let d" class="response">
                @if (codeOf(d) !== null) {
                  <span class="admin-mono">{{ codeOf(d) }}</span>
                }
                @if (errorOf(d); as text) {
                  <span class="crm-muted" dir="ltr">{{ text }}</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef><span class="cdk-visually-hidden">{{ 'core.actions.more' | t }}</span></th>
              <td mat-cell *matCellDef="let d" class="admin-actions-cell">
                @if (stateOf(d) !== 'Delivered') {
                  <button mat-icon-button type="button" [disabled]="retrying() === idOf(d)" [matTooltip]="'core.actions.retry' | t"
                    [attr.aria-label]="'core.actions.retry' | t" (click)="retry(d)">
                    <mat-icon>replay</mat-icon>
                  </button>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="load()" [disabled]="loading()"><mat-icon>refresh</mat-icon>{{ 'core.actions.refresh' | t }}</button>
      <button mat-flat-button type="button" mat-dialog-close>{{ 'core.actions.close' | t }}</button>
    </mat-dialog-actions>
  `,
  styles: `.response { max-width: 280px; overflow-wrap: anywhere; } .response span + span { margin-inline-start: 6px; }`,
})
export class DeliveriesDialogComponent {
  readonly data = inject<DeliveriesDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(AdministrationApi);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly columns = ['createdAt', 'eventType', 'status', 'attempts', 'response', 'actions'];
  readonly deliveries = signal<WebhookDeliveryResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly retrying = signal<string | null>(null);

  constructor() {
    this.load();
  }

  // Typed accessors: mat-table row context is untyped.
  idOf(d: WebhookDeliveryResponse): string {
    return d.id;
  }
  createdOf(d: WebhookDeliveryResponse): string {
    return d.createdAt;
  }
  eventOf(d: WebhookDeliveryResponse): string {
    return d.eventType;
  }
  attemptsOf(d: WebhookDeliveryResponse): number {
    return d.attempts;
  }
  codeOf(d: WebhookDeliveryResponse): number | null {
    return d.lastStatusCode;
  }
  errorOf(d: WebhookDeliveryResponse): string | null {
    return d.lastError;
  }
  stateOf(d: WebhookDeliveryResponse): DeliveryState {
    return d.delivered ? 'Delivered' : d.failed ? 'Failed' : 'Pending';
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listDeliveries(this.data.webhook.id).subscribe({
      next: (deliveries) => {
        this.deliveries.set(deliveries);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(adminErrorMessage(error, this.translations));
      },
    });
  }

  retry(delivery: WebhookDeliveryResponse): void {
    this.retrying.set(delivery.id);
    this.api.retryDelivery(delivery.id).subscribe({
      next: () => {
        this.retrying.set(null);
        this.toast.success('admin.integrations.retryQueued');
        this.load();
      },
      error: () => this.retrying.set(null),
    });
  }
}
