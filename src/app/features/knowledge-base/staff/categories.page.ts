import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { ConfirmService } from '../../../shared/confirm-dialog.component';
import { PageHeaderComponent } from '../../../shared/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { KnowledgeBaseApi } from '../knowledge-base.api';
import { KbCategory } from '../knowledge-base.models';
import { CategoryDialogComponent, CategoryDialogData } from './category-dialog.component';

/** `/knowledge-base/categories` — category management (kb.manage). */
@Component({
  selector: 'app-kb-categories-page',
  imports: [MatButtonModule, MatIconModule, MatTableModule, MatTooltipModule, TranslatePipe, PageHeaderComponent, LoadingComponent, EmptyStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'kb.categories.title' | t" [subtitle]="'kb.categories.subtitle' | t" backLink="/knowledge-base">
      <button mat-flat-button type="button" (click)="edit(null)"><mat-icon>add</mat-icon>{{ 'kb.categories.add' | t }}</button>
    </app-page-header>

    @if (error(); as message) {
      <app-error-state [message]="message" (retry)="load()" />
    } @else if (loading()) {
      <app-loading />
    } @else if (categories().length === 0) {
      <app-empty-state icon="folder" [message]="'kb.categories.empty' | t">
        <button mat-stroked-button type="button" (click)="edit(null)">{{ 'kb.categories.add' | t }}</button>
      </app-empty-state>
    } @else {
      <div class="crm-table-wrap">
        <table mat-table [dataSource]="categories()">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.categories.name' | t }}</th>
            <td mat-cell *matCellDef="let row">
              <div class="name">{{ row.name }}</div>
              @if (row.description) {
                <div class="crm-muted desc">{{ row.description }}</div>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="nameAr">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.categories.nameAr' | t }}</th>
            <td mat-cell *matCellDef="let row" dir="rtl" lang="ar" class="ar">{{ row.nameAr ?? '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="parent">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.categories.parent' | t }}</th>
            <td mat-cell *matCellDef="let row">{{ parentName(row) }}</td>
          </ng-container>
          <ng-container matColumnDef="sortOrder">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.categories.sortOrder' | t }}</th>
            <td mat-cell *matCellDef="let row">{{ row.sortOrder }}</td>
          </ng-container>
          <ng-container matColumnDef="isPublic">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.fields.visibility' | t }}</th>
            <td mat-cell *matCellDef="let row">
              <span class="crm-pill" [class.crm-pill--success]="row.isPublic">{{ (row.isPublic ? 'kb.visibility.Public' : 'kb.visibility.Internal') | t }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="articleCount">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.categories.articles' | t }}</th>
            <td mat-cell *matCellDef="let row">{{ row.articleCount }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef><span class="cdk-visually-hidden">{{ 'core.actions.more' | t }}</span></th>
            <td mat-cell *matCellDef="let row" class="actions">
              <button mat-icon-button type="button" (click)="edit(row)" [matTooltip]="'core.actions.edit' | t" [attr.aria-label]="'core.actions.edit' | t">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button type="button" (click)="remove(row)" [matTooltip]="'core.actions.delete' | t" [attr.aria-label]="'core.actions.delete' | t">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      </div>
    }
  `,
  styles: `
    .name { font-weight: 500; }
    .desc { font-size: 12px; max-width: 420px; }
    .ar { text-align: start; }
    .actions { white-space: nowrap; text-align: end; }
  `,
})
export class CategoriesPage {
  private readonly api = inject(KnowledgeBaseApi);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly columns = ['name', 'nameAr', 'parent', 'sortOrder', 'isPublic', 'articleCount', 'actions'];
  readonly categories = signal<KbCategory[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.categories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(describeError(ApiError.from(error), this.translations));
      },
    });
  }

  parentName(row: KbCategory): string {
    const parent = row.parentId ? this.categories().find((c) => c.id === row.parentId) : undefined;
    if (!parent) {
      return '—';
    }
    return this.translations.language() === 'ar' && parent.nameAr ? parent.nameAr : parent.name;
  }

  edit(category: KbCategory | null): void {
    const data: CategoryDialogData = { category, categories: this.categories() };
    this.dialog
      .open<CategoryDialogComponent, CategoryDialogData, KbCategory>(CategoryDialogComponent, {
        data,
        width: '520px',
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
  }

  remove(category: KbCategory): void {
    this.confirm
      .ask({
        title: 'kb.categories.deleteTitle',
        message: category.articleCount ? 'kb.categories.deleteWithArticles' : 'kb.categories.deleteMessage',
        params: { name: category.name, count: category.articleCount },
        confirmText: 'core.actions.delete',
        destructive: true,
      })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        // KB_CATEGORY_IN_USE (sub-categories) is shown by the global error toast with the server message.
        this.api.deleteCategory(category.id).subscribe(() => {
          this.toast.success('core.states.deleted');
          this.load();
        });
      });
  }
}
