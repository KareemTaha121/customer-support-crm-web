import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroupDirective, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { Paged, emptyPage } from '../../core/http/api.models';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { LocalizedDatePipe } from '../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { HasPermissionDirective } from '../../core/permissions/has-permission.directive';
import { Permissions } from '../../core/permissions/permissions';
import { ConfirmService } from '../../shared/confirm-dialog.component';
import { FormErrorPipe } from '../../shared/form-error.pipe';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/state.components';
import { reportFormError } from './customer-errors';
import { CustomersApi } from './customers.api';
import { CUSTOMER_LIMITS, CustomerNote } from './customers.models';

const PAGE_SIZE = 10;

/** Notes tab: internal notes, pinned first (GET/POST/PUT/DELETE /customers/{id}/notes). */
@Component({
  selector: 'app-customer-notes',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatPaginatorModule,
    TranslatePipe,
    LocalizedDatePipe,
    FormErrorPipe,
    HasPermissionDirective,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="crm-card composer" [formGroup]="composer" (ngSubmit)="add(composerDirective)" #composerDirective="ngForm" novalidate *appHasPermission="permissions.customerNotesManage">
      <mat-form-field>
        <mat-label>{{ 'customers.notes.new' | t }}</mat-label>
        <textarea matInput formControlName="body" rows="3" [maxlength]="limits.noteBodyMaxLength"></textarea>
        <mat-hint>{{ 'customers.notes.internalHint' | t }}</mat-hint>
        <mat-error>{{ composer.controls.body | formError }}</mat-error>
      </mat-form-field>
      <div class="composer__actions">
        <mat-checkbox formControlName="isPinned">{{ 'customers.notes.pin' | t }}</mat-checkbox>
        <button mat-flat-button type="submit" [disabled]="saving()">{{ 'customers.notes.add' | t }}</button>
      </div>
    </form>

    @if (error(); as message) {
      <app-error-state [message]="message" (retry)="load()" />
    } @else if (loading() && !page().items.length) {
      <app-loading />
    } @else {
      @for (note of page().items; track note.id) {
        <article class="crm-card note" [class.note--pinned]="note.isPinned">
          <header>
            <div class="meta">
              @if (note.isPinned) {
                <mat-icon class="pin" [matTooltip]="'customers.notes.pinned' | t">push_pin</mat-icon>
              }
              <strong>{{ note.authorName || ('customers.notes.unknownAuthor' | t) }}</strong>
              <span class="crm-muted">{{ note.createdAt | localDate }}</span>
              @if (note.updatedAt) {
                <span class="crm-muted">· {{ 'customers.notes.edited' | t }}</span>
              }
            </div>
            @if (note.canEdit && editingId() !== note.id) {
              <div *appHasPermission="permissions.customerNotesManage">
                <button mat-icon-button type="button" (click)="togglePin(note)" [attr.aria-label]="(note.isPinned ? 'customers.notes.unpin' : 'customers.notes.pin') | t" [matTooltip]="(note.isPinned ? 'customers.notes.unpin' : 'customers.notes.pin') | t">
                  <mat-icon [class.pin]="note.isPinned">push_pin</mat-icon>
                </button>
                <button mat-icon-button type="button" (click)="startEdit(note)" [attr.aria-label]="'core.actions.edit' | t" [matTooltip]="'core.actions.edit' | t">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button type="button" (click)="remove(note)" [attr.aria-label]="'core.actions.delete' | t" [matTooltip]="'core.actions.delete' | t">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            }
          </header>
          @if (editingId() === note.id) {
            <form [formGroup]="editor" (ngSubmit)="saveEdit(note)" novalidate>
              <mat-form-field>
                <textarea matInput formControlName="body" rows="4" [maxlength]="limits.noteBodyMaxLength" [attr.aria-label]="'customers.notes.body' | t"></textarea>
                <mat-error>{{ editor.controls.body | formError }}</mat-error>
              </mat-form-field>
              <div class="composer__actions">
                <mat-checkbox formControlName="isPinned">{{ 'customers.notes.pin' | t }}</mat-checkbox>
                <span>
                  <button mat-button type="button" (click)="editingId.set(null)">{{ 'core.actions.cancel' | t }}</button>
                  <button mat-flat-button type="submit" [disabled]="saving()">{{ 'core.actions.save' | t }}</button>
                </span>
              </div>
            </form>
          } @else {
            <p class="body">{{ note.body }}</p>
          }
        </article>
      } @empty {
        <app-empty-state icon="sticky_note_2" [message]="'customers.notes.empty' | t" />
      }
      @if (page().meta.totalCount > pageSize) {
        <mat-paginator [length]="page().meta.totalCount" [pageIndex]="pageIndex()" [pageSize]="pageSize" [hidePageSize]="true" (page)="changePage($event)" />
      }
    }
  `,
  styles: `
    .composer { margin-block-end: 16px; }
    .composer mat-form-field, .note mat-form-field { width: 100%; }
    .composer__actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
    .note { margin-block-end: 12px; }
    .note--pinned { border-inline-start: 4px solid var(--mat-sys-primary); }
    header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 8px; }
    .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .pin { color: var(--mat-sys-primary); font-size: 18px; width: 18px; height: 18px; }
    .body { margin: 8px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  `,
})
export class CustomerNotesComponent implements OnInit {
  private readonly api = inject(CustomersApi);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;

  readonly customerId = input.required<string>();

  readonly permissions = Permissions;
  readonly limits = CUSTOMER_LIMITS;
  readonly pageSize = PAGE_SIZE;
  readonly page = signal<Paged<CustomerNote>>(emptyPage<CustomerNote>(PAGE_SIZE));
  readonly pageIndex = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly composer = this.fb.group({
    body: ['', [Validators.required, Validators.maxLength(CUSTOMER_LIMITS.noteBodyMaxLength)]],
    isPinned: [false],
  });

  readonly editor = this.fb.group({
    body: ['', [Validators.required, Validators.maxLength(CUSTOMER_LIMITS.noteBodyMaxLength)]],
    isPinned: [false],
  });

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
    this.load();
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.api.listNotes(this.customerId(), this.pageIndex() + 1, PAGE_SIZE).subscribe({
      next: (page) => {
        this.page.set(page);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(describeError(ApiError.from(error), this.translations));
      },
    });
  }

  changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.load();
  }

  add(directive: FormGroupDirective): void {
    if (this.composer.invalid || this.saving()) {
      this.composer.markAllAsTouched();
      return;
    }
    const value = this.composer.getRawValue();
    this.saving.set(true);
    this.api
      .saveNote(this.customerId(), null, { body: value.body.trim(), isPinned: value.isPinned })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          directive.resetForm({ body: '', isPinned: false });
          this.toast.success('customers.notes.added');
          this.pageIndex.set(0);
          this.load();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          reportFormError(this.composer, error, this.toast, this.translations);
        },
      });
  }

  startEdit(note: CustomerNote): void {
    this.editor.reset({ body: note.body, isPinned: note.isPinned });
    this.editingId.set(note.id);
  }

  saveEdit(note: CustomerNote): void {
    if (this.editor.invalid || this.saving()) {
      this.editor.markAllAsTouched();
      return;
    }
    const value = this.editor.getRawValue();
    this.update(note, { body: value.body.trim(), isPinned: value.isPinned });
  }

  togglePin(note: CustomerNote): void {
    this.update(note, { body: note.body, isPinned: !note.isPinned });
  }

  remove(note: CustomerNote): void {
    this.confirm.ask({ title: 'customers.notes.deleteTitle', message: 'customers.notes.deleteMessage', destructive: true, confirmText: 'core.actions.delete' }).subscribe((ok) => {
      if (!ok) {
        return;
      }
      this.api.deleteNote(this.customerId(), note.id).subscribe({
        next: () => {
          this.toast.success('core.states.deleted');
          if (this.page().items.length === 1 && this.pageIndex() > 0) {
            this.pageIndex.update((i) => i - 1);
          }
          this.load();
        },
      });
    });
  }

  private update(note: CustomerNote, request: { body: string; isPinned: boolean }): void {
    this.saving.set(true);
    this.api
      .saveNote(this.customerId(), note.id, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editingId.set(null);
          this.toast.success('core.states.saved');
          // Pinning changes the order, so reload the page.
          this.load();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          reportFormError(this.editor, error, this.toast, this.translations);
        },
      });
  }
}
