import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { HasPermissionDirective } from '../../core/permissions/has-permission.directive';
import { ErrorStateComponent, LoadingComponent } from '../../shared/state.components';
import { ChartSeries, ReportChartComponent } from './report-chart.component';
import { ReportExportButtonComponent } from './report-export-button.component';
import { ReportFilterBarComponent } from './report-filter-bar.component';
import { ReportFilterStore } from './report-filter.store';
import { ReportEnumGroup, ReportFormatter } from './report-format';
import { loadReport } from './report-loader';
import { ReportColumn, ReportTableComponent } from './report-table.component';
import { ReportsApi } from './reports.api';
import { CountByKey, Kpi, TicketVolumeReport, VolumePoint } from './reports.models';

interface Breakdown {
  id: string;
  title: string;
  header: string;
  type: 'bar' | 'doughnut';
  horizontal: boolean;
  labels: string[];
  series: ChartSeries[];
  rows: CountByKey[];
  columns: ReportColumn<CountByKey>[];
}

/** `/reports/ticket-volume` — GET /reports/ticket-volume, export ticket-volume.csv. */
@Component({
  selector: 'app-ticket-volume-page',
  imports: [
    MatIconModule,
    TranslatePipe,
    HasPermissionDirective,
    LoadingComponent,
    ErrorStateComponent,
    ReportFilterBarComponent,
    ReportExportButtonComponent,
    ReportChartComponent,
    ReportTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './reports.scss',
  template: `
    <app-report-filter-bar [showGroupBy]="true">
      <app-report-export-button *appHasPermission="'reports.export'" kind="ticket-volume" />
    </app-report-filter-bar>

    @if (report.data(); as data) {
      <div class="kpis">
        @for (kpi of kpis(); track kpi.label) {
          <div class="crm-card kpi">
            <span class="kpi__label"><mat-icon aria-hidden="true">{{ kpi.icon }}</mat-icon>{{ kpi.label | t }}</span>
            <span class="kpi__value">{{ kpi.value }}</span>
          </div>
        }
      </div>

      <div class="panels">
        <section class="crm-card panel panel--wide">
          <h2>{{ 'reports.charts.volumeTrend' | t }}</h2>
          <app-report-chart type="line" [labels]="trendLabels()" [series]="trendSeries()" [ariaLabel]="'reports.charts.volumeTrend' | t" />
          <app-report-table [columns]="trendColumns" [rows]="data.series" [caption]="'reports.charts.volumeTrend' | t" />
        </section>

        @for (item of breakdowns(); track item.id) {
          <section class="crm-card panel">
            <h2>{{ item.title | t }}</h2>
            <app-report-chart [type]="item.type" [horizontal]="item.horizontal" [labels]="item.labels" [series]="item.series" [ariaLabel]="item.title | t" />
            <app-report-table [columns]="item.columns" [rows]="item.rows" [caption]="item.title | t" />
          </section>
        }
      </div>
    } @else if (report.error()) {
      <app-error-state (retry)="report.reload()" />
    } @else {
      <app-loading />
    }
  `,
})
export class TicketVolumePage {
  private readonly api = inject(ReportsApi);
  private readonly store = inject(ReportFilterStore);
  private readonly format = inject(ReportFormatter);
  private readonly translations = inject(TranslationService);

  protected readonly report = loadReport(this.store.params, (params) => this.api.ticketVolume(params));

  protected readonly kpis = computed<Kpi[]>(() => {
    const d = this.report.data();
    if (!d) {
      return [];
    }
    return [
      { icon: 'add_circle', label: 'reports.kpi.totalCreated', value: this.format.number(d.totalCreated) },
      { icon: 'task_alt', label: 'reports.kpi.totalResolved', value: this.format.number(d.totalResolved) },
      {
        icon: 'percent',
        label: 'reports.kpi.resolutionRatio',
        value: d.totalCreated ? this.format.percent(Math.round((d.totalResolved / d.totalCreated) * 1000) / 10) : this.format.percent(null),
      },
    ];
  });

  protected readonly trendLabels = computed(() => {
    const d = this.report.data();
    return (d?.series ?? []).map((p) => this.format.period(p.period, d?.groupBy ?? 'day', true));
  });

  protected readonly trendSeries = computed<ChartSeries[]>(() => {
    const points = this.report.data()?.series ?? [];
    return [
      { label: this.translations.t('reports.series.created'), data: points.map((p) => p.created) },
      { label: this.translations.t('reports.series.resolved'), data: points.map((p) => p.resolved) },
    ];
  });

  protected readonly trendColumns: ReportColumn<VolumePoint>[] = [
    { key: 'period', header: 'reports.columns.period', value: (p) => this.format.period(p.period, this.report.data()?.groupBy ?? 'day') },
    { key: 'created', header: 'reports.series.created', value: (p) => this.format.number(p.created), numeric: true },
    { key: 'resolved', header: 'reports.series.resolved', value: (p) => this.format.number(p.resolved), numeric: true },
  ];

  private readonly columnCache = new Map<string, ReportColumn<CountByKey>[]>();

  protected readonly breakdowns = computed<Breakdown[]>(() => {
    const d = this.report.data();
    if (!d) {
      return [];
    }
    return [
      this.breakdown(d, 'byStatus', 'reports.charts.byStatus', 'reports.columns.status', 'doughnut', false, 'status'),
      this.breakdown(d, 'byPriority', 'reports.charts.byPriority', 'reports.columns.priority', 'bar', false, 'priority'),
      this.breakdown(d, 'byChannel', 'reports.charts.byChannel', 'reports.columns.channel', 'bar', true, 'channel'),
      this.breakdown(d, 'byCategory', 'reports.charts.byCategory', 'reports.columns.category', 'bar', true),
    ];
  });

  private breakdown(
    report: TicketVolumeReport,
    id: 'byStatus' | 'byPriority' | 'byChannel' | 'byCategory',
    title: string,
    header: string,
    type: 'bar' | 'doughnut',
    horizontal: boolean,
    group?: ReportEnumGroup,
  ): Breakdown {
    const rows = report[id];
    let columns = this.columnCache.get(id);
    if (!columns) {
      columns = [
        { key: 'label', header, value: (c) => this.format.keyLabel(c, group) },
        { key: 'count', header: 'reports.columns.tickets', value: (c) => this.format.number(c.count), numeric: true },
      ];
      this.columnCache.set(id, columns);
    }
    return {
      id,
      title,
      header,
      type,
      horizontal,
      rows,
      columns,
      labels: rows.map((c) => this.format.keyLabel(c, group)),
      series: [{ label: this.translations.t('reports.series.tickets'), data: rows.map((c) => c.count) }],
    };
  }
}
