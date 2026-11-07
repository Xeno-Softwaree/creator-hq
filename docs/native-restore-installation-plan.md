# Native PostgreSQL 17 restore test: approval plan

Status: inspected only; no installation, extraction, service creation or cutover.
Date: 2026-11-06.

## Confirmed local installation

The installed EDB package is PostgreSQL 17.11-5. Its bin directory contains
postgres, initdb and pg_ctl, but its share directory is absent. Missing files
include postgresql.bki, postgresql.conf.sample, pg_hba.conf.sample,
pg_ident.conf.sample, postgres.description, postgres.shdescription,
system_views.sql, information_schema.sql and sql_features.txt.
An individual downloaded bki file is not a complete or safe repair. Use a complete
matching server distribution, including share, timezone/text-search resources,
libraries and extension metadata.

The installed installer directory contains support files, not the original
installation executable. No PostgreSQL 17 installer executable was found in the
checked Downloads, Desktop or temporary-directory locations. The uninstall
executable is not a substitute for the installer and must not be run.

## Preferred EDB route, subject to explicit approval

Use the original signed EDB 17.11-5 x64 installer if available. Otherwise obtain
the matching distribution from EDB's official download service, verify its
Authenticode signature and version, and inspect its --help before execution.

EDB documents --extract-only 1 as extracting binaries without performing an
installation. Prefer that mode with a separate ignored tools directory beneath
the application .local directory, including server and commandlinetools.
Exclude pgAdmin and Stack Builder; disable runtime installation and shortcuts.
Do not overwrite the installed Program Files distribution or change PATH.
Confirm the concrete installer supports these options before running it.
If it does not, stop and obtain approval for another concrete installation plan.
Do not fall back silently to a normal server installation.

No Windows service, service account, firewall change, global runtime installation,
automatic startup or use of port 5432 is approved by this plan. The normal GUI
server-installation route may configure a persistent service and therefore needs
separate explicit approval if ever selected.

## Restore execution after approval

1. Validate the extracted postgres/initdb/pg_ctl/pg_restore versions and required
   share files as a complete matching PostgreSQL 17 distribution.
2. Create a unique ACL-restricted temporary test directory under .local/phase12.
   Initialize an independent cluster with SCRAM authentication. Generate only
   temporary test credentials in memory; never put them in command arguments/logs.
3. Start it with pg_ctl, not pg_ctl register. Bind exclusively to 127.0.0.1 on an
   available non-5432 port. Capture its process identity and cluster directory.
4. Verify the existing custom archive SHA-256 against local evidence. Reuse it;
   do not redump or restore into Supabase. Prepare only its required local role.
5. Run pg_restore with --exit-on-error --single-transaction --no-owner
   --no-privileges against the explicit loopback host/port/database. Use only
   temporary local authentication, never the Supabase environment.
6. Compare restored counts, all mapped IDs/fields/timestamps/relationships, Studio
   rows, migration history, constraints, indexes and RLS policies. Compare source
   and target again read-only before requesting any future cutover approval.
7. Disconnect clients and stop only the identified temporary cluster with pg_ctl.
   Keep the original archive and SQLite backups. Do not stop existing services.

## Separate security recovery instructions

The current custom archive was created with --no-owner and --no-privileges and
does not contain cluster roles. It is a schema/data archive, not a full security
configuration backup. RLS policies can still refer to creator_hq_runtime.

Before restoring into a fresh isolated cluster, create that local role as NOLOGIN,
NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOBYPASSRLS, NOREPLICATION, with no
outgoing role memberships. Use the restore administrator as object owner.
After restore, separately apply the reviewed creator_hq USAGE and explicit CRUD
grants on the 10 application tables. Do not grant schema CREATE, TRUNCATE,
REFERENCES, TRIGGER or access to _prisma_migrations. Verify PUBLIC grants and
unintended inherited/global defaults are absent. Scope all such preparation to
the isolated cluster; never change Supabase roles or grants for this test.

A real disaster recovery also requires a separately approved credential/LOGIN
procedure, owner mapping, TLS setup and environment configuration. Do not reuse
the production password in the test cluster.

References:
[EDB command-line options](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/command_line_parameters/) ·
[EDB Windows installer](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/windows/) ·
[Backup state](backup-restore-result.md)

[English README](../README.md) · [Turkish README](../README.tr.md)

## Subsequent verified outcome

The approved EDB extract-only procedure and real native PostgreSQL 17.11 restore have now passed. The actual bootstrap filename is postgres.bki. See [verified native restore](native-restore-result.md). Historical failed attempts above do not represent the current restore gate.
