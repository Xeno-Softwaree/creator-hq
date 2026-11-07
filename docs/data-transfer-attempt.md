# Phase 1.2 data transfer attempt

Date: 2026-11-06. The operator separately authorized only SQLite record transfer.
The existing gated migration CLI was invoked once with --apply-data. Approval flags
were enabled only in the child process; the ignored environment file was unchanged.
No application cutover, schema change, reset, destructive repair or retry ran.

## Pre-transfer checks

The original SQLite, verified backup and manifest snapshots matched, with:
Agent 9, Task 0, Activity 3, Approval 3, StudioSettings 2, AgentReport 3.
The source uses rollback-journal delete mode. A read-only SQLite transaction held
a shared read lock during the attempt, preventing concurrent write commits; the
lock was released on exit without changing the source.

The 3 existing Studio reference rows exactly matched the reviewed migration.
All source studio references resolved to those IDs. There is no Studio slug field.
No reference row was deleted, renamed or overwritten. All six transfer destination
tables were empty; the three additional application tables were also empty.
The existing security preflight and transfer dry run passed.

## Failure and read-only diagnosis

The existing CLI returned DATABASE_MIGRATION_FAILED and exit code 1. It suppresses
the underlying raw exception to protect credentials. No second transfer ran.

A subsequent read-only EXPLAIN (without ANALYZE, therefore without executing the
INSERT) on the existing Activity insert reproduced a parameter type error:
Prisma P2010, PostgreSQL SQLSTATE 42804. Prisma binds the normalized ISO timestamp
as text; the PostgreSQL timestamptz destination requires an explicit compatible
parameter conversion. This identifies a concrete defect in the existing insert
path; the original CLI did not preserve its underlying SQLSTATE.

No source fix was applied after failure. A future reviewed correction should bind
or cast timestamp parameters appropriately and add a real Prisma-engine regression
check, since the isolated PostgreSQL-compatible test accepts the current binding.

## Actual state after failure

| Table | PostgreSQL rows |
| --- | ---: |
| Studio | 3 |
| Agent | 0 |
| Task | 0 |
| Activity | 0 |
| Approval | 0 |
| StudioSettings | 0 |
| AgentReport | 0 |
| ApplicationSetting | 0 |
| ArtifactReference | 0 |
| ExecutionJob | 0 |

No partial imported records remain. The schema migration history still has its
single completed migration. ApplicationSetting remains empty after the existing
transactional runtime probe. Source and backup still match the verified manifest;
approval flags remain false and the active application still uses SQLite.

Full ID/field/relationship equivalence cannot be claimed: transfer did not succeed.
One existing isolated idempotency/conflict test passed, but that is not proof of
a successful live transfer.

## Next boundary

Stop all live writes. Review the timestamp-binding correction and obtain a fresh
transfer retry approval. Application cutover remains separately gated and is not
ready for approval. No PostgreSQL backup or restore was run in this attempt.

[Schema migration result](schema-migration-result.md) ·
[English README](../README.md) · [Turkish README](../README.tr.md)

## Local correction after this failed attempt

The timestamp binding defect was subsequently corrected and tested only in isolation. Live retry remains unapproved: [local correction](timestamp-transfer-fix.md).
