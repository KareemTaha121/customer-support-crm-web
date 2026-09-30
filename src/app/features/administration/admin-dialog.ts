import { Injectable, Type, inject } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { TranslationService } from '../../core/localization/translation.service';

/** Opens admin dialogs in the current text direction with consistent sizing. */
@Injectable({ providedIn: 'root' })
export class AdminDialogs {
  private readonly dialog = inject(MatDialog);
  private readonly translations = inject(TranslationService);

  open<C, D, R>(component: Type<C>, data: D, width = '640px', config: MatDialogConfig<D> = {}): Observable<R | undefined> {
    return this.dialog
      .open<C, D, R>(component, {
        width,
        maxWidth: '95vw',
        maxHeight: '90vh',
        autoFocus: 'first-tabbable',
        direction: this.translations.direction(),
        ...config,
        data,
      })
      .afterClosed();
  }
}
