import { Routes } from '@angular/router';
import { requirePermission } from '../../core/guards/auth.guards';
import { translationResolver } from '../../core/localization/translation.resolver';
import { Permissions } from '../../core/permissions/permissions';

export const TICKETS_ROUTES: Routes = [
  {
    path: '',
    resolve: { i18n: translationResolver('tickets') },
    children: [
      {
        path: '',
        canActivate: [requirePermission(Permissions.ticketsView)],
        loadComponent: () => import('./ticket-list.page').then((m) => m.TicketListPage),
      },
      {
        path: 'new',
        canActivate: [requirePermission(Permissions.ticketsCreate)],
        loadComponent: () => import('./ticket-create.page').then((m) => m.TicketCreatePage),
      },
      {
        path: 'categories',
        canActivate: [requirePermission(Permissions.ticketCategoriesManage)],
        loadComponent: () => import('./ticket-categories.page').then((m) => m.TicketCategoriesPage),
      },
      {
        path: ':id',
        canActivate: [requirePermission(Permissions.ticketsView)],
        loadComponent: () => import('./ticket-details.page').then((m) => m.TicketDetailsPage),
      },
    ],
  },
];
