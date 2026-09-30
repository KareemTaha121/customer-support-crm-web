import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { isApiUrl } from '../config/app-config';
import { ApiError } from '../http/api-error';
import { SILENT_ERRORS } from '../http/api.service';
import { NotificationToastService } from '../layout/notification-toast.service';
import { TranslationService } from '../localization/translation.service';

/**
 * Shows one localized snackbar per failed API request, unless the request opted out with
 * `{ silent: true }` (the caller renders the error, e.g. inline form errors).
 * 401s are left to the auth interceptor (refresh / redirect to login).
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isApiUrl(request.url)) {
    return next(request);
  }
  const toast = inject(NotificationToastService);
  const translations = inject(TranslationService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status !== 401 && !request.context.get(SILENT_ERRORS)) {
        toast.error(describeError(ApiError.from(error), translations));
      }
      return throwError(() => error);
    }),
  );
};

/** The text to show for an error: the server's specific message, else a localized fallback. */
export function describeError(error: ApiError, translations: TranslationService): string {
  if (error.status === 0) {
    return translations.t('core.errors.network');
  }
  const specific = error.errors.find((e) => !e.field)?.message;
  if (specific) {
    return specific;
  }
  if (error.isValidation) {
    return error.message || translations.t('core.errors.validation');
  }
  const key = `core.errors.${error.code}`;
  return translations.has(key) ? translations.t(key) : error.message || translations.t('core.errors.unknown');
}
