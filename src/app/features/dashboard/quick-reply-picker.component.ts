import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { DashboardApi } from './dashboard.api';
import { QuickReply } from './dashboard.models';

const POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
];

/**
 * Quick reply picker (story FE-06). Contract used by the ticket and chat reply boxes:
 * `<app-quick-reply-picker [ticketId]="id" (selected)="insert($event)" />` emits the reply body text
 * with placeholders filled (`POST /quick-replies/{id}/render`, which also counts the use).
 */
@Component({
  selector: 'app-quick-reply-picker',
  imports: [ReactiveFormsModule, CdkConnectedOverlay, CdkOverlayOrigin, MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      mat-icon-button
      type="button"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      [disabled]="disabled()"
      (click)="toggle()"
      [matTooltip]="'dashboard.picker.open' | t"
      [attr.aria-label]="'dashboard.picker.open' | t"
      [attr.aria-expanded]="open()"
      aria-haspopup="listbox"
    >
      <mat-icon>quickreply</mat-icon>
    </button>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayHasBackdrop]="true"
      cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
      (backdropClick)="close()"
      (detach)="close()"
      (overlayKeydown)="onOverlayKey($event)"
    >
      <div class="picker" role="dialog" [attr.dir]="translations.direction()" [attr.aria-label]="'dashboard.picker.title' | t">
        <div class="picker__search">
          <mat-icon aria-hidden="true">search</mat-icon>
          <input
            #searchInput
            [formControl]="search"
            [placeholder]="'dashboard.picker.search' | t"
            [attr.aria-label]="'dashboard.picker.search' | t"
            (keydown.enter)="$event.preventDefault(); pickFirst()"
          />
        </div>
        <div class="picker__progress">
          @if (loading() || rendering()) {
            <mat-progress-bar mode="indeterminate" />
          }
        </div>
        <ul class="picker__list" role="listbox">
          @for (reply of replies(); track reply.id) {
            <li role="option" [attr.aria-selected]="false">
              <button type="button" class="picker__item" (click)="pick(reply)" [disabled]="rendering()">
                <span class="picker__title">
                  {{ reply.title }}
                  @if (reply.shortcut) {
                    <code dir="ltr">{{ reply.shortcut }}</code>
                  }
                  @if (reply.shared) {
                    <mat-icon class="picker__shared" [attr.aria-label]="'dashboard.quickReplies.shared' | t">groups</mat-icon>
                  }
                </span>
                <span class="picker__body">{{ reply.body }}</span>
              </button>
            </li>
          } @empty {
            @if (!loading()) {
              <li class="picker__empty">{{ (failed() ? 'dashboard.picker.error' : 'dashboard.picker.empty') | t }}</li>
            }
          }
        </ul>
      </div>
    </ng-template>
  `,
  styles: `
    :host { display: inline-block; }
    .picker {
      width: min(360px, 92vw); max-height: 420px; display: flex; flex-direction: column;
      background: var(--mat-sys-surface-container); color: var(--mat-sys-on-surface);
      border-radius: 12px; box-shadow: var(--mat-sys-level3); overflow: hidden;
    }
    .picker__search { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .picker__search mat-icon { color: var(--mat-sys-on-surface-variant); }
    .picker__search input { flex: 1 1 auto; min-width: 0; border: 0; outline: 0; background: transparent; color: inherit; font: var(--mat-sys-body-large); }
    .picker__progress { height: 4px; }
    .picker__list { list-style: none; margin: 0; padding: 4px 0; overflow-y: auto; }
    .picker__item {
      display: flex; flex-direction: column; gap: 2px; width: 100%; padding: 8px 12px; border: 0; background: transparent;
      color: inherit; text-align: start; cursor: pointer; font: inherit;
    }
    .picker__item:hover, .picker__item:focus-visible { background: var(--mat-sys-surface-container-highest); outline: 0; }
    .picker__title { display: flex; align-items: center; gap: 6px; font: var(--mat-sys-title-small); }
    .picker__title code { padding: 0 4px; border-radius: 4px; background: var(--mat-sys-surface-container-high); font-size: 11px; }
    .picker__shared { font-size: 16px; width: 16px; height: 16px; color: var(--mat-sys-primary); }
    .picker__body { font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .picker__empty { padding: 16px 12px; text-align: center; color: var(--mat-sys-on-surface-variant); }
  `,
})
export class QuickReplyPickerComponent {
  protected readonly translations = inject(TranslationService);
  private readonly api = inject(DashboardApi);

  /** Ticket whose data fills the placeholders (`{{customer.name}}`, `{{ticket.number}}`, ...). */
  readonly ticketId = input<string | null>(null);
  readonly disabled = input(false);
  readonly selected = output<string>();

  readonly positions = POSITIONS;
  readonly open = signal(false);
  readonly loading = signal(false);
  readonly rendering = signal(false);
  readonly failed = signal(false);
  readonly replies = signal<QuickReply[]>([]);
  readonly search = inject(NonNullableFormBuilder).control('');

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly queries = new Subject<string>();

  constructor() {
    // Used inside other features' pages, so load our own translations.
    void this.translations.load('dashboard');

    this.queries
      .pipe(
        debounceTime(200),
        tap(() => {
          this.loading.set(true);
          this.failed.set(false);
        }),
        switchMap((query) =>
          this.api.quickReplies(query || null, { silent: true }).pipe(
            catchError(() => {
              this.failed.set(true);
              return of([] as QuickReply[]);
            }),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((items) => {
        this.replies.set(items);
        this.loading.set(false);
      });

    this.search.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => this.queries.next(value.trim()));
  }

  toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.open.set(true);
    this.search.setValue('', { emitEvent: false });
    this.queries.next('');
    setTimeout(() => this.searchInput()?.nativeElement.focus());
  }

  close(): void {
    this.open.set(false);
  }

  onOverlayKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  pickFirst(): void {
    const first = this.replies()[0];
    if (first) {
      this.pick(first);
    }
  }

  pick(reply: QuickReply): void {
    if (this.rendering()) {
      return;
    }
    this.rendering.set(true);
    this.api.renderQuickReply(reply.id, this.ticketId()).subscribe({
      next: (rendered) => this.finish(rendered?.body ?? reply.body),
      // Never block the agent: fall back to the raw text.
      error: () => this.finish(reply.body),
    });
  }

  private finish(body: string): void {
    this.rendering.set(false);
    this.close();
    this.selected.emit(body);
  }
}
