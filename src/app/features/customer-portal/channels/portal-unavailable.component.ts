import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { PortalAuthService } from '../../../core/auth/portal-auth.service';
import { BrandingService } from '../../../core/branding/branding.service';
import { FeatureFlags } from '../../../core/branding/feature-flags';
import { TranslatePipe } from '../../../core/localization/translate.pipe';

interface Alternative {
  key: string;
  label: string;
  icon: string;
  route: string;
}

/** Friendly state for a disabled public channel, with links to the channels that are on. */
@Component({
  selector: 'app-portal-unavailable',
  imports: [RouterLink, MatButtonModule, MatIconModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="crm-card unavailable" role="status">
      <mat-icon class="unavailable__icon">{{ icon() }}</mat-icon>
      <h1>{{ title() }}</h1>
      <p class="crm-muted">{{ 'portal.unavailable.message' | t }}</p>
      <div class="unavailable__links">
        @for (item of alternatives(); track item.key) {
          <a mat-stroked-button [routerLink]="item.route">
            <mat-icon>{{ item.icon }}</mat-icon>
            {{ item.label | t }}
          </a>
        }
      </div>
    </section>
  `,
  styles: `
    .unavailable { max-width: 560px; margin: 32px auto; padding: 32px 24px; text-align: center; }
    .unavailable__icon { font-size: 48px; width: 48px; height: 48px; color: var(--mat-sys-on-surface-variant); }
    h1 { margin: 8px 0; font: var(--mat-sys-headline-small); }
    p { margin: 0 0 20px; }
    .unavailable__links { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  `,
})
export class PortalUnavailableComponent {
  private readonly branding = inject(BrandingService);
  private readonly portal = inject(PortalAuthService);

  readonly title = input.required<string>();
  readonly icon = input('cloud_off');
  /** The channel being shown (excluded from the alternatives). */
  readonly current = input<string | null>(null);

  readonly alternatives = computed<Alternative[]>(() => {
    const current = this.current();
    const items: Alternative[] = [];
    const add = (key: string, label: string, icon: string, route: string, enabled: boolean) => {
      if (enabled && key !== current) {
        items.push({ key, label, icon, route });
      }
    };
    add('assistant', 'portal.nav.assistant', 'smart_toy', '/portal/assistant', this.branding.isEnabled(FeatureFlags.chatbot));
    add('chat', 'portal.nav.chat', 'forum', '/portal/chat', this.branding.isEnabled(FeatureFlags.liveChat));
    add('contact', 'portal.nav.contact', 'mail', '/portal/contact', this.branding.isEnabled(FeatureFlags.webForm));
    add('tickets', 'portal.tickets.new', 'confirmation_number', this.portal.isAuthenticated() ? '/portal/tickets/new' : '/portal/login', true);
    add('help', 'portal.nav.help', 'help_center', '/help', true);
    return items;
  });
}
