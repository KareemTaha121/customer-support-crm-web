import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '../core/localization/translate.pipe';

/** Centered spinner: `<app-loading />` */
@Component({
  selector: 'app-loading',
  imports: [MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="state"><mat-spinner [diameter]="diameter()" /></div>`,
  styles: `.state { display: flex; justify-content: center; padding: 32px 16px; }`,
})
export class LoadingComponent {
  readonly diameter = input(40);
}

/** Empty list placeholder: `<app-empty-state icon="inbox" [message]="'x' | t" />` (projected content = actions). */
@Component({
  selector: 'app-empty-state',
  imports: [MatIconModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state">
      <mat-icon>{{ icon() }}</mat-icon>
      <p>{{ message() || ('core.states.empty' | t) }}</p>
      <ng-content />
    </div>
  `,
  styles: `
    .state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px 16px; color: var(--mat-sys-on-surface-variant); text-align: center; }
    mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: .6; }
    p { margin: 0; }
  `,
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly message = input<string | null>(null);
}

/** Load failure with retry: `<app-error-state [message]="error()" (retry)="load()" />` */
@Component({
  selector: 'app-error-state',
  imports: [MatIconModule, MatButtonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="state" role="alert">
      <mat-icon>error_outline</mat-icon>
      <p>{{ message() || ('core.errors.unknown' | t) }}</p>
      <button mat-stroked-button type="button" (click)="retry.emit()">{{ 'core.actions.retry' | t }}</button>
    </div>
  `,
  styles: `
    .state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px 16px; color: var(--mat-sys-error); text-align: center; }
    p { margin: 0; }
  `,
})
export class ErrorStateComponent {
  readonly message = input<string | null>(null);
  readonly retry = output<void>();
}
