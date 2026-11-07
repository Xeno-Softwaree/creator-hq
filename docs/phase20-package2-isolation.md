# Phase 2.0 Package 2 — Windows sentinel isolation

## Scope

The experiment used a new random directory beneath the operating-system temporary directory, outside the application, vaults and media. It created only synthetic brief/sentinel files, a fake auth.json, a fake CODEX_HOME and disabled synthetic MCP configuration. No real credentials, authentication sessions, application environment files or private production data were read as experiment inputs. No model request, migration, seed or agent execution occurred. The active application was not rebuilt or restarted.

The reproducible helper is `scripts/windows-isolation-experiment.cjs`. Invoke it from the repository root with the installed native codex.exe path as its sole argument. The helper creates its own fixture directory, uses a minimal child environment, forces MXC and runs a Node sentinel command rather than `codex exec`. It never requests elevated setup, changes ACLs/firewall rules, or selects an alternate sandbox automatically. A loopback server belongs only to the experiment and is closed at completion. Evidence remains in the temporary directory and ignored `.local/phase20-package2/result.json`.

## Actual evidence

Host build was 26200.9711. The installed CLI exposes the current `codex sandbox` command. An initial obsolete `sandbox windows --help` invocation returned a helper startup error; that command form is not a help-only path in this version and must not be reused. No administrator setup or fallback was approved or performed by the experiment.

The first explicit MXC probe started Node but Node's normal file-entrypoint realpath resolution failed with EPERM while examining the drive root. The final probe instead supplies the reviewed, synthetic Node code through `--eval`. No filesystem permission was broadened to accommodate Node startup.

The final sandbox process exited 0. Observations:

| Check | Actual outcome |
| --- | --- |
| Unsandboxed synthetic positive control | Brief, protected sentinel and fake auth readable; fake writes and live loopback connection successful |
| Allowed brief read in MXC | Successful |
| Protected sentinel read | Denied, EPERM |
| Fake auth read | Denied, EPERM |
| Write inside read-only job directory | Denied, EPERM |
| Write inside protected directory | Denied, EPERM |
| TCP to the experiment's loopback listener | Denied, EACCES |
| TCP to TEST-NET address 192.0.2.1, port 9 | Denied, EACCES; no real remote service used |
| Child database/admin/API-key environment variables | Absent |
| Fixture brief, protected sentinel, auth and configuration hashes | Unchanged |
| Sandbox-created write fixtures | Absent |
| MCP configuration listing with fake CODEX_HOME | Exactly one synthetic MCP entry, disabled |
| Hook marker observation | Absent; not evidence of lifecycle suppression |

The network assertion requires an explicit EACCES/EPERM, not a timeout or connection refusal. No external model or paid service was contacted.

## Proven boundaries and limitations

MXC enforced the selected file and TCP restrictions on this machine for these fixtures. The fake home and environment avoided inheriting the real user's Codex configuration. Disabled synthetic MCP enumeration was verified without launching an MCP server. No hook lifecycle event or actual Codex session was triggered, so an absent marker does not prove that session hooks would be suppressed. No claim is made about every network protocol, managed hook source, real authentication under this profile, or the complete model client/tool boundary. The evidence explicitly retains `productionExecutionReady=false` even though the scoped sentinel checks passed.

The actual private directories were not used as denial targets: equivalent protected synthetic files were used instead. Real authentication was neither copied nor tested. ExecutionJob.enabled remains false; no application schema or runtime permissions changed. No global Codex configuration was edited, no legacy sandbox installation was performed, and no unrelated process was stopped.

## Next separately approved trial

The next candidate is one bounded Atlas text-only request in a fresh isolated directory: summarize a supplied fictional brief in three Turkish bullets. Use the existing ChatGPT sign-in without copying credentials into task context, no API key, no retry, no application DB access and no application job activation. Limit the trial to 60 seconds and a short structured text result. Before sending any prompt, inspect the effective launcher configuration without a model request and refuse to proceed if MCP, hooks, plugins or tool containment cannot be confirmed. Only reviewed local trial artifacts may be written. The sentinel success alone is not permission to remove the disabled database constraint or launch an agent.

This trial requires fresh explicit operator approval. If the preflight fails, report that failure and do not make the model call.

## Sources

The [official Windows sandbox documentation](https://learn.chatgpt.com/docs/windows/windows-sandbox) describes explicit MXC selection and distinguishes it from legacy administrator-installed sandbox modes. The [official permission documentation](https://learn.chatgpt.com/docs/permissions) describes minimal reads, deny entries and disabled networking. These documents explain the experiment design; the observations above come from the actual sentinel run.
