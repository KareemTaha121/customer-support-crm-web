import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { requirePermission } from '../../core/guards/auth.guards';
import { translationResolver } from '../../core/localization/translation.resolver';
import { PermissionService } from '../../core/permissions/permission.service';
import { Permissions } from '../../core/permissions/permissions';
import { SlaShellComponent } from './sla-shell.component';
import { SLA_TABS } from './sla-tabs';

/** `/sla` → the first tab the user may open (users may hold only one of the two permissions). */
export const slaDefaultTabGuard: CanActivateFn = () => {
  const permissions = inject(PermissionService);
  const router = inject(Router);
  const first = SLA_TABS.find((tab) => permissions.has(tab.permission));
  return first ? router.createUrlTree(['/sla', first.path]) : router.createUrlTree(['/forbidden']);
};

export const SLA_ROUTES: Routes = [
  {
    path: '',
    component: SlaShellComponent,
    resolve: { i18n: translationResolver('sla') },
    children: [
      { path: '', pathMatch: 'full', canActivate: [slaDefaultTabGuard], children: [] },
      {
        path: 'policies',
        canActivate: [requirePermission(Permissions.slaManage)],
        loadComponent: () => import('./sla-policies.page').then((m) => m.SlaPoliciesPage),
      },
      {
        path: 'assignment-rules',
        canActivate: [requirePermission(Permissions.automationManage)],
        loadComponent: () => import('./assignment-rules.page').then((m) => m.AssignmentRulesPage),
      },
      {
        path: 'escalation-rules',
        canActivate: [requirePermission(Permissions.automationManage)],
        loadComponent: () => import('./escalation-rules.page').then((m) => m.EscalationRulesPage),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
