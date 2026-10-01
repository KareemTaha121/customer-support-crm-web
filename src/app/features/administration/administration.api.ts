import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DownloadedFile, ApiService } from '../../core/http/api.service';
import { Paged, SortDirection } from '../../core/http/api.models';
import {
  ApiKeyResponse,
  AuditLogResponse,
  AuditQuery,
  BranchRequest,
  BranchResponse,
  CreateApiKeyRequest,
  CreateUserRequest,
  CreatedApiKeyResponse,
  DepartmentRequest,
  DepartmentResponse,
  IntegrationCatalog,
  OrganizationResponse,
  PermissionResponse,
  RoleRequest,
  RoleResponse,
  SettingResponse,
  UpdateBrandingRequest,
  UpdateOrganizationRequest,
  UserDetail,
  UserListItem,
  UserLookup,
  UserScopeRequest,
  UserSortField,
  UserStatus,
  WebhookDeliveryResponse,
  WebhookRequest,
  WebhookResponse,
  WebhookWithSecretResponse,
} from './administration.models';

export interface UserListQuery {
  page: number;
  pageSize: number;
  search: string | null;
  status: UserStatus | null;
  sortBy: UserSortField | null;
  sortDirection: SortDirection | null;
}

const SILENT = { silent: true } as const;

/** Every administration endpoint (users, roles, organization, settings, integrations, audit). */
@Injectable({ providedIn: 'root' })
export class AdministrationApi {
  private readonly api = inject(ApiService);

  /** Whether outgoing email works (`GET /channels/status`, needs `channels.manage`). Portal sign-up codes go by email. */
  emailConfigured(): Observable<boolean> {
    return this.api
      .get<{ channel: string; configured: boolean }[]>('/channels/status', SILENT)
      .pipe(map((items) => (items ?? []).some((s) => s.channel === 'Email' && s.configured)));
  }

  // ---------- Users ----------

  listUsers(query: UserListQuery): Observable<Paged<UserListItem>> {
    return this.api.getPaged<UserListItem>('/users', { params: { ...query } });
  }

  getUser(id: string): Observable<UserDetail> {
    return this.api.get<UserDetail>(`/users/${id}`);
  }

  createUser(request: CreateUserRequest): Observable<UserDetail> {
    return this.api.post<UserDetail>('/users', request, SILENT);
  }

  updateUser(id: string, displayName: string): Observable<UserDetail> {
    return this.api.put<UserDetail>(`/users/${id}`, { displayName }, SILENT);
  }

  setUserRoles(id: string, roleIds: string[]): Observable<UserDetail> {
    return this.api.put<UserDetail>(`/users/${id}/roles`, { roleIds }, SILENT);
  }

  setUserScopes(id: string, scopes: UserScopeRequest[]): Observable<UserDetail> {
    return this.api.put<UserDetail>(`/users/${id}/scopes`, { scopes }, SILENT);
  }

  resetUserPassword(id: string, newPassword: string): Observable<null> {
    return this.api.post<null>(`/users/${id}/reset-password`, { newPassword }, SILENT);
  }

  enableUser(id: string): Observable<UserDetail> {
    return this.api.post<UserDetail>(`/users/${id}/enable`, {}, SILENT);
  }

  disableUser(id: string): Observable<UserDetail> {
    return this.api.post<UserDetail>(`/users/${id}/disable`, {}, SILENT);
  }

  lookupUsers(search: string | null): Observable<UserLookup[]> {
    return this.api.get<UserLookup[]>('/users/lookup', { params: { search } });
  }

  // ---------- Roles ----------

  listRoles(): Observable<RoleResponse[]> {
    return this.api.get<RoleResponse[]>('/roles');
  }

  listPermissions(): Observable<PermissionResponse[]> {
    return this.api.get<PermissionResponse[]>('/permissions');
  }

  createRole(request: RoleRequest): Observable<RoleResponse> {
    return this.api.post<RoleResponse>('/roles', request, SILENT);
  }

  updateRole(id: string, request: RoleRequest): Observable<RoleResponse> {
    return this.api.put<RoleResponse>(`/roles/${id}`, request, SILENT);
  }

  deleteRole(id: string): Observable<null> {
    return this.api.delete<null>(`/roles/${id}`, SILENT);
  }

  // ---------- Organization ----------

  getOrganization(): Observable<OrganizationResponse> {
    return this.api.get<OrganizationResponse>('/organization');
  }

  updateOrganization(request: UpdateOrganizationRequest): Observable<OrganizationResponse> {
    return this.api.put<OrganizationResponse>('/organization', request, SILENT);
  }

  updateBranding(request: UpdateBrandingRequest): Observable<OrganizationResponse> {
    return this.api.put<OrganizationResponse>('/organization/branding', request, SILENT);
  }

  uploadLogo(file: File): Observable<OrganizationResponse> {
    return this.api.upload<OrganizationResponse>('/organization/logo', file, undefined, SILENT);
  }

  listBranches(includeInactive = true): Observable<BranchResponse[]> {
    return this.api.get<BranchResponse[]>('/branches', { params: { includeInactive } });
  }

  createBranch(request: BranchRequest): Observable<BranchResponse> {
    return this.api.post<BranchResponse>('/branches', request, SILENT);
  }

  updateBranch(id: string, request: BranchRequest): Observable<BranchResponse> {
    return this.api.put<BranchResponse>(`/branches/${id}`, request, SILENT);
  }

  setBranchActive(id: string, active: boolean): Observable<BranchResponse> {
    return this.api.post<BranchResponse>(`/branches/${id}/${active ? 'activate' : 'deactivate'}`, {}, SILENT);
  }

  createDepartment(branchId: string, request: DepartmentRequest): Observable<DepartmentResponse> {
    return this.api.post<DepartmentResponse>(`/branches/${branchId}/departments`, request, SILENT);
  }

  updateDepartment(branchId: string, id: string, request: DepartmentRequest): Observable<DepartmentResponse> {
    return this.api.put<DepartmentResponse>(`/branches/${branchId}/departments/${id}`, request, SILENT);
  }

  setDepartmentActive(id: string, active: boolean): Observable<DepartmentResponse> {
    return this.api.post<DepartmentResponse>(`/departments/${id}/${active ? 'activate' : 'deactivate'}`, {}, SILENT);
  }

  // ---------- Settings ----------

  listSettings(): Observable<SettingResponse[]> {
    return this.api.get<SettingResponse[]>('/settings');
  }

  updateSettings(values: Record<string, string>): Observable<SettingResponse[]> {
    return this.api.put<SettingResponse[]>('/settings', { values }, SILENT);
  }

  // ---------- Integrations ----------

  integrationCatalog(): Observable<IntegrationCatalog> {
    return this.api.get<IntegrationCatalog>('/integrations/catalog');
  }

  listApiKeys(): Observable<ApiKeyResponse[]> {
    return this.api.get<ApiKeyResponse[]>('/integrations/api-keys');
  }

  createApiKey(request: CreateApiKeyRequest): Observable<CreatedApiKeyResponse> {
    return this.api.post<CreatedApiKeyResponse>('/integrations/api-keys', request, SILENT);
  }

  revokeApiKey(id: string): Observable<ApiKeyResponse> {
    return this.api.post<ApiKeyResponse>(`/integrations/api-keys/${id}/revoke`, {}, SILENT);
  }

  listWebhooks(): Observable<WebhookResponse[]> {
    return this.api.get<WebhookResponse[]>('/integrations/webhooks');
  }

  createWebhook(request: WebhookRequest): Observable<WebhookWithSecretResponse> {
    return this.api.post<WebhookWithSecretResponse>('/integrations/webhooks', request, SILENT);
  }

  updateWebhook(id: string, request: WebhookRequest): Observable<WebhookResponse> {
    return this.api.put<WebhookResponse>(`/integrations/webhooks/${id}`, request, SILENT);
  }

  rotateWebhookSecret(id: string): Observable<WebhookWithSecretResponse> {
    return this.api.post<WebhookWithSecretResponse>(`/integrations/webhooks/${id}/rotate-secret`, {}, SILENT);
  }

  deleteWebhook(id: string): Observable<null> {
    return this.api.delete<null>(`/integrations/webhooks/${id}`, SILENT);
  }

  testWebhook(id: string): Observable<null> {
    return this.api.post<null>(`/integrations/webhooks/${id}/test`, {}, SILENT);
  }

  listDeliveries(webhookId: string): Observable<WebhookDeliveryResponse[]> {
    return this.api.get<WebhookDeliveryResponse[]>(`/integrations/webhooks/${webhookId}/deliveries`);
  }

  retryDelivery(id: string): Observable<null> {
    return this.api.post<null>(`/integrations/deliveries/${id}/retry`, {}, SILENT);
  }

  // ---------- Audit ----------

  listAuditLogs(query: AuditQuery): Observable<Paged<AuditLogResponse>> {
    return this.api.getPaged<AuditLogResponse>('/audit-logs', { params: { ...query } });
  }

  exportAuditLogs(from: string | null, to: string | null, action: string | null): Observable<DownloadedFile> {
    return this.api.download('/audit-logs/export.csv', { params: { from, to, action } });
  }
}
