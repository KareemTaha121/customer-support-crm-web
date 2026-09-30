import { ChangeDetectionStrategy, Component, WritableSignal, computed, inject, input, linkedSignal, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { BrandingService } from '../../core/branding/branding.service';
import { FeatureFlags } from '../../core/branding/feature-flags';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { PermissionService } from '../../core/permissions/permission.service';
import { Permissions } from '../../core/permissions/permissions';
import { AiApi } from './ai.api';
import { describeAiError } from './ai-errors';
import { AiFeedbackComponent } from './ai-feedback.component';
import { AI_TONES, AiTone, Categorization, SolutionSuggestions, SuggestedReply, TicketSummary, knowledgeArticleLink } from './ai.models';
import { AiStatusService } from './ai-status.service';

/** Category/priority proposed by the AI categorize action. */
export interface AiCategorySuggestion {
  categoryId: string | null;
  priority: string | null;
  /** Display name of the suggested category (null when none fits). */
  categoryName?: string | null;
  /** Suggested tags (lowercase). */
  tags?: string[];
}

interface ActionState<T> {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: T | null;
  error: string | null;
}

function idle<T>(): ActionState<T> {
  return { status: 'idle', data: null, error: null };
}

const SENTIMENT_PILL: Record<string, string> = {
  positive: 'crm-pill--success',
  neutral: 'crm-pill--info',
  negative: 'crm-pill--warning',
  frustrated: 'crm-pill--danger',
};

const PRIORITY_PILL: Record<string, string> = {
  Low: 'crm-pill--info',
  Medium: 'crm-pill--primary',
  High: 'crm-pill--warning',
  Urgent: 'crm-pill--danger',
};

/**
 * AI assistant panel for a ticket (story FE-09). Contract used by the ticket details page:
 * `<app-ticket-ai-panel [ticketId]="id" (replySuggested)="insert($event)" (categorySuggested)="apply($event)" />`
 *
 * Renders nothing unless the user holds `ai.use` and `GET /ai/status` reports AI as available.
 * Results are suggestions only: the ticket page decides what to do with "Insert" and "Apply".
 */
@Component({
  selector: 'app-ticket-ai-panel',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    TranslatePipe,
    AiFeedbackComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-ai-panel.component.html',
  styleUrl: './ticket-ai-panel.component.scss',
})
export class TicketAiPanelComponent {
  private readonly api = inject(AiApi);
  private readonly status = inject(AiStatusService);
  private readonly permissions = inject(PermissionService);
  private readonly branding = inject(BrandingService);
  private readonly translations = inject(TranslationService);

  readonly ticketId = input.required<string>();
  /** Show the "Insert" button on suggested replies (hide for read-only users). */
  readonly canInsertReply = input(true);
  /** Show the "Apply" button on categorization (hide for users who cannot update tickets). */
  readonly canApplyCategory = input(true);

  readonly replySuggested = output<string>();
  readonly categorySuggested = output<AiCategorySuggestion>();

  readonly tones = AI_TONES;
  readonly articleLink = knowledgeArticleLink;

  readonly visible = computed(
    () =>
      this.permissions.has(Permissions.aiUse) &&
      this.status.enabled() === true &&
      (this.branding.features()[FeatureFlags.aiAgentAssist] ?? '').toLowerCase() !== 'false',
  );

  readonly summary = linkedSignal<string, ActionState<TicketSummary>>({ source: this.ticketId, computation: () => idle() });
  readonly reply = linkedSignal<string, ActionState<SuggestedReply>>({ source: this.ticketId, computation: () => idle() });
  readonly category = linkedSignal<string, ActionState<Categorization>>({ source: this.ticketId, computation: () => idle() });
  readonly solutions = linkedSignal<string, ActionState<SolutionSuggestions>>({ source: this.ticketId, computation: () => idle() });

  readonly replyForm = inject(NonNullableFormBuilder).group({
    tone: ['friendly' as AiTone],
    instructions: ['', [Validators.maxLength(1000)]],
  });

  readonly confidencePercent = computed(() => {
    const data = this.category().data;
    return data ? Math.round(Math.min(1, Math.max(0, data.confidence)) * 100) : 0;
  });

  constructor() {
    void this.translations.load('ai');
    this.status.ensureLoaded();
  }

  runSummary(): void {
    this.run(this.summary, (id) => this.api.summarize(id));
  }

  runReply(): void {
    if (this.replyForm.invalid) {
      this.replyForm.markAllAsTouched();
      return;
    }
    const { tone, instructions } = this.replyForm.getRawValue();
    const text = instructions.trim();
    this.run(this.reply, (id) => this.api.suggestReply(id, { tone, instructions: text ? text : null }));
  }

  runCategorize(): void {
    this.run(this.category, (id) => this.api.categorize(id));
  }

  runSolutions(): void {
    this.run(this.solutions, (id) => this.api.solutions(id));
  }

  insertReply(): void {
    const data = this.reply().data;
    if (data?.reply) {
      this.replySuggested.emit(data.reply);
    }
  }

  applyCategory(): void {
    const data = this.category().data;
    if (data) {
      this.categorySuggested.emit({
        categoryId: data.categoryId,
        priority: data.priority,
        categoryName: data.categoryName,
        tags: [...data.tags],
      });
    }
  }

  sentimentClass(sentiment: string): string {
    return SENTIMENT_PILL[sentiment] ?? 'crm-pill--info';
  }

  priorityClass(priority: string): string {
    return PRIORITY_PILL[priority] ?? 'crm-pill--primary';
  }

  /** Translated label for a server value, falling back to the raw value when unknown. */
  label(prefix: string, value: string): string {
    const key = `${prefix}.${value}`;
    return this.translations.has(key) ? this.translations.t(key) : value;
  }

  private run<T>(state: WritableSignal<ActionState<T>>, call: (ticketId: string) => Observable<T>): void {
    if (state().status === 'loading') {
      return;
    }
    const id = this.ticketId();
    state.set({ status: 'loading', data: state().data, error: null });
    call(id).subscribe({
      next: (data) => {
        if (id === this.ticketId()) {
          state.set({ status: 'ready', data, error: null });
        }
      },
      error: (error: unknown) => {
        if (id === this.ticketId()) {
          state.set({ status: 'error', data: null, error: describeAiError(error, this.translations) });
        }
      },
    });
  }
}
