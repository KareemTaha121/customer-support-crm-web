import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormGroupDirective, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PortalAuthService, PortalProfile } from '../../../core/auth/portal-auth.service';
import { ApiError } from '../../../core/http/api-error';
import { ApiService } from '../../../core/http/api.service';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { applyServerErrors } from '../../../shared/form-errors';
import { PageHeaderComponent } from '../../../shared/page-header.component';
import { matchFields, passwordValidators } from '../../../shared/password';

/** Customer profile (GET/PUT /portal/me) and password change (POST /portal/me/change-password). */
@Component({
  selector: 'app-portal-profile-page',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, TranslatePipe, FormErrorPipe, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'portal.profile.title' | t" [subtitle]="portal.profile()?.customerNumber ?? null" />
    <div class="profile-grid">
      <form class="crm-card" [formGroup]="profileForm" (ngSubmit)="saveProfile()" novalidate>
        <h2>{{ 'portal.profile.details' | t }}</h2>
        <mat-form-field>
          <mat-label>{{ 'portal.fields.email' | t }}</mat-label>
          <input matInput [value]="portal.profile()?.email ?? ''" disabled />
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'portal.fields.name' | t }}</mat-label>
          <input matInput formControlName="name" autocomplete="name" />
          <mat-error>{{ profileForm.controls.name | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'portal.fields.language' | t }}</mat-label>
          <mat-select formControlName="language">
            <mat-option value="en">English</mat-option>
            <mat-option value="ar">العربية</mat-option>
          </mat-select>
        </mat-form-field>
        <div class="crm-actions">
          <button mat-flat-button type="submit" [disabled]="savingProfile()">{{ 'portal.actions.save' | t }}</button>
        </div>
      </form>

      <form class="crm-card" [formGroup]="passwordForm" (ngSubmit)="changePassword(pwd)" #pwd="ngForm" novalidate>
        <h2>{{ 'portal.profile.changePassword' | t }}</h2>
        <mat-form-field>
          <mat-label>{{ 'portal.fields.currentPassword' | t }}</mat-label>
          <input matInput type="password" formControlName="currentPassword" autocomplete="current-password" />
          <mat-error>{{ passwordForm.controls.currentPassword | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'portal.fields.newPassword' | t }}</mat-label>
          <input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
          <mat-hint>{{ 'portal.auth.passwordHint' | t }}</mat-hint>
          <mat-error>{{ passwordForm.controls.newPassword | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'portal.fields.confirmPassword' | t }}</mat-label>
          <input matInput type="password" formControlName="confirmPassword" autocomplete="new-password" />
          <mat-error>{{ passwordForm.controls.confirmPassword | formError }}</mat-error>
        </mat-form-field>
        <div class="crm-actions">
          <button mat-flat-button type="submit" [disabled]="savingPassword()">{{ 'portal.profile.updatePassword' | t }}</button>
        </div>
      </form>
    </div>
  `,
  styles: `
    .profile-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); align-items: start; }
    form { display: flex; flex-direction: column; gap: 4px; }
    h2 { margin: 0 0 12px; font: var(--mat-sys-title-large); }
  `,
})
export class PortalProfilePage implements OnInit {
  readonly portal = inject(PortalAuthService);
  private readonly api = inject(ApiService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly savingProfile = signal(false);
  readonly savingPassword = signal(false);

  readonly profileForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    language: ['en', Validators.required],
  });

  readonly passwordForm = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', passwordValidators],
      confirmPassword: ['', Validators.required],
    },
    { validators: matchFields('newPassword', 'confirmPassword') },
  );

  ngOnInit(): void {
    const current = this.portal.profile();
    if (current) {
      this.profileForm.patchValue({ name: current.name, language: current.language });
    }
    this.portal.loadProfile().subscribe((profile) => this.profileForm.patchValue({ name: profile.name, language: profile.language }));
  }

  saveProfile(): void {
    if (this.profileForm.invalid || this.savingProfile()) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.savingProfile.set(true);
    this.api.put<PortalProfile>('/portal/me', this.profileForm.getRawValue(), { silent: true }).subscribe({
      next: (profile) => {
        this.savingProfile.set(false);
        this.portal.updateProfile(profile);
        void this.translations.setLanguage(profile.language === 'ar' ? 'ar' : 'en');
        this.toast.success('portal.profile.saved');
      },
      error: (error: unknown) => {
        this.savingProfile.set(false);
        this.showError(this.profileForm, error);
      },
    });
  }

  changePassword(formDirective: FormGroupDirective): void {
    if (this.passwordForm.invalid || this.savingPassword()) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.savingPassword.set(true);
    this.api.post<null>('/portal/me/change-password', { currentPassword, newPassword }, { silent: true }).subscribe({
      next: () => {
        this.savingPassword.set(false);
        formDirective.resetForm();
        this.toast.success('portal.profile.passwordChanged');
      },
      error: (error: unknown) => {
        this.savingPassword.set(false);
        const apiError = ApiError.from(error);
        if (apiError.hasCode('INVALID_CURRENT_PASSWORD')) {
          this.passwordForm.controls.currentPassword.setErrors({ server: this.translations.t('portal.profile.wrongPassword') });
          return;
        }
        this.showError(this.passwordForm, apiError);
      },
    });
  }

  private showError(form: Parameters<typeof applyServerErrors>[0], error: unknown): void {
    const apiError = ApiError.from(error);
    const unmatched = applyServerErrors(form, apiError);
    if (!apiError.isValidation || unmatched.length) {
      this.toast.error(unmatched[0] ?? describeError(apiError, this.translations));
    }
  }
}
