# Atlas schema migration — applied, execution still locked

The operator explicitly approved the reviewed schema migration only. It was applied once on 2026-11-07, between 18:05:22 and 18:06:16 UTC. No deployment, restart or real Codex request was performed.

## Exact migration

- Name: `20261107000100_phase20_atlas_text`
- SHA-256: `5df629368ffe9ff3a49d47333efd115ef67f327d345a62ba18911142c9eefdb4`
- The reviewed SQL was promoted byte-for-byte into the versioned migration directory.
- The existing guarded Prisma migration runner applied it with schema approval supplied only to its child environment. Persistent approval flags and private environment files remained unchanged.
- Process exit code: 0. Commit confirmation was unambiguous and subsequent catalog/history verification succeeded. No retry or repair was attempted.

## Verified schema and security

`ExecutionJob_atlas_text_check` is validated; the unconditional disabled check was replaced as reviewed. `ExecutionJob_single_running_idx` is unique, valid and ready, with the expected running-status predicate and status key. Existing foreign keys, other constraints and indexes are unchanged.

Table ownership, RLS flags, policies, table grants, schema ownership/ACLs, role attributes and role memberships matched their pre-migration snapshots. The runtime still has the expected restricted identity, schema USAGE without CREATE, no outgoing memberships or database CREATE privilege, and no migration-history access.

The original `20261106000100_phase12_initial` history record is unchanged. Exactly one successful history record was added for the new migration; both checksums match the reviewed files. No compensating/rollback migration was applied.

## Record comparison

| Application table | Before | After |
| --- | ---: | ---: |
| Studio | 3 | 3 |
| Agent | 9 | 9 |
| Task | 0 | 0 |
| Activity | 3 | 3 |
| Approval | 3 | 3 |
| StudioSettings | 2 | 2 |
| AgentReport | 3 | 3 |
| ApplicationSetting | 0 | 0 |
| ArtifactReference | 0 | 0 |
| ExecutionJob | 0 | 0 |

Server-computed ordered row fingerprints also matched for all ten tables, so the comparison covered contents and identifiers, not just counts. No enabled, running or orphan execution jobs were present.

## Preserved boundaries

The application release gate remains false. Existing API build files, web build ID and private runtime/migration environment files passed unchanged-byte checks. The owner hash and private CLI configuration were not applied to the running API. No application service was restarted, no client was generated, and no agent process or model call was started.

SQLite, backups, vaults and media were not opened or modified by this operation. The private operational report and one-attempt marker remain ignored local artifacts; no raw connection output or credentials are included here.

Deployment requires separate explicit approval. The first real Atlas panel task requires another separate approval. The [rollback proposal](../../apps/api/prisma/postgresql/review/atlas-rollback.sql) remains unexecuted and requires its own approval and quiescence checks.
