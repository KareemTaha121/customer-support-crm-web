import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import {
  AssignmentRuleRequest,
  AssignmentRuleResponse,
  BranchResponse,
  EscalationRuleRequest,
  EscalationRuleResponse,
  SlaPolicyRequest,
  SlaPolicyResponse,
  TicketCategoryOption,
  UserLookup,
} from './sla.models';

const POLICIES = '/sla-policies';
const ASSIGNMENT = '/automation/assignment-rules';
const ESCALATION = '/automation/escalation-rules';

/** Application/Features/Sla/SlaAdministration.cs endpoints plus the picker sources. */
@Injectable({ providedIn: 'root' })
export class SlaApi {
  private readonly api = inject(ApiService);

  listPolicies(): Observable<SlaPolicyResponse[]> {
    return this.api.get<SlaPolicyResponse[]>(POLICIES);
  }

  savePolicy(id: string | null, body: SlaPolicyRequest): Observable<SlaPolicyResponse> {
    return id ? this.api.put(`${POLICIES}/${id}`, body, { silent: true }) : this.api.post(POLICIES, body, { silent: true });
  }

  deletePolicy(id: string): Observable<null> {
    return this.api.delete(`${POLICIES}/${id}`);
  }

  listAssignmentRules(): Observable<AssignmentRuleResponse[]> {
    return this.api.get<AssignmentRuleResponse[]>(ASSIGNMENT);
  }

  saveAssignmentRule(id: string | null, body: AssignmentRuleRequest): Observable<AssignmentRuleResponse> {
    return id ? this.api.put(`${ASSIGNMENT}/${id}`, body, { silent: true }) : this.api.post(ASSIGNMENT, body, { silent: true });
  }

  deleteAssignmentRule(id: string): Observable<null> {
    return this.api.delete(`${ASSIGNMENT}/${id}`);
  }

  listEscalationRules(): Observable<EscalationRuleResponse[]> {
    return this.api.get<EscalationRuleResponse[]>(ESCALATION);
  }

  saveEscalationRule(id: string | null, body: EscalationRuleRequest): Observable<EscalationRuleResponse> {
    return id ? this.api.put(`${ESCALATION}/${id}`, body, { silent: true }) : this.api.post(ESCALATION, body, { silent: true });
  }

  deleteEscalationRule(id: string): Observable<null> {
    return this.api.delete(`${ESCALATION}/${id}`);
  }

  categories(): Observable<TicketCategoryOption[]> {
    return this.api.get<TicketCategoryOption[]>('/ticket-categories', { params: { includeInactive: true }, silent: true });
  }

  branches(): Observable<BranchResponse[]> {
    return this.api.get<BranchResponse[]>('/branches', { params: { includeInactive: true }, silent: true });
  }

  lookupUsers(search: string | null = null): Observable<UserLookup[]> {
    return this.api.get<UserLookup[]>('/users/lookup', { params: { search }, silent: true });
  }
}
