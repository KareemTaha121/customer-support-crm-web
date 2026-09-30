import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { saveBlob } from '../../shared/file-utils';
import { ReportFilterStore } from './report-filter.store';
import { ReportsApi } from './reports.api';
import { ReportKind } from './reports.models';

/**
 * Downloads `/reports/export/<kind>.csv` with the current filters. Wrap with
 * `*appHasPermission="'reports.export'"` at the call site.
 */
@Component({
  selector: 'app-report-export-button',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button mat-stroked-button type="button" [disabled]="busy() || !store.params()" (click)="export()">
      @if (busy()) {
        <mat-spinner [diameter]="18" />
      } @else {
        <mat-icon>download</mat-icon>
      }
      {{ 'core.actions.export' | t }}
    </button>
  `,
  styles: `mat-spinner { display: inline-block; margin-inline-end: 8px; }`,
})
export class ReportExportButtonComponent {
  protected readonly store = inject(ReportFilterStore);
  private readonly api = inject(ReportsApi);

  readonly kind = input.required<ReportKind>();
  protected readonly busy = signal(false);

  protected export(): void {
    const params = this.store.params();
    if (!params || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.api.exportCsv(this.kind(), params).subscribe({
      next: ({ blob, fileName }) => {
        saveBlob(blob, fileName);
        this.busy.set(false);
      },
      // The global snackbar reports the failure.
      error: () => this.busy.set(false),
    });
  }
}
