import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

/** Application/Common/Validation/CommonRules.cs */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordValidators: ValidatorFn[] = [
  Validators.required,
  Validators.minLength(PASSWORD_MIN_LENGTH),
  Validators.maxLength(PASSWORD_MAX_LENGTH),
];

/** Group validator: sets `{ mismatch: true }` on `confirmField` when it differs from `field`. */
export function matchFields(field: string, confirmField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const value = group.get(field)?.value as unknown;
    const confirm = group.get(confirmField);
    if (!confirm) {
      return null;
    }
    const errors = { ...(confirm.errors ?? {}) };
    if (confirm.value && value !== confirm.value) {
      confirm.setErrors({ ...errors, mismatch: true });
    } else if (errors['mismatch']) {
      delete errors['mismatch'];
      confirm.setErrors(Object.keys(errors).length ? errors : null);
    }
    return null;
  };
}
