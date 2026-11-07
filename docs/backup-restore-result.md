# PostgreSQL backup and restore gate

Date: 2026-11-06. Status: archive created; actual restore NOT verified; cutover blocked.

## Completed checks

The existing backup CLI ran pg_dump 17.11 using the verified administrative
Session Pooler connection with native verify-full and the configured CA.
The custom-format archive contains only creator_hq. It is 31,689 bytes.
Its PGDMP header, pg_restore 17.11 --list output and expected schema/table entries
were verified. SHA-256 remained unchanged after the test attempts.
The archive and its sidecar have restricted Windows ACLs for the current operator,
SYSTEM and Administrators. Existing SQLite backups were not changed or deleted.
Private artifact paths and hashes are recorded only in ignored local evidence.

The existing tool intentionally excludes ownership, privileges and cluster roles.
A recovery procedure must prepare the runtime role and reapply the reviewed grants
separately. Archive readability is not evidence of successful database restoration.

## Actual restore attempts and blockers

The installed PostgreSQL 17.11 binaries include initdb, postgres and pg_ctl, but
the server data file postgresql.bki is absent. initdb failed before creating a
usable native test cluster. No existing database service was changed.

The already installed PGlite PostgreSQL 18.6 WASM engine was then used as an
isolated loopback target for a real pg_restore 17.11 archive restore attempt.
The COPY-stage operation did not complete. Only the positively identified
pg_restore child belonging to this test runner was stopped; its in-memory server
was then closed. No live restore, reset or data repair was attempted.

Local launcher path and variable errors were corrected during these attempts;
they do not constitute successful restore evidence. The backup sidecar continues
to state restoreTested=false. No restored-record equivalence is claimed.

## Final read-only source/target comparison

Agent 9; Task 0; Activity 3; Approval 3; StudioSettings 2; AgentReport 3.
Studio retains 3 rows; ApplicationSetting, ArtifactReference and ExecutionJob
remain empty. Full mapped fields, IDs, timestamps and relationships match the
original SQLite snapshot. Source, verified SQLite backup and manifest still match.
No new source records were detected. Migration approval flags remain false.
The active application remains on SQLite.

## Required next action

Provide a complete local native PostgreSQL test installation, including its server
support/share files, then restore this existing verified-hash archive into an
isolated loopback cluster. Do not redump unnecessarily or restore into Supabase.
Only after a successful real restore, full comparisons and refreshed source/target
verification should final explicit application-cutover approval be requested.

Primary references:
[pg_dump 17](https://www.postgresql.org/docs/17/app-pgdump.html) ·
[pg_restore 17](https://www.postgresql.org/docs/17/app-pgrestore.html)

[Transfer result](data-transfer-result.md) ·
[English README](../README.md) · [Turkish README](../README.tr.md)

## Subsequent verified outcome

The approved EDB extract-only procedure and real native PostgreSQL 17.11 restore have now passed. The actual bootstrap filename is postgres.bki. See [verified native restore](native-restore-result.md). Historical failed attempts above do not represent the current restore gate.
