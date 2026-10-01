import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BrandingService } from '../../../core/branding/branding.service';
import { NotificationToastService } from '../../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { TranslationService } from '../../../core/localization/translation.service';
import { PageHeaderComponent } from '../../../shared/page-header.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../../shared/state.components';
import { adminErrorMessage } from '../admin-errors';
import { AdministrationApi } from '../administration.api';
import { SettingResponse, SettingsStatus } from '../administration.models';

const NUMBER_MAX = 3650;
const TEXT_MAX = 2000;
/** Settings that need an AI provider on the server. */
const AI_SETTING_KEYS = new Set(['chatbot.enabled', 'ai.agent_assist_enabled']);

/** `/admin/settings`: feature toggles and tunables, one control per `SettingResponse.kind`. */
@Component({
  selector: 'app-settings-page',
  imports: [MatSlideToggleModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslatePipe, PageHeaderComponent, LoadingComponent, EmptyStateComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../admin.scss',
  template: `
    <app-page-header [title]="'admin.settings.title' | t" [subtitle]="'admin.settings.subtitle' | t">
      <button mat-button type="button" (click)="discard()" [disabled]="!dirty() || saving()">{{ 'core.actions.reset' | t }}</button>
      <button mat-flat-button type="button" (click)="save()" [disabled]="!dirty() || invalid() || saving()">{{ 'core.actions.save' | t }}</button>
    </app-page-header>

    @if (loading()) {
      <app-loading />
    } @else if (error()) {
      <app-error-state [message]="error()" (retry)="load()" />
    } @else if (settings().length === 0) {
      <app-empty-state icon="tune" />
    } @else {
      @if (saveError(); as message) {
        <div class="admin-banner" role="alert"><mat-icon>error_outline</mat-icon><span>{{ message }}</span></div>
      }
      @if (status()?.aiProviderConfigured === false) {
        <div class="admin-banner admin-banner--info" role="status"><mat-icon>warning_amber</mat-icon><span>{{ 'admin.settings.aiMissing' | t }}</span></div>
      }
      <div class="crm-card settings">
        @for (setting of settings(); track setting.key) {
          <div class="setting">
            <div class="setting__text">
              <div class="setting__label">
                {{ label(setting.key) }}
                @if (setting.isPublic) {
                  <span class="crm-pill crm-pill--info" [matTooltip]="'admin.settings.publicHint' | t">{{ 'admin.settings.public' | t }}</span>
                }
                @if (aiKeys.has(setting.key) && status()?.aiProviderConfigured === false) {
                  <span class="crm-pill crm-pill--warning" [matTooltip]="'admin.settings.aiMissing' | t">{{ 'admin.settings.aiUnavailable' | t }}</span>
                }
              </div>
              @if (help(setting.key); as text) {
                <div class="crm-muted setting__help">{{ text }}</div>
              }
              @if (setting.key === registrationKey && values()[setting.key] === 'true' && status()?.emailConfigured === false) {
                <div class="setting__warning" role="status"><mat-icon aria-hidden="true">warning</mat-icon>{{ 'admin.settings.registrationNeedsEmail' | t }}</div>
              }
              <div class="setting__meta crm-muted">
                <span class="admin-mono" dir="ltr">{{ setting.key }}</span>
                · {{ 'admin.settings.default' | t: { value: displayDefault(setting) } }}
                @if (values()[setting.key] !== setting.defaultValue) {
                  <button mat-button type="button" class="reset" (click)="set(setting.key, setting.defaultValue)">{{ 'admin.settings.useDefault' | t }}</button>
                }
              </div>
            </div>
            <div class="setting__control">
              @switch (setting.kind) {
                @case ('Boolean') {
                  <mat-slide-toggle [checked]="values()[setting.key] === 'true'" (change)="set(setting.key, $event.checked ? 'true' : 'false')"
                    [attr.aria-label]="label(setting.key)" />
                }
                @case ('Number') {
                  <mat-form-field class="number">
                    <input matInput type="number" min="0" [max]="numberMax" step="1" dir="ltr" [value]="values()[setting.key]"
                      (input)="setFromInput(setting.key, $event)" [attr.aria-label]="label(setting.key)" />
                    @if (errors()[setting.key]) {
                      <mat-hint class="crm-danger-text">{{ 'admin.settings.numberRange' | t: { max: numberMax } }}</mat-hint>
                    }
                  </mat-form-field>
                }
                @default {
                  <mat-form-field class="text">
                    <input matInput [value]="values()[setting.key]" [attr.maxlength]="textMax" (input)="setFromInput(setting.key, $event)" [attr.aria-label]="label(setting.key)" />
                  </mat-form-field>
                }
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: `
    .settings { padding-block: 0; }
    .setting { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 24px; padding: 16px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .setting:last-child { border-bottom: 0; }
    .setting__text { flex: 1 1 320px; min-width: 0; }
    .setting__label { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font: var(--mat-sys-title-small); }
    .setting__help { margin-top: 2px; }
    .setting__warning { display: flex; align-items: center; gap: 6px; margin-top: 4px; color: var(--crm-warning); font: var(--mat-sys-body-small); }
    .setting__warning mat-icon { font-size: 18px; inline-size: 18px; block-size: 18px; flex: none; }
    .setting__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 4px; font: var(--mat-sys-body-small); }
    .reset { min-height: 28px; height: 28px; }
    .number { width: 140px; }
    .text { width: min(360px, 100%); }
    .crm-danger-text { color: var(--crm-danger); }
  `,
})
export class SettingsPage {
  private readonly api = inject(AdministrationApi);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly branding = inject(BrandingService);

  readonly numberMax = NUMBER_MAX;
  readonly textMax = TEXT_MAX;
  readonly registrationKey = 'portal.registration_enabled';
  readonly aiKeys = AI_SETTING_KEYS;
  /** Server prerequisites (AI provider, email). null = unknown (call failed): no warnings are shown. */
  readonly status = signal<SettingsStatus | null>(null);
  readonly settings = signal<SettingResponse[]>([]);
  readonly values = signal<Record<string, string>>({});
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);

  readonly changes = computed(() => {
    const values = this.values();
    const result: Record<string, string> = {};
    for (const setting of this.settings()) {
      const value = values[setting.key];
      if (value !== undefined && value !== setting.value) {
        result[setting.key] = value;
      }
    }
    return result;
  });
  readonly dirty = computed(() => Object.keys(this.changes()).length > 0);
  readonly errors = computed(() => {
    const values = this.values();
    const result: Record<string, boolean> = {};
    for (const setting of this.settings()) {
      if (setting.kind === 'Number') {
        const text = values[setting.key] ?? '';
        const n = Number(text);
        result[setting.key] = !/^\d+$/.test(text) || n < 0 || n > NUMBER_MAX;
      }
    }
    return result;
  });
  readonly invalid = computed(() => Object.values(this.errors()).some((e) => e));

  constructor() {
    this.load();
  }

  label(key: string): string {
    const k = `admin.settings.keys.${key}`;
    return this.translations.has(k) ? this.translations.t(k) : key;
  }

  help(key: string): string | null {
    const k = `admin.settings.help.${key}`;
    return this.translations.has(k) ? this.translations.t(k) : null;
  }

  displayDefault(setting: SettingResponse): string {
    if (setting.kind === 'Boolean') {
      return this.translations.t(setting.defaultValue === 'true' ? 'admin.settings.on' : 'admin.settings.off');
    }
    return setting.defaultValue || '—';
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    // Advisory only: on error keep null, so no warning and no error state.
    this.api.settingsStatus().subscribe({ next: (status) => this.status.set(status), error: () => undefined });
    this.api.listSettings().subscribe({
      next: (settings) => {
        this.apply(settings);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(adminErrorMessage(error, this.translations));
      },
    });
  }

  set(key: string, value: string): void {
    this.values.update((current) => ({ ...current, [key]: value }));
  }

  setFromInput(key: string, event: Event): void {
    this.set(key, (event.target as HTMLInputElement).value);
  }

  discard(): void {
    this.apply(this.settings());
    this.saveError.set(null);
  }

  save(): void {
    if (!this.dirty() || this.invalid() || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    this.api.updateSettings(this.changes()).subscribe({
      next: (settings) => {
        this.saving.set(false);
        this.apply(settings);
        // Public flags drive the login page and portal. Re-read them from the server, which also
        // applies server rules (no AI provider means no chatbot) that the raw setting values lack.
        void this.branding.load();
        this.toast.success('core.states.saved');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.saveError.set(adminErrorMessage(error, this.translations));
      },
    });
  }

  private apply(settings: SettingResponse[]): void {
    this.settings.set(settings);
    this.values.set(Object.fromEntries(settings.map((s) => [s.key, s.value])));
  }
}
