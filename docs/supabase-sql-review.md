# Final SQL security review — local preparation only

[Turkish operator instructions](../README.tr.md#son-sql-güvenlik-kontrolü) | [Access preparation](supabase-access.md) | [Migration runbook](database-migration.md)

## Decision and approval boundary

**Historical SQL Editor issue, resolved for the reported setup:** the earlier bidirectional membership guard rejected PostgreSQL 17 automatic administration. The two local setup files now permit only the measured postgres recipient with ADMIN true, INHERIT false, SET false and bootstrap grantor OID 10; every membership granted TO runtime and unexpected recipient remains rejected. The operator subsequently reported successful role/empty-schema creation on PostgreSQL 17.11. No platform membership was changed by the assistant. Password, LOGIN, runtime authentication and subsequent migration/cutover remain separate unapproved steps; see the [current connection preparation plan](supabase-connection-plan.md).

Do not execute preparation SQL against the hosted project yet. This review prepares local files only. No live inspection, SQL, password creation, LOGIN change, data transfer or cutover is authorized or performed. Python is not used. Existing credentials, SQLite and its backup are not changed.

The previous per-schema default-privilege revocations were insufficient to establish safety: PostgreSQL adds schema defaults to global defaults; it cannot subtract a global grant with a per-schema REVOKE. Global defaults belong to the object creator, not automatically to the role's memberships. A new function/procedure normally receives PUBLIC EXECUTE even when pg_default_acl has no row. Global/schema defaults do not change permissions on existing objects.

## Prepared SQL

All paths below are relative to apps/api/prisma/postgresql/security/.

| File | Purpose | Database mutation |
| --- | --- | --- |
| inspect-security.sql | Owners, role flags, both membership directions and reachable roles, effective database/schema access, table/column/sequence/routine ACLs, RLS, object definitions and global/scoped future defaults | None; READ ONLY transaction |
| inspect-existing-data.sql | Exact physical-table row counts as NOTICE messages, without row content; skips views/materialized views/foreign tables | None; READ ONLY transaction; DO executes only SELECT and emits NOTICE |
| bootstrap-role.sql | Create a missing restricted NOLOGIN role; reject unsafe existing LOGIN/admin flags or memberships in either direction | Role creation only; requires separate approval |
| prepare-schema.sql | Prepare an empty private schema with runtime USAGE; stop on unsafe role/ownership/ACL/defaults or existing objects | Private empty-schema privileges only; requires separate approval |

The inspection scripts do not select password hashes or secret role-setting values. Role-setting names are reported. Catalog definitions, names and counts can still be private; keep the output out of Git and chat unless reviewed. Statement/lock timeouts bound inspection. They are prepared for an authorized administrative inspector, not automatically executed by the application.

The data script uses row_security=off only to make incomplete RLS-filtered counts fail; it does not grant BYPASSRLS or disable any table policy. Permission/RLS failures emit COUNT_UNVERIFIED, never a false zero. Other failures abort. NOTICE output must be visible in the client. Counts use ONLY: partition parents normally have zero physical rows; local partitions are counted separately. Descendants are not implicitly traversed, avoiding a foreign child scan. These are per-relation counts, not a total. Foreign relations/views are skipped and remain unverified. Do not execute untrusted routines to inspect them.

## Stop conditions

- Missing/wrong administrative owner, runtime ownership or effective permanent CREATE privileges.
- Runtime LOGIN before separate approval, elevated flags, or either direction of membership. NOINHERIT does not itself prevent SET ROLE. Automatically assigned membership on a hosted PostgreSQL version must be reviewed, not silently removed.
- Any existing private-schema object, even an empty table, only Prisma history, a routine/type/operator or an unexpected relation. Do not adopt, drop, repair or overwrite it automatically.
- Existing schema grants other than owner privileges and non-grantable runtime USAGE. Existing service_role/system-role access is preserved by stopping rather than revoking it.
- Non-owner global table/sequence/schema defaults for the intended creator. These may be legitimate Supabase defaults: do not issue global REVOKE to make the guard pass.
- Explicit non-owner scoped defaults in creator_hq for any creator. These require individual review rather than blanket changes.
- An inspection finds unexpected data, object owners, policies, grant options, column grants, routines or migration-history access. A known table name does not establish compatible column types, defaults, constraints or data.

Failing a guard does not authorize remediation. Keep writes blocked and prepare a separately reviewed plan. A populated schema needs a compatibility/history/data review, not a rerun of empty-schema preparation. Scripts cannot prevent another administrator changing defaults later; repeat inspection immediately before any future approved deployment.

## Future tables, sequences and routines

The initial Prisma migration creates ten application tables and indexes/constraints. IDs are text/CUID generated by Prisma; there are no new sequences, functions or procedures. Runtime receives explicit SELECT/INSERT/UPDATE/DELETE only on the ten application tables; no migration-history grant. No sequence/function privileges are needed by this migration.

Preparation stops on unsafe global table/sequence defaults instead of attempting an ineffective schema-local cancellation. It never modifies global owner defaults, another schema, service_role, Supabase system-role attributes or their memberships. Its schema-local revocations apply only to the intended owner's future objects; they do not certify every possible creator.

Built-in global PUBLIC EXECUTE remains a **future-routine review requirement**, not a resolved finding. The private schema denies public API roles USAGE, but runtime has USAGE and can therefore execute a later PUBLIC-granted routine. A SECURITY DEFINER routine could expand its authority. Before introducing any routine, review its owner, body, search_path and ACL; revoke undesired privileges on that specific object in the same creation transaction before commit, or design a separately approved dedicated owner/default policy. Do not globally revoke function EXECUTE from a shared Supabase owner: that could affect unrelated future objects and platform behavior. The current preparation creates no routines, so it does not attempt that global change.

## Prisma compatibility

Use the same owner for schema preparation and future Prisma migrate deploy. Do not grant runtime schema CREATE or object ownership. No initial migration file is edited by this final review. Application migration remains a separate, explicitly approved operation, tracked through _prisma_migrations; do not paste it into SQL Editor. After it exists, the empty-schema preparation intentionally stops. Use read-only inspection and reviewed forward migrations thereafter.

The CLI --check-connection is a narrow connectivity/role check; it does not substitute for these object/default-ACL/data inspections or dashboard Data API review. Data API remains disabled by operator report and was not accessed. A trusted administrative owner/BYPASSRLS account can bypass RLS; backend-wide runtime policies are not multi-tenant authorization.

## Local verification

Isolated PGlite fixtures verify global table/sequence defaults cause a stop without changing shared-role/default state; scoped routine grants are rejected; existing objects/data/ACLs and unsafe LOGIN/memberships are preserved on rejection; the read-only audit runs and reports global routine defaults, objects and exact aggregate counts without row content. The test deliberately reproduces the ineffective per-schema routine REVOKE and confirms PUBLIC EXECUTE still exists. These fixture-only grants, objects and role changes are not operations on Supabase.

Live catalog contents and data remain unknown. No result here certifies a hosted schema safe for deployment. Current test and source-audit results are recorded in the Turkish operator instructions.

References: [PostgreSQL ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html), [PostgreSQL built-in default privileges](https://www.postgresql.org/docs/current/ddl-priv.html).
