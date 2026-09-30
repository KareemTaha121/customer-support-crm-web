import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { FormErrorPipe } from '../../shared/form-error.pipe';
import { SlaApi } from './sla.api';
import { SlaLookupsService } from './sla-lookups.service';
import { showSaveError } from './sla-form-utils';
import {
  DURATION_UNITS,
  DurationUnit,
  EscalationRuleRequest,
  EscalationRuleResponse,
  EscalationTrigger,
  PRIORITIES,
  SLA_TARGETS,
  SlaTarget,
  TIME_TRIGGERS,
  TRIGGERS,
  TicketPriority,
  splitMinutes,
  toMinutes,
} from './sla.models';
import { SlaUserPickerComponent } from './user-picker.component';

export interface EscalationRuleDialogData {
  rule: EscalationRuleResponse | null;
}

/** SaveEscalationRuleValidator: 1 minute – 30 days. */
const MAX_AFTER_MINUTES = 60 * 24 * 30;

function afterLimitValidator(control: AbstractControl): ValidationErrors | null {
  const trigger = control.get('trigger')?.value as EscalationTrigger;
  const amount = control.get('afterAmount')?.value as number | null;
  const unit = control.get('afterUnit')?.value as DurationUnit;
  return TIME_TRIGGERS.includes(trigger) && amount !== null && toMinutes(amount, unit) > MAX_AFTER_MINUTES ? { afterTooLong: true } : null;
}

@Component({
  selector: 'app-escalation-rule-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    TranslatePipe,
    FormErrorPipe,
    SlaUserPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './sla-dialog.scss',
  template: `
    <h2 mat-dialog-title>{{ (data.rule ? 'sla.escalation.edit' : 'sla.escalation.create') | t }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="crm-form-grid">
          <mat-form-field class="crm-span-all">
            <mat-label>{{ 'sla.fields.name' | t }}</mat-label>
            <input matInput formControlName="name" maxlength="150" cdkFocusInitial />
            <mat-error>{{ form.controls.name | formError }}</mat-error>
          </mat-form-field>
        </div>
        <div class="checks">
          <mat-slide-toggle formControlName="isActive">{{ 'sla.fields.active' | t }}</mat-slide-toggle>
        </div>

        <h3>{{ 'sla.escalation.when' | t }}</h3>
        <div class="crm-form-grid">
          <mat-form-field>
            <mat-label>{{ 'sla.fields.trigger' | t }}</mat-label>
            <mat-select formControlName="trigger">
              @for (tr of triggers; track tr) {
                <mat-option [value]="tr">{{ 'sla.trigger.' + tr | t }}</mat-option>
              }
            </mat-select>
            <mat-hint>{{ 'sla.triggerHint.' + form.controls.trigger.value | t }}</mat-hint>
            <mat-error>{{ form.controls.trigger | formError }}</mat-error>
          </mat-form-field>
          @if (isTimeTrigger()) {
            <div class="duration">
              <mat-form-field>
                <mat-label>{{ 'sla.fields.afterTime' | t }}</mat-label>
                <input matInput type="number" min="1" formControlName="afterAmount" />
                <mat-error>{{ form.controls.afterAmount | formError }}</mat-error>
              </mat-form-field>
              <mat-form-field>
                <mat-label>{{ 'sla.fields.unit' | t }}</mat-label>
                <mat-select formControlName="afterUnit">
                  @for (u of units; track u) {
                    <mat-option [value]="u">{{ 'sla.units.' + u | t }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
          } @else {
            <mat-form-field>
              <mat-label>{{ 'sla.fields.target' | t }}</mat-label>
              <mat-select formControlName="target">
                <mat-option [value]="null">{{ 'sla.target.any' | t }}</mat-option>
                @for (tg of targets; track tg) {
                  <mat-option [value]="tg">{{ 'sla.target.' + tg | t }}</mat-option>
                }
              </mat-select>
              <mat-error>{{ form.controls.target | formError }}</mat-error>
            </mat-form-field>
          }
          <mat-form-field>
            <mat-label>{{ 'sla.fields.priority' | t }}</mat-label>
            <mat-select formControlName="matchPriority">
              <mat-option [value]="null">{{ 'sla.fields.anyPriority' | t }}</mat-option>
              @for (p of priorities; track p) {
                <mat-option [value]="p">{{ 'sla.priority.' + p | t }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ form.controls.matchPriority | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'sla.fields.department' | t }}</mat-label>
            <mat-select formControlName="matchDepartmentId">
              <mat-option [value]="null">{{ 'sla.fields.anyDepartment' | t }}</mat-option>
              @for (d of lookups.departments(); track d.id) {
                <mat-option [value]="d.id">{{ d.label }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ form.controls.matchDepartmentId | formError }}</mat-error>
          </mat-form-field>
        </div>
        @if (form.hasError('afterTooLong')) {
          <p class="form-error">{{ 'sla.validation.afterTooLong' | t }}</p>
        }

        <h3>{{ 'sla.escalation.then' | t }}</h3>
        <div class="checks">
          <mat-checkbox formControlName="escalateTicket">{{ 'sla.fields.escalateTicket' | t }}</mat-checkbox>
          <mat-checkbox formControlName="notifyAssignee">{{ 'sla.fields.notifyAssignee' | t }}</mat-checkbox>
          <mat-checkbox formControlName="notifyManagers">{{ 'sla.fields.notifyManagers' | t }}</mat-checkbox>
        </div>
        <div class="crm-form-grid">
          <mat-form-field>
            <mat-label>{{ 'sla.fields.raisePriorityTo' | t }}</mat-label>
            <mat-select formControlName="raisePriorityTo">
              <mat-option [value]="null">{{ 'sla.fields.noChange' | t }}</mat-option>
              @for (p of priorities; track p) {
                <mat-option [value]="p">{{ 'sla.priority.' + p | t }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ form.controls.raisePriorityTo | formError }}</mat-error>
          </mat-form-field>
        </div>
        <app-sla-user-picker [label]="'sla.fields.reassignTo' | t" [hint]="'sla.escalation.reassignHint' | t" [(ids)]="reassignIds" />
        <app-sla-user-picker [label]="'sla.fields.notifyUsers' | t" [multiple]="true" [(ids)]="notifyIds" />
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'core.actions.cancel' | t }}</button>
        <button mat-flat-button type="submit" [disabled]="busy()">{{ 'core.actions.save' | t }}</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class EscalationRuleDialogComponent {
  readonly data = inject<EscalationRuleDialogData>(MAT_DIALOG_DATA);
  readonly lookups = inject(SlaLookupsService);
  private readonly api = inject(SlaApi);
  private readonly dialogRef = inject<MatDialogRef<EscalationRuleDialogComponent, boolean>>(MatDialogRef);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly triggers = TRIGGERS;
  readonly targets = SLA_TARGETS;
  readonly priorities = PRIORITIES;
  readonly units = DURATION_UNITS;
  readonly busy = signal(false);
  readonly reassignIds = signal<readonly string[]>(this.data.rule?.reassignToAgentId ? [this.data.rule.reassignToAgentId] : []);
  readonly notifyIds = signal<readonly string[]>(this.data.rule?.notifyUserIds ?? []);

  private readonly after = splitMinutes(this.data.rule?.afterMinutes ?? 60);

  readonly form = this.fb.group(
    {
      name: this.fb.control(this.data.rule?.name ?? '', [Validators.required, Validators.maxLength(150)]),
      isActive: this.fb.control(this.data.rule?.isActive ?? true),
      trigger: this.fb.control<EscalationTrigger>(this.data.rule?.trigger ?? 'SlaBreached', [Validators.required]),
      target: this.fb.control<SlaTarget | null>(this.data.rule?.target ?? null),
      afterAmount: this.fb.control<number | null>(this.after.amount, [Validators.required, Validators.min(1)]),
      afterUnit: this.fb.control<DurationUnit>(this.after.unit),
      matchPriority: this.fb.control<TicketPriority | null>(this.data.rule?.matchPriority ?? null),
      matchDepartmentId: this.fb.control<string | null>(this.data.rule?.matchDepartmentId ?? null),
      escalateTicket: this.fb.control(this.data.rule?.escalateTicket ?? true),
      raisePriorityTo: this.fb.control<TicketPriority | null>(this.data.rule?.raisePriorityTo ?? null),
      notifyAssignee: this.fb.control(this.data.rule?.notifyAssignee ?? true),
      notifyManagers: this.fb.control(this.data.rule?.notifyManagers ?? false),
    },
    { validators: afterLimitValidator },
  );

  constructor() {
    this.lookups.ensureLoaded();
    this.syncTrigger();
    this.form.controls.trigger.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncTrigger());
  }

  isTimeTrigger(): boolean {
    return TIME_TRIGGERS.includes(this.form.controls.trigger.value);
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) {
      return;
    }
    const v = this.form.getRawValue();
    const timed = TIME_TRIGGERS.includes(v.trigger);
    const body: EscalationRuleRequest = {
      name: v.name.trim(),
      isActive: v.isActive,
      trigger: v.trigger,
      target: timed ? null : v.target,
      afterMinutes: timed ? toMinutes(v.afterAmount, v.afterUnit) : null,
      matchPriority: v.matchPriority,
      matchDepartmentId: v.matchDepartmentId,
      escalateTicket: v.escalateTicket,
      raisePriorityTo: v.raisePriorityTo,
      reassignToAgentId: this.reassignIds()[0] ?? null,
      notifyAssignee: v.notifyAssignee,
      notifyManagers: v.notifyManagers,
      notifyUserIds: [...this.notifyIds()],
    };
    this.busy.set(true);
    this.api.saveEscalationRule(this.data.rule?.id ?? null, body).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(this.data.rule ? 'core.states.saved' : 'core.states.created');
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        showSaveError(this.form, error, this.toast, this.translations, (field) => (field === 'afterMinutes' ? 'afterAmount' : field));
      },
    });
  }

  /** `afterMinutes` only applies to time-based triggers (EscalationRule.Update). */
  private syncTrigger(): void {
    const amount = this.form.controls.afterAmount;
    if (this.isTimeTrigger()) {
      amount.enable({ emitEvent: false });
    } else {
      amount.disable({ emitEvent: false });
    }
    this.form.updateValueAndValidity({ emitEvent: false });
  }
}
