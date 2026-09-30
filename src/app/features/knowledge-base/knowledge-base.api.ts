import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, RequestOptions } from '../../core/http/api.service';
import { Paged } from '../../core/http/api.models';
import {
  ArticleAction,
  KbArticle,
  KbArticleListItem,
  KbArticleQuery,
  KbArticleRequest,
  KbCategory,
  KbCategoryRequest,
  KbPublicArticleQuery,
} from './knowledge-base.models';

/** Knowledge base endpoints (Application/Features/KnowledgeBase/KnowledgeBaseSlices.cs). */
@Injectable({ providedIn: 'root' })
export class KnowledgeBaseApi {
  private readonly api = inject(ApiService);

  // ---------- Staff ----------

  categories(): Observable<KbCategory[]> {
    return this.api.get<KbCategory[]>('/kb/categories');
  }

  saveCategory(id: string | null, request: KbCategoryRequest, options?: RequestOptions): Observable<KbCategory> {
    return id ? this.api.put<KbCategory>(`/kb/categories/${id}`, request, options) : this.api.post<KbCategory>('/kb/categories', request, options);
  }

  deleteCategory(id: string): Observable<null> {
    return this.api.delete(`/kb/categories/${id}`);
  }

  articles(query: KbArticleQuery): Observable<Paged<KbArticleListItem>> {
    return this.api.getPaged<KbArticleListItem>('/kb/articles', { params: { ...query } });
  }

  article(id: string, options?: RequestOptions): Observable<KbArticle> {
    return this.api.get<KbArticle>(`/kb/articles/${id}`, options);
  }

  saveArticle(id: string | null, request: KbArticleRequest, options?: RequestOptions): Observable<KbArticle> {
    return id ? this.api.put<KbArticle>(`/kb/articles/${id}`, request, options) : this.api.post<KbArticle>('/kb/articles', request, options);
  }

  changeStatus(id: string, action: ArticleAction): Observable<KbArticle> {
    return this.api.post<KbArticle>(`/kb/articles/${id}/${action}`);
  }

  deleteArticle(id: string): Observable<null> {
    return this.api.delete(`/kb/articles/${id}`);
  }

  // ---------- Public (anonymous) ----------

  publicCategories(): Observable<KbCategory[]> {
    return this.api.get<KbCategory[]>('/public/kb/categories', { anonymous: true, silent: true });
  }

  publicArticles(query: KbPublicArticleQuery): Observable<Paged<KbArticleListItem>> {
    return this.api.getPaged<KbArticleListItem>('/public/kb/articles', { anonymous: true, silent: true, params: { ...query } });
  }

  publicArticle(slug: string): Observable<KbArticle> {
    return this.api.get<KbArticle>(`/public/kb/articles/${encodeURIComponent(slug)}`, { anonymous: true, silent: true });
  }

  feedback(id: string, helpful: boolean): Observable<null> {
    return this.api.post<null>(`/public/kb/articles/${id}/feedback`, { helpful }, { anonymous: true, silent: true });
  }
}
