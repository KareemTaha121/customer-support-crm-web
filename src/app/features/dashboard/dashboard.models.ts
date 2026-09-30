/** Contracts/Dashboard/DashboardContracts.cs */
export interface AgentDashboardCounts {
  myOpen: number;
  myPendingCustomer: number;
  myAtRisk: number;
  myResolvedToday: number;
  unassignedInScope: number;
  escalatedInScope: number;
  openTasks: number;
  overdueTasks: number;
  unreadNotifications: number;
}

/** Contracts/Tickets/TicketContracts.cs `TicketListItemResponse` (fields the dashboard uses). */
export interface DashboardTicket {
  id: string;
  number: string;
  subject: string;
  status: string;
  priority: string;
  channel: string;
  customerId: string;
  customerName: string;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  slaState: string;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  escalationLevel: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface RecentCustomer {
  id: string;
  number: string;
  name: string;
  lastInteractionAt: string;
}

export interface AgentTask {
  id: string;
  title: string;
  notes: string | null;
  assigneeId: string;
  assigneeName: string;
  ticketId: string | null;
  ticketNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  dueAt: string | null;
  remindAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface AgentDashboard {
  counts: AgentDashboardCounts;
  myTickets: DashboardTicket[];
  slaAtRisk: DashboardTicket[];
  pendingEscalations: DashboardTicket[];
  recentCustomers: RecentCustomer[];
  myTasks: AgentTask[];
}

export interface TaskRequest {
  title: string;
  notes: string | null;
  assigneeId: string | null;
  ticketId: string | null;
  customerId: string | null;
  dueAt: string | null;
  remindAt: string | null;
}

export type TaskStatusFilter = 'open' | 'completed' | 'all';

export type QuickReplyLanguage = 'en' | 'ar';

export interface QuickReply {
  id: string;
  title: string;
  shortcut: string | null;
  body: string;
  language: QuickReplyLanguage;
  categoryId: string | null;
  shared: boolean;
  canEdit: boolean;
  usageCount: number;
}

export interface QuickReplyRequest {
  title: string;
  shortcut: string | null;
  body: string;
  language: QuickReplyLanguage;
  categoryId: string | null;
  shared: boolean;
}

export interface RenderedQuickReply {
  body: string;
}

/** Domain/Tickets/AgentWorkspace.cs limits (also validated server side). */
export const TASK_TITLE_MAX = 300;
export const TASK_NOTES_MAX = 4000;
export const QUICK_REPLY_TITLE_MAX = 150;
export const QUICK_REPLY_SHORTCUT_MAX = 30;
export const QUICK_REPLY_BODY_MAX = 10000;
