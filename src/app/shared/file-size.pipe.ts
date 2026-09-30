import { Pipe, PipeTransform } from '@angular/core';
import { formatFileSize } from './file-utils';

/** `{{ attachment.size | fileSize }}` */
@Pipe({ name: 'fileSize' })
export class FileSizePipe implements PipeTransform {
  transform(bytes: number | null | undefined): string {
    return formatFileSize(bytes ?? 0);
  }
}
