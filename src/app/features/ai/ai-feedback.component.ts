import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { AiApi } from './ai.api';
import { describeAiError } from './ai-errors';
import { EMPTY_GUID } from './ai.models';

interface FeedbackState {
  status: 'idle' | 'sending' | 'sent' | 'error';
  accepted: boolean | null;
  error: string | null;
}

const IDLE: FeedbackState = { status: 'idle', accepted: null, error: null };

/** Thumbs up/down for one AI suggestion: `<app-ai-feedback [suggestionId]="id" />` (POST /ai/suggestions/{id}/feedback). */
@Component({
  selector: 'app-ai-feedback',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canRate()) {
      <div class="feedback">
        @switch (state().status) {
          @case ('sent') {
            <span class="note"><mat-icon>check_circle</mat-icon>{{ 'ai.feedback.thanks' | t }}</span>
          }
          @default {
            <span class="note">{{ 'ai.feedback.question' | t }}</span>
            <button
              mat-icon-button
              type="button"
              [disabled]="state().status === 'sending'"
              [matTooltip]="'ai.feedback.helpful' | t"
              [attr.aria-label]="'ai.feedback.helpful' | t"
              (click)="send(true)"
            >
              <mat-icon>thumb_up</mat-icon>
            </button>
            <button
              mat-icon-button
              type="button"
              [disabled]="state().status === 'sending'"
              [matTooltip]="'ai.feedback.notHelpful' | t"
              [attr.aria-label]="'ai.feedback.notHelpful' | t"
              (click)="send(false)"
            >
              <mat-icon>thumb_down</mat-icon>
            </button>
          }
        }
      </div>
      @if (state().error; as error) {
        <p class="error" role="alert">{{ error }}</p>
      }
    }
  `,
  styles: `
    .feedback { display: flex; align-items: center; gap: 2px; justify-content: flex-end; }
    .note { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--mat-sys-on-surface-variant); margin-inline-end: 4px; }
    .note mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--crm-success, #2e7d32); }
    button mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .error { margin: 0; font-size: 12px; color: var(--mat-sys-error); text-align: end; }
  `,
})
export class AiFeedbackComponent {
  private readonly api = inject(AiApi);
  private readonly translations = inject(TranslationService);

  readonly suggestionId = input.required<string>();

  readonly canRate = computed(() => !!this.suggestionId() && this.suggestionId() !== EMPTY_GUID);
  readonly state = linkedSignal<string, FeedbackState>({ source: this.suggestionId, computation: () => IDLE });

  send(accepted: boolean): void {
    const id = this.suggestionId();
    if (!this.canRate() || this.state().status === 'sending') {
      return;
    }
    this.state.set({ status: 'sending', accepted, error: null });
    this.api.feedback(id, accepted).subscribe({
      next: () => {
        if (id === this.suggestionId()) {
          this.state.set({ status: 'sent', accepted, error: null });
        }
      },
      error: (error: unknown) => {
        if (id === this.suggestionId()) {
          this.state.set({ status: 'error', accepted: null, error: describeAiError(error, this.translations) });
        }
      },
    });
  }
}
