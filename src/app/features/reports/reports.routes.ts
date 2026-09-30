import { Routes } from '@angular/router';
import { requirePermission } from '../../core/guards/auth.guards';
import { translationResolver } from '../../core/localization/translation.resolver';
import { Permissions } from '../../core/permissions/permissions';
import { ReportFilterStore } from './report-filter.store';
import { ReportsShellComponent } from './reports-shell.component';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [requirePermission(Permissions.reportsView)],
    resolve: { i18n: translationResolver('reports') },
    // One filter state for all tabs.
    providers: [ReportFilterStore],
    component: ReportsShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./management-dashboard.page').then((m) => m.ManagementDashboardPage) },
      { path: 'ticket-volume', loadComponent: () => import('./ticket-volume.page').then((m) => m.TicketVolumePage) },
      { path: 'sla', loadComponent: () => import('./sla-performance.page').then((m) => m.SlaPerformancePage) },
      { path: 'agents', loadComponent: () => import('./agent-performance.page').then((m) => m.AgentPerformancePage) },
      { path: 'satisfaction', loadComponent: () => import('./customer-satisfaction.page').then((m) => m.CustomerSatisfactionPage) },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
