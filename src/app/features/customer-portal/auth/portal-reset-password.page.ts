import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../../core/http/api-error';
import { ApiService } from '../../../core/http/api.service';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { applyServerErrors } from '../../../shared/form-errors';
import { matchFields, passwordValidators } from '../../../shared/password';

const INVALID_RESET_TOKEN = 'INVALID_RESET_TOKEN';

/**
 * `/portal/reset-password?token=…` (POST /public/portal/reset-password). The token is read once and
 * removed from the address bar. Portal sessions signed in before the reset stop working.
 */
@Component({
  selector: 'app-portal-reset-password-page',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, RouterLink, TranslatePipe, FormErrorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="crm-card portal-auth">
      <h1>{{ 'portal.auth.resetTitle' | t }}</h1>
      @if (done()) {
        <div class="portal-auth__info" role="status">{{ 'portal.auth.resetDone' | t }}</div>
        <a mat-flat-button routerLink="/portal/login">{{ 'portal.auth.login' | t }}</a>
      } @else if (invalidToken()) {
        <div class="portal-auth__error" role="alert">{{ 'portal.auth.invalidResetToken' | t }}</div>
        <a mat-flat-button routerLink="/portal/forgot-password">{{ 'portal.auth.requestNewLink' | t }}</a>
      } @else {
        <p class="crm-muted">{{ 'portal.auth.resetSubtitle' | t }}</p>
        @if (error()) {
          <div class="portal-auth__error" role="alert">{{ error() }}</div>
        }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field>
            <mat-label>{{ 'portal.fields.newPassword' | t }}</mat-label>
            <input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
            <mat-error>{{ form.controls.newPassword | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'portal.fields.confirmPassword' | t }}</mat-label>
            <input matInput type="password" formControlName="confirmPassword" autocomplete="new-password" />
            <mat-error>{{ form.controls.confirmPassword | formError }}</mat-error>
          </mat-form-field>
          <button mat-flat-button type="submit" [disabled]="busy()">{{ 'portal.auth.resetSubmit' | t }}</button>
        </form>
      }
      <div class="portal-auth__links">
        <a mat-button routerLink="/portal/login">{{ 'portal.auth.backToLogin' | t }}</a>
      </div>
    </section>
  `,
  styleUrl: './portal-auth.scss',
})
export class PortalResetPasswordPage {
  private readonly api = inject(ApiService);
  private readonly translations = inject(TranslationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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
    this.api
      .post<null>('/public/portal/reset-password', { token: this.token, newPassword: this.form.getRawValue().newPassword }, { anonymous: true, silent: true })
      .subscribe({
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
          const unmatched = applyServerErrors(this.form, apiError);
          if (!apiError.isValidation || unmatched.length) {
            this.error.set(unmatched[0] ?? describeError(apiError, this.translations));
          }
        },
      });
  }
}
