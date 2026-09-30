import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { catchError, debounceTime, distinctUntilChanged, filter, of, switchMap } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { FormErrorPipe } from '../../shared/form-error.pipe';
import { applyServerErrors } from '../../shared/form-errors';
import { DashboardApi, isoToLocalInput, localInputToIso, stripFieldPrefix } from './dashboard.api';
import { AgentTask, DashboardTicket, TASK_NOTES_MAX, TASK_TITLE_MAX, TaskRequest } from './dashboard.models';

export interface TaskDialogData {
  task: AgentTask | null;
}

interface LinkedTicket {
  id: string;
  number: string;
}

/** Create/edit a task: title, notes, due date, reminder and an optional related ticket. */
@Component({
  selector: 'app-task-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatAutocompleteModule,
    MatProgressBarModule,
    TranslatePipe,
    FormErrorPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ (data.task ? 'dashboard.tasks.editTitle' : 'dashboard.tasks.createTitle') | t }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        @if (busy()) {
          <mat-progress-bar mode="indeterminate" />
        }
        <div class="crm-form-grid">
          <mat-form-field class="crm-span-all">
            <mat-label>{{ 'dashboard.tasks.fields.title' | t }}</mat-label>
            <input matInput formControlName="title" [maxlength]="titleMax" cdkFocusInitial />
            <mat-error>{{ form.controls.title | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field class="crm-span-all">
            <mat-label>{{ 'dashboard.tasks.fields.notes' | t }}</mat-label>
            <textarea matInput formControlName="notes" rows="3" [maxlength]="notesMax"></textarea>
            <mat-error>{{ form.controls.notes | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'dashboard.tasks.fields.dueAt' | t }}</mat-label>
            <input matInput type="datetime-local" formControlName="dueAt" />
            <mat-error>{{ form.controls.dueAt | formError }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>{{ 'dashboard.tasks.fields.remindAt' | t }}</mat-label>
            <input matInput type="datetime-local" formControlName="remindAt" />
            <mat-hint>{{ 'dashboard.tasks.fields.remindHint' | t }}</mat-hint>
            <mat-error>{{ form.controls.remindAt | formError }}</mat-error>
          </mat-form-field>
          <div class="crm-span-all ticket-field">
            @if (ticket(); as linked) {
              <div class="linked">
                <mat-icon aria-hidden="true">confirmation_number</mat-icon>
                <span>{{ 'dashboard.tasks.fields.relatedTicket' | t }}: <strong>{{ linked.number }}</strong></span>
                <button mat-icon-button type="button" (click)="clearTicket()" [attr.aria-label]="'dashboard.tasks.unlinkTicket' | t">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            } @else {
              <mat-form-field>
                <mat-label>{{ 'dashboard.tasks.fields.relatedTicket' | t }}</mat-label>
                <input matInput [formControl]="ticketSearch" [matAutocomplete]="ticketAuto" [placeholder]="'dashboard.tasks.ticketSearchHint' | t" />
                <mat-icon matSuffix>search</mat-icon>
                <mat-autocomplete #ticketAuto="matAutocomplete" (optionSelected)="pickTicket($event)">
                  @for (option of ticketOptions(); track option.id) {
                    <mat-option [value]="option">
                      <strong>{{ option.number }}</strong> · {{ option.subject }}
                    </mat-option>
                  }
                </mat-autocomplete>
              </mat-form-field>
            }
          </div>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'core.actions.cancel' | t }}</button>
        <button mat-flat-button type="submit" [disabled]="busy()">{{ 'core.actions.save' | t }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .linked { display: flex; align-items: center; gap: 8px; min-height: 56px; }
    .ticket-field mat-form-field { width: 100%; }
    mat-progress-bar { margin-bottom: 8px; }
  `,
})
export class TaskDialogComponent {
  readonly data = inject<TaskDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<TaskDialogComponent, AgentTask>);
  private readonly api = inject(DashboardApi);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly titleMax = TASK_TITLE_MAX;
  readonly notesMax = TASK_NOTES_MAX;
  readonly busy = signal(false);
  readonly ticket = signal<LinkedTicket | null>(
    this.data.task?.ticketId ? { id: this.data.task.ticketId, number: this.data.task.ticketNumber ?? '' } : null,
  );
  readonly ticketOptions = signal<DashboardTicket[]>([]);

  readonly form = this.fb.group({
    title: [this.data.task?.title ?? '', [Validators.required, Validators.maxLength(TASK_TITLE_MAX)]],
    notes: [this.data.task?.notes ?? '', Validators.maxLength(TASK_NOTES_MAX)],
    dueAt: [isoToLocalInput(this.data.task?.dueAt)],
    remindAt: [isoToLocalInput(this.data.task?.remindAt)],
  });

  readonly ticketSearch = this.fb.control<string | DashboardTicket>('');

  constructor() {
    this.ticketSearch.valueChanges
      .pipe(
        filter((value): value is string => typeof value === 'string'),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((search) => (search.trim().length < 2 ? of([]) : this.api.searchTickets(search.trim()).pipe(catchError(() => of([]))))),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((items) => this.ticketOptions.set(items));
  }

  pickTicket(event: MatAutocompleteSelectedEvent): void {
    const option = event.option.value as DashboardTicket;
    this.ticket.set({ id: option.id, number: option.number });
    this.ticketSearch.setValue('');
    this.ticketOptions.set([]);
  }

  clearTicket(): void {
    this.ticket.set(null);
  }

  save(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const request: TaskRequest = {
      title: value.title.trim(),
      notes: value.notes.trim() || null,
      assigneeId: this.data.task?.assigneeId ?? null,
      ticketId: this.ticket()?.id ?? null,
      customerId: this.data.task?.customerId ?? null,
      dueAt: localInputToIso(value.dueAt),
      remindAt: localInputToIso(value.remindAt),
    };
    this.busy.set(true);
    const call = this.data.task ? this.api.updateTask(this.data.task.id, request) : this.api.createTask(request);
    call.subscribe({
      next: (task) => {
        this.busy.set(false);
        this.toast.success(this.data.task ? 'core.states.saved' : 'core.states.created');
        this.dialogRef.close(task);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const apiError = ApiError.from(error);
        const unmatched = applyServerErrors(this.form, stripFieldPrefix(apiError, 'task'));
        if (!apiError.isValidation || unmatched.length) {
          this.toast.error(unmatched[0] ?? describeError(apiError, this.translations));
        }
      },
    });
  }
}
