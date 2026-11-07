# Single-job Atlas release preparation

Status: local source changes only. The deployed API remains locked. No database migration or live task/job was created.

The reserved future ExecutionJob ID is `882eaab1-866c-4803-a93c-10442d0a993e`. Creating that record, activating a release, and making a model request require separate operator authorization.

`release.ts` keeps release approval false. Its exact UUID predicate is checked before native worker claim and again before the launcher can create directories or spawn any process. Public job availability also checks the selected ID. An approved release alone cannot start an arbitrary job. No HTTP or environment variable can select another ID.

The existing Atlas-only task snapshot, current digest-bound human approval, approval expiry, transaction lock, unique running-job index and worker ownership token remain authoritative. A consumed worker cannot be claimed again after success, failure or timeout. Different IDs remain blocked even after the selected attempt finishes. Cancellation and lease expiry do not automatically queue or replace work.

The 30-second outer execution timer is unchanged and covers launcher preflight plus execution after claim. It does not include earlier HTTP/database latency or guarantee Windows process termination latency. MXC, read-only input, network/tool restrictions, disabled integrations and the inherited-environment allowlist are unchanged.

The application has no automatic job retry. Existing fake wire tests verify one exec spawn, failed reconnect output, timeout and cancellation. Native stderr detection of `retry` or `reconnecting` is reactive: it cannot prove the CLI never performed an internal transport retry before emitting that output, especially across split stderr chunks. Exact no-retry transport behavior is not established. No real CLI or model request was made for this package. Do not approve a strict single-request live trial until this limitation is resolved or explicitly reviewed by the operator.

Tests of the approved policy branch use the same pure UUID predicate in a fake-only rehearsal harness; they do not turn on the production gate or claim to validate the native CLI at runtime. Existing isolated database tests cover approval mutation, expiry, atomic ownership and process failure. Production checks remain on both native entry points.

Rollback: retain the current locked deployment. If a future selected-job release is authorized, wait for the owned process to terminate before restoring the reviewed locked API build. Preserve task, approval, job and report history. Do not reset the schema, delete records or switch to SQLite.

## Local validation results

- API: 89 unique tests verified across the serial run and the corrected package-directory rerun; web: 12; policy: 5 (106 total). The first parallel run encountered isolated cluster timeout/cleanup failures. The first serial invocation used the repository root; 13 working-directory-dependent tests failed. Rerunning the affected 22 tests from `apps/api` passed all 22. These are not reported as a single clean full-suite invocation.
- Workspace typecheck passed. Isolated API TypeScript build and Next.js build both exited 0.
- Public audit: 148 files scanned, zero findings.
- Candidate release remains false; live build and environment hashes remained unchanged. No model invocation, deployment, live database mutation or migration occurred.
