# customer-support-crm-web

Frontend for the Customer Support CRM.

**Stack:** Angular 22 (standalone, zoneless, signals) · TypeScript strict · SCSS · Vitest

## Layout

| Path | Purpose |
|---|---|
| `src/app/core` | Singleton app infrastructure: auth, HTTP client & API models, guards, interceptors, permissions, config, localization, layout. No feature logic. |
| `src/app/shared` | Reusable UI primitives (tables, dialogs, forms, states, pagination, filters, directives, pipes). |
| `src/app/features/<feature>` | Lazy-loaded feature slices: `data-access/`, `pages/`, `components/`, `state/`, `<feature>.routes.ts`. |
| `src/assets/i18n` | Arabic/English translation resources. |
| `src/environments` | Environment configuration (`environment.development.ts` replaces `environment.ts` in dev builds). |
| `e2e/` | Playwright end-to-end tests. |
| `deploy/docker` | Multi-stage Dockerfile and nginx config. |

## Getting started

```bash
npm install
npm start
npm test
npm run build
```

## Conventions

- kebab-case file names; PascalCase types; camelCase members.
- Frontend authorization is UX only. The API enforces security.
- No hardcoded user-facing strings in feature components.
