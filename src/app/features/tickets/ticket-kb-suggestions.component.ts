import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { PermissionService } from '../../core/permissions/permission.service';
import { Permissions } from '../../core/permissions/permissions';
import { LoadingComponent } from '../../shared/state.components';
import { KbArticleListItem } from '../knowledge-base/knowledge-base.models';
import { TicketsApi } from './tickets.api';

/**
 * Knowledge articles suggested for a ticket (`GET /kb/suggestions`). Works without AI.
 * Public articles can be inserted into the reply as a help-center link.
 */
@Component({
  selector: 'app-ticket-kb-suggestions',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, RouterLink, TranslatePipe, LoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="crm-card">
      <header class="head">
        <mat-icon class="icon">menu_book</mat-icon>
        <h3>{{ 'tickets.kbSuggestions.title' | t }}</h3>
        <button mat-icon-button type="button" [matTooltip]="'core.actions.refresh' | t" [disabled]="loading()" (click)="load()">
          <mat-icon>refresh</mat-icon>
        </button>
      </header>

      @if (loading()) {
        <app-loading [diameter]="28" />
      } @else if (failed()) {
        <p class="crm-muted">{{ 'tickets.kbSuggestions.error' | t }}</p>
      } @else {
        <ul class="list">
          @for (article of articles(); track article.id) {
            <li>
              <div class="text" [attr.dir]="article.language === 'ar' ? 'rtl' : 'ltr'" [attr.lang]="article.language">
                @if (canViewKb) {
                  <a [routerLink]="['/knowledge-base', 'articles', article.id]">{{ article.title }}</a>
                } @else {
                  <strong>{{ article.title }}</strong>
                }
                @if (article.summary) {
                  <small class="crm-muted">{{ article.summary }}</small>
                }
                <small class="crm-muted">
                  {{ article.categoryName ?? ('tickets.kbSuggestions.noCategory' | t) }} · {{ 'tickets.kbSuggestions.visibility.' + article.visibility | t }}
                </small>
              </div>
              @if (canInsert() && article.visibility === 'Public') {
                <button mat-icon-button type="button" [matTooltip]="'tickets.kbSuggestions.insertLink' | t" (click)="insert(article)">
                  <mat-icon>add_link</mat-icon>
                </button>
              }
            </li>
          } @empty {
            <li class="crm-muted">{{ 'tickets.kbSuggestions.empty' | t }}</li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .head { display: flex; align-items: center; gap: 8px; }
    .head h3 { flex: 1; margin: 0; font-size: 1rem; }
    .icon { color: var(--mat-sys-primary); }
    .list { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    li { display: flex; align-items: flex-start; gap: 4px; }
    .text { flex: 1; display: flex; flex-direction: column; gap: 2px; min-inline-size: 0; overflow-wrap: anywhere; }
  `,
})
export class TicketKbSuggestionsComponent {
  private readonly api = inject(TicketsApi);
  private readonly translations = inject(TranslationService);
  private readonly document = inject(DOCUMENT);

  readonly ticketId = input.required<string>();
  readonly canInsert = input(false);
  /** Emits reply text containing the article title and its public help-center link. */
  readonly linkInserted = output<string>();

  readonly canViewKb = inject(PermissionService).has(Permissions.knowledgeView);
  readonly articles = signal<KbArticleListItem[]>([]);
  readonly loading = signal(false);
  readonly failed = signal(false);

  private request?: Subscription;

  constructor() {
    effect(() => {
      this.ticketId();
      untracked(() => this.load());
    });
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.failed.set(false);
    this.request = this.api.suggestArticles(this.ticketId()).subscribe({
      next: (items) => {
        this.articles.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.articles.set([]);
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  insert(article: KbArticleListItem): void {
    const url = `${this.document.location.origin}/help/articles/${encodeURIComponent(article.slug)}`;
    this.linkInserted.emit(this.translations.t('tickets.kbSuggestions.linkText', { title: article.title, url }));
  }
}
