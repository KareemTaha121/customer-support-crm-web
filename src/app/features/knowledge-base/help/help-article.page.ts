import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { BrandingService } from '../../../core/branding/branding.service';
import { ApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { LocalizedDatePipe } from '../../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { KbMarkdownComponent } from '../kb-markdown.component';
import { KnowledgeBaseApi } from '../knowledge-base.api';
import { KbArticle, KbCategory, KbErrorCodes, categoryLabel } from '../knowledge-base.models';

type State = { status: 'loading' } | { status: 'done'; article: KbArticle } | { status: 'notFound' } | { status: 'error'; message: string };
type Feedback = 'idle' | 'sending' | 'sent' | 'error';

const FEEDBACK_KEY = 'crm.kb.feedback.';

/** `/help/articles/:slug` — a published public article with "Was this helpful?" feedback. */
@Component({
  selector: 'app-help-article-page',
  imports: [RouterLink, MatButtonModule, MatIconModule, TranslatePipe, LocalizedDatePipe, LoadingComponent, EmptyStateComponent, ErrorStateComponent, KbMarkdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state().status) {
      @case ('loading') {
        <app-loading />
      }
      @case ('notFound') {
        <app-empty-state icon="find_in_page" [message]="'kb.help.articleNotFound' | t">
          <a mat-stroked-button routerLink="/help">{{ 'kb.help.backHome' | t }}</a>
        </app-empty-state>
      }
      @case ('error') {
        <app-error-state [message]="errorMessage()" (retry)="reload()" />
      }
      @case ('done') {
        @if (article(); as a) {
          <nav class="crumbs" [attr.aria-label]="'kb.help.breadcrumb' | t">
            <a routerLink="/help">{{ 'kb.help.title' | t }}</a>
            @if (a.categoryId) {
              <mat-icon class="rtl-flip" aria-hidden="true">chevron_right</mat-icon>
              <a [routerLink]="['/help/categories', a.categoryId]">{{ categoryName(a) }}</a>
            }
          </nav>

          <article class="article crm-card" [attr.dir]="a.language === 'ar' ? 'rtl' : 'ltr'" [attr.lang]="a.language">
            <header>
              <h1>{{ a.title }}</h1>
              <p class="meta">
                <span class="crm-pill crm-pill--primary">{{ 'kb.type.' + a.type | t }}</span>
                <span>{{ 'kb.help.updated' | t: { date: (a.updatedAt ?? a.publishedAt ?? a.createdAt | localDate: 'mediumDate') } }}</span>
              </p>
              @if (a.summary) {
                <p class="summary">{{ a.summary }}</p>
              }
            </header>
            <app-kb-markdown [source]="a.body" [language]="a.language" />
            @if (a.tags.length) {
              <p class="tags">
                @for (tag of a.tags; track tag) {
                  <a class="crm-pill" [routerLink]="['/help']" [queryParams]="{ q: tag }">#{{ tag }}</a>
                }
              </p>
            }
          </article>

          @if (a.translations.length) {
            <p class="translations">
              <mat-icon aria-hidden="true">translate</mat-icon>
              <span>{{ 'kb.help.otherLanguages' | t }}</span>
              @for (translation of a.translations; track translation.id) {
                <a [routerLink]="['/help/articles', translation.slug]" [attr.lang]="translation.language">
                  {{ translation.title }} ({{ 'kb.language.' + translation.language | t }})
                </a>
              }
            </p>
          }

          <section class="feedback crm-card" aria-live="polite">
            @switch (feedback()) {
              @case ('sent') {
                <p class="feedback__thanks"><mat-icon>check_circle</mat-icon>{{ 'kb.help.feedbackThanks' | t }}</p>
                @if (lastVote() === false) {
                  <p class="crm-muted">{{ 'kb.help.feedbackContact' | t }} <a routerLink="/portal">{{ 'kb.help.contact' | t }}</a></p>
                }
              }
              @default {
                <p class="feedback__question">{{ 'kb.help.wasHelpful' | t }}</p>
                <div class="feedback__buttons">
                  <button mat-stroked-button type="button" (click)="vote(a, true)" [disabled]="feedback() === 'sending'">
                    <mat-icon>thumb_up</mat-icon>{{ 'core.actions.yes' | t }}
                  </button>
                  <button mat-stroked-button type="button" (click)="vote(a, false)" [disabled]="feedback() === 'sending'">
                    <mat-icon>thumb_down</mat-icon>{{ 'core.actions.no' | t }}
                  </button>
                </div>
                @if (feedback() === 'error') {
                  <p class="feedback__error" role="alert">{{ feedbackError() }}</p>
                }
              }
            }
          </section>
        }
      }
    }
  `,
  styles: `
    .crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-bottom: 16px; font: var(--mat-sys-body-medium); }
    .crumbs a { color: var(--mat-sys-primary); text-decoration: none; }
    .crumbs a:hover { text-decoration: underline; }
    .crumbs mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--mat-sys-on-surface-variant); }
    .article { padding: 24px; max-width: 820px; }
    h1 { margin: 0 0 8px; font: var(--mat-sys-headline-medium); overflow-wrap: anywhere; }
    .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 16px; color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-small); }
    .summary { margin: 0 0 20px; font: var(--mat-sys-title-medium); color: var(--mat-sys-on-surface-variant); }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 16px 0 0; }
    .tags a { text-decoration: none; }
    .translations { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 16px 0; color: var(--mat-sys-on-surface-variant); }
    .translations a { color: var(--mat-sys-primary); }
    .feedback { margin-top: 16px; max-width: 820px; text-align: center; }
    .feedback p { margin: 0 0 8px; }
    .feedback__question { font: var(--mat-sys-title-medium); }
    .feedback__buttons { display: flex; justify-content: center; gap: 12px; }
    .feedback__thanks { display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--crm-success); font: var(--mat-sys-title-small); }
    .feedback__error { color: var(--mat-sys-error); margin-top: 8px !important; }
    @media (max-width: 599.98px) { .article { padding: 16px; } }
  `,
})
export class HelpArticlePage {
  private readonly api = inject(KnowledgeBaseApi);
  private readonly translations = inject(TranslationService);
  private readonly title = inject(Title);
  private readonly branding = inject(BrandingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly slug = input.required<string>();

  readonly state = signal<State>({ status: 'loading' });
  readonly categories = signal<KbCategory[]>([]);
  readonly feedback = signal<Feedback>('idle');
  readonly feedbackError = signal<string | null>(null);
  readonly lastVote = signal<boolean | null>(null);

  readonly article = computed(() => {
    const state = this.state();
    return state.status === 'done' ? state.article : null;
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

    const request = computed(() => ({ slug: this.slug(), retry: this.retry() }));
    toObservable(request)
      .pipe(
        switchMap(({ slug }) => {
          this.state.set({ status: 'loading' });
          return this.api.publicArticle(slug).pipe(
            map((article): State => ({ status: 'done', article })),
            catchError((error: unknown) => {
              const apiError = ApiError.from(error);
              return of<State>(
                apiError.status === 404 || apiError.hasCode(KbErrorCodes.articleNotFound)
                  ? { status: 'notFound' }
                  : { status: 'error', message: describeError(apiError, this.translations) },
              );
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) => {
        this.state.set(state);
        if (state.status === 'done') {
          const previous = readVote(state.article.id);
          this.lastVote.set(previous);
          this.feedback.set(previous === null ? 'idle' : 'sent');
          this.feedbackError.set(null);
          this.title.setTitle(`${state.article.title} · ${this.branding.branding().name}`);
        }
      });

    this.destroyRef.onDestroy(() => this.title.setTitle(this.branding.branding().name));
  }

  categoryName(article: KbArticle): string {
    const category = this.categories().find((c) => c.id === article.categoryId);
    return category ? categoryLabel(category, this.translations.language()) : (article.categoryName ?? '');
  }

  reload(): void {
    this.retry.update((n) => n + 1);
  }

  vote(article: KbArticle, helpful: boolean): void {
    if (this.feedback() === 'sending') {
      return;
    }
    this.feedback.set('sending');
    this.feedbackError.set(null);
    this.api.feedback(article.id, helpful).subscribe({
      next: () => {
        this.lastVote.set(helpful);
        this.feedback.set('sent');
        writeVote(article.id, helpful);
      },
      error: (error: unknown) => {
        const apiError = ApiError.from(error);
        // The API allows a few votes per visitor and article a day; past that the vote is already counted.
        if (apiError.code === 'RATE_LIMITED') {
          this.lastVote.set(helpful);
          this.feedback.set('sent');
          writeVote(article.id, helpful);
          return;
        }
        this.feedback.set('error');
        this.feedbackError.set(describeError(apiError, this.translations));
      },
    });
  }
}

function readVote(id: string): boolean | null {
  try {
    const value = localStorage.getItem(FEEDBACK_KEY + id);
    return value === null ? null : value === '1';
  } catch {
    return null;
  }
}

function writeVote(id: string, helpful: boolean): void {
  try {
    localStorage.setItem(FEEDBACK_KEY + id, helpful ? '1' : '0');
  } catch {
    // Storage unavailable (private mode): the vote is still recorded on the server.
  }
}
