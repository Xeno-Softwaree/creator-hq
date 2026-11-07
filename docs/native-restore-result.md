# Verified native PostgreSQL 17 restore

Date: 2026-11-06. Status: actual native restore passed; application cutover not started.

## Package extraction

The signed official EDB 17.11-5 Windows x64 installer was revalidated by
Authenticode and its pinned local SHA-256. Only the installer was elevated via UAC.
It exited 0 using --extract-only 1, a separate ignored .local destination and
server/commandlinetools components. Runtime installation, shortcuts, pgAdmin and
Stack Builder were disabled. Original installed PostgreSQL binary hashes and
PostgreSQL service state remained unchanged. No service was registered.

The extracted postgres.exe is x64 and reports 17.11. All required bootstrap,
configuration, SQL, timezone/text-search files and plpgsql library were verified.
Correction to earlier reports: PostgreSQL 17 uses share/postgres.bki, not
postgresql.bki. Its source initdb file list was used for the corrected checks.

## Actual restore and comparison

The existing 31,689-byte custom archive was reused, without redumping or changing
the archive or its original sidecar. Archive list and pinned SHA-256 checks passed.

A unique ACL-restricted local test cluster was initialized with SCRAM authentication
and temporary test-only credentials. It listened exclusively on 127.0.0.1 at port
59753. Native pg_restore restored the archive using --exit-on-error,
--single-transaction, --no-owner and --no-privileges. No clean/reset was used.
The server reported version 170011. This was not a PGlite test.

| Restored application table | Rows |
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

All mapped fields, IDs, statuses, timestamp instants and relationships matched
the original SQLite snapshot. Studio records and the remaining empty tables
matched the live pre-test snapshot. Migration history, indexes, constraints and
RLS policy definitions also matched. There was no failed native restore to repair.

After testing, the live source/target data was compared again read-only and still
matched. SQLite, its verified backup, backup manifest and both application and
migration environment files retained identical before/after hashes. Supabase was
read-only throughout. The active application remains on SQLite.

Clients disconnected and only this temporary cluster was stopped via its explicit
data directory. Successful shutdown was verified by pg_ctl. Its private test files
were retained under .local; the original archive was preserved.

## Separate security recovery, actually tested locally

This archive excludes ownership, ACL grants, passwords and cluster roles. It
preserves RLS definitions that reference creator_hq_runtime. Therefore restoration
to a fresh cluster needs explicit, separate security preparation:

1. Create the required runtime role locally before restoring. For this test it was
   NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOBYPASSRLS,
   NOREPLICATION. No production credential was used.
2. Restore objects as the approved administrator/owner.
3. Separately grant schema USAGE and explicit SELECT/INSERT/UPDATE/DELETE on the
   10 reviewed application tables. Do not grant schema CREATE, database CREATE,
   TRUNCATE or migration-history access.
4. Validate under SET LOCAL ROLE in a read-only transaction: all source data was
   visible through RLS, CRUD grants existed, permanent CREATE/TRUNCATE were denied,
   and _prisma_migrations remained inaccessible. These local checks passed.

Real disaster recovery still requires separately authorized production credential,
LOGIN, TLS and configuration procedures. Do not infer that this schema archive
backs up those external settings. No live role or grant was modified by this test.

## Next boundary

The backup/restore gate is satisfied. Request final explicit operator approval
before editing the active database configuration, restarting Creator HQ for
PostgreSQL, or running live application workflow tests. Refresh the source/target
comparison at that time: SQLite is still the active store and may receive new data.

The existing standard-build DLL EPERM issue was not retested or resolved by this
restore procedure. A successful restore is not a claim of completed UI acceptance
or application cutover. No Python, GitHub push, vault or media changes occurred.

[PostgreSQL 17 initdb source](https://github.com/postgres/postgres/blob/REL_17_11/src/bin/initdb/initdb.c) ·
[EDB extract-only documentation](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/command_line_parameters/) ·
[Earlier archive/test status](backup-restore-result.md)

[English README](../README.md) · [Turkish README](../README.tr.md)
