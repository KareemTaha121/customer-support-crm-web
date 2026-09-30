import { Routes } from '@angular/router';
import { portalAuthGuard, portalGuestGuard } from '../../core/guards/auth.guards';
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

      // Signed-in customer: tickets and activity history.
      {
        path: 'tickets',
        canActivate: [portalAuthGuard],
        children: [
          { path: '', loadComponent: () => import('./tickets/portal-tickets.page').then((m) => m.PortalTicketsPage) },
          { path: 'new', loadComponent: () => import('./tickets/portal-new-ticket.page').then((m) => m.PortalNewTicketPage) },
          { path: ':id', loadComponent: () => import('./tickets/portal-ticket-detail.page').then((m) => m.PortalTicketDetailPage) },
        ],
      },
      { path: 'history', canActivate: [portalAuthGuard], loadComponent: () => import('./tickets/portal-history.page').then((m) => m.PortalHistoryPage) },

      // Anonymous channels (each page shows an "unavailable" state when its flag is off).
      { path: 'contact', loadComponent: () => import('./channels/portal-contact.page').then((m) => m.PortalContactPage) },
      { path: 'chat', loadComponent: () => import('./channels/portal-chat.page').then((m) => m.PortalChatPage) },
      { path: 'assistant', loadComponent: () => import('./channels/portal-chatbot.page').then((m) => m.PortalChatbotPage) },

      { path: '**', redirectTo: 'tickets' },
    ],
  },
];
