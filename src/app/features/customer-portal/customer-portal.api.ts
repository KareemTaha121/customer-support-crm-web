import { Injectable, inject } from '@angular/core';
import { Observable, concatMap, from, of, toArray } from 'rxjs';
import { AttachmentResponse, Paged } from '../../core/http/api.models';
import { ApiService, DownloadedFile } from '../../core/http/api.service';
import {
  ChatbotResponse,
  ChatbotTurn,
  ChatStarted,
  PortalCategory,
  PortalCreateTicketRequest,
  PortalHistoryItem,
  PortalMessage,
  PortalTicket,
  PortalTicketFilter,
  PortalTicketListItem,
  StartChatRequest,
  VisitorChat,
  WebFormTicketRequest,
  WebFormTicketResponse,
} from './customer-portal.models';

/** Signed-in customer endpoints (`/api/v1/portal/*`, customer token added by the interceptor). */
@Injectable({ providedIn: 'root' })
export class PortalTicketsApi {
  private readonly api = inject(ApiService);

  categories(): Observable<PortalCategory[]> {
    return this.api.get<PortalCategory[]>('/portal/categories');
  }

  history(page: number): Observable<Paged<PortalHistoryItem>> {
    return this.api.getPaged<PortalHistoryItem>('/portal/history', { params: { page }, silent: true });
  }

  list(status: PortalTicketFilter, page: number, pageSize: number): Observable<Paged<PortalTicketListItem>> {
    return this.api.getPaged<PortalTicketListItem>('/portal/tickets', { params: { status, page, pageSize }, silent: true });
  }

  create(request: PortalCreateTicketRequest): Observable<PortalTicket> {
    return this.api.post<PortalTicket>('/portal/tickets', request, { silent: true });
  }

  get(id: string): Observable<PortalTicket> {
    return this.api.get<PortalTicket>(`/portal/tickets/${id}`, { silent: true });
  }

  messages(id: string): Observable<PortalMessage[]> {
    return this.api.get<PortalMessage[]>(`/portal/tickets/${id}/messages`, { silent: true });
  }

  reply(id: string, body: string, attachmentIds: string[]): Observable<null> {
    return this.api.post<null>(`/portal/tickets/${id}/messages`, { body, attachmentIds }, { silent: true });
  }

  /** Uploads files one after another; emits the stored attachments in order. */
  uploadAll(id: string, files: readonly File[]): Observable<AttachmentResponse[]> {
    if (!files.length) {
      return of([]);
    }
    return from(files).pipe(
      concatMap((file) => this.api.upload<AttachmentResponse>(`/portal/tickets/${id}/attachments`, file, undefined, { silent: true })),
      toArray(),
    );
  }

  download(ticketId: string, attachmentId: string): Observable<DownloadedFile> {
    return this.api.download(`/portal/tickets/${ticketId}/attachments/${attachmentId}`);
  }

  feedback(id: string, rating: number, comment: string | null): Observable<PortalTicket> {
    return this.api.post<PortalTicket>(`/portal/tickets/${id}/feedback`, { rating, comment }, { silent: true });
  }

  close(id: string): Observable<PortalTicket> {
    return this.api.post<PortalTicket>(`/portal/tickets/${id}/close`);
  }
}

/** Anonymous channels (`/api/v1/public/*`): web form, live chat visitor side, chatbot. */
@Injectable({ providedIn: 'root' })
export class PortalPublicApi {
  private readonly api = inject(ApiService);

  submitWebForm(request: WebFormTicketRequest): Observable<WebFormTicketResponse> {
    return this.api.post<WebFormTicketResponse>('/public/web-forms/tickets', request, { anonymous: true, silent: true });
  }

  startChat(request: StartChatRequest): Observable<ChatStarted> {
    return this.api.post<ChatStarted>('/public/chat/conversations', request, { anonymous: true, silent: true });
  }

  getChat(id: string, token: string): Observable<VisitorChat> {
    return this.api.get<VisitorChat>(`/public/chat/conversations/${id}`, { anonymous: true, silent: true, headers: chatHeaders(token) });
  }

  sendChatMessage(id: string, token: string, body: string): Observable<null> {
    return this.api.post<null>(`/public/chat/conversations/${id}/messages`, { body }, { anonymous: true, silent: true, headers: chatHeaders(token) });
  }

  closeChat(id: string, token: string): Observable<null> {
    return this.api.post<null>(`/public/chat/conversations/${id}/close`, {}, { anonymous: true, silent: true, headers: chatHeaders(token) });
  }

  chatbot(messages: ChatbotTurn[], language: string): Observable<ChatbotResponse> {
    return this.api.post<ChatbotResponse>('/public/chatbot/messages', { messages, language }, { anonymous: true, silent: true });
  }
}

/** The per-conversation visitor token header (LiveChat.cs ChatTokens.HeaderName). */
function chatHeaders(token: string): Record<string, string> {
  return { 'X-Chat-Token': token };
}
