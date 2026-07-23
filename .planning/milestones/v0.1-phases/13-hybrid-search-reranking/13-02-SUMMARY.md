---
phase: 13-hybrid-search-reranking
plan: "02"
subsystem: database
tags: [pgvector, langchain, embeddings, rag, parent-child-chunking, prisma]

# Dependency graph
requires:
  - phase: 12-rag-schema-foundation
    provides: "chunkType column (STANDALONE/PARENT/CHILD enum) and parentChunkId FK on document_chunks table"
provides:
  - "chunkDocumentParentChild() function splitting text into parent (~8000 chars) + child (~2000 chars) pairs"
  - "insertParentChildChunks() storing PARENT rows (no embedding) and CHILD rows (with embedding + FK)"
  - "fetchParentContent() — single JOIN query returning Map<childId, parentContent>"
  - "SearchResult extended with id, chunkType, parentChunkId fields"
  - "searchSimilar() filters PARENT chunks in all 4 query branches"
affects:
  - 13-hybrid-search-reranking (Plan 03 embedding processor, Plan 01 hybrid-search orchestrator)
  - any consumer of SearchResult interface

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parent-child chunking: large PARENT (~8000 char) stored without embedding as context window; smaller CHILD (~2000 char) embedded and used for retrieval"
    - "Global child index across all parents — children numbered sequentially (not restarted per parent)"
    - "PARENT rows use NULL embedding; chunkType != 'PARENT' filter prevents unembedded rows from poisoning ANN search"

key-files:
  created: []
  modified:
    - src/lib/embedding/chunker.ts
    - src/lib/embedding/vector-store.ts

key-decisions:
  - "chunkDocumentParentChild uses same GERMAN_LEGAL_SEPARATORS as existing chunkDocument — consistent legal text splitting across both pipelines"
  - "PARENT rows stored with NULL embedding — they exist solely as context retrieval units, never as ANN search candidates"
  - "insertChunks() preserved unchanged alongside insertParentChildChunks() — STANDALONE pipeline continues working until Plan 03 switches the processor"
  - "fetchParentContent() returns a Map not an array — O(1) lookup for reranker context substitution"

patterns-established:
  - "Dual-pipeline coexistence: insertChunks (STANDALONE) and insertParentChildChunks (PARENT/CHILD) coexist until Plan 03 migration"
  - "All searchSimilar branches guard AND chunkType != 'PARENT' — prevents NULL embedding rows from entering ANN distance calculation"

requirements-completed: [RAGQ-01, RAGQ-03]

# Metrics
duration: 8min
completed: 2026-02-27
---

# Phase 13 Plan 02: Hybrid Search — Parent-Child Chunking Primitives Summary

**Parent-child chunking primitives added to chunker.ts and vector-store.ts: 8000-char PARENT + 2000-char CHILD splits, idempotent insertParentChildChunks(), fetchParentContent() JOIN query, and PARENT-filter guard across all 4 searchSimilar() branches**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-27T00:06:19Z
- **Completed:** 2026-02-27T00:14:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `chunkDocumentParentChild()` splits German legal text into parent-child pairs with globally-indexed children, reusing GERMAN_LEGAL_SEPARATORS
- `insertParentChildChunks()` stores PARENT rows (NULL embedding, chunkType='PARENT') and CHILD rows (with embedding + parentChunkId FK) idempotently via `deleteChunks()` first
- `fetchParentContent()` retrieves parent context for a batch of child chunk IDs via a single JOIN query, returning Map<childId, parentContent>
- `SearchResult` interface extended with `id`, `chunkType`, `parentChunkId` (backward compatible — additive only)
- All 4 `searchSimilar()` query branches now SELECT `dc.id`, `dc."chunkType"`, `dc."parentChunkId"` and guard `AND dc."chunkType" != 'PARENT'`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add chunkDocumentParentChild to chunker.ts** - `b6ca1a3` (feat)
2. **Task 2: Upgrade vector-store.ts with parent-child storage and updated search** - `9dafd2f` (feat)

**Plan metadata:** TBD (docs commit)

## Files Created/Modified
- `src/lib/embedding/chunker.ts` - Added `chunkDocumentParentChild()` alongside preserved `chunkDocument()` and `createLegalTextSplitter()`
- `src/lib/embedding/vector-store.ts` - Extended `SearchResult`, updated 4 SQL branches in `searchSimilar()`, added `insertParentChildChunks()` and `fetchParentContent()`

## Decisions Made
- Used `GERMAN_LEGAL_SEPARATORS` for both parent and child splitters — consistent legal section boundary awareness across both chunk sizes
- Global child index (not reset per parent) — enables stable chunkIndex ordering for the full document regardless of parent grouping
- `insertChunks()` left untouched — STANDALONE embedding pipeline remains fully functional until Plan 03 switches the processor

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - both files compiled cleanly. Pre-existing TypeScript errors in `@ai-sdk/react` chat components (UIMessage export) are unrelated to this plan and were not touched.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03 (embedding processor) can now call `chunkDocumentParentChild()` from chunker.ts and `insertParentChildChunks()` from vector-store.ts
- Plan 01 (hybrid-search orchestrator) can call `fetchParentContent()` for context expansion after reranking
- `SearchResult.id` is available for reranker to reference chunk IDs without additional DB queries

## Self-Check: PASSED

- FOUND: src/lib/embedding/chunker.ts
- FOUND: src/lib/embedding/vector-store.ts
- FOUND: .planning/phases/13-hybrid-search-reranking/13-02-SUMMARY.md
- FOUND commit b6ca1a3: feat(13-02): add chunkDocumentParentChild to chunker.ts
- FOUND commit 9dafd2f: feat(13-02): upgrade vector-store.ts with parent-child storage and updated search

---
*Phase: 13-hybrid-search-reranking*
*Completed: 2026-02-27*
