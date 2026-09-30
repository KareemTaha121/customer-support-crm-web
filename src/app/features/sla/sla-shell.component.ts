import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { PermissionService } from '../../core/permissions/permission.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { SLA_TABS } from './sla-tabs';

/** `/sla`: page title plus one tab per section the user may manage. */
@Component({
  selector: 'app-sla-shell',
  imports: [MatTabsModule, MatIconModule, RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'sla.title' | t" [subtitle]="'sla.subtitle' | t" />
    <nav mat-tab-nav-bar [tabPanel]="panel" [attr.aria-label]="'sla.title' | t">
      @for (tab of tabs(); track tab.path) {
        <a mat-tab-link [routerLink]="tab.path" routerLinkActive #rla="routerLinkActive" [active]="rla.isActive">
          <mat-icon class="tab-icon">{{ tab.icon }}</mat-icon>
          {{ tab.label | t }}
        </a>
      }
    </nav>
    <mat-tab-nav-panel #panel class="panel">
      <router-outlet />
    </mat-tab-nav-panel>
  `,
  styles: `
    .tab-icon { margin-inline-end: 8px; }
    .panel { display: block; padding-top: 16px; }
  `,
})
export class SlaShellComponent {
  private readonly permissions = inject(PermissionService);
  readonly tabs = computed(() => SLA_TABS.filter((tab) => this.permissions.has(tab.permission)));
}
