import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PortalAuthService } from '../../../core/auth/portal-auth.service';
import { ApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { applyServerErrors } from '../../../shared/form-errors';

/** Email verification with the emailed code (POST /public/portal/verify), which signs the customer in. */
@Component({
  selector: 'app-portal-verify-page',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, RouterLink, TranslatePipe, FormErrorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="crm-card portal-auth">
      <h1>{{ 'portal.auth.verifyTitle' | t }}</h1>
      <p class="crm-muted">{{ 'portal.auth.verifySubtitle' | t }}</p>
      @if (error()) {
        <div class="portal-auth__error" role="alert">{{ error() }}</div>
      }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <mat-form-field>
          <mat-label>{{ 'portal.fields.email' | t }}</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" />
          <mat-error>{{ form.controls.email | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'portal.fields.code' | t }}</mat-label>
          <input matInput formControlName="code" autocomplete="one-time-code" inputmode="numeric" dir="ltr" />
          <mat-error>{{ form.controls.code | formError }}</mat-error>
        </mat-form-field>
        <button mat-flat-button type="submit" [disabled]="busy()">{{ 'portal.auth.verify' | t }}</button>
      </form>
      <div class="portal-auth__links">
        <button mat-button type="button" (click)="resend()" [disabled]="busy()">{{ 'portal.auth.resend' | t }}</button>
        <a mat-button routerLink="/portal/login">{{ 'portal.auth.backToLogin' | t }}</a>
      </div>
    </section>
  `,
  styleUrl: './portal-auth.scss',
})
export class PortalVerifyPage implements OnInit {
  private readonly portal = inject(PortalAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    code: ['', [Validators.required, Validators.maxLength(16)]],
  });

  ngOnInit(): void {
    const email = this.route.snapshot.queryParamMap.get('email');
    if (email) {
      this.form.controls.email.setValue(email);
    }
  }

  submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, code } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.portal.verify(email, code.trim()).subscribe({
      next: () => {
        this.toast.success('portal.auth.verified');
        void this.router.navigate(['/portal']);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  resend(): void {
    const email = this.form.controls.email;
    if (email.invalid) {
      email.markAsTouched();
      return;
    }
    this.busy.set(true);
    this.portal.resendVerification(email.value).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.info('portal.auth.codeSent');
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.busy.set(false);
    const apiError = ApiError.from(error);
    const unmatched = applyServerErrors(this.form, apiError);
    if (!apiError.isValidation || unmatched.length) {
      this.error.set(unmatched[0] ?? describeError(apiError, this.translations));
    }
  }
}
