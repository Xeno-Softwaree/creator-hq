# Phase 1.2 final migration preparation

[Turkish configuration instructions](../README.tr.md#son-geçiş-öncesi-özel-yapılandırma) | [Migration runbook](database-migration.md) | [Recovery](database-operations.md)

## Actual state and blocking configuration

The operator reports verified PostgreSQL 17.11 administrative AND runtime connections through Session Pooler 5432, verified TLS and the expected LOGIN-only runtime flag. No connection in this assistant run is inferred from that report. Active application configuration remains SQLite.

In the inspected ignored staging file, DATABASE_URL, DIRECT_URL and SUPABASE_PROJECT_REF are empty. Its source and backup manifest fields are configured; all four migration approval/freeze flags remain false. No inherited database URL variables were present. The read-only CLI was actually run and stopped with DATABASE_URL_REQUIRED before opening a live connection. The previously suggested per-user CA path does not exist; the operator must use the actual certificate path from the successful TLS test. No certificate content or credentials were printed or modified.

## Configure locally before live read-only checks

Edit only apps/api/.env.migration, in a trusted local editor without cloud/AI capture. Keep it ignored by Git and restrict local read permissions to the operator and trusted system administrators. Do not paste the file, its URLs or passwords into chat, issue text, terminal commands or screenshots. Git ignore does not encrypt the file.

Copy the actual URI from the existing project's Connect → Session Pooler dialog directly into the private file, not the terminal. Use it as the endpoint template for both DATABASE_URL and DIRECT_URL. Do not change existing SQLite source/backup fields or replace the entire file.

| Setting | Value to enter privately |
| --- | --- |
| DATABASE_URL | PostgreSQL URI with creator_hq_runtime.PROJECT_REF username and the existing runtime password; actual pooler host, port 5432, database postgres |
| DIRECT_URL | Same endpoint, but postgres.PROJECT_REF username and the existing administrative database password |
| SUPABASE_PROJECT_REF | Actual project reference; not the display name |
| sslrootcert in BOTH URLs | URL-encoded absolute path to the trusted CA actually used in the successful TLS test; Windows forward slashes simplify path handling |
| PG_DUMP_BIN / PG_RESTORE_BIN | Quoted absolute paths to the installed PostgreSQL 17 executables; use forward slashes in dotenv values |

Preserve all unrelated staging settings. Password components must be percent-encoded once, locally, before inclusion in a URI. Encode the password component, not the entire URI. For example, reserved characters @, # and percent become %40, %23 and %25; do not blindly replace percent again after encoding. Never use an online encoder or a shell expression that prints the password/encoded result. Do not reset either role's password to work around URL formatting.

Both Prisma 6.19.3 URLs must include:

    schema=creator_hq&sslmode=require&sslaccept=strict&connect_timeout=10&pool_timeout=10&socket_timeout=20&connection_limit=5

Add the encoded sslrootcert parameter to each. This is the installed Prisma 6 connector's strict configuration, distinct from native psql/pg_dump verify-full. No transaction pooler/6543 or pgbouncer=true is used here. Active apps/api/.env must remain DATABASE_PROVIDER=sqlite with its existing file URL. Do not add a PostgreSQL URL to frontend variables.

Keep MIGRATION_SCHEMA_APPROVED=false, MIGRATION_DATA_APPROVED=false, MIGRATION_PROBE_APPROVED=false, MIGRATION_SOURCE_FROZEN=false. Do not enable DATABASE_CUTOVER_APPROVED. On completion tell the assistant only that local configuration is ready; do not send the values.

## Verified local source and backup

The original SQLite and the actual backup referenced by the private manifest were reopened read-only and passed integrity/normalization checks. The manifest's fields/IDs, backup fingerprint and current source fingerprint matched. A second source read was stable and the source database's bytes were unchanged by inspection. Private evidence is stored under ignored .local/phase12/final-source-verification-*.json.

| Source model | Current source | Verified backup |
| --- | ---: | ---: |
| Agent | 9 | 9 |
| Task | 0 | 0 |
| Activity | 3 | 3 |
| Approval | 3 | 3 |
| StudioSettings | 2 | 2 |
| AgentReport | 3 | 3 |

Matching normalized fingerprint:

    36e5c91206078616e45ea67a1ffce0dbc2124129b74a1c91d51e605b32d1cc74

This proves source/backup consistency at inspection time, not a Supabase transfer. Recheck and take a fresh verified backup if SQLite receives subsequent writes. Final data transfer requires an operator-confirmed source-write freeze; no freeze or source mutation was performed now.

## Reviewed migration

The separate PostgreSQL Prisma schema validates successfully with installed Prisma 6.19.3; schema validation used harmless local-only URL placeholders and did not connect. Existing logical IDs/fields are preserved. The initial migration creates ten private-schema tables, indexes, restrictive relations, UTC timestamps and status checks, enables RLS and grants runtime CRUD explicitly on the ten application tables. It does not grant migration-history access, permanent CREATE or administrative roles. Default/job constraints keep execution disabled.

The migration also inserts three static Studio rows (HQ, Niko, Son Yedek) as schema reference data; these are part of the schema approval, not a claim of owner-data transfer. ApplicationSetting, ArtifactReference and ExecutionJob are initially empty. The existing six source models are transferred separately only after data approval. All ten application-table counts must eventually be recorded: the six source counts/IDs/fields/relationships must match; the four additional metadata tables must be reconciled with their documented initial state.

Reviewed initial file:

    apps/api/prisma/postgresql/migrations/20261106000100_phase12_initial/migration.sql

Current SHA-256:

    8edd3dd1f2b5d9e9f949c3c2abad73a1504a8b79e1539706ccb1f4a942410d2a

No live migration or alteration to that migration file occurred in this preparation. Before applying it, live read-only catalog inspection must confirm intended owner, empty namespace (including routines/types, not just tables), runtime membership/options, current ACLs and global/scoped defaults. Schema-local revocations cannot cancel global grants. Unexpected existing objects/defaults require review; no blanket platform repair or destructive command is permitted. Do not rerun NOLOGIN setup scripts against the now LOGIN-enabled runtime.

## Approval and command sequence

1. **Already authorized: read-only validation.** Once private configuration is ready, run npm run db:migrate -- --check-connection. Review the prepared inspect-runtime-connection.sql and the relevant catalog/default-ACL inspection queries. The empty schema has no table CRUD/RLS result yet; avoid the preparation-only NOLOGIN assessment when interpreting historical audit output. Do not use --probe-write.
2. **Separate schema approval.** Present the reviewed initial SQL, hash, expected ten tables and three Studio reference rows. Only after explicit approval set MIGRATION_SCHEMA_APPROVED=true and run npm run db:migrate -- --apply-schema. Return that flag to false after the authorized action. On error preserve evidence and do not reset, delete or blindly retry migration history.
3. **Read-only post-schema preflight.** Run npm run db:migrate -- --preflight; inspect actual grants, RLS, migration history and table counts. No default data transfer or write probe is implied by this step.
4. **Separate transfer/write-probe approval.** First confirm frozen SQLite writes and a fresh matching backup. Explicitly disclose that the data command also runs a temporary CRUD probe inside a deliberately rolled-back transaction. Only after transfer/probe approval set the corresponding DATA/PROBE/SOURCE_FROZEN gates and run the reviewed dry run and then --apply-data. The transfer inserts missing rows only and rejects conflicting/unrelated records; it never overwrites owner data. Restore approval flags to false after the approved action. Compare every source ID/field/count/status/relationship and all ten target table counts. Preserve the private receipt.
5. **Backup and recovery evidence.** After access/data are available, create the independent PostgreSQL archive, verify signature and archive listing/checksum, and perform a separately approved isolated restore drill. Listing an archive is not a successful restore. Do not restore over production or create an external project automatically. Review scoped grants/RLS after restore because archive creation deliberately omits ownership/privilege restoration.
6. **Separate application cutover approval.** Ask only after connection/security, source/destination consistency, rollback-only runtime probe, backup and recovery evidence are complete. Keep active SQLite configuration unchanged until that approval. After cutover test real workflows, both locales, 3D office, nine profiles and persistence. Any delete/reset/rollback remains separately gated; preserve divergence after new PostgreSQL writes.

## Backup and tools evidence

psql, pg_dump and pg_restore at the standard PostgreSQL 17 installation location each returned 17.11. The existing backup CLI's --check-tools passed with temporary process-only executable-path settings. No credential was supplied for that check and no archive was created. PATH in the running assistant process is not relied on; configure the two private PG_*_BIN fields.

A real PostgreSQL archive and restore drill have NOT been performed. Native tools being available does not prove database read permissions or recoverability. Recovery runbook: docs/database-operations.md. Destructive cleanup/create/reset options are not part of the plan. Restore writes require explicit approval and an identified isolated destination.

No Data API toggle, publication/push, paid service, agent execution, vault/media operation, Python execution or application database cutover occurred.

## Actual local check results

Root typecheck passed. All 12 migration/security tests and 5 root policy tests passed. Public audit scanned 83 candidate files with zero findings. Tests use isolated fixtures, not the operator database; they do not certify hosted TLS/permissions. This preparation changed documentation and private local inspection evidence only; no application rebuild/restart or active provider change occurred. Live post-cutover UI/build/regression validation is pending the separate authorized stages.
