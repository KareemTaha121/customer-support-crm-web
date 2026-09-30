import { Injectable, effect, inject } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslationService } from './translation.service';

/** Localized labels for every mat-paginator; refreshes when the language changes. */
@Injectable()
export class LocalizedPaginatorIntl extends MatPaginatorIntl {
  private readonly translations = inject(TranslationService);

  constructor() {
    super();
    effect(() => {
      this.translations.language();
      this.itemsPerPageLabel = this.translations.t('core.paginator.itemsPerPage');
      this.nextPageLabel = this.translations.t('core.paginator.nextPage');
      this.previousPageLabel = this.translations.t('core.paginator.previousPage');
      this.firstPageLabel = this.translations.t('core.paginator.firstPage');
      this.lastPageLabel = this.translations.t('core.paginator.lastPage');
      this.changes.next();
    });
  }

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) {
      return this.translations.t('core.paginator.range', { start: 0, end: 0, total: length });
    }
    const start = page * pageSize + 1;
    const end = Math.min(start + pageSize - 1, length);
    return this.translations.t('core.paginator.range', { start, end, total: length });
  };
}
