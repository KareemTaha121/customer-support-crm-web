import { formatDate } from '@angular/common';
import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from './translation.service';

/**
 * Formats ISO timestamps in the active language: `{{ ticket.createdAt | localDate }}`,
 * `{{ x | localDate: 'shortDate' }}`. Uses the `en` locale data with Latin digits for both
 * languages so no extra locale bundle is needed; month names come from Intl.
 */
@Pipe({ name: 'localDate', pure: false })
export class LocalizedDatePipe implements PipeTransform {
  private readonly translations = inject(TranslationService);

  transform(value: string | number | Date | null | undefined, format: 'short' | 'medium' | 'shortDate' | 'mediumDate' | 'shortTime' | 'relative' = 'medium'): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const locale = this.translations.language() === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB';
    if (format === 'relative') {
      return relative(date, locale);
    }
    const options: Record<string, Intl.DateTimeFormatOptions> = {
      short: { dateStyle: 'short', timeStyle: 'short' },
      medium: { dateStyle: 'medium', timeStyle: 'short' },
      shortDate: { dateStyle: 'short' },
      mediumDate: { dateStyle: 'medium' },
      shortTime: { timeStyle: 'short' },
    };
    try {
      return new Intl.DateTimeFormat(locale, options[format]).format(date);
    } catch {
      return formatDate(date, format, 'en-US');
    }
  }
}

function relative(date: Date, locale: string): string {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return format.format(Math.round(seconds / size), unit);
    }
  }
  return format.format(seconds, 'second');
}
