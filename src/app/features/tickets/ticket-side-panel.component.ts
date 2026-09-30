import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { LocalizedDatePipe } from '../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { PermissionService } from '../../core/permissions/permission.service';
import { Permissions } from '../../core/permissions/permissions';
import { TicketAgentPickerComponent } from './agent-picker.component';
import { TicketsApi } from './tickets.api';
import { TICKET_PRIORITIES, Ticket, TicketCategory, UserLookup, buildCategoryTree, categoryLabel, slaTone } from './tickets.models';

/** Ticket side panel: customer, SLA, assignee, category/priority, organization and metadata. */
@Component({
  selector: 'app-ticket-side-panel',
  imports: [
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatTooltipModule,
    TranslatePipe,
    LocalizedDatePipe,
    TicketAgentPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tk = ticket();
    <section class="crm-card">
      <h3><mat-icon>person</mat-icon> {{ 'tickets.fields.customer' | t }}</h3>
      <a class="customer" [routerLink]="['/customers', tk.customer.id]">{{ tk.customer.name }}</a>
      <dl>
        <dt>{{ 'tickets.details.customerNumber' | t }}</dt>
        <dd>{{ tk.customer.number }}</dd>
        @if (tk.customer.email) {
          <dt>{{ 'core.fields.email' | t }}</dt>
          <dd><a [href]="'mailto:' + tk.customer.email">{{ tk.customer.email }}</a></dd>
        }
        @if (tk.customer.phone) {
          <dt>{{ 'core.fields.phone' | t }}</dt>
          <dd dir="ltr">{{ tk.customer.phone }}</dd>
        }
        <dt>{{ 'tickets.details.language' | t }}</dt>
        <dd>{{ tk.customer.preferredLanguage }}</dd>
      </dl>
    </section>

    <section class="crm-card">
      <h3>
        <mat-icon>timer</mat-icon> {{ 'tickets.sla.title' | t }}
        @if (tk.sla.state !== 'none') {
          <span [class]="'crm-pill crm-pill--' + slaTone(tk.sla.state)">{{ 'tickets.sla.state.' + tk.sla.state | t }}</span>
        }
      </h3>
      @if (tk.sla.policyName || tk.sla.firstResponseDueAt || tk.sla.resolutionDueAt) {
        <dl>
          <dt>{{ 'tickets.sla.policy' | t }}</dt>
          <dd>{{ tk.sla.policyName ?? '—' }}</dd>
          <dt>{{ 'tickets.sla.firstResponse' | t }}</dt>
          <dd [class.breached]="tk.sla.firstResponseBreached">
            @if (tk.sla.firstRespondedAt) {
              {{ 'tickets.sla.respondedAt' | t: { date: (tk.sla.firstRespondedAt | localDate: 'short') } }}
            } @else if (tk.sla.firstResponseDueAt) {
              {{ 'tickets.sla.dueAt' | t: { date: (tk.sla.firstResponseDueAt | localDate: 'short') } }}
              <small class="crm-muted">({{ tk.sla.firstResponseDueAt | localDate: 'relative' }})</small>
            } @else {
              —
            }
            @if (tk.sla.firstResponseBreached) {
              <span class="crm-pill crm-pill--danger">{{ 'tickets.sla.breached' | t }}</span>
            }
          </dd>
          <dt>{{ 'tickets.sla.resolution' | t }}</dt>
          <dd [class.breached]="tk.sla.resolutionBreached">
            @if (tk.sla.resolvedAt) {
              {{ 'tickets.sla.resolvedAt' | t: { date: (tk.sla.resolvedAt | localDate: 'short') } }}
            } @else if (tk.sla.resolutionDueAt) {
              {{ 'tickets.sla.dueAt' | t: { date: (tk.sla.resolutionDueAt | localDate: 'short') } }}
              <small class="crm-muted">({{ tk.sla.resolutionDueAt | localDate: 'relative' }})</small>
            } @else {
              —
            }
            @if (tk.sla.resolutionBreached) {
              <span class="crm-pill crm-pill--danger">{{ 'tickets.sla.breached' | t }}</span>
            }
          </dd>
        </dl>
      } @else {
        <p class="crm-muted">{{ 'tickets.sla.none' | t }}</p>
      }
    </section>

    <section class="crm-card">
      <h3><mat-icon>assignment_ind</mat-icon> {{ 'tickets.fields.assignee' | t }}</h3>
      @if (canAssignOthers) {
        <app-ticket-agent-picker [label]="'tickets.details.assignTo' | t" [value]="tk.assignedAgentName" [disabled]="busy() || closed()" (picked)="onPicked($event)" />
      } @else {
        <p>{{ tk.assignedAgentName ?? ('tickets.filters.unassigned' | t) }}</p>
      }
      <div class="row-actions">
        @if (canUpdate && !closed() && tk.assignedAgentId !== currentUserId()) {
          <button mat-stroked-button type="button" (click)="assign(currentUserId())" [disabled]="busy()">
            <mat-icon>person_add</mat-icon> {{ 'tickets.actions.assignToMe' | t }}
          </button>
        }
        @if (canAssignOthers && !closed() && tk.assignedAgentId) {
          <button mat-button type="button" (click)="assign(null)" [disabled]="busy()">
            <mat-icon>person_remove</mat-icon> {{ 'tickets.actions.unassign' | t }}
          </button>
        }
      </div>
    </section>

    <section class="crm-card">
      <h3><mat-icon>tune</mat-icon> {{ 'tickets.details.classification' | t }}</h3>
      @if (canUpdate && !closed()) {
        <mat-form-field class="full">
          <mat-label>{{ 'tickets.fields.category' | t }}</mat-label>
          <mat-select [value]="tk.categoryId ?? ''" (selectionChange)="save($event.value || null, tk.priority)" [disabled]="busy()">
            <mat-option value="">{{ 'core.states.none' | t }}</mat-option>
            @for (category of categoryTree(); track category.id) {
              <mat-option [value]="category.id">
                <span class="indent" [style.inline-size.px]="category.depth * 16"></span>{{ categoryName(category) }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field class="full">
          <mat-label>{{ 'tickets.fields.priority' | t }}</mat-label>
          <mat-select [value]="tk.priority" (selectionChange)="save(tk.categoryId, $event.value)" [disabled]="busy()">
            @for (priority of priorities; track priority) {
              <mat-option [value]="priority">{{ 'tickets.priority.' + priority | t }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      } @else {
        <dl>
          <dt>{{ 'tickets.fields.category' | t }}</dt>
          <dd>{{ tk.categoryName ?? '—' }}</dd>
          <dt>{{ 'tickets.fields.priority' | t }}</dt>
          <dd>{{ 'tickets.priority.' + tk.priority | t }}</dd>
        </dl>
      }
    </section>

    <section class="crm-card">
      <h3><mat-icon>info</mat-icon> {{ 'tickets.details.info' | t }}</h3>
      <dl>
        <dt>{{ 'tickets.fields.channel' | t }}</dt>
        <dd>{{ 'tickets.channel.' + tk.channel | t }}</dd>
        <dt>{{ 'tickets.fields.branch' | t }}</dt>
        <dd>{{ tk.branchName }}</dd>
        <dt>{{ 'tickets.fields.department' | t }}</dt>
        <dd>{{ tk.departmentName ?? '—' }}</dd>
        @if (tk.replyAddress) {
          <dt>{{ 'tickets.details.replyAddress' | t }}</dt>
          <dd>{{ tk.replyAddress }}</dd>
        }
        @if (tk.escalationLevel > 0) {
          <dt>{{ 'tickets.details.escalation' | t }}</dt>
          <dd>{{ 'tickets.details.escalationLevel' | t: { level: tk.escalationLevel } }} · {{ tk.escalatedAt | localDate: 'short' }}</dd>
        }
        @if (tk.satisfactionRating) {
          <dt>{{ 'tickets.details.satisfaction' | t }}</dt>
          <dd>{{ tk.satisfactionRating }} / 5 @if (tk.satisfactionComment) { — {{ tk.satisfactionComment }} }</dd>
        }
        <dt>{{ 'core.fields.createdAt' | t }}</dt>
        <dd>{{ tk.createdAt | localDate }}</dd>
        @if (tk.updatedAt) {
          <dt>{{ 'core.fields.updatedAt' | t }}</dt>
          <dd>{{ tk.updatedAt | localDate }}</dd>
        }
        @if (tk.closedAt) {
          <dt>{{ 'tickets.details.closedAt' | t }}</dt>
          <dd>{{ tk.closedAt | localDate }}</dd>
        }
      </dl>
      @if (tk.tags.length) {
        <mat-chip-set [attr.aria-label]="'tickets.fields.tags' | t">
          @for (tag of tk.tags; track tag) {
            <mat-chip>{{ tag }}</mat-chip>
          }
        </mat-chip-set>
      }
    </section>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 10px; font: var(--mat-sys-title-small); }
    h3 mat-icon { font-size: 20px; inline-size: 20px; block-size: 20px; color: var(--mat-sys-on-surface-variant); }
    h3 .crm-pill { margin-inline-start: auto; }
    dl { display: grid; grid-template-columns: minmax(90px, max-content) 1fr; gap: 6px 12px; margin: 0; }
    dt { color: var(--mat-sys-on-surface-variant); }
    dd { margin: 0; overflow-wrap: anywhere; }
    dd.breached { color: var(--crm-danger); }
    .customer { display: inline-block; font: var(--mat-sys-title-medium); margin-block-end: 8px; }
    .row-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .full { inline-size: 100%; }
    p { margin: 0 0 8px; }
    .indent { display: inline-block; }
  `,
})
export class TicketSidePanelComponent {
  private readonly api = inject(TicketsApi);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionService);

  readonly ticket = input.required<Ticket>();
  readonly categories = input.required<TicketCategory[]>();
  readonly updated = output<Ticket>();

  readonly priorities = TICKET_PRIORITIES;
  readonly slaTone = slaTone;
  readonly canUpdate = this.permissions.has(Permissions.ticketsUpdate);
  readonly canAssignOthers = this.permissions.has(Permissions.ticketsAssign);
  readonly busy = signal(false);
  readonly currentUserId = computed(() => this.auth.currentUser()?.id ?? null);
  readonly closed = computed(() => this.ticket().status === 'Closed');
  readonly categoryTree = computed(() => {
    const current = this.ticket().categoryId;
    // Keep an inactive current category selectable so the select shows it.
    return buildCategoryTree(this.categories().filter((c) => c.isActive || c.id === current));
  });

  categoryName(category: TicketCategory): string {
    return categoryLabel(category, this.translations.language());
  }

  onPicked(user: UserLookup | null): void {
    if (user && user.id !== this.ticket().assignedAgentId) {
      this.assign(user.id);
    }
  }

  assign(agentId: string | null): void {
    this.busy.set(true);
    this.api.assign(this.ticket().id, agentId).subscribe({
      next: (ticket) => {
        this.busy.set(false);
        this.toast.success(agentId ? 'tickets.messages.assigned' : 'tickets.messages.unassigned');
        this.updated.emit(ticket);
      },
      // The global snackbar shows AGENT_NOT_ELIGIBLE / ASSIGN_FORBIDDEN; re-emit to reset the picker.
      error: () => {
        this.busy.set(false);
        this.updated.emit({ ...this.ticket() });
      },
    });
  }

  /** PUT /tickets/{id} with the current subject/description/tags and the new category/priority. */
  save(categoryId: string | null, priority: string): void {
    const t = this.ticket();
    if (categoryId === t.categoryId && priority === t.priority) {
      return;
    }
    this.busy.set(true);
    this.api.update(t.id, { subject: t.subject, description: t.description, categoryId, priority, tags: t.tags }).subscribe({
      next: (ticket) => {
        this.busy.set(false);
        this.toast.success('core.states.saved');
        this.updated.emit(ticket);
      },
      error: () => {
        this.busy.set(false);
        this.updated.emit({ ...t });
      },
    });
  }
}
