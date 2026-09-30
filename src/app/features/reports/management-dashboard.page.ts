import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { ErrorStateComponent, LoadingComponent } from '../../shared/state.components';
import { ChartSeries, ReportChartComponent } from './report-chart.component';
import { ReportFilterBarComponent } from './report-filter-bar.component';
import { ReportFilterStore } from './report-filter.store';
import { ReportFormatter } from './report-format';
import { loadReport } from './report-loader';
import { ReportColumn, ReportTableComponent } from './report-table.component';
import { ReportsApi } from './reports.api';
import { CountByKey, Kpi, VolumePoint } from './reports.models';

/** `/reports/dashboard` — GET /reports/management-dashboard (fixed windows; branch/department apply). */
@Component({
  selector: 'app-management-dashboard-page',
  imports: [MatIconModule, TranslatePipe, LoadingComponent, ErrorStateComponent, ReportFilterBarComponent, ReportChartComponent, ReportTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './reports.scss',
  template: `
    <app-report-filter-bar [showRange]="false" [note]="'reports.dashboard.note' | t" />

    @if (report.data(); as data) {
      <div class="kpis">
        @for (kpi of kpis(); track kpi.label) {
          <div class="crm-card kpi" [class.kpi--warn]="kpi.tone === 'warn'" [class.kpi--danger]="kpi.tone === 'danger'">
            <span class="kpi__label"><mat-icon aria-hidden="true">{{ kpi.icon }}</mat-icon>{{ kpi.label | t }}</span>
            <span class="kpi__value">{{ kpi.value }}</span>
          </div>
        }
      </div>

      <div class="panels">
        <section class="crm-card panel panel--wide">
          <h2>{{ 'reports.charts.last14Days' | t }}</h2>
          <app-report-chart type="line" [labels]="trendLabels()" [series]="trendSeries()" [ariaLabel]="'reports.charts.last14Days' | t" />
          <app-report-table [columns]="volumeColumns()" [rows]="data.last14Days" [caption]="'reports.charts.last14Days' | t" />
        </section>

        <section class="crm-card panel">
          <h2>{{ 'reports.charts.backlogByDepartment' | t }}</h2>
          <app-report-chart
            type="bar"
            [horizontal]="true"
            [labels]="backlogLabels()"
            [series]="backlogSeries()"
            [ariaLabel]="'reports.charts.backlogByDepartment' | t"
          />
          <app-report-table [columns]="countColumns('reports.columns.department')" [rows]="data.backlogByDepartment" />
        </section>

        <section class="crm-card panel">
          <h2>{{ 'reports.charts.topCategories' | t }}</h2>
          <app-report-chart type="doughnut" [labels]="categoryLabels()" [series]="categorySeries()" [ariaLabel]="'reports.charts.topCategories' | t" />
          <app-report-table [columns]="countColumns('reports.columns.category')" [rows]="data.topCategories30d" />
        </section>
      </div>
    } @else if (report.error()) {
      <app-error-state (retry)="report.reload()" />
    } @else {
      <app-loading />
    }
  `,
})
export class ManagementDashboardPage {
  private readonly api = inject(ReportsApi);
  private readonly store = inject(ReportFilterStore);
  private readonly format = inject(ReportFormatter);
  private readonly translations = inject(TranslationService);

  protected readonly report = loadReport(this.store.params, (params) => this.api.managementDashboard(params));

  protected readonly kpis = computed<Kpi[]>(() => {
    const d = this.report.data();
    if (!d) {
      return [];
    }
    const f = this.format;
    return [
      { icon: 'inbox', label: 'reports.kpi.openTickets', value: f.number(d.openTickets) },
      { icon: 'person_off', label: 'reports.kpi.unassigned', value: f.number(d.unassignedTickets), tone: d.unassignedTickets ? 'warn' : undefined },
      { icon: 'priority_high', label: 'reports.kpi.escalated', value: f.number(d.escalatedTickets), tone: d.escalatedTickets ? 'danger' : undefined },
      { icon: 'warning', label: 'reports.kpi.atRisk', value: f.number(d.atRiskTickets), tone: d.atRiskTickets ? 'warn' : undefined },
      { icon: 'add_circle', label: 'reports.kpi.createdToday', value: f.number(d.createdToday) },
      { icon: 'task_alt', label: 'reports.kpi.resolvedToday', value: f.number(d.resolvedToday) },
      { icon: 'verified', label: 'reports.kpi.slaCompliance30d', value: f.percent(d.slaCompliance30d) },
      { icon: 'star', label: 'reports.kpi.satisfaction30d', value: f.rating(d.satisfaction30d) },
      { icon: 'reply', label: 'reports.kpi.firstResponse30d', value: f.minutes(d.averageFirstResponseMinutes30d) },
      { icon: 'done_all', label: 'reports.kpi.resolution30d', value: f.minutes(d.averageResolutionMinutes30d) },
    ];
  });

  protected readonly trendLabels = computed(() => (this.report.data()?.last14Days ?? []).map((p) => this.format.period(p.period, 'day', true)));
  protected readonly trendSeries = computed<ChartSeries[]>(() => {
    const points = this.report.data()?.last14Days ?? [];
    return [
      { label: this.translations.t('reports.series.created'), data: points.map((p) => p.created) },
      { label: this.translations.t('reports.series.resolved'), data: points.map((p) => p.resolved) },
    ];
  });

  protected readonly backlogLabels = computed(() => (this.report.data()?.backlogByDepartment ?? []).map((c) => this.format.keyLabel(c)));
  protected readonly backlogSeries = computed<ChartSeries[]>(() => [
    { label: this.translations.t('reports.series.openTickets'), data: (this.report.data()?.backlogByDepartment ?? []).map((c) => c.count) },
  ]);

  protected readonly categoryLabels = computed(() => (this.report.data()?.topCategories30d ?? []).map((c) => this.format.keyLabel(c)));
  protected readonly categorySeries = computed<ChartSeries[]>(() => [
    { label: this.translations.t('reports.series.tickets'), data: (this.report.data()?.topCategories30d ?? []).map((c) => c.count) },
  ]);

  protected readonly volumeColumns = computed<ReportColumn<VolumePoint>[]>(() => {
    this.translations.language();
    return [
      { key: 'period', header: 'reports.columns.date', value: (p) => this.format.period(p.period, 'day') },
      { key: 'created', header: 'reports.series.created', value: (p) => this.format.number(p.created), numeric: true },
      { key: 'resolved', header: 'reports.series.resolved', value: (p) => this.format.number(p.resolved), numeric: true },
    ];
  });

  private readonly countColumnCache = new Map<string, ReportColumn<CountByKey>[]>();

  /** Stable column definitions per header (the table re-renders its cells on language change). */
  protected countColumns(header: string): ReportColumn<CountByKey>[] {
    let columns = this.countColumnCache.get(header);
    if (!columns) {
      columns = [
        { key: 'label', header, value: (c) => this.format.keyLabel(c) },
        { key: 'count', header: 'reports.columns.tickets', value: (c) => this.format.number(c.count), numeric: true },
      ];
      this.countColumnCache.set(header, columns);
    }
    return columns;
  }
}
