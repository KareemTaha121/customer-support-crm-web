import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { BrandingService } from '../../core/branding/branding.service';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { LanguageSwitcherComponent } from '../../core/layout/language-switcher.component';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { FormErrorPipe } from '../../shared/form-error.pipe';
import { applyServerErrors } from '../../shared/form-errors';
import { PasswordResetApi } from './password-reset.api';

/** `/login/forgot-password`: request a reset link by email. The answer never says whether the address exists. */
@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressBarModule, TranslatePipe, FormErrorPipe, LanguageSwitcherComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-pages.scss',
  template: `
    <div class="auth-page">
      <div class="auth-page__lang"><app-language-switcher /></div>
      <section class="auth-card crm-card">
        @if (busy()) {
          <mat-progress-bar mode="indeterminate" class="auth-card__progress" />
        }
        <div class="auth-card__brand">
          @if (branding.logoSrc(); as logo) {
            <img [src]="logo" alt="" />
          } @else {
            <mat-icon>support_agent</mat-icon>
          }
          <span>{{ branding.branding().name }}</span>
        </div>
        <h1>{{ 'auth.forgot.title' | t }}</h1>

        @if (sent()) {
          <div class="auth-card__info" role="status">{{ 'auth.forgot.sent' | t }}</div>
        } @else {
          <p class="crm-muted">{{ 'auth.forgot.subtitle' | t }}</p>
          @if (error()) {
            <div class="auth-card__error" role="alert"><mat-icon>error_outline</mat-icon><span>{{ error() }}</span></div>
          }
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <mat-form-field>
              <mat-label>{{ 'auth.fields.email' | t }}</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="username" required />
              <mat-icon matPrefix>mail</mat-icon>
              <mat-error>{{ form.controls.email | formError }}</mat-error>
            </mat-form-field>
            <button mat-flat-button type="submit" class="auth-card__submit" [disabled]="busy()">{{ 'auth.forgot.submit' | t }}</button>
          </form>
        }

        <p class="auth-card__footer"><a routerLink="/login">{{ 'auth.forgot.backToLogin' | t }}</a></p>
      </section>
    </div>
  `,
})
export class ForgotPasswordPage {
  private readonly api = inject(PasswordResetApi);
  private readonly translations = inject(TranslationService);
  readonly branding = inject(BrandingService);

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
    this.api.forgot(this.form.getRawValue().email.trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.sent.set(true);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const apiError = ApiError.from(error);
        if (apiError.isValidation) {
          applyServerErrors(this.form, apiError);
          return;
        }
        this.error.set(describeError(apiError, this.translations));
      },
    });
  }
}
