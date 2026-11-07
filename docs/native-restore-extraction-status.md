# Native restore package verification and execution boundary

Date: 2026-11-06. Status: official package verified, extraction not started.
No installation, service registration, live database write or cutover occurred.

## Verified acquisition

The official EDB PostgreSQL downloads page lists version 17.11 for Windows x64.
Its Windows x64 link (EDB file ID 1260614) redirects to the matching official
postgresql-17.11-5-windows-x64.exe distribution on get.enterprisedb.com.
The installed package is also EDB 17.11-5; installed PostgreSQL reports 17.11 and
Windows is 64 bit. The installer is stored under the ignored .local directory.

Windows Authenticode verification returned Valid with signer EnterpriseDB
Corporation. SHA-256:
612c7f5400a003aaffa0372cb273eed52278f93c680ab911eb9cb2229e329072.
Downloaded size: 413001200 bytes. This hash records the locally verified signed
file, not an independently published vendor checksum. The target package is x64;
its extracted payload architecture has not yet been checked because extraction
has not run.

## Stop condition

The verified installer could not be launched with --help: Node returned EACCES
and no process exit code or help output. The initial sandbox launch was blocked;
the permitted outside-sandbox launch also returned EACCES. No normal GUI install,
alternative installer, extraction utility or automatic elevation was attempted.

This establishes a Windows process-launch permission barrier; it does not prove
whether UAC elevation or a different Windows execution policy is the precise cause.
The operator explicitly required stopping on error, so the task stopped here.

## Next controlled step

Resolve the Windows launch permission for this same verified EDB package with
operator involvement. Inspect --help first, then use only the approved documented
--extract-only mode into the separate ignored tools directory. Do not run a normal
installation or register a service as a fallback.

The original PostgreSQL archive and SQLite backups remain preserved. No real native
PostgreSQL restore has succeeded. Do not request or perform application cutover.

[EDB download page](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads) ·
[EDB extract-only documentation](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/command_line_parameters/) ·
[Approved isolation plan](native-restore-installation-plan.md)

[English README](../README.md) · [Turkish README](../README.tr.md)

## Subsequent verified outcome

The approved EDB extract-only procedure and real native PostgreSQL 17.11 restore have now passed. The actual bootstrap filename is postgres.bki. See [verified native restore](native-restore-result.md). Historical failed attempts above do not represent the current restore gate.
