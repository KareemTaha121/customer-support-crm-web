import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormGroupDirective, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthErrorCodes } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { FormErrorPipe } from '../../shared/form-error.pipe';
import { applyServerErrors } from '../../shared/form-errors';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { matchFields, passwordValidators } from '../../shared/password';

/** The signed-in staff user's account: identity, roles and password change. */
@Component({
  selector: 'app-profile-page',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    TranslatePipe,
    FormErrorPipe,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'auth.profile.title' | t" />
    <div class="profile-grid">
      <section class="crm-card">
        <h2>{{ 'auth.profile.account' | t }}</h2>
        @if (auth.currentUser(); as user) {
          <dl>
            <dt>{{ 'auth.fields.displayName' | t }}</dt>
            <dd>{{ user.displayName }}</dd>
            <dt>{{ 'auth.fields.email' | t }}</dt>
            <dd>{{ user.email }}</dd>
            <dt>{{ 'auth.profile.roles' | t }}</dt>
            <dd>
              <mat-chip-set>
                @for (role of user.roles; track role) {
                  <mat-chip>{{ role }}</mat-chip>
                } @empty {
                  <span class="crm-muted">{{ 'core.states.none' | t }}</span>
                }
              </mat-chip-set>
            </dd>
            <dt>{{ 'auth.profile.permissions' | t }}</dt>
            <dd>{{ 'auth.profile.permissionCount' | t: { count: user.permissions.length } }}</dd>
          </dl>
        }
      </section>

      <section class="crm-card">
        <h2>{{ 'auth.profile.changePassword' | t }}</h2>
        <p class="crm-muted">{{ 'auth.profile.passwordHint' | t }}</p>
        <form [formGroup]="passwordForm" (ngSubmit)="changePassword(formDirective)" #formDirective="ngForm" novalidate>
          <mat-form-field>
            <mat-label>{{ 'auth.fields.currentPassword' | t }}</mat-label>
            <input matInput type="password" formControlName="currentPassword" autocomplete="current-password" />
            <mat-error>{{ passwordForm.controls.currentPassword | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'auth.fields.newPassword' | t }}</mat-label>
            <input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
            <mat-error>{{ passwordForm.controls.newPassword | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'auth.fields.confirmPassword' | t }}</mat-label>
            <input matInput type="password" formControlName="confirmPassword" autocomplete="new-password" />
            <mat-error>{{ passwordForm.controls.confirmPassword | formError }}</mat-error>
          </mat-form-field>
          <div class="crm-actions">
            <button mat-flat-button type="submit" [disabled]="busy()">{{ 'auth.profile.updatePassword' | t }}</button>
          </div>
        </form>
      </section>
    </div>
  `,
  styles: `
    .profile-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); align-items: start; }
    h2 { margin: 0 0 12px; font: var(--mat-sys-title-large); }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 12px 16px; margin: 0; }
    dt { color: var(--mat-sys-on-surface-variant); }
    dd { margin: 0; overflow-wrap: anywhere; }
    form { display: flex; flex-direction: column; gap: 4px; }
  `,
})
export class ProfilePage {
  readonly auth = inject(AuthService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly busy = signal(false);

  readonly passwordForm = inject(NonNullableFormBuilder).group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', passwordValidators],
      confirmPassword: ['', Validators.required],
    },
    { validators: matchFields('newPassword', 'confirmPassword') },
  );

  changePassword(formDirective: FormGroupDirective): void {
    if (this.passwordForm.invalid || this.busy()) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.busy.set(true);
    this.auth.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.busy.set(false);
        formDirective.resetForm();
        this.toast.success('auth.profile.passwordChanged');
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const apiError = ApiError.from(error);
        if (apiError.hasCode(AuthErrorCodes.invalidCurrentPassword)) {
          this.passwordForm.controls.currentPassword.setErrors({ server: this.translations.t('auth.errors.invalidCurrentPassword') });
          return;
        }
        const unmatched = applyServerErrors(this.passwordForm, apiError);
        if (!apiError.isValidation || unmatched.length) {
          this.toast.error(unmatched[0] ?? describeError(apiError, this.translations));
        }
      },
    });
  }
}
