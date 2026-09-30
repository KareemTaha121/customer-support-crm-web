import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { Paged, emptyPage } from '../../core/http/api.models';
import { describeError } from '../../core/interceptors/error.interceptor';
import { LocalizedDatePipe } from '../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/state.components';
import { CustomersApi } from './customers.api';
import { ACTIVITY_TYPES, CustomerActivity } from './customers.models';

const PAGE_SIZE = 20;

const ICONS: Record<string, string> = {
  'customer.created': 'person_add',
  'customer.updated': 'manage_accounts',
  'note.added': 'sticky_note_2',
  'attachment.added': 'attach_file',
  'ticket.created': 'confirmation_number',
  'ticket.status_changed': 'sync_alt',
  'ticket.message': 'forum',
  'ticket.feedback': 'star',
  'portal.sign_in': 'login',
  'chat.started': 'chat',
};

/** History tab: paged interaction timeline (GET /customers/{id}/history?types=...). */
@Component({
  selector: 'app-customer-history',
  imports: [
    RouterLink,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    TranslatePipe,
    LocalizedDatePipe,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="crm-toolbar">
      <mat-form-field subscriptSizing="dynamic" class="filter">
        <mat-label>{{ 'customers.history.filter' | t }}</mat-label>
        <mat-select multiple [value]="types()" (selectionChange)="setTypes($event.value)">
          @for (type of activityTypes; track type) {
            <mat-option [value]="type">{{ 'customers.activity.' + type | t }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      @if (types().length) {
        <button mat-button type="button" (click)="setTypes([])">{{ 'core.actions.clear' | t }}</button>
      }
    </div>

    @if (error(); as message) {
      <app-error-state [message]="message" (retry)="load()" />
    } @else if (loading() && !page().items.length) {
      <app-loading />
    } @else {
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <ol class="timeline">
        @for (item of page().items; track item.id) {
          <li>
            <span class="dot"><mat-icon>{{ iconFor(item.type) }}</mat-icon></span>
            <div class="content">
              <div class="title">
                <strong>{{ labelFor(item.type) }}</strong>
                <span class="crm-muted small" [title]="item.occurredAt | localDate">{{ item.occurredAt | localDate: 'relative' }}</span>
              </div>
              @if (item.summary) {
                <p class="summary">{{ item.summary }}</p>
              }
              <div class="crm-muted small">
                @if (item.actorName) {
                  {{ 'customers.history.by' | t: { name: item.actorName } }}
                }
                @if (item.ticketId) {
                  <a [routerLink]="['/tickets', item.ticketId]">{{ 'customers.history.openTicket' | t }}</a>
                }
              </div>
            </div>
          </li>
        } @empty {
          <app-empty-state icon="history" [message]="'customers.history.empty' | t" />
        }
      </ol>
      @if (page().meta.totalCount > pageSize) {
        <mat-paginator [length]="page().meta.totalCount" [pageIndex]="pageIndex()" [pageSize]="pageSize" [hidePageSize]="true" (page)="changePage($event)" />
      }
    }
  `,
  styles: `
    .filter { min-width: 260px; }
    .timeline { list-style: none; margin: 0; padding: 0; }
    li { position: relative; display: flex; gap: 12px; padding-block-end: 16px; }
    li:not(:last-child)::before { content: ''; position: absolute; inset-inline-start: 17px; inset-block: 36px 0; width: 2px; background: var(--mat-sys-outline-variant); }
    .dot { flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container); }
    .dot mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .content { flex: 1 1 auto; min-width: 0; padding-block-start: 6px; }
    .title { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
    .summary { margin: 4px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    .small { font: var(--mat-sys-body-small); }
    .small a { margin-inline-start: 8px; }
  `,
})
export class CustomerHistoryComponent implements OnInit {
  private readonly api = inject(CustomersApi);
  private readonly translations = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;

  readonly customerId = input.required<string>();

  readonly activityTypes = ACTIVITY_TYPES;
  readonly pageSize = PAGE_SIZE;
  readonly types = signal<string[]>([]);
  readonly pageIndex = signal(0);
  readonly page = signal<Paged<CustomerActivity>>(emptyPage<CustomerActivity>(PAGE_SIZE));
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
    this.load();
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    const types = this.types().length ? this.types().join(',') : null;
    this.request = this.api.history(this.customerId(), this.pageIndex() + 1, PAGE_SIZE, types).subscribe({
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

  setTypes(types: string[]): void {
    this.types.set(types);
    this.pageIndex.set(0);
    this.load();
  }

  changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.load();
  }

  iconFor(type: string): string {
    return ICONS[type] ?? 'event';
  }

  /** Known types are translated; unknown ones (future server types) show the raw code. */
  labelFor(type: string): string {
    const key = `customers.activity.${type}`;
    return this.translations.has(key) ? this.translations.t(key) : type;
  }
}
