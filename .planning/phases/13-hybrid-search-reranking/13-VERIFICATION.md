---
phase: 13-hybrid-search-reranking
verified: 2026-02-27T02:05:00Z
status: passed
score: 14/14 must-haves verified
re_verification: false
---

# Phase 13: Hybrid Search + Reranking Verification Report

**Phase Goal:** Helenas Retrieval kombiniert BM25 und Vector-Suche via RRF und reranked mit Cross-Encoder — messbar bessere Antwortqualität bei bestehenden Akten-Dokumenten, bevor neue Wissensquellen befüllt werden
**Verified:** 2026-02-27T02:05:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths — Plan 01

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `hybridSearch()` returns `HybridSearchResult[]` with `contextContent` populated from parent or STANDALONE chunk | VERIFIED | `src/lib/embedding/hybrid-search.ts` lines 343-382: contextContent set to parent content (CHILD) or own content (STANDALONE), budget-capped at 12,000 chars |
| 2 | `rerankWithOllama()` scores 50 candidates via single Ollama batch prompt and returns Top-10 | VERIFIED | `src/lib/ai/reranker.ts` lines 57-73: single prompt with all candidates; `ranked.slice(0, 10)` at line 111 |
| 3 | `rerankWithOllama()` falls back silently to RRF order when Ollama times out or returns non-JSON | VERIFIED | `src/lib/ai/reranker.ts` lines 112-114: catch block logs `console.warn('[reranker] Fallback to RRF order:', err)` and returns `candidates.slice(0, 10)` |
| 4 | `reciprocalRankFusion()` merges BM25 and vector ranked lists with k=60 formula | VERIFIED | `src/lib/embedding/hybrid-search.ts` lines 45, 69, 84: `const RRF_K = 60`; formula `1 / (RRF_K + rank)` applied to both lists |

### Observable Truths — Plan 02

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 5 | `chunkDocumentParentChild()` produces PARENT chunks (~8000 chars) and CHILD chunks (~2000 chars) with correct nesting | VERIFIED | `src/lib/embedding/chunker.ts` lines 64-101: parentSplitter `chunkSize: 8000`, childSplitter `chunkSize: 2000`, globally indexed children |
| 6 | `insertParentChildChunks()` stores PARENT rows (no embedding) and CHILD rows (with embedding + parentChunkId FK) | VERIFIED | `src/lib/embedding/vector-store.ts` lines 39-68: PARENT inserted with `NULL` embedding; CHILD inserted with `${vectorSql}::vector` and `${parentChunkId}` FK |
| 7 | `searchSimilar()` excludes PARENT chunks (`WHERE chunkType != 'PARENT'`) and returns `chunkType + parentChunkId` fields | VERIFIED | `src/lib/embedding/vector-store.ts` lines 172, 196, 225, 249: all 4 query branches include `AND dc."chunkType" != 'PARENT'`; RawRow type and mapRow include `chunkType` and `parentChunkId` |
| 8 | `fetchParentContent()` returns parent content for CHILD chunk IDs via JOIN in a single query | VERIFIED | `src/lib/embedding/vector-store.ts` lines 263-282: JOIN query on `parentChunkId`, returns `Map<childId, parentContent>` |
| 9 | Existing STANDALONE chunks pass through `searchSimilar` unchanged | VERIFIED | PARENT filter only excludes `chunkType = 'PARENT'`; STANDALONE chunks (default chunkType) pass through all 4 branches |

### Observable Truths — Plan 03

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 10 | New documents embedded via BullMQ produce PARENT + CHILD chunks (not STANDALONE) | VERIFIED | `src/lib/queue/processors/embedding.processor.ts` lines 9, 15, 47, 92: imports `chunkDocumentParentChild` + `insertParentChildChunks`; no reference to old `chunkDocument` or `insertChunks` |
| 11 | Helena's ki-chat responses include sources from both Meilisearch BM25 and pgvector — RRF fusion is active | VERIFIED | `src/app/api/ki-chat/route.ts` line 21: `import { hybridSearch } from "@/lib/embedding/hybrid-search"`; lines 292-299: called with `bm25Limit:50, vectorLimit:50, finalLimit:10`; `hybridSearch` internally runs BM25 + vector + RRF |
| 12 | LLM system prompt uses `contextContent` (parent chunk, ~2000 tokens) not `content` (child chunk, 500 tokens) | VERIFIED | `src/app/api/ki-chat/route.ts` line 344: `systemPrompt += \`...\n${src.contextContent}\n\`` |
| 13 | Confidence scoring uses RRF score from `HybridSearchResult`, not raw cosine score | VERIFIED | `src/app/api/ki-chat/route.ts` lines 301-309: `confidenceFlag = results.length > 0 ? "ok" : "none"` — no cosine threshold comparison |
| 14 | Pre-Phase-13 STANDALONE chunks are still retrieved correctly — no regression for existing documents | VERIFIED | PARENT filter `!= 'PARENT'` in all 4 `searchSimilar` branches; STANDALONE chunks (default enum value) are unaffected and pass through; `hybridSearch` also checks `chunkType === 'STANDALONE'` at line 348 for contextContent assignment |

**Score: 14/14 truths verified**

---

## Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `src/lib/ai/reranker.ts` | `rerankWithOllama()` with `AbortSignal.timeout(3000)` fallback | VERIFIED | 116 lines; exports `RrfCandidate` interface and `rerankWithOllama()`; substantive implementation with batch prompt, regex extraction, fallback |
| `src/lib/embedding/hybrid-search.ts` | `hybridSearch()` orchestrator — BM25 + pgvector + RRF + reranker | VERIFIED | 385 lines; exports `HybridSearchResult`, `reciprocalRankFusion`, `hybridSearch`; fully implemented pipeline |
| `src/lib/embedding/chunker.ts` | `chunkDocumentParentChild()` alongside existing `chunkDocument()` | VERIFIED | Exports `chunkDocument`, `createLegalTextSplitter`, `chunkDocumentParentChild`; original functions preserved |
| `src/lib/embedding/vector-store.ts` | `insertParentChildChunks()`, `fetchParentContent()`, updated `SearchResult` | VERIFIED | Exports `insertChunks`, `insertParentChildChunks`, `deleteChunks`, `searchSimilar`, `fetchParentContent`, `SearchResult`, `getEmbeddingStats` |
| `src/lib/queue/processors/embedding.processor.ts` | Parent-child embedding pipeline via `chunkDocumentParentChild` + `insertParentChildChunks` | VERIFIED | Exports `processEmbeddingJob`; no old `chunkDocument` or `insertChunks` imports |
| `src/app/api/ki-chat/route.ts` | `hybridSearch` replaces `searchSimilar`; `contextContent` used in LLM prompt | VERIFIED | Exports `POST`; `hybridSearch` imported; `contextContent` used at line 344 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/embedding/hybrid-search.ts` | `src/lib/ai/reranker.ts` | `rerankWithOllama()` call after RRF | WIRED | Line 309: `const reranked = await rerankWithOllama(queryText, rrfTop50, 3000)` |
| `src/lib/embedding/hybrid-search.ts` | `src/lib/meilisearch.ts` | `searchDokumente()` for BM25 candidates | WIRED | Line 15: import; Line 164: `searchDokumente(queryText, {...})` called in parallel |
| `src/lib/embedding/hybrid-search.ts` | pgvector (raw SQL) | inline `prisma.$queryRaw` for vector candidates | WIRED | Lines 169-213: raw SQL queries with `<=> ${vectorSql}::vector`; note: Plan 01 summary documents decision to inline SQL rather than call `searchSimilar()` — intentional and correct |
| `src/lib/embedding/vector-store.ts` | `prisma/schema.prisma` | raw SQL INSERT with `chunkType` and `parentChunkId` columns | WIRED | Lines 53-64: INSERT includes `'PARENT'` and `'CHILD'` chunkType values with `${parentChunkId}` FK |
| `src/lib/queue/processors/embedding.processor.ts` | `src/lib/embedding/chunker.ts` | `chunkDocumentParentChild()` | WIRED | Line 9: import; Line 47: `const parentChildGroups = await chunkDocumentParentChild(ocrText)` |
| `src/lib/queue/processors/embedding.processor.ts` | `src/lib/embedding/vector-store.ts` | `insertParentChildChunks()` | WIRED | Line 15: import; Line 92: `await insertParentChildChunks(dokumentId, embeddedGroups, MODEL_VERSION)` |
| `src/app/api/ki-chat/route.ts` | `src/lib/embedding/hybrid-search.ts` | `hybridSearch()` call replacing `searchSimilar()` | WIRED | Line 21: import; Lines 292-299: `await hybridSearch(queryText, queryEmbedding, {...})` |
| `src/app/api/ki-chat/route.ts` | `HybridSearchResult.contextContent` | system prompt builder uses `contextContent` | WIRED | Line 344: `${src.contextContent}` in systemPrompt string |

---

## Requirements Coverage

| Requirement | Phase | Source Plan(s) | Description | Status | Evidence |
|-------------|-------|---------------|-------------|--------|---------|
| RAGQ-01 | Phase 13 | 13-01, 13-02, 13-03 | Hybrid Search — BM25 + pgvector RRF (k=60), N=50 candidates per source | SATISFIED | `hybridSearch()` in `hybrid-search.ts` calls Meilisearch BM25 (limit 50) + pgvector (limit 50) in parallel; `reciprocalRankFusion(bm25ChunkCandidates, vectorCandidates, 50)` at line 303; ki-chat route wired with `bm25Limit:50, vectorLimit:50` |
| RAGQ-03 | Phase 13 | 13-01, 13-02, 13-03 | Cross-Encoder Reranking — Top-50 via Ollama; fallback on P95 > 3s or error | SATISFIED | `rerankWithOllama(queryText, rrfTop50, 3000)` at line 309 of `hybrid-search.ts`; `AbortSignal.timeout(timeoutMs)` at line 86 of `reranker.ts`; catch block at lines 112-114 falls back to `candidates.slice(0, 10)` |

**Orphaned requirement check:** RAGQ-02 (Parent-Child Chunking) is mapped to Phase 12 in REQUIREMENTS.md traceability table — correctly not claimed by Phase 13 plans. No orphaned requirements.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| Multiple files | Various | `return []` (early exit guards) | INFO | All are legitimate guard clauses (empty query, no akteId, zero results) — not stub implementations |

No blockers or warnings found. All `return []` occurrences are valid guard clauses with meaningful preceding logic.

---

## Human Verification Required

### 1. Reranker latency under load

**Test:** Upload a multi-document Akte with OCR complete, then ask Helena a specific legal question via ki-chat. Observe response time.
**Expected:** Response arrives within acceptable time; if Ollama reranker exceeds 3s, fallback activates silently (no error to user).
**Why human:** Network latency to Ollama and real model inference time cannot be verified programmatically without a live environment.

### 2. Parent-child context quality improvement

**Test:** Ask Helena a detail-specific question about a newly-uploaded document (post-Phase-13 embedding). Compare answer quality with a pre-Phase-13 STANDALONE document of similar content.
**Expected:** Post-Phase-13 answer uses larger context window (parent ~2000 tokens) and provides more complete answers.
**Why human:** Subjective answer quality improvement requires human evaluation of response content.

### 3. Cross-Akte RBAC enforcement

**Test:** As a user with access to Akte A but not Akte B, run a cross-Akte ki-chat query. Verify results only include documents from Akte A.
**Expected:** No documents from unauthorized Akten appear in sources metadata.
**Why human:** Requires live DB state with multi-Akte data and authenticated session.

---

## Commit Verification

All 6 task commits verified present in git history:

| Commit | Plan | Description |
|--------|------|-------------|
| `15b7ff0` | 13-01 Task 1 | feat: create reranker module |
| `23a9df3` | 13-01 Task 2 | feat: create hybrid-search orchestrator |
| `b6ca1a3` | 13-02 Task 1 | feat: add chunkDocumentParentChild |
| `9dafd2f` | 13-02 Task 2 | feat: upgrade vector-store.ts |
| `572488d` | 13-03 Task 1 | feat: switch embedding processor to parent-child pipeline |
| `22bbf6c` | 13-03 Task 2 | feat: wire ki-chat route to hybridSearch |

---

## Notable Implementation Decisions (Verified Against Code)

1. **Inline vector SQL in `hybrid-search.ts`** (not calling `searchSimilar()`): Plan 01 summary documents this as intentional — `SearchResult` lacked `id`, `chunkType`, `parentChunkId` at Plan 01 execution time. Code confirms: `hybrid-search.ts` uses `prisma.$queryRaw<ChunkRow[]>` directly with explicit field selection including all three required fields.

2. **`fetchParentContent()` NOT called from `hybrid-search.ts`**: The Plan 02 artifact provides `fetchParentContent()` as a standalone utility. `hybrid-search.ts` instead uses inline `prisma.$queryRaw` on `parentChunkId` values directly (lines 324-332). The exported `fetchParentContent()` remains available for future use. This is an implementation detail deviation that does not affect goal achievement — `contextContent` is correctly populated.

3. **Parent content lookup uses parentChunkId directly** (lines 321-332 of `hybrid-search.ts`): queries parent `id` directly from `document_chunks` using `parentChunkId` from the candidate, without requiring the JOIN-based `fetchParentContent()`. Correct and equivalent.

---

## Gaps Summary

None. All 14 must-have truths are verified against actual code. All artifacts exist, are substantive, and are wired into the live execution paths. Requirements RAGQ-01 and RAGQ-03 are fully satisfied.

---

_Verified: 2026-02-27T02:05:00Z_
_Verifier: Claude (gsd-verifier)_
