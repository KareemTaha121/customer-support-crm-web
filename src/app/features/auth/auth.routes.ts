import { Routes } from '@angular/router';
import { guestGuard } from '../../core/guards/auth.guards';
import { translationResolver } from '../../core/localization/translation.resolver';

/** `/login` (guest only). */
export const LOGIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [guestGuard],
    resolve: { i18n: translationResolver('auth') },
    loadComponent: () => import('./login.page').then((m) => m.LoginPage),
  },
];

/** `/profile` inside the staff shell. */
export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    resolve: { i18n: translationResolver('auth') },
    loadComponent: () => import('./profile.page').then((m) => m.ProfilePage),
  },
];
