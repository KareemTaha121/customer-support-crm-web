import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { PageHeaderComponent } from '../../shared/page-header.component';

interface ReportTab {
  path: string;
  label: string;
  icon: string;
}

/** `/reports`: title, one tab per report (child routes), shared filter state from the route providers. */
@Component({
  selector: 'app-reports-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatTabsModule, MatIconModule, TranslatePipe, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'reports.title' | t" [subtitle]="'reports.subtitle' | t" />
    <nav mat-tab-nav-bar [tabPanel]="panel" class="tabs" [attr.aria-label]="'reports.title' | t">
      @for (tab of tabs; track tab.path) {
        <a mat-tab-link [routerLink]="tab.path" routerLinkActive #active="routerLinkActive" [active]="active.isActive">
          <mat-icon class="tabs__icon">{{ tab.icon }}</mat-icon>
          {{ tab.label | t }}
        </a>
      }
    </nav>
    <mat-tab-nav-panel #panel class="content">
      <router-outlet />
    </mat-tab-nav-panel>
  `,
  styles: `
    :host { display: block; }
    .tabs { margin-block-end: var(--crm-gap); }
    .tabs__icon { margin-inline-end: 6px; }
    .content { display: block; }
  `,
})
export class ReportsShellComponent {
  protected readonly tabs: readonly ReportTab[] = [
    { path: 'dashboard', label: 'reports.tabs.dashboard', icon: 'space_dashboard' },
    { path: 'ticket-volume', label: 'reports.tabs.ticketVolume', icon: 'stacked_line_chart' },
    { path: 'sla', label: 'reports.tabs.sla', icon: 'timer' },
    { path: 'agents', label: 'reports.tabs.agents', icon: 'support_agent' },
    { path: 'satisfaction', label: 'reports.tabs.satisfaction', icon: 'sentiment_satisfied' },
  ];
}
