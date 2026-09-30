import { HttpClient, HttpContext, HttpContextToken, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { apiUrl } from '../config/app-config';
import { ApiError } from './api-error';
import { ApiEnvelope, Paged, QueryParams } from './api.models';

/** Suppresses the global error snackbar for a request (the caller shows the error itself). */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

/** Skips the bearer token and the 401 refresh logic (auth endpoints, anonymous calls). */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

export interface RequestOptions {
  params?: QueryParams;
  /** Do not show the global error snackbar. */
  silent?: boolean;
  /** Do not attach a token or refresh on 401. */
  anonymous?: boolean;
  headers?: Record<string, string>;
  withCredentials?: boolean;
}

export interface DownloadedFile {
  blob: Blob;
  fileName: string;
}

/**
 * Typed access to the CRM API. Paths are relative to `/api/v1` (`/tickets`, `/public/branding`).
 * Every method unwraps the `ApiResponse` envelope and fails with {@link ApiError}.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, options?: RequestOptions): Observable<T> {
    return this.unwrap(this.http.get<ApiEnvelope<T>>(apiUrl(path), this.build(options)));
  }

  getPaged<T>(path: string, options?: RequestOptions): Observable<Paged<T>> {
    return this.http.get<ApiEnvelope<T[]>>(apiUrl(path), this.build(options)).pipe(
      map((body) => ({
        items: body.data ?? [],
        meta: body.meta ?? { page: 1, pageSize: body.data?.length ?? 0, totalCount: body.data?.length ?? 0, totalPages: 1 },
      })),
      catchError((error: unknown) => throwError(() => ApiError.from(error))),
    );
  }

  post<T>(path: string, body: unknown = {}, options?: RequestOptions): Observable<T> {
    return this.unwrap(this.http.post<ApiEnvelope<T>>(apiUrl(path), body, this.build(options)));
  }

  put<T>(path: string, body: unknown = {}, options?: RequestOptions): Observable<T> {
    return this.unwrap(this.http.put<ApiEnvelope<T>>(apiUrl(path), body, this.build(options)));
  }

  patch<T>(path: string, body: unknown = {}, options?: RequestOptions): Observable<T> {
    return this.unwrap(this.http.patch<ApiEnvelope<T>>(apiUrl(path), body, this.build(options)));
  }

  delete<T = null>(path: string, options?: RequestOptions): Observable<T> {
    return this.unwrap(this.http.delete<ApiEnvelope<T>>(apiUrl(path), this.build(options)));
  }

  /** Multipart upload. `field` defaults to `file`, the name the API's `IFormFile` binds. */
  upload<T>(path: string, file: File, extra?: Record<string, string | Blob>, options?: RequestOptions, field = 'file'): Observable<T> {
    const form = new FormData();
    form.append(field, file, file.name);
    for (const [key, value] of Object.entries(extra ?? {})) {
      form.append(key, value);
    }
    return this.post<T>(path, form, options);
  }

  /** Downloads a binary/CSV endpoint with the current credentials. */
  download(path: string, options?: RequestOptions): Observable<DownloadedFile> {
    const built = this.build(options);
    return this.http
      .get(apiUrl(path), { ...built, observe: 'response', responseType: 'blob' })
      .pipe(
        map((response: HttpResponse<Blob>) => ({
          blob: response.body ?? new Blob(),
          fileName: fileNameFrom(response.headers.get('Content-Disposition')) ?? path.split('/').pop()?.split('?')[0] ?? 'download',
        })),
        catchError((error: unknown) => throwError(() => ApiError.from(error))),
      );
  }

  private unwrap<T>(request: Observable<ApiEnvelope<T>>): Observable<T> {
    return request.pipe(
      map((body) => (body?.data ?? null) as T),
      catchError((error: unknown) => throwError(() => ApiError.from(error))),
    );
  }

  private build(options?: RequestOptions) {
    return {
      params: toHttpParams(options?.params),
      headers: options?.headers,
      withCredentials: options?.withCredentials,
      context: new HttpContext().set(SILENT_ERRORS, !!options?.silent).set(SKIP_AUTH, !!options?.anonymous),
    };
  }
}

export function toHttpParams(params?: QueryParams): HttpParams {
  let result = new HttpParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        result = result.append(key, String(item));
      }
    } else {
      result = result.set(key, String(value));
    }
  }
  return result;
}

function fileNameFrom(disposition: string | null): string | null {
  if (!disposition) {
    return null;
  }
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8) {
    return decodeURIComponent(utf8[1]);
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1] : null;
}
