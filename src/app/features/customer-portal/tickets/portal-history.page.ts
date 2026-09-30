import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../../core/http/api-error';
import { Paged, emptyPage } from '../../../core/http/api.models';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { LocalizedDatePipe } from '../../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { PageHeaderComponent } from '../../../shared/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { PortalTicketsApi } from '../customer-portal.api';
import { PortalHistoryItem, historyTypeKey } from '../customer-portal.models';

const HISTORY_PAGE_SIZE = 25;

const ICONS: Record<string, string> = {
  'ticket.created': 'add_circle',
  'ticket.status_changed': 'sync_alt',
  'ticket.message': 'chat',
  'ticket.feedback': 'star',
  'portal.sign_in': 'login',
  'chat.started': 'forum',
};

/** Activity history (GET /portal/history, 25 per page). */
@Component({
  selector: 'app-portal-history-page',
  imports: [RouterLink, MatIconModule, MatPaginatorModule, TranslatePipe, LocalizedDatePipe, PageHeaderComponent, LoadingComponent, EmptyStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'portal.history.title' | t" [subtitle]="'portal.history.subtitle' | t" />
    <section class="crm-card">
      @if (loading() && !page().items.length) {
        <app-loading />
      } @else if (error(); as message) {
        <app-error-state [message]="message" (retry)="load()" />
      } @else if (!page().items.length) {
        <app-empty-state icon="history" [message]="'portal.history.empty' | t" />
      } @else {
        <ol class="timeline">
          @for (item of page().items; track item.id) {
            <li>
              <mat-icon class="timeline__icon">{{ icon(item.type) }}</mat-icon>
              <div class="timeline__body">
                <strong>{{ typeKey(item.type) | t }}</strong>
                <span class="timeline__summary">{{ item.summary }}</span>
                <span class="crm-muted">{{ item.occurredAt | localDate }}</span>
              </div>
              @if (item.ticketId) {
                <a class="timeline__link" [routerLink]="['/portal/tickets', item.ticketId]">{{ 'portal.history.viewTicket' | t }}</a>
              }
            </li>
          }
        </ol>
        <mat-paginator [length]="page().meta.totalCount" [pageIndex]="page().meta.page - 1" [pageSize]="pageSize" [hidePageSize]="true" (page)="changePage($event)" />
      }
    </section>
  `,
  styles: `
    .timeline { list-style: none; margin: 0; padding: 0; }
    .timeline li { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .timeline li:last-child { border-bottom: 0; }
    .timeline__icon { color: var(--mat-sys-primary); flex: none; }
    .timeline__body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .timeline__summary { overflow-wrap: anywhere; }
    .timeline__link { flex: none; white-space: nowrap; }
  `,
})
export class PortalHistoryPage implements OnInit {
  private readonly api = inject(PortalTicketsApi);
  private readonly translations = inject(TranslationService);

  readonly pageSize = HISTORY_PAGE_SIZE;
  readonly pageIndex = signal(0);
  readonly page = signal<Paged<PortalHistoryItem>>(emptyPage(HISTORY_PAGE_SIZE));
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  icon(type: string): string {
    return ICONS[type] ?? 'history';
  }

  typeKey(type: string): string {
    const key = historyTypeKey(type);
    return this.translations.has(key) ? key : 'portal.history.types.other';
  }

  changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.history(this.pageIndex() + 1).subscribe({
      next: (page) => {
        this.page.set(page);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(describeError(ApiError.from(error), this.translations));
      },
    });
  }
}
