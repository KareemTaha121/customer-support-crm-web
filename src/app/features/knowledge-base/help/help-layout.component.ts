import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';
import { BrandingService } from '../../../core/branding/branding.service';
import { LanguageSwitcherComponent } from '../../../core/layout/language-switcher.component';
import { TranslatePipe } from '../../../core/localization/translate.pipe';

/** Public help center layout (`/help`, anonymous): brand bar, language switch, portal link. */
@Component({
  selector: 'app-help-layout',
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatButtonModule, MatIconModule, LanguageSwitcherComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-toolbar class="help-bar">
      <a class="help-bar__brand" routerLink="/help">
        @if (branding.logoSrc(); as logo) {
          <img [src]="logo" alt="" />
        } @else {
          <mat-icon>support_agent</mat-icon>
        }
        <span class="help-bar__name">{{ branding.branding().name }}</span>
        <span class="help-bar__divider" aria-hidden="true"></span>
        <span class="help-bar__section">{{ 'kb.help.title' | t }}</span>
      </a>
      <span class="crm-spacer"></span>
      <app-language-switcher />
      <a mat-flat-button routerLink="/portal">
        <mat-icon>confirmation_number</mat-icon>
        <span class="help-bar__label">{{ 'kb.help.portal' | t }}</span>
      </a>
    </mat-toolbar>
    <main class="help-main">
      <router-outlet />
    </main>
    <footer class="help-footer crm-muted">
      <span>© {{ year }} {{ branding.branding().name }}</span>
      <a routerLink="/portal">{{ 'kb.help.contact' | t }}</a>
    </footer>
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100dvh; background: var(--mat-sys-surface-container-lowest); }
    .help-bar { position: sticky; top: 0; z-index: 3; gap: 8px; background: var(--mat-sys-surface); border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .help-bar__brand { display: flex; align-items: center; gap: 10px; min-width: 0; color: inherit; text-decoration: none; font: var(--mat-sys-title-medium); }
    .help-bar__brand img { max-height: 36px; max-width: 120px; object-fit: contain; }
    .help-bar__brand mat-icon { color: var(--mat-sys-primary); }
    .help-bar__divider { width: 1px; height: 20px; background: var(--mat-sys-outline-variant); }
    .help-bar__section { color: var(--mat-sys-primary); }
    .help-main { flex: 1; width: 100%; max-width: 1100px; margin-inline: auto; padding: 24px 16px 48px; box-sizing: border-box; }
    .help-footer { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 24px; padding: 20px 16px; border-top: 1px solid var(--mat-sys-outline-variant); font: var(--mat-sys-body-small); }
    .help-footer a { color: var(--mat-sys-primary); }
    @media (max-width: 719.98px) {
      .help-bar__name, .help-bar__divider, .help-bar__label { display: none; }
    }
  `,
})
export class HelpLayoutComponent {
  readonly branding = inject(BrandingService);
  readonly year = new Date().getFullYear();
}
