import { FormGroup } from '@angular/forms';
import { ApiError } from '../../core/http/api-error';
import { applyServerErrors } from '../../shared/form-errors';

/**
 * The save validators address fields through the command (`Article.Title`, `Category.Name`);
 * strip that prefix so {@link applyServerErrors} finds the form controls. Returns unmatched messages.
 */
export function applyKbServerErrors(form: FormGroup, error: unknown, prefix: 'article' | 'category'): string[] {
  const apiError = ApiError.from(error);
  const pattern = new RegExp(`^${prefix}\\.`, 'i');
  const errors = apiError.errors.map((item) => (item.field ? { ...item, field: item.field.replace(pattern, '') } : item));
  return applyServerErrors(form, new ApiError(apiError.status, apiError.code, apiError.message, errors, apiError.correlationId));
}
