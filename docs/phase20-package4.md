# Phase 2.0 Package 4 — local application integration

This package extends the existing application. It does not repeat the successful Atlas CLI trial, deploy to the running application, execute Codex, or change Supabase. `ExecutionJob.enabled=false` and the existing database check remain intact.

## Audit and implementation

Before this package the panel could only preview a contract. No job or human execution approval was persisted; the successful native trial remained a separate helper. The application had no durable worker ownership or integrated process launcher.

The local source now provides:

| Requirement | Local implementation | Production boundary |
| --- | --- | --- |
| Atlas task and approval panel | Owner login, create/select Atlas task, save job, inspect immutable contract, approve/reject/cancel, refresh status and result | Not deployed; execution start stays disabled |
| Persistent jobs | Existing PostgreSQL `ExecutionJob.metadata`, version 2; existing task/agent foreign keys | No schema migration or live writes in this package |
| Human approval | Password-authenticated owner session, server-assigned identity, CSRF token, expiry, exact contract digest, deterministic Approval ID | Requires separately provisioned owner authentication |
| Unique start | Client request UUID is the job primary key; transaction-scoped advisory mutex, row locks, durable worker token and lease | Fake launcher only in test mode; no automatic lease reclamation |
| Status and result | Durable status, cancellation, safe error code, structured result, report and activity; simulation explicitly labelled | No new real Codex result is claimed |
| CLI integration | Application job service receives the locked native launcher; reviewed argument/environment builder, configuration/auth preflight, bounded JSONL transport | Native invocation is unreachable while the release gate is false |

## Authentication and approval

`CREATOR_OWNER_PASSWORD_HASH` is a separate owner password hash, never a database password. Its format is `scrypt:<16-byte hex salt>:<32-byte hex derived key>`, using Node's scrypt defaults. `ownerPasswordHash` creates the format; do not pass plaintext passwords as terminal arguments or put them in source. Provisioning a real owner password and deploying this package require a separate operator action. No real password or configuration is created here. An absent/invalid hash fails closed with `OWNER_AUTH_UNCONFIGURED`.

The loopback-only API issues one-hour HttpOnly, SameSite=Strict cookies, scoped to `/execution`. Session tokens are stored hashed in memory; CSRF tokens stay in browser memory. Restart invalidates sessions, not PostgreSQL decisions. Requests that mutate execution state require the allowed UI Origin, cookie and CSRF header. Local HTTP cookies intentionally do not set Secure; this is not an externally hosted authentication design. Login attempts and session counts are bounded. Model output cannot identify itself as the owner or approve a job.

`POST /execution/jobs` creates the pending Approval and disabled job in one transaction. Its strict body accepts only taskId and requestId. The decision endpoint accepts only digest and decision, never an actor. Approval lasts 30 minutes and binds task text, agent, studio, profile instructions, contract policy and immutable permissions. Task text/agent/studio or role/instruction/enable edits through the API permanently invalidate affected pending approvals, even if subsequently restored. Start and completion also re-check the current contract. The legacy approval endpoint rejects `execution:` IDs. External direct database writes bypass application mutation tracking and are outside the runtime contract; they must not be used to edit executable tasks.

## Worker and persistence

All job mutations take the same PostgreSQL transaction advisory lock, then row locks, before committing. Only one running version-2 job is allowed by this application protocol across service instances. A worker holds a random durable ownership token with a 90-second lease; tokens and session audit identifiers are not returned to the panel. A stale/crashed worker is never automatically retried or reclaimed. Review any expired running job manually before a future activation. There is no distributed queue or retry service.

Completion checks ownership, cancellation, approval and result schema. Report, activity, task Review transition and result are one transaction. Unique report source IDs reject duplicate completion. Failures do not queue writes for later replay. Existing PostgreSQL RLS, grants, schema and history are unchanged. The job metadata references its deterministic Approval ID; the existing schema has no dedicated job-to-approval foreign key. A future migration can normalize this only if operational needs justify it; no migration is required for this disabled local package.

## Native boundary and next approval

The native launcher uses no shell, an explicit environment allowlist, a private job/state directory, MXC, root-deny/read-only input, no tool network, web, hooks, MCP or plugins. MCP/plugin identifiers are validated before constructing unquoted dotted override keys. Authentication uses the existing ChatGPT mechanism, not copied credentials or API keys. Configuration and cached account identity must pass before any exec. Native stdout is bounded and schema-validated; raw stderr and credentials are not logged. Unsupported output fails closed.

Only fake processes can pass the local test worker gate. Both the application release gate and database disabled constraint remain closed. The native transport has not been invoked in this package; pure plans and its hard refusal are tested. Do not equate fake integration tests with a real application-owned Codex run. Activation requires separate review of the normal-user Windows launch host, current CLI version/configuration, owner provisioning, executable/scratch paths, and an explicit operator-approved release change. No HTTP or environment flag opens execution. Any necessary live migration, application deployment, production activation or real call requires separate explicit approval.

## Verification

Actual results: [Package 4 local verification](phase20-package4-verification.md).

Tests use synthetic credentials, a private temporary PostgreSQL cluster on an ephemeral loopback port and reviewed fake processes. They cover owner authentication/CSRF, forbidden identity injection, legacy approval bypass, durable jobs, idempotency, rollback, concurrent decisions/claims, stale approvals, cancellation, secret rejection, expiry, process failure, single attempt, restart and the unchanged enabled constraint. Existing Phase 1.3/Package 1 tests remain part of the full suite. Builds must use an ignored staging directory to preserve active build outputs and environment files.
