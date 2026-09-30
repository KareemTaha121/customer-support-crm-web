import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { ApiService } from '../http/api.service';

/** Contracts/Portal/PortalContracts.cs */
export interface PortalProfile {
  accountId: string;
  customerId: string;
  customerNumber: string;
  name: string;
  email: string;
  language: string;
}

export interface PortalSession {
  accessToken: string;
  expiresAt: string;
  profile: PortalProfile;
}

export interface PortalRegisterRequest {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  language?: string | null;
}

const STORAGE_KEY = 'crm.portal.session';

/**
 * Customer portal session. Portal tokens (8h) are not refreshable, so the session is kept in
 * sessionStorage and dropped when it expires or the API answers 401.
 */
@Injectable({ providedIn: 'root' })
export class PortalAuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly session = signal<PortalSession | null>(this.read());

  readonly profile = computed(() => this.session()?.profile ?? null);
  readonly isAuthenticated = computed(() => {
    const current = this.session();
    return !!current && Date.parse(current.expiresAt) > Date.now();
  });

  get accessToken(): string | null {
    return this.isAuthenticated() ? (this.session()?.accessToken ?? null) : null;
  }

  register(request: PortalRegisterRequest): Observable<null> {
    return this.api.post<null>('/public/portal/register', request, { anonymous: true, silent: true });
  }

  verify(email: string, code: string): Observable<PortalProfile> {
    return this.api
      .post<PortalSession>('/public/portal/verify', { email, code }, { anonymous: true, silent: true })
      .pipe(map((session) => this.apply(session)));
  }

  resendVerification(email: string): Observable<null> {
    return this.api.post<null>('/public/portal/resend-verification', { email }, { anonymous: true, silent: true });
  }

  login(email: string, password: string): Observable<PortalProfile> {
    return this.api
      .post<PortalSession>('/public/portal/login', { email, password }, { anonymous: true, silent: true })
      .pipe(map((session) => this.apply(session)));
  }

  loadProfile(): Observable<PortalProfile> {
    return this.api.get<PortalProfile>('/portal/me').pipe(tap((profile) => this.updateProfile(profile)));
  }

  updateProfile(profile: PortalProfile): void {
    const current = this.session();
    if (current) {
      this.store({ ...current, profile });
    }
  }

  logout(redirect = true): void {
    this.store(null);
    if (redirect) {
      void this.router.navigate(['/portal/login']);
    }
  }

  private apply(session: PortalSession): PortalProfile {
    this.store(session);
    return session.profile;
  }

  private store(session: PortalSession | null): void {
    this.session.set(session);
    try {
      if (session) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Storage unavailable (private mode): the session lives in memory only.
    }
  }

  private read(): PortalSession | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const session = raw ? (JSON.parse(raw) as PortalSession) : null;
      return session && Date.parse(session.expiresAt) > Date.now() ? session : null;
    } catch {
      return null;
    }
  }
}
