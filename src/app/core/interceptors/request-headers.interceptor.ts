import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { isApiUrl } from '../config/app-config';
import { TranslationService } from '../localization/translation.service';

/** Adds `Accept-Language` and a fresh `X-Correlation-Id` to every API request. */
export const requestHeadersInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isApiUrl(request.url)) {
    return next(request);
  }
  const language = inject(TranslationService).language();
  const correlationId = crypto.randomUUID().replace(/-/g, '');
  return next(
    request.clone({
      setHeaders: {
        'Accept-Language': language,
        'X-Correlation-Id': correlationId,
      },
    }),
  );
};
