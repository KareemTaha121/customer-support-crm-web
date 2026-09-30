import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Router, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { ApiError } from '../../../core/http/api-error';
import { Paged, emptyPage } from '../../../core/http/api.models';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { KnowledgeBaseApi } from '../knowledge-base.api';
import { KbArticleListItem, KbCategory, categoryLabel } from '../knowledge-base.models';
import { HelpArticleListComponent } from './help-article-list.component';

const PAGE_SIZE = 20;

type SearchState = { status: 'idle' } | { status: 'loading' } | { status: 'done'; page: Paged<KbArticleListItem> } | { status: 'error'; message: string };

/** `/help` — public help center home: search (`?q=`), categories, FAQs and latest articles. */
@Component({
  selector: 'app-help-home-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    TranslatePipe,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    HelpArticleListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <h1>{{ 'kb.help.heroTitle' | t }}</h1>
      <p>{{ 'kb.help.heroSubtitle' | t }}</p>
      <form class="search" role="search" (ngSubmit)="search()">
        <mat-form-field class="search__field" subscriptSizing="fixed">
          <mat-icon matPrefix>search</mat-icon>
          <input matInput type="search" [formControl]="searchControl" [placeholder]="'kb.help.searchPlaceholder' | t" [attr.aria-label]="'core.actions.search' | t" maxlength="200" />
          @if (searchControl.value) {
            <button mat-icon-button matSuffix type="button" (click)="clear()" [attr.aria-label]="'core.actions.clear' | t">
              <mat-icon>close</mat-icon>
            </button>
          }
        </mat-form-field>
        <button mat-flat-button type="submit">{{ 'core.actions.search' | t }}</button>
      </form>
    </section>

    @if (query()) {
      <section>
        <h2>{{ 'kb.help.resultsFor' | t: { query: query() } }}</h2>
        @switch (results().status) {
          @case ('loading') {
            <app-loading />
          }
          @case ('error') {
            <app-error-state [message]="errorMessage()" (retry)="retrySearch()" />
          }
          @case ('done') {
            @if (resultPage().items.length === 0) {
              <app-empty-state icon="search_off" [message]="'kb.help.noResults' | t">
                <a mat-stroked-button routerLink="/portal">{{ 'kb.help.contact' | t }}</a>
              </app-empty-state>
            } @else {
              <p class="crm-muted">{{ 'kb.help.resultCount' | t: { count: resultPage().meta.totalCount } }}</p>
              <app-help-article-list [articles]="resultPage().items" [categories]="categories()" />
              @if (resultPage().meta.totalPages > 1) {
                <mat-paginator [length]="resultPage().meta.totalCount" [pageIndex]="page() - 1" [pageSize]="pageSize" hidePageSize (page)="onPage($event)" />
              }
            }
          }
        }
      </section>
    } @else {
      <section>
        <h2>{{ 'kb.help.browseCategories' | t }}</h2>
        @if (categoriesLoading()) {
          <app-loading />
        } @else if (topCategories().length === 0) {
          <app-empty-state icon="folder_off" [message]="'kb.help.noCategories' | t" />
        } @else {
          <div class="categories">
            @for (category of topCategories(); track category.id) {
              <a class="category" [routerLink]="['/help/categories', category.id]">
                <mat-icon>folder_open</mat-icon>
                <span class="category__name">{{ label(category) }}</span>
                @if (category.description) {
                  <span class="category__desc">{{ category.description }}</span>
                }
                <span class="category__count">{{ 'kb.help.articleCount' | t: { count: category.articleCount } }}</span>
              </a>
            }
          </div>
        }
      </section>

      @if (faqs().length) {
        <section>
          <h2>{{ 'kb.help.faqs' | t }}</h2>
          <app-help-article-list [articles]="faqs()" [categories]="categories()" />
        </section>
      }

      <section>
        <h2>{{ 'kb.help.latest' | t }}</h2>
        @if (latestLoading()) {
          <app-loading />
        } @else if (latest().length === 0) {
          <app-empty-state icon="article" [message]="'kb.help.noArticles' | t" />
        } @else {
          <app-help-article-list [articles]="latest()" [categories]="categories()" />
        }
      </section>
    }
  `,
  styles: `
    .hero { text-align: center; padding: 32px 16px 16px; margin: -24px -16px 24px; background: linear-gradient(180deg, var(--mat-sys-primary-container), transparent); }
    .hero h1 { margin: 0 0 8px; font: var(--mat-sys-headline-medium); }
    .hero p { margin: 0 0 20px; color: var(--mat-sys-on-surface-variant); }
    .search { display: flex; gap: 8px; align-items: flex-start; max-width: 640px; margin-inline: auto; }
    .search__field { flex: 1; }
    .search button[type='submit'] { height: 56px; }
    section { margin-bottom: 32px; }
    h2 { font: var(--mat-sys-title-large); margin: 0 0 12px; }
    .categories { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
    .category { display: flex; flex-direction: column; gap: 4px; padding: 16px; border: 1px solid var(--mat-sys-outline-variant); border-radius: 12px; background: var(--mat-sys-surface); color: inherit; text-decoration: none; transition: border-color .15s; }
    .category:hover, .category:focus-visible { border-color: var(--mat-sys-primary); }
    .category mat-icon { color: var(--mat-sys-primary); }
    .category__name { font: var(--mat-sys-title-medium); }
    .category__desc { color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-medium); }
    .category__count { color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-small); margin-top: auto; }
    @media (max-width: 599.98px) { .search { flex-direction: column; align-items: stretch; } }
  `,
})
export class HelpHomePage {
  private readonly api = inject(KnowledgeBaseApi);
  private readonly router = inject(Router);
  private readonly translations = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);

  /** `?q=` search text. */
  readonly q = input<string>();
  /** `?page=` for search results. */
  readonly pageParam = input<string | undefined>(undefined, { alias: 'page' });

  readonly pageSize = PAGE_SIZE;
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly query = computed(() => (this.q() ?? '').trim());
  readonly page = computed(() => Math.max(1, Number(this.pageParam()) || 1));

  readonly categories = signal<KbCategory[]>([]);
  readonly categoriesLoading = signal(true);
  readonly faqs = signal<KbArticleListItem[]>([]);
  readonly latest = signal<KbArticleListItem[]>([]);
  readonly latestLoading = signal(true);
  readonly results = signal<SearchState>({ status: 'idle' });

  readonly topCategories = computed(() => this.categories().filter((c) => !c.parentId || !this.categories().some((p) => p.id === c.parentId)));
  readonly resultPage = computed(() => {
    const state = this.results();
    return state.status === 'done' ? state.page : emptyPage<KbArticleListItem>(PAGE_SIZE);
  });
  readonly errorMessage = computed(() => {
    const state = this.results();
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
      .subscribe((categories) => {
        this.categories.set(categories);
        this.categoriesLoading.set(false);
      });

    this.api
      .publicArticles({ page: 1, pageSize: 6, type: 'Faq' })
      .pipe(
        catchError(() => of(emptyPage<KbArticleListItem>())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => this.faqs.set(page.items));

    this.api
      .publicArticles({ page: 1, pageSize: 8 })
      .pipe(
        catchError(() => of(emptyPage<KbArticleListItem>())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        this.latest.set(page.items.filter((a) => a.type !== 'Faq').slice(0, 6));
        this.latestLoading.set(false);
      });

    const request = computed(() => ({ query: this.query(), page: this.page(), retry: this.retry() }));
    toObservable(request)
      .pipe(
        switchMap(({ query, page }) => {
          this.searchControl.setValue(query, { emitEvent: false });
          if (!query) {
            return of<SearchState>({ status: 'idle' });
          }
          this.results.set({ status: 'loading' });
          return this.api.publicArticles({ page, pageSize: PAGE_SIZE, search: query }).pipe(
            map((result): SearchState => ({ status: 'done', page: result })),
            catchError((error: unknown) => of<SearchState>({ status: 'error', message: describeError(ApiError.from(error), this.translations) })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) => this.results.set(state));
  }

  label(category: KbCategory): string {
    return categoryLabel(category, this.translations.language());
  }

  search(): void {
    const q = this.searchControl.value.trim();
    void this.router.navigate(['/help'], { queryParams: q ? { q } : {} });
  }

  clear(): void {
    this.searchControl.setValue('');
    void this.router.navigate(['/help']);
  }

  retrySearch(): void {
    this.retry.update((n) => n + 1);
  }

  onPage(event: PageEvent): void {
    void this.router.navigate(['/help'], { queryParams: { q: this.query(), page: event.pageIndex + 1 } });
  }
}
