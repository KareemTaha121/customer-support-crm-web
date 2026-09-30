import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, DownloadedFile, RequestOptions } from '../../core/http/api.service';
import { AttachmentResponse, Paged } from '../../core/http/api.models';
import {
  BranchOption,
  CreateCustomerRequest,
  Customer,
  CustomerActivity,
  CustomerContactRequest,
  CustomerListItem,
  CustomerListQuery,
  CustomerNote,
  CustomerNoteRequest,
  DuplicateCandidate,
  GrantPortalAccessRequest,
  UpdateCustomerRequest,
} from './customers.models';

/** Calls for Application/Features/Customers/** and the staff portal-access endpoints. */
@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private readonly api = inject(ApiService);

  list(query: CustomerListQuery): Observable<Paged<CustomerListItem>> {
    return this.api.getPaged<CustomerListItem>('/customers', { params: { ...query } });
  }

  get(id: string, options?: RequestOptions): Observable<Customer> {
    return this.api.get<Customer>(`/customers/${id}`, options);
  }

  create(request: CreateCustomerRequest): Observable<Customer> {
    return this.api.post<Customer>('/customers', request, { silent: true });
  }

  update(id: string, request: UpdateCustomerRequest): Observable<Customer> {
    return this.api.put<Customer>(`/customers/${id}`, request, { silent: true });
  }

  delete(id: string): Observable<null> {
    return this.api.delete(`/customers/${id}`);
  }

  findDuplicates(email: string | null, phone: string | null, excludeCustomerId: string | null = null): Observable<DuplicateCandidate[]> {
    return this.api.get<DuplicateCandidate[]>('/customers/duplicates', { params: { email, phone, excludeCustomerId }, silent: true });
  }

  addContact(customerId: string, request: CustomerContactRequest): Observable<Customer> {
    return this.api.post<Customer>(`/customers/${customerId}/contacts`, request, { silent: true });
  }

  updateContact(customerId: string, contactId: string, request: CustomerContactRequest): Observable<Customer> {
    return this.api.put<Customer>(`/customers/${customerId}/contacts/${contactId}`, request, { silent: true });
  }

  removeContact(customerId: string, contactId: string): Observable<Customer> {
    return this.api.delete<Customer>(`/customers/${customerId}/contacts/${contactId}`);
  }

  setPrimaryContact(customerId: string, contactId: string): Observable<Customer> {
    return this.api.post<Customer>(`/customers/${customerId}/contacts/${contactId}/primary`);
  }

  listNotes(customerId: string, page: number, pageSize: number): Observable<Paged<CustomerNote>> {
    return this.api.getPaged<CustomerNote>(`/customers/${customerId}/notes`, { params: { page, pageSize } });
  }

  saveNote(customerId: string, noteId: string | null, request: CustomerNoteRequest): Observable<CustomerNote> {
    return noteId
      ? this.api.put<CustomerNote>(`/customers/${customerId}/notes/${noteId}`, request, { silent: true })
      : this.api.post<CustomerNote>(`/customers/${customerId}/notes`, request, { silent: true });
  }

  deleteNote(customerId: string, noteId: string): Observable<null> {
    return this.api.delete(`/customers/${customerId}/notes/${noteId}`);
  }

  listAttachments(customerId: string): Observable<AttachmentResponse[]> {
    return this.api.get<AttachmentResponse[]>(`/customers/${customerId}/attachments`);
  }

  uploadAttachment(customerId: string, file: File): Observable<AttachmentResponse> {
    return this.api.upload<AttachmentResponse>(`/customers/${customerId}/attachments`, file);
  }

  downloadAttachment(customerId: string, attachmentId: string): Observable<DownloadedFile> {
    return this.api.download(`/customers/${customerId}/attachments/${attachmentId}`);
  }

  deleteAttachment(customerId: string, attachmentId: string): Observable<null> {
    return this.api.delete(`/customers/${customerId}/attachments/${attachmentId}`);
  }

  history(customerId: string, page: number, pageSize: number, types: string | null): Observable<Paged<CustomerActivity>> {
    return this.api.getPaged<CustomerActivity>(`/customers/${customerId}/history`, { params: { page, pageSize, types } });
  }

  grantPortalAccess(customerId: string, request: GrantPortalAccessRequest): Observable<null> {
    return this.api.post<null>(`/customers/${customerId}/portal-access`, request, { silent: true });
  }

  revokePortalAccess(customerId: string): Observable<null> {
    return this.api.delete(`/customers/${customerId}/portal-access`);
  }

  /** GET /branches (any staff member) with their departments, for pickers and filters. */
  branches(): Observable<BranchOption[]> {
    return this.api.get<BranchOption[]>('/branches');
  }
}
