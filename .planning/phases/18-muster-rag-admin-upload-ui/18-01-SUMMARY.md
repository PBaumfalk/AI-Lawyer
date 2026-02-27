---
phase: 18-muster-rag-admin-upload-ui
plan: "01"
subsystem: database
tags: [prisma, pgvector, embedding, muster, rag, pdf-parse, langchain]

# Dependency graph
requires:
  - phase: 17-urteile-rag
    provides: searchUrteilChunks pattern, pgvector cosine search, ingestUrteilItem pipeline
  - phase: 16-pii-filter
    provides: NER gate (nerStatus=INDEXED gates searchMusterChunks)
  - phase: 13-hybrid-search-reranking
    provides: chunkDocumentParentChild, generateEmbedding, MODEL_VERSION
provides:
  - Prisma schema: isKanzleiEigen on Muster, kanzleiEigen on MusterChunk
  - migration 20260227114302_add_muster_kanzlei_eigen
  - src/lib/muster/ingestion.ts: extractMusterFullText, insertMusterChunks (optional content param), searchMusterChunks with 1.3x kanzlei boost
  - src/lib/muster/seed-amtliche.ts: AMTLICHE_MUSTER (6 Arbeitsrecht forms), seedAmtlicheFormulare (idempotent)
affects:
  - 18-02: Admin Upload UI + processMusterIngestionJob (calls insertMusterChunks without content for real uploads)
  - 18-03: Chain F (calls searchMusterChunks with queryEmbeddingPromise from Chain B)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Optional content param on insertMusterChunks bypasses MinIO for seeded content
    - 1.3x KANZLEI_BOOST post-query score multiplier for kanzleiEigen=true results
    - Idempotent seed via SystemSetting version key (same as SHA cache pattern in Phase 14)
    - streamToBuffer + pdf-parse v2 (PDFParse class) pattern mirrored from ocr.processor.ts

key-files:
  created:
    - prisma/migrations/20260227114302_add_muster_kanzlei_eigen/migration.sql
    - src/lib/muster/ingestion.ts
    - src/lib/muster/seed-amtliche.ts
  modified:
    - prisma/schema.prisma

key-decisions:
  - "insertMusterChunks optional content param: when provided, extractMusterFullText and MinIO are skipped entirely — seed path uses this for hardcoded templates"
  - "KANZLEI_BOOST=1.3 applied post-query in application code (not SQL) for simplicity and testability"
  - "searchMusterChunks fetches limit*3 candidates (FETCH_FACTOR=3) before boost+filter to ensure enough results after score filtering"
  - "seedAmtlicheFormulare uses nerStatus=INDEXED on synthetic Muster rows — no NER processing needed for hardcoded content"
  - "Migration created manually (prisma migrate dev requires TTY) and applied via prisma migrate deploy"

patterns-established:
  - "Optional content bypass pattern: insertMusterChunks(musterId, content?) — seed passes content, processor omits for MinIO path"
  - "kanzleiEigen propagation: always read from parent Muster.isKanzleiEigen at insert time, written into each MusterChunk row"

requirements-completed: [ARBW-01, ARBW-04]

# Metrics
duration: 5min
completed: 2026-02-27
---

# Phase 18 Plan 01: Muster-RAG Schema + Ingestion Library Summary

**Prisma migration adding isKanzleiEigen/kanzleiEigen fields, muster ingestion library (extractMusterFullText, insertMusterChunks with MinIO-bypass content param, searchMusterChunks with 1.3x kanzlei boost), and 6 amtliche Arbeitsrecht Formulare seeded idempotently via SystemSetting**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-27T10:41:43Z
- **Completed:** 2026-02-27T10:47:01Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Schema migrated with `isKanzleiEigen` on Muster and `kanzleiEigen` on MusterChunk; Prisma client regenerated clean
- `src/lib/muster/ingestion.ts` exports `extractMusterFullText` (MinIO+pdf-parse), `insertMusterChunks` (optional content bypasses MinIO), `searchMusterChunks` (1.3x kanzlei boost, limit*3 fetch), and `MusterChunkResult` interface
- `src/lib/muster/seed-amtliche.ts` exports `AMTLICHE_MUSTER` (6 Arbeitsrecht forms with 105+ {{PLATZHALTER}} occurrences) and `seedAmtlicheFormulare` (idempotent via SystemSetting `muster.amtliche_seed_version`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration — add isKanzleiEigen and kanzleiEigen** - `ed29386` (feat)
2. **Task 2: Create ingestion.ts and seed-amtliche.ts** - `c77f04c` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `prisma/schema.prisma` - Added `isKanzleiEigen Boolean @default(false)` on Muster, `kanzleiEigen Boolean @default(false)` on MusterChunk
- `prisma/migrations/20260227114302_add_muster_kanzlei_eigen/migration.sql` - ALTER TABLE for both columns
- `src/lib/muster/ingestion.ts` - Full muster ingestion pipeline: text extraction (PDF/DOCX/plain), parent-child chunking, pgvector insert with kanzleiEigen propagation, cosine search with 1.3x boost
- `src/lib/muster/seed-amtliche.ts` - 6 amtliche Arbeitsrecht Formulare (Klageschrift KSchG, Abmahnung, Aufhebungsvertrag, einstweilige Verfugung Weiterbeschäftigung, Zeugnisklage, Widerspruch gegen Abmahnung) + idempotent seedAmtlicheFormulare()

## Decisions Made

- **Optional content param for insertMusterChunks:** When `content` is provided and non-empty, `extractMusterFullText` and `getFileStream` are never called. This allows `seedAmtlicheFormulare()` to insert hardcoded template text without requiring MinIO to be operational. The real upload path (Plan 02's `processMusterIngestionJob`) omits the param to trigger MinIO fetching.
- **KANZLEI_BOOST applied in application code:** Post-query boost in the `.map()` step rather than in SQL. This keeps the raw pgvector ORDER BY correct for candidate fetching and applies the multiplier cleanly in TypeScript for testability.
- **Migration created manually:** `prisma migrate dev` requires a TTY (interactive terminal) and fails in non-interactive environments. Migration SQL was written manually and applied with `prisma migrate deploy` — consistent with the project's existing `manual_pgvector_index.sql` convention.
- **nerStatus=INDEXED on seeded rows:** Amtliche Formulare use hardcoded, legally neutral content — no PII can be present, so they are immediately marked INDEXED without NER processing.

## Deviations from Plan

None - plan executed exactly as written.

(Note: `prisma migrate dev` non-interactive TTY limitation was handled by creating the migration SQL manually and using `prisma migrate deploy` — this is equivalent to the plan's intent and produces the identical migration file.)

## Issues Encountered

- `prisma migrate dev` failed with "non-interactive environment" error. Resolution: created migration SQL file manually in `prisma/migrations/20260227114302_add_muster_kanzlei_eigen/migration.sql` and applied with `prisma migrate deploy`. The migration file is tracked in git as required by the plan spec.
- Database container not running at start. Resolution: started with `docker compose up -d db` — no data loss, container resumed from existing volume.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (Admin Upload UI) can import `insertMusterChunks` from `@/lib/muster/ingestion` for the `processMusterIngestionJob` processor — use without `content` param for real uploaded files
- Plan 02 should call `seedAmtlicheFormulare()` from `@/lib/muster/seed-amtliche` during worker startup
- Plan 03 (Chain F) can import `searchMusterChunks` and `MusterChunkResult` from `@/lib/muster/ingestion` for the ki-chat RAG chain

---
*Phase: 18-muster-rag-admin-upload-ui*
*Completed: 2026-02-27*

## Self-Check: PASSED

- FOUND: src/lib/muster/ingestion.ts
- FOUND: src/lib/muster/seed-amtliche.ts
- FOUND: prisma/migrations/20260227114302_add_muster_kanzlei_eigen/migration.sql
- FOUND: .planning/phases/18-muster-rag-admin-upload-ui/18-01-SUMMARY.md
- FOUND commit: ed29386 (Task 1 — schema migration)
- FOUND commit: c77f04c (Task 2 — ingestion library + seed)
