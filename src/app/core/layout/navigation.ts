import { Permissions } from '../permissions/permissions';

export interface NavItem {
  /** Translation key (core scope). */
  label: string;
  icon: string;
  route: string;
  /** Shown when the user holds any of these; empty = every signed-in user. */
  permissions: string[];
}

export interface NavSection {
  label: string | null;
  items: NavItem[];
}

/** The staff sidenav. Each route is owned by the feature that lazy-loads it (see app.routes.ts). */
export const NAVIGATION: NavSection[] = [
  {
    label: null,
    items: [
      { label: 'core.nav.dashboard', icon: 'dashboard', route: '/dashboard', permissions: [] },
      { label: 'core.nav.tickets', icon: 'confirmation_number', route: '/tickets', permissions: [Permissions.ticketsView] },
      { label: 'core.nav.customers', icon: 'groups', route: '/customers', permissions: [Permissions.customersView] },
      { label: 'core.nav.chat', icon: 'forum', route: '/chat', permissions: [Permissions.chatHandle] },
      { label: 'core.nav.knowledgeBase', icon: 'menu_book', route: '/knowledge-base', permissions: [Permissions.knowledgeView] },
      { label: 'core.nav.reports', icon: 'insights', route: '/reports', permissions: [Permissions.reportsView] },
    ],
  },
  {
    label: 'core.nav.configuration',
    items: [
      { label: 'core.nav.ticketCategories', icon: 'category', route: '/tickets/categories', permissions: [Permissions.ticketCategoriesManage] },
      { label: 'core.nav.sla', icon: 'timer', route: '/sla', permissions: [Permissions.slaManage, Permissions.automationManage] },
      { label: 'core.nav.channels', icon: 'hub', route: '/channels', permissions: [Permissions.channelsManage] },
    ],
  },
  {
    label: 'core.nav.administration',
    items: [
      { label: 'core.nav.users', icon: 'manage_accounts', route: '/admin/users', permissions: [Permissions.usersManage] },
      { label: 'core.nav.roles', icon: 'admin_panel_settings', route: '/admin/roles', permissions: [Permissions.rolesManage] },
      { label: 'core.nav.organization', icon: 'apartment', route: '/admin/organization', permissions: [Permissions.organizationManage, Permissions.settingsManage] },
      { label: 'core.nav.settings', icon: 'tune', route: '/admin/settings', permissions: [Permissions.settingsManage] },
      { label: 'core.nav.integrations', icon: 'extension', route: '/admin/integrations', permissions: [Permissions.integrationsManage] },
      { label: 'core.nav.audit', icon: 'history', route: '/admin/audit', permissions: [Permissions.auditView] },
    ],
  },
];
