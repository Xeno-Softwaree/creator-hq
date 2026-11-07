# Cutover verification status

The active application configuration and actual API use the restricted PostgreSQL
runtime role and creator_hq schema. Writes remain blocked in both the environment
file and the running API. Cutover acceptance is incomplete.

## Passed

- Last source/target comparison and original archive hash verification.
- Four-file API test isolation correction; 28 API/database tests, root typecheck
  and API build passed in the preceding stage.
- Live test-agent update, task create/read/update, approval update and report reads.
- API graceful restart and persistence of the PostgreSQL test task.
- Corrected bodyless DELETE request: HTTP 204; the related report was retained with
  its taskId set to null, as defined by the foreign key.
- The six fixture rows were verified by recorded IDs, titles, source IDs and
  relationships before cleanup. Only those rows were removed in dependency order.
- All original mapped fields matched the source fingerprint after cleanup.
  Counts: Agent 9, Task 0, Activity 3, Approval 3, StudioSettings 2, AgentReport 3.
  No test rows remain.

## Failed acceptance gate

An isolated real Prisma client was directed to a closed loopback port, with fake
test credentials and TLS verification still required. Existing Supabase connections,
firewall settings and the live API configuration were not modified. The existing
API handlers were exercised using Fastify injection in a separate process.

Health returned HTTP 503 / DATABASE_UNAVAILABLE as expected. State and a valid
write request instead returned HTTP 500 / INTERNAL_ERROR. No data was returned
from SQLite and both SQLite bytes and the real PostgreSQL snapshot were unchanged.
The failure is error classification, not observed data loss or fallback. The error
handler currently checks code; Prisma initialization failures can expose errorCode.
Confirm that exact case and add regression coverage before changing production code.

The operator required stopping on a critical failure, so writes were blocked and
no production fix or acceptance retry was performed. Browser language/3D tests
were not performed. No claim of write readiness or completed Phase 1.2 is made.

Next: review the database-failure classification, test it in isolation, then finish
the unavailable-connection contract and browser acceptance before enabling writes.
No migration, data retransfers, reset, new features, Python or GitHub push is needed.

[English README](../README.md) · [Turkish README](../README.tr.md)

## Subsequent completed verification

The initialization error-code issue was corrected and all final API/browser/restore gates passed. PostgreSQL writes are enabled and no test rows remain: [completed cutover](phase12-cutover-completed.md).
