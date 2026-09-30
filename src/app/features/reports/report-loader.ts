import { Signal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, combineLatest, map, of, startWith, switchMap, tap } from 'rxjs';
import { QueryParams } from '../../core/http/api.models';

export interface ReportState<T> {
  readonly data: Signal<T | null>;
  readonly loading: Signal<boolean>;
  readonly error: Signal<boolean>;
  reload(): void;
}

/**
 * Loads a report whenever the filter params change (stale requests are cancelled).
 * Must be called in an injection context (a field initializer). Errors already show the global
 * snackbar; `error` drives the inline retry state.
 */
export function loadReport<T>(params: Signal<QueryParams | null>, fetch: (params: QueryParams) => Observable<T>): ReportState<T> {
  const data = signal<T | null>(null);
  const loading = signal(false);
  const error = signal(false);
  const reload$ = new Subject<void>();

  combineLatest([toObservable(params), reload$.pipe(startWith(undefined))])
    .pipe(
      switchMap(([current]) => {
        if (!current) {
          loading.set(false);
          return EMPTY;
        }
        loading.set(true);
        error.set(false);
        return fetch(current).pipe(
          map((result) => ({ ok: true as const, result })),
          catchError(() => of({ ok: false as const })),
        );
      }),
      tap((outcome) => {
        loading.set(false);
        if (outcome.ok) {
          data.set(outcome.result);
        } else {
          error.set(true);
        }
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  return { data, loading, error, reload: () => reload$.next() };
}
