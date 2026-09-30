import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { BrandingService } from '../../../core/branding/branding.service';
import { apiUrl } from '../../../core/config/app-config';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { PermissionService } from '../../../core/permissions/permission.service';
import { Permissions } from '../../../core/permissions/permissions';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { PageHeaderComponent } from '../../../shared/page-header.component';
import { ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { adminErrorMessage, formSubmitError } from '../admin-errors';
import { AdministrationApi } from '../administration.api';
import { OrganizationResponse, SUPPORTED_CULTURES } from '../administration.models';
import { BranchesComponent } from './branches.component';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** `/admin/organization`: profile, branding (colors + logo) and the branch/department structure. */
@Component({
  selector: 'app-organization-page',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TranslatePipe,
    FormErrorPipe,
    PageHeaderComponent,
    LoadingComponent,
    ErrorStateComponent,
    BranchesComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../admin.scss',
  template: `
    <app-page-header [title]="'admin.organization.title' | t" [subtitle]="'admin.organization.subtitle' | t" />

    @if (loading()) {
      <app-loading />
    } @else if (error()) {
      <app-error-state [message]="error()" (retry)="load()" />
    } @else {
      @if (!canEditProfile) {
        <div class="admin-banner admin-banner--info"><mat-icon>info</mat-icon><span>{{ 'admin.organization.profileReadOnly' | t }}</span></div>
      }
      <div class="org-grid">
        <section class="crm-card admin-section">
          <h2>{{ 'admin.organization.profile' | t }}</h2>
          @if (profileError(); as message) {
            <div class="admin-banner" role="alert"><mat-icon>error_outline</mat-icon><span>{{ message }}</span></div>
          }
          <form [formGroup]="profileForm" (ngSubmit)="saveProfile()" novalidate class="crm-form-grid">
            <mat-form-field class="crm-span-all">
              <mat-label>{{ 'core.fields.name' | t }}</mat-label>
              <input matInput formControlName="name" maxlength="200" required />
              <mat-error>{{ profileForm.controls.name | formError }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'admin.organization.supportEmail' | t }}</mat-label>
              <input matInput type="email" formControlName="supportEmail" dir="ltr" />
              <mat-error>{{ profileForm.controls.supportEmail | formError }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'admin.organization.supportPhone' | t }}</mat-label>
              <input matInput type="tel" formControlName="supportPhone" dir="ltr" maxlength="32" />
              <mat-error>{{ profileForm.controls.supportPhone | formError }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'admin.organization.defaultCulture' | t }}</mat-label>
              <mat-select formControlName="defaultCulture">
                @for (culture of cultures; track culture) {
                  <mat-option [value]="culture">{{ 'admin.organization.cultures.' + culture | t }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'admin.organization.timeZone' | t }}</mat-label>
              <input matInput formControlName="timeZone" list="admin-time-zones" dir="ltr" maxlength="64" required />
              <datalist id="admin-time-zones">
                @for (zone of timeZones; track zone) {
                  <option [value]="zone"></option>
                }
              </datalist>
              <mat-error>{{ profileForm.controls.timeZone | formError }}</mat-error>
            </mat-form-field>
            @if (canEditProfile) {
              <div class="crm-actions crm-span-all">
                <button mat-flat-button type="submit" [disabled]="savingProfile()">{{ 'core.actions.save' | t }}</button>
              </div>
            }
          </form>
        </section>

        <section class="crm-card admin-section">
          <h2>{{ 'admin.organization.branding' | t }}</h2>
          @if (brandingError(); as message) {
            <div class="admin-banner" role="alert"><mat-icon>error_outline</mat-icon><span>{{ message }}</span></div>
          }
          <form [formGroup]="brandingForm" (ngSubmit)="saveBranding()" novalidate>
            <div class="color-row">
              <input type="color" class="swatch" [value]="brandingForm.controls.primaryColor.value" (input)="pickColor('primaryColor', $event)"
                [disabled]="!canEditProfile" [attr.aria-label]="'admin.organization.primaryColor' | t" />
              <mat-form-field>
                <mat-label>{{ 'admin.organization.primaryColor' | t }}</mat-label>
                <input matInput formControlName="primaryColor" dir="ltr" maxlength="7" />
                <mat-error>{{ 'admin.organization.colorFormat' | t }}</mat-error>
              </mat-form-field>
            </div>
            <div class="color-row">
              <input type="color" class="swatch" [value]="brandingForm.controls.accentColor.value" (input)="pickColor('accentColor', $event)"
                [disabled]="!canEditProfile" [attr.aria-label]="'admin.organization.accentColor' | t" />
              <mat-form-field>
                <mat-label>{{ 'admin.organization.accentColor' | t }}</mat-label>
                <input matInput formControlName="accentColor" dir="ltr" maxlength="7" />
                <mat-error>{{ 'admin.organization.colorFormat' | t }}</mat-error>
              </mat-form-field>
            </div>
            @if (canEditProfile) {
              <div class="crm-actions">
                <button mat-flat-button type="submit" [disabled]="savingBranding()">{{ 'admin.organization.saveColors' | t }}</button>
              </div>
            }
          </form>

          <h3>{{ 'admin.organization.logo' | t }}</h3>
          <div class="logo-row">
            <div class="logo-box">
              @if (logoSrc(); as src) {
                <img [src]="src" [alt]="'admin.organization.logo' | t" />
              } @else {
                <span class="crm-muted">{{ 'admin.organization.noLogo' | t }}</span>
              }
            </div>
            @if (canEditProfile) {
              <div>
                <input #fileInput type="file" hidden accept=".png,.jpg,.jpeg,.gif,.webp" (change)="uploadLogo(fileInput)" />
                <button mat-stroked-button type="button" (click)="fileInput.click()" [disabled]="uploading()">
                  <mat-icon>upload</mat-icon>{{ 'admin.organization.uploadLogo' | t }}
                </button>
                <p class="admin-hint">{{ 'admin.organization.logoHint' | t }}</p>
              </div>
            }
          </div>
          @if (uploading()) {
            <mat-progress-bar mode="indeterminate" />
          }
        </section>
      </div>

      <app-admin-branches class="admin-section" [canManage]="canManageBranches" />
    }
  `,
  styles: `
    .org-grid { display: grid; gap: var(--crm-gap); grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); align-items: start; }
    .org-grid .admin-section + .admin-section { margin-top: 0; }
    h3 { margin: 16px 0 8px; font: var(--mat-sys-title-small); }
    .color-row { display: flex; align-items: flex-start; gap: 12px; }
    .color-row mat-form-field { flex: 1; }
    .swatch { width: 48px; height: 48px; margin-top: 4px; padding: 0; border: 1px solid var(--mat-sys-outline-variant); border-radius: 8px; background: none; cursor: pointer; }
    .logo-row { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
    .logo-box { display: flex; align-items: center; justify-content: center; width: 160px; height: 80px; border: 1px dashed var(--mat-sys-outline-variant); border-radius: 8px; }
    .logo-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .admin-hint { margin-top: 8px; }
  `,
})
export class OrganizationPage {
  private readonly api = inject(AdministrationApi);
  private readonly branding = inject(BrandingService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly permissions = inject(PermissionService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly canEditProfile = this.permissions.has(Permissions.settingsManage);
  readonly canManageBranches = this.permissions.has(Permissions.organizationManage);
  readonly cultures = SUPPORTED_CULTURES;
  readonly timeZones = supportedTimeZones();

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly organization = signal<OrganizationResponse | null>(null);
  readonly logoSrc = signal<string | null>(null);
  readonly savingProfile = signal(false);
  readonly savingBranding = signal(false);
  readonly uploading = signal(false);
  readonly profileError = signal<string | null>(null);
  readonly brandingError = signal<string | null>(null);

  readonly profileForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    supportEmail: ['', [Validators.email, Validators.maxLength(254)]],
    supportPhone: ['', [Validators.maxLength(32)]],
    defaultCulture: ['en', Validators.required],
    timeZone: ['', [Validators.required, Validators.maxLength(64)]],
  });

  readonly brandingForm = this.fb.group({
    primaryColor: ['#1f4e79', [Validators.required, Validators.pattern(HEX_COLOR)]],
    accentColor: ['#f39c12', [Validators.required, Validators.pattern(HEX_COLOR)]],
  });

  constructor() {
    if (!this.canEditProfile) {
      this.profileForm.disable();
      this.brandingForm.disable();
    }
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getOrganization().subscribe({
      next: (organization) => {
        this.setOrganization(organization);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(adminErrorMessage(error, this.translations));
      },
    });
  }

  pickColor(control: 'primaryColor' | 'accentColor', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.brandingForm.controls[control].setValue(value);
    this.brandingForm.controls[control].markAsDirty();
  }

  saveProfile(): void {
    if (!this.canEditProfile || this.savingProfile()) {
      return;
    }
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    const value = this.profileForm.getRawValue();
    this.savingProfile.set(true);
    this.profileError.set(null);
    this.api
      .updateOrganization({
        name: value.name.trim(),
        supportEmail: value.supportEmail.trim() || null,
        supportPhone: value.supportPhone.trim() || null,
        defaultCulture: value.defaultCulture,
        timeZone: value.timeZone.trim(),
      })
      .subscribe({
        next: (organization) => {
          this.savingProfile.set(false);
          this.setOrganization(organization);
          this.applyBranding(organization);
          this.toast.success('core.states.saved');
        },
        error: (error: unknown) => {
          this.savingProfile.set(false);
          this.profileError.set(formSubmitError(this.profileForm, error, this.translations));
        },
      });
  }

  saveBranding(): void {
    if (!this.canEditProfile || this.savingBranding()) {
      return;
    }
    if (this.brandingForm.invalid) {
      this.brandingForm.markAllAsTouched();
      return;
    }
    const value = this.brandingForm.getRawValue();
    this.savingBranding.set(true);
    this.brandingError.set(null);
    this.api.updateBranding({ primaryColor: value.primaryColor.toLowerCase(), accentColor: value.accentColor.toLowerCase() }).subscribe({
      next: (organization) => {
        this.savingBranding.set(false);
        this.setOrganization(organization);
        this.applyBranding(organization);
        this.toast.success('admin.organization.brandingSaved');
      },
      error: (error: unknown) => {
        this.savingBranding.set(false);
        this.brandingError.set(formSubmitError(this.brandingForm, error, this.translations));
      },
    });
  }

  uploadLogo(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (!LOGO_TYPES.includes(file.type)) {
      this.brandingError.set(this.translations.t('admin.organization.logoType'));
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      this.brandingError.set(this.translations.t('admin.organization.logoTooLarge'));
      return;
    }
    this.uploading.set(true);
    this.brandingError.set(null);
    this.api.uploadLogo(file).subscribe({
      next: (organization) => {
        this.uploading.set(false);
        this.setOrganization(organization);
        this.applyBranding(organization);
        this.toast.success('admin.organization.logoUploaded');
      },
      error: (error: unknown) => {
        this.uploading.set(false);
        this.brandingError.set(adminErrorMessage(error, this.translations));
      },
    });
  }

  private setOrganization(organization: OrganizationResponse): void {
    this.organization.set(organization);
    this.logoSrc.set(organization.logoUrl ? apiUrl(organization.logoUrl) : null);
    this.profileForm.reset({
      name: organization.name,
      supportEmail: organization.supportEmail ?? '',
      supportPhone: organization.supportPhone ?? '',
      defaultCulture: organization.defaultCulture,
      timeZone: organization.timeZone,
    });
    this.brandingForm.reset({ primaryColor: organization.primaryColor, accentColor: organization.accentColor });
  }

  private applyBranding(organization: OrganizationResponse): void {
    this.branding.apply({
      name: organization.name,
      defaultCulture: organization.defaultCulture,
      primaryColor: organization.primaryColor,
      accentColor: organization.accentColor,
      logoUrl: organization.logoUrl,
    });
  }
}

function supportedTimeZones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['UTC', 'Asia/Riyadh', 'Asia/Dubai', 'Africa/Cairo', 'Europe/London'];
  }
}
