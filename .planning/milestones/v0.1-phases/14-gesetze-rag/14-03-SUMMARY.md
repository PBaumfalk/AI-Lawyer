---
phase: 14-gesetze-rag
plan: "03"
subsystem: api
tags: [ki-chat, gesetze-rag, pgvector, ollama, rag, law-chunks, system-prompt]

# Dependency graph
requires:
  - phase: 14-01
    provides: searchLawChunks() function and LawChunkResult interface in src/lib/gesetze/ingestion.ts
  - phase: 13-03
    provides: hybridSearch() + generateQueryEmbedding() used by Chain B in ki-chat/route.ts
provides:
  - Chain D (law_chunks parallel retrieval) wired into ki-chat/route.ts alongside Chains A/B/C
  - Shared queryEmbeddingPromise — single Ollama embedding call reused by both Chain B and Chain D
  - GESETZE-QUELLEN system prompt block with "nicht amtlich" disclaimers and Quellenlinks
  - Score threshold 0.6 filter — non-legal queries receive no law context
affects: [15-normen-verknuepfung, ki-chat tests, Helena system prompt]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared Promise pattern: generate resource once, await in multiple parallel chains"
    - "Non-fatal chain pattern: Chain D failure returns [] and Helena continues from hybridSearch"
    - "Score gate pattern: minScore:0.6 filters law_chunks for non-legal queries"

key-files:
  created: []
  modified:
    - src/app/api/ki-chat/route.ts

key-decisions:
  - "queryEmbeddingPromise declared before Chain B — both Chain B and Chain D await it, guaranteeing single Ollama call"
  - "Chain D non-fatal: try/catch returns [] on error, Helena still responds from hybridSearch"
  - "GESETZE-QUELLEN block injected AFTER existing QUELLEN block — law context supplements document context"
  - "minScore:0.6 chosen as threshold — high enough to filter general queries, low enough to catch relevant Normen"

patterns-established:
  - "Chain D pattern: searchLawChunks(queryEmbedding, { limit: 5, minScore: 0.6 }) with shared embedding"
  - "System prompt injection order: AKTEN-KONTEXT > confidence instruction > QUELLEN > GESETZE-QUELLEN"

requirements-completed: [GESETZ-03]

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 14 Plan 03: Gesetze-RAG Chain D Summary

**Helena now retrieves top-5 relevant Bundesgesetz-Paragraphen in parallel with document search using a single shared Ollama embedding — legal queries receive GESETZE-QUELLEN with "nicht amtlich" disclaimers and Quellenlinks injected into the system prompt**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-27T06:29:59Z
- **Completed:** 2026-02-27T06:31:52Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `searchLawChunks` import and Chain D (lawChunksPromise) to ki-chat/route.ts
- Extracted `generateQueryEmbedding` call from inside Chain B to a shared `queryEmbeddingPromise` before Chain B — eliminates double Ollama round-trip
- Chain B and Chain D both await `queryEmbeddingPromise` — embedding is generated exactly once regardless of how many chains consume it
- Promise.all now awaits 4 chains (A, B, C, D) fully in parallel
- GESETZE-QUELLEN block injected into system prompt only when law_chunks with score >= 0.6 found — non-legal queries receive no law context overhead
- Every injected Norm carries `HINWEIS: nicht amtlich — Stand: [date] | Quelle: [url]` with canonical gesetze-im-internet.de link

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Chain D — law_chunks parallel retrieval to ki-chat** - `5e68633` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/app/api/ki-chat/route.ts` - Shared embedding, Chain D, GESETZE-QUELLEN system prompt injection

## Decisions Made
- `queryEmbeddingPromise` declared outside both Chain B and Chain D as a standalone shared Promise — both chains `await` it independently; Node.js Promise memoization ensures the underlying work runs only once
- Chain D failure returns `[]` silently — Helena still responds from hybridSearch results without law context (graceful degradation)
- `minScore: 0.6` is the threshold for law chunk injection — high enough to avoid polluting general queries with irrelevant Normen, low enough to catch topically related paragraphs
- GESETZE-QUELLEN injected after ENDE QUELLEN so document context always precedes law context — preserves existing source citation behavior [1][2] etc.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiled cleanly, all verification checks passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 14 complete: all 3 plans done (14-01: ingestion library, 14-02: cron sync processor, 14-03: ki-chat Chain D)
- Phase 15 (Normen-Verknuepfung in Akte) can begin — Helena can now cite Gesetze; next step is surfacing them in the Akte UI
- law_chunks table must be populated via gesetze-sync cron (14-02) before Chain D produces results in production

## Self-Check: PASSED

- FOUND: src/app/api/ki-chat/route.ts
- FOUND: .planning/phases/14-gesetze-rag/14-03-SUMMARY.md
- FOUND: commit 5e68633 (feat: Chain D)
- FOUND: commit 8985b5b (docs: metadata)

---
*Phase: 14-gesetze-rag*
*Completed: 2026-02-27*
