---
phase: 17-urteile-rag
plan: "03"
subsystem: ki-chat
tags: [ki-chat, rag, pgvector, urteile, chain-e, citation, anti-hallucination]

# Dependency graph
dependency_graph:
  requires:
    - phase: 17-01
      provides: "src/lib/urteile/ingestion.ts (searchUrteilChunks, UrteilChunkResult)"
  provides:
    - src/app/api/ki-chat/route.ts (Chain E parallel Urteil retrieval + URTEILE-QUELLEN system prompt injection)
  affects:
    - Helena system prompt — gains URTEILE-QUELLEN block with Gericht + AZ + Datum + Quellenlink per Urteil

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Chain E mirrors Chain D pattern exactly: skipRag guard + async IIFE + non-fatal catch returning []
    - urteilChunksPromise added as 5th element to existing Promise.all() alongside Chain D
    - URTEILE-QUELLEN block injection uses DB-sourced citation fields only (URTEIL-04 compliance)
    - Anti-hallucination instruction embedded in system prompt: never fabricate AZ values

key-files:
  created: []
  modified:
    - src/app/api/ki-chat/route.ts

key-decisions:
  - "Chain E failure is non-fatal — catch returns [] so Helena responds without Urteile without crashing ki-chat"
  - "queryEmbeddingPromise shared between Chain B, D, and E — single Ollama embedding call for all three chains"
  - "minScore:0.6 gates Urteil injection — same threshold as Chain D (law_chunks) for consistency"
  - "URTEILE-QUELLEN block injected after GESETZE-QUELLEN, before Stream the AI response section"
  - "All citation fields (gericht, aktenzeichen, datum, sourceUrl) read from DB result, never LLM-generated (URTEIL-04)"

requirements-completed: [URTEIL-04]

# Metrics
duration: ~1min
completed: "2026-02-27"
---

# Phase 17 Plan 03: Ki-chat Chain E — Urteil RAG Injection Summary

**Chain E parallel Urteil retrieval from urteil_chunks with structured URTEILE-QUELLEN citation injection and anti-hallucination AZ instruction in Helena's system prompt.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-27T09:47:42Z
- **Completed:** 2026-02-27T09:49:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `import { searchUrteilChunks, type UrteilChunkResult } from "@/lib/urteile/ingestion"` to ki-chat route
- Chain E promise definition mirrors Chain D exactly: `skipRag` guard + async IIFE + non-fatal catch returning `[]`
- `urteilChunksPromise` added as 5th element to existing `Promise.all()` alongside Chain D — both resolve in parallel
- URTEILE-QUELLEN system prompt block injected after GESETZE-QUELLEN: `[U1] Gericht AZ vom Datum\ncontent\nQuelle: url`
- Anti-hallucination instruction: "Wenn kein Aktenzeichen in den URTEILE-QUELLEN steht, zitiere das Urteil NICHT und erfinde kein AZ"
- When urteil_chunks returns 0 results (empty DB or low scores), no URTEILE-QUELLEN block appears — Helena responds without Urteile gracefully

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Chain E and URTEILE-QUELLEN injection to ki-chat route** - `9b75afd` (feat)

## Files Created/Modified

- `src/app/api/ki-chat/route.ts` — 5 targeted insertions: import, chain comment, Chain E promise, Promise.all 5th element, URTEILE-QUELLEN injection block

## Decisions Made

- Chain E failure is non-fatal — catch returns `[]` so Helena responds without Urteile without crashing ki-chat
- `queryEmbeddingPromise` shared between Chain B (hybridSearch), Chain D (law_chunks), and Chain E (urteil_chunks) — single Ollama embedding call for all three chains
- `minScore:0.6` threshold for Urteil injection — same as Chain D for consistency
- All citation fields sourced from DB result only (URTEIL-04 compliance: no LLM-generated Aktenzeichen)

## Deviations from Plan

None — plan executed exactly as written. All 5 insertions applied without modification. TypeScript compiled clean on first attempt.

## Issues Encountered

None.

## Next Phase Readiness

- Phase 17 is complete (all 3 plans done)
- Phase 18 (Muster-RAG + Admin Upload UI) can begin
- Helena now cites real German court decisions with verified Gericht + AZ + Datum + Quellenlink from urteil_chunks

## Self-Check: PASSED

Files modified:
- [x] `src/app/api/ki-chat/route.ts` — exists, contains Chain E promise + Promise.all[4] + URTEILE-QUELLEN block

Commits:
- [x] `9b75afd` — feat(17-03): add Chain E — parallel Urteil retrieval and URTEILE-QUELLEN injection

TypeScript: clean (`npx tsc --noEmit` exits 0, zero errors)

Done criteria verified:
- [x] `grep "searchUrteilChunks" src/app/api/ki-chat/route.ts` — line 29 (import) + line 501 (usage)
- [x] `grep "urteilChunks" src/app/api/ki-chat/route.ts` — Chain E promise (494), Promise.all (511-512), injection block (564-578)
- [x] `grep "URTEILE-QUELLEN" src/app/api/ki-chat/route.ts` — block header (565) + instruction text (578)
- [x] `grep "erfinde kein AZ" src/app/api/ki-chat/route.ts` — line 578
- [x] `npx tsc --noEmit` exits 0

---
*Phase: 17-urteile-rag*
*Completed: 2026-02-27*
