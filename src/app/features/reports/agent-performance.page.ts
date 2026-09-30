import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { HasPermissionDirective } from '../../core/permissions/has-permission.directive';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/state.components';
import { ChartSeries, ReportChartComponent } from './report-chart.component';
import { ReportExportButtonComponent } from './report-export-button.component';
import { ReportFilterBarComponent } from './report-filter-bar.component';
import { ReportFilterStore } from './report-filter.store';
import { ReportFormatter } from './report-format';
import { loadReport } from './report-loader';
import { ReportColumn, ReportTableComponent } from './report-table.component';
import { ReportsApi } from './reports.api';
import { AgentPerformanceRow } from './reports.models';

/** Charts show the busiest agents; the table lists everyone. */
const CHART_LIMIT = 15;

/** `/reports/agents` — GET /reports/agent-performance, export agent-performance.csv. */
@Component({
  selector: 'app-agent-performance-page',
  imports: [
    TranslatePipe,
    HasPermissionDirective,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ReportFilterBarComponent,
    ReportExportButtonComponent,
    ReportChartComponent,
    ReportTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './reports.scss',
  template: `
    <app-report-filter-bar>
      <app-report-export-button *appHasPermission="'reports.export'" kind="agent-performance" />
    </app-report-filter-bar>

    @if (report.data(); as data) {
      @if (data.agents.length) {
        <div class="panels">
          <section class="crm-card panel">
            <h2>{{ 'reports.charts.agentWorkload' | t }}</h2>
            @if (data.agents.length > chartLimit) {
              <p class="panel__hint crm-muted">{{ 'reports.agents.topHint' | t: { count: chartLimit } }}</p>
            }
            <app-report-chart
              type="bar"
              [horizontal]="true"
              [height]="chartHeight()"
              [labels]="labels()"
              [series]="workloadSeries()"
              [ariaLabel]="'reports.charts.agentWorkload' | t"
            />
          </section>

          <section class="crm-card panel">
            <h2>{{ 'reports.charts.agentSla' | t }}</h2>
            @if (data.agents.length > chartLimit) {
              <p class="panel__hint crm-muted">{{ 'reports.agents.topHint' | t: { count: chartLimit } }}</p>
            }
            <app-report-chart
              type="bar"
              [horizontal]="true"
              [percent]="true"
              [height]="chartHeight()"
              [labels]="labels()"
              [series]="slaSeries()"
              [ariaLabel]="'reports.charts.agentSla' | t"
            />
          </section>

          <section class="crm-card panel panel--wide">
            <h2>{{ 'reports.agents.tableTitle' | t }}</h2>
            <app-report-table [columns]="columns" [rows]="data.agents" [caption]="'reports.agents.tableTitle' | t" />
          </section>
        </div>
      } @else {
        <div class="crm-card"><app-empty-state icon="support_agent" [message]="'reports.common.noData' | t" /></div>
      }
    } @else if (report.error()) {
      <app-error-state (retry)="report.reload()" />
    } @else {
      <app-loading />
    }
  `,
})
export class AgentPerformancePage {
  private readonly api = inject(ReportsApi);
  private readonly store = inject(ReportFilterStore);
  private readonly format = inject(ReportFormatter);
  private readonly translations = inject(TranslationService);

  protected readonly chartLimit = CHART_LIMIT;
  protected readonly report = loadReport(this.store.params, (params) => this.api.agentPerformance(params));

  private readonly top = computed(() =>
    [...(this.report.data()?.agents ?? [])].sort((a, b) => b.assigned - a.assigned || b.resolved - a.resolved).slice(0, CHART_LIMIT),
  );

  protected readonly labels = computed(() => this.top().map((a) => a.agentName));
  protected readonly chartHeight = computed(() => Math.max(220, this.top().length * 34 + 80));

  protected readonly workloadSeries = computed<ChartSeries[]>(() => [
    { label: this.translations.t('reports.columns.assigned'), data: this.top().map((a) => a.assigned) },
    { label: this.translations.t('reports.columns.resolved'), data: this.top().map((a) => a.resolved) },
  ]);

  protected readonly slaSeries = computed<ChartSeries[]>(() => [
    { label: this.translations.t('reports.columns.slaCompliance'), data: this.top().map((a) => a.slaCompliance) },
  ]);

  protected readonly columns: ReportColumn<AgentPerformanceRow>[] = [
    { key: 'agent', header: 'reports.columns.agent', value: (a) => a.agentName },
    { key: 'assigned', header: 'reports.columns.assigned', value: (a) => this.format.number(a.assigned), numeric: true },
    { key: 'resolved', header: 'reports.columns.resolved', value: (a) => this.format.number(a.resolved), numeric: true },
    { key: 'openNow', header: 'reports.columns.openNow', value: (a) => this.format.number(a.openNow), numeric: true },
    { key: 'fr', header: 'reports.columns.avgFirstResponse', value: (a) => this.format.minutes(a.averageFirstResponseMinutes), numeric: true },
    { key: 'res', header: 'reports.columns.avgResolution', value: (a) => this.format.minutes(a.averageResolutionMinutes), numeric: true },
    { key: 'sla', header: 'reports.columns.slaCompliance', value: (a) => this.format.percent(a.slaCompliance), numeric: true },
    { key: 'csat', header: 'reports.columns.avgSatisfaction', value: (a) => this.format.rating(a.averageSatisfaction), numeric: true },
    { key: 'csatCount', header: 'reports.columns.satisfactionResponses', value: (a) => this.format.number(a.satisfactionResponses), numeric: true },
  ];
}
