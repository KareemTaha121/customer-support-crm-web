import { Injectable, effect, inject, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Observable, Subject, filter, firstValueFrom, map, share } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_ORIGIN } from '../config/app-config';

/** Event names pushed by the API (Application/Abstractions/Notifications/IRealtimeNotifier.cs). */
export const RealtimeEvents = {
  notificationCreated: 'notificationCreated',
  chatMessage: 'chatMessage',
  chatUpdated: 'chatUpdated',
  ticketUpdated: 'ticketUpdated',
} as const;

interface HubMessage {
  event: string;
  payload: unknown;
}

/**
 * The staff SignalR connection (`/hubs/staff`). Connects while a staff user is signed in and
 * reconnects automatically. Clients only listen; actions go through the HTTP API.
 * `hub.on<ChatMessage>(RealtimeEvents.chatMessage).subscribe(...)`.
 */
@Injectable({ providedIn: 'root' })
export class StaffHubService {
  private readonly auth = inject(AuthService);
  private readonly messages = new Subject<HubMessage>();
  private readonly subscribed = new Set<string>();
  private connection: HubConnection | null = null;

  readonly state = signal<HubConnectionState>(HubConnectionState.Disconnected);

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        void this.start();
      } else {
        void this.stop();
      }
    });
  }

  on<T>(event: string): Observable<T> {
    this.listen(event);
    return this.messages.pipe(
      filter((m) => m.event === event),
      map((m) => m.payload as T),
      share(),
    );
  }

  /** Invokes a hub method (e.g. `JoinConversation`) once connected. */
  async invoke(method: string, ...args: unknown[]): Promise<void> {
    await this.ready();
    if (this.connection?.state === HubConnectionState.Connected) {
      await this.connection.invoke(method, ...args);
    }
  }

  private async ready(): Promise<void> {
    if (this.connection?.state === HubConnectionState.Connected) {
      return;
    }
    const state$ = new Observable<HubConnectionState>((subscriber) => {
      const id = setInterval(() => {
        subscriber.next(this.connection?.state ?? HubConnectionState.Disconnected);
      }, 250);
      return () => clearInterval(id);
    });
    await Promise.race([
      firstValueFrom(state$.pipe(filter((s) => s === HubConnectionState.Connected))),
      new Promise((resolve) => setTimeout(resolve, 10000)),
    ]);
  }

  private listen(event: string): void {
    if (this.subscribed.has(event)) {
      return;
    }
    this.subscribed.add(event);
    this.connection?.on(event, (payload: unknown) => this.messages.next({ event, payload }));
  }

  private async start(): Promise<void> {
    if (this.connection) {
      return;
    }
    const connection = new HubConnectionBuilder()
      .withUrl(`${API_ORIGIN}/hubs/staff`, {
        accessTokenFactory: async () => {
          if (this.auth.isTokenExpiring()) {
            try {
              return await firstValueFrom(this.auth.refresh());
            } catch {
              return '';
            }
          }
          return this.auth.accessToken ?? '';
        },
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    for (const event of this.subscribed) {
      connection.on(event, (payload: unknown) => this.messages.next({ event, payload }));
    }
    connection.onreconnecting(() => this.state.set(HubConnectionState.Reconnecting));
    connection.onreconnected(() => this.state.set(HubConnectionState.Connected));
    connection.onclose(() => this.state.set(HubConnectionState.Disconnected));
    this.connection = connection;

    try {
      await connection.start();
      this.state.set(HubConnectionState.Connected);
    } catch (error) {
      console.warn('Realtime connection failed; retrying in 15s', error);
      this.state.set(HubConnectionState.Disconnected);
      if (this.connection === connection) {
        this.connection = null;
        setTimeout(() => {
          if (this.auth.isAuthenticated()) {
            void this.start();
          }
        }, 15000);
      }
    }
  }

  private async stop(): Promise<void> {
    const connection = this.connection;
    this.connection = null;
    if (connection) {
      await connection.stop().catch(() => undefined);
    }
    this.state.set(HubConnectionState.Disconnected);
  }
}
