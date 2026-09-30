import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { ApiService } from '../http/api.service';
import { AccessTokenResponse, ChangePasswordRequest, CurrentUser, LoginRequest } from './auth.models';

/** Header the API requires on the cookie-authenticated refresh/logout endpoints. */
const CSRF_HEADERS = { 'X-CSRF-Protection': '1' };

/**
 * Staff session. The access token lives in memory only; the refresh token is the HttpOnly
 * `crm_refresh` cookie scoped to `/api/v1/auth`, so a reload restores the session via
 * {@link restoreSession}.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  private readonly token = signal<string | null>(null);
  private readonly expiresAt = signal<number>(0);
  private readonly user = signal<CurrentUser | null>(null);
  private refreshInFlight: Observable<string> | null = null;
  private restoreAttempted = false;

  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly permissions = computed(() => new Set(this.user()?.permissions ?? []));

  get accessToken(): string | null {
    return this.token();
  }

  /** True when the in-memory token expires within `skewSeconds`. */
  isTokenExpiring(skewSeconds = 30): boolean {
    return !this.token() || Date.now() >= this.expiresAt() - skewSeconds * 1000;
  }

  login(request: LoginRequest): Observable<CurrentUser> {
    return this.api
      .post<AccessTokenResponse>('/auth/login', request, { anonymous: true, silent: true, withCredentials: true })
      .pipe(map((session) => this.apply(session)));
  }

  /**
   * Single-flight refresh: concurrent callers share one `POST /auth/refresh`.
   * Emits the new access token or errors (session is then cleared).
   */
  refresh(): Observable<string> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.api
        .post<AccessTokenResponse>('/auth/refresh', {}, { anonymous: true, silent: true, withCredentials: true, headers: CSRF_HEADERS })
        .pipe(
          map((session) => {
            this.apply(session);
            return session.accessToken;
          }),
          catchError((error: unknown) => {
            this.clear();
            return throwError(() => error);
          }),
          finalize(() => (this.refreshInFlight = null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.refreshInFlight;
  }

  /** Called once at startup; resolves to whether a session exists. Never fails. */
  restoreSession(): Observable<boolean> {
    this.restoreAttempted = true;
    return this.refresh().pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  /** Whether {@link restoreSession} already ran (guards call it lazily on first staff route). */
  get hasAttemptedRestore(): boolean {
    return this.restoreAttempted;
  }

  /** Re-reads roles and permissions (e.g. after an admin changed them). */
  reloadCurrentUser(): Observable<CurrentUser> {
    return this.api.get<CurrentUser>('/auth/me').pipe(tap((user) => this.user.set(user)));
  }

  changePassword(request: ChangePasswordRequest): Observable<null> {
    return this.api.post<null>('/auth/change-password', request, { silent: true });
  }

  logout(redirect = true): void {
    this.api
      .post<null>('/auth/logout', {}, { anonymous: true, silent: true, withCredentials: true, headers: CSRF_HEADERS })
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.clear();
        if (redirect) {
          void this.router.navigate(['/login']);
        }
      });
  }

  /** Drops the local session without calling the API (refresh failed, token rejected). */
  expireSession(returnUrl?: string): void {
    this.clear();
    void this.router.navigate(['/login'], { queryParams: returnUrl ? { returnUrl } : undefined });
  }

  private apply(session: AccessTokenResponse): CurrentUser {
    this.token.set(session.accessToken);
    this.expiresAt.set(Date.parse(session.expiresAt) || Date.now() + 5 * 60 * 1000);
    this.user.set(session.user);
    return session.user;
  }

  private clear(): void {
    this.token.set(null);
    this.expiresAt.set(0);
    this.user.set(null);
  }
}
