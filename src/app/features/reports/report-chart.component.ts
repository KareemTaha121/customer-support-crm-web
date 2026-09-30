import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Chart, ChartConfiguration, ChartDataset, ChartType, TooltipItem, registerables } from 'chart.js';
import { TranslationService } from '../../core/localization/translation.service';
import { ReportFormatter } from './report-format';

Chart.register(...registerables);

export type ReportChartType = 'line' | 'bar' | 'doughnut';

export interface ChartSeries {
  label: string;
  data: readonly (number | null)[];
}

/**
 * Categorical fallback (validated default palette, fixed order). The theme's primary and tertiary
 * colors take the first two slots when the Material system variables are available.
 */
const FALLBACK_PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

type AnyChart = Chart<ChartType, (number | null)[], string>;
type AnyConfig = ChartConfiguration<ChartType, (number | null)[], string>;

/**
 * Thin Chart.js wrapper: `<app-report-chart type="line" [labels]="labels" [series]="series" [ariaLabel]="title" />`.
 * Updates in place when data/language/theme change, recreates on type change, destroys on teardown.
 */
@Component({
  selector: 'app-report-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart" [style.height.px]="height()">
      <canvas #canvas role="img" [attr.aria-label]="ariaLabel()"></canvas>
    </div>
    <span #probe class="probe" aria-hidden="true"></span>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .chart { position: relative; width: 100%; }
    .probe { position: absolute; width: 0; height: 0; overflow: hidden; visibility: hidden; }
  `,
})
export class ReportChartComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly translations = inject(TranslationService);
  private readonly format = inject(ReportFormatter);

  readonly type = input<ReportChartType>('bar');
  readonly labels = input.required<readonly string[]>();
  readonly series = input.required<readonly ChartSeries[]>();
  /** Horizontal bars (long category names). */
  readonly horizontal = input(false);
  readonly stacked = input(false);
  /** Values are percentages (0–100). */
  readonly percent = input(false);
  readonly height = input(280);
  readonly ariaLabel = input('');

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly probe = viewChild.required<ElementRef<HTMLElement>>('probe');
  private readonly schemeVersion = signal(0);
  private chart: AnyChart | null = null;
  /** Type of the current chart (Chart.js config typing does not expose it). */
  private chartType: ReportChartType | null = null;

  constructor() {
    const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    const onSchemeChange = () => this.schemeVersion.update((v) => v + 1);
    media?.addEventListener('change', onSchemeChange);

    afterRenderEffect(() => this.render());

    inject(DestroyRef).onDestroy(() => {
      media?.removeEventListener('change', onSchemeChange);
      this.chart?.destroy();
      this.chart = null;
      this.chartType = null;
    });
  }

  private render(): void {
    // Signals read here are tracked by the effect.
    const type = this.type();
    const labels = [...this.labels()];
    const series = this.series();
    const horizontal = this.horizontal();
    const stacked = this.stacked();
    const percent = this.percent();
    const rtl = this.translations.isRtl();
    this.translations.language();
    this.schemeVersion();

    const palette = this.palette();
    const text = this.resolve('--mat-sys-on-surface-variant', '#5f6368');
    const grid = this.resolve('--mat-sys-outline-variant', '#dadce0');
    const surface = this.resolve('--mat-sys-surface-container-lowest', '#ffffff');
    const family = getComputedStyle(this.host.nativeElement).fontFamily;
    const font = { family };

    const formatValue = (value: number | null) => (percent ? this.format.percent(value) : this.format.number(value, 2));

    let datasets: ChartDataset<ChartType, (number | null)[]>[];
    if (type === 'doughnut') {
      const { labels: folded, values } = this.fold(labels, [...(series[0]?.data ?? [])], palette.length);
      labels.splice(0, labels.length, ...folded);
      datasets = [
        {
          label: series[0]?.label ?? '',
          data: values,
          backgroundColor: values.map((_, i) => palette[i]),
          borderColor: surface,
          borderWidth: 2,
          hoverOffset: 4,
        } as ChartDataset<'doughnut', (number | null)[]>,
      ];
    } else if (type === 'line') {
      datasets = series.map(
        (s, i) =>
          ({
            label: s.label,
            data: [...s.data],
            borderColor: palette[i],
            backgroundColor: palette[i],
            borderWidth: 2,
            pointRadius: labels.length > 45 ? 0 : 3,
            pointHoverRadius: 5,
            tension: 0.25,
            spanGaps: true,
            fill: false,
          }) as ChartDataset<'line', (number | null)[]>,
      );
    } else {
      datasets = series.map(
        (s, i) =>
          ({
            label: s.label,
            data: [...s.data],
            backgroundColor: palette[i],
            borderRadius: 4,
            borderSkipped: 'start',
            categoryPercentage: 0.7,
            barPercentage: 0.9,
            maxBarThickness: 40,
          }) as ChartDataset<'bar', (number | null)[]>,
      );
    }

    const showLegend = type === 'doughnut' || series.length > 1;
    const valueAxis = {
      beginAtZero: true,
      stacked,
      max: percent ? 100 : undefined,
      grid: { color: grid },
      border: { display: false },
      ticks: { color: text, font, precision: percent ? undefined : 0, callback: (v: string | number) => (percent ? `${v}%` : this.format.number(Number(v))) },
    };
    const categoryAxis = {
      stacked,
      grid: { display: false },
      border: { color: grid },
      ticks: { color: text, font, autoSkip: true, maxRotation: 0 },
    };

    const options: AnyConfig['options'] = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      locale: this.translations.language() === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB',
      indexAxis: horizontal ? 'y' : 'x',
      interaction: type === 'doughnut' ? { mode: 'nearest', intersect: true } : { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: showLegend,
          position: type === 'doughnut' ? (rtl ? 'left' : 'right') : 'bottom',
          rtl,
          textDirection: rtl ? 'rtl' : 'ltr',
          labels: { color: text, font, usePointStyle: true, boxWidth: 8, boxHeight: 8 },
        },
        tooltip: {
          rtl,
          textDirection: rtl ? 'rtl' : 'ltr',
          titleFont: font,
          bodyFont: font,
          callbacks: {
            label: (item: TooltipItem<ChartType>) => {
              const name = type === 'doughnut' ? item.label : item.dataset.label;
              return ` ${name}: ${formatValue(item.raw as number | null)}`;
            },
          },
        },
      },
      scales:
        type === 'doughnut'
          ? {}
          : horizontal
            ? { x: { ...valueAxis, reverse: rtl }, y: { ...categoryAxis, position: rtl ? 'right' : 'left' } }
            : { x: { ...categoryAxis, reverse: rtl }, y: { ...valueAxis, position: rtl ? 'right' : 'left' } },
      ...(type === 'doughnut' ? { cutout: '60%' } : {}),
    } as AnyConfig['options'];

    const data = { labels, datasets };
    if (this.chart && this.chartType === type) {
      this.chart.data = data;
      if (options) {
        this.chart.options = options;
      }
      this.chart.update();
      return;
    }
    this.chart?.destroy();
    this.chart = new Chart<ChartType, (number | null)[], string>(this.canvas().nativeElement, { type, data, options } as AnyConfig);
    this.chartType = type;
  }

  /** Doughnut slices beyond the palette size fold into "Other" (hues are never cycled). */
  private fold(labels: string[], values: (number | null)[], max: number): { labels: string[]; values: (number | null)[] } {
    if (labels.length <= max) {
      return { labels, values };
    }
    const rest = values.slice(max - 1).reduce<number>((sum, v) => sum + (v ?? 0), 0);
    return {
      labels: [...labels.slice(0, max - 1), this.translations.t('reports.common.other')],
      values: [...values.slice(0, max - 1), rest],
    };
  }

  private palette(): string[] {
    const primary = this.resolve('--mat-sys-primary', null);
    const tertiary = this.resolve('--mat-sys-tertiary', null);
    const themed = [primary, tertiary].filter((c): c is string => !!c);
    const rest = FALLBACK_PALETTE.filter((_, i) => i >= themed.length || !primary);
    return [...themed, ...rest].slice(0, FALLBACK_PALETTE.length);
  }

  /** Resolves a CSS custom property to a concrete color (handles `light-dark()`/nested vars). */
  private resolve(name: string, fallback: string): string;
  private resolve(name: string, fallback: null): string | null;
  private resolve(name: string, fallback: string | null): string | null {
    const declared = getComputedStyle(this.host.nativeElement).getPropertyValue(name).trim();
    if (!declared) {
      return fallback;
    }
    const probe = this.probe().nativeElement;
    probe.style.color = `var(${name})`;
    const color = getComputedStyle(probe).color;
    return color || fallback;
  }
}
