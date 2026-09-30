/** DTOs mirrored from customer-support-crm-api/src/CustomerSupportCrm.Contracts/Ai/AiContracts.cs. */

export const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

export type AiTone = 'friendly' | 'formal' | 'empathetic';
export const AI_TONES: readonly AiTone[] = ['friendly', 'formal', 'empathetic'];

export type AiSentiment = 'positive' | 'neutral' | 'negative' | 'frustrated';

export type AiPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface AiStatus {
  enabled: boolean;
}

export interface TicketSummary {
  suggestionId: string;
  summary: string;
  keyPoints: string[];
  sentiment: AiSentiment | string;
  nextStep: string | null;
}

export interface SuggestReplyRequest {
  tone: AiTone | null;
  instructions: string | null;
}

export interface SuggestedReply {
  suggestionId: string;
  reply: string;
  /** `en` or `ar`: the customer's preferred language the reply is written in. */
  language: string;
  usedArticleIds: string[];
}

export interface Categorization {
  suggestionId: string;
  categoryId: string | null;
  categoryName: string | null;
  priority: AiPriority | string;
  tags: string[];
  /** 0 to 1. */
  confidence: number;
  reasoning: string;
}

export interface SolutionSuggestion {
  articleId: string;
  title: string;
  slug: string;
  reason: string;
}

export interface SolutionSuggestions {
  /** Empty GUID when there were no knowledge base candidates (nothing to rate). */
  suggestionId: string;
  solutions: SolutionSuggestion[];
}

export interface AiFeedbackRequest {
  accepted: boolean;
}

/** Staff knowledge base article route (owned by the knowledge base story). */
export function knowledgeArticleLink(articleId: string): string[] {
  return ['/knowledge-base', 'articles', articleId];
}
