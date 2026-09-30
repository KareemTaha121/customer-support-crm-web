import { Permissions } from '../../core/permissions/permissions';

/** SLA area tabs in display order with the permission each needs (routes guard, shell shows them). */
export const SLA_TABS = [
  { path: 'policies', label: 'sla.tabs.policies', icon: 'timer', permission: Permissions.slaManage },
  { path: 'assignment-rules', label: 'sla.tabs.assignment', icon: 'alt_route', permission: Permissions.automationManage },
  { path: 'escalation-rules', label: 'sla.tabs.escalation', icon: 'trending_up', permission: Permissions.automationManage },
] as const;
