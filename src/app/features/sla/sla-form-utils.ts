import { FormGroup } from '@angular/forms';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslationService } from '../../core/localization/translation.service';
import { applyServerErrors } from '../../shared/form-errors';

/**
 * Server field paths carry the command property prefix (`policy.name`, `rule.targets[0].x`,
 * GlobalExceptionHandler.ToFieldPath). Strips it, lets the caller rename fields to form control
 * paths, puts the errors on the form and toasts whatever matched no control (or a 422 domain error).
 */
export function showSaveError(
  form: FormGroup,
  error: unknown,
  toast: NotificationToastService,
  translations: TranslationService,
  rename: (field: string) => string = (field) => field,
): void {
  const apiError = ApiError.from(error);
  const errors = apiError.errors.map((item) =>
    item.field ? { ...item, field: rename(item.field.replace(/^(policy|rule)\./, '')) } : item,
  );
  const mapped = new ApiError(apiError.status, apiError.code, apiError.message, errors, apiError.correlationId);
  const unmatched = applyServerErrors(form, mapped);
  if (!mapped.isValidation || unmatched.length) {
    toast.error(unmatched[0] ?? describeError(mapped, translations));
  }
}

/** `null` for empty selects and blank text. */
export function orNull<T>(value: T | '' | null | undefined): T | null {
  if (value === '' || value === undefined || value === null) {
    return null;
  }
  return typeof value === 'string' && value.trim() === '' ? null : value;
}
