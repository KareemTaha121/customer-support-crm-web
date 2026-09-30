import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiError } from '../../core/http/api-error';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { FormErrorPipe } from '../../shared/form-error.pipe';
import { reportFormError } from './customer-errors';
import { CustomersApi } from './customers.api';
import { CONTACT_TYPES, CUSTOMER_LIMITS, ContactType, Customer, CustomerContactResponse, CustomerErrorCodes } from './customers.models';

export interface ContactDialogData {
  customerId: string;
  /** Null to add a contact. */
  contact: CustomerContactResponse | null;
}

/** Add (POST /customers/{id}/contacts) or edit (PUT .../contacts/{contactId}) a contact; closes with the updated customer. */
@Component({
  selector: 'app-contact-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule, MatButtonModule, TranslatePipe, FormErrorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ (data.contact ? 'customers.contacts.editTitle' : 'customers.contacts.addTitle') | t }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <mat-form-field>
          <mat-label>{{ 'customers.fields.contactType' | t }}</mat-label>
          <mat-select formControlName="type">
            @for (type of contactTypes; track type) {
              <mat-option [value]="type">{{ 'customers.contactType.' + type | t }}</mat-option>
            }
          </mat-select>
          @if (data.contact) {
            <mat-hint>{{ 'customers.contacts.typeLocked' | t }}</mat-hint>
          }
          <mat-error>{{ form.controls.type | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'customers.fields.value' | t }}</mat-label>
          <input matInput formControlName="value" [maxlength]="limits.contactValueMaxLength" autocomplete="off" cdkFocusInitial />
          @if (form.controls.type.value === 'Phone' || form.controls.type.value === 'WhatsApp') {
            <mat-hint>{{ 'customers.contacts.phoneHint' | t }}</mat-hint>
          }
          <mat-error>{{ form.controls.value | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'customers.fields.label' | t }}</mat-label>
          <input matInput formControlName="label" [maxlength]="limits.contactLabelMaxLength" autocomplete="off" />
          <mat-error>{{ form.controls.label | formError }}</mat-error>
        </mat-form-field>
        <mat-checkbox formControlName="isPrimary">{{ 'customers.contacts.makePrimary' | t }}</mat-checkbox>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'core.actions.cancel' | t }}</button>
        <button mat-flat-button type="submit" [disabled]="saving()">{{ 'core.actions.save' | t }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-dialog-content { display: flex; flex-direction: column; gap: 4px; }
  `,
})
export class ContactDialogComponent {
  readonly data = inject<ContactDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ContactDialogComponent, Customer>>(MatDialogRef);
  private readonly api = inject(CustomersApi);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly contactTypes = CONTACT_TYPES;
  readonly limits = CUSTOMER_LIMITS;
  readonly saving = signal(false);

  readonly form = inject(NonNullableFormBuilder).group({
    type: [{ value: (this.data.contact?.type ?? 'Email') as ContactType, disabled: !!this.data.contact }, Validators.required],
    value: [this.data.contact?.value ?? '', [Validators.required, Validators.maxLength(CUSTOMER_LIMITS.contactValueMaxLength)]],
    label: [this.data.contact?.label ?? '', Validators.maxLength(CUSTOMER_LIMITS.contactLabelMaxLength)],
    isPrimary: [this.data.contact?.isPrimary ?? false],
  });

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const request = { type: value.type, value: value.value.trim(), label: value.label.trim() || null, isPrimary: value.isPrimary };
    const call = this.data.contact
      ? this.api.updateContact(this.data.customerId, this.data.contact.id, request)
      : this.api.addContact(this.data.customerId, request);
    this.saving.set(true);
    call.subscribe({
      next: (customer) => {
        this.saving.set(false);
        this.dialogRef.close(customer);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const apiError = ApiError.from(error);
        if (apiError.hasCode(CustomerErrorCodes.duplicate) || apiError.status === 422) {
          // Duplicate (409) or domain rule on the value (422, e.g. phone not in E.164): show it on the value field.
          this.form.controls.value.setErrors({ server: apiError.errors.find((e) => !e.field)?.message ?? apiError.message });
          this.form.controls.value.markAsTouched();
          return;
        }
        reportFormError(this.form, apiError, this.toast, this.translations);
      },
    });
  }
}
