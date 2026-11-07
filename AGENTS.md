# Creator HQ project instructions

## Zorunlu iletişim dili — Türkçe (tr-TR)

- Proje sahibiyle tüm geliştirme konuşmalarında varsayılan olarak Türkçe iletişim kur.
- İlerleme mesajları, özellik ve değişiklik açıklamaları, sorular, izin talepleri, sonuç raporları ve görev özetleri Türkçe olmalıdır.
- Build/test sonuçlarını, hataları, güvenlik uyarılarını, teknik sınırlamaları ve önerilen adımları Türkçe açıkla.
- Kullanıcı açıkça istemedikçe İngilizce iletişime dönme.
- Dosya adlarını, yolları, komutları, hata kodlarını, API adlarını, değişkenleri, paket adlarını ve teknik tanımlayıcıları çevirme.
- İç kod yorumları ve teknik belgeler gerektiğinde İngilizce olabilir.

## Project preservation and safety

- Preserve existing SQLite records, agent configuration, task and approval history, API field names and language-neutral IDs.
- Never translate or overwrite user-authored tasks, creative assets, vault documents or original technical reports automatically.
- UI language is independent from studio content language: Niko defaults to en-US; Son Yedek defaults to tr-TR.
- Keep all servers on loopback. No automatic publishing, paid API calls, uncontrolled execution, social-account connections or automatic GitHub pushes.
- Codex CLI, Remotion, Obsidian and external skills remain disabled until explicitly authorized in a later phase. Do not alter global Codex configuration or existing skills.
- Never reset/delete the application database, modify vaults or original media, or weaken security boundaries.
- Clearly label simulated results. Do not invent successful execution, files, metrics or runtime availability.
- Run applicable typecheck, build and tests. Report actual results and explicitly identify untested behavior.

## Permanent internationalization and open-source standard

- Continue communicating with the project owner in Turkish. This is independent of implementation and public documentation language.
- Use English source identifiers, paths, models, API fields/routes, internal statuses, comments, technical contracts, skill definitions, commit messages and public technical documentation.
- Keep the public README and installation instructions in English; maintain README.tr.md with reciprocal language links. CONTRIBUTING.md, docs/architecture.md and .env.example descriptions are English.
- Use stable semantic translation keys and central dictionaries. Never use translated prose as a key or hardcode interface copy in React. Register additional languages centrally.
- Personal deployments default to tr-TR. Public deployments detect supported browser language and fall back to en-US. Valid saved preferences always win; never reset the owner's Turkish preference.
- CEO summaries follow the selected UI language. Studio content settings remain independent and existing creative content remains unchanged.
- Never rename database fields, tables, public APIs or persisted statuses without a reviewed compatibility/migration plan. Translation-key migration is a frontend presentation change only.
- Keep credentials, connection secrets, personal notes, private production assets, machine-specific paths, database exports, rendered media and private logs out of public Git content. Use environment configuration and safe examples.
- Run npm run audit:public, typecheck, tests and build before a release review. Automated scanning is a guard, not a substitute for manual review of staged files and Git history.
- Do not publish, push, change repository visibility or select a public license on the operator's behalf without explicit approval. Document unresolved release requirements.

## Python execution restriction

- Python is prohibited by default. Do not launch Python scripts, python.exe, pythonw.exe, py.exe, Python automation, or install/update Python packages.
- Use Node.js, TypeScript, Prisma, PowerShell and PostgreSQL native utilities instead.
- Do not interfere with existing Python applications or unrelated processes. Never indiscriminately terminate Python, Node.js or browser processes. Avoid unnecessary background processes and resource-intensive parallel jobs.
- An emergency exception requires an urgent essential operation with no reasonable alternative. Before execution, explain in Turkish why Python is required, the exact command/script and risks to running applications, and obtain explicit operator approval. Silence and general task approval are not permission. Without that approval, stop only the Python-dependent operation safely.

## Supabase preparation boundary

- Connection/role preparation alone does not authorize live SQL changes, credential changes, data transfer or application cutover. Keep migration approval flags false until separately and explicitly authorized.
- Keep administrative/migration and restricted runtime credentials separate in ignored local environment files. Never print passwords or include them in commands, public documentation, frontend variables or chat.
