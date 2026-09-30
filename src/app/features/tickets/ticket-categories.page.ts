import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/state.components';
import { TicketCategoryDialog, TicketCategoryDialogData } from './ticket-category-dialog.component';
import { TicketsApi } from './tickets.api';
import { CategoryNode, TicketCategory, buildCategoryTree, priorityTone } from './tickets.models';

/** `/tickets/categories`: hierarchical category admin (no delete; deactivate via `isActive`). */
@Component({
  selector: 'app-ticket-categories-page',
  imports: [
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTooltipModule,
    TranslatePipe,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'tickets.categories.title' | t" [subtitle]="'tickets.categories.subtitle' | t">
      <mat-slide-toggle [checked]="includeInactive()" (change)="toggleInactive($event)">{{ 'tickets.categories.showInactive' | t }}</mat-slide-toggle>
      <button mat-flat-button type="button" (click)="open(null)">
        <mat-icon>add</mat-icon>
        {{ 'tickets.categories.new' | t }}
      </button>
    </app-page-header>

    @if (error(); as message) {
      <app-error-state [message]="message" (retry)="load()" />
    } @else {
      <div class="crm-table-wrap">
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        <table mat-table [dataSource]="rows()">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>{{ 'tickets.categories.name' | t }}</th>
            <td mat-cell *matCellDef="let row">
              <span class="name" [style.padding-inline-start.px]="row.depth * 24">
                @if (row.depth > 0) {
                  <mat-icon class="branch rtl-flip">subdirectory_arrow_right</mat-icon>
                }
                {{ row.name }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="nameAr">
            <th mat-header-cell *matHeaderCellDef>{{ 'tickets.categories.nameAr' | t }}</th>
            <td mat-cell *matCellDef="let row" dir="rtl" lang="ar">{{ row.nameAr ?? '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="parent">
            <th mat-header-cell *matHeaderCellDef>{{ 'tickets.categories.parent' | t }}</th>
            <td mat-cell *matCellDef="let row">{{ parentName(row) }}</td>
          </ng-container>

          <ng-container matColumnDef="defaultPriority">
            <th mat-header-cell *matHeaderCellDef>{{ 'tickets.categories.defaultPriority' | t }}</th>
            <td mat-cell *matCellDef="let row">
              @if (row.defaultPriority) {
                <span [class]="'crm-pill crm-pill--' + priorityTone(row.defaultPriority)">{{ 'tickets.priority.' + row.defaultPriority | t }}</span>
              } @else {
                <span class="crm-muted">—</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="sortOrder">
            <th mat-header-cell *matHeaderCellDef>{{ 'tickets.categories.sortOrder' | t }}</th>
            <td mat-cell *matCellDef="let row">{{ row.sortOrder }}</td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>{{ 'core.fields.status' | t }}</th>
            <td mat-cell *matCellDef="let row">
              <span [class]="row.isActive ? 'crm-pill crm-pill--success' : 'crm-pill'">
                {{ (row.isActive ? 'core.states.active' : 'core.states.inactive') | t }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let row" class="actions">
              <button mat-icon-button type="button" (click)="open(row)" [matTooltip]="'core.actions.edit' | t" [attr.aria-label]="'core.actions.edit' | t">
                <mat-icon>edit</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns" [class.inactive]="!row.isActive"></tr>
        </table>

        @if (!loading() && rows().length === 0) {
          <app-empty-state icon="category" [message]="'tickets.categories.empty' | t" />
        }
      </div>
    }
  `,
  styles: `
    .name { display: inline-flex; align-items: center; gap: 4px; font-weight: 500; }
    .branch { font-size: 18px; inline-size: 18px; block-size: 18px; color: var(--mat-sys-on-surface-variant); }
    .actions { text-align: end; inline-size: 56px; }
    tr.inactive td { color: var(--mat-sys-on-surface-variant); }
  `,
})
export class TicketCategoriesPage {
  private readonly api = inject(TicketsApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private request: Subscription | null = null;

  readonly columns = ['name', 'nameAr', 'parent', 'defaultPriority', 'sortOrder', 'status', 'actions'];
  readonly priorityTone = priorityTone;

  readonly categories = signal<TicketCategory[]>([]);
  readonly includeInactive = signal(false);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly rows = computed<CategoryNode[]>(() => buildCategoryTree(this.categories()));
  private readonly byId = computed(() => new Map(this.categories().map((c) => [c.id, c])));

  constructor() {
    this.load();
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.api.categories(this.includeInactive()).subscribe({
      next: (items) => {
        this.categories.set(items);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(describeError(ApiError.from(error), this.translations));
      },
    });
  }

  toggleInactive(event: MatSlideToggleChange): void {
    this.includeInactive.set(event.checked);
    this.load();
  }

  parentName(category: TicketCategory): string {
    const parent = category.parentId ? this.byId().get(category.parentId) : undefined;
    if (!parent) {
      return '—';
    }
    return this.translations.language() === 'ar' && parent.nameAr ? parent.nameAr : parent.name;
  }

  open(category: TicketCategory | null): void {
    // The parent select needs inactive categories too, so the edited one keeps its parent.
    const source = this.includeInactive() ? this.categories() : null;
    const openDialog = (categories: TicketCategory[]) =>
      this.dialog
        .open<TicketCategoryDialog, TicketCategoryDialogData, TicketCategory>(TicketCategoryDialog, {
          data: { category, categories },
          width: '720px',
          maxWidth: '95vw',
          direction: this.translations.direction(),
        })
        .afterClosed()
        .subscribe((saved) => {
          if (saved) {
            this.toast.success(category ? 'core.states.saved' : 'core.states.created');
            this.load();
          }
        });
    if (source) {
      openDialog(source);
    } else {
      this.api.categories(true).subscribe({ next: (all) => openDialog(all), error: () => openDialog(this.categories()) });
    }
  }
}
