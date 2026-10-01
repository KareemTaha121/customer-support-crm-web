import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PortalAuthService } from '../../core/auth/portal-auth.service';
import { BrandingService } from '../../core/branding/branding.service';
import { LanguageSwitcherComponent } from '../../core/layout/language-switcher.component';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { PORTAL_NAV } from './portal-navigation';

/** Customer-facing layout: brand bar, portal navigation, account menu. */
@Component({
  selector: 'app-portal-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule, TranslatePipe, LanguageSwitcherComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-toolbar class="portal-bar">
      <a class="portal-bar__brand" routerLink="/portal">
        @if (branding.logoSrc(); as logo) {
          <img [src]="logo" alt="" />
        } @else {
          <mat-icon>support_agent</mat-icon>
        }
        <span>{{ branding.branding().name }}</span>
      </a>
      <nav class="portal-bar__nav">
        @for (item of nav; track item.route) {
          @if ((!item.requiresAuth || portal.isAuthenticated()) && (!item.flag || branding.isEnabled(item.flag))) {
            <a mat-button [routerLink]="item.route" routerLinkActive="portal-bar__link--active" [routerLinkActiveOptions]="{ exact: item.exact }">
              <mat-icon>{{ item.icon }}</mat-icon>
              <span class="portal-bar__label">{{ item.label | t }}</span>
            </a>
          }
        }
      </nav>
      <span class="crm-spacer"></span>
      <app-language-switcher />
      @if (portal.profile(); as profile) {
        <button mat-button type="button" [matMenuTriggerFor]="account">
          <mat-icon>account_circle</mat-icon>
          <span class="portal-bar__label">{{ profile.name }}</span>
        </button>
        <mat-menu #account="matMenu" xPosition="before">
          <a mat-menu-item routerLink="/portal/profile">
            <mat-icon>person</mat-icon>
            <span>{{ 'portal.nav.profile' | t }}</span>
          </a>
          <button mat-menu-item type="button" (click)="portal.logout()">
            <mat-icon>logout</mat-icon>
            <span>{{ 'portal.nav.logout' | t }}</span>
          </button>
        </mat-menu>
      } @else {
        <a mat-flat-button routerLink="/portal/login">{{ 'portal.nav.login' | t }}</a>
      }
    </mat-toolbar>
    <main class="portal-main">
      <router-outlet />
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100dvh; background: var(--mat-sys-surface-container-lowest); }
    .portal-bar { position: sticky; top: 0; z-index: 3; gap: 8px; background: var(--mat-sys-surface); border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .portal-bar__brand { display: flex; align-items: center; gap: 10px; color: inherit; text-decoration: none; font: var(--mat-sys-title-medium); margin-inline-end: 12px; }
    .portal-bar__brand img { max-height: 36px; max-width: 120px; object-fit: contain; }
    .portal-bar__brand mat-icon { color: var(--mat-sys-primary); }
    /* Full toolbar height so the 48px touch targets fit: no vertical scroll container. */
    .portal-bar__nav { display: flex; align-self: stretch; align-items: center; gap: 4px; overflow-x: auto; overflow-y: hidden; }
    .portal-bar__link--active { background: var(--mat-sys-secondary-container); }
    .portal-main { max-width: 1100px; margin-inline: auto; padding: 24px 16px; }
    @media (max-width: 719.98px) {
      .portal-bar__label, .portal-bar__brand span { display: none; }
    }
  `,
})
export class PortalShellComponent {
  readonly portal = inject(PortalAuthService);
  readonly branding = inject(BrandingService);
  readonly nav = PORTAL_NAV;
}
