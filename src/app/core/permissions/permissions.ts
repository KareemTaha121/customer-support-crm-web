/**
 * Permission codes, mirrored from Domain/Roles/Permissions.cs. Never rename a value.
 */
export const Permissions = {
  ticketsView: 'tickets.view',
  ticketsCreate: 'tickets.create',
  ticketsUpdate: 'tickets.update',
  ticketsAssign: 'tickets.assign',
  ticketsEscalate: 'tickets.escalate',
  ticketsDelete: 'tickets.delete',
  ticketCategoriesManage: 'tickets.categories_manage',

  customersView: 'customers.view',
  customersCreate: 'customers.create',
  customersUpdate: 'customers.update',
  customersDelete: 'customers.delete',
  customerNotesManage: 'customers.notes_manage',
  customerAttachmentsManage: 'customers.attachments_manage',

  knowledgeView: 'kb.view',
  knowledgeManage: 'kb.manage',
  knowledgePublish: 'kb.publish',

  slaManage: 'sla.manage',
  automationManage: 'automation.manage',

  chatHandle: 'chat.handle',
  channelsManage: 'channels.manage',
  quickRepliesManage: 'quickreplies.manage',

  reportsView: 'reports.view',
  reportsExport: 'reports.export',

  aiUse: 'ai.use',

  usersManage: 'users.manage',
  rolesManage: 'roles.manage',
  auditView: 'audit.view',
  auditExport: 'audit.export',
  organizationManage: 'organization.manage',
  settingsManage: 'settings.manage',
  integrationsManage: 'integrations.manage',

  dataAllBranches: 'data.all_branches',
} as const;

export type PermissionCode = (typeof Permissions)[keyof typeof Permissions];
