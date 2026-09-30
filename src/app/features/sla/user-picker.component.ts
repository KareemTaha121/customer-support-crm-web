import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, model, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { SlaApi } from './sla.api';
import { SlaLookupsService } from './sla-lookups.service';
import { UserLookup } from './sla.models';

/**
 * Staff user picker backed by `GET /users/lookup?search=` (max 50 rows, so it searches server-side).
 * `<app-sla-user-picker [label]="..." [multiple]="true" [(ids)]="notifyIds" [error]="msg" />`
 */
@Component({
  selector: 'app-sla-user-picker',
  imports: [MatFormFieldModule, MatChipsModule, MatAutocompleteModule, MatIconModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field class="picker">
      <mat-label>{{ label() }}</mat-label>
      <mat-chip-grid #grid [attr.aria-label]="label()">
        @for (id of ids(); track id) {
          <mat-chip-row (removed)="remove(id)">
            {{ lookups.userName(id) ?? ('sla.fields.unknownUser' | t) }}
            <button matChipRemove type="button" [attr.aria-label]="'core.actions.delete' | t">
              <mat-icon>cancel</mat-icon>
            </button>
          </mat-chip-row>
        }
        <input
          #search
          [placeholder]="'sla.fields.searchUsers' | t"
          [matChipInputFor]="grid"
          [matAutocomplete]="auto"
          (input)="onSearch(search.value)"
          (focus)="onSearch(search.value)"
        />
      </mat-chip-grid>
      <mat-autocomplete #auto="matAutocomplete" (optionSelected)="select($event)">
        @for (user of options(); track user.id) {
          <mat-option [value]="user.id" [disabled]="ids().includes(user.id)">
            <span>{{ user.displayName }}</span>
            <small class="crm-muted email">{{ user.email }}</small>
          </mat-option>
        } @empty {
          <mat-option disabled>{{ 'sla.fields.noUsers' | t }}</mat-option>
        }
      </mat-autocomplete>
      @if (error()) {
        <mat-hint class="picker-error">{{ error() }}</mat-hint>
      } @else if (hint()) {
        <mat-hint>{{ hint() }}</mat-hint>
      }
    </mat-form-field>
  `,
  styles: `
    .picker { width: 100%; }
    .email { margin-inline-start: 8px; }
    .picker-error { color: var(--mat-sys-error); }
  `,
})
export class SlaUserPickerComponent {
  private readonly api = inject(SlaApi);
  readonly lookups = inject(SlaLookupsService);

  readonly label = input.required<string>();
  readonly multiple = input(false);
  readonly error = input<string | null>(null);
  readonly hint = input<string | null>(null);
  readonly ids = model<readonly string[]>([]);

  readonly options = signal<UserLookup[]>([]);
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('search');
  private readonly terms = new Subject<string>();

  constructor() {
    this.terms
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => this.api.lookupUsers(term.trim() || null).pipe(catchError(() => of<UserLookup[]>([])))),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((users) => {
        this.lookups.remember(users);
        this.options.set(users);
      });
  }

  onSearch(term: string): void {
    this.terms.next(term);
  }

  select(event: MatAutocompleteSelectedEvent): void {
    const id = event.option.value as string;
    const current = this.ids();
    if (!current.includes(id)) {
      this.ids.set(this.multiple() ? [...current, id] : [id]);
    }
    this.searchInput().nativeElement.value = '';
    event.option.deselect();
  }

  remove(id: string): void {
    this.ids.set(this.ids().filter((x) => x !== id));
  }
}
