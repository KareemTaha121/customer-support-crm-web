import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LocalizedDatePipe } from '../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { EmptyStateComponent } from '../../shared/state.components';
import { TicketHistoryEntry } from './tickets.models';

const ICONS: Record<string, string> = {
  created: 'add_circle',
  status: 'swap_horiz',
  assignee: 'person',
  priority: 'flag',
  category: 'category',
  department: 'move_up',
  escalated: 'priority_high',
  sla_warning: 'timer',
  sla_breached: 'alarm',
  feedback: 'star',
};

/** Ticket audit timeline (`GET /tickets/{id}/history`). Status/priority/channel values are translated. */
@Component({
  selector: 'app-ticket-history',
  imports: [MatIconModule, TranslatePipe, LocalizedDatePipe, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="timeline">
      @for (entry of entries(); track entry.id) {
        <li>
          <mat-icon class="dot">{{ icon(entry.action) }}</mat-icon>
          <div class="content">
            <div>
              <strong>{{ actionLabel(entry.action) }}</strong>
              @if (entry.oldValue || entry.newValue) {
                <span class="change">
                  @if (entry.oldValue) {
                    <span class="old">{{ value(entry.action, entry.oldValue) }}</span>
                    <mat-icon class="arrow rtl-flip">arrow_forward</mat-icon>
                  }
                  <span>{{ entry.newValue ? value(entry.action, entry.newValue) : ('core.states.none' | t) }}</span>
                </span>
              }
            </div>
            <small class="crm-muted">{{ entry.actorName ?? ('tickets.history.system' | t) }} · {{ entry.occurredAt | localDate }}</small>
          </div>
        </li>
      } @empty {
        <app-empty-state icon="history" [message]="'tickets.history.empty' | t" />
      }
    </ol>
  `,
  styles: `
    .timeline { list-style: none; margin: 0; padding: 0; }
    li { display: flex; gap: 12px; padding-block: 8px; position: relative; }
    li:not(:last-child)::after { content: ''; position: absolute; inset-inline-start: 11px; inset-block: 36px -4px; border-inline-start: 2px solid var(--mat-sys-outline-variant); }
    .dot { color: var(--mat-sys-primary); flex: none; }
    .content { display: flex; flex-direction: column; gap: 2px; min-inline-size: 0; }
    .change { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-inline-start: 8px; }
    .old { text-decoration: line-through; color: var(--mat-sys-on-surface-variant); }
    .arrow { font-size: 16px; inline-size: 16px; block-size: 16px; }
  `,
})
export class TicketHistoryComponent {
  private readonly translations = inject(TranslationService);
  readonly entries = input.required<TicketHistoryEntry[]>();

  icon(action: string): string {
    return ICONS[action] ?? 'history';
  }

  actionLabel(action: string): string {
    const key = `tickets.history.actions.${action}`;
    return this.translations.has(key) ? this.translations.t(key) : action;
  }

  /** Translates enum-like values (status, priority, channel, SLA target) when a key exists. */
  value(action: string, raw: string): string {
    const scope =
      action === 'status' ? 'status' : action === 'priority' ? 'priority' : action === 'created' ? 'channel' : action.startsWith('sla_') ? 'sla.target' : null;
    if (!scope) {
      return raw;
    }
    const key = `tickets.${scope}.${raw}`;
    return this.translations.has(key) ? this.translations.t(key) : raw;
  }
}
