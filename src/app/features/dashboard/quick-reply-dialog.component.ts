import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { HasPermissionDirective } from '../../core/permissions/has-permission.directive';
import { FormErrorPipe } from '../../shared/form-error.pipe';
import { applyServerErrors } from '../../shared/form-errors';
import { DashboardApi, stripFieldPrefix } from './dashboard.api';
import {
  QUICK_REPLY_BODY_MAX,
  QUICK_REPLY_SHORTCUT_MAX,
  QUICK_REPLY_TITLE_MAX,
  QuickReply,
  QuickReplyLanguage,
  QuickReplyRequest,
} from './dashboard.models';

export interface QuickReplyDialogData {
  reply: QuickReply | null;
}

/** Placeholders the render endpoint fills (AgentWorkspaceSlices.cs `RenderQuickReplyQuery`). */
const PLACEHOLDERS = ['{{customer.name}}', '{{customer.number}}', '{{ticket.number}}', '{{ticket.subject}}', '{{agent.name}}'];

/** Create/edit a quick reply. Shared replies require quickreplies.manage (checked by the API too). */
@Component({
  selector: 'app-quick-reply-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatProgressBarModule,
    TranslatePipe,
    FormErrorPipe,
    HasPermissionDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ (data.reply ? 'dashboard.quickReplies.editTitle' : 'dashboard.quickReplies.createTitle') | t }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        @if (busy()) {
          <mat-progress-bar mode="indeterminate" />
        }
        <div class="crm-form-grid">
          <mat-form-field class="crm-span-all">
            <mat-label>{{ 'dashboard.quickReplies.fields.title' | t }}</mat-label>
            <input matInput formControlName="title" [maxlength]="titleMax" cdkFocusInitial />
            <mat-error>{{ form.controls.title | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'dashboard.quickReplies.fields.shortcut' | t }}</mat-label>
            <input matInput formControlName="shortcut" [maxlength]="shortcutMax + 1" dir="ltr" placeholder="/thanks" />
            <mat-hint>{{ 'dashboard.quickReplies.fields.shortcutHint' | t }}</mat-hint>
            <mat-error>{{ form.controls.shortcut | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'dashboard.quickReplies.fields.language' | t }}</mat-label>
            <mat-select formControlName="language">
              <mat-option value="en">{{ 'dashboard.quickReplies.languages.en' | t }}</mat-option>
              <mat-option value="ar">{{ 'dashboard.quickReplies.languages.ar' | t }}</mat-option>
            </mat-select>
            <mat-error>{{ form.controls.language | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field class="crm-span-all">
            <mat-label>{{ 'dashboard.quickReplies.fields.body' | t }}</mat-label>
            <textarea matInput formControlName="body" rows="6" [maxlength]="bodyMax"></textarea>
            <mat-hint>{{ 'dashboard.quickReplies.fields.bodyHint' | t }}</mat-hint>
            <mat-error>{{ form.controls.body | formError }}</mat-error>
          </mat-form-field>
          <div class="crm-span-all placeholders">
            @for (placeholder of placeholders; track placeholder) {
              <button mat-stroked-button type="button" (click)="insertPlaceholder(placeholder)" dir="ltr">{{ placeholder }}</button>
            }
          </div>
          <div class="crm-span-all" *appHasPermission="'quickreplies.manage'">
            <mat-slide-toggle formControlName="shared">{{ 'dashboard.quickReplies.fields.shared' | t }}</mat-slide-toggle>
            <p class="crm-muted hint">
              {{ (data.reply ? 'dashboard.quickReplies.fields.sharedLocked' : 'dashboard.quickReplies.fields.sharedHint') | t }}
            </p>
          </div>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'core.actions.cancel' | t }}</button>
        <button mat-flat-button type="submit" [disabled]="busy()">{{ 'core.actions.save' | t }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .placeholders { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 8px; }
    .placeholders button { font-family: monospace; }
    .hint { margin: 4px 0 0; font: var(--mat-sys-body-small); }
    mat-progress-bar { margin-bottom: 8px; }
  `,
})
export class QuickReplyDialogComponent {
  readonly data = inject<QuickReplyDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<QuickReplyDialogComponent, QuickReply>);
  private readonly api = inject(DashboardApi);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly titleMax = QUICK_REPLY_TITLE_MAX;
  readonly shortcutMax = QUICK_REPLY_SHORTCUT_MAX;
  readonly bodyMax = QUICK_REPLY_BODY_MAX;
  readonly placeholders = PLACEHOLDERS;
  readonly busy = signal(false);

  readonly form = inject(NonNullableFormBuilder).group({
    title: [this.data.reply?.title ?? '', [Validators.required, Validators.maxLength(QUICK_REPLY_TITLE_MAX)]],
    shortcut: [
      this.data.reply?.shortcut?.toLowerCase() ?? '',
      [Validators.maxLength(QUICK_REPLY_SHORTCUT_MAX + 1), Validators.pattern(/^\/?[A-Za-z0-9_-]+$/)],
    ],
    body: [this.data.reply?.body ?? '', [Validators.required, Validators.maxLength(QUICK_REPLY_BODY_MAX)]],
    language: [(this.data.reply?.language ?? this.translations.language()) as QuickReplyLanguage, Validators.required],
    shared: [{ value: this.data.reply?.shared ?? false, disabled: !!this.data.reply }],
  });

  insertPlaceholder(placeholder: string): void {
    const control = this.form.controls.body;
    const current = control.value;
    control.setValue(current && !current.endsWith(' ') && !current.endsWith('\n') ? `${current} ${placeholder}` : current + placeholder);
    control.markAsDirty();
  }

  save(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const request: QuickReplyRequest = {
      title: value.title.trim(),
      shortcut: value.shortcut.trim() || null,
      body: value.body,
      language: value.language,
      categoryId: this.data.reply?.categoryId ?? null,
      shared: value.shared,
    };
    this.busy.set(true);
    const call = this.data.reply ? this.api.updateQuickReply(this.data.reply.id, request) : this.api.createQuickReply(request);
    call.subscribe({
      next: (reply) => {
        this.busy.set(false);
        this.toast.success(this.data.reply ? 'core.states.saved' : 'core.states.created');
        this.dialogRef.close(reply);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const apiError = ApiError.from(error);
        const unmatched = applyServerErrors(this.form, stripFieldPrefix(apiError, 'reply'));
        if (!apiError.isValidation || unmatched.length) {
          this.toast.error(unmatched[0] ?? describeError(apiError, this.translations));
        }
      },
    });
  }
}
