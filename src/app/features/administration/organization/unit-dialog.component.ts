import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Observable } from 'rxjs';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { formSubmitError } from '../admin-errors';
import { AdministrationApi } from '../administration.api';
import { AdminErrorCodes, BranchResponse, DepartmentResponse } from '../administration.models';

export type UnitDialogData =
  | { kind: 'branch'; branchId: string | null; unit: BranchResponse | null }
  | { kind: 'department'; branchId: string; unit: DepartmentResponse | null };

const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Create or edit a branch or a department. Closes with `true` after saving. */
@Component({
  selector: 'app-unit-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, TranslatePipe, FormErrorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../admin.scss',
  template: `
    <h2 mat-dialog-title>{{ title | t }}</h2>
    <mat-dialog-content>
      @if (errorMessage(); as message) {
        <div class="admin-banner" role="alert"><mat-icon>error_outline</mat-icon><span>{{ message }}</span></div>
      }
      <form [formGroup]="form" id="unit-form" (ngSubmit)="save()" novalidate class="crm-form-grid">
        <mat-form-field>
          <mat-label>{{ 'admin.organization.code' | t }}</mat-label>
          <input matInput formControlName="code" dir="ltr" maxlength="20" required />
          <mat-hint>{{ 'admin.organization.codeHint' | t }}</mat-hint>
          <mat-error>{{ form.controls.code | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'core.fields.name' | t }}</mat-label>
          <input matInput formControlName="name" maxlength="200" required />
          <mat-error>{{ form.controls.name | formError }}</mat-error>
        </mat-form-field>
        @if (data.kind === 'branch') {
          <mat-form-field class="crm-span-all">
            <mat-label>{{ 'admin.organization.address' | t }}</mat-label>
            <textarea matInput formControlName="address" rows="2" maxlength="500"></textarea>
            <mat-error>{{ form.controls.address | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'core.fields.phone' | t }}</mat-label>
            <input matInput type="tel" formControlName="phone" dir="ltr" maxlength="32" />
            <mat-error>{{ form.controls.phone | formError }}</mat-error>
          </mat-form-field>
        } @else {
          <mat-form-field class="crm-span-all">
            <mat-label>{{ 'core.fields.email' | t }}</mat-label>
            <input matInput type="email" formControlName="email" dir="ltr" maxlength="254" />
            <mat-error>{{ form.controls.email | formError }}</mat-error>
          </mat-form-field>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ 'core.actions.cancel' | t }}</button>
      <button mat-flat-button type="submit" form="unit-form" [disabled]="busy()">{{ (data.unit ? 'core.actions.save' : 'core.actions.create') | t }}</button>
    </mat-dialog-actions>
  `,
})
export class UnitDialogComponent {
  readonly data = inject<UnitDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<UnitDialogComponent, boolean>>(MatDialogRef);
  private readonly api = inject(AdministrationApi);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly busy = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly title =
    this.data.kind === 'branch'
      ? this.data.unit ? 'admin.organization.editBranch' : 'admin.organization.newBranch'
      : this.data.unit ? 'admin.organization.editDepartment' : 'admin.organization.newDepartment';

  readonly form = inject(NonNullableFormBuilder).group({
    code: [this.data.unit?.code ?? '', [Validators.required, Validators.maxLength(20), Validators.pattern(CODE_PATTERN)]],
    name: [this.data.unit?.name ?? '', [Validators.required, Validators.maxLength(200)]],
    address: [this.data.kind === 'branch' ? (this.data.unit?.address ?? '') : '', [Validators.maxLength(500)]],
    phone: [this.data.kind === 'branch' ? (this.data.unit?.phone ?? '') : '', [Validators.maxLength(32)]],
    email: [this.data.kind === 'department' ? (this.data.unit?.email ?? '') : '', [Validators.email, Validators.maxLength(254)]],
  });

  save(): void {
    if (this.busy()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const data = this.data;
    let call: Observable<unknown>;
    if (data.kind === 'branch') {
      const request = { code: v.code.trim(), name: v.name.trim(), address: v.address.trim() || null, phone: v.phone.trim() || null };
      call = data.unit ? this.api.updateBranch(data.unit.id, request) : this.api.createBranch(request);
    } else {
      const request = { code: v.code.trim(), name: v.name.trim(), email: v.email.trim() || null };
      call = data.unit ? this.api.updateDepartment(data.branchId, data.unit.id, request) : this.api.createDepartment(data.branchId, request);
    }
    this.busy.set(true);
    this.errorMessage.set(null);
    call.subscribe({
      next: () => {
        this.toast.success(data.unit ? 'core.states.saved' : 'core.states.created');
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.errorMessage.set(
          formSubmitError(this.form, error, this.translations, {
            [AdminErrorCodes.branchCodeTaken]: 'code',
            [AdminErrorCodes.departmentCodeTaken]: 'code',
          }),
        );
      },
    });
  }
}
