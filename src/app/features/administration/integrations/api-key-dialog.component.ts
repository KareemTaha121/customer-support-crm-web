import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { formSubmitError } from '../admin-errors';
import { AdministrationApi } from '../administration.api';
import { CreatedApiKeyResponse } from '../administration.models';
import { integrationLabel, toggleInSet } from './integration-labels';

export interface ApiKeyDialogData {
  scopes: string[];
}

/** Creates an API key; closes with the created key (plaintext included once). */
@Component({
  selector: 'app-api-key-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatCheckboxModule, MatButtonModule, MatIconModule, TranslatePipe, FormErrorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../admin.scss',
  template: `
    <h2 mat-dialog-title>{{ 'admin.integrations.newApiKey' | t }}</h2>
    <mat-dialog-content>
      @if (errorMessage(); as message) {
        <div class="admin-banner" role="alert"><mat-icon>error_outline</mat-icon><span>{{ message }}</span></div>
      }
      <form [formGroup]="form" id="api-key-form" (ngSubmit)="save()" novalidate class="crm-form-grid">
        <mat-form-field>
          <mat-label>{{ 'core.fields.name' | t }}</mat-label>
          <input matInput formControlName="name" maxlength="150" required />
          <mat-error>{{ form.controls.name | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'admin.integrations.expiresAt' | t }}</mat-label>
          <input matInput type="date" formControlName="expiresAt" [min]="today" dir="ltr" />
          <mat-hint>{{ 'admin.integrations.expiresHint' | t }}</mat-hint>
        </mat-form-field>
      </form>
      <h3>{{ 'admin.integrations.scopesTitle' | t }}</h3>
      <div class="checks">
        @for (scope of data.scopes; track scope) {
          <mat-checkbox [checked]="selected().has(scope)" (change)="toggle(scope, $event.checked)">
            {{ label(scope) }} <span class="admin-mono crm-muted" dir="ltr">{{ scope }}</span>
          </mat-checkbox>
        }
      </div>
      @if (scopeMissing()) {
        <p class="crm-danger-text" role="alert">{{ 'admin.integrations.scopeRequired' | t }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ 'core.actions.cancel' | t }}</button>
      <button mat-flat-button type="submit" form="api-key-form" [disabled]="busy()">{{ 'core.actions.create' | t }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    h3 { margin: 8px 0; font: var(--mat-sys-title-small); }
    .checks { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 4px 12px; }
    .crm-danger-text { color: var(--crm-danger); font: var(--mat-sys-body-small); }
  `,
})
export class ApiKeyDialogComponent {
  readonly data = inject<ApiKeyDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ApiKeyDialogComponent, CreatedApiKeyResponse>>(MatDialogRef);
  private readonly api = inject(AdministrationApi);
  private readonly translations = inject(TranslationService);

  readonly today = new Date().toISOString().slice(0, 10);
  readonly busy = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly scopeMissing = signal(false);
  readonly selected = signal(new Set<string>());

  readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    expiresAt: [''],
  });

  label(scope: string): string {
    return integrationLabel(this.translations, 'scopes', scope);
  }

  toggle(scope: string, checked: boolean): void {
    this.selected.update((current) => toggleInSet(current, scope, checked));
    this.scopeMissing.set(false);
  }

  save(): void {
    if (this.busy()) {
      return;
    }
    const noScope = this.selected().size === 0;
    this.scopeMissing.set(noScope);
    if (this.form.invalid || noScope) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.busy.set(true);
    this.errorMessage.set(null);
    this.api
      .createApiKey({
        name: value.name.trim(),
        scopes: [...this.selected()],
        // End of the chosen local day.
        expiresAt: value.expiresAt ? new Date(`${value.expiresAt}T23:59:59`).toISOString() : null,
      })
      .subscribe({
        next: (created) => this.dialogRef.close(created),
        error: (error: unknown) => {
          this.busy.set(false);
          this.errorMessage.set(formSubmitError(this.form, error, this.translations));
        },
      });
  }
}
