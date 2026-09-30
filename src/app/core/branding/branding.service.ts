import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { catchError, firstValueFrom, of } from 'rxjs';
import { apiUrl } from '../config/app-config';
import { ApiService } from '../http/api.service';

/** Contracts/Organization/OrganizationContracts.cs PublicBrandingResponse */
export interface PublicBranding {
  name: string;
  defaultCulture: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
}

/** Public feature flags (`GET /public/features`), e.g. `portal.registration_enabled` = "true". */
export type PublicFeatures = Record<string, string>;

const FALLBACK: PublicBranding = {
  name: 'Customer Support CRM',
  defaultCulture: 'en',
  primaryColor: '#1f4e79',
  accentColor: '#f39c12',
  logoUrl: null,
};

/**
 * Loads organization branding and public feature flags at startup and applies the colors to
 * the Material 3 system tokens (`--mat-sys-primary`, ...) so every component follows them.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly api = inject(ApiService);
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);

  readonly branding = signal<PublicBranding>(FALLBACK);
  readonly features = signal<PublicFeatures>({});

  async load(): Promise<void> {
    const [branding, features] = await Promise.all([
      firstValueFrom(this.api.get<PublicBranding>('/public/branding', { anonymous: true, silent: true }).pipe(catchError(() => of(null)))),
      firstValueFrom(this.api.get<PublicFeatures>('/public/features', { anonymous: true, silent: true }).pipe(catchError(() => of(null)))),
    ]);
    if (branding) {
      this.apply(branding);
    } else {
      this.apply(FALLBACK);
    }
    this.features.set(features ?? {});
  }

  /** Re-applies branding after an admin changed it. */
  apply(branding: PublicBranding): void {
    this.branding.set(branding);
    this.title.setTitle(branding.name);
    const root = this.document.documentElement.style;
    const primary = safeColor(branding.primaryColor, FALLBACK.primaryColor);
    const accent = safeColor(branding.accentColor, FALLBACK.accentColor);
    root.setProperty('--crm-brand-primary', primary);
    root.setProperty('--crm-brand-accent', accent);
    root.setProperty('--mat-sys-primary', primary);
    root.setProperty('--mat-sys-on-primary', contrastText(primary));
    root.setProperty('--mat-sys-primary-container', mix(primary, 0.85));
    root.setProperty('--mat-sys-on-primary-container', primary);
    root.setProperty('--mat-sys-tertiary', accent);
    root.setProperty('--mat-sys-on-tertiary', contrastText(accent));
  }

  /** Absolute logo URL, or null when the organization has none. */
  logoSrc(): string | null {
    const logo = this.branding().logoUrl;
    return logo ? apiUrl(logo) : null;
  }

  /** True when a public boolean flag is "true" (keys from Domain SystemSettings). */
  isEnabled(key: string): boolean {
    return (this.features()[key] ?? '').toLowerCase() === 'true';
  }
}

function safeColor(value: string | null | undefined, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function contrastText(hex: string): string {
  const [r, g, b] = rgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#1a1a1a' : '#ffffff';
}

/** Mixes the color with white (`amount` 0..1 of white). */
function mix(hex: string, amount: number): string {
  const [r, g, b] = rgb(hex).map((c) => Math.round(c + (255 - c) * amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
