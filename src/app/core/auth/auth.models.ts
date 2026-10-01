/** Contracts/Authentication/AuthenticationContracts.cs */
export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
  /** False when no role grants `data.all_branches` and the user has no branch scope: ticket and customer lists are empty. */
  hasDataAccess: boolean;
}

export interface AccessTokenResponse {
  accessToken: string;
  expiresAt: string;
  user: CurrentUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Stable auth error codes (Application/Features/Authentication/Common/AuthenticationErrors.cs). */
export const AuthErrorCodes = {
  invalidCredentials: 'INVALID_CREDENTIALS',
  accountLocked: 'ACCOUNT_LOCKED',
  accountDisabled: 'ACCOUNT_DISABLED',
  invalidRefreshToken: 'INVALID_REFRESH_TOKEN',
  invalidCurrentPassword: 'INVALID_CURRENT_PASSWORD',
} as const;
