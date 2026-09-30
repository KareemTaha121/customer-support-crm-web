import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';
import { renderMarkdown } from './markdown';

/**
 * Renders article Markdown safely: `<app-kb-markdown [source]="article.body" [language]="article.language" />`.
 * The HTML comes from {@link renderMarkdown} (input escaped first) and is sanitized again by Angular.
 */
@Component({
  selector: 'app-kb-markdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The rendered HTML carries no encapsulation attributes; selectors are scoped by .kb-md instead.
  encapsulation: ViewEncapsulation.None,
  template: `<div class="kb-md" [attr.dir]="dir()" [attr.lang]="language()" [innerHTML]="html()"></div>`,
  styles: `
    app-kb-markdown { display: block; }
    .kb-md { font: var(--mat-sys-body-large); line-height: 1.7; overflow-wrap: anywhere; }
    .kb-md :is(h2, h3, h4, h5, h6) { margin: 1.4em 0 .5em; line-height: 1.3; }
    .kb-md h2 { font: var(--mat-sys-title-large); }
    .kb-md h3 { font: var(--mat-sys-title-medium); }
    .kb-md p { margin: 0 0 1em; }
    .kb-md :is(ul, ol) { margin: 0 0 1em; padding-inline-start: 1.5em; }
    .kb-md li { margin-bottom: .25em; }
    .kb-md blockquote { margin: 0 0 1em; padding: 4px 16px; border-inline-start: 4px solid var(--mat-sys-outline-variant); color: var(--mat-sys-on-surface-variant); }
    .kb-md code { font-family: ui-monospace, Consolas, monospace; font-size: .9em; background: var(--mat-sys-surface-container-high); padding: 1px 5px; border-radius: 4px; }
    .kb-md pre { direction: ltr; text-align: left; overflow-x: auto; background: var(--mat-sys-surface-container-high); padding: 12px 16px; border-radius: 8px; }
    .kb-md pre code { background: none; padding: 0; }
    .kb-md img { max-width: 100%; height: auto; border-radius: 8px; }
    .kb-md hr { border: 0; border-top: 1px solid var(--mat-sys-outline-variant); margin: 1.5em 0; }
    .kb-md a { color: var(--mat-sys-primary); }
  `,
})
export class KbMarkdownComponent {
  readonly source = input<string | null>(null);
  /** Article language; Arabic content renders right-to-left in either UI language. */
  readonly language = input<string | null>(null);

  readonly html = computed(() => renderMarkdown(this.source()));
  readonly dir = computed(() => {
    const language = this.language();
    return language ? (language === 'ar' ? 'rtl' : 'ltr') : null;
  });
}
