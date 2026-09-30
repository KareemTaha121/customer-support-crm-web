import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormGroupDirective, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { PortalAuthService } from '../../../core/auth/portal-auth.service';
import { BrandingService } from '../../../core/branding/branding.service';
import { FeatureFlags } from '../../../core/branding/feature-flags';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { applyServerErrors } from '../../../shared/form-errors';
import { PageHeaderComponent } from '../../../shared/page-header.component';
import { PortalPublicApi } from '../customer-portal.api';
import { PortalCategory, withoutFieldPrefix } from '../customer-portal.models';
import { PortalUnavailableComponent } from './portal-unavailable.component';

/** Anonymous contact form (POST /public/web-forms/tickets), gated by `webform.enabled`. */
@Component({
  selector: 'app-portal-contact-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    TranslatePipe,
    FormErrorPipe,
    PageHeaderComponent,
    PortalUnavailableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!enabled()) {
      <app-portal-unavailable [title]="'portal.contact.unavailable' | t" icon="mail" current="contact" />
    } @else if (ticketNumber(); as number) {
      <section class="crm-card done" role="status">
        <mat-icon class="done__icon">check_circle</mat-icon>
        <h1>{{ 'portal.contact.successTitle' | t }}</h1>
        <p>{{ 'portal.contact.successMessage' | t: { number: number } }}</p>
        <div class="crm-actions done__actions">
          <button mat-stroked-button type="button" (click)="another()">{{ 'portal.contact.another' | t }}</button>
          <a mat-flat-button routerLink="/help">{{ 'portal.nav.help' | t }}</a>
        </div>
      </section>
    } @else {
      <app-page-header [title]="'portal.contact.title' | t" [subtitle]="'portal.contact.subtitle' | t" />
      <form class="crm-card crm-form-grid" [formGroup]="form" (ngSubmit)="submit(formDir)" #formDir="ngForm" novalidate>
        <mat-form-field>
          <mat-label>{{ 'portal.fields.name' | t }}</mat-label>
          <input matInput formControlName="name" autocomplete="name" maxlength="200" />
          <mat-error>{{ form.controls.name | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'portal.fields.email' | t }}</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" />
          <mat-error>{{ form.controls.email | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'portal.fields.phone' | t }}</mat-label>
          <input matInput type="tel" formControlName="phone" autocomplete="tel" maxlength="32" dir="ltr" />
          <mat-error>{{ form.controls.phone | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'portal.fields.subject' | t }}</mat-label>
          <input matInput formControlName="subject" maxlength="300" />
          <mat-error>{{ form.controls.subject | formError }}</mat-error>
        </mat-form-field>
        @if (categories().length) {
          <mat-form-field>
            <mat-label>{{ 'portal.fields.category' | t }}</mat-label>
            <mat-select formControlName="categoryId">
              <mat-option [value]="null">{{ 'portal.newTicket.noCategory' | t }}</mat-option>
              @for (category of categories(); track category.id) {
                <mat-option [value]="category.id">{{ categoryName(category) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        <mat-form-field class="crm-span-all">
          <mat-label>{{ 'portal.fields.message' | t }}</mat-label>
          <textarea matInput formControlName="message" rows="7" maxlength="10000"></textarea>
          <mat-error>{{ form.controls.message | formError }}</mat-error>
        </mat-form-field>
        <!-- Honeypot: humans never see or fill it. -->
        <div class="hp" aria-hidden="true">
          <input type="text" name="website" formControlName="website" tabindex="-1" autocomplete="off" />
        </div>
        @if (busy()) {
          <mat-progress-bar class="crm-span-all" mode="indeterminate" />
        }
        <div class="crm-actions crm-span-all">
          <button mat-flat-button type="submit" [disabled]="busy()">
            <mat-icon class="rtl-flip">send</mat-icon>
            {{ 'portal.contact.submit' | t }}
          </button>
        </div>
      </form>
    }
  `,
  styles: `
    .done { max-width: 560px; margin: 32px auto; padding: 32px 24px; text-align: center; }
    .done__icon { font-size: 48px; width: 48px; height: 48px; color: var(--mat-sys-primary); }
    .done h1 { margin: 8px 0; font: var(--mat-sys-headline-small); }
    .done__actions { justify-content: center; }
    .hp { position: absolute; inset-inline-start: -10000px; width: 1px; height: 1px; overflow: hidden; }
  `,
})
export class PortalContactPage implements OnInit {
  private readonly api = inject(PortalPublicApi);
  private readonly branding = inject(BrandingService);
  private readonly portal = inject(PortalAuthService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly enabled = computed(() => this.branding.isEnabled(FeatureFlags.webForm));
  readonly busy = signal(false);
  readonly ticketNumber = signal<string | null>(null);
  readonly categories = signal<PortalCategory[]>([]);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.maxLength(32)],
    subject: ['', [Validators.required, Validators.maxLength(300)]],
    message: ['', [Validators.required, Validators.maxLength(10000)]],
    categoryId: this.fb.control<string | null>(null),
    website: [''],
  });

  ngOnInit(): void {
    this.prefill();
    // Optional field: without categories (or on error) the form works as before.
    this.api.webFormCategories().subscribe({ next: (categories) => this.categories.set(categories), error: () => this.categories.set([]) });
  }

  categoryName(category: PortalCategory): string {
    return this.translations.language() === 'ar' && category.nameAr ? category.nameAr : category.name;
  }

  submit(formDirective: FormGroupDirective): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.busy.set(true);
    this.api
      .submitWebForm({
        name: value.name.trim(),
        email: value.email.trim(),
        phone: value.phone.trim() || null,
        subject: value.subject.trim(),
        message: value.message.trim(),
        categoryId: value.categoryId,
        language: this.translations.language(),
        website: value.website || null,
      })
      .subscribe({
        next: (response) => {
          this.busy.set(false);
          formDirective.resetForm();
          this.ticketNumber.set(response.ticketNumber);
        },
        error: (error: unknown) => {
          this.busy.set(false);
          const apiError = withoutFieldPrefix(error, 'form');
          const unmatched = applyServerErrors(this.form, apiError);
          if (!apiError.isValidation || unmatched.length) {
            this.toast.error(unmatched[0] ?? describeError(apiError, this.translations));
          }
        },
      });
  }

  another(): void {
    this.ticketNumber.set(null);
    this.prefill();
  }

  private prefill(): void {
    const profile = this.portal.profile();
    if (profile) {
      this.form.patchValue({ name: profile.name, email: profile.email });
    }
  }
}
