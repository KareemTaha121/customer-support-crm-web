import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { KbArticleListItem, KbCategory, categoryLabel } from '../knowledge-base.models';

/** Article result rows for the help center: `<app-help-article-list [articles]="items" />`. */
@Component({
  selector: 'app-help-article-list',
  imports: [RouterLink, MatIconModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="list">
      @for (article of articles(); track article.id) {
        <li>
          <a class="item" [routerLink]="['/help/articles', article.slug]" [attr.dir]="article.language === 'ar' ? 'rtl' : 'ltr'" [attr.lang]="article.language">
            <mat-icon class="icon">{{ article.type === 'Faq' ? 'help_outline' : 'article' }}</mat-icon>
            <span class="text">
              <span class="title">{{ article.title }}</span>
              @if (article.summary) {
                <span class="summary">{{ article.summary }}</span>
              }
              @if (showCategory() && article.categoryName) {
                <span class="meta">{{ categoryName(article) }} · {{ 'kb.type.' + article.type | t }}</span>
              }
            </span>
            <mat-icon class="chevron" aria-hidden="true">chevron_right</mat-icon>
          </a>
        </li>
      }
    </ul>
  `,
  styles: `
    .list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--mat-sys-outline-variant); border-radius: 12px; background: var(--mat-sys-surface); overflow: hidden; }
    li + li { border-top: 1px solid var(--mat-sys-outline-variant); }
    .item { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; color: inherit; text-decoration: none; }
    .item:hover, .item:focus-visible { background: var(--mat-sys-surface-container-low); }
    .icon { color: var(--mat-sys-primary); flex: none; }
    .text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .title { font: var(--mat-sys-title-small); }
    .summary { color: var(--mat-sys-on-surface-variant); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .meta { color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-small); }
    .chevron { color: var(--mat-sys-on-surface-variant); flex: none; align-self: center; }
    .item[dir="rtl"] .chevron { transform: scaleX(-1); }
  `,
})
export class HelpArticleListComponent {
  readonly articles = input.required<readonly KbArticleListItem[]>();
  readonly showCategory = input(true);
  /** Used to show the Arabic category name when the UI is Arabic. */
  readonly categories = input<readonly KbCategory[]>([]);

  private readonly translations = inject(TranslationService);

  categoryName(article: KbArticleListItem): string {
    const category = this.categories().find((c) => c.id === article.categoryId);
    return category ? categoryLabel(category, this.translations.language()) : (article.categoryName ?? '');
  }
}
