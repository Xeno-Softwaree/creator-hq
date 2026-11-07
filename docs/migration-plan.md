# Non-destructive readiness migration plan

[Architecture](architecture.md) | [English README](../README.md) | [Türkçe README](../README.tr.md)

## Findings

The implementation already uses English source identifiers, Prisma model/field names, API routes and persisted statuses. No database/API rename is required. Previous localization keys were English display sentences; storage UI contained machine-specific absolute paths; historical verification evidence included local details.

## Applied presentation-only changes

1. Replace display-sentence keys atomically in both dictionaries and their consumers with stable semantic keys. Update tests and protocol-to-label mappings together. No user-authored content is transformed.
2. Preserve the exact `creator-hq.locale` preference key and stored locale values. Saved valid preferences take precedence over both deployment modes. The owner remains on Turkish.
3. Move storage references into environment-backed display configuration with safe relative public defaults. Existing personal references are retained only in an ignored local environment file. Do not distribute that personal build or its environment.
4. Retain historical local evidence in ignored private storage. Replace public-facing verification documents with sanitized English summaries. No vault, production media, database record or original technical report is moved or rewritten.
5. Merge the standard into `AGENTS.md`; preserve its existing communication and security rules.

## Compatibility and rollback

The new keys are internal presentation identifiers and were not stored in SQLite or exposed as an API. Routes, request/response fields, IDs, studio settings, reports and stored statuses remain compatible. No schema migration or data rewrite is performed by this readiness change.

For rollback, restore the previous frontend implementation and its dictionaries as one unit, then rebuild. Keep the local storage preference unchanged. Documentation and ignored historical evidence can be restored from the local pre-change archive if needed. Do not restore an older database over newer records: this change does not require a database rollback.

Any future protocol/model rename requires an explicit reviewed migration: inventory consumers; back up and test a copy; add compatibility aliases/versioning; migrate transactionally without data loss; verify old/new clients; document rollback and removal timing. Do not infer approval for such a rename from this presentation migration.

## Release gates not granted by this work

No publish, push, visibility change or license selection is authorized. A release additionally requires a clean candidate/history privacy review, dependency review, license decision and operator approval. Personal environment values and local build output must not be packaged into a shared artifact.
