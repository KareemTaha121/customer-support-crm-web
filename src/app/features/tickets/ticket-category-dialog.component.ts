import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { FormErrorPipe } from '../../shared/form-error.pipe';
import { applyServerErrors } from '../../shared/form-errors';
import { TicketsApi } from './tickets.api';
import { BranchOption, TICKET_PRIORITIES, TicketCategory, TicketLimits, buildCategoryTree, categoryLabel } from './tickets.models';

export interface TicketCategoryDialogData {
  /** `null` creates a new category. */
  category: TicketCategory | null;
  /** All categories (including inactive) for the parent select. */
  categories: TicketCategory[];
}

/** Create/edit a ticket category (`POST|PUT /ticket-categories`); closes with the saved category. */
@Component({
  selector: 'app-ticket-category-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, MatButtonModule, TranslatePipe, FormErrorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ (data.category ? 'tickets.categories.editTitle' : 'tickets.categories.createTitle') | t }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <div class="crm-form-grid">
          <mat-form-field>
            <mat-label>{{ 'tickets.categories.name' | t }}</mat-label>
            <input matInput formControlName="name" [maxlength]="limit" cdkFocusInitial />
            <mat-error>{{ form.controls.name | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'tickets.categories.nameAr' | t }}</mat-label>
            <input matInput formControlName="nameAr" dir="rtl" lang="ar" [maxlength]="limit" />
            <mat-error>{{ form.controls.nameAr | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'tickets.categories.parent' | t }}</mat-label>
            <mat-select formControlName="parentId">
              <mat-option value="">{{ 'tickets.categories.noParent' | t }}</mat-option>
              @for (option of parentOptions(); track option.id) {
                <mat-option [value]="option.id">
                  <span class="indent" [style.inline-size.px]="option.depth * 16"></span>{{ label(option) }}
                </mat-option>
              }
            </mat-select>
            <mat-error>{{ form.controls.parentId | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'tickets.categories.defaultDepartment' | t }}</mat-label>
            <mat-select formControlName="defaultDepartmentId">
              <mat-option value="">{{ 'core.states.none' | t }}</mat-option>
              @for (branch of branches(); track branch.id) {
                <mat-optgroup [label]="branch.name">
                  @for (department of branch.departments; track department.id) {
                    <mat-option [value]="department.id">{{ department.name }}</mat-option>
                  }
                </mat-optgroup>
              }
            </mat-select>
            <mat-error>{{ form.controls.defaultDepartmentId | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'tickets.categories.defaultPriority' | t }}</mat-label>
            <mat-select formControlName="defaultPriority">
              <mat-option value="">{{ 'core.states.none' | t }}</mat-option>
              @for (priority of priorities; track priority) {
                <mat-option [value]="priority">{{ 'tickets.priority.' + priority | t }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'tickets.categories.sortOrder' | t }}</mat-label>
            <input matInput type="number" formControlName="sortOrder" min="0" step="1" />
            <mat-error>{{ form.controls.sortOrder | formError }}</mat-error>
          </mat-form-field>
          <mat-slide-toggle class="crm-span-all" formControlName="isActive">{{ 'core.states.active' | t }}</mat-slide-toggle>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'core.actions.cancel' | t }}</button>
        <button mat-flat-button type="submit" [disabled]="busy()">{{ 'core.actions.save' | t }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `.indent { display: inline-block; }`,
})
export class TicketCategoryDialog {
  private readonly ref = inject(MatDialogRef<TicketCategoryDialog, TicketCategory>);
  private readonly api = inject(TicketsApi);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  readonly data = inject<TicketCategoryDialogData>(MAT_DIALOG_DATA);

  readonly limit = TicketLimits.categoryName;
  readonly priorities = TICKET_PRIORITIES;
  readonly busy = signal(false);
  readonly branches = signal<BranchOption[]>([]);

  /** Every category except the edited one and its descendants (prevents cycles). */
  readonly parentOptions = computed(() => {
    const self = this.data.category?.id;
    if (!self) {
      return buildCategoryTree(this.data.categories);
    }
    const excluded = new Set<string>([self]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const category of this.data.categories) {
        if (category.parentId && excluded.has(category.parentId) && !excluded.has(category.id)) {
          excluded.add(category.id);
          grew = true;
        }
      }
    }
    return buildCategoryTree(this.data.categories.filter((c) => !excluded.has(c.id)));
  });

  readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data.category?.name ?? '', [Validators.required, Validators.maxLength(TicketLimits.categoryName)]],
    nameAr: [this.data.category?.nameAr ?? '', Validators.maxLength(TicketLimits.categoryName)],
    parentId: [this.data.category?.parentId ?? ''],
    defaultDepartmentId: [this.data.category?.defaultDepartmentId ?? ''],
    defaultPriority: [this.data.category?.defaultPriority ?? ''],
    sortOrder: [this.data.category?.sortOrder ?? 0, [Validators.required, Validators.min(0)]],
    isActive: [this.data.category?.isActive ?? true],
  });

  constructor() {
    this.api.branches().subscribe({ next: (items) => this.branches.set(items), error: () => undefined });
  }

  label(category: TicketCategory): string {
    return categoryLabel(category, this.translations.language());
  }

  submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.busy.set(true);
    this.api
      .saveCategory(this.data.category?.id ?? null, {
        name: value.name.trim(),
        nameAr: value.nameAr.trim() || null,
        parentId: value.parentId || null,
        defaultDepartmentId: value.defaultDepartmentId || null,
        defaultPriority: value.defaultPriority || null,
        sortOrder: Number(value.sortOrder) || 0,
        isActive: value.isActive,
      })
      .subscribe({
        next: (category) => {
          this.busy.set(false);
          this.ref.close(category);
        },
        error: (error: unknown) => {
          this.busy.set(false);
          const apiError = ApiError.from(error);
          const unmatched = applyServerErrors(this.form, apiError);
          if (!apiError.isValidation || unmatched.length) {
            this.toast.error(unmatched[0] ?? describeError(apiError, this.translations));
          }
        },
      });
  }
}
