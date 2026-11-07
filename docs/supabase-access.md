# Supabase connection and role preparation

[English README](../README.md) | [Turkish operator guide](../README.tr.md#supabase-bağlantı-ve-rol-hazırlığı) | [Migration](database-migration.md)

## Scope and status

**Latest operator report:** the restricted role and empty private schema were successfully created on PostgreSQL 17.11. The earlier setup hold below is historical context. Follow the [new password/LOGIN/connection preparation plan](supabase-connection-plan.md) for the current stage; no password, LOGIN, connectivity, migration or cutover approval has been given. Do not rerun preparation-only role scripts after a future LOGIN change.

**Historical pre-setup review:** read the [SQL security review](supabase-sql-review.md) before following any future execution step below. Global/scoped defaults and existing objects must be inspected separately. Preparation now rejects existing objects/unsafe ACLs and runtime LOGIN or memberships; future PUBLIC routine EXECUTE is not solved by a schema-local REVOKE. No live execution or LOGIN/password approval currently exists.

Preparation only. No live SQL, password change, data transfer or application cutover is authorized by this guide. The active SQLite environment and verified backup remain intact. All migration approval flags stay false. The staging DATABASE_URL, DIRECT_URL and SUPABASE_PROJECT_REF were empty when inspected. No database connection was attempted. PostgreSQL client utilities were not found in PATH. Python execution is prohibited by the project policy; these steps require no Python, additional npm dependencies or application rebuild.

## Connection mapping

Installed Prisma 6.19.3 uses the built-in PostgreSQL connector with schema-level url and directUrl. Keep the existing schema; do not introduce a Prisma 7 configuration migration.

| Variable | Session pooler setting |
| --- | --- |
| DATABASE_URL | Restricted user creator_hq_runtime.PROJECT_REF, its own password, dashboard pooler host, port 5432, database postgres |
| DIRECT_URL | Administrative user postgres.PROJECT_REF, its separate database password, the same copied pooler host, port 5432, database postgres |
| SUPABASE_PROJECT_REF | Exact project reference from the existing project's dashboard; this is not the project display name |

DIRECT_URL is the Prisma migration/backup setting name; an IPv4-compatible session pooler is accepted here. It does not imply an IPv6 direct endpoint. Do not use transaction port 6543 or pgbouncer=true for this selected configuration. Copy the real host from Connect; do not infer it from the region. The pooler username suffix is routing information; the SQL role remains creator_hq_runtime or postgres.

Build each URL privately from the dashboard Session Pooler template. Replace its username and password with the corresponding role. Required query parameters for BOTH Prisma URLs:

    schema=creator_hq&sslmode=require&sslaccept=strict&connect_timeout=10&pool_timeout=10&socket_timeout=20&connection_limit=5

Percent-encode reserved password characters locally, never using a website or a command that prints the result. Add sslrootcert with an encoded absolute path to a privately stored trusted CA certificate if certificate validation requires it. Relative certificate paths depend on the Prisma schema directory; absolute configured paths avoid ambiguity. Never use accept_invalid_certs or downgrade TLS. Prisma 6 uses require plus strict certificate verification; native psql/pg_dump use verify-full instead. A Supabase API key is not a database password.

Credentials belong only in ignored apps/api/.env.migration. Preserve active apps/api/.env as SQLite. Shell environment variables can override dotenv files: use a clean terminal without inherited DATABASE_URL/DIRECT_URL values. Do not print environment contents, use verbose Prisma engine logging, or copy credentials to frontend variables.

## Reviewable SQL and execution order (approval required)

1. Review security/bootstrap-role.sql: creates a missing NOLOGIN role with NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOBYPASSRLS and NOREPLICATION. It preserves existing roles rather than silently changing them. Inspect existing flags, memberships and grants before proceeding.
2. Review security/prepare-schema.sql: the SAME administrative owner intended for Prisma creates the private schema, revokes PUBLIC/anon/authenticated schema access, grants runtime USAGE only, and restricts default table privileges for objects created by that owner. It stops on a different existing schema owner or unsafe runtime role. It does not create application tables, modify other schemas, enable login or set a password. Review existing objects separately; this is not an automatic remediation for an already populated schema.
3. After explicit approval, the operator may execute these two files, in that order, in the existing project's SQL Editor as the intended administrative owner. Do not paste the initial application-table migration into SQL Editor: future schema deployment must use Prisma history tracking.
4. After separately approving credential/login setup, use a trusted local psql session as the administrator, with -W so the administrator password is prompted instead of included in arguments. Enable verified TLS using the dashboard host/CA. In that interactive session use the psql password prompt command below, then enable LOGIN. Neither password should enter shell history, SQL files, SQL Editor history or chat.

    \password creator_hq_runtime
    ALTER ROLE creator_hq_runtime LOGIN;

If psql is absent, obtain PostgreSQL client utilities from the official Windows download entry. Installing a database server/service is unnecessary for remote client use. No utility is installed by this preparation task. Reconnect after role/password setup; do not weaken authentication to bypass a pooler error.

The existing initial Prisma migration creates ten application tables, checks, foreign keys, scoped runtime policies and explicit SELECT/INSERT/UPDATE/DELETE grants. It grants no TRUNCATE, REFERENCES, TRIGGER, schema CREATE, role membership, grant option or migration-history access. The runtime role is not an object owner and cannot apply the reviewed administrative migrations. Default database TEMP access may still exist through PUBLIC; this does not authorize permanent application DDL. The read-only checker rejects database CREATE, user-schema CREATE, owned relations, elevated flags, memberships and migration-history access.

The initial migration's former ALL TABLES grant was narrowed before any live application. Do not edit or redeploy an already applied migration elsewhere; stop for a separately reviewed forward repair if any external installation has applied a different checksum. Administrative credentials remain trusted and powerful. RLS grants the single backend role all application rows; it is not multi-tenant end-user authorization. Data API being disabled does not protect direct SQL credentials. Keep it disabled and never expose creator_hq as an API schema.

## Read-only connectivity verification

After the operator-approved role setup and secure local configuration, from the repository root run:

    npm run db:migrate -- --check-connection

This mode validates both URL policies and performs only SELECT catalog/identity reads through the actual Prisma connector. It works before application tables exist. It prints booleans and fixed status codes, never URLs/passwords, and leaves all approval flags false. It neither sets a cutover receipt nor proves application-table readiness, Data API settings, backup validity or live write permissions. Administrative privileges for schema creation are reviewed separately; successful authentication alone is not a migration authorization.

After future approved schema deployment, the same check additionally rejects runtime access to _prisma_migrations. Full --preflight checks require application tables and RLS. Do not run --apply-schema, --apply-data or --probe-write during this preparation-only stage. Do not change active DATABASE_PROVIDER or DATABASE_CUTOVER_APPROVED.

## Verification record

Isolated PGlite tests execute role/schema scripts twice, confirm NOLOGIN and no application tables after preparation, apply the initial migration with a pre-existing administrative history table, and verify that restricted runtime access passes while history access, permanent schema CREATE, elevated role flags and identical administrative/runtime identities fail. These are isolated test roles, not changes to Supabase. Current command results are recorded in the Turkish README and operator response; live access and hosted permissions remain unverified.

## Official references

- [Supabase connection methods and custom pooler usernames](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase PostgreSQL roles](https://supabase.com/docs/guides/database/postgres/roles)
- [Prisma PostgreSQL connector v6, TLS and certificate parameters](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql)
- [Prisma v6 directUrl](https://www.prisma.io/docs/orm/v6/reference/prisma-schema-reference#directurl)
- [PostgreSQL Windows downloads](https://www.postgresql.org/download/windows/)

## Executed checks for this preparation

- Workspace confirmed before editing; installed Prisma is 6.19.3. No new dependency or application build was required.
- Root typecheck passed. All seven database migration/preparation tests passed; all five root policy/audit tests passed.
- Public source audit scanned 76 candidate files with zero findings. Git currently has no tracked files; ignored private environments were checked separately without displaying values. This does not certify future staged content or external history.
- All four staging approval/freeze flags remain false. DATABASE_URL, DIRECT_URL and SUPABASE_PROJECT_REF remain empty. Original SQLite and the previously verified backup are still present.
- PostgreSQL native tools were not found in PATH; none were installed. No live connection, hosted SQL, password/LOGIN change, schema deployment, data transfer or cutover was performed.
- No application rebuild/restart was performed. A local loopback health request was unavailable during this check; current running-application behavior was not revalidated in this preparation task.
- No dependency changes: the previously reported Prisma/config/deepmerge-ts high advisory chain remains unresolved; no new online npm audit was run in this task.
