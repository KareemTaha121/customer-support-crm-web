import { BidiModule } from '@angular/cdk/bidi';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslationService } from './core/localization/translation.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BidiModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The Dir directive re-provides Directionality so Material components follow en/ar switches.
  template: `<div class="app-root" [dir]="translations.direction()"><router-outlet /></div>`,
})
export class App {
  readonly translations = inject(TranslationService);
}
