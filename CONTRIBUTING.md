# Contributing to Creator HQ

[English README](README.md) | [Türkçe README](README.tr.md)

## Development standard

Use English identifiers, filenames, database models/fields, API contracts, comments, technical documentation and commit messages. Developer communication with the project owner remains Turkish under `AGENTS.md`; this does not change the architecture language.

Keep UI copy in central dictionaries using stable semantic keys, such as `nav.overview` or `task.status.done`. Never use translated prose as a key. A copy edit changes dictionary values, not keys. Add new languages through `apps/web/src/locales/index.ts`; keep keys and interpolation placeholders aligned. Do not branch React components on a particular language.

Preserve user content, technical report originals, studio content-language settings and the existing local-storage preference key. Persisted statuses and API fields are protocol identifiers, not translated UI labels.

## Compatibility and data

Do not rename database tables/fields, routes, API response fields or stored status values without a reviewed migration plan covering consumers, data backup, compatibility, rollback and regression tests. The current readiness upgrade needs no database migration. Use isolated test databases; never reset an existing database or alter vault/media content.

## Checks

```powershell
npm install
npm run db:setup
npm run typecheck
npm test
npm run build
npm run audit:public
```

Stop running services before schema setup; do not run Next development and production builds concurrently. A separate lint command is not currently configured. Report actual results and identify untested behavior.

## Privacy and release review

- Never commit credentials, Supabase connection secrets, real environment files, personal notes, private studio production data, database exports, rendered media, private logs or machine-specific personal paths.
- Use relative example paths. Browser-visible `NEXT_PUBLIC_` settings must never contain secrets; shared builds must not embed private paths.
- Private verification evidence belongs in ignored local storage. Ignoring a tracked file does not remove it from Git history.
- Run `npm run audit:public`, inspect the complete candidate/staged file list, and review Git history with an appropriate secret scanner before any release. The built-in audit intentionally reports rule names and filenames, never matching secret contents.
- Review dependency advisories, single-user loopback assumptions, license choice and any intentionally public assets before release. Automated checks are necessary but do not constitute release approval.
- Do not push, publish, change visibility, enable paid APIs, connect social accounts or turn on execution integrations without explicit operator authorization.

No public license has been selected; contributions or publication must not assume licensing terms. Ask the operator to resolve the license as part of the release review, not as a routine implementation step.
