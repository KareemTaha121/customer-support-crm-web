import { FormGroup } from '@angular/forms';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslationService } from '../../core/localization/translation.service';
import { applyServerErrors } from '../../shared/form-errors';

/**
 * Standard handling for a silent form request: field errors go on the controls, anything
 * else (feature codes, unmatched fields) is shown in a snackbar.
 */
export function reportFormError(form: FormGroup, error: unknown, toast: NotificationToastService, translations: TranslationService): ApiError {
  const apiError = ApiError.from(error);
  const unmatched = applyServerErrors(form, apiError);
  if (!apiError.isValidation || unmatched.length) {
    toast.error(unmatched[0] ?? describeError(apiError, translations));
  }
  return apiError;
}
