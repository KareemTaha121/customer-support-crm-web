import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { PortalAuthService } from '../auth/portal-auth.service';
import { API_BASE_URL, isApiUrl } from '../config/app-config';
import { SKIP_AUTH } from '../http/api.service';

/**
 * Attaches the right bearer token:
 * - `/api/v1/portal/*`  -> the customer portal token (no refresh; 401 signs the customer out),
 * - `/api/v1/public/*`  -> nothing,
 * - everything else     -> the staff access token, refreshed once (single-flight) on 401.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isApiUrl(request.url) || request.context.get(SKIP_AUTH)) {
    return next(request);
  }

  const path = request.url.startsWith(API_BASE_URL) ? request.url.slice(API_BASE_URL.length) : request.url;
  if (path.startsWith('/public/')) {
    return next(request);
  }

  if (path.startsWith('/portal/') || path === '/portal') {
    const portal = inject(PortalAuthService);
    const router = inject(Router);
    return next(withToken(request, portal.accessToken)).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          portal.logout(false);
          void router.navigate(['/portal/login'], { queryParams: { returnUrl: router.url } });
        }
        return throwError(() => error);
      }),
    );
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  const send = (token: string | null) => next(withToken(request, token));
  const start = auth.accessToken && auth.isTokenExpiring() ? auth.refresh() : null;

  const first$ = start
    ? start.pipe(
        catchError((refreshError: unknown) => {
          auth.expireSession(router.url);
          return throwError(() => refreshError);
        }),
        switchMap((token) => send(token)),
      )
    : send(auth.accessToken);

  return first$.pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !auth.accessToken) {
        return throwError(() => error);
      }
      return auth.refresh().pipe(
        catchError((refreshError: unknown) => {
          auth.expireSession(router.url);
          return throwError(() => refreshError);
        }),
        switchMap((token) => send(token)),
      );
    }),
  );
};

function withToken(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
}
