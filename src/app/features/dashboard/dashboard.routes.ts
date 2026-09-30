import { Routes } from '@angular/router';
import { translationResolver } from '../../core/localization/translation.resolver';

/**
 * `/dashboard` — the default landing page for every signed-in staff user (no permission guard;
 * the page handles a missing tickets.view itself). Tasks and quick replies are child routes.
 */
export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    resolve: { i18n: translationResolver('dashboard') },
    children: [
      { path: '', loadComponent: () => import('./dashboard.page').then((m) => m.DashboardPage) },
      { path: 'tasks', loadComponent: () => import('./tasks.page').then((m) => m.TasksPage) },
      { path: 'quick-replies', loadComponent: () => import('./quick-replies.page').then((m) => m.QuickRepliesPage) },
    ],
  },
];
