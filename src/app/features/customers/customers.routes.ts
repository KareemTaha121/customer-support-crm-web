import { Routes } from '@angular/router';
import { requirePermission } from '../../core/guards/auth.guards';
import { translationResolver } from '../../core/localization/translation.resolver';
import { Permissions } from '../../core/permissions/permissions';

/** `/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/edit`. */
export const CUSTOMERS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [requirePermission(Permissions.customersView)],
    resolve: { i18n: translationResolver('customers') },
    children: [
      { path: '', loadComponent: () => import('./customer-list.page').then((m) => m.CustomerListPage) },
      {
        path: 'new',
        canActivate: [requirePermission(Permissions.customersCreate)],
        loadComponent: () => import('./customer-form.page').then((m) => m.CustomerFormPage),
      },
      { path: ':id', loadComponent: () => import('./customer-details.page').then((m) => m.CustomerDetailsPage) },
      {
        path: ':id/edit',
        canActivate: [requirePermission(Permissions.customersUpdate)],
        loadComponent: () => import('./customer-form.page').then((m) => m.CustomerFormPage),
      },
    ],
  },
];
