import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
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
import { orNull, showSaveError } from './sla-form-utils';
import {
  DURATION_UNITS,
  DurationUnit,
  PRIORITIES,
  SlaPolicyRequest,
  SlaPolicyResponse,
  SlaTargetDto,
  TicketPriority,
  WEEKDAYS,
  splitMinutes,
  toMinutes,
} from './sla.models';

export interface SlaPolicyDialogData {
  policy: SlaPolicyResponse | null;
}

/** SaveSlaPolicyValidator limits (SlaAdministration.cs). */
const MAX_FIRST_RESPONSE = 60 * 24 * 60;
const MAX_RESOLUTION = 60 * 24 * 365;

/** Suggested targets for a new policy (minutes). */
const DEFAULT_TARGETS: Record<TicketPriority, [number, number]> = {
  Low: [480, 4320],
  Medium: [240, 2880],
  High: [60, 1440],
  Urgent: [30, 240],
};

type TargetGroup = FormGroup<{
  priority: FormControl<TicketPriority>;
  enabled: FormControl<boolean>;
  firstResponseAmount: FormControl<number | null>;
  firstResponseUnit: FormControl<DurationUnit>;
  resolutionAmount: FormControl<number | null>;
  resolutionUnit: FormControl<DurationUnit>;
}>;

function targetValidator(control: AbstractControl): ValidationErrors | null {
  const v = (control as TargetGroup).getRawValue();
  if (!v.enabled || v.firstResponseAmount === null || v.resolutionAmount === null) {
    return null;
  }
  const first = toMinutes(v.firstResponseAmount, v.firstResponseUnit);
  const resolution = toMinutes(v.resolutionAmount, v.resolutionUnit);
  const errors: ValidationErrors = {};
  if (first > MAX_FIRST_RESPONSE) {
    errors['firstTooLong'] = true;
  }
  if (resolution > MAX_RESOLUTION) {
    errors['resolutionTooLong'] = true;
  }
  if (resolution < first) {
    errors['resolutionBeforeFirst'] = true;
  }
  return Object.keys(errors).length ? errors : null;
}

function policyValidator(control: AbstractControl): ValidationErrors | null {
  const group = control as FormGroup;
  const businessHours = group.get('businessHoursOnly')?.value as boolean;
  const days = group.get('workDays')?.value as number[];
  const start = group.get('workStart')?.value as string;
  const end = group.get('workEnd')?.value as string;
  const targets = (group.get('targets')?.getRawValue() ?? []) as { enabled: boolean }[];
  const errors: ValidationErrors = {};
  if (businessHours && days.length === 0) {
    errors['noWorkDays'] = true;
  }
  if (businessHours && start && end && end <= start) {
    errors['hoursOrder'] = true;
  }
  if (!targets.some((t) => t.enabled)) {
    errors['noTargets'] = true;
  }
  return Object.keys(errors).length ? errors : null;
}

@Component({
  selector: 'app-sla-policy-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    TranslatePipe,
    FormErrorPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './sla-dialog.scss',
  styles: `
    .target-row { display: grid; grid-template-columns: 130px 1fr 1fr; gap: 0 16px; align-items: start; }
    .target-row + .target-row { border-top: 1px solid var(--mat-sys-outline-variant); padding-top: 8px; }
    .target-row mat-checkbox { padding-top: 12px; }
    .target-row .form-error { grid-column: 1 / -1; }
    .target-head { font: var(--mat-sys-label-medium); color: var(--mat-sys-on-surface-variant); margin-bottom: 4px; }
    .days { margin-bottom: 12px; flex-wrap: wrap; }
    @media (max-width: 640px) { .target-row { grid-template-columns: 1fr; } .target-head { display: none; } }
  `,
  template: `
    <h2 mat-dialog-title>{{ (data.policy ? 'sla.policies.edit' : 'sla.policies.create') | t }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="crm-form-grid">
          <mat-form-field class="crm-span-all">
            <mat-label>{{ 'sla.fields.name' | t }}</mat-label>
            <input matInput formControlName="name" maxlength="150" cdkFocusInitial />
            <mat-error>{{ form.controls.name | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field class="crm-span-all">
            <mat-label>{{ 'sla.fields.description' | t }}</mat-label>
            <textarea matInput formControlName="description" rows="2" maxlength="1000"></textarea>
            <mat-error>{{ form.controls.description | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'sla.fields.category' | t }}</mat-label>
            <mat-select formControlName="categoryId">
              <mat-option [value]="null">{{ 'sla.fields.anyCategory' | t }}</mat-option>
              @for (c of lookups.categories(); track c.id) {
                <mat-option [value]="c.id">{{ c.label }}</mat-option>
              }
            </mat-select>
            <mat-hint>{{ 'sla.policies.scopeHint' | t }}</mat-hint>
            <mat-error>{{ form.controls.categoryId | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'sla.fields.department' | t }}</mat-label>
            <mat-select formControlName="departmentId">
              <mat-option [value]="null">{{ 'sla.fields.anyDepartment' | t }}</mat-option>
              @for (d of lookups.departments(); track d.id) {
                <mat-option [value]="d.id">{{ d.label }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ form.controls.departmentId | formError }}</mat-error>
          </mat-form-field>
        </div>
        <div class="checks">
          <mat-slide-toggle formControlName="isActive">{{ 'sla.fields.active' | t }}</mat-slide-toggle>
          <mat-slide-toggle formControlName="isDefault">{{ 'sla.fields.isDefault' | t }}</mat-slide-toggle>
        </div>

        <h3>{{ 'sla.policies.schedule' | t }}</h3>
        <div class="checks">
          <mat-slide-toggle formControlName="businessHoursOnly">{{ 'sla.fields.businessHoursOnly' | t }}</mat-slide-toggle>
        </div>
        <p class="crm-muted hint">{{ (form.controls.businessHoursOnly.value ? 'sla.policies.businessHoursHint' : 'sla.policies.calendarHint') | t }}</p>
        @if (form.controls.businessHoursOnly.value) {
          <mat-button-toggle-group class="days" formControlName="workDays" multiple [attr.aria-label]="'sla.fields.workDays' | t">
            @for (day of weekdays; track day) {
              <mat-button-toggle [value]="day">{{ 'sla.weekdays.' + day | t }}</mat-button-toggle>
            }
          </mat-button-toggle-group>
          @if (form.hasError('noWorkDays')) {
            <p class="form-error">{{ 'sla.validation.noWorkDays' | t }}</p>
          }
          <div class="crm-form-grid">
            <mat-form-field>
              <mat-label>{{ 'sla.fields.workStart' | t }}</mat-label>
              <input matInput type="time" formControlName="workStart" />
              <mat-error>{{ form.controls.workStart | formError }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'sla.fields.workEnd' | t }}</mat-label>
              <input matInput type="time" formControlName="workEnd" />
              <mat-error>{{ form.controls.workEnd | formError }}</mat-error>
            </mat-form-field>
          </div>
          @if (form.hasError('hoursOrder')) {
            <p class="form-error">{{ 'sla.validation.hoursOrder' | t }}</p>
          }
        }

        <h3>{{ 'sla.policies.targets' | t }}</h3>
        <p class="crm-muted hint">{{ 'sla.policies.targetsHint' | t }}</p>
        <div class="target-row target-head" aria-hidden="true">
          <span>{{ 'sla.fields.priority' | t }}</span>
          <span>{{ 'sla.fields.firstResponse' | t }}</span>
          <span>{{ 'sla.fields.resolution' | t }}</span>
        </div>
        @for (row of form.controls.targets.controls; track row.controls.priority.value; let i = $index) {
          <div class="target-row" [formGroup]="row">
            <mat-checkbox formControlName="enabled">{{ 'sla.priority.' + row.controls.priority.value | t }}</mat-checkbox>
            <div class="duration">
              <mat-form-field>
                <mat-label>{{ 'sla.fields.firstResponse' | t }}</mat-label>
                <input matInput type="number" min="1" formControlName="firstResponseAmount" />
                <mat-error>{{ row.controls.firstResponseAmount | formError }}</mat-error>
              </mat-form-field>
              <mat-form-field>
                <mat-label>{{ 'sla.fields.unit' | t }}</mat-label>
                <mat-select formControlName="firstResponseUnit">
                  @for (u of units; track u) {
                    <mat-option [value]="u">{{ 'sla.units.' + u | t }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
            <div class="duration">
              <mat-form-field>
                <mat-label>{{ 'sla.fields.resolution' | t }}</mat-label>
                <input matInput type="number" min="1" formControlName="resolutionAmount" />
                <mat-error>{{ row.controls.resolutionAmount | formError }}</mat-error>
              </mat-form-field>
              <mat-form-field>
                <mat-label>{{ 'sla.fields.unit' | t }}</mat-label>
                <mat-select formControlName="resolutionUnit">
                  @for (u of units; track u) {
                    <mat-option [value]="u">{{ 'sla.units.' + u | t }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
            @if (row.hasError('resolutionBeforeFirst')) {
              <p class="form-error">{{ 'sla.validation.resolutionBeforeFirst' | t }}</p>
            }
            @if (row.hasError('firstTooLong')) {
              <p class="form-error">{{ 'sla.validation.firstTooLong' | t }}</p>
            }
            @if (row.hasError('resolutionTooLong')) {
              <p class="form-error">{{ 'sla.validation.resolutionTooLong' | t }}</p>
            }
          </div>
        }
        @if (form.hasError('noTargets') && form.touched) {
          <p class="form-error">{{ 'sla.validation.noTargets' | t }}</p>
        }
        @if (form.controls.targets.errors?.['server']; as serverError) {
          <p class="form-error">{{ serverError }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'core.actions.cancel' | t }}</button>
        <button mat-flat-button type="submit" [disabled]="busy()">{{ 'core.actions.save' | t }}</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class SlaPolicyDialogComponent {
  readonly data = inject<SlaPolicyDialogData>(MAT_DIALOG_DATA);
  readonly lookups = inject(SlaLookupsService);
  private readonly api = inject(SlaApi);
  private readonly dialogRef = inject<MatDialogRef<SlaPolicyDialogComponent, boolean>>(MatDialogRef);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly weekdays = WEEKDAYS;
  readonly units = DURATION_UNITS;
  readonly busy = signal(false);

  readonly form = this.buildForm(this.data.policy);

  constructor() {
    this.lookups.ensureLoaded();
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) {
      return;
    }
    const v = this.form.getRawValue();
    const sentIndexes: number[] = [];
    const targets: SlaTargetDto[] = [];
    v.targets.forEach((t, index) => {
      if (t.enabled) {
        sentIndexes.push(index);
        targets.push({
          priority: t.priority,
          firstResponseMinutes: toMinutes(t.firstResponseAmount, t.firstResponseUnit),
          resolutionMinutes: toMinutes(t.resolutionAmount, t.resolutionUnit),
        });
      }
    });
    const body: SlaPolicyRequest = {
      name: v.name.trim(),
      description: orNull(v.description.trim()),
      isActive: v.isActive,
      isDefault: v.isDefault,
      categoryId: v.categoryId,
      departmentId: v.departmentId,
      businessHoursOnly: v.businessHoursOnly,
      workDays: [...v.workDays].sort((a, b) => a - b),
      workStart: v.workStart || null,
      workEnd: v.workEnd || null,
      targets,
    };
    this.busy.set(true);
    this.api.savePolicy(this.data.policy?.id ?? null, body).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(this.data.policy ? 'core.states.saved' : 'core.states.created');
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        showSaveError(this.form, error, this.toast, this.translations, (field) =>
          field.replace(/^targets\[(\d+)\]\.(firstResponse|resolution)Minutes$/, (_m, index: string, kind: string) => {
            const formIndex = sentIndexes[Number(index)] ?? Number(index);
            return `targets.${formIndex}.${kind}Amount`;
          }).replace(/^targets\[(\d+)\]\.priority$/, 'targets'),
        );
      },
    });
  }

  private buildForm(policy: SlaPolicyResponse | null) {
    const targets = PRIORITIES.map((priority) => {
      const existing = policy?.targets.find((t) => t.priority === priority);
      const [first, resolution] = existing ? [existing.firstResponseMinutes, existing.resolutionMinutes] : DEFAULT_TARGETS[priority];
      const f = splitMinutes(first);
      const r = splitMinutes(resolution);
      const group: TargetGroup = this.fb.group(
        {
          priority: this.fb.control<TicketPriority>(priority),
          enabled: this.fb.control(policy ? !!existing : true),
          firstResponseAmount: this.fb.control<number | null>(f.amount, [Validators.required, Validators.min(1)]),
          firstResponseUnit: this.fb.control<DurationUnit>(f.unit),
          resolutionAmount: this.fb.control<number | null>(r.amount, [Validators.required, Validators.min(1)]),
          resolutionUnit: this.fb.control<DurationUnit>(r.unit),
        },
        { validators: targetValidator },
      );
      this.syncTarget(group);
      group.controls.enabled.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.syncTarget(group));
      return group;
    });

    return this.fb.group(
      {
        name: this.fb.control(policy?.name ?? '', [Validators.required, Validators.maxLength(150)]),
        description: this.fb.control(policy?.description ?? '', [Validators.maxLength(1000)]),
        isActive: this.fb.control(policy?.isActive ?? true),
        isDefault: this.fb.control(policy?.isDefault ?? false),
        categoryId: this.fb.control<string | null>(policy?.categoryId ?? null),
        departmentId: this.fb.control<string | null>(policy?.departmentId ?? null),
        businessHoursOnly: this.fb.control(policy?.businessHoursOnly ?? false),
        workDays: this.fb.control<number[]>(policy?.workDays ?? [0, 1, 2, 3, 4]),
        workStart: this.fb.control(policy?.workStart ?? '08:00', [Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]),
        workEnd: this.fb.control(policy?.workEnd ?? '17:00', [Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]),
        targets: this.fb.array(targets),
      },
      { validators: policyValidator },
    );
  }

  private syncTarget(group: TargetGroup): void {
    const amounts = [group.controls.firstResponseAmount, group.controls.firstResponseUnit, group.controls.resolutionAmount, group.controls.resolutionUnit];
    for (const control of amounts) {
      if (group.controls.enabled.value) {
        control.enable({ emitEvent: false });
      } else {
        control.disable({ emitEvent: false });
      }
    }
    group.updateValueAndValidity();
  }
}
