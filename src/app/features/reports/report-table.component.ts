import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { EmptyStateComponent } from '../../shared/state.components';

export interface ReportColumn<T> {
  key: string;
  /** Translation key of the header. */
  header: string;
  value: (row: T) => string | number;
  numeric?: boolean;
}

/** Data table shown under each chart: `<app-report-table [columns]="cols" [rows]="rows" />`. */
@Component({
  selector: 'app-report-table',
  imports: [MatTableModule, TranslatePipe, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length) {
      <div class="crm-table-wrap report-table">
        <table mat-table [dataSource]="rows()" [attr.aria-label]="caption()">
          @for (column of columns(); track column.key) {
            <ng-container [matColumnDef]="column.key">
              <th mat-header-cell *matHeaderCellDef [class.numeric]="column.numeric">{{ column.header | t }}</th>
              <td mat-cell *matCellDef="let row" [class.numeric]="column.numeric">{{ column.value(row) }}</td>
            </ng-container>
          }
          <tr mat-header-row *matHeaderRowDef="columnKeys()"></tr>
          <tr mat-row *matRowDef="let row; columns: columnKeys()"></tr>
        </table>
      </div>
    } @else {
      <app-empty-state icon="table_chart" [message]="'reports.common.noData' | t" />
    }
  `,
  styles: `
    .report-table { max-height: 360px; overflow: auto; }
    .numeric { text-align: end; font-variant-numeric: tabular-nums; white-space: nowrap; }
    th.mat-mdc-header-cell { white-space: nowrap; }
  `,
})
export class ReportTableComponent<T> {
  readonly columns = input.required<readonly ReportColumn<T>[]>();
  readonly rows = input.required<readonly T[]>();
  readonly caption = input('');

  protected readonly columnKeys = computed(() => this.columns().map((c) => c.key));
}
