# Phase 1.2 live data transfer result

Date: 2026-11-06. The operator explicitly approved a single live retry using the
locally tested timestamp correction. Only the existing gated data-transfer CLI
was invoked; no schema migration, reset, destructive repair or cutover ran.

## Actual verified PostgreSQL counts

| Application table | Rows |
| --- | ---: |
| Studio | 3 |
| Agent | 9 |
| Task | 0 |
| Activity | 3 |
| Approval | 3 |
| StudioSettings | 2 |
| AgentReport | 3 |
| ApplicationSetting | 0 |
| ArtifactReference | 0 |
| ExecutionJob | 0 |

All six source-mapped tables were empty before the attempt. The existing three
Studio reference rows matched the source references and were preserved exactly.

## Integrity and isolation

- Original SQLite, verified backup and manifest matched before transfer and after.
- A read-only SQLite transaction held a shared lock in rollback-journal delete
  mode during transfer; it was released afterward. No source file was modified.
- Data insertion used the existing serializable PostgreSQL transaction. Verification
  within that transaction succeeded before commit. There was one live transfer run.
- Five timestamp columns used explicit timestamptz parameter casts; all mapped
  fields, IDs, statuses, timestamp values and relationships matched the source
  snapshot fingerprint. No existing record was overwritten.
- A post-commit administrator snapshot independently matched the full source.
- A subsequent live dry run was read-only and reported an exact match. No second
  live apply was performed. Actual repeated-apply and rollback behavior had already
  passed isolated Prisma tests.
- The existing transactional runtime CRUD probe was rolled back and left no row.
- Source SQLite, backup, manifest, active environment and migration environment
  retained identical before/after file hashes.
- Role attributes, memberships and migration history remained unchanged. Runtime
  restrictions, table RLS and absence of PUBLIC/anon/authenticated table grants
  were verified before and after.
- Approval flags were enabled only for data/probe/source-freeze in the child process.
  The migration file remained unchanged with flags false. Schema and cutover
  approvals were not enabled.

## Remaining boundary and risks

Creator HQ still uses SQLite. No application workflow or UI was tested against
live PostgreSQL in this transfer-only stage, and no application cutover is claimed.
If users subsequently change the active SQLite database, the verification receipt
becomes stale and the existing cutover fingerprint guard rejects it. A conflict
must be reviewed rather than overwriting destination records.

A PostgreSQL archive and isolated restore verification have not been performed
in this transfer-only stage. Complete those checks and refresh source/target
verification before any approved application switch. Data API settings were not
modified; SQL preflight cannot certify the dashboard exposure configuration.

Application cutover needs separate explicit operator approval. No secrets or
connection URLs were printed; sanitized evidence and the transfer receipt are
kept only in the Git-ignored local reports directory.

[Failed earlier attempt](data-transfer-attempt.md) ·
[Timestamp correction](timestamp-transfer-fix.md) ·
[English README](../README.md) · [Turkish README](../README.tr.md)
