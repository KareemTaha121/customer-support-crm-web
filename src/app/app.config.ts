import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { routes } from './app.routes';
import { BrandingService } from './core/branding/branding.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { requestHeadersInterceptor } from './core/interceptors/request-headers.interceptor';
import { LocalizedPaginatorIntl } from './core/localization/paginator-intl';
import { TranslationService } from './core/localization/translation.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
    ),
    // Order matters: headers first, then auth (token/refresh), then the global error toast.
    provideHttpClient(withInterceptors([requestHeadersInterceptor, authInterceptor, errorInterceptor])),
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline', subscriptSizing: 'dynamic' } },
    { provide: MatPaginatorIntl, useClass: LocalizedPaginatorIntl },
    provideAppInitializer(async () => {
      const translations = inject(TranslationService);
      const branding = inject(BrandingService);
      translations.applyDocumentLanguage();
      // The staff session is restored lazily by authGuard/guestGuard (refresh cookie).
      await Promise.all([translations.load('core'), branding.load()]);
    }),
  ],
};
