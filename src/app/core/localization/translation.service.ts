import { DOCUMENT } from '@angular/common';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Language, SUPPORTED_LANGUAGES } from '../config/app-config';

type Dictionary = Record<string, string>;
type TranslationTree = { [key: string]: string | TranslationTree };

const STORAGE_KEY = 'crm.language';

/**
 * Runtime en/ar translations. Each feature ships `public/i18n/<scope>/<lang>.json`; keys are
 * addressed as `<scope>.<path>` (e.g. `tickets.list.title`). `core` is loaded at startup,
 * feature scopes by their routes via `translationResolver('<scope>')`.
 *
 * Placeholders use `{{name}}` and are filled from the `params` argument.
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  // HttpBackend bypasses the interceptors: translation files are static assets.
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly document = inject(DOCUMENT);

  private readonly dictionary = signal<Dictionary>({});
  private readonly loadedScopes = new Set<string>();
  private readonly pending = new Map<string, Promise<void>>();

  readonly language = signal<Language>(this.initialLanguage());
  readonly direction = computed(() => (this.language() === 'ar' ? 'rtl' : 'ltr'));
  readonly isRtl = computed(() => this.direction() === 'rtl');

  /** Loads the given scopes for the current language (cached). */
  load(...scopes: string[]): Promise<void> {
    return Promise.all(scopes.map((scope) => this.loadScope(scope, this.language()))).then(() => undefined);
  }

  async setLanguage(language: Language): Promise<void> {
    if (language === this.language()) {
      return;
    }
    const scopes = [...this.loadedScopes];
    this.loadedScopes.clear();
    this.pending.clear();
    const next: Dictionary = {};
    await Promise.all(scopes.map(async (scope) => Object.assign(next, await this.fetch(scope, language))));
    for (const scope of scopes) {
      this.loadedScopes.add(scope);
    }
    this.dictionary.set(next);
    this.language.set(language);
    this.applyDocumentLanguage();
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore
    }
  }

  /** Translates `key`; returns the key itself when missing so gaps are visible. */
  translate(key: string, params?: Record<string, string | number | null | undefined>): string {
    const value = this.dictionary()[key] ?? key;
    return params ? value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => String(params[name] ?? '')) : value;
  }

  /** Alias of {@link translate} for component code. */
  t(key: string, params?: Record<string, string | number | null | undefined>): string {
    return this.translate(key, params);
  }

  has(key: string): boolean {
    return key in this.dictionary();
  }

  applyDocumentLanguage(): void {
    const html = this.document.documentElement;
    html.lang = this.language();
    html.dir = this.direction();
  }

  private async loadScope(scope: string, language: Language): Promise<void> {
    if (this.loadedScopes.has(scope)) {
      return;
    }
    let task = this.pending.get(scope);
    if (!task) {
      task = this.fetch(scope, language).then((entries) => {
        if (language === this.language()) {
          this.dictionary.update((current) => ({ ...current, ...entries }));
          this.loadedScopes.add(scope);
        }
        this.pending.delete(scope);
      });
      this.pending.set(scope, task);
    }
    return task;
  }

  private async fetch(scope: string, language: Language): Promise<Dictionary> {
    try {
      const tree = await firstValueFrom(this.http.get<TranslationTree>(`i18n/${scope}/${language}.json`));
      return flatten(tree, scope);
    } catch {
      console.warn(`Missing translations: i18n/${scope}/${language}.json`);
      return {};
    }
  }

  private initialLanguage(): Language {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
        return stored as Language;
      }
    } catch {
      // ignore
    }
    return navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  }
}

function flatten(tree: TranslationTree, prefix: string, into: Dictionary = {}): Dictionary {
  for (const [key, value] of Object.entries(tree)) {
    const path = `${prefix}.${key}`;
    if (typeof value === 'string') {
      into[path] = value;
    } else {
      flatten(value, path, into);
    }
  }
  return into;
}
