import { ChangeDetectionStrategy, Component, Injectable, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Observable, map } from 'rxjs';
import { TranslatePipe } from '../core/localization/translate.pipe';
import { TranslationService } from '../core/localization/translation.service';

export interface ConfirmOptions {
  /** Translated text or a translation key. */
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  params?: Record<string, string | number>;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title | t: data.params }}</h2>
    @if (data.message) {
      <mat-dialog-content>{{ data.message | t: data.params }}</mat-dialog-content>
    }
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">{{ data.cancelText ?? 'core.actions.cancel' | t }}</button>
      <button mat-flat-button type="button" [class.crm-danger]="data.destructive" [mat-dialog-close]="true" cdkFocusInitial>
        {{ data.confirmText ?? 'core.actions.confirm' | t }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmOptions>(MAT_DIALOG_DATA);
}

/** `confirm.ask({ title: 'tickets.delete.title', destructive: true }).subscribe(ok => ...)` */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);
  private readonly translations = inject(TranslationService);

  ask(options: ConfirmOptions): Observable<boolean> {
    return this.dialog
      .open(ConfirmDialogComponent, { data: options, width: '420px', maxWidth: '95vw', direction: this.translations.direction() })
      .afterClosed()
      .pipe(map((result: unknown) => result === true));
  }
}
