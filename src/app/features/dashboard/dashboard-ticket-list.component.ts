import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { LocalizedDatePipe } from '../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { DashboardTicket } from './dashboard.models';

const PRIORITY_TONE: Record<string, string> = { Urgent: 'danger', High: 'warning', Medium: 'info', Low: '' };
const SLA_TONE: Record<string, string> = { breached: 'danger', warning: 'warning', ok: 'success' };

/** A titled card with a short list of tickets linking to `/tickets/:id`. */
@Component({
  selector: 'app-dashboard-ticket-list',
  imports: [RouterLink, MatIconModule, TranslatePipe, LocalizedDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="crm-card widget">
      <header class="widget__head">
        <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
        <h2>{{ title() }}</h2>
        <span class="crm-pill">{{ tickets().length }}</span>
      </header>
      @if (tickets().length) {
        <ul class="ticket-list">
          @for (ticket of tickets(); track ticket.id) {
            <li>
              <a [routerLink]="['/tickets', ticket.id]" class="ticket">
                <span class="ticket__top">
                  <span class="ticket__number">{{ ticket.number }}</span>
                  <span class="ticket__subject">{{ ticket.subject }}</span>
                </span>
                <span class="ticket__meta">
                  <span class="crm-muted">{{ ticket.customerName }}</span>
                  <span class="crm-pill" [class]="'crm-pill--' + priorityTone(ticket.priority)">{{ 'dashboard.priority.' + ticket.priority | t }}</span>
                  <span class="crm-pill">{{ 'dashboard.ticketStatus.' + ticket.status | t }}</span>
                  @if (ticket.slaState !== 'none') {
                    <span class="crm-pill" [class]="'crm-pill--' + slaTone(ticket.slaState)">{{ 'dashboard.sla.' + ticket.slaState | t }}</span>
                  }
                  @if (ticket.resolutionDueAt) {
                    <span class="crm-muted due">
                      <mat-icon aria-hidden="true">schedule</mat-icon>{{ ticket.resolutionDueAt | localDate: 'relative' }}
                    </span>
                  }
                </span>
              </a>
            </li>
          }
        </ul>
      } @else {
        <p class="crm-muted empty">{{ emptyText() }}</p>
      }
    </section>
  `,
  styleUrl: './dashboard-widgets.scss',
})
export class DashboardTicketListComponent {
  readonly title = input.required<string>();
  readonly icon = input('confirmation_number');
  readonly emptyText = input.required<string>();
  readonly tickets = input.required<readonly DashboardTicket[]>();

  priorityTone(priority: string): string {
    return PRIORITY_TONE[priority] ?? '';
  }

  slaTone(state: string): string {
    return SLA_TONE[state] ?? '';
  }
}
