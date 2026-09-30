import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { TranslationService } from '../../core/localization/translation.service';

const KNOWN_CODES = ['AI_NOT_CONFIGURED', 'AI_REFUSED', 'AI_INVALID_OUTPUT', 'AI_SUGGESTION_NOT_FOUND', 'FEATURE_DISABLED', 'RATE_LIMITED'];

/** Localized inline message for a failed AI call. */
export function describeAiError(error: unknown, translations: TranslationService): string {
  const apiError = ApiError.from(error);
  const code = KNOWN_CODES.find((c) => apiError.hasCode(c));
  return code ? translations.t(`ai.errors.${code}`) : describeError(apiError, translations);
}
