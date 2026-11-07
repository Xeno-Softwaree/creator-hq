# Phase 1.2 live schema migration result

Date: 2026-11-06. Scope: the separately approved reviewed schema migration only.
The previously failed TLS attempt was retried once, using the existing migration CLI.
No reset, destructive repair, data transfer, cutover or process termination ran.

## Verified live results

- Migration: 20261106000100_phase12_initial, successfully finished; one applied step,
  no rollback marker. Recorded checksum matches the reviewed local SQL.
- Private schema: creator_hq, with 10 application tables and 1 administrative
  _prisma_migrations table. All 11 tables are owned by postgres.
- All 10 application tables have RLS enabled and one runtime_access policy each,
  scoped to creator_hq_runtime. Migration history has no runtime grants.
- 26 indexes including primary/unique indexes, 12 foreign keys, 8 check constraints,
  and 11 primary-key constraints including migration history.
- Runtime: schema USAGE allowed, schema/database CREATE denied; SELECT, INSERT,
  UPDATE and DELETE allowed on all 10 application tables; TRUNCATE, REFERENCES
  and TRIGGER denied. Actual runtime SELECT counts match administrator counts.
  No runtime write probe was performed in this schema-only stage.
- No PUBLIC/anon/authenticated table grants; anon/authenticated schema access denied.
- Role security flags and all role memberships remained unchanged.
- Studio has the 3 fixed reference rows included in the reviewed migration.
  The other 9 application tables have zero rows. No SQLite records were copied.
- Source SQLite, verified backup, backup manifest, active application environment,
  and migration environment all have identical before/after file hashes.
  Source and backup snapshots still match the verified manifest.
- The schema approval was enabled only in the migration child process environment.
  Approval flags in the local migration file remain false.
- Creator HQ remains on SQLite.

The local ignored evidence is stored separately from public documentation and
contains only sanitized catalog metadata, permissions, counts and integrity results.
The earlier [TLS recovery report](prisma-tls-recovery.md) describes the pre-migration state.

## Next approval boundary

SQLite data transfer requires separate explicit operator approval. The planned
transfer uses the existing gated infrastructure, validates all source table counts,
IDs and relationships, and must be verified before requesting application cutover.
Application cutover and any destructive rollback require their own approvals.
This schema-only operation did not run a PostgreSQL backup or restore.

[English README](../README.md) · [Turkish README](../README.tr.md)
