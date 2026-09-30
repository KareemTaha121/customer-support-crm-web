import { TranslationService } from '../../../core/localization/translation.service';

/** Localized label of an API scope (`customers:read`) or webhook event (`ticket.created`); falls back to the code. */
export function integrationLabel(translations: TranslationService, kind: 'scopes' | 'events', code: string): string {
  const key = `admin.integrations.${kind}.${code.replace(/[^A-Za-z0-9]/g, '_')}`;
  return translations.has(key) ? translations.t(key) : code;
}

/** Toggles `value` in an immutable set. */
export function toggleInSet(current: ReadonlySet<string>, value: string, checked: boolean): Set<string> {
  const next = new Set(current);
  if (checked) {
    next.add(value);
  } else {
    next.delete(value);
  }
  return next;
}
