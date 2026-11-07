# Secure connection preparation after empty-schema setup

[Turkish operator steps](../README.tr.md#parola-login-ve-bağlantı-hazırlığı) | [Access mapping](supabase-access.md) | [Migration](database-migration.md)

## Status and approval gates

The operator reports successful live setup on PostgreSQL 17.11: restricted NOLOGIN runtime, seven false role flags, automatic postgres administration membership (grantor OID 10, ADMIN true, INHERIT false, SET false), private schema owned by postgres, runtime USAGE without CREATE, zero relations/routines. This is operator evidence, not a live connection performed by the assistant.

Only planning/local preparation is authorized now. No tools are installed, no password is generated/set, LOGIN remains unchanged, and no live SQL, migration, transfer, backup or cutover is executed. The active SQLite environment and existing backups remain untouched. All migration/cutover approvals remain false. Do not rerun NOLOGIN-only bootstrap/preparation after a future approved LOGIN change; those scripts intentionally reject LOGIN during preparation.

## 1. Obtain Windows clients (operator installation, separate from this task)

Use the [official PostgreSQL Windows page](https://www.postgresql.org/download/windows/) and its EDB installer link. Choose supported Windows x64 PostgreSQL 17 client utilities, using the latest maintained 17.x minor offered by that vendor. pg_dump 17 is suitable for the reported server major 17; do not select a dump client older than the server major. This guide does not promise an exact installer version or checksum.

Check the downloaded installer's Authenticode signature (Status Valid, expected vendor identity) before running it. Use the Select Components screen to select **Command Line Tools only** and deselect PostgreSQL Server, pgAdmin and Stack Builder. This is a remote-client setup: do not initialize a local cluster, configure a local database password, open a firewall port or start a service. If the selected package does not offer a genuine client-only installation, cancel instead of accepting server defaults. The official page also links EDB binary ZIP distributions; a reviewed vendor archive can be extracted with its complete dependencies rather than copying three EXEs alone. No unattended installer/download is prepared here.

Keep the existing PATH unchanged if desired. Use full executable paths entered locally:

~~~powershell
$pgToolsDirectory = Read-Host 'Installed PostgreSQL 17 bin directory'
$pgClient = Join-Path $pgToolsDirectory 'psql.exe'
$pgDumpClient = Join-Path $pgToolsDirectory 'pg_dump.exe'
$pgRestoreClient = Join-Path $pgToolsDirectory 'pg_restore.exe'
& $pgClient --version
& $pgDumpClient --version
& $pgRestoreClient --version
~~~

These are local version checks, not database connections. Tools were absent from PATH during preparation; installation is not claimed. Existing backup commands accept private PG_DUMP_BIN/PG_RESTORE_BIN settings, so a system-wide PATH change is unnecessary.

## 2. Prepare TLS and non-secret connection inputs

In the existing project, copy the actual host and project reference from **Connect → Session Pooler**, port 5432. Download the trusted CA from Database Settings / SSL Configuration if needed. Do not guess the regional hostname, enable the Data API or buy an IPv4 add-on.

Use a dedicated local terminal without PowerShell transcription, terminal capture, debug tracing or screen recording during credential entry. Do not disable centrally managed security logging; if credential input cannot be handled securely in that session, stop and use an approved secure terminal. Do not paste passwords into SQL Editor, shell commands, chat, screenshots, scripts, editor AI prompts or public URL-encoding sites.

The following contains no password and does not open a connection until its final command is manually run after approval:

~~~powershell
$poolerHost = Read-Host 'Dashboard Session Pooler host'
$projectReference = Read-Host 'Project reference'
$caCertificate = Read-Host 'Absolute trusted CA certificate path'
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = $caCertificate
$env:PGCONNECT_TIMEOUT = '10'
$administrativeUser = 'postgres.' + $projectReference
~~~

Use a clean session without inherited PGOPTIONS/PGPASSWORD/PGSERVICE/PGPASSFILE overrides. Do not print existing environment values. -X below prevents loading psql startup commands; HISTFILE=NUL discards psql history on Windows. -W forces an interactive masked password prompt. Do not supply a password-bearing URI, PGPASSWORD or -L/--log-file.

## 3. Password assignment — requires explicit operator approval

After password-change approval only, open an administrative session:

~~~powershell
& $pgClient -X -W -v 'HISTFILE=NUL' -v 'ON_ERROR_STOP=1' -v 'ECHO=none' -v 'ECHO_HIDDEN=off' -h $poolerHost -p 5432 -U $administrativeUser -d postgres
~~~

Enter the EXISTING administrator database password only at psql's masked connection prompt. Never reset the administrator password as a shortcut. Check the session before any mutation:

~~~text
\conninfo
SELECT current_user, current_database();
SHOW password_encryption;
~~~

Expect postgres / postgres and a verified TLS connection to the selected endpoint. If identity or certificate checks fail, stop; do not use an insecure TLS fallback. The pooled backend's pg_stat_ssl is not proof of client-to-pooler TLS: the native client's verify-full configuration and connection context matter.

Generate a unique random password of at least 32 characters using a trusted local password manager, store it there and do not print it. A randomly generated URL-unreserved character set simplifies later URL configuration; do not weaken randomness to avoid escaping. In the same approved administrative session:

~~~text
SET password_encryption = 'scram-sha-256';
\password creator_hq_runtime
~~~

The SET affects only this session, not global Supabase settings. Enter/re-enter the runtime password only at the hidden prompts. psql encrypts it before sending ALTER ROLE; the cleartext password does not enter SQL history or normal server statement logs. Password verifiers and abnormal debug captures remain sensitive; never enable statement echo/debug capture to troubleshoot this operation. No role password hash is queried to verify success. Expect ALTER ROLE; on any error stop and leave LOGIN disabled. This password operation does not itself enable LOGIN.

## 4. LOGIN — a distinct approval gate

Only after successful password assignment and explicit LOGIN approval, in that trusted administrative psql session:

~~~sql
ALTER ROLE creator_hq_runtime LOGIN;
SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolbypassrls,rolreplication
FROM pg_roles WHERE rolname='creator_hq_runtime';
~~~

Expected: rolcanlogin=true, the remaining six flags=false; management membership unchanged. No membership or system-role change is required. Exit with \q. This guide does not execute or preapprove that statement.

## 5. Private Prisma configuration

Installed Prisma 6.19.3 uses the schema's url=DATABASE_URL and directUrl=DIRECT_URL. Only the ignored apps/api/.env.migration is edited for staging; leave active apps/api/.env on SQLite. Do not replace its backup path or flags, and do not overwrite the staging file wholesale. Use a trusted local editor without cloud synchronization/AI capture; ensure the file's NTFS access is restricted to the operator and trusted system administrators. Git ignore is not encryption or an access-control boundary.

| Field | Exact purpose |
| --- | --- |
| DATABASE_URL | Session Pooler host:5432 / postgres; username creator_hq_runtime.PROJECT_REF; the NEW runtime password |
| DIRECT_URL | Same Session Pooler host:5432 / postgres; username postgres.PROJECT_REF; the EXISTING administrative database password |
| SUPABASE_PROJECT_REF | Actual project reference, not the display name |

Both URL parameter sets must include:

    schema=creator_hq&sslmode=require&sslaccept=strict&connect_timeout=10&pool_timeout=10&socket_timeout=20&connection_limit=5

Use the real dashboard URI template locally; there is no functional credential-bearing example in source. Replace each URI user/password component separately, and percent-encode reserved characters once. A password manager's local encoding feature or a reviewed masked-input local helper can perform encoding without printing the result; do not paste secrets into online encoders. URL-unreserved random runtime passwords need no percent encoding. Any existing administrator password must still be encoded correctly. Add sslrootcert with a URL-encoded absolute trusted CA path if needed. Prisma 6 uses require + strict; psql/libpq uses verify-full. Do not add pgbouncer=true or change to port 6543 for this chosen Session Pooler configuration. DIRECT_URL is a variable name, not an IPv6 requirement. Never place credentials in NEXT_PUBLIC variables or command arguments.

Keep MIGRATION_SCHEMA_APPROVED, MIGRATION_DATA_APPROVED, MIGRATION_PROBE_APPROVED, MIGRATION_SOURCE_FROZEN false. Do not set DATABASE_CUTOVER_APPROVED. Do not enable application PostgreSQL runtime while preparing credentials.

## 6. Approved read-only runtime verification

After separate approval for live connectivity, create a NEW native connection with the actual runtime credentials (not SET ROLE from an administrator):

~~~powershell
$runtimeUser = 'creator_hq_runtime.' + $projectReference
& $pgClient -X -W -v 'HISTFILE=NUL' -v 'ON_ERROR_STOP=1' -h $poolerHost -p 5432 -U $runtimeUser -d postgres
~~~

At its prompt, enter the runtime password, run \conninfo, then inspect the locally reviewed script from the repository root:

~~~text
\i apps/api/prisma/postgresql/security/inspect-runtime-connection.sql
~~~

The script uses a READ ONLY transaction and no application-row queries. Expect current_user=session_user=creator_hq_runtime, database postgres, USAGE true / CREATE false, six non-LOGIN flags false, no memberships granted TO runtime and only the expected postgres management recipient. The schema owner remains postgres. It reports existing table privileges/RLS without granting anything. With the operator-reported empty schema, table_permission_status must be NOT_TESTED_NO_TABLES. Empty tables are not proof of future CRUD or migration readiness. No connection error should be fixed by granting broad privileges.

The existing Prisma check is also read-only, uses separate runtime/admin URLs, produces fixed statuses rather than URLs, and does not set a cutover receipt:

~~~powershell
npm run db:migrate -- --check-connection
~~~

Do not use --preflight before the application tables exist; do not use --apply-schema, --apply-data or --probe-write here. A successful connection does not authorize migration, prove backup restoration or switch the application. Pooler authentication failures require reviewing username suffix, correct role password and recent role/password propagation; never reveal the URI/password in diagnostics or reset unrelated roles.

## Evidence and references

No live password/login/connection test is claimed. The new inspection SQL is tested in isolated PGlite: READ ONLY mode, false credential-session result for SET ROLE, explicit no-table status, and accurate granted/denied fixture privileges. Existing SQLite/backup data is not used as the SQL fixture. Local results appear in the Turkish operator report.

- [PostgreSQL 17 psql: password prompts/history](https://www.postgresql.org/docs/17/app-psql.html)
- [Official Windows clients](https://www.postgresql.org/download/windows/)
- [EDB component selection](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/windows/)
- [Supabase psql/TLS](https://supabase.com/docs/guides/database/psql)
- [Prisma PostgreSQL v6](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql)

Local verification results: root typecheck passed; 12 database/security tests and 5 root policy tests passed; public audit scanned 82 candidate files with zero findings. No production build/restart was needed for documentation and inspection SQL. PostgreSQL utilities remain unavailable in PATH; no installation or live connection was attempted.

## TLS-only preparation after client installation

All three locally installed executables were checked at the standard PostgreSQL 17 bin location and returned 17.11. PATH resolution in the running assistant session had not picked up the installation; use the full executable path. Active configuration remains SQLite; staging DATABASE_URL/DIRECT_URL are empty. No PG environment overrides were present in the inspected assistant process. Neither the default libpq root certificate nor the proposed project-specific CA file existed when checked. This is local evidence only; the hosted SSL enforcement setting was not independently inspected or changed.

Obtain the root CA ONLY from the existing authenticated Supabase project's Database Settings → SSL Configuration → Download certificate. Take the Session Pooler host separately from Connect → Session Pooler. Use the actual downloaded CA PEM file, not a private key, client certificate or browser-exported leaf certificate. The CA is public, but its authenticity/integrity matters.

Recommended per-user location, outside the repository, vaults, media and backups:

    %LOCALAPPDATA%\CreatorHQ\certificates\supabase\creator-hq-ca.crt

This is deliberately not the global/default %APPDATA%\postgresql\root.crt. Explicit PGSSLROOTCERT scopes selection to this terminal/connection and avoids overwriting another application's trust file. No import into Windows Trusted Root Certification Authorities is required. In folder Properties → Security, retain write access only for the operator and trusted system/administrative accounts; do not grant Everyone/Users modification rights. This task does not create the external folder or modify ACLs automatically.

The operator may create the folder and save the dashboard download there without changing its PEM content:

~~~powershell
$tlsDirectory = Join-Path $env:LOCALAPPDATA 'CreatorHQ\certificates\supabase'
New-Item -ItemType Directory -Path $tlsDirectory -Force | Out-Null
~~~

The following is a PREPARED connection command, not an executed test. It connects with the EXISTING administrator password because runtime remains NOLOGIN. It does not set any password or change LOGIN, and executes only connection information and a READ ONLY identity query before closing. Use a dedicated terminal without credential recording/transcription; do not disable managed security logging.

~~~powershell
$tlsPsql = Join-Path $env:ProgramFiles 'PostgreSQL\17\bin\psql.exe'
$tlsCaFile = Join-Path $env:LOCALAPPDATA 'CreatorHQ\certificates\supabase\creator-hq-ca.crt'
if (-not (Test-Path -LiteralPath $tlsCaFile -PathType Leaf)) { throw 'Trusted CA file is missing.' }
foreach ($tlsOverride in @('PGSERVICE','PGSERVICEFILE','PGOPTIONS','PGPASSWORD','PGPASSFILE')) {
    if (Test-Path ('Env:' + $tlsOverride)) { throw 'Use a clean dedicated terminal; a PostgreSQL override exists. Do not print its value.' }
}
$tlsHost = Read-Host 'Actual dashboard Session Pooler host'
$tlsProjectRef = Read-Host 'Actual project reference'
if ($tlsHost -notmatch '^[a-z0-9][a-z0-9.-]*\.pooler\.supabase\.com$') { throw 'Unexpected Session Pooler host.' }
if ($tlsProjectRef -notmatch '^[a-z0-9]{10,40}$') { throw 'Invalid project reference.' }
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = $tlsCaFile
$env:PGCONNECT_TIMEOUT = '10'
$env:PGGSSENCMODE = 'disable'
$tlsArguments = @(
    '-X','-W','-v','HISTFILE=NUL','-v','ON_ERROR_STOP=1',
    '-h',$tlsHost,'-p','5432','-U',('postgres.' + $tlsProjectRef),'-d','postgres',
    '-c','\conninfo',
    '-c',"BEGIN READ ONLY; SELECT current_user, current_database(), current_setting('transaction_read_only') AS read_only; COMMIT;"
)
& $tlsPsql @tlsArguments
~~~

-W prompts for the existing administrator database password without echoing it. It is not a shell argument, SQL literal, URI or environment password. -X prevents startup-file SQL, and the non-interactive -c commands leave no opportunity for an accidental interactive mutation. The supplied query must show postgres / postgres / on. Successful libpq verify-full validates the CA chain AND hostname. The client connection output must indicate SSL/TLS. A pooled backend's pg_stat_ssl cannot independently prove client-to-pooler TLS. GSS encryption is disabled for this prepared TLS-specific check, not TLS itself. Close this dedicated terminal afterwards so session-local variables are not reused elsewhere.

If verification fails, stop and review the actual host, dashboard CA, certificate chain and system time. Do not replace verify-full with require/prefer/disable or accept an untrusted certificate to make the connection work. A matching hash/valid expiry alone does not establish a trusted chain and hostname. No successful hosted TLS verification is claimed until the operator actually runs the command and verifies the result.

References: [Supabase CA/download and SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement), [Supabase Session Pooler psql example](https://supabase.com/docs/guides/database/psql), [PostgreSQL 17 libpq certificate verification](https://www.postgresql.org/docs/17/libpq-ssl.html).
