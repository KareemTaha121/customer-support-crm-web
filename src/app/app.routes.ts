import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guards';
import { StaffShellComponent } from './core/layout/staff-shell.component';
import { ForbiddenComponent, NotFoundComponent } from './core/layout/status-pages.component';

/**
 * Top-level routes. Every feature owns a lazy `*.routes.ts` file; features add their own
 * guards, translation resolvers and child routes there.
 */
export const routes: Routes = [
  // Staff sign-in (guest only).
  { path: 'login', loadChildren: () => import('./features/auth/auth.routes').then((m) => m.LOGIN_ROUTES) },

  // Customer portal: its own layout and session (portal login, tickets, chat widget, web form).
  { path: 'portal', loadChildren: () => import('./features/customer-portal/customer-portal.routes').then((m) => m.PORTAL_ROUTES) },

  // Public help center (anonymous).
  { path: 'help', loadChildren: () => import('./features/knowledge-base/knowledge-base.routes').then((m) => m.HELP_CENTER_ROUTES) },

  // Staff application.
  {
    path: '',
    component: StaffShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES) },
      { path: 'tickets', loadChildren: () => import('./features/tickets/tickets.routes').then((m) => m.TICKETS_ROUTES) },
      { path: 'customers', loadChildren: () => import('./features/customers/customers.routes').then((m) => m.CUSTOMERS_ROUTES) },
      { path: 'chat', loadChildren: () => import('./features/channels/channels.routes').then((m) => m.CHAT_ROUTES) },
      { path: 'channels', loadChildren: () => import('./features/channels/channels.routes').then((m) => m.CHANNELS_ROUTES) },
      { path: 'knowledge-base', loadChildren: () => import('./features/knowledge-base/knowledge-base.routes').then((m) => m.KNOWLEDGE_BASE_ROUTES) },
      { path: 'sla', loadChildren: () => import('./features/sla/sla.routes').then((m) => m.SLA_ROUTES) },
      { path: 'reports', loadChildren: () => import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES) },
      { path: 'admin', loadChildren: () => import('./features/administration/administration.routes').then((m) => m.ADMINISTRATION_ROUTES) },
      { path: 'profile', loadChildren: () => import('./features/auth/auth.routes').then((m) => m.PROFILE_ROUTES) },
      { path: 'forbidden', component: ForbiddenComponent },
      { path: '**', component: NotFoundComponent },
    ],
  },
];
