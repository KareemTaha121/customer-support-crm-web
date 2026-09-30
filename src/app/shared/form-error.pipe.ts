import { Pipe, PipeTransform, inject } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { TranslationService } from '../core/localization/translation.service';
import { controlErrorMessage } from './form-errors';

/** `<mat-error>{{ form.controls.email | formError }}</mat-error>` */
@Pipe({ name: 'formError', pure: false })
export class FormErrorPipe implements PipeTransform {
  private readonly translations = inject(TranslationService);

  transform(control: AbstractControl | null | undefined): string {
    return controlErrorMessage(control ?? null, this.translations);
  }
}
