import { ApiError } from '../../core/http/api-error';
import { AttachmentResponse } from '../../core/http/api.models';

/** Contracts/Portal/PortalContracts.cs PortalTicketListItemResponse */
export interface PortalTicketListItem {
  id: string;
  number: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  lastAgentReplyAt: string | null;
}

/** Contracts/Portal/PortalContracts.cs PortalTicketResponse */
export interface PortalTicket {
  id: string;
  number: string;
  subject: string;
  description: string;
  status: string;
  categoryName: string | null;
  agentName: string | null;
  canReply: boolean;
  canGiveFeedback: boolean;
  satisfactionRating: number | null;
  satisfactionComment: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/** Contracts/Portal/PortalContracts.cs PortalMessageResponse */
export interface PortalMessage {
  id: string;
  authorType: string;
  authorName: string;
  body: string;
  createdAt: string;
  attachments: AttachmentResponse[];
}

/** Contracts/Portal/PortalContracts.cs PortalCategoryResponse */
export interface PortalCategory {
  id: string;
  name: string;
  nameAr: string | null;
}

/** Contracts/Portal/PortalContracts.cs PortalHistoryItemResponse */
export interface PortalHistoryItem {
  id: string;
  type: string;
  summary: string;
  ticketId: string | null;
  occurredAt: string;
}

export type PortalTicketFilter = 'open' | 'closed' | 'all';

export interface PortalCreateTicketRequest {
  subject: string;
  message: string;
  categoryId: string | null;
}

// ---------- Live chat (Application/Features/Channels/LiveChat.cs) ----------

export interface StartChatRequest {
  name: string;
  email: string;
  message: string;
  language: string | null;
}

export interface ChatStarted {
  conversationId: string;
  accessToken: string;
  ticketNumber: string;
}

/** Contracts/Tickets/TicketContracts.cs TicketMessageResponse (public messages only). */
export interface ChatMessage {
  id: string;
  authorType: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface VisitorChat {
  id: string;
  status: string;
  agentName: string | null;
  messages: ChatMessage[];
}

/** `chatMessage` realtime payload (Features/Channels/CustomerMessaging.cs). */
export interface ChatMessageEvent {
  conversationId: string;
  messageId: string;
  authorType: string;
  body: string;
  createdAt: string;
}

/** `chatUpdated` realtime payload (Features/Channels/LiveChat.cs). */
export interface ChatUpdatedEvent {
  conversationId: string;
  status: string;
  agentName?: string | null;
}

/** What the visitor keeps in sessionStorage to resume a chat after a reload. */
export interface StoredChat {
  conversationId: string;
  accessToken: string;
  ticketNumber: string;
}

// ---------- Chatbot (Contracts/Ai/AiContracts.cs) ----------

export interface ChatbotTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatbotSource {
  articleId: string;
  title: string;
  slug: string;
}

export interface ChatbotResponse {
  answer: string;
  handoff: boolean;
  sources: ChatbotSource[];
}

// ---------- Web form (Features/Channels/InboundChannels.cs) ----------

export interface WebFormTicketRequest {
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  categoryId: string | null;
  language: string | null;
  website: string | null;
}

export interface WebFormTicketResponse {
  ticketNumber: string;
}

// ---------- Helpers ----------

/** Maximum attachments per message (PortalAddMessageValidator). */
export const MAX_ATTACHMENTS = 10;

/** Pill modifier for a ticket status. */
export function ticketStatusTone(status: string): string {
  switch (status) {
    case 'New':
    case 'Open':
      return 'crm-pill--info';
    case 'PendingCustomer':
      return 'crm-pill--warning';
    case 'PendingInternal':
    case 'Escalated':
      return 'crm-pill--primary';
    case 'Resolved':
    case 'Closed':
      return 'crm-pill--success';
    default:
      return '';
  }
}

/** `ticket.created` -> `ticket_created` (translation keys cannot contain dots). */
export function historyTypeKey(type: string): string {
  return `portal.history.types.${type.replace(/[^a-z0-9]/gi, '_')}`;
}

/**
 * Validation paths of wrapped requests start with the command property (`form.name`,
 * `request.email`); strips that prefix so `applyServerErrors` finds the controls.
 */
export function withoutFieldPrefix(error: unknown, prefix: string): ApiError {
  const apiError = ApiError.from(error);
  const lead = `${prefix.toLowerCase()}.`;
  const errors = apiError.errors.map((item) =>
    item.field && item.field.toLowerCase().startsWith(lead) ? { ...item, field: item.field.slice(lead.length) } : item,
  );
  return new ApiError(apiError.status, apiError.code, apiError.message, errors, apiError.correlationId);
}
