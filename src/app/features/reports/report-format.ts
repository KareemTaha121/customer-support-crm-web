import { Injectable, inject } from '@angular/core';
import { TranslationService } from '../../core/localization/translation.service';
import { CountByKey, ReportGroupBy } from './reports.models';

const EMPTY_VALUE = '—';

/** Enum-valued report keys that have translations under `reports.enums.<group>.<key>`. */
export type ReportEnumGroup = 'status' | 'priority' | 'channel';

/**
 * Locale-aware formatting for report values. Latin digits in both languages (like LocalizedDatePipe).
 * Reads the language signal, so callers inside `computed()` re-run on language change.
 */
@Injectable({ providedIn: 'root' })
export class ReportFormatter {
  private readonly translations = inject(TranslationService);

  private locale(): string {
    return this.translations.language() === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB';
  }

  number(value: number | null | undefined, digits = 0): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return EMPTY_VALUE;
    }
    return new Intl.NumberFormat(this.locale(), { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
  }

  /** Values are already 0–100. */
  percent(value: number | null | undefined): string {
    return value === null || value === undefined ? EMPTY_VALUE : `${this.number(value, 1)}%`;
  }

  rating(value: number | null | undefined): string {
    return value === null || value === undefined ? EMPTY_VALUE : `${this.number(value, 2)} / 5`;
  }

  /** `85` -> `1h 25m` / `1 س 25 د`. */
  minutes(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return EMPTY_VALUE;
    }
    const total = Math.round(value);
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    if (hours === 0) {
      return this.translations.t('reports.units.minutes', { m: this.number(mins) });
    }
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return this.translations.t('reports.units.daysHours', { d: this.number(days), h: this.number(hours % 24) });
    }
    return this.translations.t('reports.units.hoursMinutes', { h: this.number(hours), m: this.number(mins) });
  }

  date(value: string, format: 'short' | 'long' = 'long'): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    const options: Intl.DateTimeFormatOptions = format === 'short' ? { day: 'numeric', month: 'short' } : { dateStyle: 'medium' };
    return new Intl.DateTimeFormat(this.locale(), options).format(date);
  }

  dateTime(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(this.locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  /** Axis/table label for a time-series bucket. */
  period(value: string, groupBy: ReportGroupBy, compact = false): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    if (groupBy === 'month') {
      return new Intl.DateTimeFormat(this.locale(), { month: compact ? 'short' : 'long', year: 'numeric' }).format(date);
    }
    const label = compact ? this.date(value, 'short') : this.date(value);
    return groupBy === 'week' ? this.translations.t('reports.units.weekOf', { date: label }) : label;
  }

  /** Label for a breakdown key: server label, translated enum, "none" for `'-'`, else the key. */
  keyLabel(item: Pick<CountByKey, 'key' | 'label'>, group?: ReportEnumGroup): string {
    if (item.label) {
      return item.label;
    }
    if (!item.key || item.key === '-') {
      return this.translations.t('reports.common.none');
    }
    if (group) {
      const key = `reports.enums.${group}.${item.key}`;
      return this.translations.has(key) ? this.translations.t(key) : item.key;
    }
    return item.key;
  }
}
