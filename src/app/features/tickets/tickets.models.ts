import { AttachmentResponse, SortDirection } from '../../core/http/api.models';

/** Domain/Tickets/TicketEnums.cs */
export type TicketStatus = 'New' | 'Open' | 'PendingCustomer' | 'PendingInternal' | 'Escalated' | 'Resolved' | 'Closed';
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TicketMessageAuthorType = 'Agent' | 'Customer' | 'System';
export type TicketSlaState = 'none' | 'ok' | 'warning' | 'breached';

export const TICKET_STATUSES: readonly TicketStatus[] = ['New', 'Open', 'PendingCustomer', 'PendingInternal', 'Escalated', 'Resolved', 'Closed'];
export const TICKET_PRIORITIES: readonly TicketPriority[] = ['Low', 'Medium', 'High', 'Urgent'];
/** Channels staff may pick when creating a ticket (CreateTicketValidator). */
export const TICKET_CREATE_CHANNELS = ['Agent', 'Phone'] as const;

/** Contracts/Tickets/TicketContracts.cs — TicketListItemResponse */
export interface TicketListItem {
  id: string;
  number: string;
  subject: string;
  status: string;
  priority: string;
  channel: string;
  customerId: string;
  customerName: string;
  categoryId: string | null;
  categoryName: string | null;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  branchId: string;
  departmentId: string | null;
  departmentName: string | null;
  slaState: string;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  escalationLevel: number;
  createdAt: string;
  updatedAt: string | null;
  lastCustomerMessageAt: string | null;
}

export interface TicketSla {
  policyId: string | null;
  policyName: string | null;
  firstResponseDueAt: string | null;
  firstRespondedAt: string | null;
  firstResponseBreached: boolean;
  resolutionDueAt: string | null;
  resolvedAt: string | null;
  resolutionBreached: boolean;
  state: string;
}

export interface TicketCustomer {
  id: string;
  number: string;
  name: string;
  email: string | null;
  phone: string | null;
  preferredLanguage: string;
}

/** TicketResponse. `allowedStatuses` may contain the pseudo status "Reopen". */
export interface Ticket {
  id: string;
  number: string;
  subject: string;
  description: string;
  status: string;
  allowedStatuses: string[];
  priority: string;
  channel: string;
  replyAddress: string | null;
  customer: TicketCustomer;
  categoryId: string | null;
  categoryName: string | null;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  branchId: string;
  branchName: string;
  departmentId: string | null;
  departmentName: string | null;
  tags: string[];
  sla: TicketSla;
  escalationLevel: number;
  escalatedAt: string | null;
  satisfactionRating: number | null;
  satisfactionComment: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface TicketMessage {
  id: string;
  authorType: string;
  authorUserId: string | null;
  authorCustomerId: string | null;
  authorName: string;
  body: string;
  isInternal: boolean;
  channel: string;
  createdAt: string;
  attachments: AttachmentResponse[];
}

export interface TicketHistoryEntry {
  id: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  actorName: string | null;
  occurredAt: string;
}

export interface TicketCategory {
  id: string;
  name: string;
  nameAr: string | null;
  parentId: string | null;
  defaultDepartmentId: string | null;
  defaultPriority: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface TicketCategoryRequest {
  name: string;
  nameAr: string | null;
  parentId: string | null;
  defaultDepartmentId: string | null;
  defaultPriority: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CreateTicketRequest {
  customerId: string;
  subject: string;
  description: string | null;
  categoryId: string | null;
  priority: string;
  channel: string | null;
  branchId: string | null;
  departmentId: string | null;
  tags: string[];
  assignedAgentId: string | null;
}

export interface UpdateTicketRequest {
  subject: string;
  description: string | null;
  categoryId: string | null;
  priority: string;
  tags: string[];
}

export interface TransferTicketRequest {
  branchId: string;
  departmentId: string | null;
}

export interface AddTicketMessageRequest {
  body: string;
  isInternal: boolean;
  mentionedUserIds: string[];
  attachmentIds: string[];
}

/** Contracts/Users/UserContracts.cs — UserLookupResponse */
export interface UserLookup {
  id: string;
  displayName: string;
  email: string;
}

/** Contracts/Customers/CustomerContracts.cs — CustomerListItemResponse (fields used here). */
export interface CustomerOption {
  id: string;
  number: string;
  name: string;
  companyName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
}

/** Contracts/Organization/OrganizationContracts.cs */
export interface DepartmentOption {
  id: string;
  branchId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface BranchOption {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  departments: DepartmentOption[];
}

/** ListTicketsQuery (TicketQuerySlices.cs). */
export interface TicketListQuery {
  page: number;
  pageSize: number;
  search?: string | null;
  status?: string | null;
  priority?: string | null;
  assignee?: string | null;
  categoryId?: string | null;
  createdFrom?: string | null;
  createdTo?: string | null;
  sortBy?: string | null;
  sortDirection?: SortDirection | null;
}

export type PillTone = 'success' | 'warning' | 'danger' | 'info' | 'primary' | '';

export function statusTone(status: string): PillTone {
  switch (status) {
    case 'New':
      return 'primary';
    case 'Open':
      return 'info';
    case 'PendingCustomer':
    case 'PendingInternal':
      return 'warning';
    case 'Escalated':
      return 'danger';
    case 'Resolved':
      return 'success';
    default:
      return '';
  }
}

export function priorityTone(priority: string): PillTone {
  switch (priority) {
    case 'Urgent':
      return 'danger';
    case 'High':
      return 'warning';
    case 'Medium':
      return 'info';
    default:
      return '';
  }
}

export function slaTone(state: string): PillTone {
  switch (state) {
    case 'breached':
      return 'danger';
    case 'warning':
      return 'warning';
    case 'ok':
      return 'success';
    default:
      return '';
  }
}

export interface CategoryNode extends TicketCategory {
  depth: number;
}

/** Orders a flat category list as a tree (parents before children) with each node's depth. */
export function buildCategoryTree(categories: readonly TicketCategory[]): CategoryNode[] {
  const ids = new Set(categories.map((c) => c.id));
  const children = new Map<string | null, TicketCategory[]>();
  for (const category of categories) {
    const parent = category.parentId && ids.has(category.parentId) ? category.parentId : null;
    const list = children.get(parent) ?? [];
    list.push(category);
    children.set(parent, list);
  }
  const result: CategoryNode[] = [];
  const visited = new Set<string>();
  const walk = (parent: string | null, depth: number): void => {
    for (const category of children.get(parent) ?? []) {
      if (visited.has(category.id)) {
        continue;
      }
      visited.add(category.id);
      result.push({ ...category, depth });
      walk(category.id, depth + 1);
    }
  };
  walk(null, 0);
  // Anything left (cycles) is appended flat so it stays editable.
  for (const category of categories) {
    if (!visited.has(category.id)) {
      result.push({ ...category, depth: 0 });
    }
  }
  return result;
}

/** The category name in the active language (Arabic name when present). */
export function categoryLabel(category: Pick<TicketCategory, 'name' | 'nameAr'>, language: string): string {
  return language === 'ar' && category.nameAr ? category.nameAr : category.name;
}

/** `yyyy-mm-dd` (native date input) → ISO timestamp at the start or end of that local day. */
export function dayToIso(day: string, endOfDay: boolean): string | null {
  if (!day) {
    return null;
  }
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) {
    return null;
  }
  const value = endOfDay ? new Date(year, month - 1, date, 23, 59, 59, 999) : new Date(year, month - 1, date, 0, 0, 0, 0);
  return value.toISOString();
}

/** Reads the ticket id from an untyped `ticketUpdated` payload. */
export function ticketIdFromPayload(payload: unknown): string | null {
  if (typeof payload === 'string') {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const id = record['ticketId'] ?? record['id'];
    return typeof id === 'string' ? id : null;
  }
  return null;
}

export const TicketErrorCodes = {
  notFound: 'TICKET_NOT_FOUND',
  invalidTransition: 'INVALID_STATUS_TRANSITION',
  closed: 'TICKET_CLOSED',
  agentNotEligible: 'AGENT_NOT_ELIGIBLE',
  assignForbidden: 'ASSIGN_FORBIDDEN',
  categoryNotFound: 'CATEGORY_NOT_FOUND',
} as const;

export const TicketLimits = {
  subject: 300,
  description: 20000,
  tags: 20,
  message: 50000,
  attachmentsPerMessage: 10,
  escalationReason: 500,
  categoryName: 150,
} as const;
