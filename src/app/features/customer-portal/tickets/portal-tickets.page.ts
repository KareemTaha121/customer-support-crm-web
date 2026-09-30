import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../../core/http/api-error';
import { Paged, emptyPage } from '../../../core/http/api.models';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { LocalizedDatePipe } from '../../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { PageHeaderComponent } from '../../../shared/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { PortalTicketsApi } from '../customer-portal.api';
import { PortalTicketFilter, PortalTicketListItem, ticketStatusTone } from '../customer-portal.models';

const FILTERS: readonly PortalTicketFilter[] = ['open', 'closed', 'all'];

/** My tickets (GET /portal/tickets): open / closed / all, server paging. */
@Component({
  selector: 'app-portal-tickets-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    TranslatePipe,
    LocalizedDatePipe,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'portal.tickets.title' | t" [subtitle]="'portal.tickets.subtitle' | t">
      <a mat-flat-button routerLink="/portal/tickets/new">
        <mat-icon>add</mat-icon>
        {{ 'portal.tickets.new' | t }}
      </a>
    </app-page-header>

    <div class="crm-toolbar">
      <mat-button-toggle-group [value]="status()" (change)="setStatus($event.value)" [attr.aria-label]="'portal.tickets.filter' | t">
        @for (filter of filters; track filter) {
          <mat-button-toggle [value]="filter">{{ 'portal.tickets.filters.' + filter | t }}</mat-button-toggle>
        }
      </mat-button-toggle-group>
    </div>

    <section class="crm-card">
      @if (loading() && !page().items.length) {
        <app-loading />
      } @else if (error(); as message) {
        <app-error-state [message]="message" (retry)="load()" />
      } @else if (!page().items.length) {
        <app-empty-state icon="confirmation_number" [message]="'portal.tickets.empty' | t">
          <a mat-stroked-button routerLink="/portal/tickets/new">{{ 'portal.tickets.new' | t }}</a>
        </app-empty-state>
      } @else {
        <div class="crm-table-wrap">
          <table mat-table [dataSource]="page().items">
            <ng-container matColumnDef="number">
              <th mat-header-cell *matHeaderCellDef>{{ 'portal.fields.number' | t }}</th>
              <td mat-cell *matCellDef="let row">{{ row.number }}</td>
            </ng-container>
            <ng-container matColumnDef="subject">
              <th mat-header-cell *matHeaderCellDef>{{ 'portal.fields.subject' | t }}</th>
              <td mat-cell *matCellDef="let row">
                <a class="subject" [routerLink]="['/portal/tickets', row.id]">{{ row.subject }}</a>
              </td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>{{ 'portal.fields.status' | t }}</th>
              <td mat-cell *matCellDef="let row">
                <span class="crm-pill" [class]="tone(row.status)">{{ 'portal.status.' + row.status | t }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="createdAt">
              <th mat-header-cell *matHeaderCellDef>{{ 'portal.fields.createdAt' | t }}</th>
              <td mat-cell *matCellDef="let row">{{ row.createdAt | localDate: 'mediumDate' }}</td>
            </ng-container>
            <ng-container matColumnDef="lastAgentReplyAt">
              <th mat-header-cell *matHeaderCellDef>{{ 'portal.fields.lastReply' | t }}</th>
              <td mat-cell *matCellDef="let row">
                @if (row.lastAgentReplyAt) {
                  {{ row.lastAgentReplyAt | localDate: 'relative' }}
                } @else {
                  <span class="crm-muted">—</span>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns" class="crm-row-link" (click)="open(row)"></tr>
          </table>
        </div>
        <mat-paginator
          [length]="page().meta.totalCount"
          [pageIndex]="page().meta.page - 1"
          [pageSize]="pageSize()"
          [pageSizeOptions]="[10, 20, 50]"
          (page)="changePage($event)"
        />
      }
    </section>
  `,
  styles: `
    .crm-toolbar { margin-bottom: 16px; }
    .subject { color: inherit; font-weight: 500; text-decoration: none; }
    .subject:hover { text-decoration: underline; }
  `,
})
export class PortalTicketsPage implements OnInit {
  private readonly api = inject(PortalTicketsApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translations = inject(TranslationService);

  readonly filters = FILTERS;
  readonly columns = ['number', 'subject', 'status', 'createdAt', 'lastAgentReplyAt'];
  readonly status = signal<PortalTicketFilter>('open');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);
  readonly page = signal<Paged<PortalTicketListItem>>(emptyPage(20));
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const requested = this.route.snapshot.queryParamMap.get('status');
    if (requested && (FILTERS as readonly string[]).includes(requested)) {
      this.status.set(requested as PortalTicketFilter);
    }
    this.load();
  }

  tone(status: string): string {
    return ticketStatusTone(status);
  }

  setStatus(value: unknown): void {
    if (typeof value === 'string' && (FILTERS as readonly string[]).includes(value)) {
      this.status.set(value as PortalTicketFilter);
      this.pageIndex.set(0);
      void this.router.navigate([], { relativeTo: this.route, queryParams: { status: value }, replaceUrl: true });
      this.load();
    }
  }

  changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  open(row: PortalTicketListItem): void {
    void this.router.navigate(['/portal/tickets', row.id]);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list(this.status(), this.pageIndex() + 1, this.pageSize()).subscribe({
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
