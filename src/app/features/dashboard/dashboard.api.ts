import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { ApiService, RequestOptions } from '../../core/http/api.service';
import {
  AgentDashboard,
  AgentTask,
  DashboardTicket,
  QuickReply,
  QuickReplyRequest,
  RenderedQuickReply,
  TaskRequest,
  TaskStatusFilter,
} from './dashboard.models';

/** Agent workspace endpoints (Application/Features/Dashboard/AgentWorkspaceSlices.cs). */
@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly api = inject(ApiService);

  agentDashboard(options?: RequestOptions): Observable<AgentDashboard> {
    return this.api.get<AgentDashboard>('/dashboard/agent', options);
  }

  // ---------- Tasks ----------

  tasks(status: TaskStatusFilter, options?: RequestOptions): Observable<AgentTask[]> {
    return this.api.get<AgentTask[]>('/tasks', { ...options, params: { status } }).pipe(map((items) => items ?? []));
  }

  createTask(request: TaskRequest): Observable<AgentTask> {
    return this.api.post<AgentTask>('/tasks', request, { silent: true });
  }

  updateTask(id: string, request: TaskRequest): Observable<AgentTask> {
    return this.api.put<AgentTask>(`/tasks/${id}`, request, { silent: true });
  }

  completeTask(id: string): Observable<null> {
    return this.api.post<null>(`/tasks/${id}/complete`);
  }

  reopenTask(id: string): Observable<null> {
    return this.api.post<null>(`/tasks/${id}/reopen`);
  }

  deleteTask(id: string): Observable<null> {
    return this.api.delete(`/tasks/${id}`);
  }

  // ---------- Quick replies ----------

  quickReplies(search?: string | null, options?: RequestOptions): Observable<QuickReply[]> {
    return this.api.get<QuickReply[]>('/quick-replies', { ...options, params: { search } }).pipe(map((items) => items ?? []));
  }

  createQuickReply(request: QuickReplyRequest): Observable<QuickReply> {
    return this.api.post<QuickReply>('/quick-replies', request, { silent: true });
  }

  updateQuickReply(id: string, request: QuickReplyRequest): Observable<QuickReply> {
    return this.api.put<QuickReply>(`/quick-replies/${id}`, request, { silent: true });
  }

  deleteQuickReply(id: string): Observable<null> {
    return this.api.delete(`/quick-replies/${id}`);
  }

  /** Fills placeholders for the ticket and counts the use. */
  renderQuickReply(id: string, ticketId?: string | null): Observable<RenderedQuickReply> {
    return this.api.post<RenderedQuickReply>(`/quick-replies/${id}/render`, {}, { silent: true, params: { ticketId } });
  }

  // ---------- Lookups ----------

  /** Ticket autocomplete for the task dialog (`GET /tickets`). */
  searchTickets(search: string): Observable<DashboardTicket[]> {
    return this.api.getPaged<DashboardTicket>('/tickets', { silent: true, params: { search, pageSize: 10 } }).pipe(map((page) => page.items));
  }
}

/** `2026-09-30T14:00` (datetime-local, local time) → ISO string, or null. */
export function localInputToIso(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** ISO string → `datetime-local` input value in local time. */
export function isoToLocalInput(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isOverdue(task: AgentTask): boolean {
  return !task.completedAt && !!task.dueAt && new Date(task.dueAt).getTime() < Date.now();
}

/**
 * The save commands wrap the request (`SaveTaskCommand.Task`, `SaveQuickReplyCommand.Reply`), so
 * server field paths look like `task.title`; strip the prefix so they match form controls.
 */
export function stripFieldPrefix(error: unknown, prefix: string): ApiError {
  const apiError = ApiError.from(error);
  const pattern = new RegExp(`^${prefix}[.]`, 'i');
  return new ApiError(
    apiError.status,
    apiError.code,
    apiError.message,
    apiError.errors.map((e) => ({ ...e, field: e.field ? e.field.replace(pattern, '') : e.field })),
    apiError.correlationId,
  );
}
