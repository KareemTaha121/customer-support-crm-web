import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../../core/localization/translate.pipe';

export interface SecretDialogData {
  /** Translation key of the dialog title. */
  title: string;
  /** Translation key explaining what the secret is for. */
  message: string;
  secret: string;
}

/** Shows a one-time secret (API key or webhook signing secret) with a copy button. Opened with `disableClose`. */
@Component({
  selector: 'app-secret-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../admin.scss',
  template: `
    <h2 mat-dialog-title>{{ data.title | t }}</h2>
    <mat-dialog-content>
      <div class="admin-banner" role="alert"><mat-icon>warning_amber</mat-icon><span>{{ 'admin.integrations.secretOnce' | t }}</span></div>
      <p>{{ data.message | t }}</p>
      <div class="secret">
        <code class="admin-mono" dir="ltr">{{ data.secret }}</code>
        <button mat-stroked-button type="button" (click)="copy()">
          <mat-icon>{{ copied() ? 'check' : 'content_copy' }}</mat-icon>{{ (copied() ? 'admin.integrations.copied' : 'admin.integrations.copy') | t }}
        </button>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" [mat-dialog-close]="true">{{ 'admin.integrations.secretSaved' | t }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .secret { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px; border-radius: 8px; background: var(--mat-sys-surface-container-high); }
    .secret code { flex: 1 1 240px; user-select: all; text-align: left; }
  `,
})
export class SecretDialogComponent {
  readonly data = inject<SecretDialogData>(MAT_DIALOG_DATA);
  private readonly toast = inject(NotificationToastService);

  readonly copied = signal(false);

  copy(): void {
    navigator.clipboard.writeText(this.data.secret).then(
      () => this.copied.set(true),
      () => this.toast.error('admin.integrations.copyFailed'),
    );
  }
}
