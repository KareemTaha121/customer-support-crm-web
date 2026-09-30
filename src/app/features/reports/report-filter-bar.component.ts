import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { MAX_RANGE_DAYS, ReportFilterStore } from './report-filter.store';
import { DepartmentOption, ReportGroupBy } from './reports.models';

interface DepartmentChoice {
  id: string;
  label: string;
}

/**
 * Filters shared by all reports (bound to {@link ReportFilterStore}). Projected content = actions (export).
 * `<app-report-filter-bar [showGroupBy]="true"><app-report-export-button kind="..." /></app-report-filter-bar>`
 */
@Component({
  selector: 'app-report-filter-bar',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatDatepickerModule, MatSelectModule, MatButtonModule, MatIconModule, TranslatePipe],
  providers: [provideNativeDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="filters crm-card" [attr.aria-label]="'reports.filters.title' | t">
      @if (showRange()) {
        <mat-form-field class="filters__range">
          <mat-label>{{ 'reports.filters.range' | t }}</mat-label>
          <mat-date-range-input [formGroup]="range" [rangePicker]="picker">
            <input matStartDate formControlName="start" [placeholder]="'reports.filters.from' | t" />
            <input matEndDate formControlName="end" [placeholder]="'reports.filters.to' | t" />
          </mat-date-range-input>
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-date-range-picker #picker />
          @if (store.rangeError(); as error) {
            <mat-hint class="filters__error" role="alert">{{ 'reports.filters.errors.' + error | t: { max: maxDays } }}</mat-hint>
          }
        </mat-form-field>
      }

      @if (showGroupBy()) {
        <mat-form-field class="filters__small">
          <mat-label>{{ 'reports.filters.groupBy' | t }}</mat-label>
          <mat-select [value]="store.value().groupBy" (valueChange)="setGroupBy($event)">
            @for (option of groupByOptions; track option) {
              <mat-option [value]="option">{{ 'reports.filters.groupByOptions.' + option | t }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }

      <mat-form-field class="filters__small">
        <mat-label>{{ 'reports.filters.branch' | t }}</mat-label>
        <mat-select [value]="store.value().branchId" (valueChange)="setBranch($event)">
          <mat-option [value]="null">{{ 'reports.filters.allBranches' | t }}</mat-option>
          @for (branch of store.branches(); track branch.id) {
            <mat-option [value]="branch.id">{{ branch.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field class="filters__small">
        <mat-label>{{ 'reports.filters.department' | t }}</mat-label>
        <mat-select [value]="store.value().departmentId" (valueChange)="setDepartment($event)">
          <mat-option [value]="null">{{ 'reports.filters.allDepartments' | t }}</mat-option>
          @for (department of departments(); track department.id) {
            <mat-option [value]="department.id">{{ department.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <button mat-button type="button" (click)="reset()">
        <mat-icon>restart_alt</mat-icon>
        {{ 'core.actions.reset' | t }}
      </button>

      <span class="crm-spacer"></span>
      <div class="filters__actions"><ng-content /></div>
    </section>
    @if (note()) {
      <p class="filters__note crm-muted">{{ note() }}</p>
    }
  `,
  styles: `
    .filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-block-end: var(--crm-gap); }
    .filters__range { flex: 1 1 280px; max-width: 340px; }
    .filters__small { flex: 1 1 160px; max-width: 220px; }
    .filters__error { color: var(--mat-sys-error); }
    .filters__actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .filters__note { margin: calc(var(--crm-gap) * -0.5) 0 var(--crm-gap); font: var(--mat-sys-body-small); }
    @media (max-width: 599px) { .filters__range, .filters__small { max-width: none; flex-basis: 100%; } }
  `,
})
export class ReportFilterBarComponent {
  protected readonly store = inject(ReportFilterStore);
  private readonly translations = inject(TranslationService);
  private readonly dateAdapter = inject<DateAdapter<Date>>(DateAdapter);

  /** Hide the range for reports with fixed windows (management dashboard). */
  readonly showRange = input(true);
  readonly showGroupBy = input(false);
  /** Optional hint under the bar. */
  readonly note = input<string | null>(null);

  protected readonly maxDays = MAX_RANGE_DAYS;
  protected readonly groupByOptions: readonly ReportGroupBy[] = ['day', 'week', 'month'];

  protected readonly range = inject(NonNullableFormBuilder).group({
    start: this.store.value().from as Date | null,
    end: this.store.value().to as Date | null,
  });

  protected readonly departments = computed<DepartmentChoice[]>(() => {
    const branchId = this.store.value().branchId;
    const branches = this.store.branches();
    const scoped = branchId ? branches.filter((b) => b.id === branchId) : branches;
    const showBranch = !branchId && branches.length > 1;
    return scoped.flatMap((branch) =>
      branch.departments
        .filter((d: DepartmentOption) => d.isActive)
        .map((d) => ({ id: d.id, label: showBranch ? `${d.name} — ${branch.name}` : d.name })),
    );
  });

  constructor() {
    this.store.loadBranches();

    effect(() => {
      this.dateAdapter.setLocale(this.translations.language() === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB');
    });

    // Store -> form (reset, other tabs).
    effect(() => {
      const { from, to } = this.store.value();
      const current = this.range.getRawValue();
      if (current.start?.getTime() !== from.getTime() || current.end?.getTime() !== to.getTime()) {
        this.range.setValue({ start: from, end: to }, { emitEvent: false });
      }
    });

    // Form -> store, only once both ends are picked.
    this.range.valueChanges.pipe(takeUntilDestroyed()).subscribe(({ start, end }) => {
      if (start && end) {
        this.store.update({ from: start, to: end });
      }
    });
  }

  protected setGroupBy(groupBy: ReportGroupBy): void {
    this.store.update({ groupBy });
  }

  protected setBranch(branchId: string | null): void {
    const departmentId = this.store.value().departmentId;
    const keepDepartment =
      !!departmentId && !!branchId && !!this.store.branches().find((b) => b.id === branchId)?.departments.some((d) => d.id === departmentId);
    this.store.update({ branchId, departmentId: keepDepartment ? departmentId : null });
  }

  protected setDepartment(departmentId: string | null): void {
    this.store.update({ departmentId });
  }

  protected reset(): void {
    this.store.reset();
  }
}
