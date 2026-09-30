import { Routes } from '@angular/router';
import { requirePermission } from '../../core/guards/auth.guards';
import { translationResolver } from '../../core/localization/translation.resolver';
import { Permissions } from '../../core/permissions/permissions';

/** `/chat` — agent live chat console. */
export const CHAT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [requirePermission(Permissions.chatHandle)],
    resolve: { i18n: translationResolver('channels') },
    loadComponent: () => import('./chat-console.page').then((m) => m.ChatConsolePage),
  },
];

/** `/channels` — channel status, test messages and the outbox. */
export const CHANNELS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [requirePermission(Permissions.channelsManage)],
    resolve: { i18n: translationResolver('channels') },
    loadComponent: () => import('./channels-admin.page').then((m) => m.ChannelsAdminPage),
  },
];
