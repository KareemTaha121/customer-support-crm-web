import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
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
  AssignmentRuleRequest,
  AssignmentRuleResponse,
  AssignmentStrategy,
  CHANNELS,
  PRIORITIES,
  STRATEGIES,
  TicketChannel,
  TicketPriority,
} from './sla.models';
import { SlaUserPickerComponent } from './user-picker.component';

export interface AssignmentRuleDialogData {
  rule: AssignmentRuleResponse | null;
  nextOrder: number;
}

@Component({
  selector: 'app-assignment-rule-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
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
    <h2 mat-dialog-title>{{ (data.rule ? 'sla.assignment.edit' : 'sla.assignment.create') | t }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="crm-form-grid">
          <mat-form-field class="crm-span-all">
            <mat-label>{{ 'sla.fields.name' | t }}</mat-label>
            <input matInput formControlName="name" maxlength="150" cdkFocusInitial />
            <mat-error>{{ form.controls.name | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'sla.fields.order' | t }}</mat-label>
            <input matInput type="number" formControlName="order" />
            <mat-hint>{{ 'sla.assignment.orderHint' | t }}</mat-hint>
            <mat-error>{{ form.controls.order | formError }}</mat-error>
          </mat-form-field>
        </div>
        <div class="checks">
          <mat-slide-toggle formControlName="isActive">{{ 'sla.fields.active' | t }}</mat-slide-toggle>
        </div>

        <h3>{{ 'sla.assignment.conditions' | t }}</h3>
        <p class="crm-muted hint">{{ 'sla.assignment.conditionsHint' | t }}</p>
        <div class="crm-form-grid">
          <mat-form-field>
            <mat-label>{{ 'sla.fields.category' | t }}</mat-label>
            <mat-select formControlName="matchCategoryId">
              <mat-option [value]="null">{{ 'sla.fields.anyCategory' | t }}</mat-option>
              @for (c of lookups.categories(); track c.id) {
                <mat-option [value]="c.id">{{ c.label }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ form.controls.matchCategoryId | formError }}</mat-error>
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
          <mat-form-field>
            <mat-label>{{ 'sla.fields.channel' | t }}</mat-label>
            <mat-select formControlName="matchChannel">
              <mat-option [value]="null">{{ 'sla.fields.anyChannel' | t }}</mat-option>
              @for (c of channels; track c) {
                <mat-option [value]="c">{{ 'sla.channel.' + c | t }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ form.controls.matchChannel | formError }}</mat-error>
          </mat-form-field>
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
          <mat-form-field class="crm-span-all">
            <mat-label>{{ 'sla.fields.keyword' | t }}</mat-label>
            <input matInput formControlName="matchKeyword" maxlength="200" />
            <mat-hint>{{ 'sla.assignment.keywordHint' | t }}</mat-hint>
            <mat-error>{{ form.controls.matchKeyword | formError }}</mat-error>
          </mat-form-field>
        </div>

        <h3>{{ 'sla.assignment.actions' | t }}</h3>
        <div class="crm-form-grid">
          <mat-form-field>
            <mat-label>{{ 'sla.fields.setDepartment' | t }}</mat-label>
            <mat-select formControlName="setDepartmentId">
              <mat-option [value]="null">{{ 'sla.fields.noChange' | t }}</mat-option>
              @for (d of lookups.departments(); track d.id) {
                <mat-option [value]="d.id">{{ d.label }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ form.controls.setDepartmentId | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'sla.fields.setPriority' | t }}</mat-label>
            <mat-select formControlName="setPriority">
              <mat-option [value]="null">{{ 'sla.fields.noChange' | t }}</mat-option>
              @for (p of priorities; track p) {
                <mat-option [value]="p">{{ 'sla.priority.' + p | t }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ form.controls.setPriority | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field class="crm-span-all">
            <mat-label>{{ 'sla.fields.strategy' | t }}</mat-label>
            <mat-select formControlName="strategy">
              @for (s of strategies; track s) {
                <mat-option [value]="s">{{ 'sla.strategy.' + s | t }}</mat-option>
              }
            </mat-select>
            <mat-hint>{{ 'sla.strategyHint.' + form.controls.strategy.value | t }}</mat-hint>
            <mat-error>{{ form.controls.strategy | formError }}</mat-error>
          </mat-form-field>
        </div>
        @if (form.controls.strategy.value === 'SpecificAgent') {
          <app-sla-user-picker [label]="'sla.fields.agent' | t" [(ids)]="agentIds" [error]="agentError()" />
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'core.actions.cancel' | t }}</button>
        <button mat-flat-button type="submit" [disabled]="busy()">{{ 'core.actions.save' | t }}</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class AssignmentRuleDialogComponent {
  readonly data = inject<AssignmentRuleDialogData>(MAT_DIALOG_DATA);
  readonly lookups = inject(SlaLookupsService);
  private readonly api = inject(SlaApi);
  private readonly dialogRef = inject<MatDialogRef<AssignmentRuleDialogComponent, boolean>>(MatDialogRef);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly channels = CHANNELS;
  readonly priorities = PRIORITIES;
  readonly strategies = STRATEGIES;
  readonly busy = signal(false);
  readonly agentIds = signal<readonly string[]>(this.data.rule?.agentId ? [this.data.rule.agentId] : []);
  readonly agentError = signal<string | null>(null);

  readonly form = this.fb.group({
    name: this.fb.control(this.data.rule?.name ?? '', [Validators.required, Validators.maxLength(150)]),
    isActive: this.fb.control(this.data.rule?.isActive ?? true),
    order: this.fb.control<number | null>(this.data.rule?.order ?? this.data.nextOrder, [Validators.required]),
    matchCategoryId: this.fb.control<string | null>(this.data.rule?.matchCategoryId ?? null),
    matchDepartmentId: this.fb.control<string | null>(this.data.rule?.matchDepartmentId ?? null),
    matchChannel: this.fb.control<TicketChannel | null>(this.data.rule?.matchChannel ?? null),
    matchPriority: this.fb.control<TicketPriority | null>(this.data.rule?.matchPriority ?? null),
    matchKeyword: this.fb.control(this.data.rule?.matchKeyword ?? '', [Validators.maxLength(200)]),
    setDepartmentId: this.fb.control<string | null>(this.data.rule?.setDepartmentId ?? null),
    setPriority: this.fb.control<TicketPriority | null>(this.data.rule?.setPriority ?? null),
    strategy: this.fb.control<AssignmentStrategy>(this.data.rule?.strategy ?? 'RoundRobin', [Validators.required]),
  });

  constructor() {
    this.lookups.ensureLoaded();
    this.lookups.rememberName(this.data.rule?.agentId ?? null, this.data.rule?.agentName ?? null);
  }

  save(): void {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const agentId = v.strategy === 'SpecificAgent' ? (this.agentIds()[0] ?? null) : null;
    this.agentError.set(v.strategy === 'SpecificAgent' && !agentId ? this.translations.t('sla.validation.agentRequired') : null);
    if (this.form.invalid || this.agentError() || this.busy()) {
      return;
    }
    const body: AssignmentRuleRequest = {
      name: v.name.trim(),
      isActive: v.isActive,
      order: Math.trunc(v.order ?? 0),
      matchCategoryId: v.matchCategoryId,
      matchDepartmentId: v.matchDepartmentId,
      matchChannel: v.matchChannel,
      matchPriority: v.matchPriority,
      matchKeyword: orNull(v.matchKeyword.trim()),
      setDepartmentId: v.setDepartmentId,
      setPriority: v.setPriority,
      strategy: v.strategy,
      agentId,
    };
    this.busy.set(true);
    this.api.saveAssignmentRule(this.data.rule?.id ?? null, body).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(this.data.rule ? 'core.states.saved' : 'core.states.created');
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        showSaveError(this.form, error, this.toast, this.translations);
      },
    });
  }
}
