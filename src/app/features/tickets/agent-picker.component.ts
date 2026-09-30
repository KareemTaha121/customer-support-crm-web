import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TicketsApi } from './tickets.api';
import { UserLookup } from './tickets.models';

/**
 * Staff autocomplete over `GET /users/lookup` (users who can work tickets):
 * `<app-ticket-agent-picker [label]="..." [value]="agent" (picked)="assign($event)" />`
 */
@Component({
  selector: 'app-ticket-agent-picker',
  imports: [MatAutocompleteModule, MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field class="picker">
      <mat-label>{{ label() }}</mat-label>
      <mat-icon matPrefix>person_search</mat-icon>
      <input
        matInput
        [value]="text()"
        [disabled]="disabled()"
        [matAutocomplete]="auto"
        (input)="onInput($any($event.target).value)"
        (focus)="onInput(text())"
        autocomplete="off"
      />
      @if (text() && !disabled()) {
        <button matSuffix mat-icon-button type="button" (click)="clear()" [attr.aria-label]="'core.actions.clear' | t">
          <mat-icon>close</mat-icon>
        </button>
      }
      <mat-autocomplete #auto="matAutocomplete" [displayWith]="display" (optionSelected)="select($event)">
        @for (user of options(); track user.id) {
          <mat-option [value]="user">
            <span>{{ user.displayName }}</span>
            <small class="crm-muted"> · {{ user.email }}</small>
          </mat-option>
        } @empty {
          @if (searched()) {
            <mat-option disabled>{{ 'tickets.pickers.noUsers' | t }}</mat-option>
          }
        }
      </mat-autocomplete>
    </mat-form-field>
  `,
  styles: `
    .picker { inline-size: 100%; }
    small { font: var(--mat-sys-body-small); }
  `,
})
export class TicketAgentPickerComponent {
  private readonly api = inject(TicketsApi);
  private readonly search$ = new Subject<string>();

  readonly label = input.required<string>();
  /** Display name of the current selection. */
  readonly value = input<string | null>(null);
  readonly disabled = input(false);
  readonly picked = output<UserLookup | null>();

  readonly text = signal('');
  readonly options = signal<UserLookup[]>([]);
  readonly searched = signal(false);
  readonly display = (user: UserLookup | string | null): string => (typeof user === 'string' ? user : (user?.displayName ?? ''));

  constructor() {
    effect(() => this.text.set(this.value() ?? ''));
    this.search$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => this.api.lookupUsers(term).pipe(catchError(() => of<UserLookup[]>([])))),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((users) => {
        this.options.set(users);
        this.searched.set(true);
      });
  }

  onInput(value: string): void {
    this.text.set(value);
    this.search$.next(value.trim());
  }

  select(event: MatAutocompleteSelectedEvent): void {
    const user = event.option.value as UserLookup;
    this.text.set(user.displayName);
    this.picked.emit(user);
  }

  clear(): void {
    this.text.set('');
    this.picked.emit(null);
  }
}
