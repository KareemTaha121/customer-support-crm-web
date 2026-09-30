export interface PortalNavItem {
  /** Translation key (portal scope). */
  label: string;
  icon: string;
  route: string;
  exact: boolean;
  /** Only shown to signed-in customers. */
  requiresAuth: boolean;
}

/** Portal top navigation. Feature pages add their entries here. */
export const PORTAL_NAV: PortalNavItem[] = [
  { label: 'portal.nav.tickets', icon: 'confirmation_number', route: '/portal/tickets', exact: false, requiresAuth: true },
  { label: 'portal.nav.help', icon: 'help_center', route: '/help', exact: false, requiresAuth: false },
];
