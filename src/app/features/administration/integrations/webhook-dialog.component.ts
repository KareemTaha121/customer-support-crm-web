import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { formSubmitError } from '../admin-errors';
import { AdministrationApi } from '../administration.api';
import { WebhookResponse, WebhookWithSecretResponse } from '../administration.models';
import { integrationLabel, toggleInSet } from './integration-labels';

export interface WebhookDialogData {
  /** Null = create. */
  webhook: WebhookResponse | null;
  events: string[];
}

/** Result: the created webhook with its signing secret, or the updated webhook. */
export type WebhookDialogResult = { created: WebhookWithSecretResponse } | { updated: WebhookResponse };

const HTTPS_URL = /^https:\/\/\S+$/i;

/** Create or edit a webhook subscription (name, https URL, events, active). */
@Component({
  selector: 'app-webhook-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatCheckboxModule, MatSlideToggleModule, MatButtonModule, MatIconModule, TranslatePipe, FormErrorPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../admin.scss',
  template: `
    <h2 mat-dialog-title>{{ (webhook ? 'admin.integrations.editWebhook' : 'admin.integrations.newWebhook') | t }}</h2>
    <mat-dialog-content>
      @if (errorMessage(); as message) {
        <div class="admin-banner" role="alert"><mat-icon>error_outline</mat-icon><span>{{ message }}</span></div>
      }
      <form [formGroup]="form" id="webhook-form" (ngSubmit)="save()" novalidate class="crm-form-grid">
        <mat-form-field>
          <mat-label>{{ 'core.fields.name' | t }}</mat-label>
          <input matInput formControlName="name" maxlength="150" required />
          <mat-error>{{ form.controls.name | formError }}</mat-error>
        </mat-form-field>
        <mat-form-field class="crm-span-all">
          <mat-label>{{ 'admin.integrations.url' | t }}</mat-label>
          <input matInput type="url" formControlName="url" dir="ltr" maxlength="500" placeholder="https://" required />
          @if (form.controls.url.hasError('pattern')) {
            <mat-error>{{ 'admin.integrations.urlHttps' | t }}</mat-error>
          } @else {
            <mat-error>{{ form.controls.url | formError }}</mat-error>
          }
        </mat-form-field>
        <mat-slide-toggle formControlName="isActive" class="crm-span-all">{{ 'admin.integrations.active' | t }}</mat-slide-toggle>
      </form>
      <h3>{{ 'admin.integrations.eventsTitle' | t }}</h3>
      <div class="checks">
        @for (event of data.events; track event) {
          <mat-checkbox [checked]="selected().has(event)" (change)="toggle(event, $event.checked)">
            {{ label(event) }} <span class="admin-mono crm-muted" dir="ltr">{{ event }}</span>
          </mat-checkbox>
        }
      </div>
      @if (eventMissing()) {
        <p class="crm-danger-text" role="alert">{{ 'admin.integrations.eventRequired' | t }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ 'core.actions.cancel' | t }}</button>
      <button mat-flat-button type="submit" form="webhook-form" [disabled]="busy()">{{ (webhook ? 'core.actions.save' : 'core.actions.create') | t }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    h3 { margin: 16px 0 8px; font: var(--mat-sys-title-small); }
    .checks { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 4px 12px; }
    .crm-danger-text { color: var(--crm-danger); font: var(--mat-sys-body-small); }
  `,
})
export class WebhookDialogComponent {
  readonly data = inject<WebhookDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<WebhookDialogComponent, WebhookDialogResult>>(MatDialogRef);
  private readonly api = inject(AdministrationApi);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly webhook = this.data.webhook;
  readonly busy = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly eventMissing = signal(false);
  readonly selected = signal(new Set<string>(this.webhook?.events ?? []));

  readonly form = inject(NonNullableFormBuilder).group({
    name: [this.webhook?.name ?? '', [Validators.required, Validators.maxLength(150)]],
    url: [this.webhook?.url ?? '', [Validators.required, Validators.maxLength(500), Validators.pattern(HTTPS_URL)]],
    isActive: [this.webhook?.isActive ?? true],
  });

  label(event: string): string {
    return integrationLabel(this.translations, 'events', event);
  }

  toggle(event: string, checked: boolean): void {
    this.selected.update((current) => toggleInSet(current, event, checked));
    this.eventMissing.set(false);
  }

  save(): void {
    if (this.busy()) {
      return;
    }
    const noEvent = this.selected().size === 0;
    this.eventMissing.set(noEvent);
    if (this.form.invalid || noEvent) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const request = { name: value.name.trim(), url: value.url.trim(), events: [...this.selected()], isActive: value.isActive };
    this.busy.set(true);
    this.errorMessage.set(null);
    const fail = (error: unknown) => {
      this.busy.set(false);
      this.errorMessage.set(formSubmitError(this.form, error, this.translations));
    };
    if (this.webhook) {
      this.api.updateWebhook(this.webhook.id, request).subscribe({
        next: (updated) => {
          this.toast.success('core.states.saved');
          this.dialogRef.close({ updated });
        },
        error: fail,
      });
    } else {
      this.api.createWebhook(request).subscribe({
        next: (created) => this.dialogRef.close({ created }),
        error: fail,
      });
    }
  }
}
