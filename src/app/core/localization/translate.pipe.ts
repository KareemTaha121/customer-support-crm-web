import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from './translation.service';

/**
 * `{{ 'tickets.list.title' | t }}` or `{{ 'common.greeting' | t: { name: user.name } }}`.
 * Impure so it re-evaluates when the language signal changes; lookups are O(1).
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly translations = inject(TranslationService);

  transform(key: string | null | undefined, params?: Record<string, string | number | null | undefined>): string {
    return key ? this.translations.translate(key, params) : '';
  }
}
