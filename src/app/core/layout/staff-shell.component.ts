import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { BrandingService } from '../branding/branding.service';
import { TranslatePipe } from '../localization/translate.pipe';
import { TranslationService } from '../localization/translation.service';
import { PermissionService } from '../permissions/permission.service';
import { LanguageSwitcherComponent } from './language-switcher.component';
import { NAVIGATION } from './navigation';
import { NotificationBellComponent } from './notification-bell.component';

/** Responsive staff layout: permission-filtered sidenav, toolbar with bell, language and user menu. */
@Component({
  selector: 'app-staff-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    TranslatePipe,
    NotificationBellComponent,
    LanguageSwitcherComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav
        #sidenav
        class="shell__nav"
        [mode]="isMobile() ? 'over' : 'side'"
        [opened]="!isMobile()"
        [position]="'start'"
        [fixedInViewport]="isMobile()"
      >
        <a class="shell__brand" routerLink="/dashboard">
          @if (branding.logoSrc(); as logo) {
            <img [src]="logo" alt="" />
          } @else {
            <mat-icon>support_agent</mat-icon>
          }
          <span>{{ branding.branding().name }}</span>
        </a>
        <mat-divider />
        @for (section of sections(); track $index) {
          @if (section.label) {
            <div class="shell__section">{{ section.label | t }}</div>
          }
          <mat-nav-list>
            @for (item of section.items; track item.route) {
              <a
                mat-list-item
                [routerLink]="item.route"
                routerLinkActive="shell__link--active"
                [routerLinkActiveOptions]="{ exact: item.route === '/tickets' }"
                #rla="routerLinkActive"
                [activated]="rla.isActive"
              >
                <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
                <span matListItemTitle>{{ item.label | t }}</span>
              </a>
            }
          </mat-nav-list>
        }
      </mat-sidenav>

      <mat-sidenav-content class="shell__content">
        <mat-toolbar class="shell__toolbar">
          <button mat-icon-button type="button" (click)="sidenav.toggle()" [attr.aria-label]="'core.nav.toggle' | t">
            <mat-icon>menu</mat-icon>
          </button>
          <span class="shell__spacer"></span>
          <app-language-switcher />
          <app-notification-bell />
          <button mat-button type="button" [matMenuTriggerFor]="userMenu" class="shell__user">
            <mat-icon>account_circle</mat-icon>
            <span class="shell__user-name">{{ auth.currentUser()?.displayName }}</span>
          </button>
          <mat-menu #userMenu="matMenu" xPosition="before">
            <div class="shell__user-info">
              <strong>{{ auth.currentUser()?.displayName }}</strong>
              <small>{{ auth.currentUser()?.email }}</small>
            </div>
            <mat-divider />
            <a mat-menu-item routerLink="/profile">
              <mat-icon>person</mat-icon>
              <span>{{ 'core.user.profile' | t }}</span>
            </a>
            <button mat-menu-item type="button" (click)="auth.logout()">
              <mat-icon>logout</mat-icon>
              <span>{{ 'core.user.logout' | t }}</span>
            </button>
          </mat-menu>
        </mat-toolbar>
        <main class="shell__main">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styleUrl: './staff-shell.component.scss',
})
export class StaffShellComponent {
  readonly auth = inject(AuthService);
  readonly branding = inject(BrandingService);
  readonly translations = inject(TranslationService);
  private readonly permissions = inject(PermissionService);
  private readonly sidenav = viewChild.required<MatSidenav>('sidenav');

  readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 959.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  readonly sections = computed(() =>
    NAVIGATION.map((section) => ({
      ...section,
      items: section.items.filter((item) => this.permissions.hasAny(item.permissions)),
    })).filter((section) => section.items.length > 0),
  );

  constructor() {
    inject(Router)
      .events.pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.isMobile()) {
          void this.sidenav().close();
        }
      });
  }
}
