import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Paged } from '../../core/http/api.models';
import { ApiService } from '../../core/http/api.service';
import {
  ChannelStatus,
  ChatConversation,
  ChatFilter,
  ChatMessage,
  OutboundMessage,
  OutboundStatus,
  TestChannelRequest,
} from './channels.models';

/** Live chat (agent side) and channel administration endpoints. */
@Injectable({ providedIn: 'root' })
export class ChannelsApi {
  private readonly api = inject(ApiService);

  listChats(status: ChatFilter, silent = false): Observable<ChatConversation[]> {
    return this.api.get<ChatConversation[]>('/chat/conversations', { params: { status }, silent });
  }

  /** The chat transcript: public messages of the backing ticket (`chat.handle`, staff scope). */
  messages(conversationId: string): Observable<ChatMessage[]> {
    return this.api.get<ChatMessage[]>(`/chat/conversations/${conversationId}/messages`, { silent: true });
  }

  accept(conversationId: string): Observable<null> {
    return this.api.post<null>(`/chat/conversations/${conversationId}/accept`, {}, { silent: true });
  }

  send(conversationId: string, body: string): Observable<null> {
    return this.api.post<null>(`/chat/conversations/${conversationId}/messages`, { body }, { silent: true });
  }

  close(conversationId: string): Observable<null> {
    return this.api.post<null>(`/chat/conversations/${conversationId}/close`, {}, { silent: true });
  }

  channelStatus(): Observable<ChannelStatus[]> {
    return this.api.get<ChannelStatus[]>('/channels/status');
  }

  sendTest(request: TestChannelRequest): Observable<null> {
    return this.api.post<null>('/channels/test', request, { silent: true });
  }

  outbox(status: OutboundStatus | null, page: number): Observable<Paged<OutboundMessage>> {
    return this.api.getPaged<OutboundMessage>('/channels/outbox', { params: { status, page } });
  }

  retry(id: string): Observable<null> {
    return this.api.post<null>(`/channels/outbox/${id}/retry`);
  }
}
