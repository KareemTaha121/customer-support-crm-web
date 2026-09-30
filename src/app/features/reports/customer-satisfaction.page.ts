import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
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
import { Kpi, RatingCount, SatisfactionPoint } from './reports.models';

/** `/reports/satisfaction` — GET /reports/customer-satisfaction, export customer-satisfaction.csv. */
@Component({
  selector: 'app-customer-satisfaction-page',
  imports: [
    MatIconModule,
    RouterLink,
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
  styles: `
    .comments { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .comment { border-block-end: 1px solid var(--mat-sys-outline-variant); padding-block-end: 12px; }
    .comment:last-child { border-block-end: 0; padding-block-end: 0; }
    .comment__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font: var(--mat-sys-body-small); }
    .comment__text { margin: 6px 0 0; white-space: pre-line; overflow-wrap: anywhere; }
    .stars { display: inline-flex; color: var(--crm-brand-accent); }
    .stars mat-icon { font-size: 16px; width: 16px; height: 16px; }
  `,
  template: `
    <app-report-filter-bar [showGroupBy]="true">
      <app-report-export-button *appHasPermission="'reports.export'" kind="customer-satisfaction" />
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
          <h2>{{ 'reports.charts.satisfactionTrend' | t }}</h2>
          <app-report-chart type="line" [labels]="trendLabels()" [series]="trendSeries()" [ariaLabel]="'reports.charts.satisfactionTrend' | t" />
          <app-report-table [columns]="trendColumns" [rows]="data.trend" [caption]="'reports.charts.satisfactionTrend' | t" />
        </section>

        <section class="crm-card panel">
          <h2>{{ 'reports.charts.ratingDistribution' | t }}</h2>
          <app-report-chart type="bar" [labels]="distributionLabels()" [series]="distributionSeries()" [ariaLabel]="'reports.charts.ratingDistribution' | t" />
          <app-report-table [columns]="distributionColumns" [rows]="distribution()" [caption]="'reports.charts.ratingDistribution' | t" />
        </section>

        <section class="crm-card panel">
          <h2>{{ 'reports.comments.title' | t }}</h2>
          @if (data.recentComments.length) {
            <ul class="comments">
              @for (comment of data.recentComments; track comment.ticketId + comment.submittedAt) {
                <li class="comment">
                  <div class="comment__meta">
                    <a [routerLink]="['/tickets', comment.ticketId]">{{ comment.ticketNumber }}</a>
                    <span class="stars" [attr.aria-label]="'reports.comments.rating' | t: { rating: comment.rating }">
                      @for (star of stars; track star) {
                        <mat-icon aria-hidden="true">{{ star <= comment.rating ? 'star' : 'star_border' }}</mat-icon>
                      }
                    </span>
                    <span class="crm-muted">{{ format.dateTime(comment.submittedAt) }}</span>
                  </div>
                  <p class="comment__text">{{ comment.comment }}</p>
                </li>
              }
            </ul>
          } @else {
            <app-empty-state icon="chat_bubble_outline" [message]="'reports.comments.empty' | t" />
          }
        </section>
      </div>
    } @else if (report.error()) {
      <app-error-state (retry)="report.reload()" />
    } @else {
      <app-loading />
    }
  `,
})
export class CustomerSatisfactionPage {
  private readonly api = inject(ReportsApi);
  private readonly store = inject(ReportFilterStore);
  protected readonly format = inject(ReportFormatter);
  private readonly translations = inject(TranslationService);

  protected readonly stars = [1, 2, 3, 4, 5] as const;
  protected readonly report = loadReport(this.store.params, (params) => this.api.customerSatisfaction(params));

  protected readonly kpis = computed<Kpi[]>(() => {
    const d = this.report.data();
    if (!d) {
      return [];
    }
    return [
      { icon: 'star', label: 'reports.kpi.averageRating', value: this.format.rating(d.average) },
      { icon: 'forum', label: 'reports.kpi.responses', value: this.format.number(d.responses) },
      { icon: 'thumb_up', label: 'reports.kpi.positiveShare', value: this.format.percent(d.positiveShare) },
    ];
  });

  protected readonly trendLabels = computed(() => (this.report.data()?.trend ?? []).map((p) => this.format.period(p.period, this.store.value().groupBy, true)));
  protected readonly trendSeries = computed<ChartSeries[]>(() => [
    { label: this.translations.t('reports.series.averageRating'), data: (this.report.data()?.trend ?? []).map((p) => p.average) },
  ]);

  /** Always show ratings 1–5, even those nobody chose. */
  protected readonly distribution = computed<RatingCount[]>(() => {
    const counts = this.report.data()?.distribution ?? [];
    return this.stars.map((rating) => ({ rating, count: counts.find((c) => c.rating === rating)?.count ?? 0 }));
  });
  protected readonly distributionLabels = computed(() => this.distribution().map((d) => this.translations.t('reports.comments.stars', { rating: d.rating })));
  protected readonly distributionSeries = computed<ChartSeries[]>(() => [
    { label: this.translations.t('reports.kpi.responses'), data: this.distribution().map((d) => d.count) },
  ]);

  protected readonly trendColumns: ReportColumn<SatisfactionPoint>[] = [
    { key: 'period', header: 'reports.columns.period', value: (p) => this.format.period(p.period, this.store.value().groupBy) },
    { key: 'average', header: 'reports.series.averageRating', value: (p) => this.format.rating(p.average), numeric: true },
    { key: 'responses', header: 'reports.kpi.responses', value: (p) => this.format.number(p.responses), numeric: true },
  ];

  protected readonly distributionColumns: ReportColumn<RatingCount>[] = [
    { key: 'rating', header: 'reports.columns.rating', value: (d) => this.translations.t('reports.comments.stars', { rating: d.rating }) },
    { key: 'count', header: 'reports.kpi.responses', value: (d) => this.format.number(d.count), numeric: true },
  ];
}
