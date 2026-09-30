import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

/** Checks the signed-in staff user's permission codes. Reads signals, so usable in templates/computed. */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);

  has(permission: string): boolean {
    return this.auth.permissions().has(permission);
  }

  /** True when the user holds at least one of the codes (an empty list means "any signed-in user"). */
  hasAny(permissions: readonly string[]): boolean {
    if (permissions.length === 0) {
      return this.auth.isAuthenticated();
    }
    const granted = this.auth.permissions();
    return permissions.some((p) => granted.has(p));
  }

  hasAll(permissions: readonly string[]): boolean {
    const granted = this.auth.permissions();
    return permissions.every((p) => granted.has(p));
  }
}
