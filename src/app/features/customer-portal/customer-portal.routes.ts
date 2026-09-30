import { Routes } from '@angular/router';
import { portalAuthGuard, portalGuestGuard } from '../../core/guards/auth.guards';
import { ComingSoonComponent } from '../../core/layout/status-pages.component';
import { translationResolver } from '../../core/localization/translation.resolver';
import { PortalShellComponent } from './portal-shell.component';

/** `/portal/*`: customer portal with its own layout and session. */
export const PORTAL_ROUTES: Routes = [
  {
    path: '',
    component: PortalShellComponent,
    resolve: { i18n: translationResolver('portal') },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tickets' },
      { path: 'login', canActivate: [portalGuestGuard], loadComponent: () => import('./auth/portal-login.page').then((m) => m.PortalLoginPage) },
      { path: 'register', canActivate: [portalGuestGuard], loadComponent: () => import('./auth/portal-register.page').then((m) => m.PortalRegisterPage) },
      { path: 'verify', loadComponent: () => import('./auth/portal-verify.page').then((m) => m.PortalVerifyPage) },
      { path: 'profile', canActivate: [portalAuthGuard], loadComponent: () => import('./auth/portal-profile.page').then((m) => m.PortalProfilePage) },
      // Tickets, history, chat widget, chatbot and web form: story FE-10.
      { path: 'tickets', canActivate: [portalAuthGuard], component: ComingSoonComponent },
      { path: '**', redirectTo: 'tickets' },
    ],
  },
];
