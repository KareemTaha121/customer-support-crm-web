import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, debounceTime, distinctUntilChanged, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { ConfirmService } from '../../shared/confirm-dialog.component';
import { FormErrorPipe } from '../../shared/form-error.pipe';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { ErrorStateComponent, LoadingComponent } from '../../shared/state.components';
import { reportFormError } from './customer-errors';
import { CustomersApi } from './customers.api';
import {
  BranchOption,
  CONTACT_TYPES,
  CUSTOMER_LANGUAGES,
  CUSTOMER_LIMITS,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  ContactType,
  Customer,
  CustomerErrorCodes,
  CustomerLanguage,
  CustomerStatus,
  CustomerType,
  DuplicateCandidate,
} from './customers.models';

/** `/customers/new` (POST /customers) and `/customers/:id/edit` (PUT /customers/{id}). */
@Component({
  selector: 'app-customer-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TranslatePipe,
    FormErrorPipe,
    PageHeaderComponent,
    LoadingComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      [title]="(isEdit() ? 'customers.form.editTitle' : 'customers.form.createTitle') | t"
      [subtitle]="customer()?.number ?? null"
      [backLink]="isEdit() ? ['/customers', id()] : '/customers'"
    />

    @if (loadError(); as message) {
      <app-error-state [message]="message" (retry)="loadCustomer()" />
    } @else if (loadingCustomer()) {
      <app-loading />
    } @else {
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <section class="crm-card">
          <h2>{{ 'customers.form.profile' | t }}</h2>
          <div class="crm-form-grid">
            <mat-form-field>
              <mat-label>{{ 'customers.fields.type' | t }}</mat-label>
              <mat-select formControlName="type">
                @for (type of types; track type) {
                  <mat-option [value]="type">{{ 'customers.type.' + type | t }}</mat-option>
                }
              </mat-select>
              <mat-error>{{ form.controls.type | formError }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'customers.fields.name' | t }}</mat-label>
              <input matInput formControlName="name" [maxlength]="limits.nameMaxLength" autocomplete="off" />
              <mat-error>{{ form.controls.name | formError }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'customers.fields.companyName' | t }}</mat-label>
              <input matInput formControlName="companyName" [maxlength]="limits.nameMaxLength" autocomplete="off" />
              <mat-error>{{ form.controls.companyName | formError }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'customers.fields.preferredLanguage' | t }}</mat-label>
              <mat-select formControlName="preferredLanguage">
                @for (language of languages; track language) {
                  <mat-option [value]="language">{{ 'customers.language.' + language | t }}</mat-option>
                }
              </mat-select>
              <mat-error>{{ form.controls.preferredLanguage | formError }}</mat-error>
            </mat-form-field>
            @if (isEdit()) {
              <mat-form-field>
                <mat-label>{{ 'customers.fields.status' | t }}</mat-label>
                <mat-select formControlName="status">
                  @for (status of statuses; track status) {
                    <mat-option [value]="status">{{ 'customers.status.' + status | t }}</mat-option>
                  }
                </mat-select>
                <mat-error>{{ form.controls.status | formError }}</mat-error>
              </mat-form-field>
            }
            <mat-form-field>
              <mat-label>{{ 'customers.fields.branch' | t }}</mat-label>
              <mat-select formControlName="branchId">
                @for (branch of branches(); track branch.id) {
                  <mat-option [value]="branch.id">{{ branch.name }}</mat-option>
                }
              </mat-select>
              <mat-error>{{ form.controls.branchId | formError }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'customers.fields.department' | t }}</mat-label>
              <mat-select formControlName="departmentId">
                <mat-option [value]="null">{{ 'core.states.none' | t }}</mat-option>
                @for (department of departments(); track department.id) {
                  <mat-option [value]="department.id">{{ department.name }}</mat-option>
                }
              </mat-select>
              <mat-error>{{ form.controls.departmentId | formError }}</mat-error>
            </mat-form-field>
            <mat-form-field class="crm-span-all">
              <mat-label>{{ 'customers.fields.tags' | t }}</mat-label>
              <mat-chip-grid #chipGrid formControlName="tags">
                @for (tag of form.controls.tags.value; track tag) {
                  <mat-chip-row (removed)="removeTag(tag)">
                    {{ tag }}
                    <button matChipRemove type="button" [attr.aria-label]="'core.actions.delete' | t"><mat-icon>cancel</mat-icon></button>
                  </mat-chip-row>
                }
                <input
                  [matChipInputFor]="chipGrid"
                  [matChipInputAddOnBlur]="true"
                  (matChipInputTokenEnd)="addTag($event)"
                  [attr.maxlength]="limits.tagMaxLength"
                  [placeholder]="'customers.form.tagsPlaceholder' | t"
                />
              </mat-chip-grid>
              <mat-hint>{{ 'customers.form.tagsHint' | t: { max: limits.maxTags } }}</mat-hint>
              <mat-error>{{ form.controls.tags | formError }}</mat-error>
            </mat-form-field>
          </div>
        </section>

        @if (!isEdit()) {
          <section class="crm-card" formArrayName="contacts">
            <div class="section-head">
              <h2>{{ 'customers.contacts.title' | t }}</h2>
              <button mat-stroked-button type="button" (click)="addContactRow()">
                <mat-icon>add</mat-icon>{{ 'customers.contacts.add' | t }}
              </button>
            </div>
            @for (row of form.controls.contacts.controls; track row; let i = $index) {
              <div class="contact-row" [formGroupName]="i">
                <mat-form-field>
                  <mat-label>{{ 'customers.fields.contactType' | t }}</mat-label>
                  <mat-select formControlName="type">
                    @for (type of contactTypes; track type) {
                      <mat-option [value]="type">{{ 'customers.contactType.' + type | t }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field class="value">
                  <mat-label>{{ 'customers.fields.value' | t }}</mat-label>
                  <input matInput formControlName="value" [maxlength]="limits.contactValueMaxLength" autocomplete="off" />
                  @if (isPhoneType(row.controls.type.value)) {
                    <mat-hint>{{ 'customers.contacts.phoneHint' | t }}</mat-hint>
                  }
                  <mat-error>{{ row.controls.value | formError }}</mat-error>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>{{ 'customers.fields.label' | t }}</mat-label>
                  <input matInput formControlName="label" [maxlength]="limits.contactLabelMaxLength" autocomplete="off" />
                </mat-form-field>
                <mat-checkbox formControlName="isPrimary">{{ 'customers.contacts.primary' | t }}</mat-checkbox>
                <button mat-icon-button type="button" (click)="removeContactRow(i)" [attr.aria-label]="'customers.contacts.remove' | t">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            } @empty {
              <p class="crm-muted">{{ 'customers.contacts.noneYet' | t }}</p>
            }

            @if (checkingDuplicates()) {
              <mat-progress-bar mode="indeterminate" />
            }
            @if (duplicates().length) {
              <div class="duplicates" role="status">
                <div class="duplicates__title"><mat-icon>warning</mat-icon>{{ 'customers.duplicates.title' | t }}</div>
                <ul>
                  @for (candidate of duplicates(); track candidate.id + candidate.matchedValue) {
                    <li>
                      <a [routerLink]="['/customers', candidate.id]" target="_blank">{{ candidate.number }} — {{ candidate.name }}</a>
                      <span class="crm-muted">
                        {{ 'customers.duplicates.matchedOn' | t: { field: ('customers.duplicates.field.' + candidate.matchedOn | t), value: candidate.matchedValue } }}
                      </span>
                    </li>
                  }
                </ul>
              </div>
            }
          </section>
        }

        <div class="crm-actions">
          <a mat-button [routerLink]="isEdit() ? ['/customers', id()] : '/customers'">{{ 'core.actions.cancel' | t }}</a>
          <button mat-flat-button type="submit" [disabled]="saving()">{{ (isEdit() ? 'core.actions.save' : 'core.actions.create') | t }}</button>
        </div>
      </form>
    }
  `,
  styles: `
    form { display: flex; flex-direction: column; gap: 16px; }
    h2 { margin: 0 0 12px; font: var(--mat-sys-title-medium); }
    .section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-block-end: 8px; }
    .contact-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
    .contact-row .value { flex: 1 1 240px; }
    .duplicates { margin-block-start: 12px; padding: 12px 16px; border-radius: var(--crm-radius); background: #fff3e0; color: #6d4c00; }
    .duplicates__title { display: flex; align-items: center; gap: 8px; font-weight: 500; }
    .duplicates ul { margin: 8px 0 0; padding-inline-start: 24px; }
    .duplicates li { display: flex; flex-wrap: wrap; gap: 4px 12px; }
  `,
})
export class CustomerFormPage implements OnInit {
  private readonly api = inject(CustomersApi);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly confirm = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  /** Route parameter (edit mode only). */
  readonly id = input<string>();

  readonly types = CUSTOMER_TYPES;
  readonly statuses = CUSTOMER_STATUSES;
  readonly languages = CUSTOMER_LANGUAGES;
  readonly contactTypes = CONTACT_TYPES;
  readonly limits = CUSTOMER_LIMITS;

  readonly isEdit = computed(() => !!this.id());
  readonly customer = signal<Customer | null>(null);
  readonly branches = signal<BranchOption[]>([]);
  readonly loadingCustomer = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly duplicates = signal<DuplicateCandidate[]>([]);
  readonly checkingDuplicates = signal(false);

  readonly form = this.fb.group({
    type: this.fb.control<CustomerType>('Individual', Validators.required),
    name: ['', [Validators.required, Validators.maxLength(CUSTOMER_LIMITS.nameMaxLength)]],
    companyName: ['', Validators.maxLength(CUSTOMER_LIMITS.nameMaxLength)],
    preferredLanguage: this.fb.control<CustomerLanguage>('ar', Validators.required),
    status: this.fb.control<CustomerStatus>('Active', Validators.required),
    branchId: ['', Validators.required],
    departmentId: this.fb.control<string | null>(null),
    tags: this.fb.control<string[]>([]),
    contacts: this.fb.array([this.contactGroup('Email'), this.contactGroup('Phone')]),
  });

  private readonly branchId = toSignal(this.form.controls.branchId.valueChanges, { initialValue: '' });
  readonly departments = computed(() => (this.branches().find((b) => b.id === this.branchId())?.departments ?? []).filter((d) => d.isActive));

  ngOnInit(): void {
    this.form.controls.preferredLanguage.setValue(this.translations.language() === 'en' ? 'en' : 'ar');
    this.api
      .branches()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (branches) => {
          this.branches.set(branches.filter((b) => b.isActive || b.id === this.customer()?.branchId));
          if (!this.isEdit() && !this.form.controls.branchId.value && this.branches().length === 1) {
            this.form.controls.branchId.setValue(this.branches()[0].id);
          }
        },
      });

    this.form.controls.branchId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const departmentId = this.form.controls.departmentId.value;
      if (departmentId && !this.departments().some((d) => d.id === departmentId)) {
        this.form.controls.departmentId.setValue(null);
      }
    });

    if (this.isEdit()) {
      this.form.controls.contacts.clear();
      this.loadCustomer();
    } else {
      this.watchDuplicates();
    }
  }

  loadCustomer(): void {
    const id = this.id();
    if (!id) {
      return;
    }
    this.loadingCustomer.set(true);
    this.loadError.set(null);
    this.api
      .get(id, { silent: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (customer) => {
          this.customer.set(customer);
          this.form.patchValue({
            type: customer.type,
            name: customer.name,
            companyName: customer.companyName ?? '',
            preferredLanguage: customer.preferredLanguage,
            status: customer.status,
            branchId: customer.branchId,
            tags: [...customer.tags],
          });
          this.form.controls.departmentId.setValue(customer.departmentId);
          this.loadingCustomer.set(false);
        },
        error: (error: unknown) => {
          this.loadingCustomer.set(false);
          this.loadError.set(describeError(ApiError.from(error), this.translations));
        },
      });
  }

  addTag(event: MatChipInputEvent): void {
    const value = event.value.trim();
    const tags = this.form.controls.tags.value;
    if (value && !tags.includes(value) && tags.length < CUSTOMER_LIMITS.maxTags) {
      this.form.controls.tags.setValue([...tags, value]);
    }
    event.chipInput.clear();
  }

  removeTag(tag: string): void {
    this.form.controls.tags.setValue(this.form.controls.tags.value.filter((t) => t !== tag));
  }

  addContactRow(): void {
    this.form.controls.contacts.push(this.contactGroup('Email'));
  }

  removeContactRow(index: number): void {
    this.form.controls.contacts.removeAt(index);
  }

  isPhoneType(type: ContactType): boolean {
    return type === 'Phone' || type === 'WhatsApp';
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.id();
    if (id) {
      this.save(this.api.update(id, this.updateRequest()));
    } else {
      this.create(false);
    }
  }

  private create(ignoreDuplicates: boolean): void {
    const value = this.form.getRawValue();
    const { status: _status, ...profile } = this.updateRequest();
    const request = {
      ...profile,
      contacts: value.contacts
        .filter((c) => c.value.trim())
        .map((c) => ({ type: c.type, value: c.value.trim(), label: c.label.trim() || null, isPrimary: c.isPrimary })),
      ignoreDuplicates,
    };
    this.save(this.api.create(request), !ignoreDuplicates);
  }

  private save(request: Observable<Customer>, offerDuplicateOverride = false): void {
    this.saving.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (customer) => {
        this.saving.set(false);
        this.toast.success(this.isEdit() ? 'core.states.saved' : 'customers.form.created');
        void this.router.navigate(['/customers', customer.id]);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const apiError = ApiError.from(error);
        if (offerDuplicateOverride && apiError.hasCode(CustomerErrorCodes.duplicate)) {
          this.confirm
            .ask({ title: 'customers.duplicates.confirmTitle', message: apiError.message, confirmText: 'customers.duplicates.createAnyway' })
            .subscribe((ok) => {
              if (ok) {
                this.create(true);
              }
            });
          return;
        }
        reportFormError(this.form, apiError, this.toast, this.translations);
      },
    });
  }

  private updateRequest() {
    const value = this.form.getRawValue();
    return {
      type: value.type,
      name: value.name.trim(),
      companyName: value.companyName.trim() || null,
      preferredLanguage: value.preferredLanguage,
      status: value.status,
      branchId: value.branchId,
      departmentId: value.departmentId,
      tags: value.tags,
    };
  }

  private contactGroup(type: ContactType) {
    return this.fb.group({
      type: this.fb.control<ContactType>(type),
      value: ['', Validators.maxLength(CUSTOMER_LIMITS.contactValueMaxLength)],
      label: ['', Validators.maxLength(CUSTOMER_LIMITS.contactLabelMaxLength)],
      isPrimary: [false],
    });
  }

  /** Warns (before saving) about other customers sharing an email or phone: GET /customers/duplicates. */
  private watchDuplicates(): void {
    this.form.controls.contacts.valueChanges
      .pipe(
        debounceTime(500),
        map((contacts) => {
          const keys = new Set<string>();
          for (const contact of contacts) {
            const value = contact.value?.trim();
            if (!value || !contact.type) {
              continue;
            }
            if (contact.type === 'Email' && value.includes('@')) {
              keys.add(`email|${value.toLowerCase()}`);
            } else if (this.isPhoneType(contact.type) && value.replace(/\D/g, '').length >= 8) {
              keys.add(`phone|${value}`);
            }
          }
          return [...keys].sort().join('\n');
        }),
        distinctUntilChanged(),
        switchMap((signature) => {
          if (!signature) {
            return of<DuplicateCandidate[]>([]);
          }
          this.checkingDuplicates.set(true);
          const calls = signature.split('\n').map((key) => {
            const [kind, value] = key.split('|');
            return this.api
              .findDuplicates(kind === 'email' ? value : null, kind === 'phone' ? value : null)
              .pipe(catchError(() => of<DuplicateCandidate[]>([])));
          });
          return forkJoin(calls).pipe(map((results) => results.flat()));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((candidates) => {
        this.checkingDuplicates.set(false);
        this.duplicates.set(candidates);
      });
  }
}
