import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { TranslationService } from './translation.service';

/**
 * Loads feature translation scopes before a route activates:
 * `{ path: '', resolve: { i18n: translationResolver('tickets') }, children: [...] }`.
 */
export function translationResolver(...scopes: string[]): ResolveFn<boolean> {
  return () =>
    inject(TranslationService)
      .load(...scopes)
      .then(() => true);
}
