/** Application/Domain ChatStatus. */
export type ChatStatus = 'Waiting' | 'Active' | 'Closed';

/** `GET /chat/conversations?status=` values (LiveChat.cs `ListChatsHandler`). */
export type ChatFilter = 'waiting' | 'mine' | 'active' | 'closed';

export const CHAT_FILTERS: readonly ChatFilter[] = ['waiting', 'mine', 'active', 'closed'];

/** LiveChat.cs `ChatConversationResponse`. */
export interface ChatConversation {
  id: string;
  ticketId: string;
  ticketNumber: string;
  visitorName: string;
  status: ChatStatus;
  agentId: string | null;
  agentName: string | null;
  startedAt: string;
  lastMessageAt: string;
}

export type MessageAuthorType = 'Agent' | 'Customer' | 'System';

/** Contracts/Tickets `TicketMessageResponse` (the chat transcript is the ticket's messages). */
export interface ChatMessage {
  id: string;
  authorType: MessageAuthorType;
  authorName: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

/** `chatMessage` realtime payload (CustomerMessaging.cs `ChannelDeliveryHandlers`). */
export interface ChatMessageEvent {
  conversationId: string;
  messageId: string;
  authorType: MessageAuthorType;
  body: string;
  createdAt: string;
}

/** `chatUpdated` realtime payload (start, accept, close). */
export interface ChatUpdatedEvent {
  conversationId: string;
  status: ChatStatus;
  agentName?: string;
  visitorName?: string;
  ticketNumber?: string;
}

/** CustomerMessaging.cs `ChannelStatusResponse`. */
export interface ChannelStatus {
  channel: string;
  configured: boolean;
}

export type OutboundStatus = 'Pending' | 'Sent' | 'Failed';

export const OUTBOUND_STATUSES: readonly OutboundStatus[] = ['Pending', 'Sent', 'Failed'];

/** CustomerMessaging.cs `OutboundMessageResponse`. */
export interface OutboundMessage {
  id: string;
  channel: string;
  to: string;
  subject: string | null;
  status: OutboundStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
  ticketId: string | null;
}

/** CustomerMessaging.cs `TestChannelRequest`; channel must be Email, WhatsApp or Sms. */
export interface TestChannelRequest {
  channel: string;
  to: string;
}

export const TEST_CHANNELS = ['Email', 'WhatsApp', 'Sms'] as const;

/** Fixed page size of `GET /channels/outbox`. */
export const OUTBOX_PAGE_SIZE = 50;

export const CHAT_MESSAGE_MAX_LENGTH = 5000;

export const ChannelErrorCodes = {
  chatClosed: 'CHAT_CLOSED',
  chatNotFound: 'CHAT_NOT_FOUND',
} as const;

export function channelIcon(channel: string): string {
  switch (channel) {
    case 'Email':
      return 'mail';
    case 'WhatsApp':
      return 'chat';
    case 'Sms':
      return 'sms';
    case 'Chat':
      return 'forum';
    default:
      return 'hub';
  }
}
