import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { ConfirmService } from '../../shared/confirm-dialog.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/state.components';
import { EscalationRuleDialogComponent, EscalationRuleDialogData } from './escalation-rule-dialog.component';
import { SlaDurationPipe } from './duration.pipe';
import { SlaApi } from './sla.api';
import { SlaLookupsService } from './sla-lookups.service';
import { EscalationRuleRequest, EscalationRuleResponse, priorityPillClass } from './sla.models';

/** `/sla/escalation-rules` — escalation rules (automation.manage), evaluated by the SLA engine. */
@Component({
  selector: 'app-escalation-rules-page',
  imports: [
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTooltipModule,
    TranslatePipe,
    SlaDurationPipe,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './sla-pages.scss',
  template: `
    <div class="crm-toolbar">
      <p class="crm-muted intro">{{ 'sla.escalation.intro' | t }}</p>
      <span class="crm-spacer"></span>
      <button mat-flat-button type="button" (click)="edit(null)">
        <mat-icon>add</mat-icon>{{ 'sla.escalation.create' | t }}
      </button>
    </div>

    @if (loading()) {
      <app-loading />
    } @else if (error()) {
      <app-error-state [message]="error()" (retry)="load()" />
    } @else if (rules().length === 0) {
      <div class="crm-card">
        <app-empty-state icon="trending_up" [message]="'sla.escalation.empty' | t">
          <button mat-stroked-button type="button" (click)="edit(null)">{{ 'sla.escalation.create' | t }}</button>
        </app-empty-state>
      </div>
    } @else {
      <div class="crm-table-wrap">
        <table mat-table [dataSource]="rules()">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>{{ 'sla.fields.name' | t }}</th>
            <td mat-cell *matCellDef="let r">
              <div class="name-cell"><strong>{{ r.name }}</strong></div>
            </td>
          </ng-container>
          <ng-container matColumnDef="when">
            <th mat-header-cell *matHeaderCellDef>{{ 'sla.escalation.when' | t }}</th>
            <td mat-cell *matCellDef="let r">
              <div class="tags">
                <span class="crm-pill crm-pill--warning">{{ 'sla.trigger.' + r.trigger | t }}</span>
                @if (r.afterMinutes) {
                  <span class="crm-pill">{{ 'sla.escalation.after' | t: { time: (r.afterMinutes | slaDuration) } }}</span>
                } @else if (r.target) {
                  <span class="crm-pill">{{ 'sla.target.' + r.target | t }}</span>
                }
                @if (r.matchPriority) {
                  <span class="crm-pill" [class]="priorityClass(r.matchPriority)">{{ 'sla.priority.' + r.matchPriority | t }}</span>
                }
                @if (r.matchDepartmentId) {
                  <span class="crm-pill">{{ lookups.departmentName(r.matchDepartmentId) ?? ('sla.fields.department' | t) }}</span>
                }
              </div>
            </td>
          </ng-container>
          <ng-container matColumnDef="then">
            <th mat-header-cell *matHeaderCellDef>{{ 'sla.escalation.then' | t }}</th>
            <td mat-cell *matCellDef="let r">
              <div class="tags">
                @if (r.escalateTicket) {
                  <span class="crm-pill crm-pill--danger">{{ 'sla.fields.escalateTicket' | t }}</span>
                }
                @if (r.raisePriorityTo) {
                  <span class="crm-pill" [class]="priorityClass(r.raisePriorityTo)">{{ 'sla.escalation.toPriority' | t: { name: ('sla.priority.' + r.raisePriorityTo | t) } }}</span>
                }
                @if (r.reassignToAgentId) {
                  <span class="crm-pill crm-pill--primary">{{ 'sla.escalation.reassign' | t: { name: lookups.userName(r.reassignToAgentId) ?? ('sla.fields.unknownUser' | t) } }}</span>
                }
                @if (r.notifyAssignee) {
                  <span class="crm-pill crm-pill--info">{{ 'sla.fields.notifyAssignee' | t }}</span>
                }
                @if (r.notifyManagers) {
                  <span class="crm-pill crm-pill--info">{{ 'sla.fields.notifyManagers' | t }}</span>
                }
                @if (r.notifyUserIds.length) {
                  <span class="crm-pill crm-pill--info">{{ 'sla.escalation.notifyCount' | t: { count: r.notifyUserIds.length } }}</span>
                }
              </div>
            </td>
          </ng-container>
          <ng-container matColumnDef="active">
            <th mat-header-cell *matHeaderCellDef>{{ 'sla.fields.active' | t }}</th>
            <td mat-cell *matCellDef="let r">
              <mat-slide-toggle [checked]="r.isActive" [disabled]="toggling() === r.id" (change)="toggleActive(r)" [attr.aria-label]="'sla.fields.active' | t" />
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef><span class="cdk-visually-hidden">{{ 'core.actions.more' | t }}</span></th>
            <td mat-cell *matCellDef="let r">
              <div class="row-actions">
                <button mat-icon-button type="button" (click)="edit(r)" [matTooltip]="'core.actions.edit' | t" [attr.aria-label]="'core.actions.edit' | t">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button type="button" (click)="remove(r)" [matTooltip]="'core.actions.delete' | t" [attr.aria-label]="'core.actions.delete' | t">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      </div>
    }
  `,
})
export class EscalationRulesPage {
  private readonly api = inject(SlaApi);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  readonly lookups = inject(SlaLookupsService);

  readonly columns = ['name', 'when', 'then', 'active', 'actions'];
  readonly rules = signal<EscalationRuleResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly toggling = signal<string | null>(null);
  readonly priorityClass = priorityPillClass;

  constructor() {
    this.lookups.ensureLoaded();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listEscalationRules().subscribe({
      next: (rules) => {
        this.rules.set(rules);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(describeError(ApiError.from(error), this.translations));
        this.loading.set(false);
      },
    });
  }

  edit(rule: EscalationRuleResponse | null): void {
    this.dialog
      .open<EscalationRuleDialogComponent, EscalationRuleDialogData, boolean>(EscalationRuleDialogComponent, {
        data: { rule },
        width: '760px',
        maxWidth: '95vw',
        direction: this.translations.direction(),
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.load();
        }
      });
  }

  toggleActive(rule: EscalationRuleResponse): void {
    const { id, ...rest } = rule;
    const body: EscalationRuleRequest = { ...rest, isActive: !rule.isActive };
    this.toggling.set(id);
    this.api.saveEscalationRule(id, body).subscribe({
      next: (updated) => {
        this.toggling.set(null);
        this.rules.update((list) => list.map((r) => (r.id === id ? updated : r)));
      },
      error: (error: unknown) => {
        this.toggling.set(null);
        // New object identity re-renders the row, resetting the toggle.
        this.rules.update((list) => list.map((r) => (r.id === id ? { ...r } : r)));
        this.toast.error(describeError(ApiError.from(error), this.translations));
      },
    });
  }

  remove(rule: EscalationRuleResponse): void {
    this.confirm
      .ask({ title: 'sla.escalation.deleteTitle', message: 'sla.escalation.deleteMessage', params: { name: rule.name }, confirmText: 'core.actions.delete', destructive: true })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.api.deleteEscalationRule(rule.id).subscribe(() => {
          this.toast.success('core.states.deleted');
          this.load();
        });
      });
  }
}
