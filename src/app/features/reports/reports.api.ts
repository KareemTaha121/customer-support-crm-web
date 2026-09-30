import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, DownloadedFile } from '../../core/http/api.service';
import { QueryParams } from '../../core/http/api.models';
import {
  AgentPerformanceReport,
  BranchOption,
  CustomerSatisfactionReport,
  ManagementDashboard,
  ReportKind,
  SlaPerformanceReport,
  TicketVolumeReport,
} from './reports.models';

/** `/reports/*` (ReportSlices.cs) and the branch list used by the filters. */
@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly api = inject(ApiService);

  ticketVolume(params: QueryParams): Observable<TicketVolumeReport> {
    return this.api.get<TicketVolumeReport>('/reports/ticket-volume', { params });
  }

  slaPerformance(params: QueryParams): Observable<SlaPerformanceReport> {
    return this.api.get<SlaPerformanceReport>('/reports/sla-performance', { params });
  }

  agentPerformance(params: QueryParams): Observable<AgentPerformanceReport> {
    return this.api.get<AgentPerformanceReport>('/reports/agent-performance', { params });
  }

  customerSatisfaction(params: QueryParams): Observable<CustomerSatisfactionReport> {
    return this.api.get<CustomerSatisfactionReport>('/reports/customer-satisfaction', { params });
  }

  managementDashboard(params: QueryParams): Observable<ManagementDashboard> {
    return this.api.get<ManagementDashboard>('/reports/management-dashboard', { params });
  }

  /** Active branches with their departments (any staff member may read them). */
  branches(): Observable<BranchOption[]> {
    return this.api.get<BranchOption[]>('/branches', { silent: true });
  }

  /** Authenticated CSV download with the same filters as the on-screen report. */
  exportCsv(kind: ReportKind, params: QueryParams): Observable<DownloadedFile> {
    return this.api.download(`/reports/export/${kind}.csv`, { params });
  }
}
