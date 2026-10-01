import { Routes } from '@angular/router';
import { guestGuard } from '../../core/guards/auth.guards';
import { translationResolver } from '../../core/localization/translation.resolver';

/** `/login` (guest only), plus the anonymous password reset pages under it. */
export const LOGIN_ROUTES: Routes = [
  {
    path: '',
    resolve: { i18n: translationResolver('auth') },
    children: [
      { path: '', canActivate: [guestGuard], loadComponent: () => import('./login.page').then((m) => m.LoginPage) },
      { path: 'forgot-password', canActivate: [guestGuard], loadComponent: () => import('./forgot-password.page').then((m) => m.ForgotPasswordPage) },
      // No guard: a signed-in user may still open a reset link from their email.
      { path: 'reset-password', loadComponent: () => import('./reset-password.page').then((m) => m.ResetPasswordPage) },
    ],
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
