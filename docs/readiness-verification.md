# Open-source readiness verification

[English README](../README.md) | [Türkçe README](../README.tr.md) | [Migration plan](migration-plan.md)

Verified on Windows 11 on 6 November 2026. This is an implementation and release-review report, not authorization to publish.

## Audit findings and actions

| Area | Finding | Action |
| --- | --- | --- |
| Internal identifiers | Existing models, API fields/routes and statuses already use English. No Turkish source identifiers were found by the AST checks and source review. | Preserved; no schema or public API rename. |
| Translation keys | 232 legacy keys used display phrases rather than stable identifiers. | Migrated dictionaries and consumers atomically to semantic keys; registry now contains 233 aligned keys per language, including native language names. |
| UI copy | Locale handling and switcher were fixed to two languages; metadata and storage paths contained hardcoded values. | Added registry-driven locale handling, central presentation mappings, localized metadata and environment-backed storage references. Official branding, protocol identifiers and user-authored content are intentionally preserved. |
| Locale policy | A single Turkish default did not distinguish personal and public distributions. | Added deployment policy with saved-preference precedence; personal Turkish, public browser detection with English fallback. Existing preference key unchanged. |
| Local evidence | Historical verification text/screenshots contained machine-specific details or local activity. | Retained originals in ignored local private storage; public reports replaced by sanitized English summaries. No original evidence was deleted. |
| Public artifacts | Ignore rules alone did not guard already-tracked sensitive content. | Added candidate/tracked-file privacy audit, artifact exclusions and a public-build configuration guard. |
| Documentation | Main README was bilingual/mixed and architecture/contribution standards were absent. | Added English README, Turkish companion, English contribution guide, architecture and migration plan; English environment descriptions. |
| Developer communication | Existing Turkish communication/security rules must remain. | Preserved and extended AGENTS.md; owner-facing communication stays Turkish. |

## Verification results

- `npm run typecheck`: PASS for both workspaces.
- `npm test`: PASS, 13 tests: 1 API integration workflow, 8 web/localization/identifier tests and 4 deployment/privacy guard tests.
- Public-mode production build with safe relative storage overrides: PASS.
- Public-mode `npm start`: PASS; both servers remained on loopback.
- Public server-rendered HTML: `lang=en-US`; checked generated HTML did not contain configured personal storage locations.
- Public-mode browser check: the owner's existing Chrome selection remained Turkish. English checks used a separate test browser, which was restored to Turkish afterward. All eight English management screens rendered.
- Public storage screen: safe relative display locations rendered correctly.
- Final personal browser smoke test: all eight Turkish screens rendered with no missing-translation fallback; console error log was empty.
- Personal-mode final production build and `npm start`: PASS. Server-rendered HTML is `lang=tr-TR`; the owner remains on Turkish and personal display locations are restored from ignored configuration.
- `npm run audit:public`: PASS, 53 candidate source files scanned, zero findings at the final run.
- Separate lint: no independent lint script is configured. No separate lint pass is claimed.
- Git history: zero commits at inspection; no historical commits existed to rewrite. This does not remove the need to review future history before publication.

Tests cover browser-language variants, unsupported-language fallback, saved preference precedence, deployment-specific missing-message fallback, central key and interpolation parity, JSX/accessibility copy, identifier checks, English protocol-to-label mappings, original report preservation, disabled execution, task CRUD/persistence, studio settings and approval boundaries. Privacy tests exercise sensitive artifacts, tokens, connection strings and personal paths. Public configuration tests reject absolute storage references and credential-bearing URLs without including their values in errors.

## Data and preference preservation

All rows/fields in Agent, Task, Activity, Approval, StudioSettings and AgentReport were compared against a private pre-change snapshot and matched exactly. No schema/data migration, task mutation or profile rewrite was performed. Existing technical report originals and studio content languages remain unchanged. The owner's Chrome preference remained Turkish during public-mode verification; no preference reset was used for testing.

Machine-specific personal display settings remain only in an ignored local environment file. Public build testing used process-local overrides and did not overwrite that file. The final local installation is restored to personal mode.

## Remaining release gates and limitations

- This repository was not published or pushed, and its visibility was not changed. Public license terms remain an operator decision; no license was selected automatically.
- A public deployment setting means internationalization defaults, not public network exposure. The API remains single-user loopback software without account authentication.
- Existing dependency advisories from the foundation phase remain unresolved in this work. No new online dependency audit or claim of a clean dependency audit is made.
- The built-in privacy audit checks common patterns, not every possible secret or personal note. Manually review candidates/staged files, intentionally public assets and future Git history with an appropriate secret scanner before release.
- Never share an artifact built with personal environment values. Public-mode builds reject absolute storage references and credential-bearing API URLs, but other public variables still require operator review.
- Browser detection/fallback variants are covered by deterministic tests. No user browser process restart, full accessibility certification or additional third-language translation was performed. The registry and tests are prepared for an additional dictionary.
- Real Codex/CEO orchestration, external skills, rendering, vault access, social accounts and publishing remain disabled. No paid service or API was introduced.

## Changed source areas

- Locale dictionaries, central registry, language provider, presentation/storage helpers, layout and existing localized components.
- Localization/deployment/coverage tests; API implementation, schema and stored protocol names were not renamed.
- Next.js public-build configuration guard; dependency-free public audit and tests; root validation scripts.
- English/Turkish README files, contribution guide, architecture, migration plan, environment examples, ignore rules and merged developer instructions.
- Historical evidence was retained privately; no rendered media is included in the public candidate set.

See the migration plan for rollback and future reviewed protocol renames. No database rollback is necessary for these presentation/configuration changes.
