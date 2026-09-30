import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { LocalizedDatePipe } from '../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { Customer } from './customers.models';

/** Read-only profile and ticket stats from `CustomerResponse`. */
@Component({
  selector: 'app-customer-profile-tab',
  imports: [MatChipsModule, TranslatePipe, LocalizedDatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = customer();
    <div class="stats">
      <div class="crm-card stat">
        <span class="crm-muted">{{ 'customers.stats.openTickets' | t }}</span>
        <strong>{{ c.stats.openTickets }}</strong>
      </div>
      <div class="crm-card stat">
        <span class="crm-muted">{{ 'customers.stats.totalTickets' | t }}</span>
        <strong>{{ c.stats.totalTickets }}</strong>
      </div>
      <div class="crm-card stat">
        <span class="crm-muted">{{ 'customers.stats.lastInteraction' | t }}</span>
        <strong>{{ c.stats.lastInteractionAt ? (c.stats.lastInteractionAt | localDate: 'relative') : '—' }}</strong>
      </div>
      <div class="crm-card stat">
        <span class="crm-muted">{{ 'customers.stats.satisfaction' | t }}</span>
        <strong>{{ c.stats.averageSatisfaction !== null ? (c.stats.averageSatisfaction | number: '1.1-1') + ' / 5' : '—' }}</strong>
      </div>
    </div>

    <section class="crm-card">
      <dl>
        <dt>{{ 'customers.fields.number' | t }}</dt>
        <dd>{{ c.number }}</dd>
        <dt>{{ 'customers.fields.type' | t }}</dt>
        <dd>{{ 'customers.type.' + c.type | t }}</dd>
        <dt>{{ 'customers.fields.name' | t }}</dt>
        <dd>{{ c.name }}</dd>
        <dt>{{ 'customers.fields.companyName' | t }}</dt>
        <dd>{{ c.companyName || '—' }}</dd>
        <dt>{{ 'customers.fields.preferredLanguage' | t }}</dt>
        <dd>{{ 'customers.language.' + c.preferredLanguage | t }}</dd>
        <dt>{{ 'customers.fields.status' | t }}</dt>
        <dd>{{ 'customers.status.' + c.status | t }}</dd>
        <dt>{{ 'customers.fields.branch' | t }}</dt>
        <dd>{{ c.branchName }}</dd>
        <dt>{{ 'customers.fields.department' | t }}</dt>
        <dd>{{ c.departmentName || '—' }}</dd>
        <dt>{{ 'customers.fields.tags' | t }}</dt>
        <dd>
          @if (c.tags.length) {
            <mat-chip-set>
              @for (tag of c.tags; track tag) {
                <mat-chip>{{ tag }}</mat-chip>
              }
            </mat-chip-set>
          } @else {
            —
          }
        </dd>
        @if (c.externalSystem) {
          <dt>{{ 'customers.fields.external' | t }}</dt>
          <dd>{{ c.externalSystem }} · {{ c.externalId }}</dd>
        }
        <dt>{{ 'customers.fields.portal' | t }}</dt>
        <dd>{{ (c.hasPortalAccount ? 'customers.portal.hasAccess' : 'customers.portal.noAccess') | t }}</dd>
        <dt>{{ 'customers.fields.createdAt' | t }}</dt>
        <dd>{{ c.createdAt | localDate }}</dd>
        @if (c.updatedAt) {
          <dt>{{ 'customers.fields.updatedAt' | t }}</dt>
          <dd>{{ c.updatedAt | localDate }}</dd>
        }
      </dl>
    </section>
  `,
  styles: `
    .stats { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-block-end: 16px; }
    .stat { display: flex; flex-direction: column; gap: 4px; }
    .stat strong { font: var(--mat-sys-headline-small); }
    dl { display: grid; grid-template-columns: minmax(120px, max-content) 1fr; gap: 12px 24px; margin: 0; }
    dt { color: var(--mat-sys-on-surface-variant); }
    dd { margin: 0; overflow-wrap: anywhere; }
  `,
})
export class CustomerProfileTabComponent {
  readonly customer = input.required<Customer>();
}
