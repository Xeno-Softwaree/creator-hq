# Database backup, recovery and rollback

> Historical administration runbook: Phase 1.2 cutover/restore is complete. For a new machine use [current PostgreSQL installation](postgresql-installation.md). Phase 1.3 candidate deployment still requires approval.

[Migration runbook](database-migration.md) | [English README](../README.md) | [Türkçe README](../README.tr.md)

## Independent backups

Supabase Free is not treated as a guaranteed backup service. Keep local timestamped application-schema backups in the operator-configured BACKUP_DIR, independent of the hosting provider. Restrict Windows folder access and protect any off-device copies according to the operator's privacy policy; Node file modes alone do not establish Windows ACL protection.

SQLite backups are created with the native SQLite backup API and verified by opening the copy, checking integrity, counts, IDs/relationships, timestamps and normalized field fingerprints. They include a private manifest. The original database is opened read-only and is never overwritten by the backup command.

For PostgreSQL, install trusted PostgreSQL client utilities (`pg_dump`, `pg_restore`, and `psql`) compatible with the server version. The installed dump client must support the server's major version. Use the [official Windows download entry](https://www.postgresql.org/download/windows/) and [pg_dump reference](https://www.postgresql.org/docs/current/app-pgdump.html). This implementation does not install system services or schedule jobs automatically.

```powershell
npm run db:backup:postgres -- --check-tools
npm run db:backup:postgres
npm run db:backup:postgres -- --list-expired
```

The backup command uses DIRECT_URL from the private staging environment, a direct/session connection, verified TLS and PostgreSQL child-process environment variables. Passwords are not command-line arguments or script literals. It dumps only creator_hq in custom format without owner/privilege restoration. The partial output becomes a final timestamped archive only after the PGDMP signature and `pg_restore --list` checks succeed. Metadata states `archiveReadable=true`, `restoreTested=false`; archive listing is not a full restore test.

BACKUP_RETENTION_DAYS is configurable (default 30). `--list-expired` produces a review list; **no automatic deletion** occurs. Keep at least one independently restore-tested backup, plus pre/post-change backups. Manual daily backups while data changes are an operator policy recommendation, not a running schedule or promised RPO. No recurring task or external job is created.

## Verify a restore in isolation

1. Obtain explicit operator approval and an empty disposable PostgreSQL database/project or local instance. Never use the production target for a restore drill, and never create a new Supabase project automatically.
2. Recreate the restricted role securely using the reviewed bootstrap procedure. Restore with `pg_restore --exit-on-error --no-owner --no-privileges`, using credential environment variables from a secure local session. Do not use clean/drop/create options against existing data.
3. Because the dump intentionally omits grants, reapply only the reviewed creator_hq schema/table runtime grants and public/anon/authenticated revocations from the migration's security section. Preserve restored RLS policies; never rerun the entire create-table migration over restored objects.
4. Run the security preflight, compare counts/IDs/content fingerprints against the corresponding backup report, and test application read/write workflows. Record archive checksum, tool/server versions, restore destination identity, results and recovery duration privately.
5. Only then mark that backup restore-tested. If a command or comparison fails, retain the failed evidence, report failure and do not use that archive as the sole recovery copy.

## Controlled application rollback

Before cutover, retain the original SQLite file, verified timestamped copy/manifest, tested SQLite-compatible application source/build and a secure copy of active configuration. This repository has no automatic source version rollback or automatic credential rewriting.

If rollback is required:

1. Stop the API or set DATABASE_READ_ONLY=true to freeze writes; preserve PostgreSQL and any post-cutover changes.
2. Review divergence with the operator. Any new PostgreSQL tasks/approvals/profile edits are not present in the original SQLite file. Do not erase them or automatically restore an old snapshot over new data.
3. In active `.env`, restore DATABASE_PROVIDER=sqlite and the original file URL. Remove/disable the cutover flag and verification-file selection. Keep staging credentials separate.
4. Run the SQLite-capable build and restart the API on loopback. Check health, existing profiles/history, UI languages, board, approvals and persistence.
5. Plan any necessary reverse reconciliation separately, with backups and explicit review. Never invoke migrate reset, force-reset, table deletion or a blind database-file overwrite as a rollback shortcut.

No PostgreSQL archive, restore drill or live rollback is claimed until those operations actually execute and verify successfully.
