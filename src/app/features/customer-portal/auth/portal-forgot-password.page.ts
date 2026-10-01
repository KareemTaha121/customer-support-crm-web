import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../../core/http/api-error';
import { ApiService } from '../../../core/http/api.service';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { applyServerErrors } from '../../../shared/form-errors';

/** `/portal/forgot-password`: request a reset link (POST /public/portal/forgot-password). The answer never says whether the address exists. */
@Component({
  selector: 'app-portal-forgot-password-page',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, RouterLink, TranslatePipe, FormErrorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="crm-card portal-auth">
      <h1>{{ 'portal.auth.forgotTitle' | t }}</h1>
      @if (sent()) {
        <div class="portal-auth__info" role="status">{{ 'portal.auth.resetLinkSent' | t }}</div>
      } @else {
        <p class="crm-muted">{{ 'portal.auth.forgotSubtitle' | t }}</p>
        @if (error()) {
          <div class="portal-auth__error" role="alert">{{ error() }}</div>
        }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field>
            <mat-label>{{ 'portal.fields.email' | t }}</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="username" />
            <mat-error>{{ form.controls.email | formError }}</mat-error>
          </mat-form-field>
          <button mat-flat-button type="submit" [disabled]="busy()">{{ 'portal.auth.sendResetLink' | t }}</button>
        </form>
      }
      <div class="portal-auth__links">
        <a mat-button routerLink="/portal/login">{{ 'portal.auth.backToLogin' | t }}</a>
      </div>
    </section>
  `,
  styleUrl: './portal-auth.scss',
})
export class PortalForgotPasswordPage {
  private readonly api = inject(ApiService);
  private readonly translations = inject(TranslationService);

  readonly busy = signal(false);
  readonly sent = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
  });

  submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.api.post<null>('/public/portal/forgot-password', { email: this.form.getRawValue().email.trim() }, { anonymous: true, silent: true }).subscribe({
      next: () => {
        this.busy.set(false);
        this.sent.set(true);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const apiError = ApiError.from(error);
        const unmatched = applyServerErrors(this.form, apiError);
        if (!apiError.isValidation || unmatched.length) {
          this.error.set(unmatched[0] ?? describeError(apiError, this.translations));
        }
      },
    });
  }
}
