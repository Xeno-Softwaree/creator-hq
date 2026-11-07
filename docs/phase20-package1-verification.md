# Phase 2.0 Package 1 verification

Package 1 is prepared locally and has not been deployed over the active Phase 1.3 application. See [the execution contract](phase20-execution-contract.md) for boundaries and the next approval gate.

## Actual results

- Full regression suite: **67 passed, 0 failed, 0 skipped** — API/database 52, web 10, security policy 5. This preserves the previous 55 cases and adds 10 execution/API cases plus 2 source/locale cases. The targeted execution suite was also rerun after adjusting the synthetic credential fixture representation for the privacy scanner; all 10 passed.
- Typecheck passed for both workspaces.
- Isolated Prisma generation, API TypeScript production compilation and Next.js production build passed. Source was copied into an ignored build tree without private environment files. Active API output, web BUILD_ID, runtime environment files, source SQLite and generated native engines were hash-checked as unchanged.
- Public privacy scan passed with no findings. A recognizable synthetic credential URL in a test initially triggered the scanner; it is now constructed at test runtime. No scan rule was relaxed or excluded.
- The reviewed PostgreSQL migration checksum is unchanged. No schema file, migration, live record, database permission or ExecutionJob enabled constraint was changed.
- Ignored status was confirmed for private API environment files and local build evidence.

## Execution checks

Nine distinct role policies; human-only owner; bounded Atlas routing; strict studio scope; exact approval digest; invalidation after text, instructions, agent, scope or permission changes; rejection of agent approval; empty parent environment inheritance; fake-only process identity and frozen methods; singleton execution; duplicate-start refusal; timeout; cancellation; process crash/nonzero exit; malformed, oversized, unsupported and incomplete output; strict result schema; raw/encoded/escaped secret rejection; safe errors; fresh session enforcement and cross-studio session reuse rejection; read-only preview API and absence of start endpoints were tested.

A nested JSON escaped-secret case initially failed and was corrected by inspecting the decoded structured result before accepting it. The final regression passed. No real CLI process was used by these tests.

## Isolated browser acceptance

A separate production web build was started on loopback port 3313. All API calls were intercepted and fulfilled by Fastify injection with synthetic in-memory agents, not sent to the running API or Supabase. An independent temporary Chrome profile was closed after testing; only the owned test web process was stopped.

Both Turkish and English passed: preview generation, disabled approval action, exclusion of the human owner from executable choices, SHA-256 digest display, six translated state labels, clearing preview after editing, studio-scoped agent choices and absence of UI errors. The final browser run passed. Its screenshots and machine-readable evidence are private under `.local/phase20`.

## Deliberate limitations

No real model call, persistent job launch, production worker, durable lock or human-authenticated approval endpoint exists in this package. Fake approval records are injected only by isolated tests; the preview grants no approval and persists nothing. The current API environment's secrets are not read or forwarded by the adapter. Windows filesystem denial, credential-file isolation, MCP/hook containment and actual CLI authentication under containment are **not** proven by fake-process tests.

The smallest next step is a separately reviewed Windows containment experiment using owned sentinel fixtures and no application secrets, followed by separate explicit permission for one bounded real CLI text task. Any eventual live job activation, constraint migration or broader permission requires another explicit operator approval. Comprehensive disaster recovery remains deferred until after the first test video.
