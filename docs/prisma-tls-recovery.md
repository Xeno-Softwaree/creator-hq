# Prisma 6.19.3 TLS recovery

## Root cause and minimal correction

The installed CLI and client are Prisma 6.19.3, with engine commit
c2990dca591cba766e3b7ef5d9e8a84796e47ab7. That engine's PostgreSQL URL parser
uses **sslcert** for the root CA file. Native libpq uses **sslrootcert** instead.
Using libpq's parameter in this Prisma engine did not load the supplied CA and
the actual Prisma connection failed with P1011 (TLS connection error).

Only the CA query-parameter name in DATABASE_URL and DIRECT_URL was changed in
the ignored local migration environment. Password bytes, encoded certificate
path, endpoints, roles, SQLite settings and false approval gates were preserved.
The decoded existing absolute Windows path already existed, used forward slashes
and had no residual percent encoding. No path rewrite or dependency upgrade was
necessary. Query parameters are decoded by the engine URL parser; do not
double-encode a certificate path.

Keep sslmode=require AND sslaccept=strict. require alone is not a certificate
verification policy in this engine. Never use accept_invalid_certs. The password
repair validator and local path checks now accept sslcert as well as the legacy
libpq spelling; they do not rewrite either URL or run a connection themselves.
The backup utility already maps either spelling to native PGSSLROOTCERT.

## Actual read-only results (2026-11-06)

- Original DIRECT_URL via Prisma Client: P1011.
- Same URL with only the CA parameter corrected: successful administrator query.
- Corrected DATABASE_URL: successful restricted runtime query.
- Same strict connection with an unrelated valid public root CA: rejected with P1011.
- Missing CA file control: rejected with P1011; file-not-found category.
- Prisma migration engine: migrate status connected and reported the one expected
  pending migration. Exit 1 is expected for unapplied migrations, not TLS failure.
- Actual database identity postgres; server_version_num 170011; schema creator_hq;
  schema owner postgres; application tables 0; migration history absent.
- Runtime LOGIN true; the other six flags false; outgoing role memberships 0;
  schema USAGE true, CREATE false.
- Original SQLite and backup integrity checks passed. Both data snapshots and the
  manifest tables match the verified manifest fingerprint. Their physical file
  hashes need not equal each other: a SQLite backup can have different page bytes.
  Source bytes were unchanged across the connection probes.
- All migration approval flags remain false. No migration, row transfer or cutover ran.

The server's pg_stat_ssl reports the Pooler-to-database hop (false in these
queries), not the client-to-Pooler TLS session. Client certificate validation is
demonstrated by the real strict Prisma success and unrelated-CA rejection; do not
claim the server-side row proves client TLS 1.3.

## Local verification and remaining boundary

Root workspace typecheck passed. The 22 targeted migration/security/password
tests passed from the API workspace. An initial invocation from the repository
root failed because these tests resolve fixtures relative to the API workspace;
rerunning from the documented workspace passed.
The standard API build failed while regenerating the existing SQLite client:
Windows EPERM renaming the Prisma engine DLL. No unrelated processes were stopped.
Do not treat this as a successful full build.

Fresh explicit operator approval is required before retrying the reviewed live
schema migration. Data transfer and application cutover require separate approvals.
Do not reset, repair destructively, change passwords or weaken TLS.

## Primary references

- [Installed engine URL parser](https://github.com/prisma/prisma-engines/blob/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/quaint/src/connector/postgres/url.rs)
- [Prisma data source SSL certificate examples](https://www.prisma.io/docs/orm/v6/prisma-schema/overview/data-sources)
- [Supabase native psql instructions](https://supabase.com/docs/guides/database/psql)

[English README](../README.md) · [Turkish README](../README.tr.md)
