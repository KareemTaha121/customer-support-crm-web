import { Routes } from '@angular/router';
import { requirePermission } from '../../core/guards/auth.guards';
import { translationResolver } from '../../core/localization/translation.resolver';
import { Permissions } from '../../core/permissions/permissions';
import { HelpLayoutComponent } from './help/help-layout.component';

/** Staff knowledge base (`/knowledge-base`, inside the staff shell). */
export const KNOWLEDGE_BASE_ROUTES: Routes = [
  {
    path: '',
    canActivate: [requirePermission(Permissions.knowledgeView)],
    resolve: { i18n: translationResolver('kb') },
    children: [
      { path: '', loadComponent: () => import('./staff/article-list.page').then((m) => m.ArticleListPage) },
      {
        path: 'categories',
        canActivate: [requirePermission(Permissions.knowledgeManage)],
        loadComponent: () => import('./staff/categories.page').then((m) => m.CategoriesPage),
      },
      {
        path: 'new',
        canActivate: [requirePermission(Permissions.knowledgeManage)],
        loadComponent: () => import('./staff/article-editor.page').then((m) => m.ArticleEditorPage),
      },
      // Deep link used by the AI panel (features/ai knowledgeArticleLink → /knowledge-base/articles/{id}).
      { path: 'articles/:id', loadComponent: () => import('./staff/article-editor.page').then((m) => m.ArticleEditorPage) },
      { path: ':id', loadComponent: () => import('./staff/article-editor.page').then((m) => m.ArticleEditorPage) },
    ],
  },
];

/** Public help center (`/help`, anonymous, own layout outside the staff shell). */
export const HELP_CENTER_ROUTES: Routes = [
  {
    path: '',
    component: HelpLayoutComponent,
    resolve: { i18n: translationResolver('kb') },
    children: [
      { path: '', loadComponent: () => import('./help/help-home.page').then((m) => m.HelpHomePage) },
      { path: 'categories/:id', loadComponent: () => import('./help/help-category.page').then((m) => m.HelpCategoryPage) },
      { path: 'articles/:slug', loadComponent: () => import('./help/help-article.page').then((m) => m.HelpArticlePage) },
      { path: '**', redirectTo: '' },
    ],
  },
];
