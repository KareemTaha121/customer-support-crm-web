import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { LocalizedDatePipe } from '../../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { ConfirmService } from '../../../shared/confirm-dialog.component';
import { PageHeaderComponent } from '../../../shared/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { AdminDialogs } from '../admin-dialog';
import { adminErrorMessage } from '../admin-errors';
import { AdministrationApi } from '../administration.api';
import { ApiKeyResponse, CreatedApiKeyResponse, IntegrationCatalog, WebhookResponse } from '../administration.models';
import { ApiKeyDialogComponent, ApiKeyDialogData } from './api-key-dialog.component';
import { DeliveriesDialogComponent, DeliveriesDialogData } from './deliveries-dialog.component';
import { integrationLabel } from './integration-labels';
import { SecretDialogComponent, SecretDialogData } from './secret-dialog.component';
import { WebhookDialogComponent, WebhookDialogData, WebhookDialogResult } from './webhook-dialog.component';

type ApiKeyState = 'Active' | 'Revoked' | 'Expired';

/** `/admin/integrations`: API keys for external systems and outgoing webhooks. */
@Component({
  selector: 'app-integrations-page',
  imports: [
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    TranslatePipe,
    LocalizedDatePipe,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../admin.scss',
  template: `
    <app-page-header [title]="'admin.integrations.title' | t" [subtitle]="'admin.integrations.subtitle' | t" />

    @if (loading()) {
      <app-loading />
    } @else if (error()) {
      <app-error-state [message]="error()" (retry)="load()" />
    } @else {
      <section class="crm-card admin-section">
        <div class="admin-section__head">
          <h2>{{ 'admin.integrations.apiKeys' | t }}</h2>
          <button mat-flat-button type="button" (click)="createApiKey()"><mat-icon>vpn_key</mat-icon>{{ 'admin.integrations.newApiKey' | t }}</button>
        </div>
        <p class="admin-hint">{{ 'admin.integrations.apiKeysHint' | t }}</p>
        @if (apiKeys().length === 0) {
          <app-empty-state icon="vpn_key" [message]="'admin.integrations.noApiKeys' | t" />
        } @else {
          <div class="crm-table-wrap">
            <table mat-table [dataSource]="apiKeys()">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>{{ 'core.fields.name' | t }}</th>
                <td mat-cell *matCellDef="let key">
                  <strong>{{ keyOf(key).name }}</strong>
                  <div class="admin-mono crm-muted" dir="ltr">{{ keyOf(key).displayPrefix }}…</div>
                </td>
              </ng-container>
              <ng-container matColumnDef="scopes">
                <th mat-header-cell *matHeaderCellDef>{{ 'admin.integrations.scopesTitle' | t }}</th>
                <td mat-cell *matCellDef="let key">
                  <span class="admin-chips">
                    @for (scope of keyOf(key).scopes; track scope) {
                      <span class="crm-pill crm-pill--primary">{{ scopeLabel(scope) }}</span>
                    }
                  </span>
                </td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>{{ 'core.fields.status' | t }}</th>
                <td mat-cell *matCellDef="let key">
                  <span class="crm-pill" [class.crm-pill--success]="keyState(key) === 'Active'" [class.crm-pill--danger]="keyState(key) === 'Revoked'"
                    [class.crm-pill--warning]="keyState(key) === 'Expired'">{{ 'admin.integrations.keyStatus.' + keyState(key) | t }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="expiresAt">
                <th mat-header-cell *matHeaderCellDef>{{ 'admin.integrations.expiresAt' | t }}</th>
                <td mat-cell *matCellDef="let key">{{ keyOf(key).expiresAt ? (keyOf(key).expiresAt | localDate: 'shortDate') : ('admin.integrations.neverExpires' | t) }}</td>
              </ng-container>
              <ng-container matColumnDef="lastUsedAt">
                <th mat-header-cell *matHeaderCellDef>{{ 'admin.integrations.lastUsed' | t }}</th>
                <td mat-cell *matCellDef="let key">{{ keyOf(key).lastUsedAt ? (keyOf(key).lastUsedAt | localDate: 'relative') : ('admin.users.never' | t) }}</td>
              </ng-container>
              <ng-container matColumnDef="createdAt">
                <th mat-header-cell *matHeaderCellDef>{{ 'core.fields.createdAt' | t }}</th>
                <td mat-cell *matCellDef="let key">{{ keyOf(key).createdAt | localDate: 'shortDate' }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef><span class="cdk-visually-hidden">{{ 'core.actions.more' | t }}</span></th>
                <td mat-cell *matCellDef="let key" class="admin-actions-cell">
                  @if (!keyOf(key).revokedAt) {
                    <button mat-icon-button type="button" [matTooltip]="'admin.integrations.revoke' | t" [attr.aria-label]="'admin.integrations.revoke' | t" (click)="revoke(key)">
                      <mat-icon>block</mat-icon>
                    </button>
                  }
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="keyColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: keyColumns"></tr>
            </table>
          </div>
        }
      </section>

      <section class="crm-card admin-section">
        <div class="admin-section__head">
          <h2>{{ 'admin.integrations.webhooks' | t }}</h2>
          <button mat-flat-button type="button" (click)="editWebhook(null)"><mat-icon>add</mat-icon>{{ 'admin.integrations.newWebhook' | t }}</button>
        </div>
        <p class="admin-hint">{{ 'admin.integrations.webhooksHint' | t }}</p>
        @if (webhooks().length === 0) {
          <app-empty-state icon="webhook" [message]="'admin.integrations.noWebhooks' | t" />
        } @else {
          <div class="crm-table-wrap">
            <table mat-table [dataSource]="webhooks()">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>{{ 'core.fields.name' | t }}</th>
                <td mat-cell *matCellDef="let hook">
                  <strong>{{ hookOf(hook).name }}</strong>
                  <div class="admin-mono crm-muted url" dir="ltr">{{ hookOf(hook).url }}</div>
                </td>
              </ng-container>
              <ng-container matColumnDef="events">
                <th mat-header-cell *matHeaderCellDef>{{ 'admin.integrations.eventsTitle' | t }}</th>
                <td mat-cell *matCellDef="let hook">
                  <span class="admin-chips">
                    @for (event of hookOf(hook).events; track event) {
                      <span class="crm-pill crm-pill--info">{{ eventLabel(event) }}</span>
                    }
                  </span>
                </td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>{{ 'core.fields.status' | t }}</th>
                <td mat-cell *matCellDef="let hook">
                  <span class="crm-pill" [class.crm-pill--success]="hookOf(hook).isActive">
                    {{ (hookOf(hook).isActive ? 'admin.status.Active' : 'admin.status.Inactive') | t }}
                  </span>
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef><span class="cdk-visually-hidden">{{ 'core.actions.more' | t }}</span></th>
                <td mat-cell *matCellDef="let hook" class="admin-actions-cell">
                  <button mat-icon-button type="button" [matTooltip]="'admin.integrations.deliveries' | t" [attr.aria-label]="'admin.integrations.deliveries' | t" (click)="deliveries(hook)">
                    <mat-icon>history</mat-icon>
                  </button>
                  <button mat-icon-button type="button" [matMenuTriggerFor]="menu" [attr.aria-label]="'core.actions.more' | t">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #menu="matMenu" xPosition="before">
                    <button mat-menu-item type="button" (click)="editWebhook(hook)"><mat-icon>edit</mat-icon>{{ 'core.actions.edit' | t }}</button>
                    <button mat-menu-item type="button" (click)="test(hook)"><mat-icon>send</mat-icon>{{ 'admin.integrations.sendTest' | t }}</button>
                    <button mat-menu-item type="button" (click)="rotate(hook)"><mat-icon>autorenew</mat-icon>{{ 'admin.integrations.rotateSecret' | t }}</button>
                    <button mat-menu-item type="button" (click)="removeWebhook(hook)"><mat-icon>delete_outline</mat-icon>{{ 'core.actions.delete' | t }}</button>
                  </mat-menu>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="hookColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: hookColumns"></tr>
            </table>
          </div>
        }
      </section>
    }
  `,
  styles: `.url { max-width: 360px; }`,
})
export class IntegrationsPage {
  private readonly api = inject(AdministrationApi);
  private readonly dialogs = inject(AdminDialogs);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly keyColumns = ['name', 'scopes', 'status', 'expiresAt', 'lastUsedAt', 'createdAt', 'actions'];
  readonly hookColumns = ['name', 'events', 'status', 'actions'];
  readonly catalog = signal<IntegrationCatalog>({ apiScopes: [], webhookEvents: [] });
  readonly apiKeys = signal<ApiKeyResponse[]>([]);
  readonly webhooks = signal<WebhookResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  // Typed accessors: mat-table row context is untyped.
  keyOf(key: ApiKeyResponse): ApiKeyResponse {
    return key;
  }
  hookOf(hook: WebhookResponse): WebhookResponse {
    return hook;
  }
  keyState(key: ApiKeyResponse): ApiKeyState {
    if (key.revokedAt) {
      return 'Revoked';
    }
    return key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now() ? 'Expired' : 'Active';
  }
  scopeLabel(scope: string): string {
    return integrationLabel(this.translations, 'scopes', scope);
  }
  eventLabel(event: string): string {
    return integrationLabel(this.translations, 'events', event);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ catalog: this.api.integrationCatalog(), apiKeys: this.api.listApiKeys(), webhooks: this.api.listWebhooks() }).subscribe({
      next: ({ catalog, apiKeys, webhooks }) => {
        this.catalog.set(catalog);
        this.apiKeys.set(apiKeys);
        this.webhooks.set(webhooks);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(adminErrorMessage(error, this.translations));
      },
    });
  }

  createApiKey(): void {
    this.dialogs
      .open<ApiKeyDialogComponent, ApiKeyDialogData, CreatedApiKeyResponse>(ApiKeyDialogComponent, { scopes: this.catalog().apiScopes }, '560px')
      .subscribe((created) => {
        if (!created) {
          return;
        }
        this.apiKeys.update((list) => [created.apiKey, ...list]);
        this.showSecret({ title: 'admin.integrations.apiKeyCreated', message: 'admin.integrations.apiKeySecretHint', secret: created.key });
      });
  }

  revoke(key: ApiKeyResponse): void {
    this.confirm
      .ask({ title: 'admin.integrations.revokeTitle', message: 'admin.integrations.revokeMessage', params: { name: key.name }, confirmText: 'admin.integrations.revoke', destructive: true })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.api.revokeApiKey(key.id).subscribe((revoked) => {
          this.apiKeys.update((list) => list.map((k) => (k.id === revoked.id ? revoked : k)));
          this.toast.success('admin.integrations.revoked', { name: key.name });
        });
      });
  }

  editWebhook(webhook: WebhookResponse | null): void {
    this.dialogs
      .open<WebhookDialogComponent, WebhookDialogData, WebhookDialogResult>(WebhookDialogComponent, { webhook, events: this.catalog().webhookEvents })
      .subscribe((result) => {
        if (!result) {
          return;
        }
        if ('created' in result) {
          this.webhooks.update((list) => [...list, result.created.webhook].sort((a, b) => a.name.localeCompare(b.name)));
          this.showSecret({ title: 'admin.integrations.webhookCreated', message: 'admin.integrations.webhookSecretHint', secret: result.created.secret });
        } else {
          this.webhooks.update((list) => list.map((w) => (w.id === result.updated.id ? result.updated : w)));
        }
      });
  }

  test(webhook: WebhookResponse): void {
    this.api.testWebhook(webhook.id).subscribe(() => this.toast.success('admin.integrations.testQueued', { name: webhook.name }));
  }

  deliveries(webhook: WebhookResponse): void {
    this.dialogs.open<DeliveriesDialogComponent, DeliveriesDialogData, void>(DeliveriesDialogComponent, { webhook }, '900px').subscribe();
  }

  rotate(webhook: WebhookResponse): void {
    this.confirm
      .ask({ title: 'admin.integrations.rotateTitle', message: 'admin.integrations.rotateMessage', params: { name: webhook.name }, confirmText: 'admin.integrations.rotateSecret', destructive: true })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.api.rotateWebhookSecret(webhook.id).subscribe((result) =>
          this.showSecret({ title: 'admin.integrations.secretRotated', message: 'admin.integrations.webhookSecretHint', secret: result.secret }),
        );
      });
  }

  removeWebhook(webhook: WebhookResponse): void {
    this.confirm
      .ask({ title: 'admin.integrations.deleteWebhookTitle', message: 'admin.integrations.deleteWebhookMessage', params: { name: webhook.name }, confirmText: 'core.actions.delete', destructive: true })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.api.deleteWebhook(webhook.id).subscribe(() => {
          this.webhooks.update((list) => list.filter((w) => w.id !== webhook.id));
          this.toast.success('core.states.deleted');
        });
      });
  }

  private showSecret(data: SecretDialogData): void {
    this.dialogs.open<SecretDialogComponent, SecretDialogData, boolean>(SecretDialogComponent, data, '560px', { disableClose: true }).subscribe();
  }
}
