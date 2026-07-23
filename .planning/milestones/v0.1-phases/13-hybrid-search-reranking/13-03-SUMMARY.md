---
phase: 13-hybrid-search-reranking
plan: "03"
subsystem: api
tags: [rag, hybrid-search, embedding, bullmq, parent-child, pgvector, meilisearch, rrf, reranking]

# Dependency graph
requires:
  - phase: 13-hybrid-search-reranking
    plan: 01
    provides: hybridSearch() and HybridSearchResult in src/lib/embedding/hybrid-search.ts
  - phase: 13-hybrid-search-reranking
    plan: 02
    provides: chunkDocumentParentChild() and insertParentChildChunks() in chunker.ts / vector-store.ts
provides:
  - "Live embedding pipeline: BullMQ processor stores PARENT + CHILD chunks (not STANDALONE)"
  - "Live retrieval pipeline: ki-chat POST uses hybridSearch with BM25+vector+RRF+reranking"
  - "LLM system prompt receives contextContent (parent 2000 tokens) instead of content (child 500 tokens)"
  - "sourcesData includes sources field indicating retrieval origin (bm25, vector, or both)"
affects:
  - All future documents (new embeddings will use PARENT/CHILD chunkType)
  - Helena chat responses (broader context window in system prompt via parent chunks)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase 13 end-to-end: new document -> BullMQ -> chunkDocumentParentChild -> insertParentChildChunks -> PARENT/CHILD rows in DB"
    - "Helena query -> hybridSearch (bm25Limit:50, vectorLimit:50) -> RRF -> reranker -> contextContent in system prompt"
    - "RRF confidence: any returned result = 'ok'; empty = 'none'; 'low' reserved for future quality scoring"
    - "AI scan fullText built from embeddedGroups child content (same coverage as pre-Phase-13 STANDALONE)"

key-files:
  created: []
  modified:
    - src/lib/queue/processors/embedding.processor.ts
    - src/app/api/ki-chat/route.ts

key-decisions:
  - "confidenceFlag 'low' not used for RRF results — RRF scores are not comparable to cosine similarity thresholds; any returned result is meaningful"
  - "sourcesData passage preview uses src.content (child chunk) not contextContent — appropriate size for UI display; contextContent stays in system prompt only"
  - "bm25Limit:50 + vectorLimit:50 -> finalLimit:10 — wide candidate nets for RRF fusion; reranker narrows to top 10"

requirements-completed: [RAGQ-01, RAGQ-03]

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 13 Plan 03: Route Wiring — Hybrid Search Pipeline Live Summary

**Embedding processor switched to parent-child chunking; ki-chat route wired to hybridSearch with BM25+vector+RRF+reranking and parent contextContent in LLM system prompt**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-27T00:18:47Z
- **Completed:** 2026-02-27T00:21:10Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `src/lib/queue/processors/embedding.processor.ts`: Replaced `chunkDocument` + `insertChunks` with `chunkDocumentParentChild` + `insertParentChildChunks`. New documents now produce PARENT rows (no embedding) + CHILD rows (with embedding + FK). Progress tracking updated to use `processedChildren / totalChildCount`. AI scan fullText built from child content.
- `src/app/api/ki-chat/route.ts`: Replaced `searchSimilar` with `hybridSearch` (bm25Limit:50, vectorLimit:50, finalLimit:10). LLM system prompt now uses `src.contextContent` (~2000-token parent chunk) instead of `src.content` (~500-token child). `sourcesData` includes new `sources` field showing BM25/vector retrieval origin. Confidence scoring simplified: RRF results always `"ok"`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Switch embedding processor to parent-child pipeline** - `572488d` (feat)
2. **Task 2: Wire ki-chat route to hybridSearch** - `22bbf6c` (feat)

## Files Created/Modified

- `src/lib/queue/processors/embedding.processor.ts` - chunkDocumentParentChild + insertParentChildChunks; per-child progress tracking; AI scan fullText from child content
- `src/app/api/ki-chat/route.ts` - hybridSearch replacing searchSimilar; contextContent in system prompt; sources field in sourcesData; simplified RRF confidence flag

## Decisions Made

- **confidenceFlag simplified:** RRF scores (max ~0.016) are not comparable to raw cosine similarity (threshold was 0.3). Any RRF result is meaningful — set directly to `"ok"`. `"low"` reserved for a future quality-scoring layer.
- **passage preview uses content not contextContent:** The `passage` field in `sourcesData` is used for UI display (200 chars). Using child `content` for this is correct — contextContent (~2000 tokens) is too large for UI snippets and belongs only in the LLM system prompt.
- **Wide candidate nets (50+50):** bm25Limit:50 and vectorLimit:50 give RRF maximum fusion surface before reranker narrows to finalLimit:10. This matches the hybrid-search.ts interface defaults.

## Deviations from Plan

None - plan executed exactly as written.

## Phase 13 Pipeline Status

Phase 13 is now end-to-end active:

1. **New document uploaded** -> OCR -> BullMQ embedding job
2. **embedding.processor.ts** -> `chunkDocumentParentChild()` -> `insertParentChildChunks()` -> PARENT + CHILD rows in `document_chunks`
3. **Helena chat query** -> `generateQueryEmbedding()` + queryText -> `hybridSearch()` -> BM25 (Meilisearch) + vector (pgvector) -> RRF -> `rerankWithOllama()` -> parent `contextContent` lookup
4. **System prompt** receives parent chunk (~2000 tokens) for each source instead of child chunk (~500 tokens)
5. **sourcesData** includes `sources: ['bm25', 'vector'] | ['bm25'] | ['vector']` for UI transparency

**Pre-Phase-13 STANDALONE documents:** Unaffected. `searchSimilar()` guards `chunkType != 'PARENT'`; STANDALONE chunks pass through. No re-embedding required.

## Self-Check: PASSED

- FOUND: src/lib/queue/processors/embedding.processor.ts
- FOUND: src/app/api/ki-chat/route.ts
- FOUND: .planning/phases/13-hybrid-search-reranking/13-03-SUMMARY.md

---
*Phase: 13-hybrid-search-reranking*
*Completed: 2026-02-27*
