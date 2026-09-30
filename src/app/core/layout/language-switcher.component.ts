import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslationService } from '../localization/translation.service';

/** Toggles English / Arabic (and the document direction). */
@Component({
  selector: 'app-language-switcher',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button mat-button type="button" (click)="toggle()" [matTooltip]="translations.language() === 'ar' ? 'English' : 'العربية'">
      <mat-icon>translate</mat-icon>
      {{ translations.language() === 'ar' ? 'EN' : 'ع' }}
    </button>
  `,
})
export class LanguageSwitcherComponent {
  readonly translations = inject(TranslationService);

  toggle(): void {
    void this.translations.setLanguage(this.translations.language() === 'ar' ? 'en' : 'ar');
  }
}
