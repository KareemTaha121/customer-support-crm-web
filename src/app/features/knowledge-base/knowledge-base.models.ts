/** Domain/KnowledgeBase/KnowledgeArticle.cs ArticleType */
export const ARTICLE_TYPES = ['Faq', 'Article', 'Guide', 'Solution'] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

/** Domain/KnowledgeBase/KnowledgeArticle.cs ArticleStatus */
export const ARTICLE_STATUSES = ['Draft', 'Published', 'Archived'] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

/** Domain/KnowledgeBase/KnowledgeArticle.cs ArticleVisibility */
export const ARTICLE_VISIBILITIES = ['Public', 'Internal'] as const;
export type ArticleVisibility = (typeof ARTICLE_VISIBILITIES)[number];

export const KB_LANGUAGES = ['en', 'ar'] as const;
export type KbLanguage = (typeof KB_LANGUAGES)[number];

/** Status change actions (`POST /kb/articles/{id}/{action}`). */
export type ArticleAction = 'publish' | 'unpublish' | 'archive' | 'restore';

/** Application/Features/KnowledgeBase/KnowledgeBaseSlices.cs KnowledgeErrors */
export const KbErrorCodes = {
  articleNotFound: 'ARTICLE_NOT_FOUND',
  categoryNotFound: 'KB_CATEGORY_NOT_FOUND',
  slugTaken: 'ARTICLE_SLUG_TAKEN',
  categoryInUse: 'KB_CATEGORY_IN_USE',
} as const;

/** Contracts/KnowledgeBase KnowledgeCategoryRequest */
export interface KbCategoryRequest {
  name: string;
  nameAr: string | null;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isPublic: boolean;
}

/** Contracts/KnowledgeBase KnowledgeCategoryResponse */
export interface KbCategory extends KbCategoryRequest {
  id: string;
  articleCount: number;
}

/** Contracts/KnowledgeBase KnowledgeArticleRequest */
export interface KbArticleRequest {
  title: string;
  slug: string | null;
  summary: string | null;
  /** Markdown. */
  body: string;
  type: ArticleType;
  language: KbLanguage;
  categoryId: string | null;
  tags: string[] | null;
  visibility: ArticleVisibility;
  translationOfId: string | null;
}

/** Contracts/KnowledgeBase KnowledgeArticleListItemResponse */
export interface KbArticleListItem {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  type: ArticleType;
  language: string;
  categoryId: string | null;
  categoryName: string | null;
  status: ArticleStatus;
  visibility: ArticleVisibility;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  publishedAt: string | null;
  updatedAt: string | null;
}

/** Contracts/KnowledgeBase ArticleTranslationResponse */
export interface KbArticleTranslation {
  id: string;
  language: string;
  title: string;
  slug: string;
}

/** Contracts/KnowledgeBase KnowledgeArticleResponse */
export interface KbArticle {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  body: string;
  type: ArticleType;
  language: string;
  categoryId: string | null;
  categoryName: string | null;
  tags: string[];
  status: ArticleStatus;
  visibility: ArticleVisibility;
  translationOfId: string | null;
  translations: KbArticleTranslation[];
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/** `GET /kb/articles` query (ListKnowledgeArticlesQuery). */
export interface KbArticleQuery {
  page: number;
  pageSize: number;
  search?: string | null;
  status?: string | null;
  type?: string | null;
  language?: string | null;
  visibility?: string | null;
  categoryId?: string | null;
}

/** `GET /public/kb/articles` query (ListPublicArticlesQuery, pageSize ≤ 50). */
export interface KbPublicArticleQuery {
  page: number;
  pageSize: number;
  search?: string | null;
  type?: string | null;
  language?: string | null;
  categoryId?: string | null;
}

/** Category name in the UI language (Arabic name when present). */
export function categoryLabel(category: Pick<KbCategory, 'name' | 'nameAr'>, language: string): string {
  return language === 'ar' && category.nameAr ? category.nameAr : category.name;
}

export function statusPill(status: string): string {
  switch (status) {
    case 'Published':
      return 'crm-pill crm-pill--success';
    case 'Archived':
      return 'crm-pill';
    default:
      return 'crm-pill crm-pill--warning';
  }
}
