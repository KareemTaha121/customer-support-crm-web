import { environment } from '../../../environments/environment';

/** `https://host/api/v1` in development, `/api/v1` behind the production reverse proxy. */
export const API_BASE_URL = environment.apiBaseUrl.replace(/\/+$/, '');

/** The API origin (hubs live at `/hubs/*`, outside `/api/v1`). Empty string = same origin. */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v\d+$/, '');

export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** Resolves an API-relative path (`/tickets`) or an absolute server path (`/api/v1/...`). */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  if (path.startsWith('/api/')) {
    return `${API_ORIGIN}${path}`;
  }
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function isApiUrl(url: string): boolean {
  return url.startsWith(API_BASE_URL) || (API_ORIGIN !== '' && url.startsWith(`${API_ORIGIN}/api/`)) || url.startsWith('/api/');
}
