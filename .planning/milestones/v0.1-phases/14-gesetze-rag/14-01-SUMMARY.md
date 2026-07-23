---
phase: 14-gesetze-rag
plan: "01"
subsystem: api
tags: [github-api, markdown-parser, pgvector, prisma, gesetze-rag, law-chunks]

# Dependency graph
requires:
  - phase: 12-rag-schema-foundation
    provides: LawChunk Prisma model (law_chunks table with pgvector embedding column)
  - phase: 13-hybrid-search-reranking
    provides: generateEmbedding() from embedder.ts, pgvector.toSql() pattern from vector-store.ts
provides:
  - fetchAllGesetzeFiles(): GitHub git trees recursive API — returns all {slug}/index.md paths+SHAs
  - fetchRawFileContent(): raw.githubusercontent.com access for Markdown file content
  - parseGesetzeMarkdown(): state machine parser for bundestag/gesetze ##### § heading format
  - encodingSmokePassed(): UTF-8/latin-1 mojibake guard using Â§ detection
  - upsertLawChunks(): DELETE+INSERT into law_chunks with pgvector embedding, idempotent
  - searchLawChunks(): cosine similarity search over law_chunks, returns LawChunkResult[]
  - buildSourceUrl(): canonical gesetze-im-internet.de URL builder
  - loadShaCache()/saveShaCache(): SHA change-detection cache in SystemSetting as JSON
affects: [14-gesetze-rag/14-02, 14-gesetze-rag/14-03, ki-chat route]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pgvector.toSql() serialization for law_chunks (same as document_chunks pattern from Phase 13)"
    - "SHA cache in SystemSetting using getSetting/updateSetting + JSON.parse/stringify (no custom JSON type)"
    - "bundestag/gesetze git trees recursive API — single HTTP call for all ~2000 Gesetz files"
    - "State machine parser for ##### § headings with skip-on-# guard for structural subheadings"

key-files:
  created:
    - src/lib/gesetze/github-client.ts
    - src/lib/gesetze/markdown-parser.ts
    - src/lib/gesetze/ingestion.ts
  modified: []

key-decisions:
  - "SHA cache stored in SystemSetting as JSON string via getSetting/updateSetting — no setSettingTyped (doesn't exist); use manual JSON.parse/stringify"
  - "parentContent = content for Gesetze (§ is atomic unit); cap at 8000 chars for rare long paragraphs"
  - "upsertLawChunks uses DELETE + INSERT per row (not UPSERT) to cleanly replace embeddings on model version change"
  - "searchLawChunks accepts pre-computed queryEmbedding (caller provides) — ki-chat Chain D reuses Chain B embedding"

patterns-established:
  - "law_chunks upsert: DELETE WHERE (gesetzKuerzel, paragraphNr) then INSERT — idempotent, handles model upgrades"
  - "GitHub API: get master branch SHA first, then git/trees?recursive=1 — single call for full repo tree"

requirements-completed: [GESETZ-01, GESETZ-02]

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 14 Plan 01: Gesetze-RAG Library Foundation Summary

**Three-file library layer for Gesetze-RAG: GitHub API client (git trees recursive), bundestag/gesetze Markdown state-machine parser, and law_chunks DB ingestion/cosine-search with pgvector**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-27T06:26:02Z
- **Completed:** 2026-02-27T06:28:00Z
- **Tasks:** 2
- **Files modified:** 3 (all created)

## Accomplishments
- GitHub API client using native fetch — single `git/trees?recursive=1` call to enumerate all ~2000 Gesetz files, with optional GITHUB_TOKEN auth
- State machine Markdown parser for bundestag/gesetze ##### § heading format — correctly splits paragraphs, skips structural # headings, extracts jurabk/stand from frontmatter
- law_chunks ingestion with pgvector embedding (DELETE+INSERT idempotent pattern), cosine similarity search for ki-chat Chain D, SHA cache helpers in SystemSetting

## Task Commits

Each task was committed atomically:

1. **Task 1: GitHub API client + Markdown parser** - `1e0a897` (feat)
2. **Task 2: law_chunks ingestion + search library** - `89850bf` (feat)

**Plan metadata:** see final commit below

## Files Created/Modified
- `src/lib/gesetze/github-client.ts` - fetchAllGesetzeFiles() + fetchRawFileContent() using GitHub REST API
- `src/lib/gesetze/markdown-parser.ts` - LawParagraph type, parseGesetzeMarkdown(), encodingSmokePassed()
- `src/lib/gesetze/ingestion.ts` - upsertLawChunks(), searchLawChunks(), buildSourceUrl(), loadShaCache(), saveShaCache()

## Decisions Made
- SHA cache uses getSetting/updateSetting + manual JSON.parse/stringify — `setSettingTyped` does not exist in the codebase
- parentContent equals content for Gesetze (§ is the atomic unit, no sub-chunking needed); capped at 8000 chars for rare edge cases
- upsertLawChunks uses DELETE+INSERT rather than SQL UPSERT — cleaner embedding replacement when model version changes, consistent with document_chunks pattern
- searchLawChunks receives a pre-computed queryEmbedding from the caller — ki-chat Chain D will reuse the embedding already generated in Chain B, avoiding a second Ollama call

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. GITHUB_TOKEN is optional (60 req/hr without, 5000/hr with); warning logged automatically when not set.

## Next Phase Readiness
- Plan 02 (gesetze-sync cron processor) can import parseGesetzeMarkdown, encodingSmokePassed, upsertLawChunks, loadShaCache, saveShaCache, fetchAllGesetzeFiles, fetchRawFileContent
- Plan 03 (ki-chat Chain D) can import searchLawChunks, LawChunkResult
- All exports confirmed present, zero TypeScript errors

---
*Phase: 14-gesetze-rag*
*Completed: 2026-02-27*
