---
phase: 18-muster-rag-admin-upload-ui
plan: "03"
subsystem: api
tags: [ki-chat, rag, pgvector, muster, schriftsatz, chain-f, langchain]

# Dependency graph
requires:
  - phase: 18-01
    provides: searchMusterChunks + MusterChunkResult from @/lib/muster/ingestion
  - phase: 18-02
    provides: muster_chunks DB populated via musterIngestionQueue + seedAmtlicheFormulare
  - phase: 17-03
    provides: Chain E pattern (urteil_chunks retrieval) that Chain F mirrors exactly
  - phase: 14-03
    provides: queryEmbeddingPromise sharing pattern across all RAG chains
provides:
  - Chain F (musterChunksPromise) in ki-chat route — muster_chunks parallel retrieval
  - MUSTER-QUELLEN system prompt injection with herkunft, parentContent, ENTWURF instruction
  - Phase 18 complete — all 5 requirements ARBW-01 through ARBW-05 addressed
affects:
  - ki-chat, Helena system prompt, Schriftsatz-Entwurf generation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chain F mirrors Chain E exactly: skipRag guard + async IIFE + non-fatal catch returning []"
    - "queryEmbeddingPromise shared across Chain B, D, E, F — single Ollama call regardless of chain count"
    - "minScore 0.55 for muster (vs 0.6 for law/urteil) — template content has lower embedding signal due to {{PLATZHALTER}} density"
    - "MUSTER-QUELLEN injection after URTEILE-QUELLEN — includes herkunft (Kanzlei-Muster vs Amtliches Formular), parentContent fallback to content"

key-files:
  created: []
  modified:
    - src/app/api/ki-chat/route.ts

key-decisions:
  - "Chain F minScore 0.55 (not 0.6): template content with {{PLATZHALTER}} has lower cosine similarity due to placeholder density"
  - "queryEmbeddingPromise is shared — Chain F reuses the same embedding as Chain B/D/E, no additional Ollama call"
  - "Chain F failure is non-fatal — catch returns [] so Helena responds without Muster context without crashing"
  - "parentContent fallback to content in MUSTER-QUELLEN: uses parent chunk (larger context window) when available, otherwise child chunk"

patterns-established:
  - "MUSTER-QUELLEN block format: [M1] MusterName (Kanzlei-Muster/Amtliches Formular, Kategorie: X) followed by parentContent"
  - "Schriftsatz ENTWURF instruction: RUBRUM + ANTRAEGE + BEGRUENDUNG structure with explicit {{PLATZHALTER}} for missing data"

requirements-completed: [ARBW-05]

# Metrics
duration: 1min
completed: 2026-02-27
---

# Phase 18 Plan 03: Helena Chain F — Muster-RAG System Prompt Injection Summary

**Chain F musterChunksPromise wired into ki-chat's 6-element Promise.all with MUSTER-QUELLEN system prompt injection for structurally correct Schriftsatz-Entwurf generation**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-27T10:57:10Z
- **Completed:** 2026-02-27T10:58:30Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- Added Chain F (musterChunksPromise) mirroring Chain E exactly with skipRag guard, async IIFE, and non-fatal catch returning []
- Extended Promise.all from 5 to 6 elements — all chains resolve in parallel with no additional latency from Chain F
- MUSTER-QUELLEN system prompt block injected after URTEILE-QUELLEN — includes herkunft (Kanzlei-Muster vs Amtliches Formular), parentContent fallback to content, and ENTWURF closing instruction
- Phase 18 complete — all 5 ARBW requirements addressed across Plans 01-03

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Chain F and MUSTER-QUELLEN injection to ki-chat route** - `84e89cd` (feat)

**Plan metadata:** (see docs commit below)

## Files Created/Modified

- `src/app/api/ki-chat/route.ts` - Import + Chain F promise + extended Promise.all + MUSTER-QUELLEN injection block

## Decisions Made

- Chain F minScore 0.55 (not 0.6): template content with {{PLATZHALTER}} has lower cosine similarity due to placeholder density — wider retrieval needed
- queryEmbeddingPromise is shared — Chain F reuses the same embedding as Chain B/D/E, no additional Ollama call added
- Chain F failure is non-fatal — catch returns [] so Helena responds without Muster context without crashing ki-chat
- parentContent fallback to content in MUSTER-QUELLEN: uses parent chunk (larger context window) when available, otherwise child chunk content

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript clean (`npx tsc --noEmit` exits 0).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 18 complete. All 5 ARBW requirements addressed:
- ARBW-01: Prisma schema + pgvector table + search function (Plan 01)
- ARBW-02: Ingestion pipeline + seed amtliche Formulare (Plan 01)
- ARBW-03: NER-PII gate for uploaded Muster (Plan 02)
- ARBW-04: Admin upload UI + REST API (Plan 02)
- ARBW-05: Helena Chain F — muster_chunks retrieval + MUSTER-QUELLEN injection (Plan 03)

v3.4 Helena RAG milestone complete. Helena now retrieves top-5 Schriftsatzmuster in parallel and injects RUBRUM/ANTRAEGE/BEGRUENDUNG structure guidance into every relevant response.

---
*Phase: 18-muster-rag-admin-upload-ui*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: src/app/api/ki-chat/route.ts
- FOUND: .planning/phases/18-muster-rag-admin-upload-ui/18-03-SUMMARY.md
- FOUND: commit 84e89cd (feat(18-03): add Chain F muster_chunks retrieval + MUSTER-QUELLEN injection)
