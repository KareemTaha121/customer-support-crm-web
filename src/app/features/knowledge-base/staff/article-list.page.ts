import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, catchError, of, EMPTY } from 'rxjs';
import { ApiError } from '../../../core/http/api-error';
import { Paged, emptyPage } from '../../../core/http/api.models';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { LocalizedDatePipe } from '../../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { PermissionService } from '../../../core/permissions/permission.service';
import { Permissions } from '../../../core/permissions/permissions';
import { ConfirmService } from '../../../shared/confirm-dialog.component';
import { PageHeaderComponent } from '../../../shared/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { KnowledgeBaseApi } from '../knowledge-base.api';
import {
  ARTICLE_STATUSES,
  ARTICLE_TYPES,
  ARTICLE_VISIBILITIES,
  ArticleAction,
  KB_LANGUAGES,
  KbArticleListItem,
  KbArticleQuery,
  KbCategory,
  categoryLabel,
  statusPill,
} from '../knowledge-base.models';

/** `/knowledge-base` — staff article list with search, filters and paging. */
@Component({
  selector: 'app-kb-article-list-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    TranslatePipe,
    LocalizedDatePipe,
    HasPermissionDirective,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'kb.list.title' | t" [subtitle]="'kb.list.subtitle' | t">
      <a mat-stroked-button routerLink="/help" target="_blank" rel="noopener">
        <mat-icon>open_in_new</mat-icon>{{ 'kb.list.openHelpCenter' | t }}
      </a>
      <a mat-stroked-button routerLink="categories" *appHasPermission="'kb.manage'">
        <mat-icon>folder</mat-icon>{{ 'kb.categories.title' | t }}
      </a>
      <a mat-flat-button routerLink="new" *appHasPermission="'kb.manage'">
        <mat-icon>add</mat-icon>{{ 'kb.list.newArticle' | t }}
      </a>
    </app-page-header>

    <div class="crm-toolbar">
      <mat-form-field class="search">
        <mat-label>{{ 'core.actions.search' | t }}</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [formControl]="searchControl" [placeholder]="'kb.list.searchPlaceholder' | t" />
        @if (searchControl.value) {
          <button mat-icon-button matSuffix type="button" (click)="searchControl.setValue('')" [attr.aria-label]="'core.actions.clear' | t">
            <mat-icon>close</mat-icon>
          </button>
        }
      </mat-form-field>
      <mat-form-field>
        <mat-label>{{ 'kb.fields.category' | t }}</mat-label>
        <mat-select [value]="filters().categoryId ?? ''" (valueChange)="setFilter('categoryId', $event)">
          <mat-option value="">{{ 'core.states.all' | t }}</mat-option>
          @for (category of categories(); track category.id) {
            <mat-option [value]="category.id">{{ label(category) }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field>
        <mat-label>{{ 'kb.fields.status' | t }}</mat-label>
        <mat-select [value]="filters().status ?? ''" (valueChange)="setFilter('status', $event)">
          <mat-option value="">{{ 'core.states.all' | t }}</mat-option>
          @for (status of statuses; track status) {
            <mat-option [value]="status">{{ 'kb.status.' + status | t }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field>
        <mat-label>{{ 'kb.fields.type' | t }}</mat-label>
        <mat-select [value]="filters().type ?? ''" (valueChange)="setFilter('type', $event)">
          <mat-option value="">{{ 'core.states.all' | t }}</mat-option>
          @for (type of types; track type) {
            <mat-option [value]="type">{{ 'kb.type.' + type | t }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field>
        <mat-label>{{ 'kb.fields.language' | t }}</mat-label>
        <mat-select [value]="filters().language ?? ''" (valueChange)="setFilter('language', $event)">
          <mat-option value="">{{ 'core.states.all' | t }}</mat-option>
          @for (language of languages; track language) {
            <mat-option [value]="language">{{ 'kb.language.' + language | t }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field>
        <mat-label>{{ 'kb.fields.visibility' | t }}</mat-label>
        <mat-select [value]="filters().visibility ?? ''" (valueChange)="setFilter('visibility', $event)">
          <mat-option value="">{{ 'core.states.all' | t }}</mat-option>
          @for (visibility of visibilities; track visibility) {
            <mat-option [value]="visibility">{{ 'kb.visibility.' + visibility | t }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      @if (hasFilters()) {
        <button mat-button type="button" (click)="resetFilters()">{{ 'core.actions.reset' | t }}</button>
      }
    </div>

    @if (error(); as message) {
      <app-error-state [message]="message" (retry)="reload()" />
    } @else if (loading() && page().items.length === 0) {
      <app-loading />
    } @else if (page().items.length === 0) {
      <app-empty-state icon="menu_book" [message]="(hasFilters() ? 'kb.list.noResults' : 'kb.list.empty') | t" />
    } @else {
      <div class="crm-table-wrap">
        <table mat-table [dataSource]="page().items">
          <ng-container matColumnDef="title">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.fields.title' | t }}</th>
            <td mat-cell *matCellDef="let row">
              <div class="title" [attr.dir]="row.language === 'ar' ? 'rtl' : 'ltr'">{{ row.title }}</div>
              <div class="crm-muted slug">/{{ row.slug }}</div>
            </td>
          </ng-container>
          <ng-container matColumnDef="category">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.fields.category' | t }}</th>
            <td mat-cell *matCellDef="let row">{{ categoryName(row) }}</td>
          </ng-container>
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.fields.type' | t }}</th>
            <td mat-cell *matCellDef="let row">{{ 'kb.type.' + row.type | t }}</td>
          </ng-container>
          <ng-container matColumnDef="language">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.fields.language' | t }}</th>
            <td mat-cell *matCellDef="let row">{{ 'kb.language.' + row.language | t }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.fields.status' | t }}</th>
            <td mat-cell *matCellDef="let row">
              <span [class]="pill(row.status)">{{ 'kb.status.' + row.status | t }}</span>
              @if (row.visibility === 'Internal') {
                <span class="crm-pill crm-pill--info internal">{{ 'kb.visibility.Internal' | t }}</span>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="stats">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.fields.stats' | t }}</th>
            <td mat-cell *matCellDef="let row" class="stats">
              <span [title]="'kb.fields.views' | t"><mat-icon inline>visibility</mat-icon>{{ row.viewCount }}</span>
              <span [title]="'kb.fields.helpful' | t"><mat-icon inline>thumb_up</mat-icon>{{ row.helpfulCount }}</span>
              <span [title]="'kb.fields.notHelpful' | t"><mat-icon inline>thumb_down</mat-icon>{{ row.notHelpfulCount }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="updatedAt">
            <th mat-header-cell *matHeaderCellDef>{{ 'core.fields.updatedAt' | t }}</th>
            <td mat-cell *matCellDef="let row">{{ row.updatedAt ?? row.publishedAt | localDate: 'shortDate' }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef><span class="cdk-visually-hidden">{{ 'core.actions.more' | t }}</span></th>
            <td mat-cell *matCellDef="let row" (click)="$event.stopPropagation()">
              @if (canManage() || canPublish()) {
                <button mat-icon-button type="button" [matMenuTriggerFor]="menu" [attr.aria-label]="'core.actions.more' | t">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu" xPosition="before">
                  @if (canPublish() && row.status === 'Draft') {
                    <button mat-menu-item type="button" (click)="change(row, 'publish')"><mat-icon>publish</mat-icon>{{ 'kb.actions.publish' | t }}</button>
                  }
                  @if (canPublish() && row.status === 'Published') {
                    <button mat-menu-item type="button" (click)="change(row, 'unpublish')"><mat-icon>unpublished</mat-icon>{{ 'kb.actions.unpublish' | t }}</button>
                  }
                  @if (canManage() && row.status !== 'Archived') {
                    <button mat-menu-item type="button" (click)="change(row, 'archive')"><mat-icon>archive</mat-icon>{{ 'kb.actions.archive' | t }}</button>
                  }
                  @if (canManage() && row.status === 'Archived') {
                    <button mat-menu-item type="button" (click)="change(row, 'restore')"><mat-icon>unarchive</mat-icon>{{ 'kb.actions.restore' | t }}</button>
                  }
                  @if (canManage()) {
                    <button mat-menu-item type="button" (click)="remove(row)"><mat-icon>delete</mat-icon>{{ 'core.actions.delete' | t }}</button>
                  }
                </mat-menu>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns" class="crm-row-link" (click)="open(row)"></tr>
        </table>
      </div>
      <mat-paginator
        [length]="page().meta.totalCount"
        [pageIndex]="filters().page - 1"
        [pageSize]="filters().pageSize"
        [pageSizeOptions]="[10, 25, 50, 100]"
        (page)="onPage($event)"
      />
    }
  `,
  styles: `
    .search { flex: 1 1 260px; }
    .title { font-weight: 500; }
    .slug { font-size: 12px; direction: ltr; unicode-bidi: plaintext; text-align: start; }
    .internal { margin-inline-start: 4px; }
    .stats { white-space: nowrap; color: var(--mat-sys-on-surface-variant); }
    .stats span { display: inline-flex; align-items: center; gap: 2px; margin-inline-end: 10px; }
  `,
})
export class ArticleListPage {
  private readonly api = inject(KnowledgeBaseApi);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = ARTICLE_STATUSES;
  readonly types = ARTICLE_TYPES;
  readonly visibilities = ARTICLE_VISIBILITIES;
  readonly languages = KB_LANGUAGES;
  readonly columns = ['title', 'category', 'type', 'language', 'status', 'stats', 'updatedAt', 'actions'];

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly filters = signal<KbArticleQuery>({ page: 1, pageSize: 25 });
  readonly page = signal<Paged<KbArticleListItem>>(emptyPage(25));
  readonly categories = signal<KbCategory[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly canManage = computed(() => this.permissions.has(Permissions.knowledgeManage));
  readonly canPublish = computed(() => this.permissions.has(Permissions.knowledgePublish));
  readonly hasFilters = computed(() => {
    const f = this.filters();
    return !!(f.search || f.status || f.type || f.language || f.visibility || f.categoryId);
  });

  private readonly reload$ = new Subject<void>();

  constructor() {
    this.reload$
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          this.error.set(null);
          return this.api.articles(this.filters()).pipe(
            catchError((error: unknown) => {
              this.loading.set(false);
              this.error.set(describeError(ApiError.from(error), this.translations));
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        this.page.set(page);
        this.loading.set(false);
      });

    this.searchControl.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => this.update({ search: search.trim() || null }));

    this.api
      .categories()
      .pipe(
        catchError(() => of([] as KbCategory[])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((categories) => this.categories.set(categories));

    this.reload();
  }

  reload(): void {
    this.reload$.next();
  }

  label(category: KbCategory): string {
    return categoryLabel(category, this.translations.language());
  }

  categoryName(row: KbArticleListItem): string {
    const category = this.categories().find((c) => c.id === row.categoryId);
    return category ? this.label(category) : (row.categoryName ?? '—');
  }

  pill(status: string): string {
    return statusPill(status);
  }

  setFilter(key: 'categoryId' | 'status' | 'type' | 'language' | 'visibility', value: string): void {
    this.update({ [key]: value || null });
  }

  resetFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.filters.set({ page: 1, pageSize: this.filters().pageSize });
    this.reload();
  }

  onPage(event: PageEvent): void {
    this.filters.update((f) => ({ ...f, page: event.pageIndex + 1, pageSize: event.pageSize }));
    this.reload();
  }

  open(row: KbArticleListItem): void {
    void this.router.navigate(['/knowledge-base', 'articles', row.id]);
  }

  change(row: KbArticleListItem, action: ArticleAction): void {
    this.api.changeStatus(row.id, action).subscribe(() => {
      this.toast.success(`kb.messages.${action}`);
      this.reload();
    });
  }

  remove(row: KbArticleListItem): void {
    this.confirm
      .ask({ title: 'kb.delete.title', message: 'kb.delete.message', params: { title: row.title }, confirmText: 'core.actions.delete', destructive: true })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.api.deleteArticle(row.id).subscribe(() => {
          this.toast.success('kb.messages.deleted');
          this.reload();
        });
      });
  }

  private update(patch: Partial<KbArticleQuery>): void {
    this.filters.update((f) => ({ ...f, ...patch, page: 1 }));
    this.reload();
  }
}
