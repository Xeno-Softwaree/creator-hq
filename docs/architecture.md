# Architecture

[English README](../README.md) | [Türkçe README](../README.tr.md)

## Workspaces

- `apps/web`: Next.js App Router, TypeScript, Tailwind, Radix/CVA Button foundation and React Three Fiber/Drei.
- `apps/api`: loopback-only Fastify, Zod validation and Prisma; the active deployment uses Supabase PostgreSQL.
- `scripts`: dependency-free public-content audit and its regression tests.

The browser calls the local API. PostgreSQL owns active records in creator_hq; SQLite remains an explicitly selected legacy/test backend. UI language is a browser preference; it is not written to production task data. No execution worker, external model, publishing process or filesystem vault connector is active.

## Language-neutral presentation

`apps/web/src/locales/index.ts` is the locale registry. Its keys define the `Locale` type and supported locale list. Each entry supplies messages, a browser-language match and a short label. To add a UI language, create a dictionary with identical semantic keys/placeholders and register it. The switcher, formatting and detection consume this registry automatically.

Dictionary keys describe stable intent, independent of rendered text. `presentation.ts` maps existing English protocol/status/role values to these keys. Unknown user-authored names, instructions and creative content stay verbatim. Brand names and technical identifiers may remain unchanged in both dictionaries.

`i18n.ts` separates deployment defaults, browser detection, valid persisted selection, dictionary lookup and locale-aware formatting:

1. A valid `creator-hq.locale` saved preference wins.
2. Personal mode defaults to Turkish.
3. Public mode walks browser language preferences in order, selecting the first supported base-language match; if no match exists it chooses English.
4. Missing messages use the deployment fallback, then English, then a central fallback message.

Public mode server rendering starts in English; personal mode starts in Turkish. Browser detection and saved selection are applied after hydration, so a brief initial default can appear. Storage denial still permits in-memory switching, without persistence guarantees. Cross-tab storage events update selection without resetting forms or task state.

Changing `NEXT_PUBLIC_DEPLOYMENT_MODE` requires rebuilding Next.js. It does not override a valid stored preference. A public distribution configuration controls language defaults only; it does not expose servers publicly or authorize publishing.

## Independent production languages and CEO reports

`StudioSettings.contentLanguage` is distinct from UI locale. Existing studio defaults remain English for Niko and Turkish for Son Yedek. Adding another UI language does not broaden this production-language API contract automatically.

Reports preserve `originalTechnicalReport` separately from language-neutral `summaryData`. The client renders six deterministic localized sections from that structure. Manual Done updates are labeled as local board actions, not verified execution. Simulation reports remain explicitly simulated. Unknown templates direct users to the unmodified original rather than inventing results. The future CEO adapter remains disabled and unauthenticated.

## Configuration and trust boundaries

The API reads `apps/api/.env`; Next.js reads `apps/web/.env.local`. Runtime settings contain only the restricted PostgreSQL connection; API field names remain unchanged. The root `.env.example` is explanatory, not an automatically loaded root configuration.

Storage references live in `storage.ts` and optional `NEXT_PUBLIC_STORAGE_*` variables. Defaults are relative and display-only. They never grant filesystem access. Public environment values are compiled into browser-visible assets: never embed secrets or machine-specific private locations in a shared build.

Both services bind to loopback. CORS/origin restrictions allow the established local web origins; this is not multi-user authentication. Production builds are not authorization to expose the service on a network. Existing dependency advisories require separate review.

## Release guards

The public-content audit scans tracked and non-ignored candidates, rejects common sensitive artifacts/credentials/private paths and avoids printing secret contents. Locale tests check key/placeholder parity, deployment defaults and JSX/identifier rules. These checks cannot prove absence of arbitrary personal notes or historical secrets; manual candidate review, history scanning, dependency review, license selection and explicit operator approval remain release gates.

Public-mode builds reject absolute storage locations and credential-bearing API URLs before bundling. Use safe relative storage references for public builds; do not reuse a personal environment file unchanged. The build error identifies configuration keys without printing their values.

## PostgreSQL finalization candidate

The deployed Phase 1.2 application uses PostgreSQL. Phase 1.3 changes await separate deployment approval. The candidate retains strict URL validation and operator opt-in, and verifies PostgreSQL identity/schema/RLS/privileges before listening. It no longer reads historical receipts or SQLite fingerprints at runtime; that evidence remains preserved.

Task/activity creation is transactional. PostgreSQL task updates lock the row before reading status, so concurrent Done requests create one report per transition. Report failures roll back transitions. No request retries or write queue are introduced.

Health includes connection and SELECT 1 in a bounded deadline; concurrent probes share an outstanding read. A timed-out read can still settle under driver connection/socket bounds, but no additional probes pile up and no writes are involved.

[New-computer installation](postgresql-installation.md). No schema or enabled-job changes are part of this candidate.
