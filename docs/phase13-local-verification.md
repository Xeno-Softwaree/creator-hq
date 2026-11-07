# Phase 1.3 local finalization verification

Status: local candidate complete; live deployment requires separate explicit approval.
No active environment, running service, production schema or real record was changed.

## Changes

- POST /tasks checks the agent and creates task/activity inside one transaction.
  No success response is sent before commit; failures roll back both inserts.
- PostgreSQL PATCH /tasks/:id locks the selected row with a bound FOR UPDATE query,
  then reads status and generates the completion report within the same transaction.
  Four simultaneous Done requests returned successfully with exactly one report.
  No request replay, queue or automatic write retry was added.
- PostgreSQL configuration no longer reads migration receipts or source SQLite files.
  It requires explicit provider selection, approved PostgreSQL opt-in, the expected
  project/schema/runtime URL, strict TLS and bounded connection parameters.
  An administrative URL in runtime is rejected. Legacy evidence is not deleted.
- Before listening, startup connects and verifies the actual runtime role,
  namespace, role flags/memberships, DDL/ownership restrictions, required tables,
  RLS, CRUD grants and absence of runtime access to migration history. It performs
  only catalog reads; it does not migrate, seed or require an admin credential.
- Health now includes connection and SELECT 1 in the same bounded budget. With
  10/10/20-second URL settings the budget is 40 seconds; HEALTH_TIMEOUT_MS can
  override within 1000..60000 ms. An outstanding read is shared until it settles,
  so timed-out probes do not spawn a query pileup. The driver can still finish an
  already-started read after the HTTP deadline; no write is involved or replayed.
- Startup fails if DATABASE_PROVIDER is absent instead of silently choosing SQLite.
  Explicit SQLite development/test use remains available. The SQLite-only setup
  command sets that choice explicitly after rejecting PostgreSQL configuration.
- English/Turkish installation docs and safe examples now describe PostgreSQL as
  the active deployment. New machines need no old receipt or SQLite source path.
  The public examples remain unconfigured and never contain actual credentials.

## Actual verification

All final checks passed:

| Group | Passed |
| --- | ---: |
| API/database, including native PostgreSQL fixture and its subtests | 42 |
| Web/i18n | 8 |
| Public-security policy | 5 |
| Total | 55 |

There were no failed or skipped tests in the final full run. The earlier 44-test
coverage is retained; the retired receipt/file guard test now checks explicit
opt-in, rejection of admin runtime configuration and independence from legacy files.

Native PostgreSQL 17.11 ran in an ACL-restricted temporary cluster, only on
127.0.0.1 and a non-5432 port. It used test-only credentials and the already reviewed
schema SQL. Tests verified actual rollback after an activity insert failure,
serialized concurrent Done requests, rollback after a report failure, PostgreSQL
runtime startup validation and persistence after rebuilding the API/client.
Only the temporary test cluster was stopped and its own temporary directory removed.
The fixture handles Windows pg_ctl without inherited output-pipe waits.

Other regressions covered actual Prisma transport failure/reconnection, absence of
failed-write replay, safe error classification, bounded/deduplicated health reads,
missing/wrong runtime metadata, and PostgreSQL client initialization in a subprocess
without historical files or even loading the native SQLite module.

Workspace typecheck passed. Both Prisma client generation/API compilation and the
Next.js production build passed in a separate ignored build tree. No live dist,
.next or generated-client output was replaced. Hash checks confirmed that selected
running build outputs, private environment files and original SQLite were unchanged.
The reviewed migration checksum is unchanged. Public-content audit found no issues.

## Reproducing native coverage

Ordinary tests keep their temporary SQLite/PGlite fixtures. The native cluster test
requires an explicitly supplied complete PostgreSQL 17 tools directory; without it
that one native fixture is skipped. On Windows, set the private local value first:

~~~powershell
$env:CREATOR_TEST_POSTGRES_BIN = '<complete PostgreSQL 17 bin directory>'
npm test
npm run typecheck
npm run audit:public
~~~

The variable is test-only. Do not point native test data or credentials at production.
No installer, service registration, external API, Python or schema migration is used
by the fixture. Actual private tool paths are not committed.

## Deployment boundary

The existing Phase 1.2 application is still running its previous build. These local
results do not claim Phase 1.3 live acceptance. After explicit approval, stop only
Creator HQ, deploy the reviewed build and restart with the existing runtime-only
environment. Do not reset/reseed, rerun schema creation or rewrite real records.

ExecutionJob.enabled=false remains in the unchanged reviewed migration. No real
Codex worker, video renderer, table or disaster-recovery automation was added.
Expanded recovery automation remains deferred until after the first test video.

[New-computer installation](postgresql-installation.md) ·
[Architecture](architecture.md) · [English README](../README.md) ·
[Turkish README](../README.tr.md)

## Live deployment verification — 2026-11-06

Phase 1.3 is deployed. The reviewed isolated API build was copied into the production API output after a controlled API-only stop. The unchanged web service remained running. Build hashes and timestamp are recorded privately in `.local/phase13/deployed-build.json`; API app.js SHA-256 begins `2ea3c3aef6d2`.

The restricted `creator_hq_runtime` account in schema `creator_hq` passed startup identity, ownership, RLS and permission checks without supplying legacy SQLite or receipt paths. All 55 tests passed again, including native PostgreSQL concurrent Done, atomic rollback and restart tests. Typecheck and public privacy audit passed (111 files, zero findings). Existing isolated API/web production builds were used; no schema migration or seed was executed.

Live acceptance passed: health, task CRUD, agent update, approval/report reads and update, restart persistence, related-report behavior after task deletion, TR/EN navigation, nine agent cards, WebGL office rendering and orbit interaction. Six provenance-checked temporary records were removed. Original source/target fields still match. Isolated unreachable-transport tests returned 503 for health/state/writes without SQLite fallback or deferred writes.

Final counts: Agent 9, Task 0, Activity 3, Approval 3, StudioSettings 2, AgentReport 3, Studio 3, ApplicationSetting 0, ArtifactReference 0, ExecutionJob 0. The database constraint keeps ExecutionJob.enabled false. PostgreSQL writes are enabled; no administrative URL is present in runtime configuration. SQLite, the verified archive and migration history were preserved. Private final evidence is `.local/phase13/live-result.json`.

Phase 1.3 is complete. Real agent activation and comprehensive disaster-recovery automation remain outside this delivery.
