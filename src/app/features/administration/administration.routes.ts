import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { requirePermission } from '../../core/guards/auth.guards';
import { translationResolver } from '../../core/localization/translation.resolver';
import { PermissionService } from '../../core/permissions/permission.service';
import { Permissions } from '../../core/permissions/permissions';

/** Admin pages in sidenav order with the permissions that open them (any of). */
const ADMIN_PAGES: { path: string; permissions: string[] }[] = [
  { path: 'users', permissions: [Permissions.usersManage] },
  { path: 'roles', permissions: [Permissions.rolesManage] },
  { path: 'organization', permissions: [Permissions.organizationManage, Permissions.settingsManage] },
  { path: 'settings', permissions: [Permissions.settingsManage] },
  { path: 'integrations', permissions: [Permissions.integrationsManage] },
  { path: 'audit', permissions: [Permissions.auditView] },
];

export const ADMINISTRATION_ROUTES: Routes = [
  {
    path: '',
    resolve: { i18n: translationResolver('admin') },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: () => {
          const permissions = inject(PermissionService);
          const first = ADMIN_PAGES.find((page) => permissions.hasAny(page.permissions));
          return inject(Router).createUrlTree(first ? ['/admin', first.path] : ['/forbidden']);
        },
      },
      {
        path: 'users',
        canActivate: [requirePermission(Permissions.usersManage)],
        loadComponent: () => import('./users/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'roles',
        canActivate: [requirePermission(Permissions.rolesManage)],
        loadComponent: () => import('./roles/roles.page').then((m) => m.RolesPage),
      },
      {
        path: 'organization',
        canActivate: [requirePermission(Permissions.organizationManage, Permissions.settingsManage)],
        loadComponent: () => import('./organization/organization.page').then((m) => m.OrganizationPage),
      },
      {
        path: 'settings',
        canActivate: [requirePermission(Permissions.settingsManage)],
        loadComponent: () => import('./settings/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: 'integrations',
        canActivate: [requirePermission(Permissions.integrationsManage)],
        loadComponent: () => import('./integrations/integrations.page').then((m) => m.IntegrationsPage),
      },
      {
        path: 'audit',
        canActivate: [requirePermission(Permissions.auditView)],
        loadComponent: () => import('./audit/audit.page').then((m) => m.AuditPage),
      },
    ],
  },
];
