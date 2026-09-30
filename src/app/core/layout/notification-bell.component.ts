import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { Router } from '@angular/router';
import { ApiService } from '../http/api.service';
import { LocalizedDatePipe } from '../localization/localized-date.pipe';
import { TranslatePipe } from '../localization/translate.pipe';
import { RealtimeEvents, StaffHubService } from '../realtime/staff-hub.service';

/** Contracts/Notifications/NotificationContracts.cs */
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
  readAt: string | null;
}

interface UnreadCount {
  count: number;
}

/** Toolbar bell: unread badge, latest notifications, realtime `notificationCreated` pushes. */
@Component({
  selector: 'app-notification-bell',
  imports: [MatBadgeModule, MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule, TranslatePipe, LocalizedDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button mat-icon-button [matMenuTriggerFor]="menu" (menuOpened)="loadLatest()" [attr.aria-label]="'core.notifications.title' | t">
      <mat-icon [matBadge]="unread() > 99 ? '99+' : unread()" [matBadgeHidden]="unread() === 0" matBadgeColor="warn" matBadgeSize="small" aria-hidden="false">
        notifications
      </mat-icon>
    </button>
    <mat-menu #menu="matMenu" xPosition="before" class="crm-notification-menu">
      <div class="bell-header" (click)="$event.stopPropagation()">
        <strong>{{ 'core.notifications.title' | t }}</strong>
        @if (unread() > 0) {
          <button mat-button type="button" (click)="markAllRead()">{{ 'core.notifications.markAllRead' | t }}</button>
        }
      </div>
      <mat-divider />
      @for (item of items(); track item.id) {
        <button mat-menu-item class="bell-item" [class.bell-item--unread]="!item.readAt" (click)="open(item)">
          <span class="bell-item__title">{{ item.title }}</span>
          @if (item.body) {
            <span class="bell-item__body">{{ item.body }}</span>
          }
          <span class="bell-item__time">{{ item.createdAt | localDate: 'relative' }}</span>
        </button>
      } @empty {
        <p class="bell-empty">{{ 'core.notifications.empty' | t }}</p>
      }
    </mat-menu>
  `,
  styles: `
    .bell-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 16px; min-width: 300px; }
    .bell-empty { padding: 16px; margin: 0; color: var(--mat-sys-on-surface-variant); }
  `,
})
export class NotificationBellComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly hub = inject(StaffHubService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly unread = signal(0);
  readonly items = signal<NotificationItem[]>([]);

  ngOnInit(): void {
    this.refreshCount();
    this.hub
      .on<NotificationItem>(RealtimeEvents.notificationCreated)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((notification) => {
        this.unread.update((n) => n + 1);
        this.items.update((list) => [notification, ...list.filter((n) => n.id !== notification.id)].slice(0, 10));
      });
  }

  loadLatest(): void {
    this.api
      .getPaged<NotificationItem>('/notifications', { params: { page: 1, pageSize: 10 }, silent: true })
      .subscribe({ next: (page) => this.items.set(page.items), error: () => undefined });
    this.refreshCount();
  }

  open(item: NotificationItem): void {
    if (!item.readAt) {
      this.api.post<UnreadCount>(`/notifications/${item.id}/read`, {}, { silent: true }).subscribe({
        next: (result) => {
          this.unread.set(result.count);
          this.items.update((list) => list.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
        },
        error: () => undefined,
      });
    }
    if (item.link) {
      void this.router.navigateByUrl(item.link);
    }
  }

  markAllRead(): void {
    this.api.post<UnreadCount>('/notifications/read-all', {}).subscribe((result) => {
      this.unread.set(result.count);
      const now = new Date().toISOString();
      this.items.update((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    });
  }

  private refreshCount(): void {
    this.api.get<UnreadCount>('/notifications/unread-count', { silent: true }).subscribe({
      next: (result) => this.unread.set(result.count),
      error: () => undefined,
    });
  }
}
