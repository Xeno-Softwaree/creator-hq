# SQLite to Supabase PostgreSQL runbook (Phase 1.2)

> Historical administration runbook: Phase 1.2 cutover/restore is complete. For a new machine use [current PostgreSQL installation](postgresql-installation.md). Phase 1.3 candidate deployment still requires approval.

[English README](../README.md) | [Türkçe README](../README.tr.md) | [Verification](phase12-verification.md) | [Backup and rollback](database-operations.md)

## Current boundary

Preparation is implemented. The active installation remains SQLite until a real Supabase connection, verified data transfer, runtime checks and explicit cutover approval exist. Do not interpret local PGlite tests as a Supabase migration. No new Supabase project is created; use the existing operator-designated project.

## Architecture and compatibility

- Original SQLite: `apps/api/prisma/creator.db`; its schema/client remain available for controlled rollback. Migration tools open this source read-only and never reset, overwrite or seed it.
- PostgreSQL: separate Prisma 6.19.3 schema/client at `apps/api/prisma/postgresql/schema.prisma`, with version-controlled additive SQL under its migrations directory. `creator_hq` is a private schema, not the Supabase `public` schema.
- Existing six models, IDs, fields, string status values, technical report text and timestamps are preserved. PostgreSQL adds foreign keys, indexes, CHECK constraints and UTC `timestamptz(3)` timestamps. Historical broken references block migration rather than being silently repaired or dropped.
- Additional Studio, ApplicationSetting, ArtifactReference and ExecutionJob tables prepare persistent metadata. Task priority defaults to Normal; the existing UI/API does not acquire an unrelated priority editor. Jobs are constrained to `enabled=false`; no executor is activated.
- Media, vaults, render files and backup files remain local. Artifact records contain a configured storage root and relative path, never uploaded binary content. Personal locations are configured in ignored environment files.
- Report task references use `ON DELETE SET NULL`, preserving the report and its original technical text after an explicit task deletion. Agent/approval/studio references use restrictive deletion. There is no cascading deletion of history.

## Official connection basis

Use the installed Prisma 6 built-in PostgreSQL connector and schema-level `url` / `directUrl`; do not copy a Prisma 7 adapter/config migration into this project without a separate review.

For the persistent backend, choose a direct connection when reachable or the Supavisor **session** pooler (port 5432) for IPv4. Copy the real endpoint from the existing project's Connect dialog; do not guess its pooler hostname. Migration and native backup connections must be direct/session, not transaction pooling. If runtime transaction pooling is deliberately selected, use `pgbouncer=true`; it is rejected for migration connections.

Both Prisma URLs require `schema=creator_hq`, `sslmode=require`, `sslaccept=strict`, bounded `connect_timeout`, `pool_timeout`, `socket_timeout` and `connection_limit`. Recommended initial values are 10, 10, 20 and 5 respectively. Download the server CA through the existing dashboard and configure `sslcert` when needed; never disable certificate checks to bypass a failure. Native backup tools use `verify-full` verification. Percent-encode reserved password characters.

References: [Prisma schema reference (v6)](https://www.prisma.io/docs/orm/v6/reference/prisma-schema-reference#directurl), [Prisma PostgreSQL (v6)](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql), [Supabase connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Separate active and staging environments

The running backend reads `apps/api/.env`. Keep `DATABASE_PROVIDER=sqlite` and its existing SQLite URL during preparation. Migration and PostgreSQL backup commands separately read `apps/api/.env.migration` first, then non-overriding defaults from `.env`. A different staging file can be selected with `MIGRATION_ENV_FILE`.

Use `apps/api/migration.env.example` as a template. Fill DATABASE_URL (restricted runtime role), DIRECT_URL (reviewed migration/backup role) and SUPABASE_PROJECT_REF only in the ignored local staging file. Never send passwords in ordinary chat, place them in command-line arguments, or copy them to NEXT_PUBLIC variables. Shared examples intentionally contain no invented credentials.

Before schema deployment, follow the [connection and role preparation guide](supabase-access.md). The read-only --check-connection mode works before application tables exist.

## Stage A — Freeze, back up and inspect

Stop the API or restart it with `DATABASE_READ_ONLY=true` before the final migration snapshot. The application rejects mutation methods while this flag is set; user-facing messages remain localized. No script can infer that an unrelated running API is frozen: the operator must confirm it.

Set BACKUP_DIR to the operator's existing local backup directory, then run:

```powershell
npm run db:backup:sqlite
npm run db:inspect
```

The backup command creates a new timestamped file, opens it read-only, checks SQLite integrity, normalizes all six tables, verifies required fields/relations/statuses and writes a private JSON manifest with counts, primary keys, relationships and a SHA-256 fingerprint. No existing file is replaced. Set SQLITE_BACKUP_MANIFEST in the staging file to this verified manifest. Never use a stale snapshot after new SQLite writes.

Source inspection reports unsupported tables/columns, unknown statuses, duplicate IDs/report source IDs, invalid nulls or orphan references explicitly. Resolve such differences through a reviewed plan; do not reset or silently skip records.

## Stage B — Review roles and schema

Keep Supabase Data API disabled. Do not add creator_hq to an exposed API schema. Disabling Data API does not secure direct SQL credentials.

Review `security/bootstrap-role.sql` in the existing project's SQL editor or psql. It creates only a restricted **NOLOGIN** role if missing; existing roles are preserved for inspection. Set a strong password securely with the psql interactive `\password creator_hq_runtime` command, then enable LOGIN after checking NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT and NOBYPASSRLS. Do not grant role memberships. Never commit or paste the password into a public script.

The migration owner must be allowed to create the dedicated schema. Do not grant those privileges to the runtime role. Set MIGRATION_SCHEMA_APPROVED=true only after SQL review, then:

```powershell
npm run db:migrate -- --apply-schema
```

The script validates project identity and TLS, checks for unrelated existing schema/history, then runs `prisma migrate deploy` against the separate PostgreSQL schema. It never invokes reset, force-reset or a production db push. The migration is wrapped in a transaction and only creates dedicated application objects, scoped grants, checks and policies.

Next run:

```powershell
npm run db:migrate -- --preflight
```

This checks runtime connectivity, role flags/memberships, RLS, table/schema grants and unexpected public policies. The SQL runtime role is backend-only and intentionally has access to all application rows; this is not end-user/multi-tenant authorization. Trusted migration owners or BYPASSRLS roles can bypass row policies. It does **not** verify dashboard Data API settings; those require operator dashboard evidence. For an explicit rollback-only CRUD probe, set MIGRATION_PROBE_APPROVED=true and add `--probe-write` to preflight. Probe records are created/updated/deleted inside a transaction that is deliberately rolled back, with absence verified afterward.

## Stage C — Dry run, transfer and verify

```powershell
npm run db:migrate
```

Default mode is read-only. It verifies backup/source consistency and compares existing destination IDs/fields. Unrelated destination rows or differing same-ID records stop the operation. No updates, overwrites or deletes are used by the data-transfer routine.

After reviewing the dry run, freeze source writes and set MIGRATION_SOURCE_FROZEN=true, MIGRATION_DATA_APPROVED=true and MIGRATION_PROBE_APPROVED=true in the staging environment:

```powershell
npm run db:migrate -- --apply-data
```

The transaction inserts missing rows with parameterized statements and conflict-do-nothing semantics, then verifies all six table counts, IDs, normalized field values, relationships and the complete fingerprint. Repeating it does not duplicate records or overwrite changes. Source fingerprint is checked before and after transfer. A post-commit source change blocks cutover without deleting destination data; review and reconcile rather than automatically rolling back.

A private report is generated under MIGRATION_REPORT_DIR. A receipt is usable for cutover only when data equality and the rollback-only runtime write probe are both verified. A successful dry run alone does not authorize cutover.

## Stage D/E — Explicit cutover and regression checks

Only after stages A–C, backup/recovery review and explicit operator cutover approval:

1. Securely retain the current SQLite-capable source/build and active environment for rollback. The original SQLite file remains in place.
2. In the active backend `.env`, select DATABASE_PROVIDER=postgresql and copy only the restricted runtime DATABASE_URL and SUPABASE_PROJECT_REF. Keep the privileged DIRECT_URL in the separate staging file.
3. Set DATABASE_VERIFICATION_FILE to the verified report, and DATABASE_CUTOVER_APPROVED=true. The backend rejects a missing/mismatched/incomplete receipt and rechecks the preserved SQLite source fingerprint before startup. Any source edit after verification blocks cutover; keep source writes frozen throughout the review.
4. Restart the backend. Confirm `/health` reports database postgresql, then exercise real migrated data through both UI languages, tasks, profiles, approvals, reports, settings and reload/restart persistence.
5. Verify an independent PostgreSQL backup and isolated restore before declaring production migration complete.

No script automatically changes the active environment or performs this cutover. No live Codex, publishing, paid AI or external execution integration is activated.

## Stage F — Rollback

See [operations](database-operations.md). Freeze PostgreSQL writes before switching back. The original SQLite snapshot becomes stale after any new PostgreSQL write; do not overwrite newer data or claim reverse replication. Reconciliation/export after a cutover is a separate reviewed operation.
