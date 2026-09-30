import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, filter, of, switchMap } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { PermissionService } from '../../core/permissions/permission.service';
import { Permissions } from '../../core/permissions/permissions';
import { FormErrorPipe } from '../../shared/form-error.pipe';
import { applyServerErrors } from '../../shared/form-errors';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { TicketAgentPickerComponent } from './agent-picker.component';
import { TicketsApi } from './tickets.api';
import {
  CustomerOption,
  TICKET_CREATE_CHANNELS,
  TICKET_PRIORITIES,
  TicketCategory,
  TicketLimits,
  UserLookup,
  buildCategoryTree,
  categoryLabel,
} from './tickets.models';

function customerSelected(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  return value && typeof value === 'object' ? null : { required: true };
}

/** `/tickets/new`: staff create a ticket for a customer. `?customerId=` preselects the customer. */
@Component({
  selector: 'app-ticket-create-page',
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TranslatePipe,
    FormErrorPipe,
    PageHeaderComponent,
    TicketAgentPickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'tickets.create.title' | t" backLink="/tickets" />
    <form class="crm-card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      @if (busy()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <div class="crm-form-grid">
        <mat-form-field class="crm-span-all">
          <mat-label>{{ 'tickets.fields.customer' | t }}</mat-label>
          <mat-icon matPrefix>person</mat-icon>
          <input matInput [formControl]="customerControl" [matAutocomplete]="customers" [placeholder]="'tickets.create.customerHint' | t" autocomplete="off" />
          <mat-autocomplete #customers="matAutocomplete" [displayWith]="customerLabel">
            @for (customer of customerOptions(); track customer.id) {
              <mat-option [value]="customer">
                <span>{{ customer.name }}</span>
                <small class="crm-muted"> · {{ customer.number }} {{ customer.primaryEmail ?? customer.primaryPhone ?? '' }}</small>
              </mat-option>
            } @empty {
              @if (customerSearched()) {
                <mat-option disabled>{{ 'tickets.pickers.noCustomers' | t }}</mat-option>
              }
            }
          </mat-autocomplete>
          <mat-error>{{ customerControl | formError }}</mat-error>
        </mat-form-field>

        <mat-form-field class="crm-span-all">
          <mat-label>{{ 'tickets.fields.subject' | t }}</mat-label>
          <input matInput formControlName="subject" [maxlength]="limits.subject" />
          <mat-hint align="end">{{ form.controls.subject.value.length }} / {{ limits.subject }}</mat-hint>
          <mat-error>{{ form.controls.subject | formError }}</mat-error>
        </mat-form-field>

        <mat-form-field class="crm-span-all">
          <mat-label>{{ 'tickets.fields.description' | t }}</mat-label>
          <textarea matInput formControlName="description" rows="6"></textarea>
          <mat-error>{{ form.controls.description | formError }}</mat-error>
        </mat-form-field>

        <mat-form-field>
          <mat-label>{{ 'tickets.fields.category' | t }}</mat-label>
          <mat-select formControlName="categoryId" (selectionChange)="onCategory($event.value)">
            <mat-option value="">{{ 'core.states.none' | t }}</mat-option>
            @for (category of categoryTree(); track category.id) {
              <mat-option [value]="category.id">
                <span class="indent" [style.inline-size.px]="category.depth * 16"></span>{{ categoryName(category) }}
              </mat-option>
            }
          </mat-select>
          <mat-error>{{ form.controls.categoryId | formError }}</mat-error>
        </mat-form-field>

        <mat-form-field>
          <mat-label>{{ 'tickets.fields.priority' | t }}</mat-label>
          <mat-select formControlName="priority">
            @for (priority of priorities; track priority) {
              <mat-option [value]="priority">{{ 'tickets.priority.' + priority | t }}</mat-option>
            }
          </mat-select>
          <mat-error>{{ form.controls.priority | formError }}</mat-error>
        </mat-form-field>

        <mat-form-field>
          <mat-label>{{ 'tickets.fields.channel' | t }}</mat-label>
          <mat-select formControlName="channel">
            @for (channel of channels; track channel) {
              <mat-option [value]="channel">{{ 'tickets.channel.' + channel | t }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (canAssign) {
          <app-ticket-agent-picker [label]="'tickets.fields.assignee' | t" [value]="agent()?.displayName ?? null" (picked)="agent.set($event)" />
        }

        <mat-form-field class="crm-span-all">
          <mat-label>{{ 'tickets.fields.tags' | t }}</mat-label>
          <mat-chip-grid #chipGrid [attr.aria-label]="'tickets.fields.tags' | t">
            @for (tag of tags(); track tag) {
              <mat-chip-row (removed)="removeTag(tag)">
                {{ tag }}
                <button matChipRemove type="button" [attr.aria-label]="'core.actions.delete' | t"><mat-icon>cancel</mat-icon></button>
              </mat-chip-row>
            }
            <input [placeholder]="'tickets.fields.tagsHint' | t" [matChipInputFor]="chipGrid" (matChipInputTokenEnd)="addTag($event)" />
          </mat-chip-grid>
        </mat-form-field>
      </div>

      <div class="crm-actions">
        <button mat-button type="button" (click)="cancel()">{{ 'core.actions.cancel' | t }}</button>
        <button mat-flat-button type="submit" [disabled]="busy()">
          <mat-icon>add</mat-icon>
          {{ 'tickets.create.submit' | t }}
        </button>
      </div>
    </form>
  `,
  styles: `
    form { max-inline-size: 960px; }
    small { font: var(--mat-sys-body-small); }
    .indent { display: inline-block; }
  `,
})
export class TicketCreatePage {
  private readonly api = inject(TicketsApi);
  private readonly router = inject(Router);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly limits = TicketLimits;
  readonly priorities = TICKET_PRIORITIES;
  readonly channels = TICKET_CREATE_CHANNELS;
  readonly canAssign = inject(PermissionService).has(Permissions.ticketsAssign);

  readonly busy = signal(false);
  readonly categories = signal<TicketCategory[]>([]);
  readonly categoryTree = computed(() => buildCategoryTree(this.categories()));
  readonly customerOptions = signal<CustomerOption[]>([]);
  readonly customerSearched = signal(false);
  readonly tags = signal<string[]>([]);
  readonly agent = signal<UserLookup | null>(null);

  readonly customerControl = new FormControl<CustomerOption | string | null>(null, { validators: customerSelected });

  readonly form = inject(NonNullableFormBuilder).group({
    customerId: this.customerControl,
    subject: ['', [Validators.required, Validators.maxLength(TicketLimits.subject)]],
    description: ['', Validators.maxLength(TicketLimits.description)],
    categoryId: [''],
    priority: ['Medium', Validators.required],
    channel: ['Agent' as string],
  });

  readonly customerLabel = (value: CustomerOption | string | null): string =>
    typeof value === 'string' ? value : value ? `${value.name} (${value.number})` : '';

  constructor() {
    this.api.categories().subscribe({ next: (items) => this.categories.set(items), error: () => undefined });

    this.customerControl.valueChanges
      .pipe(
        filter((value): value is string => typeof value === 'string'),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => (term.trim().length < 2 ? of<CustomerOption[] | null>(null) : this.api.searchCustomers(term.trim()).pipe(catchError(() => of<CustomerOption[]>([]))))),
        takeUntilDestroyed(),
      )
      .subscribe((items) => {
        this.customerOptions.set(items ?? []);
        this.customerSearched.set(items !== null);
      });

    const customerId = inject(ActivatedRoute).snapshot.queryParamMap.get('customerId');
    if (customerId) {
      this.api.getCustomer(customerId).subscribe({ next: (customer) => this.customerControl.setValue(customer), error: () => undefined });
    }
  }

  categoryName(category: TicketCategory): string {
    return categoryLabel(category, this.translations.language());
  }

  onCategory(categoryId: string): void {
    const category = this.categories().find((c) => c.id === categoryId);
    if (category?.defaultPriority && !this.form.controls.priority.dirty) {
      this.form.controls.priority.setValue(category.defaultPriority);
    }
  }

  addTag(event: MatChipInputEvent): void {
    const tag = event.value.trim();
    if (tag && tag.length <= 50 && !this.tags().some((t) => t.toLowerCase() === tag.toLowerCase()) && this.tags().length < TicketLimits.tags) {
      this.tags.update((tags) => [...tags, tag]);
    }
    event.chipInput.clear();
  }

  removeTag(tag: string): void {
    this.tags.update((tags) => tags.filter((t) => t !== tag));
  }

  cancel(): void {
    void this.router.navigate(['/tickets']);
  }

  submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const customer = value.customerId as CustomerOption;
    this.busy.set(true);
    this.api
      .create({
        customerId: customer.id,
        subject: value.subject.trim(),
        description: value.description.trim() || null,
        categoryId: value.categoryId || null,
        priority: value.priority,
        channel: value.channel,
        branchId: null,
        departmentId: null,
        tags: this.tags(),
        assignedAgentId: this.agent()?.id ?? null,
      })
      .subscribe({
        next: (ticket) => {
          this.busy.set(false);
          this.toast.success('tickets.create.created', { number: ticket.number });
          void this.router.navigate(['/tickets', ticket.id]);
        },
        error: (error: unknown) => {
          this.busy.set(false);
          const apiError = ApiError.from(error);
          const unmatched = applyServerErrors(this.form, apiError);
          if (!apiError.isValidation || unmatched.length) {
            this.toast.error(unmatched[0] ?? describeError(apiError, this.translations));
          }
        },
      });
  }
}
