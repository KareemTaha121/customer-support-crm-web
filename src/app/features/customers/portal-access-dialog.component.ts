import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ApiError } from '../../core/http/api-error';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { FormErrorPipe } from '../../shared/form-error.pipe';
import { PASSWORD_MIN_LENGTH, passwordValidators } from '../../shared/password';
import { reportFormError } from './customer-errors';
import { CustomersApi } from './customers.api';
import { CustomerErrorCodes } from './customers.models';

export interface PortalAccessDialogData {
  customerId: string;
  /** Prefill (the customer's primary email). */
  email: string;
}

/** Grant portal access: POST /customers/{id}/portal-access. Closes with `true` on success. */
@Component({
  selector: 'app-portal-access-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, TranslatePipe, FormErrorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'customers.portal.grantTitle' | t }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <p class="crm-muted">{{ 'customers.portal.grantHint' | t }}</p>
        <mat-form-field>
          <mat-label>{{ 'customers.portal.email' | t }}</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="off" />
          <mat-error>{{ form.controls.email | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'customers.portal.password' | t }}</mat-label>
          <input matInput [type]="showPassword() ? 'text' : 'password'" formControlName="password" autocomplete="new-password" />
          <button
            mat-icon-button
            matSuffix
            type="button"
            (click)="showPassword.set(!showPassword())"
            [attr.aria-label]="(showPassword() ? 'customers.portal.hidePassword' : 'customers.portal.showPassword') | t"
          >
            <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          <mat-hint>{{ 'customers.portal.passwordHint' | t: { min: minLength } }}</mat-hint>
          <mat-error>{{ form.controls.password | formError }}</mat-error>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'core.actions.cancel' | t }}</button>
        <button mat-flat-button type="submit" [disabled]="saving()">{{ 'customers.portal.grant' | t }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-dialog-content { display: flex; flex-direction: column; gap: 4px; }
    p { margin: 0 0 8px; }
  `,
})
export class PortalAccessDialogComponent {
  readonly data = inject<PortalAccessDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<PortalAccessDialogComponent, boolean>>(MatDialogRef);
  private readonly api = inject(CustomersApi);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly minLength = PASSWORD_MIN_LENGTH;
  readonly saving = signal(false);
  readonly showPassword = signal(false);

  readonly form = inject(NonNullableFormBuilder).group({
    email: [this.data.email, [Validators.required, Validators.email]],
    password: ['', passwordValidators],
  });

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.saving.set(true);
    this.api.grantPortalAccess(this.data.customerId, { email: email.trim(), password }).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const apiError = ApiError.from(error);
        if (apiError.hasCode(CustomerErrorCodes.portalAccountExists)) {
          this.form.controls.email.setErrors({ server: this.translations.t('customers.portal.accountExists') });
          return;
        }
        reportFormError(this.form, apiError, this.toast, this.translations);
      },
    });
  }
}
