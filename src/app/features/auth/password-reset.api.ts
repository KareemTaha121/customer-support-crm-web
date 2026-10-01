import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';

/** Anonymous password reset for staff (`POST /auth/forgot-password`, `POST /auth/reset-password`). */
@Injectable({ providedIn: 'root' })
export class PasswordResetApi {
  private readonly api = inject(ApiService);

  /** Always succeeds for a valid address, whether or not it has an account. */
  forgot(email: string): Observable<null> {
    return this.api.post<null>('/auth/forgot-password', { email }, { anonymous: true, silent: true });
  }

  reset(token: string, newPassword: string): Observable<null> {
    return this.api.post<null>('/auth/reset-password', { token, newPassword }, { anonymous: true, silent: true });
  }
}
