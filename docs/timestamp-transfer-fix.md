# Timestamp transfer correction

Date: 2026-11-06. Scope: local source changes and isolated tests only.
No Supabase connection, schema change, live transfer or application cutover was run.
The original SQLite, verified backup and local environment files were not edited.

## Binding and validation

The five transferred timestamp columns are Task.createdAt, Task.updatedAt,
Activity.createdAt, Approval.createdAt and AgentReport.createdAt, across four
tables. All use PostgreSQL timestamptz(3). The remaining PostgreSQL
date fields belong to ApplicationSetting, ArtifactReference and ExecutionJob;
these tables have no SQLite source mapping and are not inserted by this transfer.

The insert builder now uses explicit bound-parameter casts: timestamptz for dates,
boolean for enabled/simulated, and text for other mapped fields, including nullable
report references. Report summaryData remains text, as required by the schema.
There are no JSON or numeric target columns in the six transferred table mappings.
Values are never interpolated into SQL. Identifiers and cast names come only from
the fixed internal field allowlist; all record data remains in the parameter array.

Date validation accepts valid Date objects, integer Unix milliseconds, and explicit
ISO timestamps with Z or a numeric offset. UTC normalization preserves the instant.
It rejects empty/null/invalid values, timezone-free strings, impossible calendar
dates, invalid times/offsets, and fractional seconds beyond three digits rather than
silently normalizing dates, using the machine timezone, or losing precision.
Accepted years are 0001–9999. Errors contain codes, not source values.

## Actual isolated checks

- The installed generated Prisma client connected only to a temporary in-memory
  PGlite PostgreSQL engine over 127.0.0.1 on an ephemeral port. No private connection
  configuration was loaded. The fixture-only plaintext loopback setting does not
  change production TLS policy.
- The legacy uncast insert reproduced Prisma P2010 / PostgreSQL 42804.
- The corrected transfer preserved all mapped fields, distinct createdAt/updatedAt
  instants, milliseconds, explicit offsets, boolean false/true, text and null links.
  Verification passed with the session timezone set to Pacific/Auckland.
- Related Agent, Task, Activity, Approval, StudioSettings and AgentReport fixtures
  transferred successfully. A repeated transfer retained identical counts and IDs.
- Forced rollback after a complete transfer and a late foreign-key failure after
  earlier inserts both left all transfer tables empty and the 3 Studio rows intact.
- Invalid dates and incompatible boolean/text fields failed before a destination
  transaction. SQL-like fixture text remained unchanged record data.
- All 25 targeted migration/security/password/timestamp tests passed. Root workspace
  typecheck and API TypeScript compilation passed. The initial sandboxed TCP test
  was blocked; the permitted loopback run passed. The initial fixture typing error
  was corrected before the final checks.

The standard generate-and-build command was not rerun: its previously reported
Windows Prisma DLL EPERM issue is separate. No running processes were terminated.
This report does not claim a successful live transfer or a full application build.

Fresh explicit operator approval is required for a live transfer retry. Application
cutover remains a separate approval after successful live verification.

[Original failed attempt](data-transfer-attempt.md) ·
[English README](../README.md) · [Turkish README](../README.tr.md)
