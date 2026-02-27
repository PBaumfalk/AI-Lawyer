---
phase: 13-hybrid-search-reranking
plan: "01"
subsystem: api
tags: [rag, hybrid-search, reranking, pgvector, meilisearch, ollama, rrf, typescript]

# Dependency graph
requires:
  - phase: 12-rag-schema-foundation
    provides: document_chunks table with chunkType/parentChunkId columns and HNSW indexes
provides:
  - RrfCandidate interface and rerankWithOllama() function in src/lib/ai/reranker.ts
  - HybridSearchResult interface, reciprocalRankFusion(), and hybridSearch() in src/lib/embedding/hybrid-search.ts
  - Single-batch Ollama reranking with AbortSignal.timeout(3000) and JSON fallback
  - BM25 + pgvector + RRF fusion pipeline ready for Plan 03 wiring
affects:
  - 13-02 (chunking/storage — parallel plan providing chunkType in vector results)
  - 13-03 (route wiring — imports hybridSearch() and uses HybridSearchResult)
  - 14-gesetze-rag (same RRF + reranker pattern reusable)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-batch Ollama reranking: one prompt for N candidates, regex JSON extraction for Qwen3 <think> prefix"
    - "RRF k=60: reciprocalRankFusion() merges BM25 + vector ranked lists via Map keyed by chunk ID"
    - "BM25-to-chunk resolution: DISTINCT ON SQL gets one best child chunk per document in one round-trip"
    - "Parent content lookup: CHILD chunks get parent 2000-token context; STANDALONE uses own content"
    - "12,000-char context budget: top 3 results get full parent, remaining get child content"
    - "Cross-Akte RBAC post-filter: Meilisearch BM25 hits filtered after retrieval against accessible akteIds"

key-files:
  created:
    - src/lib/ai/reranker.ts
    - src/lib/embedding/hybrid-search.ts
  modified: []

key-decisions:
  - "Inline vector SQL in hybrid-search.ts instead of calling searchSimilar() — current SearchResult lacks id, chunkType, parentChunkId which are all required for RRF keying and parent lookup"
  - "AbortSignal.timeout(3000) on Ollama reranker fetch — fallback to RRF top-10 on any error including timeout"
  - "DISTINCT ON (dokumentId) for BM25-to-chunk resolution preserves one chunk per document in a single SQL round-trip (not N+1)"

patterns-established:
  - "Hybrid retrieval pipeline: BM25 parallel + vector parallel -> RRF -> reranker -> parent lookup -> context budget"

requirements-completed:
  - RAGQ-01
  - RAGQ-03

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 13 Plan 01: Hybrid Search + Reranking Core Library Summary

**Batch Ollama reranker (qwen3.5:35b) and BM25+pgvector+RRF hybrid-search orchestrator with 12,000-char parent-content context budget**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T00:13:05Z
- **Completed:** 2026-02-27T00:16:18Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `src/lib/ai/reranker.ts`: RrfCandidate interface + rerankWithOllama() using single Ollama batch prompt with regex JSON extraction to handle Qwen3 `<think>...</think>` prefix
- `src/lib/embedding/hybrid-search.ts`: reciprocalRankFusion() (k=60, Map-based) + hybridSearch() full pipeline orchestrator
- BM25-to-chunk resolution via DISTINCT ON SQL (one round-trip per search, not N+1)
- Cross-Akte RBAC enforced via post-filter on BM25 hits against prisma-fetched accessible akteIds
- Parent content lookup with 12,000-char total context budget (top 3 get full parent, rest get child)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create reranker module** - `15b7ff0` (feat)
2. **Task 2: Create hybrid-search orchestrator** - `23a9df3` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/ai/reranker.ts` - RrfCandidate interface, rerankWithOllama() with AbortSignal.timeout, regex JSON extraction, graceful RRF fallback
- `src/lib/embedding/hybrid-search.ts` - HybridSearchResult interface, reciprocalRankFusion() (k=60), hybridSearch() pipeline orchestrator

## Decisions Made
- **Inline vector SQL instead of searchSimilar():** The current `searchSimilar()` return type (SearchResult) does not include `id`, `chunkType`, or `parentChunkId` — all required for RRF keying and parent content lookup. Rather than depending on Plan 02's updated interface, hybrid-search.ts queries pgvector directly with raw SQL. This avoids a circular dependency and keeps hybrid-search.ts self-contained.
- **AbortSignal.timeout(3000):** Prevents reranker latency from blocking RAG responses. Falls back silently to RRF-ordered top-10 on any error.
- **DISTINCT ON for BM25-to-chunk resolution:** Single SQL with `DISTINCT ON (dc."dokumentId")` ordered by vector similarity gets the best child chunk for each BM25 document hit in one round-trip. Avoids N+1 queries.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Set iteration TypeScript errors in hybrid-search.ts**
- **Found during:** Task 2 (TypeScript compilation verification)
- **Issue:** `new Set(["bm25"])` inferred as `Set<string>`, causing type mismatch with `Set<"bm25" | "vector">` and spread syntax issues under tsc
- **Fix:** Explicit generic `new Set<"bm25" | "vector">(...)` and `Array.from(entry.sources)` instead of spread operator
- **Files modified:** src/lib/embedding/hybrid-search.ts
- **Verification:** `npx tsc --noEmit --skipLibCheck` shows no errors in hybrid-search.ts
- **Committed in:** 23a9df3 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/type error)
**Impact on plan:** Minor type fix required for TypeScript compliance. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in `src/components/ki/chat-layout.tsx` and `src/components/ki/chat-messages.tsx` (UIMessage export from @ai-sdk/react) — out of scope, logged to deferred items.

## User Setup Required
None - no external service configuration required. Ollama URL read from `OLLAMA_URL` env var (defaults to `http://localhost:11434`).

## Next Phase Readiness
- `src/lib/ai/reranker.ts` and `src/lib/embedding/hybrid-search.ts` are ready to import
- Plan 02 (parallel): chunking/storage — will update `chunkType` + `parentChunkId` fields in document_chunks insert path
- Plan 03: route wiring — can import `hybridSearch()` and `HybridSearchResult` without modification
- Both files export all types and functions specified in plan's `must_haves.artifacts`

---
*Phase: 13-hybrid-search-reranking*
*Completed: 2026-02-27*
