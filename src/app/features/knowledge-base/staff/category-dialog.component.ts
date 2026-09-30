import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { applyKbServerErrors } from '../kb-server-errors';
import { KnowledgeBaseApi } from '../knowledge-base.api';
import { KbCategory, categoryLabel } from '../knowledge-base.models';

export interface CategoryDialogData {
  category: KbCategory | null;
  categories: KbCategory[];
}

/** Create/edit a knowledge base category. Closes with the saved category. */
@Component({
  selector: 'app-kb-category-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, TranslatePipe, FormErrorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ (data.category ? 'kb.categories.editTitle' : 'kb.categories.newTitle') | t }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="fields">
          <mat-form-field>
            <mat-label>{{ 'kb.categories.name' | t }}</mat-label>
            <input matInput formControlName="name" maxlength="150" dir="ltr" cdkFocusInitial />
            <mat-error>{{ form.controls.name | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'kb.categories.nameAr' | t }}</mat-label>
            <input matInput formControlName="nameAr" maxlength="150" dir="rtl" lang="ar" />
            <mat-error>{{ form.controls.nameAr | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'core.fields.description' | t }}</mat-label>
            <textarea matInput formControlName="description" rows="3" maxlength="1000" dir="auto"></textarea>
            <mat-error>{{ form.controls.description | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'kb.categories.parent' | t }}</mat-label>
            <mat-select formControlName="parentId">
              <mat-option value="">{{ 'kb.categories.noParent' | t }}</mat-option>
              @for (option of parents; track option.id) {
                <mat-option [value]="option.id">{{ label(option) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'kb.categories.sortOrder' | t }}</mat-label>
            <input matInput type="number" formControlName="sortOrder" />
            <mat-error>{{ form.controls.sortOrder | formError }}</mat-error>
          </mat-form-field>
          <mat-slide-toggle formControlName="isPublic">{{ 'kb.categories.isPublic' | t }}</mat-slide-toggle>
          <p class="crm-muted hint">{{ 'kb.categories.isPublicHint' | t }}</p>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'core.actions.cancel' | t }}</button>
        <button mat-flat-button type="submit" [disabled]="saving()">{{ 'core.actions.save' | t }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .fields { display: flex; flex-direction: column; gap: 4px; padding-top: 4px; }
    .hint { margin: 0; font: var(--mat-sys-body-small); }
  `,
})
export class CategoryDialogComponent {
  readonly data = inject<CategoryDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CategoryDialogComponent, KbCategory>>(MatDialogRef);
  private readonly api = inject(KnowledgeBaseApi);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly saving = signal(false);
  /** Any category except this one (the API rejects a category as its own parent). */
  readonly parents = this.data.categories.filter((c) => c.id !== this.data.category?.id);

  readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data.category?.name ?? '', [Validators.required, Validators.maxLength(150)]],
    nameAr: [this.data.category?.nameAr ?? '', Validators.maxLength(150)],
    description: [this.data.category?.description ?? '', Validators.maxLength(1000)],
    parentId: [this.data.category?.parentId ?? ''],
    sortOrder: [this.data.category?.sortOrder ?? 0, Validators.required],
    isPublic: [this.data.category?.isPublic ?? true],
  });

  label(category: KbCategory): string {
    return categoryLabel(category, this.translations.language());
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .saveCategory(
        this.data.category?.id ?? null,
        {
          name: value.name.trim(),
          nameAr: value.nameAr.trim() || null,
          description: value.description.trim() || null,
          parentId: value.parentId || null,
          sortOrder: Number(value.sortOrder) || 0,
          isPublic: value.isPublic,
        },
        { silent: true },
      )
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.dialogRef.close(saved);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          const apiError = ApiError.from(error);
          const unmatched = applyKbServerErrors(this.form, apiError, 'category');
          if (!apiError.isValidation || unmatched.length) {
            this.toast.error(unmatched[0] ?? describeError(apiError, this.translations));
          }
        },
      });
  }
}
