# Local runtime URL password repair — prepared, not executed

[Turkish operator instructions](../README.tr.md#runtime-url-parola-düzeltme-yardımcısı)

## Scope and approval

The helper changes only the password component inside DATABASE_URL in the existing ignored apps/api/.env.migration file. It does not change the PostgreSQL role's password, LOGIN, schema, data or active SQLite configuration. No network/database client is used. It has not been executed against the operator's environment file. Explicit operator approval is required before execution or credential persistence.

After that approval only, run from an ordinary trusted local PowerShell terminal at the repository root:

```powershell
npm run db:fix-runtime-password -- --operator-approved
```

Do not run it in an assistant-controlled terminal, IDE debug console, pipeline, CI, transcript/capture session or screen recording. Passwords must never be sent through chat. The approval flag is an accidental-execution guard, not a substitute for the requested operator authorization.

## Reviewed implementation

- fix-runtime-password.ts is the entry point. No secret command-line arguments or environment password inputs are accepted. It rejects inspector/debug/profiling settings and requires an interactive input/output TTY before asking for a secret. Git ignore and absence from the Git index are checked before prompting and immediately before commit.
- hidden-password.ts enables verified raw TTY mode before displaying a prompt. It prints no characters or mask/length indicators, reads no line history, and restores terminal state on completion, cancellation, signals, input error or timeout. Two hidden entries must match. Unsupported controls/bracketed paste fail rather than falling back to echoing input. If secure input cannot be established, use a normal Windows Terminal/PowerShell session and type through its hidden prompt; if that remains unavailable, stop and use a separately reviewed local masked-input solution, not a visible shell argument or online encoder.
- runtime-password.ts applies encodeURIComponent exactly once to the raw password as entered. It does not decode or normalize the raw password first. A literal percent-triplet in the true password is therefore preserved correctly by encoding its percent sign. No entire-URL serialization is used for writing.
- Prefix/suffix bytes outside the original runtime password span are reused unchanged. Existing DIRECT_URL, project reference, TLS/query parameters, tool paths, SQLite backup information, comments, whitespace, BOM and line endings remain intact. Duplicate assignments, unsupported multiline/ambiguous dotenv quoting, non-UTF-8 text or non-false migration/cutover gates abort; the helper does not repair unrelated configuration.
- encodeURIComponent leaves apostrophes unchanged. If a single-quoted dotenv value would become ambiguous, the helper stops instead of changing the surrounding quoting. A separate local formatting correction requires review; no secret is echoed in that failure.
- Only an existing regular, non-symlink, single-link file is opened. Concurrent content/path changes detected before commit abort. The existing file is updated in place to preserve its identity and NTFS ACL; no temporary credential copy or backup is created. Partial I/O failure triggers best-effort restoration from the in-memory original and reports only fixed error codes. Unrecoverable storage failure or power loss cannot be made atomic by this in-place design. Close editors/other writers before running; no mandatory OS-wide file lock is claimed.
- Errors are sanitized through a fixed whitelist; arbitrary filesystem/URL exceptions are never printed. On success only local configuration/path/byte checks run, then the helper exits. No connection test, migration, data transfer or cutover follows automatically.

## Limits

The environment file still contains plaintext-equivalent credentials and must retain private Windows access permissions. Git ignore is not encryption. Raw TTY mode prevents normal echo/history; it cannot protect against a compromised OS, external input recorder or privileged process inspection. Buffers are cleared where practical, but JavaScript strings are garbage-collected and cannot be guaranteed securely erased from memory. Use only a trusted local terminal/session.

## Tests and review evidence

Nine tests use fake credentials and disposable files/terminal objects only. They cover special characters and Unicode, literal percent sequences, exact unrelated-byte preservation, BOM/CRLF/LF, no final newline, rejection paths, file identity/no credential copies, concurrent edits, partial-write restoration, non-echo input, cancellation and fail-closed TTY behavior. Five existing policy tests and root typecheck passed. The real interactive Windows TTY and operator credentials were not exercised. Public source audit is run separately; these results do not claim an actual repair or successful Supabase authentication.
