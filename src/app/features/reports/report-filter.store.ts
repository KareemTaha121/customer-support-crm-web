import { Injectable, computed, inject, signal } from '@angular/core';
import { QueryParams } from '../../core/http/api.models';
import { ReportsApi } from './reports.api';
import { BranchOption, ReportGroupBy } from './reports.models';

/** The API rejects ranges longer than this (ReportFilterFactory.MaxRange). */
export const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;

export interface ReportFilterValue {
  /** First day of the range (local midnight). */
  from: Date;
  /** Last day of the range, inclusive (local midnight). */
  to: Date;
  groupBy: ReportGroupBy;
  branchId: string | null;
  departmentId: string | null;
}

export type ReportRangeError = 'inverted' | 'tooLong' | null;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function defaultReportFilter(): ReportFilterValue {
  const today = startOfDay(new Date());
  return { from: addDays(today, -29), to: today, groupBy: 'day', branchId: null, departmentId: null };
}

/**
 * Filter state shared by every reports tab (provided on the feature route, so it survives tab switches).
 * `params` is `null` while the range is invalid so no request is sent.
 */
@Injectable()
export class ReportFilterStore {
  private readonly api = inject(ReportsApi);
  private branchesRequested = false;

  /** Branches (with departments) for the pickers, loaded once per feature visit. */
  readonly branches = signal<BranchOption[]>([]);

  readonly value = signal<ReportFilterValue>(defaultReportFilter());

  readonly rangeError = computed<ReportRangeError>(() => {
    const { from, to } = this.value();
    if (to.getTime() < from.getTime()) {
      return 'inverted';
    }
    // +1: the end day is inclusive.
    return Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1 > MAX_RANGE_DAYS ? 'tooLong' : null;
  });

  readonly params = computed<QueryParams | null>(() => {
    if (this.rangeError()) {
      return null;
    }
    const { from, to, groupBy, branchId, departmentId } = this.value();
    return {
      from: startOfDay(from).toISOString(),
      // The API's `to` is exclusive: send the start of the day after the last selected day.
      to: addDays(to, 1).toISOString(),
      groupBy,
      branchId,
      departmentId,
    };
  });

  loadBranches(): void {
    if (this.branchesRequested) {
      return;
    }
    this.branchesRequested = true;
    this.api.branches().subscribe({
      next: (branches) => this.branches.set(branches ?? []),
      error: () => (this.branchesRequested = false),
    });
  }

  update(patch: Partial<ReportFilterValue>): void {
    this.value.update((current) => ({ ...current, ...patch }));
  }

  reset(): void {
    this.value.set(defaultReportFilter());
  }
}
