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
import { Kpi, SlaBreakdownRow } from './reports.models';

/** `/reports/sla` — GET /reports/sla-performance, export sla-performance.csv. */
@Component({
  selector: 'app-sla-performance-page',
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
    <app-report-filter-bar>
      <app-report-export-button *appHasPermission="'reports.export'" kind="sla-performance" />
    </app-report-filter-bar>

    @if (report.data(); as data) {
      <div class="kpis">
        @for (kpi of kpis(); track kpi.label) {
          <div class="crm-card kpi" [class.kpi--danger]="kpi.tone === 'danger'">
            <span class="kpi__label"><mat-icon aria-hidden="true">{{ kpi.icon }}</mat-icon>{{ kpi.label | t }}</span>
            <span class="kpi__value">{{ kpi.value }}</span>
          </div>
        }
      </div>

      <div class="panels">
        <section class="crm-card panel">
          <h2>{{ 'reports.charts.slaByPriority' | t }}</h2>
          <app-report-chart type="bar" [percent]="true" [labels]="priorityLabels()" [series]="prioritySeries()" [ariaLabel]="'reports.charts.slaByPriority' | t" />
          <app-report-table [columns]="priorityColumns" [rows]="data.byPriority" [caption]="'reports.charts.slaByPriority' | t" />
        </section>

        <section class="crm-card panel">
          <h2>{{ 'reports.charts.slaByDepartment' | t }}</h2>
          <app-report-chart
            type="bar"
            [percent]="true"
            [horizontal]="true"
            [labels]="departmentLabels()"
            [series]="departmentSeries()"
            [ariaLabel]="'reports.charts.slaByDepartment' | t"
          />
          <app-report-table [columns]="departmentColumns" [rows]="data.byDepartment" [caption]="'reports.charts.slaByDepartment' | t" />
        </section>
      </div>
    } @else if (report.error()) {
      <app-error-state (retry)="report.reload()" />
    } @else {
      <app-loading />
    }
  `,
})
export class SlaPerformancePage {
  private readonly api = inject(ReportsApi);
  private readonly store = inject(ReportFilterStore);
  private readonly format = inject(ReportFormatter);
  private readonly translations = inject(TranslationService);

  protected readonly report = loadReport(this.store.params, (params) => this.api.slaPerformance(params));

  protected readonly kpis = computed<Kpi[]>(() => {
    const d = this.report.data();
    if (!d) {
      return [];
    }
    const f = this.format;
    return [
      { icon: 'rule', label: 'reports.kpi.ticketsWithSla', value: f.number(d.ticketsWithSla) },
      { icon: 'reply', label: 'reports.kpi.firstResponseCompliance', value: f.percent(d.firstResponseCompliance) },
      { icon: 'done_all', label: 'reports.kpi.resolutionCompliance', value: f.percent(d.resolutionCompliance) },
      { icon: 'alarm', label: 'reports.kpi.firstResponseBreached', value: f.number(d.firstResponseBreached), tone: d.firstResponseBreached ? 'danger' : undefined },
      { icon: 'alarm_off', label: 'reports.kpi.resolutionBreached', value: f.number(d.resolutionBreached), tone: d.resolutionBreached ? 'danger' : undefined },
      { icon: 'schedule', label: 'reports.kpi.avgFirstResponse', value: f.minutes(d.averageFirstResponseMinutes) },
      { icon: 'hourglass_bottom', label: 'reports.kpi.avgResolution', value: f.minutes(d.averageResolutionMinutes) },
    ];
  });

  protected readonly priorityLabels = computed(() => (this.report.data()?.byPriority ?? []).map((r) => this.format.keyLabel(r, 'priority')));
  protected readonly prioritySeries = computed(() => this.complianceSeries(this.report.data()?.byPriority ?? []));
  protected readonly departmentLabels = computed(() => (this.report.data()?.byDepartment ?? []).map((r) => this.format.keyLabel(r)));
  protected readonly departmentSeries = computed(() => this.complianceSeries(this.report.data()?.byDepartment ?? []));

  protected readonly priorityColumns = this.columns('reports.columns.priority', 'priority');
  protected readonly departmentColumns = this.columns('reports.columns.department');

  private complianceSeries(rows: SlaBreakdownRow[]): ChartSeries[] {
    return [
      { label: this.translations.t('reports.series.firstResponseCompliance'), data: rows.map((r) => r.firstResponseCompliance) },
      { label: this.translations.t('reports.series.resolutionCompliance'), data: rows.map((r) => r.resolutionCompliance) },
    ];
  }

  private columns(header: string, group?: ReportEnumGroup): ReportColumn<SlaBreakdownRow>[] {
    return [
      { key: 'label', header, value: (r) => this.format.keyLabel(r, group) },
      { key: 'tickets', header: 'reports.columns.tickets', value: (r) => this.format.number(r.tickets), numeric: true },
      { key: 'fr', header: 'reports.series.firstResponseCompliance', value: (r) => this.format.percent(r.firstResponseCompliance), numeric: true },
      { key: 'res', header: 'reports.series.resolutionCompliance', value: (r) => this.format.percent(r.resolutionCompliance), numeric: true },
      { key: 'breached', header: 'reports.columns.breached', value: (r) => this.format.number(r.breached), numeric: true },
    ];
  }
}
