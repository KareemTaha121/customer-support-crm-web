/** Contracts/Users/UserContracts.cs */
export type UserStatus = 'Active' | 'Disabled';

export interface UserListItem {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  roles: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface RoleReference {
  id: string;
  name: string;
}

export interface UserScopeRequest {
  branchId: string;
  departmentId: string | null;
}

export interface UserScopeResponse {
  branchId: string;
  branchName: string;
  departmentId: string | null;
  departmentName: string | null;
}

export interface UserDetail {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  isLockedOut: boolean;
  roles: RoleReference[];
  scopes: UserScopeResponse[];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateUserRequest {
  email: string;
  displayName: string;
  password: string;
  roleIds: string[];
  scopes: UserScopeRequest[] | null;
}

export interface UserLookup {
  id: string;
  displayName: string;
  email: string;
}

export type UserSortField = 'displayName' | 'email' | 'createdAt' | 'lastLoginAt';

/** Contracts/Roles/RoleContracts.cs */
export interface RoleResponse {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export interface RoleRequest {
  name: string;
  description: string | null;
  permissions: string[];
}

export interface PermissionResponse {
  code: string;
  group: string;
}

/** Contracts/Organization/OrganizationContracts.cs */
export interface OrganizationResponse {
  id: string;
  name: string;
  supportEmail: string | null;
  supportPhone: string | null;
  defaultCulture: string;
  timeZone: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
}

export interface UpdateOrganizationRequest {
  name: string;
  supportEmail: string | null;
  supportPhone: string | null;
  defaultCulture: string;
  timeZone: string;
}

export interface UpdateBrandingRequest {
  primaryColor: string;
  accentColor: string;
}

export interface DepartmentResponse {
  id: string;
  branchId: string;
  code: string;
  name: string;
  email: string | null;
  isActive: boolean;
}

export interface BranchResponse {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  departments: DepartmentResponse[];
}

export interface BranchRequest {
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
}

export interface DepartmentRequest {
  code: string;
  name: string;
  email: string | null;
}

/** Contracts/Audit/AuditContracts.cs */
export interface AuditLogResponse {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorDisplayName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: unknown;
  newValues: unknown;
  correlationId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuditQuery {
  page: number;
  pageSize: number;
  action: string | null;
  entityType: string | null;
  entityId: string | null;
  actorUserId: string | null;
  from: string | null;
  to: string | null;
}

/** Features/Settings/SettingsSlices.cs */
export type SettingKind = 'Boolean' | 'Number' | 'Text';

export interface SettingResponse {
  key: string;
  kind: SettingKind;
  value: string;
  defaultValue: string;
  isPublic: boolean;
}

/** Features/Integrations/IntegrationSlices.cs */
export interface ApiKeyResponse {
  id: string;
  name: string;
  displayPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  expiresAt: string | null;
}

export interface CreatedApiKeyResponse {
  apiKey: ApiKeyResponse;
  key: string;
}

export interface WebhookRequest {
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
}

export interface WebhookResponse {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

export interface WebhookWithSecretResponse {
  webhook: WebhookResponse;
  secret: string;
}

export interface WebhookDeliveryResponse {
  id: string;
  eventType: string;
  delivered: boolean;
  failed: boolean;
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export interface IntegrationCatalog {
  apiScopes: string[];
  webhookEvents: string[];
}

/** Stable backend codes this feature maps to `admin.errors.<CODE>`. */
export const AdminErrorCodes = {
  lastAdministrator: 'LAST_ADMINISTRATOR',
  cannotDisableSelf: 'CANNOT_DISABLE_SELF',
  emailTaken: 'EMAIL_TAKEN',
  unknownRole: 'UNKNOWN_ROLE',
  roleIsSystem: 'ROLE_IS_SYSTEM',
  roleInUse: 'ROLE_IN_USE',
  roleNameTaken: 'ROLE_NAME_TAKEN',
  branchCodeTaken: 'BRANCH_CODE_TAKEN',
  departmentCodeTaken: 'DEPARTMENT_CODE_TAKEN',
} as const;

/** Organization.SupportedCultures */
export const SUPPORTED_CULTURES = ['en', 'ar'] as const;

/** Domain AuditEntityTypes plus the entity names recorded by admin slices. */
export const AUDIT_ENTITY_TYPES = ['User', 'Role', 'Organization', 'Branch', 'Department', 'Setting', 'ApiKey', 'Webhook', 'Ticket', 'Customer', 'SlaPolicy'] as const;

/** SettingsSlices.cs SettingsStatusResponse: server-side prerequisites of some settings. */
export interface SettingsStatus {
  aiProviderConfigured: boolean;
  emailConfigured: boolean;
}
