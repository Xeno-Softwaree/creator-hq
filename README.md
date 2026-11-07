# Creator HQ

[English](README.md) | [Türkçe](README.tr.md)

A local-first AI production office with a responsive dashboard, interactive procedural 3D rooms, configurable agent profiles, PostgreSQL task management, human approvals and deterministic CEO reports.

Creator HQ currently models two independent studios: Afterlight Stories / Niko and Son Yedek. Their names are example branding; no private production assets, notes or media are bundled. Real Codex CLI execution, Remotion rendering, Obsidian access, external skills and publishing remain disabled. No OpenAI API key or paid service is required.

## Status

This is a single-user foundation prepared for **open-source release review**, not a published release or a network-ready service. Publishing, visibility changes and license selection require explicit operator approval. Existing dependency advisories still require review; see [readiness results](docs/readiness-verification.md).

## Database status

The active installation uses restricted Supabase PostgreSQL in creator_hq. The Phase 1.3 source candidate adds atomic task writes, serialized completion transitions, bounded health and startup without legacy SQLite files. It requires separate approval before live deployment.

[New-computer PostgreSQL setup](docs/postgresql-installation.md) · [Phase 1.2 verification](docs/phase12-cutover-completed.md)

## Requirements

- Windows 11, Node.js 24+ and npm. The implementation was tested with Node.js 26.3.0 and npm 11.16.0.
- A modern browser with WebGL for the 3D view. The agent directory also provides keyboard-accessible management.
- Internet access for the initial npm packages and Prisma engine download; application assets and localization run locally.

## Install and start

Run these commands from your checkout:

```powershell
npm ci
# Configure private API/web environment files first; see the setup guide.
npm run build
npm start
```

Open [Creator HQ](http://127.0.0.1:3000). The API health endpoint is [API health](http://127.0.0.1:4100/health). Both services bind to loopback. Stop them with Ctrl+C. For development, replace the build/start commands with `npm run dev`. Do not run the development server while building: both use the same Next.js cache.

Do not run db:setup, db push, seed or migrations for an existing Supabase project. SQLite remains available only for explicit legacy/test deployments; original files and backups are preserved.

## Deployment language policy

Configuration belongs in `apps/api/.env` and `apps/web/.env.local`; workspace-specific `.env.example` files are available. Do not overwrite an existing environment file. The root `.env.example` documents both groups and is not loaded automatically.

Set the following in `apps/web/.env.local`, then rebuild:

```dotenv
NEXT_PUBLIC_DEPLOYMENT_MODE=public
```

- **Personal** (`personal`, the compatibility default): Turkish UI and CEO summaries by default. Developer communication with the project owner stays Turkish.
- **Public** (`public`): detect the first supported browser-language preference. Turkish variants select Turkish, English variants select English, and no supported match falls back to English.
- A valid saved selection always wins in either deployment. The existing `creator-hq.locale` browser preference is preserved. No preference is reset by this upgrade.

The TR / EN switcher persists selection in local storage and is available inside edit dialogs. Additional UI languages require a dictionary and an entry in the central locale registry; components do not need language-specific branches. See [architecture](docs/architecture.md).

Studio content languages are separate settings: Niko defaults to English and Son Yedek to Turkish. Changing UI language does not translate tasks, scripts, narration, private notes or original technical reports.

## Storage configuration and privacy

`NEXT_PUBLIC_STORAGE_APP_PATH`, `NEXT_PUBLIC_STORAGE_VAULT_PATH`, `NEXT_PUBLIC_STORAGE_MEDIA_PATH` and `NEXT_PUBLIC_STORAGE_BACKUP_PATH` are optional **display-only** references. Defaults use safe relative paths. They do not grant filesystem access or enable backup jobs. Values prefixed with `NEXT_PUBLIC_` are visible to browser users: never include credentials or personal paths in a shared build.

Keep real environment files, databases, logs, vaults, rendered media and local verification evidence outside public Git content. New binary/media files are ignored by default; any intended public asset requires a separately reviewed allowlist change. Ignore rules alone do not remove already-tracked files or Git history.

## Validation

```powershell
npm run typecheck
npm test
npm run build
npm run audit:public
```

The public-content audit scans tracked and non-ignored candidate files without printing secret contents. It checks private artifacts, common credential patterns, connection secrets and machine-specific paths. It is a guard, not a comprehensive secret scanner or a substitute for reviewing staged changes and Git history. No independent lint script is currently configured.

## Documentation

- [Türkçe kurulum ve kullanım](README.tr.md)
- [Architecture and localization](docs/architecture.md)
- [Contributing and release review](CONTRIBUTING.md)
- [Non-destructive migration plan](docs/migration-plan.md)
- [Actual readiness verification](docs/readiness-verification.md)
- [Developer instructions](AGENTS.md)

Public license terms have not been selected. Do not infer a license or publish this project until the operator has completed that decision and the release review.

Public-mode builds reject absolute storage locations and credential-bearing API URLs before bundling. Use safe relative storage references for public builds; do not reuse a personal environment file unchanged. The build error identifies configuration keys without printing their values.

[Supabase connection and restricted-role preparation](docs/supabase-access.md) — preparation only; manual live changes require explicit approval.

Prisma 6.19.3 certificate parameter compatibility and actual read-only recovery results: [TLS recovery](docs/prisma-tls-recovery.md).

The separately approved Phase 1.2 live schema migration succeeded; data transfer and application cutover remain pending: [verified schema result](docs/schema-migration-result.md).

The first approved live data transfer stopped safely; no imported records remain and the app still uses SQLite: [transfer attempt](docs/data-transfer-attempt.md).

The timestamp transfer correction passed isolated Prisma regression tests; live retry still requires explicit approval: [local fix](docs/timestamp-transfer-fix.md).

The separately approved corrected live transfer succeeded and source/target records matched. The app remains on SQLite; cutover and PostgreSQL restore verification are pending: [live transfer result](docs/data-transfer-result.md).

A real PostgreSQL archive was created and listed, but the isolated restore gate has not passed; application cutover remains blocked: [backup/restore result](docs/backup-restore-result.md).

The official signed EDB 17.11-5 x64 package was verified, but Windows denied its help-only launch; extraction and native restore remain pending: [package status](docs/native-restore-extraction-status.md).

The real native PostgreSQL 17.11 archive restore and data/security comparisons passed. The temporary cluster was stopped; Creator HQ remains on SQLite pending final approval: [verified native restore](docs/native-restore-result.md).

Current cutover acceptance: PostgreSQL is active but writes remain blocked pending database-failure response classification and browser checks. All six test records were cleaned: [verification status](docs/cutover-verification.md).

Phase 1.2 cutover is complete: the running app uses restricted Supabase PostgreSQL, writes are enabled, and 44 automated tests plus live/browser checks passed. [Final verification and startup](docs/phase12-cutover-completed.md).

Phase 1.3 local candidate: 55 tests, typecheck and isolated API/web builds passed; live deployment is still awaiting explicit approval. [Local verification](docs/phase13-local-verification.md).


### Phase 2.0 Package 1 — local preparation

The disabled execution contract, nine role policies, fake-only adapter and TR/EN approval preview are prepared locally. They are not deployed over the active Phase 1.3 application. No real Codex invocation or live migration is included. See [execution contract and next approval gates](docs/phase20-execution-contract.md).
### Phase 2.0 Package 4 — local integration

The disabled Atlas job/owner-approval integration is documented in [Phase 2.0 Package 4](docs/phase20-package4.md). It is a local source package; it does not enable production agents or require a live schema migration.

Package 5 adds local owner-provisioning preparation and model-free native protocol rehearsal. [Preparation and activation boundaries](docs/phase20-package5.md) · [Verification](docs/phase20-package5-verification.md). Production execution remains locked.

The subsequent [Atlas activation review](docs/activation/README.md) contains the prepared SQL, rollback and gated worker changes. None has been deployed or applied to the live database.

