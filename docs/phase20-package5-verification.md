# Phase 2.0 Package 5 — local verification

Date: 2026-11-07. This report covers preparation only, not deployment or real agent activation.

## Actual results

| Check | Result |
| --- | --- |
| Current API coverage | 73 passing tests |
| Web coverage | 12 passing tests |
| Privacy/build-policy coverage | 5 passing tests |
| Combined current coverage | 90 passing tests; original 81 retained |
| API/web typecheck | Passed |
| Isolated API generation/build | Passed; final API source compiled again after final test additions |
| Isolated Next.js build | Passed outside the outer tool sandbox |
| Public privacy audit | Passed with no findings |
| Normal-user Windows probe | STANDARD_WINDOWS_USER_CONFIRMED; no UAC elevation |
| Real Codex processes/model calls | 0 / 0 |
| Real owner-password preparation | Not executed |
| Live Supabase or running application changes | None |

The final full workspace run passed 89 tests with no failures/skips. The last added UTF-8/timeout/cancellation regression brought current coverage to 90; all nine Package 5 tests then passed together, including the actual isolated PostgreSQL integration. The unchanged web and policy suites had passed in the full run. Typecheck and privacy audit are run separately from these counts.

One repeated Next.js staging build failed with Windows EPERM creating a directory under its private `.next` output. The same staged build succeeded with execution outside the outer tool sandbox, without Windows administrator elevation, deleting user data or terminating unrelated processes. This establishes the successful build outcome, not the exact underlying Windows denial mechanism. Active API/web outputs, private environment, SQLite source and native Prisma engine files remained byte-identical in the build guard.

## New coverage

- Owner hash preparation: matching hidden-input contract, password bounds, random salt, no plaintext in the prepared text, compatibility with the existing owner-session verifier. Existing raw-terminal tests still verify no echo, cancellation and non-TTY refusal.
- Optional runtime settings: valid synthetic configuration loads; unknown credential fields, outside/relative paths and missing targets are rejected without exposing values.
- Windows private-directory ACL checks: missing directory fails closed; the private synthetic cluster directory passes. No real owner's folder permissions were changed.
- Effective configuration: exact read-only grants and integration inventory, MCP/plugin/hook/tool/network restrictions, private state paths, disabled notifications and absence of custom providers.
- Native protocol functions: version → initialize → config/read → cached ChatGPT account/read → exec, using only in-memory streams. Invalid version/config/account and early close stop before exec. Invalid approval and prior cancellation stop before initialization.
- Rejected wire data, nonzero exit, incomplete completion, unsupported tool output and observed retry messages fail without retry or accepted result.
- Split Turkish UTF-8 survives byte boundaries. A hung owned stream stops on timeout or cancellation.
- Real isolated PostgreSQL integration: pending approval cannot start; approved job acquires the existing worker claim; concurrent starts produce one protocol execution, one durable simulated result and one report. enabled remains false.

## Not claimed

The read-only Windows probe confirms non-elevation in the tested host. It does not prove the future API host has identical access or that MXC/ChatGPT initialization will succeed there. No actual Codex binary, user authentication file, private global Codex configuration or model endpoint was used by the rehearsal. Real CLI output compatibility and internal reconnect behavior remain activation-test risks. No new browser/live UI test was run for this backend-only package; the existing TR/EN tests and production web build passed.

See [prepared configuration, activation changes and approval boundaries](phase20-package5.md). No new migration file was created; the original migration and enabled=false constraint remain unchanged.
