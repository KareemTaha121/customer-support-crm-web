import { AbstractControl, FormGroup } from '@angular/forms';
import { ApiError } from '../core/http/api-error';
import { TranslationService } from '../core/localization/translation.service';

/**
 * Copies server field errors onto matching form controls as `{ server: message }` and returns
 * the messages that matched no control. Field paths are camelCase (`name`, `contacts[0].value`,
 * `items.0.qty` style paths are matched too).
 */
export function applyServerErrors(form: FormGroup, error: unknown): string[] {
  const apiError = ApiError.from(error);
  const unmatched: string[] = [];
  for (const item of apiError.errors) {
    if (!item.field) {
      continue;
    }
    const control = findControl(form, item.field);
    if (control) {
      control.setErrors({ ...(control.errors ?? {}), server: item.message });
      control.markAsTouched();
    } else {
      unmatched.push(item.message);
    }
  }
  return unmatched;
}

function findControl(form: FormGroup, field: string): AbstractControl | null {
  const path = field.replace(/\[(\d+)\]/g, '.$1');
  const direct = form.get(path);
  if (direct) {
    return direct;
  }
  const lower = path.toLowerCase();
  const key = Object.keys(form.controls).find((k) => k.toLowerCase() === lower);
  return key ? form.controls[key] : null;
}

/**
 * The first error message for a control, localized:
 * `<mat-error>{{ fieldError(form.controls.email) }}</mat-error>` via `FormErrorPipe` or this helper.
 */
export function controlErrorMessage(control: AbstractControl | null, t: TranslationService): string {
  const errors = control?.errors;
  if (!errors) {
    return '';
  }
  if (typeof errors['server'] === 'string') {
    return errors['server'];
  }
  if (errors['required']) {
    return t.t('core.validation.required');
  }
  if (errors['email']) {
    return t.t('core.validation.email');
  }
  if (errors['minlength']) {
    return t.t('core.validation.minlength', { length: (errors['minlength'] as { requiredLength: number }).requiredLength });
  }
  if (errors['maxlength']) {
    return t.t('core.validation.maxlength', { length: (errors['maxlength'] as { requiredLength: number }).requiredLength });
  }
  if (errors['min']) {
    return t.t('core.validation.min', { min: (errors['min'] as { min: number }).min });
  }
  if (errors['max']) {
    return t.t('core.validation.max', { max: (errors['max'] as { max: number }).max });
  }
  if (errors['pattern']) {
    return t.t('core.validation.pattern');
  }
  if (errors['mismatch']) {
    return t.t('core.validation.mismatch');
  }
  return t.t('core.validation.invalid');
}
