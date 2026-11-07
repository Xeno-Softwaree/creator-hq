# Phase 1.2 verification — prepared, live cutover blocked

[Migration runbook](database-migration.md) | [Backup and rollback](database-operations.md) | [English README](../README.md) | [Türkçe operator instructions](../README.tr.md)

## Current state

The active application remains SQLite. PostgreSQL support is prepared, but no live Supabase connection, schema deployment, owner-record transfer or application cutover is claimed. The existing creator-hq project was not recreated or modified. Credential fields in the ignored staging environment remain empty.

The installed Prisma version is 6.19.3. Two generated clients support an explicit provider selection; the original SQLite schema/file is retained. PostgreSQL uses a private creator_hq schema, scoped grants/RLS, restrictive foreign keys, indexes, UTC timestamps and protocol-compatible string status checks. Additional tables hold metadata only; execution remains disabled.

## Source and backup evidence

The original SQLite file was found, opened read-only and passed integrity checking. It contains meaningful existing agent configuration and history, despite having no tasks. A timestamped backup was actually created in the operator's configured backup directory, reopened and verified with counts, IDs, relationships, normalized timestamps/fields and a fingerprint. The exact path, manifest and private source data remain outside public Git content and are included in the private operator report.

Record counts changed while the application was still live during preparation; the verified backup captured the later state. This validates the need for a source-write freeze and a new backup if any subsequent SQLite writes occur. No record was reset or silently skipped by the migration tools. No vault or media file was read, moved or uploaded.

## Executed checks

| Check | Result |
| --- | --- |
| Original SQLite integrity and backup readability | PASS |
| SQLite backup source-byte preservation on isolated fixture | PASS |
| Both Prisma clients generated with installed Prisma 6 | PASS |
| PostgreSQL DDL execution in isolated PGlite | PASS; only private-schema application tables |
| Transfer/idempotency in isolated PostgreSQL engine | PASS; nine dummy agents and isolated related records, exact normalized field/count fingerprints |
| Conflicting destination row / invalid source / edited fingerprint rejection | PASS |
| Foreign-key checks, string status checks, runtime role access, anonymous/schema-write rejection | PASS in the isolated SQL engine |
| Native Prisma PostgreSQL client over isolated loopback TCP | PASS; health, nine dummy profiles, task CRUD, reports, approvals, activity and studio settings |
| PostgreSQL client reconnect persistence | PASS in isolated PGlite; not a live Supabase/server-restart durability test |
| Task deletion preserves technical report with nullable reference | PASS in isolated PostgreSQL |
| API connection-error redaction and migration read-only guard | PASS with isolated/mocked failures |
| Provider/TLS/project binding/receipt rejection | PASS in configuration tests |
| Frontend secret-variable build guard | PASS; database/privileged variables are rejected even in personal mode |
| Source identifier, translation/key parity, locale and CEO tests | PASS |
| Final typecheck/test/build | PASS: root typecheck, 21 tests (API 8, web 8, scripts 5), production build; final receipt/source guard also passed API typecheck, 8 tests and build |
| Public source-content audit | PASS: 73 candidate files, zero findings |

The source and test destination are intentionally distinct. PGlite is an embedded PostgreSQL engine; its loopback socket adapter exercises the actual generated Prisma connector without accessing Supabase. It does not prove real project TLS, authentication, pooling, dashboard settings or network reachability. TLS is disabled only for that isolated loopback test; production connection policy rejects insecure TLS settings.

The SQL tests caught an initial search-path assumption in generated migration output; explicit private search_path was added before any live deployment. A staging-environment regression test also prevents generated-client environment loading from selecting the active SQLite URL before credential validation.

## Final local application check

The production application was restarted successfully with SQLite on loopback. The dashboard showed the connected local API and nine profiles. Turkish remained selected in the owner browser. A separate temporary browser verified English selection, reload persistence and original technical-report viewing without changing that preference. The 390-pixel mobile viewport had no horizontal document overflow. A temporary WebGL fallback appeared during viewport resizing; after a normal reload, the fallback was absent and office rendering recovered. The accessible agent directory remained available. The final screenshot is private. No production CRUD test records were created.

The final read-only source inspection matched the actual verified backup fingerprint and counts: Agent 9, Task 0, Activity 3, Approval 3, StudioSettings 2, AgentReport 3. This is source/backup equality, not evidence of a live Supabase transfer.

## Live checks blocked or not performed

- Supabase connection/TLS/project identity: blocked by absent securely configured credentials.
- Actual project schema deployment, owner-record transfer, live target counts/ID verification: not performed. Destination counts are unknown, not zero.
- Live cutover and real PostgreSQL server restart persistence: not performed; active provider stays SQLite.
- Data API: operator reports it is disabled. It was not independently inspected in the dashboard and was not re-enabled. SQL preflight cannot certify this setting. Direct database credentials and privileged roles remain security boundaries even when Data API is disabled.
- Native PostgreSQL archive and isolated restore drill: blocked; pg_dump/pg_restore/psql are not available in PATH or the checked standard installation location. No PostgreSQL backup file or successful restore is claimed.
- Docker-based PostgreSQL: Docker client exists, but the local engine was not running. No daemon/service or external database was created automatically.
- No independent lint script exists. Browser/process restart and real hosted pooling behavior are not inferred from unit tests.

## Fresh dependency security audit

The initial fresh audit reported five affected package entries (four high, one moderate). Next.js 15.5.29 bundled PostCSS 8.4.31; a scoped compatible PostCSS 8.5.32 override removes the Next/PostCSS advisory chain. Both npm ls and a fresh online npm audit were checked against the actual installed tree. A stale installation/lock mismatch was corrected with a clean reinstallation; previous artifacts were retained privately.

The final online audit still reports **three high** entries, all in one underlying development-tool chain:

| Package | Chain | Status |
| --- | --- | --- |
| deepmerge-ts 7.1.5 | prisma → @prisma/config → deepmerge-ts | High: recursive graph merge can exhaust the stack; advisory GHSA-ggr8-5vv4-36mx |
| @prisma/config 6.19.3 | Prisma CLI configuration dependency | High via deepmerge-ts |
| prisma 6.19.3 | Direct development dependency | High via configuration chain |

npm recommends Prisma 7.10.1, a major upgrade with different adapter/config expectations. No force fix or blind major migration was applied. Treat a Prisma 7 upgrade and its database/CLI regression review as a separate remediation. The vulnerable merge is in local CLI/config tooling, not an exposed application merge endpoint; this limits the observed attack surface but does not resolve the advisory. The audit is not clean. Offline npm output reporting zero findings was not treated as a fresh security result.

## Backup, rollback and approval boundary

SQLite backup succeeded; PostgreSQL backup/restore remains a documented, unexecuted procedure until tools/access are available. Retention is configurable and only lists expired archives for review; no automatic deletion or recurring job is created.

Cutover requires: a verified fresh SQLite backup; real connection/security checks; reviewed schema; explicit transfer/probe approval; frozen source; matching source/destination evidence; runtime write-probe success; recovery review; and explicit operator cutover approval. A missing/mismatched receipt fails closed.

The previous SQLite file is not overwritten. After any PostgreSQL writes, switching back can lose visibility of new records; freeze writes, preserve both sources and review divergence. No automatic reverse migration or destructive rollback is implemented.

## File inventory

New database implementation files are under `apps/api/src/database/`: `backup-postgres.ts`, `backup-sqlite.ts`, `config.ts`, `generate.ts`, `migrate.ts`, `migration.test.ts`, `postgres-api.test.ts`, `preflight.ts`, `snapshot.ts`, `target.ts`, and `transfer.ts`. The separate PostgreSQL schema, migration lock, initial migration and role bootstrap are under `apps/api/prisma/postgresql/`. `apps/api/migration.env.example` documents the separate staging environment.

Existing integration files changed: `apps/api/src/db.ts`, `apps/api/src/app.ts`, `apps/api/src/setup.ts`, `apps/api/src/api.test.ts`, API/root package manifests and lockfile, the web dashboard and both translation dictionaries, deployment-policy script/tests, public-audit script, `.gitignore`, `.gitattributes`, root/API environment examples, both READMEs and `docs/architecture.md`. New runbooks are `docs/database-migration.md`, `docs/database-operations.md` and this verification report. The original SQLite Prisma schema and database were not converted in place. Private environment files, source snapshots, test evidence, screenshots and backup manifests remain excluded from Git.

## Changed areas

- Separate PostgreSQL Prisma schema and immutable migration source, runtime-role bootstrap SQL.
- Database provider/configuration, verified cutover gate, health/read-only/error handling.
- Read-only SQLite inspection/backup, idempotent transactional transfer, security preflight, native PostgreSQL backup CLI and isolated tests.
- English environment examples, separate ignored staging file, source audit's exact SQL allowlist, line-ending policy and generated-client exclusions.
- Localized database/read-only errors; dashboard design and language architecture preserved.
- npm scripts, Node 24+ requirement, PostgreSQL test dependencies, PostCSS override and lockfile.
- Migration/operations/verification documents and bilingual README setup guidance.

No repository publication, push, visibility change, paid AI service, live Codex execution, social integration, vault modification or media upload occurred.
