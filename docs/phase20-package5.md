# Phase 2.0 Package 5 — panel execution preparation

This local package extends Package 4 without replacing its jobs, owner sessions, approvals, transactions or worker ownership. No live deployment, Supabase connection, schema migration, real Codex invocation or owner-password provisioning is performed.

## Implemented preparation

- A hidden-input owner-password preparation command reuses the tested raw-terminal reader. It requires explicit operator approval, a normal Windows user, a private pre-existing directory, an ignored/untracked target and two matching passwords of at least 16 characters. It writes only a salted scrypt hash to a new file using exclusive creation. Existing runtime configuration is never overwritten or loaded by this command. Raw passwords, hashes and private paths are not printed. Debugger/instrumented terminals and insecure/non-TTY input stop before prompting. The helper was prepared and inspected, not executed with a real password.
- An optional strict runtime JSON loader is connected to the existing disabled native launcher. It accepts only named path fields, integration IDs and the pinned CLI version. It rejects credential properties, missing files, relative paths, links and a scratch directory outside the ignored local tree. Absence of a file leaves the launcher unconfigured and disabled.
- The future native path checks the normal Windows user, exact CLI version, effective configuration and cached ChatGPT identity before exec. Filesystem grants must match the reviewed root-deny/minimal-read/job-read-only profile exactly. Tools, tool network, web, hooks, MCP and plugins remain disabled. Unknown integration records, widened grants, provider overrides, unexpected state/log paths or missing flags fail closed.
- The same private version/preflight/exec functions can be rehearsed only with in-memory child streams in test mode. No OS process can be spawned by this fixture. Its branded fake launcher passes through the existing job service, persisted human approval and atomic worker claim; results remain labelled simulation.
- Native structured output uses incremental UTF-8 decoding; unsupported events, invalid output, incomplete completion, nonzero exit and observed retry messages fail closed. The application does not retry failed launches or writes.

## Owner configuration: prepared, not applied

After separate approval, use a normal local PowerShell terminal at the repository root. First prepare `.local/owner-auth` with access limited to the current user, SYSTEM and Administrators. The helper only inspects these ACLs; it does not create the directory or change permissions. It stops if other allow entries exist. Windows mode bits alone are not treated as NTFS protection.

Then run:

```powershell
npm run owner:prepare -w @creator/api -- --operator-approved
```

Enter a new, unique CEO password twice in the hidden prompts. Never use a database password or put a password in a command, chat or source file. The resulting `.local/owner-auth/owner.env` contains only `CREATOR_OWNER_PASSWORD_HASH`. Treat this hash as private because it permits offline password guessing. The helper refuses an existing target instead of overwriting it. Its error output is generic and never prints exceptions. A failed/partial new staging file needs operator inspection before reuse.

Applying that single hash assignment to the private API environment, provisioning folder permissions and restarting Creator HQ are separate approved operations. The preparation command does none of them. Sessions continue to be memory-only and expire on restart; existing PostgreSQL approval decisions remain persistent. JavaScript strings cannot guarantee secure memory erasure, but no plaintext password is persisted or logged by this helper.

## CLI configuration: prepared, not applied

Copy `apps/api/codex-runtime.example.json` to an ignored `.local/codex-runtime.json` after approval and fill it only locally. Empty example fields deliberately do not form a usable configuration.

| Field | Meaning |
| --- | --- |
| codexExecutable | Absolute path to the reviewed native `codex.exe`, not a shell shim |
| scratchRoot | Existing dedicated directory under the repository's ignored `.local` tree |
| codexHome | Existing Codex home used by the normal user's ChatGPT login; never copy authentication files |
| nodeExecutable | Absolute path of the same Node executable running the API |
| mcpIds / pluginIds | Exact integration-ID inventory from the reviewed configuration, without values or credentials |
| systemRoot / userProfile | Local normal-user Windows paths; these are private and stay out of public examples |
| expectedVersion | Pinned `0.166.0`; another version requires review, not automatic upgrade or retry |

`CREATOR_CODEX_RUNTIME_FILE` will point to the absolute private JSON path in the API-only environment. It is not a feature flag. No secret or administrator environment variable is passed to Codex. Only the explicit Windows/path/private-state allowlist is forwarded. Global configuration is never edited. Effective MCP/plugin IDs must match the inventory and all be disabled; stale or unexpected records stop the preflight.

Start the future approved API build from the verified normal-user Windows PowerShell host, outside the outer Codex tool sandbox. No UAC elevation or sandbox fallback is attempted. The current normal-user probe proves non-elevation, not arbitrary filesystem access or MXC readiness. The CLI initialize/config/account preflight is the final fail-closed check before any model request. Its real application-owned run has not been performed in this package.

The existing release constant is false, native launcher kind is disabled, the job claim path is fake-only and the database still enforces enabled=false. Supplying paths or a password hash opens none of these gates.

## Minimum activation changes requiring separate approval

No new tables or database service are required. Package 5 itself requires no migration. An actual real-job activation must not merely flip a constant or reinterpret enabled=false:

1. Provision the owner hash and reviewed private runtime configuration; deploy the reviewed build with only restricted runtime database credentials.
2. Review a narrowly scoped migration replacing `ExecutionJob_disabled_check` with a constraint permitting only the approved versioned Atlas text-execution shape. Preserve all other constraints, RLS, grants, history and records. Add a partial unique index for the single running job as a database-level backstop. Check existing jobs read-only before applying it; stop on conflicts without deleting data. No migration SQL is generated or applied in this package.
3. Review the native claim/release change: validate the persisted human decision and current contract under the existing lock, set enabled only for the owned approved Codex job, keep the ownership token/lease authoritative, and expose start only when all release checks pass. No HTTP body or environment variable may bypass the release gate.
4. Separately approve exactly one supplied-text Atlas panel task. The first real run must use that persisted task, owner approval and worker claim, not repeat the standalone trial. No tools, publishing, vault/media access, API key or automatic retry is introduced.

## Remaining risks and limits

- Real authentication-file accessibility, full MXC startup and CLI event compatibility are not proven by an in-memory rehearsal. A changed CLI version, managed configuration or integration inventory must fail closed and be reviewed.
- Unknown JSONL shapes deliberately fail; a real model may produce a supported-by-CLI but unreviewed event. No automatic parser relaxation is allowed.
- The application launches once and rejects observed retry messages, but backend/CLI internal reconnect behavior has not been proven by a new real call here.
- A crashed/expired worker is never reclaimed automatically; the existing operator-review boundary remains.
- Owner configuration, real runtime paths and activation are still pending. The current running application and its data are unchanged.

Official references: [Windows sandbox](https://learn.chatgpt.com/docs/windows/windows-sandbox), [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference). These document configuration/sandbox behavior; they do not establish that this application's real execution path has run successfully.
