import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../localization/translate.pipe';

@Component({
  selector: 'app-not-found',
  imports: [MatButtonModule, MatIconModule, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="crm-status-page">
      <mat-icon>travel_explore</mat-icon>
      <h1>{{ 'core.status.notFoundTitle' | t }}</h1>
      <p>{{ 'core.status.notFoundMessage' | t }}</p>
      <a mat-flat-button routerLink="/">{{ 'core.status.home' | t }}</a>
    </section>
  `,
})
export class NotFoundComponent {}

@Component({
  selector: 'app-forbidden',
  imports: [MatButtonModule, MatIconModule, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="crm-status-page">
      <mat-icon>lock</mat-icon>
      <h1>{{ 'core.status.forbiddenTitle' | t }}</h1>
      <p>{{ 'core.status.forbiddenMessage' | t }}</p>
      <a mat-flat-button routerLink="/">{{ 'core.status.home' | t }}</a>
    </section>
  `,
})
export class ForbiddenComponent {}

/** Placeholder for a route whose feature screen is not built yet. */
@Component({
  selector: 'app-coming-soon',
  imports: [MatIconModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="crm-status-page">
      <mat-icon>construction</mat-icon>
      <h1>{{ 'core.status.comingSoon' | t }}</h1>
    </section>
  `,
})
export class ComingSoonComponent {}
