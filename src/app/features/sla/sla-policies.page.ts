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
import { SlaDurationPipe } from './duration.pipe';
import { SlaApi } from './sla.api';
import { SlaLookupsService } from './sla-lookups.service';
import { SlaPolicyDialogComponent, SlaPolicyDialogData } from './sla-policy-dialog.component';
import { SlaPolicyRequest, SlaPolicyResponse, priorityPillClass } from './sla.models';

/** `/sla/policies` — SLA policies (sla.manage). */
@Component({
  selector: 'app-sla-policies-page',
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
      <p class="crm-muted intro">{{ 'sla.policies.intro' | t }}</p>
      <span class="crm-spacer"></span>
      <button mat-flat-button type="button" (click)="edit(null)">
        <mat-icon>add</mat-icon>{{ 'sla.policies.create' | t }}
      </button>
    </div>

    @if (loading()) {
      <app-loading />
    } @else if (error()) {
      <app-error-state [message]="error()" (retry)="load()" />
    } @else if (policies().length === 0) {
      <div class="crm-card">
        <app-empty-state icon="timer" [message]="'sla.policies.empty' | t">
          <button mat-stroked-button type="button" (click)="edit(null)">{{ 'sla.policies.create' | t }}</button>
        </app-empty-state>
      </div>
    } @else {
      <div class="crm-table-wrap">
        <table mat-table [dataSource]="policies()">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>{{ 'sla.fields.name' | t }}</th>
            <td mat-cell *matCellDef="let p">
              <div class="name-cell">
                <strong>
                  {{ p.name }}
                  @if (p.isDefault) {
                    <span class="crm-pill crm-pill--primary">{{ 'sla.fields.default' | t }}</span>
                  }
                </strong>
                @if (p.description) {
                  <small class="crm-muted">{{ p.description }}</small>
                }
              </div>
            </td>
          </ng-container>
          <ng-container matColumnDef="scope">
            <th mat-header-cell *matHeaderCellDef>{{ 'sla.policies.appliesTo' | t }}</th>
            <td mat-cell *matCellDef="let p">
              <div class="tags">
                @if (p.categoryId) {
                  <span class="crm-pill">{{ lookups.categoryName(p.categoryId) ?? ('sla.fields.category' | t) }}</span>
                }
                @if (p.departmentId) {
                  <span class="crm-pill">{{ lookups.departmentName(p.departmentId) ?? ('sla.fields.department' | t) }}</span>
                }
                @if (!p.categoryId && !p.departmentId) {
                  <span class="crm-muted">{{ 'sla.fields.allTickets' | t }}</span>
                }
              </div>
            </td>
          </ng-container>
          <ng-container matColumnDef="schedule">
            <th mat-header-cell *matHeaderCellDef>{{ 'sla.policies.schedule' | t }}</th>
            <td mat-cell *matCellDef="let p">
              @if (p.businessHoursOnly) {
                <div>{{ daysLabel(p.workDays) }}</div>
                <small class="crm-muted"><bdi>{{ p.workStart }}–{{ p.workEnd }}</bdi></small>
              } @else {
                <span class="crm-muted">{{ 'sla.policies.allHours' | t }}</span>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="targets">
            <th mat-header-cell *matHeaderCellDef>{{ 'sla.policies.targets' | t }}</th>
            <td mat-cell *matCellDef="let p">
              <div class="targets">
                @for (t of p.targets; track t.priority) {
                  <span class="crm-pill" [class]="priorityClass(t.priority)">{{ 'sla.priority.' + t.priority | t }}</span>
                  <span [matTooltip]="'sla.fields.firstResponse' | t">{{ t.firstResponseMinutes | slaDuration }}</span>
                  <span [matTooltip]="'sla.fields.resolution' | t">{{ t.resolutionMinutes | slaDuration }}</span>
                }
              </div>
            </td>
          </ng-container>
          <ng-container matColumnDef="active">
            <th mat-header-cell *matHeaderCellDef>{{ 'sla.fields.active' | t }}</th>
            <td mat-cell *matCellDef="let p">
              <mat-slide-toggle
                [checked]="p.isActive"
                [disabled]="toggling() === p.id"
                (change)="toggleActive(p)"
                [attr.aria-label]="'sla.fields.active' | t"
              />
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef><span class="cdk-visually-hidden">{{ 'core.actions.more' | t }}</span></th>
            <td mat-cell *matCellDef="let p">
              <div class="row-actions">
                <button mat-icon-button type="button" (click)="edit(p)" [matTooltip]="'core.actions.edit' | t" [attr.aria-label]="'core.actions.edit' | t">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button type="button" (click)="remove(p)" [matTooltip]="'core.actions.delete' | t" [attr.aria-label]="'core.actions.delete' | t">
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
export class SlaPoliciesPage {
  private readonly api = inject(SlaApi);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  readonly lookups = inject(SlaLookupsService);

  readonly columns = ['name', 'scope', 'schedule', 'targets', 'active', 'actions'];
  readonly policies = signal<SlaPolicyResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly toggling = signal<string | null>(null);

  constructor() {
    this.lookups.ensureLoaded();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listPolicies().subscribe({
      next: (policies) => {
        this.policies.set(policies);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(describeError(ApiError.from(error), this.translations));
        this.loading.set(false);
      },
    });
  }

  edit(policy: SlaPolicyResponse | null): void {
    this.dialog
      .open<SlaPolicyDialogComponent, SlaPolicyDialogData, boolean>(SlaPolicyDialogComponent, {
        data: { policy },
        width: '820px',
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

  toggleActive(policy: SlaPolicyResponse): void {
    const { id, ...rest } = policy;
    const body: SlaPolicyRequest = { ...rest, isActive: !policy.isActive };
    this.toggling.set(id);
    this.api.savePolicy(id, body).subscribe({
      next: (updated) => {
        this.toggling.set(null);
        this.policies.update((list) => list.map((p) => (p.id === id ? updated : p)));
      },
      error: (error: unknown) => {
        this.toggling.set(null);
        // New object identity re-renders the row, resetting the toggle.
        this.policies.update((list) => list.map((p) => (p.id === id ? { ...p } : p)));
        this.toast.error(describeError(ApiError.from(error), this.translations));
      },
    });
  }

  remove(policy: SlaPolicyResponse): void {
    this.confirm
      .ask({ title: 'sla.policies.deleteTitle', message: 'sla.policies.deleteMessage', params: { name: policy.name }, confirmText: 'core.actions.delete', destructive: true })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.api.deletePolicy(policy.id).subscribe(() => {
          this.toast.success('core.states.deleted');
          this.load();
        });
      });
  }

  daysLabel(days: readonly number[]): string {
    return days.map((d) => this.translations.t(`sla.weekdays.${d}`)).join(this.translations.isRtl() ? '، ' : ', ');
  }

  readonly priorityClass = priorityPillClass;
}
