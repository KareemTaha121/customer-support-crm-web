import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { FormErrorPipe } from '../../shared/form-error.pipe';
import { applyServerErrors } from '../../shared/form-errors';
import { TicketsApi } from './tickets.api';
import { BranchOption, Ticket, TicketLimits, TransferTicketRequest } from './tickets.models';

/** Asks for the escalation reason; closes with the trimmed reason. */
@Component({
  selector: 'app-ticket-escalate-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, TranslatePipe, FormErrorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'tickets.dialogs.escalateTitle' | t }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <p class="crm-muted">{{ 'tickets.dialogs.escalateMessage' | t }}</p>
        <mat-form-field class="full">
          <mat-label>{{ 'tickets.dialogs.reason' | t }}</mat-label>
          <textarea matInput formControlName="reason" rows="4" [maxlength]="limit" cdkFocusInitial></textarea>
          <mat-hint align="end">{{ form.controls.reason.value.length }} / {{ limit }}</mat-hint>
          <mat-error>{{ form.controls.reason | formError }}</mat-error>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'core.actions.cancel' | t }}</button>
        <button mat-flat-button type="submit" class="crm-danger">{{ 'tickets.actions.escalate' | t }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `.full { inline-size: 100%; }`,
})
export class TicketEscalateDialog {
  private readonly ref = inject(MatDialogRef<TicketEscalateDialog, string>);
  readonly limit = TicketLimits.escalationReason;
  readonly form = inject(NonNullableFormBuilder).group({
    reason: ['', [Validators.required, Validators.maxLength(TicketLimits.escalationReason)]],
  });

  submit(): void {
    const reason = this.form.controls.reason.value.trim();
    if (!reason) {
      this.form.controls.reason.setValue('');
      this.form.markAllAsTouched();
      return;
    }
    this.ref.close(reason);
  }
}

/** Edits subject, description and tags (PUT /tickets/{id}); closes with the updated ticket. */
@Component({
  selector: 'app-ticket-edit-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatChipsModule, MatIconModule, TranslatePipe, FormErrorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'tickets.dialogs.editTitle' | t: { number: ticket.number } }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <mat-form-field class="full">
          <mat-label>{{ 'tickets.fields.subject' | t }}</mat-label>
          <input matInput formControlName="subject" [maxlength]="limits.subject" />
          <mat-error>{{ form.controls.subject | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field class="full">
          <mat-label>{{ 'tickets.fields.description' | t }}</mat-label>
          <textarea matInput formControlName="description" rows="8"></textarea>
          <mat-error>{{ form.controls.description | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field class="full">
          <mat-label>{{ 'tickets.fields.tags' | t }}</mat-label>
          <mat-chip-grid #chipGrid [attr.aria-label]="'tickets.fields.tags' | t">
            @for (tag of tags(); track tag) {
              <mat-chip-row (removed)="removeTag(tag)">
                {{ tag }}
                <button matChipRemove type="button" [attr.aria-label]="'core.actions.delete' | t"><mat-icon>cancel</mat-icon></button>
              </mat-chip-row>
            }
            <input [placeholder]="'tickets.fields.tagsHint' | t" [matChipInputFor]="chipGrid" (matChipInputTokenEnd)="addTag($event)" />
          </mat-chip-grid>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'core.actions.cancel' | t }}</button>
        <button mat-flat-button type="submit" [disabled]="busy()">{{ 'core.actions.save' | t }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `.full { inline-size: 100%; }`,
})
export class TicketEditDialog {
  private readonly ref = inject(MatDialogRef<TicketEditDialog, Ticket>);
  private readonly api = inject(TicketsApi);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  readonly ticket = inject<Ticket>(MAT_DIALOG_DATA);
  readonly limits = TicketLimits;
  readonly busy = signal(false);
  readonly tags = signal<string[]>([...this.ticket.tags]);

  readonly form = inject(NonNullableFormBuilder).group({
    subject: [this.ticket.subject, [Validators.required, Validators.maxLength(TicketLimits.subject)]],
    description: [this.ticket.description, Validators.maxLength(TicketLimits.description)],
  });

  addTag(event: MatChipInputEvent): void {
    const tag = event.value.trim();
    if (tag && tag.length <= 50 && !this.tags().some((t) => t.toLowerCase() === tag.toLowerCase()) && this.tags().length < TicketLimits.tags) {
      this.tags.update((tags) => [...tags, tag]);
    }
    event.chipInput.clear();
  }

  removeTag(tag: string): void {
    this.tags.update((tags) => tags.filter((t) => t !== tag));
  }

  submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.busy.set(true);
    this.api
      .update(
        this.ticket.id,
        { subject: value.subject.trim(), description: value.description, categoryId: this.ticket.categoryId, priority: this.ticket.priority, tags: this.tags() },
        true,
      )
      .subscribe({
        next: (ticket) => {
          this.busy.set(false);
          this.ref.close(ticket);
        },
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
}

/** Picks a branch/department to transfer the ticket to; closes with the request body. */
@Component({
  selector: 'app-ticket-transfer-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatSelectModule, MatButtonModule, TranslatePipe, FormErrorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'tickets.dialogs.transferTitle' | t }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <p class="crm-muted">{{ 'tickets.dialogs.transferMessage' | t }}</p>
        <mat-form-field class="full">
          <mat-label>{{ 'tickets.fields.branch' | t }}</mat-label>
          <mat-select formControlName="branchId" (selectionChange)="form.controls.departmentId.setValue('')">
            @for (branch of branches(); track branch.id) {
              <mat-option [value]="branch.id">{{ branch.name }}</mat-option>
            }
          </mat-select>
          <mat-error>{{ form.controls.branchId | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field class="full">
          <mat-label>{{ 'tickets.fields.department' | t }}</mat-label>
          <mat-select formControlName="departmentId">
            <mat-option value="">{{ 'tickets.dialogs.wholeBranch' | t }}</mat-option>
            @for (department of departments(); track department.id) {
              <mat-option [value]="department.id">{{ department.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'core.actions.cancel' | t }}</button>
        <button mat-flat-button type="submit">{{ 'tickets.actions.transfer' | t }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `.full { inline-size: 100%; }`,
})
export class TicketTransferDialog {
  private readonly ref = inject(MatDialogRef<TicketTransferDialog, TransferTicketRequest>);
  private readonly ticket = inject<Ticket>(MAT_DIALOG_DATA);
  readonly branches = signal<BranchOption[]>([]);

  readonly form = inject(NonNullableFormBuilder).group({
    branchId: [this.ticket.branchId, Validators.required],
    departmentId: [this.ticket.departmentId ?? ''],
  });

  private readonly branchId = toSignal(this.form.controls.branchId.valueChanges, { initialValue: this.ticket.branchId });
  readonly departments = computed(() => (this.branches().find((b) => b.id === this.branchId())?.departments ?? []).filter((d) => d.isActive));

  constructor() {
    inject(TicketsApi)
      .branches()
      .subscribe({ next: (items) => this.branches.set(items.filter((b) => b.isActive)), error: () => undefined });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.ref.close({ branchId: value.branchId, departmentId: value.departmentId || null });
  }
}
