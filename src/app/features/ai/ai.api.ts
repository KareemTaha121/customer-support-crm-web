import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import {
  AiFeedbackRequest,
  AiStatus,
  Categorization,
  SolutionSuggestions,
  SuggestReplyRequest,
  SuggestedReply,
  TicketSummary,
} from './ai.models';

/** AI assistant endpoints (Application/Features/Ai/AiSlices.cs, group `/ai`, permission `ai.use`). */
@Injectable({ providedIn: 'root' })
export class AiApi {
  private readonly api = inject(ApiService);

  status(): Observable<AiStatus> {
    return this.api.get<AiStatus>('/ai/status', { silent: true });
  }

  summarize(ticketId: string): Observable<TicketSummary> {
    return this.api.post<TicketSummary>(`/ai/tickets/${encodeURIComponent(ticketId)}/summary`, {}, { silent: true });
  }

  suggestReply(ticketId: string, body: SuggestReplyRequest): Observable<SuggestedReply> {
    return this.api.post<SuggestedReply>(`/ai/tickets/${encodeURIComponent(ticketId)}/reply`, body, { silent: true });
  }

  categorize(ticketId: string): Observable<Categorization> {
    return this.api.post<Categorization>(`/ai/tickets/${encodeURIComponent(ticketId)}/categorize`, {}, { silent: true });
  }

  solutions(ticketId: string): Observable<SolutionSuggestions> {
    return this.api.post<SolutionSuggestions>(`/ai/tickets/${encodeURIComponent(ticketId)}/solutions`, {}, { silent: true });
  }

  feedback(suggestionId: string, accepted: boolean): Observable<null> {
    const body: AiFeedbackRequest = { accepted };
    return this.api.post<null>(`/ai/suggestions/${encodeURIComponent(suggestionId)}/feedback`, body, { silent: true });
  }
}
