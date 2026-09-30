import { FormGroup } from '@angular/forms';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { TranslationService } from '../../core/localization/translation.service';
import { applyServerErrors } from '../../shared/form-errors';

/** The localized `admin.errors.<CODE>` text for the first known code in the error, if any. */
export function knownAdminError(error: unknown, translations: TranslationService): string | null {
  const apiError = ApiError.from(error);
  const codes = [apiError.code, ...apiError.errors.map((e) => e.code)];
  for (const code of codes) {
    const key = `admin.errors.${code}`;
    if (translations.has(key)) {
      return translations.t(key);
    }
  }
  return null;
}

/** Localized message for a failed admin call: known rule codes first, then the generic description. */
export function adminErrorMessage(error: unknown, translations: TranslationService): string {
  return knownAdminError(error, translations) ?? describeError(ApiError.from(error), translations);
}

/**
 * Form submission failure: codes listed in `fieldCodes` become a localized error on that control,
 * other known rule codes and unmatched server messages are returned for a banner; plain field
 * validation errors are put on their controls and `null` is returned.
 */
export function formSubmitError(
  form: FormGroup,
  error: unknown,
  translations: TranslationService,
  fieldCodes: Record<string, string> = {},
): string | null {
  const apiError = ApiError.from(error);
  for (const [code, controlName] of Object.entries(fieldCodes)) {
    const control = form.get(controlName);
    if (control && apiError.hasCode(code)) {
      control.setErrors({ server: translations.t(`admin.errors.${code}`) });
      control.markAsTouched();
      return null;
    }
  }
  const known = knownAdminError(apiError, translations);
  if (known) {
    return known;
  }
  const unmatched = applyServerErrors(form, apiError);
  if (apiError.isValidation && unmatched.length === 0) {
    return null;
  }
  return unmatched[0] ?? describeError(apiError, translations);
}
