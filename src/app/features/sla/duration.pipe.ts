import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from '../../core/localization/translation.service';

/** `{{ 90 | slaDuration }}` → `1 h 30 min` (localized). */
@Pipe({ name: 'slaDuration', pure: false })
export class SlaDurationPipe implements PipeTransform {
  private readonly translations = inject(TranslationService);

  transform(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined) {
      return '';
    }
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const rest = minutes % 60;
    const parts: string[] = [];
    if (days) {
      parts.push(this.translations.t('sla.duration.days', { n: days }));
    }
    if (hours) {
      parts.push(this.translations.t('sla.duration.hours', { n: hours }));
    }
    if (rest || parts.length === 0) {
      parts.push(this.translations.t('sla.duration.minutes', { n: rest }));
    }
    return parts.join(' ');
  }
}
