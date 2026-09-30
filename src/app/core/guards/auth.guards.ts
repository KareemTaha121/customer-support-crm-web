import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { PortalAuthService } from '../auth/portal-auth.service';
import { PermissionService } from '../permissions/permission.service';

/** Staff routes: requires a signed-in staff user, else redirects to /login?returnUrl=... */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toLogin = () => router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  if (auth.isAuthenticated()) {
    return true;
  }
  // Entered through a public page first: try the refresh cookie once before asking to sign in.
  return auth.hasAttemptedRestore ? toLogin() : auth.restoreSession().pipe(map((ok) => (ok ? true : toLogin())));
};

/** Login page: signed-in staff go to the app instead. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return router.createUrlTree(['/']);
  }
  return auth.hasAttemptedRestore ? true : auth.restoreSession().pipe(map((ok) => (ok ? router.createUrlTree(['/']) : true)));
};

/**
 * Requires any of the permissions in `route.data.permissions` (string[]) or
 * `route.data.permission` (string). Redirects to /forbidden otherwise.
 * `{ path: 'users', canActivate: [permissionGuard], data: { permission: Permissions.usersManage } }`
 */
export const permissionGuard: CanActivateFn = (route) => {
  const data = route.data as { permission?: string; permissions?: string[] };
  const required = data.permissions ?? (data.permission ? [data.permission] : []);
  return inject(PermissionService).hasAny(required) ? true : inject(Router).createUrlTree(['/forbidden']);
};

/** Factory form: `canActivate: [requirePermission(Permissions.reportsView)]`. */
export function requirePermission(...permissions: string[]): CanActivateFn & CanMatchFn {
  return () => (inject(PermissionService).hasAny(permissions) ? true : inject(Router).createUrlTree(['/forbidden']));
}

/** Customer portal routes: requires a portal session. */
export const portalAuthGuard: CanActivateFn = (_route, state) => {
  const portal = inject(PortalAuthService);
  return portal.isAuthenticated() ? true : inject(Router).createUrlTree(['/portal/login'], { queryParams: { returnUrl: state.url } });
};

/** Portal login/register pages: signed-in customers go to their tickets. */
export const portalGuestGuard: CanActivateFn = () => {
  const portal = inject(PortalAuthService);
  return portal.isAuthenticated() ? inject(Router).createUrlTree(['/portal']) : true;
};
