import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { Observable, map, of, switchMap } from 'rxjs';
import { ApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { applyServerErrors } from '../../../shared/form-errors';
import { PageHeaderComponent } from '../../../shared/page-header.component';
import { PortalTicketsApi } from '../customer-portal.api';
import { PortalCategory, PortalTicket } from '../customer-portal.models';
import { PortalFilePickerComponent } from './portal-file-picker.component';

/** New ticket (POST /portal/tickets), then uploads the files and posts them as a message. */
@Component({
  selector: 'app-portal-new-ticket-page',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressBarModule,
    TranslatePipe,
    FormErrorPipe,
    PageHeaderComponent,
    PortalFilePickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'portal.newTicket.title' | t" [subtitle]="'portal.newTicket.subtitle' | t" backLink="/portal/tickets" />
    <form class="crm-card crm-form-grid" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-form-field class="crm-span-all">
        <mat-label>{{ 'portal.fields.subject' | t }}</mat-label>
        <input matInput formControlName="subject" maxlength="300" />
        <mat-error>{{ form.controls.subject | formError }}</mat-error>
      </mat-form-field>
      <mat-form-field class="crm-span-all">
        <mat-label>{{ 'portal.fields.category' | t }}</mat-label>
        <mat-select formControlName="categoryId">
          <mat-option [value]="null">{{ 'portal.newTicket.noCategory' | t }}</mat-option>
          @for (category of categories(); track category.id) {
            <mat-option [value]="category.id">{{ categoryName(category) }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field class="crm-span-all">
        <mat-label>{{ 'portal.fields.message' | t }}</mat-label>
        <textarea matInput formControlName="message" rows="8" maxlength="10000"></textarea>
        <mat-hint>{{ 'portal.newTicket.messageHint' | t }}</mat-hint>
        <mat-error>{{ form.controls.message | formError }}</mat-error>
      </mat-form-field>
      <app-portal-file-picker class="crm-span-all" [(files)]="files" [disabled]="busy()" />
      @if (busy()) {
        <mat-progress-bar class="crm-span-all" mode="indeterminate" />
      }
      <div class="crm-actions crm-span-all">
        <button mat-button type="button" (click)="cancel()" [disabled]="busy()">{{ 'core.actions.cancel' | t }}</button>
        <button mat-flat-button type="submit" [disabled]="busy()">{{ 'portal.newTicket.submit' | t }}</button>
      </div>
    </form>
  `,
})
export class PortalNewTicketPage implements OnInit {
  private readonly api = inject(PortalTicketsApi);
  private readonly router = inject(Router);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly categories = signal<PortalCategory[]>([]);
  readonly files = signal<File[]>([]);
  readonly busy = signal(false);

  readonly form = this.fb.group({
    subject: ['', [Validators.required, Validators.maxLength(300)]],
    categoryId: this.fb.control<string | null>(null),
    message: ['', [Validators.required, Validators.maxLength(10000)]],
  });

  ngOnInit(): void {
    this.api.categories().subscribe((categories) => this.categories.set(categories));
  }

  categoryName(category: PortalCategory): string {
    return this.translations.language() === 'ar' && category.nameAr ? category.nameAr : category.name;
  }

  cancel(): void {
    void this.router.navigate(['/portal/tickets']);
  }

  submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    const { subject, message, categoryId } = this.form.getRawValue();
    this.api.create({ subject: subject.trim(), message: message.trim(), categoryId }).subscribe({
      next: (ticket) => this.attachFiles(ticket),
      error: (error: unknown) => {
        this.busy.set(false);
        const apiError = ApiError.from(error);
        const unmatched = applyServerErrors(this.form, apiError);
        if (!apiError.isValidation || unmatched.length) {
          this.toast.error(unmatched[0] ?? describeError(apiError, this.translations));
        }
      },
    });
  }

  /** The ticket exists now; attachment failures only produce a warning. */
  private attachFiles(ticket: PortalTicket): void {
    const files = this.files();
    const upload$: Observable<null> = files.length
      ? this.api.uploadAll(ticket.id, files).pipe(
          switchMap((attachments) =>
            this.api.reply(ticket.id, this.translations.t('portal.newTicket.attachmentsMessage'), attachments.map((a) => a.id)),
          ),
          map(() => null),
        )
      : of(null);

    upload$.subscribe({
      next: () => this.finish(ticket),
      error: (error: unknown) => {
        this.toast.error(`${this.translations.t('portal.newTicket.attachmentsFailed')} ${describeError(ApiError.from(error), this.translations)}`);
        this.finish(ticket);
      },
    });
  }

  private finish(ticket: PortalTicket): void {
    this.busy.set(false);
    this.toast.success('portal.newTicket.created', { number: ticket.number });
    void this.router.navigate(['/portal/tickets', ticket.id]);
  }
}
