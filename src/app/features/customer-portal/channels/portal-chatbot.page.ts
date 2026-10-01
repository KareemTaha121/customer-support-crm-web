import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, computed, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { PortalAuthService } from '../../../core/auth/portal-auth.service';
import { BrandingService } from '../../../core/branding/branding.service';
import { FeatureFlags } from '../../../core/branding/feature-flags';
import { ApiError } from '../../../core/http/api-error';
import { describeError } from '../../../core/interceptors/error.interceptor';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { PageHeaderComponent } from '../../../shared/page-header.component';
import { PortalPublicApi } from '../customer-portal.api';
import { ChatbotSource, ChatbotTurn } from '../customer-portal.models';
import { PortalUnavailableComponent } from './portal-unavailable.component';

/** Turns kept in the request (ChatbotValidator allows at most 20). */
const MAX_TURNS = 20;

interface BotEntry {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sources: ChatbotSource[];
  handoff: boolean;
  failed: boolean;
}

/** Public AI assistant grounded in the knowledge base (POST /public/chatbot/messages). */
@Component({
  selector: 'app-portal-chatbot-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TranslatePipe,
    PageHeaderComponent,
    PortalUnavailableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-chatbot.page.html',
  styleUrl: './portal-chatbot.page.scss',
})
export class PortalChatbotPage {
  private readonly api = inject(PortalPublicApi);
  private readonly branding = inject(BrandingService);
  private readonly portal = inject(PortalAuthService);
  private readonly translations = inject(TranslationService);
  private readonly fb = inject(NonNullableFormBuilder);
  private nextId = 1;

  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');

  /** The server said the chatbot is off or has no AI provider (the cached features were stale). */
  private readonly serverUnavailable = signal(false);
  readonly enabled = computed(() => this.branding.isEnabled(FeatureFlags.chatbot) && !this.serverUnavailable());
  readonly liveChatEnabled = computed(() => this.branding.isEnabled(FeatureFlags.liveChat));
  readonly webFormEnabled = computed(() => this.branding.isEnabled(FeatureFlags.webForm));
  readonly signedIn = this.portal.isAuthenticated;
  readonly entries = signal<BotEntry[]>([]);
  readonly thinking = signal(false);

  readonly form = this.fb.group({
    content: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  constructor() {
    afterRenderEffect(() => {
      this.entries();
      this.thinking();
      const element = this.thread()?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }

  ask(): void {
    const content = this.form.getRawValue().content.trim();
    if (!content || this.form.invalid || this.thinking()) {
      return;
    }
    this.form.reset();
    this.entries.update((list) => [...list, this.entry('user', content)]);
    this.send();
  }

  askSuggestion(key: string): void {
    this.form.setValue({ content: this.translations.t(key) });
    this.ask();
  }

  /** Re-sends the conversation after a failed answer. */
  retry(): void {
    this.entries.update((list) => list.filter((e) => !e.failed));
    this.send();
  }

  reset(): void {
    this.entries.set([]);
    this.form.reset();
  }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.ask();
    }
  }

  private send(): void {
    const turns: ChatbotTurn[] = this.entries()
      .filter((e) => !e.failed)
      .map((e) => ({ role: e.role, content: e.content.slice(0, 2000) }));
    // The request must end with the user's turn and hold at most 20 turns.
    const recent = turns.slice(-MAX_TURNS);
    while (recent.length && recent[0].role !== 'user') {
      recent.shift();
    }
    if (!recent.length || recent[recent.length - 1].role !== 'user') {
      return;
    }
    this.thinking.set(true);
    this.api.chatbot(recent, this.translations.language()).subscribe({
      next: (response) => {
        this.thinking.set(false);
        this.entries.update((list) => [...list, { ...this.entry('assistant', response.answer), sources: response.sources, handoff: response.handoff }]);
      },
      error: (error: unknown) => {
        this.thinking.set(false);
        const apiError = ApiError.from(error);
        // Provider removed or toggle turned off since the features were loaded: show the unavailable view, not server text.
        if (apiError.hasCode('AI_NOT_CONFIGURED') || apiError.hasCode('FEATURE_DISABLED')) {
          this.serverUnavailable.set(true);
          return;
        }
        const message = describeError(apiError, this.translations);
        this.entries.update((list) => [...list, { ...this.entry('assistant', message), failed: true, handoff: true }]);
      },
    });
  }

  private entry(role: 'user' | 'assistant', content: string): BotEntry {
    return { id: this.nextId++, role, content, sources: [], handoff: false, failed: false };
  }
}
