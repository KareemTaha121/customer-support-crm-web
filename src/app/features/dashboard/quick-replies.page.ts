import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { ConfirmService } from '../../shared/confirm-dialog.component';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/state.components';
import { DashboardApi } from './dashboard.api';
import { QuickReply } from './dashboard.models';
import { QuickReplyDialogComponent, QuickReplyDialogData } from './quick-reply-dialog.component';

type Scope = 'all' | 'personal' | 'shared';

/** `/dashboard/quick-replies`: personal and shared canned responses. */
@Component({
  selector: 'app-quick-replies-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTooltipModule,
    TranslatePipe,
    PageHeaderComponent,
    LoadingComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'dashboard.quickReplies.title' | t" [subtitle]="'dashboard.quickReplies.subtitle' | t" backLink="/dashboard">
      <button mat-flat-button type="button" (click)="openDialog(null)">
        <mat-icon>add</mat-icon>{{ 'dashboard.quickReplies.new' | t }}
      </button>
    </app-page-header>

    <div class="crm-toolbar">
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>{{ 'core.actions.search' | t }}</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [formControl]="search" [placeholder]="'dashboard.quickReplies.searchHint' | t" />
      </mat-form-field>
      <mat-button-toggle-group [value]="scope()" (change)="scope.set($event.value)" [attr.aria-label]="'core.actions.filter' | t" hideSingleSelectionIndicator>
        @for (option of scopes; track option) {
          <mat-button-toggle [value]="option">{{ 'dashboard.quickReplies.scopes.' + option | t }}</mat-button-toggle>
        }
      </mat-button-toggle-group>
    </div>

    @if (loading()) {
      <app-loading />
    } @else if (error()) {
      <app-error-state [message]="error()" (retry)="load()" />
    } @else if (!visible().length) {
      <app-empty-state icon="quickreply" [message]="'dashboard.quickReplies.empty' | t">
        <button mat-stroked-button type="button" (click)="openDialog(null)">{{ 'dashboard.quickReplies.new' | t }}</button>
      </app-empty-state>
    } @else {
      <div class="replies">
        @for (reply of visible(); track reply.id) {
          <article class="crm-card reply">
            <header class="reply__head">
              <h2>{{ reply.title }}</h2>
              @if (reply.canEdit) {
                <button mat-icon-button type="button" (click)="openDialog(reply)" [matTooltip]="'core.actions.edit' | t" [attr.aria-label]="'core.actions.edit' | t">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button type="button" (click)="remove(reply)" [matTooltip]="'core.actions.delete' | t" [attr.aria-label]="'core.actions.delete' | t">
                  <mat-icon>delete</mat-icon>
                </button>
              }
            </header>
            <div class="reply__tags">
              @if (reply.shortcut) {
                <code dir="ltr">{{ reply.shortcut }}</code>
              }
              <span class="crm-pill" [class.crm-pill--primary]="reply.shared">
                {{ (reply.shared ? 'dashboard.quickReplies.shared' : 'dashboard.quickReplies.personal') | t }}
              </span>
              <span class="crm-pill">{{ 'dashboard.quickReplies.languages.' + reply.language | t }}</span>
              <span class="crm-muted usage">{{ 'dashboard.quickReplies.usage' | t: { count: reply.usageCount } }}</span>
            </div>
            <p class="reply__body" [attr.dir]="reply.language === 'ar' ? 'rtl' : 'ltr'">{{ reply.body }}</p>
          </article>
        }
      </div>
    }
  `,
  styles: `
    .crm-toolbar mat-form-field { flex: 1 1 260px; }
    .replies { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
    .reply { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .reply__head { display: flex; align-items: center; gap: 4px; }
    .reply__head h2 { flex: 1 1 auto; margin: 0; font: var(--mat-sys-title-medium); overflow-wrap: anywhere; }
    .reply__tags { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .reply__tags code { padding: 2px 6px; border-radius: 6px; background: var(--mat-sys-surface-container-high); font-size: 12px; }
    .usage { font: var(--mat-sys-body-small); margin-inline-start: auto; }
    .reply__body {
      margin: 0; white-space: pre-line; overflow-wrap: anywhere; color: var(--mat-sys-on-surface-variant);
      display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden;
    }
  `,
})
export class QuickRepliesPage {
  private readonly api = inject(DashboardApi);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly scopes: readonly Scope[] = ['all', 'personal', 'shared'];
  readonly scope = signal<Scope>('all');
  readonly replies = signal<QuickReply[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly search = inject(NonNullableFormBuilder).control('');

  readonly visible = computed(() => {
    const scope = this.scope();
    const replies = this.replies();
    return scope === 'all' ? replies : replies.filter((r) => r.shared === (scope === 'shared'));
  });

  private request: Subscription | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.load();
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(destroyRef))
      .subscribe(() => this.load());
    destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.api.quickReplies(this.search.value.trim() || null, { silent: true }).subscribe({
      next: (replies) => {
        this.replies.set(replies);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(describeError(ApiError.from(error), this.translations));
      },
    });
  }

  openDialog(reply: QuickReply | null): void {
    this.dialog
      .open<QuickReplyDialogComponent, QuickReplyDialogData, QuickReply>(QuickReplyDialogComponent, {
        data: { reply },
        width: '640px',
        maxWidth: '95vw',
        direction: this.translations.direction(),
      })
      .afterClosed()
      .pipe(filter((saved): saved is QuickReply => !!saved))
      .subscribe(() => this.load());
  }

  remove(reply: QuickReply): void {
    this.confirm
      .ask({
        title: 'dashboard.quickReplies.deleteTitle',
        message: reply.shared ? 'dashboard.quickReplies.deleteSharedMessage' : 'dashboard.quickReplies.deleteMessage',
        params: { title: reply.title },
        confirmText: 'core.actions.delete',
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.deleteQuickReply(reply.id)),
      )
      .subscribe(() => {
        this.toast.success('core.states.deleted');
        this.replies.update((items) => items.filter((r) => r.id !== reply.id));
      });
  }
}
