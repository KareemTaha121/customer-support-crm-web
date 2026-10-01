import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PortalAuthService } from '../../../core/auth/portal-auth.service';
import { BrandingService } from '../../../core/branding/branding.service';
import { FeatureFlags } from '../../../core/branding/feature-flags';
import { ApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { applyServerErrors } from '../../../shared/form-errors';

/** Customer sign-in (POST /public/portal/login). */
@Component({
  selector: 'app-portal-login-page',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, RouterLink, TranslatePipe, FormErrorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="crm-card portal-auth">
      <h1>{{ 'portal.auth.loginTitle' | t }}</h1>
      <p class="crm-muted">{{ 'portal.auth.loginSubtitle' | t }}</p>
      @if (error()) {
        <div class="portal-auth__error" role="alert">{{ error() }}</div>
      }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <mat-form-field>
          <mat-label>{{ 'portal.fields.email' | t }}</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="username" />
          <mat-error>{{ form.controls.email | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'portal.fields.password' | t }}</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="current-password" />
          <mat-error>{{ form.controls.password | formError }}</mat-error>
        </mat-form-field>
        <button mat-flat-button type="submit" [disabled]="busy()">{{ 'portal.auth.login' | t }}</button>
      </form>
      <div class="portal-auth__links">
        @if (registrationEnabled()) {
          <a routerLink="/portal/register">{{ 'portal.auth.noAccount' | t }}</a>
        }
        <a routerLink="/portal/forgot-password">{{ 'portal.auth.forgotPassword' | t }}</a>
        <a routerLink="/portal/verify">{{ 'portal.auth.haveCode' | t }}</a>
      </div>
    </section>
  `,
  styleUrl: './portal-auth.scss',
})
export class PortalLoginPage {
  private readonly portal = inject(PortalAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translations = inject(TranslationService);
  private readonly branding = inject(BrandingService);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly registrationEnabled = () => this.branding.isEnabled(FeatureFlags.portalRegistration);

  readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.portal.login(email, password).subscribe({
      next: (profile) => {
        void this.translations.setLanguage(profile.language === 'ar' ? 'ar' : 'en');
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(returnUrl?.startsWith('/portal') ? returnUrl : '/portal');
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const apiError = ApiError.from(error);
        if (apiError.isValidation) {
          applyServerErrors(this.form, apiError);
        } else if (apiError.status === 401) {
          this.error.set(this.translations.t('portal.auth.invalidCredentials'));
        } else {
          this.error.set(describeError(apiError, this.translations));
        }
      },
    });
  }
}
