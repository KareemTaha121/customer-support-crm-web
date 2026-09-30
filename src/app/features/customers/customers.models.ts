/** Mirrors customer-support-crm-api/src/CustomerSupportCrm.Contracts/Customers/CustomerContracts.cs */

export type CustomerType = 'Individual' | 'Company';
export type CustomerStatus = 'Active' | 'Inactive';
export type ContactType = 'Email' | 'Phone' | 'WhatsApp' | 'Address' | 'Other';
export type CustomerLanguage = 'en' | 'ar';

export const CUSTOMER_TYPES: readonly CustomerType[] = ['Individual', 'Company'];
export const CUSTOMER_STATUSES: readonly CustomerStatus[] = ['Active', 'Inactive'];
export const CONTACT_TYPES: readonly ContactType[] = ['Email', 'Phone', 'WhatsApp', 'Address', 'Other'];
export const CUSTOMER_LANGUAGES: readonly CustomerLanguage[] = ['en', 'ar'];

/** Domain/Customers/Customer.cs limits. */
export const CUSTOMER_LIMITS = {
  nameMaxLength: 200,
  maxTags: 20,
  tagMaxLength: 50,
  contactValueMaxLength: 500,
  contactLabelMaxLength: 100,
  noteBodyMaxLength: 10_000,
} as const;

/** Application/Features/Customers/Common/CustomerQueries.cs + PortalErrors. */
export const CustomerErrorCodes = {
  notFound: 'CUSTOMER_NOT_FOUND',
  duplicate: 'DUPLICATE_CUSTOMER',
  noteNotFound: 'NOTE_NOT_FOUND',
  noteEditForbidden: 'NOTE_EDIT_FORBIDDEN',
  hasOpenTickets: 'CUSTOMER_HAS_OPEN_TICKETS',
  portalAccountExists: 'PORTAL_ACCOUNT_EXISTS',
} as const;

/** Domain/Customers/CustomerRecords.cs CustomerActivityTypes. */
export const ACTIVITY_TYPES = [
  'customer.created',
  'customer.updated',
  'note.added',
  'attachment.added',
  'ticket.created',
  'ticket.status_changed',
  'ticket.message',
  'ticket.feedback',
  'portal.sign_in',
  'chat.started',
] as const;

export interface CustomerContactRequest {
  type: ContactType;
  value: string;
  label: string | null;
  isPrimary: boolean;
}

export interface CreateCustomerRequest {
  type: CustomerType;
  name: string;
  companyName: string | null;
  preferredLanguage: CustomerLanguage;
  branchId: string;
  departmentId: string | null;
  tags: string[];
  contacts: CustomerContactRequest[];
  ignoreDuplicates: boolean;
}

export interface UpdateCustomerRequest {
  type: CustomerType;
  name: string;
  companyName: string | null;
  preferredLanguage: CustomerLanguage;
  status: CustomerStatus;
  branchId: string;
  departmentId: string | null;
  tags: string[];
}

export interface CustomerContactResponse {
  id: string;
  type: ContactType;
  value: string;
  label: string | null;
  isPrimary: boolean;
}

export interface CustomerListItem {
  id: string;
  number: string;
  type: CustomerType;
  name: string;
  companyName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  status: CustomerStatus;
  branchId: string;
  branchName: string;
  departmentId: string | null;
  departmentName: string | null;
  tags: string[];
  openTickets: number;
  createdAt: string;
}

export interface CustomerStats {
  openTickets: number;
  totalTickets: number;
  lastInteractionAt: string | null;
  averageSatisfaction: number | null;
}

export interface Customer {
  id: string;
  number: string;
  type: CustomerType;
  name: string;
  companyName: string | null;
  preferredLanguage: CustomerLanguage;
  status: CustomerStatus;
  branchId: string;
  branchName: string;
  departmentId: string | null;
  departmentName: string | null;
  tags: string[];
  externalSystem: string | null;
  externalId: string | null;
  contacts: CustomerContactResponse[];
  stats: CustomerStats;
  hasPortalAccount: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface DuplicateCandidate {
  id: string;
  number: string;
  name: string;
  matchedOn: 'Email' | 'Phone';
  matchedValue: string;
}

export interface CustomerNoteRequest {
  body: string;
  isPinned: boolean;
}

export interface CustomerNote {
  id: string;
  body: string;
  isPinned: boolean;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string | null;
  canEdit: boolean;
}

export interface CustomerActivity {
  id: string;
  type: string;
  summary: string;
  actorUserId: string | null;
  actorName: string | null;
  ticketId: string | null;
  data: unknown;
  occurredAt: string;
}

/** Contracts/Portal/PortalContracts.cs GrantPortalAccessRequest */
export interface GrantPortalAccessRequest {
  email: string;
  password: string;
}

/** Contracts/Organization/OrganizationContracts.cs (used for pickers). */
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

export type CustomerSortField = 'name' | 'number' | 'createdAt' | 'updatedAt';

export interface CustomerListQuery {
  page: number;
  pageSize: number;
  search: string | null;
  status: CustomerStatus | null;
  type: CustomerType | null;
  branchId: string | null;
  departmentId: string | null;
  tag: string | null;
  sortBy: CustomerSortField | null;
  sortDirection: 'asc' | 'desc' | null;
}
