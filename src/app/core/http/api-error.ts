import { HttpErrorResponse } from '@angular/common/http';
import { ApiEnvelope, ApiErrorItem } from './api.models';

/**
 * A failed API call. `code` is the stable feature code (e.g. `TICKET_NOT_FOUND`) when the
 * server sent one, otherwise the category (`VALIDATION_ERROR`, `NETWORK_ERROR`, ...).
 * Branch on `code`, never on `message`.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly errors: readonly ApiErrorItem[] = [],
    readonly correlationId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field errors keyed by camelCase field path (first message per field). */
  get fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const error of this.errors) {
      if (error.field && !(error.field in result)) {
        result[error.field] = error.message;
      }
    }
    return result;
  }

  get isValidation(): boolean {
    return this.status === 400 && this.errors.some((e) => !!e.field);
  }

  /** True when any error item (or the top-level code) matches. */
  hasCode(code: string): boolean {
    return this.code === code || this.errors.some((e) => e.code === code);
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }
    if (error instanceof HttpErrorResponse) {
      const body = error.error as Partial<ApiEnvelope<unknown>> | null;
      if (body && typeof body === 'object' && Array.isArray(body.errors)) {
        const errors = body.errors;
        const featureCode = errors.find((e) => !e.field)?.code;
        const code = featureCode ?? categoryFor(error.status);
        return new ApiError(error.status, code, body.message ?? errors[0]?.message ?? error.message, errors, body.correlationId ?? null);
      }
      return new ApiError(error.status, categoryFor(error.status), error.status === 0 ? 'Network error' : error.message);
    }
    return new ApiError(0, 'UNKNOWN_ERROR', error instanceof Error ? error.message : String(error));
  }
}

function categoryFor(status: number): string {
  switch (status) {
    case 0:
      return 'NETWORK_ERROR';
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 422:
      return 'BUSINESS_RULE_VIOLATION';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'UNKNOWN_ERROR';
  }
}
