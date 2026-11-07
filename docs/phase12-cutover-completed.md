# Phase 1.2 PostgreSQL cutover completed

Verified: 2026-11-06. Active database: Supabase PostgreSQL 17.11,
creator_hq schema, creator_hq_runtime role. API and web listen only on loopback.
Writes are enabled in both the running API and the persisted ignored environment.
No administrative URL is present in the runtime environment.

## Error handling correction

Prisma 6.19.3's RequestHandler rethrows initialization errors without carrying
errorCode. Direct $connect preserves the native code. The API explicitly connects
before handlers execute and classifies only the known connection-error allowlist,
using code or initialization errorCode. It does not inspect arbitrary error prose,
retry requests, queue failed writes or fall back to SQLite.
Programming errors, unknown initialization errors and integrity errors remain
internal failures; they are not broadly converted to service unavailability.
Health, state and writes return HTTP 503 for actual connection unavailability.
The existing DATABASE_UNAVAILABLE body code is preserved for UI/API compatibility.
Error logs contain only sanitized recognized codes, never raw exceptions.

## Actual verification

- 31 API/database tests, 8 UI/i18n tests and 5 public-security policy tests passed:
  44 automated tests total. Workspace typecheck and both API/web builds passed.
- A real Prisma client and isolated PostgreSQL-compatible engine exercised
  unreachable transport, reconnection and normal operation. Failed writes did
  not reappear when the server returned. A separate isolated transport-failure
  check of the application handlers returned 503 for health, state and writes;
  real PostgreSQL snapshots and SQLite bytes remained unchanged.
- Live runtime-only CRUD exercised fixture agents, tasks, approvals and reports.
  API restart confirmed the PostgreSQL task persisted. Bodyless DELETE returned
  204; the linked report remained with taskId null before explicit fixture cleanup.
- Cleanup checked the exact recorded fixture IDs, titles, source identifiers and
  FK relationships. All test rows were removed; original mapped data still matches.
- A separate ephemeral Chrome profile exercised the production build in tr-TR
  and en-US: nine agent cards, agent details, four empty task columns, three
  approvals, reports and the office. WebGL actually rendered; a real pointer drag
  changed the office camera image. Screenshots were inspected. Turkish was restored
  in the test profile; the owner's real profile/preferences were never changed.
- Runtime identity and server version were queried. Runtime schema CREATE and
  migration-history SELECT are denied. No role/schema migration was run.
- Source SQLite, its verified backup and manifest still agree. The existing native
  PostgreSQL archive hash is unchanged; the previously completed real native
  restore was reused as evidence, not rerun. Migration approval flags remain false.

## Final PostgreSQL application counts

| Table | Rows |
| --- | ---: |
| Agent | 9 |
| Task | 0 |
| Activity | 3 |
| Approval | 3 |
| StudioSettings | 2 |
| AgentReport | 3 |
| Studio | 3 |
| ApplicationSetting | 0 |
| ArtifactReference | 0 |
| ExecutionJob | 0 |

Remaining fixture records: 0. No real records were edited or removed by acceptance
tests. No Python, publishing, vault/media changes or unrelated process termination.

## Observed limit and retained compatibility

One idle/cold health request reached the existing three-second query deadline and
returned 503. Subsequent read-only health/state checks returned 200 after recovery.
No write was attempted during that failed readiness check. It is documented as an
operational observation, not hidden by retrying a failed write or weakening TLS.

SQLite remains supported as an explicitly selected backend for separate deployments
and isolated tests. This PostgreSQL deployment never switches to it automatically.
The existing verified-cutover startup guard still reads the preserved original
SQLite snapshot to check its fingerprint; keep that source file until a separately
reviewed finalization changes the guard. Normal CRUD uses PostgreSQL exclusively.

## Running the app

The application is currently running. After normally stopping only the existing
Creator HQ processes, start from the repository root with:

~~~powershell
npm run start
~~~

API: http://127.0.0.1:4100 ; UI: http://127.0.0.1:3000.
The active configuration is private and Git-ignored; do not copy it into examples.
Stop Creator HQ before client regeneration/build to avoid Windows engine-DLL locks.
No API keys, migrations or data transfers are needed for normal startup.

[Prisma 6.19.3 RequestHandler source](https://github.com/prisma/prisma/blob/6.19.3/packages/client/src/runtime/RequestHandler.ts) ·
[Native restore evidence](native-restore-result.md) ·
[Earlier acceptance status](cutover-verification.md)

[English README](../README.md) · [Turkish README](../README.tr.md)
