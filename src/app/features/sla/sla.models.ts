/** Domain/Tickets/TicketEnums.cs */
export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export type TicketPriority = (typeof PRIORITIES)[number];

export const CHANNELS = ['Agent', 'Portal', 'WebForm', 'Email', 'WhatsApp', 'Sms', 'Chat', 'Phone', 'Api'] as const;
export type TicketChannel = (typeof CHANNELS)[number];

export const SLA_TARGETS = ['FirstResponse', 'Resolution'] as const;
export type SlaTarget = (typeof SLA_TARGETS)[number];

/** Domain/Sla/AutomationRules.cs */
export const STRATEGIES = ['None', 'SpecificAgent', 'RoundRobin', 'LeastLoaded'] as const;
export type AssignmentStrategy = (typeof STRATEGIES)[number];

export const TRIGGERS = ['SlaWarning', 'SlaBreached', 'Unassigned', 'NoAgentReply'] as const;
export type EscalationTrigger = (typeof TRIGGERS)[number];

/** Triggers that need `afterMinutes` (the others use the SLA target). */
export const TIME_TRIGGERS: readonly EscalationTrigger[] = ['Unassigned', 'NoAgentReply'];

/** 0 = Sunday … 6 = Saturday (SlaContracts.cs). */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Contracts/Sla/SlaContracts.cs */
export interface SlaTargetDto {
  priority: TicketPriority;
  firstResponseMinutes: number;
  resolutionMinutes: number;
}

export interface SlaPolicyRequest {
  name: string;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  categoryId: string | null;
  departmentId: string | null;
  businessHoursOnly: boolean;
  workDays: number[] | null;
  workStart: string | null;
  workEnd: string | null;
  targets: SlaTargetDto[];
}

export interface SlaPolicyResponse {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  categoryId: string | null;
  departmentId: string | null;
  businessHoursOnly: boolean;
  workDays: number[];
  workStart: string;
  workEnd: string;
  targets: SlaTargetDto[];
}

export interface AssignmentRuleRequest {
  name: string;
  isActive: boolean;
  order: number;
  matchCategoryId: string | null;
  matchDepartmentId: string | null;
  matchChannel: TicketChannel | null;
  matchPriority: TicketPriority | null;
  matchKeyword: string | null;
  setDepartmentId: string | null;
  setPriority: TicketPriority | null;
  strategy: AssignmentStrategy;
  agentId: string | null;
}

export interface AssignmentRuleResponse extends AssignmentRuleRequest {
  id: string;
  agentName: string | null;
}

export interface EscalationRuleRequest {
  name: string;
  isActive: boolean;
  trigger: EscalationTrigger;
  target: SlaTarget | null;
  afterMinutes: number | null;
  matchPriority: TicketPriority | null;
  matchDepartmentId: string | null;
  escalateTicket: boolean;
  raisePriorityTo: TicketPriority | null;
  reassignToAgentId: string | null;
  notifyAssignee: boolean;
  notifyManagers: boolean;
  notifyUserIds: string[] | null;
}

export interface EscalationRuleResponse extends EscalationRuleRequest {
  id: string;
  notifyUserIds: string[];
}

/** Contracts/Tickets/TicketContracts.cs — TicketCategoryResponse */
export interface TicketCategoryOption {
  id: string;
  name: string;
  nameAr: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
}

/** Contracts/Organization/OrganizationContracts.cs */
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
  isActive: boolean;
  departments: DepartmentResponse[];
}

/** A department with its branch name, for pickers. */
export interface DepartmentOption {
  id: string;
  label: string;
  isActive: boolean;
}

/** Contracts/Users/UserContracts.cs — UserLookupResponse */
export interface UserLookup {
  id: string;
  displayName: string;
  email: string;
}

// ---------- Durations (targets are stored in minutes) ----------

export type DurationUnit = 'minutes' | 'hours' | 'days';
export const DURATION_UNITS: readonly DurationUnit[] = ['minutes', 'hours', 'days'];
const UNIT_MINUTES: Record<DurationUnit, number> = { minutes: 1, hours: 60, days: 1440 };

/** Largest unit that divides the value evenly: 480 → 8 hours, 90 → 90 minutes. */
export function splitMinutes(total: number): { amount: number; unit: DurationUnit } {
  if (total > 0 && total % 1440 === 0) {
    return { amount: total / 1440, unit: 'days' };
  }
  if (total > 0 && total % 60 === 0) {
    return { amount: total / 60, unit: 'hours' };
  }
  return { amount: total, unit: 'minutes' };
}

export function toMinutes(amount: number | null, unit: DurationUnit): number {
  return Math.round((amount ?? 0) * UNIT_MINUTES[unit]);
}

/** `crm-pill` modifier for a priority. */
export function priorityPillClass(priority: string | null): string {
  switch (priority) {
    case 'Urgent':
      return 'crm-pill--danger';
    case 'High':
      return 'crm-pill--warning';
    case 'Medium':
      return 'crm-pill--info';
    default:
      return '';
  }
}
