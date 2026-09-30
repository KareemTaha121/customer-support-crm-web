import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { FileSizePipe } from '../../../shared/file-size.pipe';
import { MAX_ATTACHMENTS } from '../customer-portal.models';

/** Selects files to attach: `<app-portal-file-picker [(files)]="files" />` (at most 10). */
@Component({
  selector: 'app-portal-file-picker',
  imports: [MatButtonModule, MatIconModule, MatChipsModule, TranslatePipe, FileSizePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="picker">
      <input #picker type="file" multiple hidden (change)="add(picker)" />
      <button mat-stroked-button type="button" [disabled]="disabled() || files().length >= max" (click)="picker.click()">
        <mat-icon>attach_file</mat-icon>
        {{ 'portal.files.add' | t }}
      </button>
      <span class="crm-muted">{{ 'portal.files.limit' | t: { max: max } }}</span>
    </div>
    @if (files().length) {
      <mat-chip-set [attr.aria-label]="'portal.files.selected' | t">
        @for (file of files(); track $index) {
          <mat-chip [removable]="!disabled()" (removed)="remove($index)">
            {{ file.name }} ({{ file.size | fileSize }})
            <button matChipRemove type="button" [attr.aria-label]="'portal.files.remove' | t: { name: file.name }">
              <mat-icon>cancel</mat-icon>
            </button>
          </mat-chip>
        }
      </mat-chip-set>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 8px; }
    .picker { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
  `,
})
export class PortalFilePickerComponent {
  readonly files = model<File[]>([]);
  readonly disabled = input(false);
  readonly max = MAX_ATTACHMENTS;

  add(picker: HTMLInputElement): void {
    const chosen = Array.from(picker.files ?? []);
    picker.value = '';
    this.files.update((current) => [...current, ...chosen].slice(0, this.max));
  }

  remove(index: number): void {
    this.files.update((current) => current.filter((_, i) => i !== index));
  }
}
