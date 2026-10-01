import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BrandingService } from '../../core/branding/branding.service';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { LanguageSwitcherComponent } from '../../core/layout/language-switcher.component';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { FormErrorPipe } from '../../shared/form-error.pipe';
import { applyServerErrors } from '../../shared/form-errors';
import { matchFields, passwordValidators } from '../../shared/password';
import { PasswordResetApi } from './password-reset.api';

const INVALID_RESET_TOKEN = 'INVALID_RESET_TOKEN';

/**
 * `/login/reset-password?token=…`: set a new password from the emailed link. The token is read once
 * and removed from the address bar, so it stays out of history and the Referer header.
 */
@Component({
  selector: 'app-reset-password-page',
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
        <h1>{{ 'auth.reset.title' | t }}</h1>

        @if (done()) {
          <div class="auth-card__info" role="status">{{ 'auth.reset.done' | t }}</div>
          <a mat-flat-button routerLink="/login" class="auth-card__submit">{{ 'auth.reset.signIn' | t }}</a>
        } @else if (invalidToken()) {
          <div class="auth-card__error" role="alert"><mat-icon>error_outline</mat-icon><span>{{ 'auth.errors.invalidResetToken' | t }}</span></div>
          <a mat-flat-button routerLink="/login/forgot-password" class="auth-card__submit">{{ 'auth.reset.requestNew' | t }}</a>
        } @else {
          <p class="crm-muted">{{ 'auth.reset.subtitle' | t }}</p>
          @if (error()) {
            <div class="auth-card__error" role="alert"><mat-icon>error_outline</mat-icon><span>{{ error() }}</span></div>
          }
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <mat-form-field>
              <mat-label>{{ 'auth.fields.newPassword' | t }}</mat-label>
              <input matInput type="password" formControlName="newPassword" autocomplete="new-password" required />
              <mat-icon matPrefix>lock</mat-icon>
              <mat-error>{{ form.controls.newPassword | formError }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'auth.fields.confirmPassword' | t }}</mat-label>
              <input matInput type="password" formControlName="confirmPassword" autocomplete="new-password" required />
              <mat-icon matPrefix>lock</mat-icon>
              <mat-error>{{ form.controls.confirmPassword | formError }}</mat-error>
            </mat-form-field>
            <button mat-flat-button type="submit" class="auth-card__submit" [disabled]="busy()">{{ 'auth.reset.submit' | t }}</button>
          </form>
        }

        <p class="auth-card__footer"><a routerLink="/login">{{ 'auth.forgot.backToLogin' | t }}</a></p>
      </section>
    </div>
  `,
})
export class ResetPasswordPage {
  private readonly api = inject(PasswordResetApi);
  private readonly translations = inject(TranslationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly branding = inject(BrandingService);

  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  readonly busy = signal(false);
  readonly done = signal(false);
  readonly invalidToken = signal(!this.token);
  readonly error = signal<string | null>(null);

  readonly form = inject(NonNullableFormBuilder).group(
    {
      newPassword: ['', passwordValidators],
      confirmPassword: ['', Validators.required],
    },
    { validators: matchFields('newPassword', 'confirmPassword') },
  );

  constructor() {
    if (this.token) {
      void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
  }

  submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.api.reset(this.token, this.form.getRawValue().newPassword).subscribe({
      next: () => {
        this.busy.set(false);
        this.done.set(true);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const apiError = ApiError.from(error);
        if (apiError.hasCode(INVALID_RESET_TOKEN)) {
          this.invalidToken.set(true);
          return;
        }
        if (apiError.isValidation) {
          applyServerErrors(this.form, apiError);
          return;
        }
        this.error.set(describeError(apiError, this.translations));
      },
    });
  }
}
