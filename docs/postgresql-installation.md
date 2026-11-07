# PostgreSQL on a new Windows computer

[English README](../README.md) · [Turkish README](../README.tr.md)

This guide targets the Phase 1.3 candidate. Deployment to the still-running
Phase 1.2 installation requires separate approval.

## Connect to the existing project

Use Windows 11, Node.js 24+, npm, the reviewed checkout/lockfile and a WebGL browser.
No local PostgreSQL server or Windows service is needed to use Supabase.
Run npm ci from the checkout root. Preserve existing .env files. Only if absent,
create apps/api/.env and apps/web/.env.local from their respective examples.
The root .env.example is documentation, not an automatically loaded file.

Copy the real Session Pooler endpoint from the approved project's Connect dialog.
Use port 5432, database postgres, schema creator_hq and username
creator_hq_runtime.PROJECT_REF. Configure DATABASE_PROVIDER=postgresql,
DATABASE_URL and SUPABASE_PROJECT_REF privately. Confirm the approved project,
then set DATABASE_CUTOVER_APPROVED=true as explicit operator opt-in.
Keep DATABASE_READ_ONLY=true during first-machine verification; enable writes
only after operator acceptance and restart normally.

Never put an admin URL or DIRECT_URL in runtime, browser variables, command
arguments or chat. Encode only the raw password component once; never decode an
already encoded password or encode the complete URL.

Obtain the trusted CA from the approved project's Supabase dashboard. Store it
privately on this computer; URL-encode its actual absolute forward-slash path
once as sslcert. Prisma 6.19.3 uses sslmode=require and sslaccept=strict. Native
libpq uses sslrootcert/PGSSLROOTCERT and verify-full instead. Never disable
certificate verification or use accept_invalid_certs.

Use bounded URL parameters: connect_timeout=10, pool_timeout=10,
socket_timeout=20, connection_limit=5. The default total health budget is their
sum, 40 seconds. HEALTH_TIMEOUT_MS optionally sets 1000..60000 ms.
No keepalive worker, request replay or automatic write retry is added.

The Phase 1.3 candidate needs no SQLite file, historical receipt path or old
machine's directory layout to start PostgreSQL. Preserve existing migration
evidence, SQLite sources and backups; do not delete or distribute them.

## Build and start

Stop only Creator HQ before building its normal output directories to avoid
Windows DLL locks and Next.js cache contention. From the checkout root:

~~~powershell
npm run build
npm start
~~~

Build generates clients and compiles code without migrating or seeding data.
Before listening, startup validates PostgreSQL identity, schema, RLS, grants
and absence of runtime migration-history access with read-only queries.
A mismatch or failed connection stops startup without SQLite fallback.

UI: http://127.0.0.1:3000. Health: http://127.0.0.1:4100/health.
Both stay on loopback. Check profiles, studios, approvals and reports.
Saved UI language wins; studio content language remains independent.

Do not run db:setup, db push, migrate reset, seed or migration commands just
to connect another machine to an existing database. db:setup is only for an
explicitly separate SQLite deployment.

## Administration remains separate

Admin URLs and native-tool paths belong only in ignored .env.migration.
Later schema changes need a reviewed additive migration and separate approval.
Preserve checksums/history and runtime restrictions. ExecutionJob.enabled=false
remains enforced; real agents stay disabled.

No disaster-recovery scheduler, independent backup service or automatic restore
is added. That scope remains deferred until after the first test video.
