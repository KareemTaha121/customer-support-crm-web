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
import { AssignmentRuleDialogComponent, AssignmentRuleDialogData } from './assignment-rule-dialog.component';
import { SlaApi } from './sla.api';
import { SlaLookupsService } from './sla-lookups.service';
import { AssignmentRuleRequest, AssignmentRuleResponse, priorityPillClass } from './sla.models';

/** `/sla/assignment-rules` — auto-assignment rules (automation.manage). First match by order wins. */
@Component({
  selector: 'app-assignment-rules-page',
  imports: [
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTooltipModule,
    TranslatePipe,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './sla-pages.scss',
  template: `
    <div class="crm-toolbar">
      <p class="crm-muted intro">{{ 'sla.assignment.intro' | t }}</p>
      <span class="crm-spacer"></span>
      <button mat-flat-button type="button" (click)="edit(null)">
        <mat-icon>add</mat-icon>{{ 'sla.assignment.create' | t }}
      </button>
    </div>

    @if (loading()) {
      <app-loading />
    } @else if (error()) {
      <app-error-state [message]="error()" (retry)="load()" />
    } @else if (rules().length === 0) {
      <div class="crm-card">
        <app-empty-state icon="alt_route" [message]="'sla.assignment.empty' | t">
          <button mat-stroked-button type="button" (click)="edit(null)">{{ 'sla.assignment.create' | t }}</button>
        </app-empty-state>
      </div>
    } @else {
      <div class="crm-table-wrap">
        <table mat-table [dataSource]="rules()">
          <ng-container matColumnDef="order">
            <th mat-header-cell *matHeaderCellDef>{{ 'sla.fields.order' | t }}</th>
            <td mat-cell *matCellDef="let r">{{ r.order }}</td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>{{ 'sla.fields.name' | t }}</th>
            <td mat-cell *matCellDef="let r">
              <div class="name-cell"><strong>{{ r.name }}</strong></div>
            </td>
          </ng-container>
          <ng-container matColumnDef="conditions">
            <th mat-header-cell *matHeaderCellDef>{{ 'sla.assignment.conditions' | t }}</th>
            <td mat-cell *matCellDef="let r">
              <div class="tags">
                @if (r.matchCategoryId) {
                  <span class="crm-pill">{{ lookups.categoryName(r.matchCategoryId) ?? ('sla.fields.category' | t) }}</span>
                }
                @if (r.matchDepartmentId) {
                  <span class="crm-pill">{{ lookups.departmentName(r.matchDepartmentId) ?? ('sla.fields.department' | t) }}</span>
                }
                @if (r.matchChannel) {
                  <span class="crm-pill crm-pill--info">{{ 'sla.channel.' + r.matchChannel | t }}</span>
                }
                @if (r.matchPriority) {
                  <span class="crm-pill" [class]="priorityClass(r.matchPriority)">{{ 'sla.priority.' + r.matchPriority | t }}</span>
                }
                @if (r.matchKeyword) {
                  <span class="crm-pill">“{{ r.matchKeyword }}”</span>
                }
                @if (!r.matchCategoryId && !r.matchDepartmentId && !r.matchChannel && !r.matchPriority && !r.matchKeyword) {
                  <span class="crm-muted">{{ 'sla.fields.allTickets' | t }}</span>
                }
              </div>
            </td>
          </ng-container>
          <ng-container matColumnDef="then">
            <th mat-header-cell *matHeaderCellDef>{{ 'sla.assignment.actions' | t }}</th>
            <td mat-cell *matCellDef="let r">
              <div class="tags">
                <span class="crm-pill crm-pill--primary">
                  {{ 'sla.strategy.' + r.strategy | t }}
                  @if (r.strategy === 'SpecificAgent') {
                    : {{ r.agentName ?? ('sla.fields.unknownUser' | t) }}
                  }
                </span>
                @if (r.setDepartmentId) {
                  <span class="crm-pill">{{ 'sla.assignment.toDepartment' | t: { name: lookups.departmentName(r.setDepartmentId) ?? '—' } }}</span>
                }
                @if (r.setPriority) {
                  <span class="crm-pill" [class]="priorityClass(r.setPriority)">{{ 'sla.assignment.toPriority' | t: { name: ('sla.priority.' + r.setPriority | t) } }}</span>
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
export class AssignmentRulesPage {
  private readonly api = inject(SlaApi);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  readonly lookups = inject(SlaLookupsService);

  readonly columns = ['order', 'name', 'conditions', 'then', 'active', 'actions'];
  readonly rules = signal<AssignmentRuleResponse[]>([]);
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
    this.api.listAssignmentRules().subscribe({
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

  edit(rule: AssignmentRuleResponse | null): void {
    const nextOrder = this.rules().reduce((max, r) => Math.max(max, r.order), 0) + 1;
    this.dialog
      .open<AssignmentRuleDialogComponent, AssignmentRuleDialogData, boolean>(AssignmentRuleDialogComponent, {
        data: { rule, nextOrder },
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

  toggleActive(rule: AssignmentRuleResponse): void {
    const { id, agentName: _agentName, ...rest } = rule;
    const body: AssignmentRuleRequest = { ...rest, isActive: !rule.isActive };
    this.toggling.set(id);
    this.api.saveAssignmentRule(id, body).subscribe({
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

  remove(rule: AssignmentRuleResponse): void {
    this.confirm
      .ask({ title: 'sla.assignment.deleteTitle', message: 'sla.assignment.deleteMessage', params: { name: rule.name }, confirmText: 'core.actions.delete', destructive: true })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.api.deleteAssignmentRule(rule.id).subscribe(() => {
          this.toast.success('core.states.deleted');
          this.load();
        });
      });
  }
}
