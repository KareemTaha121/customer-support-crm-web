import { FeatureFlags } from '../../core/branding/feature-flags';

export interface PortalNavItem {
  /** Translation key (portal scope). */
  label: string;
  icon: string;
  route: string;
  exact: boolean;
  /** Only shown to signed-in customers. */
  requiresAuth: boolean;
  /** Public feature flag (`FeatureFlags`) that must be on for the item to show. */
  flag?: string;
}

/** Portal top navigation. Feature pages add their entries here. */
export const PORTAL_NAV: PortalNavItem[] = [
  { label: 'portal.nav.tickets', icon: 'confirmation_number', route: '/portal/tickets', exact: false, requiresAuth: true },
  { label: 'portal.nav.history', icon: 'history', route: '/portal/history', exact: false, requiresAuth: true },
  { label: 'portal.nav.assistant', icon: 'smart_toy', route: '/portal/assistant', exact: false, requiresAuth: false, flag: FeatureFlags.chatbot },
  { label: 'portal.nav.chat', icon: 'forum', route: '/portal/chat', exact: false, requiresAuth: false, flag: FeatureFlags.liveChat },
  { label: 'portal.nav.contact', icon: 'mail', route: '/portal/contact', exact: false, requiresAuth: false, flag: FeatureFlags.webForm },
  { label: 'portal.nav.help', icon: 'help_center', route: '/help', exact: false, requiresAuth: false },
];
