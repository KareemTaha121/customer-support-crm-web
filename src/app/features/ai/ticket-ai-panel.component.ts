import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Category/priority proposed by the AI categorize action. */
export interface AiCategorySuggestion {
  categoryId: string | null;
  priority: string | null;
}

/**
 * AI assistant panel for a ticket (story FE-09). Contract used by the ticket details page:
 * `<app-ticket-ai-panel [ticketId]="id" (replySuggested)="insert($event)" (categorySuggested)="apply($event)" />`
 * Placeholder until FE-09 is implemented: renders nothing.
 */
@Component({
  selector: 'app-ticket-ai-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class TicketAiPanelComponent {
  readonly ticketId = input.required<string>();
  readonly replySuggested = output<string>();
  readonly categorySuggested = output<AiCategorySuggestion>();
}
