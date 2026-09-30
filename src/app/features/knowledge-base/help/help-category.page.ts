import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Router, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { ApiError } from '../../../core/http/api-error';
import { Paged } from '../../../core/http/api.models';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { KnowledgeBaseApi } from '../knowledge-base.api';
import { KbArticleListItem, KbCategory, categoryLabel } from '../knowledge-base.models';
import { HelpArticleListComponent } from './help-article-list.component';

const PAGE_SIZE = 20;

type State = { status: 'loading' } | { status: 'done'; page: Paged<KbArticleListItem> } | { status: 'error'; message: string };

/** `/help/categories/:id` — published public articles of one category. */
@Component({
  selector: 'app-help-category-page',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatPaginatorModule, TranslatePipe, LoadingComponent, EmptyStateComponent, ErrorStateComponent, HelpArticleListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let current = category();
    <nav class="crumbs" [attr.aria-label]="'kb.help.breadcrumb' | t">
      <a routerLink="/help">{{ 'kb.help.title' | t }}</a>
      <mat-icon class="rtl-flip" aria-hidden="true">chevron_right</mat-icon>
      @if (parent(); as p) {
        <a [routerLink]="['/help/categories', p.id]">{{ label(p) }}</a>
        <mat-icon class="rtl-flip" aria-hidden="true">chevron_right</mat-icon>
      }
      <span>{{ current ? label(current) : ('kb.fields.category' | t) }}</span>
    </nav>

    <header class="head">
      <h1>{{ current ? label(current) : ('kb.fields.category' | t) }}</h1>
      @if (current?.description; as description) {
        <p class="crm-muted">{{ description }}</p>
      }
    </header>

    @if (children().length) {
      <div class="children">
        @for (child of children(); track child.id) {
          <a mat-stroked-button [routerLink]="['/help/categories', child.id]">
            <mat-icon>folder_open</mat-icon>{{ label(child) }} ({{ child.articleCount }})
          </a>
        }
      </div>
    }

    @switch (state().status) {
      @case ('loading') {
        <app-loading />
      }
      @case ('error') {
        <app-error-state [message]="errorMessage()" (retry)="reload()" />
      }
      @case ('done') {
        @if (articles().items.length === 0) {
          <app-empty-state icon="article" [message]="'kb.help.noArticlesInCategory' | t">
            <a mat-stroked-button routerLink="/help">{{ 'kb.help.backHome' | t }}</a>
          </app-empty-state>
        } @else {
          <app-help-article-list [articles]="articles().items" [showCategory]="false" />
          @if (articles().meta.totalPages > 1) {
            <mat-paginator [length]="articles().meta.totalCount" [pageIndex]="page() - 1" [pageSize]="pageSize" hidePageSize (page)="onPage($event)" />
          }
        }
      }
    }
  `,
  styles: `
    .crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-bottom: 16px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .crumbs a { color: var(--mat-sys-primary); text-decoration: none; }
    .crumbs a:hover { text-decoration: underline; }
    .crumbs mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .head h1 { margin: 0 0 4px; font: var(--mat-sys-headline-small); }
    .head p { margin: 0 0 16px; }
    .children { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  `,
})
export class HelpCategoryPage {
  private readonly api = inject(KnowledgeBaseApi);
  private readonly router = inject(Router);
  private readonly translations = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = input.required<string>();
  readonly pageParam = input<string | undefined>(undefined, { alias: 'page' });

  readonly pageSize = PAGE_SIZE;
  readonly page = computed(() => Math.max(1, Number(this.pageParam()) || 1));
  readonly categories = signal<KbCategory[]>([]);
  readonly state = signal<State>({ status: 'loading' });

  readonly category = computed(() => this.categories().find((c) => c.id === this.id()) ?? null);
  readonly parent = computed(() => {
    const parentId = this.category()?.parentId;
    return parentId ? (this.categories().find((c) => c.id === parentId) ?? null) : null;
  });
  readonly children = computed(() => this.categories().filter((c) => c.parentId === this.id()));
  readonly articles = computed(() => {
    const state = this.state();
    return state.status === 'done' ? state.page : { items: [], meta: { page: 1, pageSize: PAGE_SIZE, totalCount: 0, totalPages: 0 } };
  });
  readonly errorMessage = computed(() => {
    const state = this.state();
    return state.status === 'error' ? state.message : null;
  });

  private readonly retry = signal(0);

  constructor() {
    this.api
      .publicCategories()
      .pipe(
        catchError(() => of([] as KbCategory[])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((categories) => this.categories.set(categories));

    const request = computed(() => ({ id: this.id(), page: this.page(), retry: this.retry() }));
    toObservable(request)
      .pipe(
        switchMap(({ id, page }) => {
          this.state.set({ status: 'loading' });
          return this.api.publicArticles({ page, pageSize: PAGE_SIZE, categoryId: id }).pipe(
            map((result): State => ({ status: 'done', page: result })),
            catchError((error: unknown) => of<State>({ status: 'error', message: describeError(ApiError.from(error), this.translations) })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) => this.state.set(state));
  }

  label(category: KbCategory): string {
    return categoryLabel(category, this.translations.language());
  }

  reload(): void {
    this.retry.update((n) => n + 1);
  }

  onPage(event: PageEvent): void {
    void this.router.navigate(['/help/categories', this.id()], { queryParams: { page: event.pageIndex + 1 } });
  }
}
