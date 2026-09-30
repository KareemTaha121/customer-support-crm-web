import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslationService } from '../localization/translation.service';

/** Snackbar messages. Pass already-translated text or a translation key with `translate: true`. */
@Injectable({ providedIn: 'root' })
export class NotificationToastService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly translations = inject(TranslationService);

  success(message: string, params?: Record<string, string | number>): void {
    this.open(message, 'crm-toast-success', 3500, params);
  }

  info(message: string, params?: Record<string, string | number>): void {
    this.open(message, 'crm-toast-info', 4000, params);
  }

  error(message: string, params?: Record<string, string | number>): void {
    this.open(message, 'crm-toast-error', 6000, params);
  }

  private open(message: string, panelClass: string, duration: number, params?: Record<string, string | number>): void {
    const text = this.translations.has(message) ? this.translations.t(message, params) : message;
    this.snackBar.open(text, this.translations.t('core.actions.dismiss'), {
      duration,
      panelClass,
      direction: this.translations.direction(),
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}
