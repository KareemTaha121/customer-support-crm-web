/**
 * Report DTOs mirrored from customer-support-crm-api/src/CustomerSupportCrm.Contracts/Reports/ReportContracts.cs.
 * Percentages are 0–100 (one decimal); missing keys (no department/category) are `'-'`.
 */

export type ReportGroupBy = 'day' | 'week' | 'month';

/** CSV export endpoints under `/reports/export/<kind>.csv`. */
export type ReportKind = 'ticket-volume' | 'sla-performance' | 'agent-performance' | 'customer-satisfaction';

export interface CountByKey {
  key: string;
  label: string | null;
  count: number;
}

export interface VolumePoint {
  period: string;
  created: number;
  resolved: number;
}

export interface TicketVolumeReport {
  from: string;
  to: string;
  groupBy: ReportGroupBy;
  totalCreated: number;
  totalResolved: number;
  series: VolumePoint[];
  byStatus: CountByKey[];
  byPriority: CountByKey[];
  byChannel: CountByKey[];
  byCategory: CountByKey[];
}

export interface SlaBreakdownRow {
  key: string;
  label: string | null;
  tickets: number;
  firstResponseCompliance: number | null;
  resolutionCompliance: number | null;
  breached: number;
}

export interface SlaPerformanceReport {
  from: string;
  to: string;
  ticketsWithSla: number;
  firstResponseCompliance: number | null;
  resolutionCompliance: number | null;
  firstResponseBreached: number;
  resolutionBreached: number;
  averageFirstResponseMinutes: number | null;
  averageResolutionMinutes: number | null;
  byPriority: SlaBreakdownRow[];
  byDepartment: SlaBreakdownRow[];
}

export interface AgentPerformanceRow {
  agentId: string;
  agentName: string;
  assigned: number;
  resolved: number;
  openNow: number;
  averageFirstResponseMinutes: number | null;
  averageResolutionMinutes: number | null;
  slaCompliance: number | null;
  averageSatisfaction: number | null;
  satisfactionResponses: number;
}

export interface AgentPerformanceReport {
  from: string;
  to: string;
  agents: AgentPerformanceRow[];
}

export interface RatingCount {
  rating: number;
  count: number;
}

export interface SatisfactionPoint {
  period: string;
  average: number | null;
  responses: number;
}

export interface SatisfactionComment {
  ticketId: string;
  ticketNumber: string;
  rating: number;
  comment: string;
  submittedAt: string;
}

export interface CustomerSatisfactionReport {
  from: string;
  to: string;
  average: number | null;
  responses: number;
  positiveShare: number | null;
  distribution: RatingCount[];
  trend: SatisfactionPoint[];
  recentComments: SatisfactionComment[];
}

export interface ManagementDashboard {
  openTickets: number;
  unassignedTickets: number;
  escalatedTickets: number;
  atRiskTickets: number;
  createdToday: number;
  resolvedToday: number;
  slaCompliance30d: number | null;
  satisfaction30d: number | null;
  averageFirstResponseMinutes30d: number | null;
  averageResolutionMinutes30d: number | null;
  backlogByDepartment: CountByKey[];
  topCategories30d: CountByKey[];
  last14Days: VolumePoint[];
}

/** Contracts/Organization/OrganizationContracts.cs `DepartmentResponse` (fields used by the filters). */
export interface DepartmentOption {
  id: string;
  branchId: string;
  code: string;
  name: string;
  isActive: boolean;
}

/** Contracts/Organization/OrganizationContracts.cs `BranchResponse` (fields used by the filters). */
export interface BranchOption {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  departments: DepartmentOption[];
}

/** KPI card view model (not an API type). */
export interface Kpi {
  icon: string;
  /** Translation key. */
  label: string;
  value: string;
  tone?: 'warn' | 'danger';
}
