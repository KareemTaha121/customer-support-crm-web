import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { ApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { LocalizedDatePipe } from '../../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { PermissionService } from '../../../core/permissions/permission.service';
import { Permissions } from '../../../core/permissions/permissions';
import { ConfirmService } from '../../../shared/confirm-dialog.component';
import { FormErrorPipe } from '../../../shared/form-error.pipe';
import { PageHeaderComponent } from '../../../shared/page-header.component';
import { ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { KbMarkdownComponent } from '../kb-markdown.component';
import { applyKbServerErrors } from '../kb-server-errors';
import { KnowledgeBaseApi } from '../knowledge-base.api';
import {
  ARTICLE_TYPES,
  ARTICLE_VISIBILITIES,
  ArticleAction,
  ArticleType,
  ArticleVisibility,
  KB_LANGUAGES,
  KbArticle,
  KbArticleRequest,
  KbCategory,
  KbErrorCodes,
  KbLanguage,
  categoryLabel,
  statusPill,
} from '../knowledge-base.models';

type Loaded = { kind: 'article'; article: KbArticle } | { kind: 'new'; source: KbArticle | null } | { kind: 'error'; message: string };

/** `/knowledge-base/new` and `/knowledge-base/:id` — article editor with Markdown preview and status actions. */
@Component({
  selector: 'app-kb-article-editor-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    TranslatePipe,
    LocalizedDatePipe,
    FormErrorPipe,
    PageHeaderComponent,
    LoadingComponent,
    ErrorStateComponent,
    KbMarkdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="(article()?.title ?? ('kb.editor.newTitle' | t))" backLink="/knowledge-base">
      @if (article(); as a) {
        @if (a.status === 'Published' && a.visibility === 'Public') {
          <a mat-stroked-button [routerLink]="['/help/articles', a.slug]" target="_blank" rel="noopener">
            <mat-icon>open_in_new</mat-icon>{{ 'kb.editor.viewPublic' | t }}
          </a>
        }
      }
    </app-page-header>

    @if (loading()) {
      <app-loading />
    } @else if (loadError(); as message) {
      <app-error-state [message]="message" (retry)="retry()" />
    } @else {
      <div class="editor">
        <form class="crm-card" [formGroup]="form" (ngSubmit)="save()" novalidate>
          @if (article()?.status === 'Archived') {
            <p class="notice"><mat-icon>info</mat-icon>{{ 'kb.editor.archivedNotice' | t }}</p>
          } @else if (!canManage()) {
            <p class="notice"><mat-icon>lock</mat-icon>{{ 'kb.editor.readOnlyNotice' | t }}</p>
          }
          @if (source(); as s) {
            <p class="notice"><mat-icon>translate</mat-icon>{{ 'kb.editor.translationOf' | t: { title: s.title } }}</p>
          }
          <div class="crm-form-grid">
            <mat-form-field class="crm-span-all">
              <mat-label>{{ 'kb.fields.title' | t }}</mat-label>
              <input matInput formControlName="title" maxlength="300" dir="auto" />
              <mat-error>{{ form.controls.title | formError }}</mat-error>
            </mat-form-field>
            <mat-form-field class="crm-span-all">
              <mat-label>{{ 'kb.fields.slug' | t }}</mat-label>
              <input matInput formControlName="slug" maxlength="200" dir="auto" />
              <mat-hint>{{ 'kb.editor.slugHint' | t }}</mat-hint>
              <mat-error>{{ form.controls.slug | formError }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'kb.fields.type' | t }}</mat-label>
              <mat-select formControlName="type">
                @for (type of types; track type) {
                  <mat-option [value]="type">{{ 'kb.type.' + type | t }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'kb.fields.language' | t }}</mat-label>
              <mat-select formControlName="language">
                @for (language of languages; track language) {
                  <mat-option [value]="language">{{ 'kb.language.' + language | t }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'kb.fields.category' | t }}</mat-label>
              <mat-select formControlName="categoryId">
                <mat-option value="">{{ 'kb.editor.noCategory' | t }}</mat-option>
                @for (category of categories(); track category.id) {
                  <mat-option [value]="category.id">{{ label(category) }}</mat-option>
                }
              </mat-select>
              <mat-error>{{ form.controls.categoryId | formError }}</mat-error>
            </mat-form-field>
            <mat-form-field>
              <mat-label>{{ 'kb.fields.visibility' | t }}</mat-label>
              <mat-select formControlName="visibility">
                @for (visibility of visibilities; track visibility) {
                  <mat-option [value]="visibility">{{ 'kb.visibility.' + visibility | t }}</mat-option>
                }
              </mat-select>
              <mat-hint>{{ 'kb.visibilityHint.' + form.controls.visibility.value | t }}</mat-hint>
            </mat-form-field>
            <mat-form-field class="crm-span-all">
              <mat-label>{{ 'kb.fields.summary' | t }}</mat-label>
              <textarea matInput formControlName="summary" rows="2" maxlength="1000" dir="auto"></textarea>
              <mat-error>{{ form.controls.summary | formError }}</mat-error>
            </mat-form-field>
            <mat-form-field class="crm-span-all">
              <mat-label>{{ 'kb.fields.tags' | t }}</mat-label>
              <input matInput formControlName="tags" dir="auto" />
              <mat-hint>{{ 'kb.editor.tagsHint' | t }}</mat-hint>
            </mat-form-field>
          </div>

          <div class="body-head">
            <h2>{{ 'kb.fields.body' | t }}</h2>
            <mat-button-toggle-group [value]="mode()" (change)="mode.set($event.value)" hideSingleSelectionIndicator [attr.aria-label]="'kb.fields.body' | t">
              <mat-button-toggle value="write"><mat-icon>edit</mat-icon> {{ 'kb.editor.write' | t }}</mat-button-toggle>
              <mat-button-toggle value="preview"><mat-icon>preview</mat-icon> {{ 'kb.editor.preview' | t }}</mat-button-toggle>
            </mat-button-toggle-group>
          </div>
          @if (mode() === 'write') {
            <mat-form-field class="body-field">
              <textarea matInput formControlName="body" rows="18" [attr.dir]="form.controls.language.value === 'ar' ? 'rtl' : 'ltr'" [attr.aria-label]="'kb.fields.body' | t"></textarea>
              <mat-hint>{{ 'kb.editor.markdownHint' | t }}</mat-hint>
              <mat-error>{{ form.controls.body | formError }}</mat-error>
            </mat-form-field>
          } @else {
            <div class="preview">
              @if (body().trim()) {
                <app-kb-markdown [source]="body()" [language]="form.controls.language.value" />
              } @else {
                <p class="crm-muted">{{ 'kb.editor.emptyPreview' | t }}</p>
              }
            </div>
          }

          @if (!readOnly()) {
            <div class="crm-actions">
              <a mat-button routerLink="/knowledge-base">{{ 'core.actions.cancel' | t }}</a>
              <button mat-flat-button type="submit" [disabled]="saving()">
                <mat-icon>save</mat-icon>{{ (article() ? 'core.actions.save' : 'kb.editor.saveDraft') | t }}
              </button>
            </div>
          }
        </form>

        @if (article(); as a) {
          <aside class="side">
            <section class="crm-card">
              <h2>{{ 'kb.editor.statusTitle' | t }}</h2>
              <p class="pills">
                <span [class]="pill(a.status)">{{ 'kb.status.' + a.status | t }}</span>
                <span class="crm-pill" [class.crm-pill--info]="a.visibility === 'Internal'">{{ 'kb.visibility.' + a.visibility | t }}</span>
              </p>
              <dl>
                @if (a.publishedAt) {
                  <dt>{{ 'kb.fields.publishedAt' | t }}</dt>
                  <dd>{{ a.publishedAt | localDate }}</dd>
                }
                <dt>{{ 'core.fields.createdAt' | t }}</dt>
                <dd>{{ a.createdAt | localDate }}</dd>
                @if (a.updatedAt) {
                  <dt>{{ 'core.fields.updatedAt' | t }}</dt>
                  <dd>{{ a.updatedAt | localDate }}</dd>
                }
                <dt>{{ 'kb.fields.views' | t }}</dt>
                <dd>{{ a.viewCount }}</dd>
                <dt>{{ 'kb.fields.helpful' | t }}</dt>
                <dd>{{ a.helpfulCount }} / {{ a.helpfulCount + a.notHelpfulCount }}</dd>
              </dl>
              <div class="side-actions">
                @if (canPublish() && a.status === 'Draft') {
                  <button mat-flat-button type="button" (click)="change('publish')" [disabled]="busy() || form.dirty" [matTooltip]="form.dirty ? ('kb.editor.saveFirst' | t) : ''">
                    <mat-icon>publish</mat-icon>{{ 'kb.actions.publish' | t }}
                  </button>
                }
                @if (canPublish() && a.status === 'Published') {
                  <button mat-stroked-button type="button" (click)="change('unpublish')" [disabled]="busy()">
                    <mat-icon>unpublished</mat-icon>{{ 'kb.actions.unpublish' | t }}
                  </button>
                }
                @if (canManage() && a.status !== 'Archived') {
                  <button mat-stroked-button type="button" (click)="change('archive')" [disabled]="busy()">
                    <mat-icon>archive</mat-icon>{{ 'kb.actions.archive' | t }}
                  </button>
                }
                @if (canManage() && a.status === 'Archived') {
                  <button mat-flat-button type="button" (click)="change('restore')" [disabled]="busy()">
                    <mat-icon>unarchive</mat-icon>{{ 'kb.actions.restore' | t }}
                  </button>
                }
                @if (canManage()) {
                  <button mat-stroked-button type="button" class="delete" (click)="remove(a)" [disabled]="busy()">
                    <mat-icon>delete</mat-icon>{{ 'core.actions.delete' | t }}
                  </button>
                }
              </div>
            </section>

            <section class="crm-card">
              <h2>{{ 'kb.editor.translations' | t }}</h2>
              @for (translation of a.translations; track translation.id) {
                <a class="translation" [routerLink]="['/knowledge-base', translation.id]">
                  <span class="crm-pill">{{ 'kb.language.' + translation.language | t }}</span>
                  <span [attr.dir]="translation.language === 'ar' ? 'rtl' : 'ltr'">{{ translation.title }}</span>
                </a>
              } @empty {
                <p class="crm-muted">{{ 'kb.editor.noTranslations' | t }}</p>
              }
              @if (canManage() && missingLanguage(a); as language) {
                <a mat-stroked-button [routerLink]="['/knowledge-base', 'new']" [queryParams]="{ translationOf: a.translationOfId ?? a.id, language }">
                  <mat-icon>add</mat-icon>{{ 'kb.editor.addTranslation' | t: { language: ('kb.language.' + language | t) } }}
                </a>
              }
            </section>
          </aside>
        }
      </div>
    }
  `,
  styles: `
    .editor { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr) 320px; align-items: start; }
    @media (max-width: 1023.98px) { .editor { grid-template-columns: minmax(0, 1fr); } }
    .notice { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; padding: 8px 12px; border-radius: 8px; background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container); }
    .body-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin: 16px 0 8px; }
    h2 { margin: 0 0 12px; font: var(--mat-sys-title-medium); }
    .body-head h2 { margin: 0; }
    .body-field { width: 100%; }
    .body-field textarea { font-family: ui-monospace, Consolas, monospace; line-height: 1.5; }
    .preview { min-height: 200px; padding: 12px 16px; border: 1px solid var(--mat-sys-outline-variant); border-radius: 8px; }
    .side { display: flex; flex-direction: column; gap: 16px; }
    .pills { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 12px; margin: 0 0 12px; }
    dt { color: var(--mat-sys-on-surface-variant); }
    dd { margin: 0; }
    .side-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .delete { color: var(--mat-sys-error); }
    .translation { display: flex; align-items: center; gap: 8px; padding: 6px 0; color: inherit; text-decoration: none; }
    .translation:hover span:last-child { text-decoration: underline; }
  `,
})
export class ArticleEditorPage {
  private readonly api = inject(KnowledgeBaseApi);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  /** Route param (`/knowledge-base/:id`); undefined on `/new`. */
  readonly id = input<string>();
  /** Query params on `/new`: create a translation of another article. */
  readonly translationOf = input<string>();
  readonly language = input<string>();

  readonly types = ARTICLE_TYPES;
  readonly visibilities = ARTICLE_VISIBILITIES;
  readonly languages = KB_LANGUAGES;

  readonly article = signal<KbArticle | null>(null);
  readonly source = signal<KbArticle | null>(null);
  readonly categories = signal<KbCategory[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly busy = signal(false);
  readonly mode = signal<'write' | 'preview'>('write');

  readonly canManage = computed(() => this.permissions.has(Permissions.knowledgeManage));
  readonly canPublish = computed(() => this.permissions.has(Permissions.knowledgePublish));
  readonly readOnly = computed(() => !this.canManage() || this.article()?.status === 'Archived');

  readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.maxLength(300)]],
    slug: ['', Validators.maxLength(200)],
    summary: ['', Validators.maxLength(1000)],
    body: ['', [Validators.required, Validators.maxLength(200_000)]],
    type: ['Article' as ArticleType],
    language: ['en' as KbLanguage],
    categoryId: [''],
    tags: [''],
    visibility: ['Public' as ArticleVisibility],
  });

  readonly body = toSignal(this.form.controls.body.valueChanges, { initialValue: '' });

  private readonly retryCount = signal(0);

  constructor() {
    this.api
      .categories()
      .pipe(
        catchError(() => of([] as KbCategory[])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((categories) => this.categories.set(categories));

    const route = computed(() => ({ id: this.id(), translationOf: this.translationOf(), language: this.language(), retry: this.retryCount() }));
    toObservable(route)
      .pipe(
        switchMap(({ id, translationOf }) => this.load(id, translationOf)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((loaded) => this.apply(loaded));

    effect(() => {
      if (this.readOnly()) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    });
  }

  retry(): void {
    this.retryCount.update((n) => n + 1);
  }

  label(category: KbCategory): string {
    return categoryLabel(category, this.translations.language());
  }

  pill(status: string): string {
    return statusPill(status);
  }

  /** The other language when this article has no translation in it yet. */
  missingLanguage(article: KbArticle): KbLanguage | null {
    const present = new Set([article.language, ...article.translations.map((t) => t.language)]);
    return KB_LANGUAGES.find((l) => !present.has(l)) ?? null;
  }

  save(): void {
    if (this.readOnly() || this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.controls.body.invalid) {
        this.mode.set('write');
      }
      return;
    }
    const value = this.form.getRawValue();
    const current = this.article();
    const request: KbArticleRequest = {
      title: value.title.trim(),
      slug: value.slug.trim() || null,
      summary: value.summary.trim() || null,
      body: value.body,
      type: value.type,
      language: value.language,
      categoryId: value.categoryId || null,
      tags: value.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
      visibility: value.visibility,
      translationOfId: current ? current.translationOfId : (this.source()?.translationOfId ?? this.source()?.id ?? null),
    };
    this.saving.set(true);
    this.api.saveArticle(current?.id ?? null, request, { silent: true }).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.toast.success(current ? 'core.states.saved' : 'kb.messages.created');
        this.apply({ kind: 'article', article: saved });
        if (!current) {
          void this.router.navigate(['/knowledge-base', saved.id], { replaceUrl: true });
        }
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.showSaveError(ApiError.from(error));
      },
    });
  }

  change(action: ArticleAction): void {
    const current = this.article();
    if (!current || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.api.changeStatus(current.id, action).subscribe({
      next: (article) => {
        this.busy.set(false);
        this.article.set(article);
        this.toast.success(`kb.messages.${action}`);
      },
      error: () => this.busy.set(false),
    });
  }

  remove(article: KbArticle): void {
    this.confirm
      .ask({ title: 'kb.delete.title', message: 'kb.delete.message', params: { title: article.title }, confirmText: 'core.actions.delete', destructive: true })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.busy.set(true);
        this.api.deleteArticle(article.id).subscribe({
          next: () => {
            this.toast.success('kb.messages.deleted');
            void this.router.navigate(['/knowledge-base']);
          },
          error: () => this.busy.set(false),
        });
      });
  }

  private load(id: string | undefined, translationOf: string | undefined): Observable<Loaded> {
    const current = this.article();
    if (id && current?.id === id) {
      // Just created and navigated to its own URL.
      return of<Loaded>({ kind: 'article', article: current });
    }
    this.loading.set(true);
    this.loadError.set(null);
    const fail = (error: unknown) => of<Loaded>({ kind: 'error', message: describeError(ApiError.from(error), this.translations) });
    if (id) {
      return this.api.article(id, { silent: true }).pipe(
        map((article): Loaded => ({ kind: 'article', article })),
        catchError(fail),
      );
    }
    if (translationOf) {
      return this.api.article(translationOf, { silent: true }).pipe(
        map((source): Loaded => ({ kind: 'new', source })),
        catchError(() => of<Loaded>({ kind: 'new', source: null })),
      );
    }
    return of<Loaded>({ kind: 'new', source: null });
  }

  private apply(loaded: Loaded): void {
    this.loading.set(false);
    switch (loaded.kind) {
      case 'error':
        this.loadError.set(loaded.message);
        return;
      case 'article': {
        const a = loaded.article;
        this.article.set(a);
        this.source.set(null);
        this.form.reset({
          title: a.title,
          slug: a.slug,
          summary: a.summary ?? '',
          body: a.body,
          type: a.type,
          language: a.language === 'ar' ? 'ar' : 'en',
          categoryId: a.categoryId ?? '',
          tags: a.tags.join(', '),
          visibility: a.visibility,
        });
        return;
      }
      case 'new': {
        const s = loaded.source;
        this.article.set(null);
        this.source.set(s);
        const requested = this.language();
        const language: KbLanguage =
          requested === 'ar' || requested === 'en' ? requested : s ? (s.language === 'ar' ? 'en' : 'ar') : this.translations.language();
        this.form.reset({
          title: '',
          slug: '',
          summary: '',
          body: '',
          type: s?.type ?? 'Article',
          language,
          categoryId: s?.categoryId ?? '',
          tags: s?.tags.join(', ') ?? '',
          visibility: s?.visibility ?? 'Public',
        });
        this.mode.set('write');
        return;
      }
    }
  }

  private showSaveError(error: ApiError): void {
    if (error.hasCode(KbErrorCodes.slugTaken)) {
      this.form.controls.slug.setErrors({ server: this.translations.t('kb.errors.slugTaken') });
      this.form.controls.slug.markAsTouched();
      return;
    }
    if (error.hasCode(KbErrorCodes.categoryNotFound)) {
      this.form.controls.categoryId.setErrors({ server: this.translations.t('kb.errors.categoryNotFound') });
      this.form.controls.categoryId.markAsTouched();
      return;
    }
    const unmatched = applyKbServerErrors(this.form, error, 'article');
    if (!error.isValidation || unmatched.length) {
      this.toast.error(unmatched[0] ?? describeError(error, this.translations));
    }
    if (this.form.controls.body.invalid) {
      this.mode.set('write');
    }
  }
}
