import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

/**
 * Page title row with optional back link and projected actions:
 * `<app-page-header [title]="'tickets.list.title' | t" backLink="/tickets"><button ...></app-page-header>`
 */
@Component({
  selector: 'app-page-header',
  imports: [MatIconModule, MatButtonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <div class="page-header__title">
        @if (backLink()) {
          <a mat-icon-button [routerLink]="backLink()" class="page-header__back" aria-label="Back">
            <mat-icon class="rtl-flip">arrow_back</mat-icon>
          </a>
        }
        <div>
          <h1>{{ title() }}</h1>
          @if (subtitle()) {
            <p class="page-header__subtitle">{{ subtitle() }}</p>
          }
        </div>
      </div>
      <div class="page-header__actions"><ng-content /></div>
    </header>
  `,
  styles: `
    .page-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
    .page-header__title { display: flex; align-items: center; gap: 8px; min-width: 0; }
    h1 { margin: 0; font: var(--mat-sys-headline-small); overflow-wrap: anywhere; }
    .page-header__subtitle { margin: 2px 0 0; color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-medium); }
    .page-header__actions { display: flex; flex-wrap: wrap; gap: 8px; }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly backLink = input<string | readonly unknown[] | null>(null);
}
