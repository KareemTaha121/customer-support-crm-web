import { Injectable, inject, signal } from '@angular/core';
import { PermissionService } from '../../core/permissions/permission.service';
import { Permissions } from '../../core/permissions/permissions';
import { AiApi } from './ai.api';

/**
 * Caches `GET /ai/status` for the session. The request is only sent for users holding `ai.use`
 * (the endpoint requires it). A failed request resolves to "unavailable" and is retried on the
 * next {@link ensureLoaded} call.
 */
@Injectable({ providedIn: 'root' })
export class AiStatusService {
  private readonly api = inject(AiApi);
  private readonly permissions = inject(PermissionService);

  /** `null` until known. */
  readonly enabled = signal<boolean | null>(null);
  private loading = false;
  private loaded = false;

  ensureLoaded(): void {
    if (this.loaded || this.loading || !this.permissions.has(Permissions.aiUse)) {
      return;
    }
    this.loading = true;
    this.api.status().subscribe({
      next: (status) => {
        this.loading = false;
        this.loaded = true;
        this.enabled.set(!!status?.enabled);
      },
      error: () => {
        this.loading = false;
        this.enabled.set(false);
      },
    });
  }
}
