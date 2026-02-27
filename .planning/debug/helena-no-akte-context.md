---
status: resolved
trigger: "Helena KI-Assistentin does not find any context from the selected Akte"
created: 2026-02-27T00:00:00Z
updated: 2026-02-27T09:00:00Z
resolved: 2026-02-27T09:00:00Z
---

## Resolution

Root cause: Raw SQL query in ki-chat route.ts used `"Dokument"` (Prisma model name) instead of `"dokumente"` (actual PostgreSQL table name via `@@map`). The query crashed with `relation "Dokument" does not exist`, the error was caught silently, and Chain A returned empty string — Helena had zero Akte context.

Additionally, the `## Denkprozess` instruction with `[Deine Antwort hier]` was appended at the end of SYSTEM_PROMPT_BASE, before the Akte context block. The model interpreted this as end-of-instructions and ignored subsequent context.

Fixes applied:
1. `src/app/api/ki-chat/route.ts` — Changed `FROM "Dokument"` to `FROM "dokumente"` in raw SQL (commit 5f3237e)
2. `src/app/api/ki-chat/route.ts` — Moved Denkprozess instruction to middle of prompt, removed `[Deine Antwort hier]` (commit 3750679)

Verified: User confirmed Helena now has Aktenkontext.
