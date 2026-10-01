import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthErrorCodes } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { BrandingService } from '../../core/branding/branding.service';
import { ApiError } from '../../core/http/api-error';
import { LanguageSwitcherComponent } from '../../core/layout/language-switcher.component';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { describeError } from '../../core/interceptors/error.interceptor';
import { FormErrorPipe } from '../../shared/form-error.pipe';
import { applyServerErrors } from '../../shared/form-errors';

/** Staff sign-in (POST /auth/login). The refresh cookie keeps the session across reloads. */
@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TranslatePipe,
    FormErrorPipe,
    LanguageSwitcherComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.page.html',
  styleUrl: './auth-pages.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translations = inject(TranslationService);
  readonly branding = inject(BrandingService);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly hidePassword = signal(true);

  readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });

  submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/dashboard');
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const apiError = ApiError.from(error);
        if (apiError.isValidation) {
          applyServerErrors(this.form, apiError);
          return;
        }
        this.error.set(this.messageFor(apiError));
      },
    });
  }

  private messageFor(error: ApiError): string {
    if (error.hasCode(AuthErrorCodes.accountLocked)) {
      return this.translations.t('auth.errors.accountLocked');
    }
    if (error.hasCode(AuthErrorCodes.accountDisabled)) {
      return this.translations.t('auth.errors.accountDisabled');
    }
    if (error.hasCode(AuthErrorCodes.invalidCredentials)) {
      return this.translations.t('auth.errors.invalidCredentials');
    }
    return describeError(error, this.translations);
  }
}
