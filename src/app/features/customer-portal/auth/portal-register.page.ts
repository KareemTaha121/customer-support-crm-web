import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { PortalAuthService } from '../../../core/auth/portal-auth.service';
import { BrandingService } from '../../../core/branding/branding.service';
import { FeatureFlags } from '../../../core/branding/feature-flags';
import { ApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { applyServerErrors } from '../../../shared/form-errors';
import { matchFields, passwordValidators } from '../../../shared/password';

/** Customer self-registration (POST /public/portal/register), then email verification. */
@Component({
  selector: 'app-portal-register-page',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, RouterLink, TranslatePipe, FormErrorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="crm-card portal-auth">
      <h1>{{ 'portal.auth.registerTitle' | t }}</h1>
      @if (!enabled()) {
        <div class="portal-auth__info">{{ 'portal.auth.registrationDisabled' | t }}</div>
        <a mat-button routerLink="/portal/login">{{ 'portal.auth.backToLogin' | t }}</a>
      } @else {
        <p class="crm-muted">{{ 'portal.auth.registerSubtitle' | t }}</p>
        @if (error()) {
          <div class="portal-auth__error" role="alert">{{ error() }}</div>
        }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field>
            <mat-label>{{ 'portal.fields.name' | t }}</mat-label>
            <input matInput formControlName="name" autocomplete="name" />
            <mat-error>{{ form.controls.name | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'portal.fields.email' | t }}</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="email" />
            <mat-error>{{ form.controls.email | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'portal.fields.phone' | t }}</mat-label>
            <input matInput type="tel" formControlName="phone" autocomplete="tel" dir="ltr" placeholder="+9665XXXXXXXX" />
            <mat-error>{{ form.controls.phone | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'portal.fields.language' | t }}</mat-label>
            <mat-select formControlName="language">
              <mat-option value="en">English</mat-option>
              <mat-option value="ar">العربية</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'portal.fields.password' | t }}</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" />
            <mat-hint>{{ 'portal.auth.passwordHint' | t }}</mat-hint>
            <mat-error>{{ form.controls.password | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'portal.fields.confirmPassword' | t }}</mat-label>
            <input matInput type="password" formControlName="confirmPassword" autocomplete="new-password" />
            <mat-error>{{ form.controls.confirmPassword | formError }}</mat-error>
          </mat-form-field>
          <button mat-flat-button type="submit" [disabled]="busy()">{{ 'portal.auth.register' | t }}</button>
        </form>
        <div class="portal-auth__links">
          <a routerLink="/portal/login">{{ 'portal.auth.haveAccount' | t }}</a>
        </div>
      }
    </section>
  `,
  styleUrl: './portal-auth.scss',
})
export class PortalRegisterPage {
  private readonly portal = inject(PortalAuthService);
  private readonly router = inject(Router);
  private readonly translations = inject(TranslationService);
  private readonly branding = inject(BrandingService);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly enabled = () => this.branding.isEnabled(FeatureFlags.portalRegistration);

  readonly form = inject(NonNullableFormBuilder).group(
    {
      name: ['', [Validators.required, Validators.maxLength(200)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
      phone: ['', [Validators.pattern(/^\+?[1-9]\d{6,14}$/)]],
      language: [this.translations.language() as string],
      password: ['', passwordValidators],
      confirmPassword: ['', Validators.required],
    },
    { validators: matchFields('password', 'confirmPassword') },
  );

  submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, email, phone, language, password } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.portal.register({ name, email, password, phone: phone || null, language }).subscribe({
      next: () => void this.router.navigate(['/portal/verify'], { queryParams: { email } }),
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
