import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService, DownloadedFile } from '../../core/http/api.service';
import { AttachmentResponse, Paged } from '../../core/http/api.models';
import {
  AddTicketMessageRequest,
  BranchOption,
  CreateTicketRequest,
  CustomerOption,
  Ticket,
  TicketCategory,
  TicketCategoryRequest,
  TicketHistoryEntry,
  TicketListItem,
  TicketListQuery,
  TicketMessage,
  TransferTicketRequest,
  UpdateTicketRequest,
  UserLookup,
} from './tickets.models';

/** Tickets endpoints (Application/Features/Tickets/**) plus the pickers the pages need. */
@Injectable({ providedIn: 'root' })
export class TicketsApi {
  private readonly api = inject(ApiService);

  list(query: TicketListQuery): Observable<Paged<TicketListItem>> {
    return this.api.getPaged<TicketListItem>('/tickets', { params: { ...query } });
  }

  get(id: string, silent = false): Observable<Ticket> {
    return this.api.get<Ticket>(`/tickets/${id}`, { silent });
  }

  messages(id: string): Observable<TicketMessage[]> {
    return this.api.get<TicketMessage[]>(`/tickets/${id}/messages`).pipe(map((items) => items ?? []));
  }

  history(id: string): Observable<TicketHistoryEntry[]> {
    return this.api.get<TicketHistoryEntry[]>(`/tickets/${id}/history`).pipe(map((items) => items ?? []));
  }

  attachments(id: string): Observable<AttachmentResponse[]> {
    return this.api.get<AttachmentResponse[]>(`/tickets/${id}/attachments`).pipe(map((items) => items ?? []));
  }

  create(body: CreateTicketRequest): Observable<Ticket> {
    return this.api.post<Ticket>('/tickets', body, { silent: true });
  }

  update(id: string, body: UpdateTicketRequest, silent = false): Observable<Ticket> {
    return this.api.put<Ticket>(`/tickets/${id}`, body, { silent });
  }

  assign(id: string, agentId: string | null): Observable<Ticket> {
    return this.api.post<Ticket>(`/tickets/${id}/assign`, { agentId });
  }

  transfer(id: string, body: TransferTicketRequest): Observable<Ticket> {
    return this.api.post<Ticket>(`/tickets/${id}/transfer`, body);
  }

  /** `status` is a target status or "Reopen". */
  changeStatus(id: string, status: string): Observable<Ticket> {
    return this.api.post<Ticket>(`/tickets/${id}/status`, { status });
  }

  escalate(id: string, reason: string): Observable<Ticket> {
    return this.api.post<Ticket>(`/tickets/${id}/escalate`, { reason });
  }

  delete(id: string): Observable<null> {
    return this.api.delete(`/tickets/${id}`);
  }

  addMessage(id: string, body: AddTicketMessageRequest): Observable<TicketMessage> {
    return this.api.post<TicketMessage>(`/tickets/${id}/messages`, body, { silent: true });
  }

  uploadAttachment(id: string, file: File): Observable<AttachmentResponse> {
    return this.api.upload<AttachmentResponse>(`/tickets/${id}/attachments`, file);
  }

  /** `downloadUrl` is the absolute server path (`/api/v1/tickets/{id}/attachments/{attachmentId}`). */
  downloadAttachment(attachment: AttachmentResponse): Observable<DownloadedFile> {
    return this.api.download(attachment.downloadUrl);
  }

  deleteAttachment(ticketId: string, attachmentId: string): Observable<null> {
    return this.api.delete(`/tickets/${ticketId}/attachments/${attachmentId}`);
  }

  categories(includeInactive = false): Observable<TicketCategory[]> {
    return this.api.get<TicketCategory[]>('/ticket-categories', { params: { includeInactive } }).pipe(map((items) => items ?? []));
  }

  saveCategory(id: string | null, body: TicketCategoryRequest): Observable<TicketCategory> {
    return id
      ? this.api.put<TicketCategory>(`/ticket-categories/${id}`, body, { silent: true })
      : this.api.post<TicketCategory>('/ticket-categories', body, { silent: true });
  }

  /** Active staff who can work tickets (assignee picker). */
  lookupUsers(search: string): Observable<UserLookup[]> {
    return this.api
      .get<UserLookup[]>('/users/lookup', { params: { search, permission: 'tickets.update' } })
      .pipe(map((items) => items ?? []));
  }

  searchCustomers(search: string): Observable<CustomerOption[]> {
    return this.api.getPaged<CustomerOption>('/customers', { params: { search, pageSize: 10 } }).pipe(map((page) => page.items));
  }

  /** `GET /customers/{id}` (only the fields shared with the list item are used). */
  getCustomer(id: string): Observable<CustomerOption> {
    return this.api.get<CustomerOption>(`/customers/${id}`, { silent: true });
  }

  branches(): Observable<BranchOption[]> {
    return this.api.get<BranchOption[]>('/branches').pipe(map((items) => items ?? []));
  }
}
