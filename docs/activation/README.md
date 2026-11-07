# Atlas activation review — not applied

Prepared 2026-11-07, after Package 5. This package does not authorize a production migration, deployment or model request. The three operator approvals remain separate.

Status update: the operator subsequently approved the forward migration only. It was applied and verified; see [live migration result](live-migration-2026-11-07.md). Historical preparation descriptions below remain the reviewed plan. Deployment and real execution are still unapproved and locked.

## Prepared local configuration

The operator approved creation and ACL restriction of the new ignored owner-auth directory only. Its allow entries are limited to the current Windows user, SYSTEM and Administrators. Existing directories and their ACLs were not changed. The operator then ran the owner-password helper in their own normal terminal. Only the resulting file's regular-file status, private ACL and scrypt assignment format were verified; no password or hash was printed, compared to a guessed password, or applied to the API.

The private runtime JSON and scratch directory were prepared beneath that private directory. The JSON contains native CLI/Node/Windows paths and an inventory of one MCP and ten plugins, not authentication tokens. Global config values were not interpreted; only section IDs, including the MCP `.env` subtable header, were inventoried. The subtable's values were not copied. Existing ChatGPT authentication remains referenced through the existing Codex home. Authentication files were not opened or copied.

The native path was checked once using `--version` only and matched `codex-cli 0.166.0`. No initialize/config/account or model request was made. That version probe does not prove current account validity or MXC initialization; the real launcher's fail-closed preflight remains mandatory.

The two assignments to apply only during a separately approved deployment are the prepared owner hash and the private runtime-file path. Preserve all other environment lines. Never introduce DIRECT_URL or administrative credentials into runtime or child environments. No existing `.env` or migration approval flag was edited here.

## Exact SQL proposal

- [Forward SQL](../../apps/api/prisma/postgresql/review/atlas-activation.sql)
- [Rollback SQL](../../apps/api/prisma/postgresql/review/atlas-rollback.sql)

These files live outside Prisma's migrations directory and are not automatically discovered. Do not run them as part of ordinary startup or builds. After explicit approval, promote the exact reviewed forward bytes to a new versioned Prisma migration and apply only that migration with the existing guarded administrative pipeline. The original migration must retain its checksum. Keep runtime credentials separate. Do not mark a successful migration rolled back or delete migration-history rows; a production reversal must be recorded as a new compensating migration after separate approval.

The local migration runner was prepared to recognize only this contiguous, checksum-bound sequence: `20261106000100_phase12_initial`, `20261107000100_phase20_atlas_text`, and `20261107000200_phase20_atlas_disable`. Expected byte hashes are pinned in `apps/api/src/database/migration-history.ts`. Unknown/duplicate/failed history, altered SQL or unreviewed migration directories stop before deploy. The forward and compensating files have **not** been placed in the discoverable migration directory, and schema-approval flags remain unchanged.

The forward SQL performs no INSERT, UPDATE, DELETE, seed, reset, role/grant/default-privilege change or operation in other schemas. It:

1. Starts a transaction with a five-second lock timeout and twenty-second statement timeout. It takes an exclusive lock on ExecutionJob only.
2. Requires the expected postgres owner, original validated disabled constraint and no enabled/running jobs. Unexpected state aborts; it is not repaired automatically.
3. Adds the narrow `ExecutionJob_atlas_text_check`. enabled=true is permitted only for a running version-2 Codex/Atlas row with matching task/approval identifiers, owner/digest/worker metadata and exactly the existing text-only/no-files/no-tools/no-publishing permissions. Missing JSON fields cannot bypass the check through NULL.
4. Adds a partial unique index allowing at most one running job across the table.
5. Drops only `ExecutionJob_disabled_check` after the replacement and index succeed, then commits. Existing rows remain unchanged and disabled.

The database shape check is defense in depth; it does not itself authenticate an owner, recompute the canonical digest, verify approval expiry or prove worker ownership. Those remain checks inside the existing locked application transaction. No new tables, functions, extensions, roles or elevated runtime privileges are introduced.

## Worker changes ready for review

- [Source comparison against Package 5](worker-review.patch)
- Release gate: `apps/api/src/execution/release.ts`, still **false**.

The native launcher is identity-branded and remains disabled. An arbitrary launcher object cannot impersonate it. The reviewed native claim branch uses the existing advisory/row locks and persisted human approval, contract revalidation, expiry and worker lease. It additionally requires the replacement validated constraint, absence of the old disabled constraint and the valid unique index before claiming work. Failed schema checks stop before a process starts.

For a future explicitly approved native run, enabled is set true atomically with the running state and ownership token. It is cleared only when the owning worker commits a terminal outcome. A running cancellation requests abort but does not prematurely release ownership. Lease loss does not automatically reclaim or retry a job. Reports, task Review transition and result persistence remain atomic; simulation provenance is preserved.

The API/panel start availability reflects both the release/configuration gate and schema readiness. The panel's ready/locked text and generic publishing/approval boundary were prepared in Turkish and English. `/health` advertises a release label only if the reviewed build gate is open; per-job availability remains the authoritative start check. The health timeout budget is unchanged.

The final enablement edit, **not made here**, is changing `NATIVE_EXECUTION_RELEASE_APPROVED` from false to true in a separately reviewed production build, after migration/configuration verification. No HTTP input or environment variable toggles it. Merely supplying paths, owner credentials or applying SQL cannot launch work.

## Approval and deployment order

1. **Migration approval:** re-check live catalog/ownership and absence of running/enabled jobs read-only, then apply the exact promoted migration through the guarded migration pipeline. Preserve history and verify the constraints/index, existing rows, RLS and runtime grants. Stop on any mismatch.
2. **Deployment approval:** apply only the two prepared API environment assignments, build the reviewed release, stop/restart only Creator HQ services and verify the restricted runtime, owner login, schema readiness and panel state. No automatic job is submitted or started.
3. **First real task approval:** obtain a separate explicit operator approval for one specified Atlas supplied-text panel job. Authenticate the human, create the persistent task/job, inspect the exact contract, approve its digest and start it once. No standalone trial is repeated. No tools, publishing, external paid service or vault/media access is granted.

## Non-destructive rollback

First close the application release gate and stop only the owned worker through the controlled application path; do not terminate unrelated processes. Confirm no running or enabled jobs. A hung/expired row causes the rollback to refuse; inspect it and obtain separate permission for any recovery mutation. Never clear flags or delete history blindly.

The rollback SQL takes the same bounded lock, checks owner/constraint and quiescence, re-adds the unconditional disabled check before removing the activation check/index, and commits. All task/job/result IDs and records remain untouched. The worker normally clears enabled upon terminal completion, so completed history can survive restoration of the old check. Restore a known compatible application build only under separate deployment approval. No SQLite fallback or database reset is part of this plan.

## Verification results and limits

The full current suite passed **100/100**: API 83, web 12 and privacy/build-policy 5, with no skips. The ten new checks cover integration-header parsing, closed release/launcher identity, migration history/file checksums, forward SQL, NULL/permission/approval rejection, one-running uniqueness, active-work rollback refusal and record-preserving rollback. SQL tests ran only in a temporary native PostgreSQL cluster with synthetic records. Schema readiness changed false → true → false in that fixture. Synthetic enabled=true rows existed only inside that isolated test; no live flag was changed.

Typecheck, isolated API/web builds and privacy audit passed. Live output/environment/SQLite hash guards remained unchanged. Native worker execution was not enabled or positively exercised with a real CLI; existing in-memory protocol tests cover its version/config/account/output handling. Actual cached-account validity, full MXC startup and internal CLI reconnect behavior remain risks for the separately approved first application-owned run.
