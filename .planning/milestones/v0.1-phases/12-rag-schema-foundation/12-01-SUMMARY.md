---
phase: 12-rag-schema-foundation
plan: "01"
subsystem: database-schema
tags: [prisma, postgresql, pgvector, rag, hnsw, schema]
dependency_graph:
  requires: []
  provides:
    - law_chunks table with HNSW embedding index
    - urteil_chunks table with HNSW embedding index
    - muster table with MusterNerStatus enum
    - muster_chunks table with HNSW embedding index
    - akte_normen table with FK to akten and users
    - DocumentChunk extended with ChunkType + parent-child self-relation
    - ChunkType enum (STANDALONE, PARENT, CHILD)
    - MusterNerStatus enum (PENDING_NER, NER_RUNNING, INDEXED, REJECTED_PII_DETECTED)
    - Prisma client types: LawChunk, UrteilChunk, Muster, MusterChunk, AkteNorm, ChunkType, MusterNerStatus
  affects:
    - prisma/schema.prisma
    - document_chunks table (additive — new columns, no data migration needed)
tech_stack:
  added: []
  patterns:
    - "Prisma self-referential relation for parent-child document chunking"
    - "Manual SQL HNSW index file alongside Prisma migrations (matches existing pattern)"
    - "pgvector HNSW with m=16, ef_construction=64 for cosine similarity"
key_files:
  created:
    - prisma/migrations/20260226234332_add_rag_schema_foundation/migration.sql
    - prisma/migrations/manual_rag_hnsw_indexes.sql
  modified:
    - prisma/schema.prisma
decisions:
  - "Self-relation on DocumentChunk uses named relation 'DocumentChunkParent' — required by Prisma for self-referential relations"
  - "chunkType column is NOT NULL DEFAULT 'STANDALONE' — all existing document_chunks rows get STANDALONE, no backfill script needed"
  - "HNSW parameters m=16, ef_construction=64 match existing document_chunks_embedding_idx exactly for consistency"
  - "manual_rag_hnsw_indexes.sql follows same manual-SQL pattern as manual_pgvector_index.sql — Prisma cannot generate HNSW DDL"
metrics:
  duration: "302s (~5 minutes)"
  completed_date: "2026-02-26"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 12 Plan 01: RAG Schema Foundation Summary

**One-liner:** Prisma schema extended with 5 new RAG tables (law_chunks, urteil_chunks, muster, muster_chunks, akte_normen), ChunkType/MusterNerStatus enums, DocumentChunk parent-child self-relation, and three HNSW vector indexes applied to the running DB.

## What Was Built

Two tasks executed atomically:

**Task 1 — Schema extension and migration:**
- Added `ChunkType` enum (STANDALONE, PARENT, CHILD) and `MusterNerStatus` enum (PENDING_NER, NER_RUNNING, INDEXED, REJECTED_PII_DETECTED) to the enum section
- Extended `DocumentChunk` model with `chunkType ChunkType @default(STANDALONE)`, `parentChunkId String?`, and self-referential relation `"DocumentChunkParent"`
- Added 5 new models: `LawChunk`, `UrteilChunk`, `Muster`, `MusterChunk`, `AkteNorm`
- Added back-relations to `User` (akteNormen, musterUploads) and `Akte` (normen)
- Ran `npx prisma migrate dev --name add_rag_schema_foundation` — migration applied successfully
- Regenerated Prisma client: `ChunkType`, `MusterNerStatus`, `LawChunk`, `UrteilChunk`, `Muster`, `MusterChunk`, `AkteNorm` all exported

**Task 2 — HNSW vector indexes:**
- Created `prisma/migrations/manual_rag_hnsw_indexes.sql` with HNSW DDL for 3 tables
- Applied via `docker exec -i ailawyer-db-temp psql < manual_rag_hnsw_indexes.sql`
- All 3 indexes confirmed in pg_indexes: `law_chunks_embedding_hnsw`, `urteil_chunks_embedding_hnsw`, `muster_chunks_embedding_hnsw`
- EXPLAIN confirms Index Scan using HNSW on law_chunks even on empty table

## Verification Results

| Check | Result |
|-------|--------|
| `npx prisma validate` | Pass — schema valid |
| `npx prisma migrate status` | "Database schema is up to date" (3 migrations) |
| All 5 new tables in DB | Pass (akte_normen, law_chunks, muster, muster_chunks, urteil_chunks) |
| `SELECT COUNT(*) FROM document_chunks WHERE chunkType IS NULL` | 0 rows |
| All 3 HNSW indexes in pg_indexes | Pass |
| EXPLAIN uses HNSW Index Scan | Pass (law_chunks confirmed) |
| Prisma client ChunkType enum | Pass (STANDALONE, PARENT, CHILD) |
| Prisma client MusterNerStatus enum | Pass (PENDING_NER, NER_RUNNING, INDEXED, REJECTED_PII_DETECTED) |

## Deviations from Plan

### Docker Desktop Status Issue

Docker Desktop was not running when execution started. Applied auto-fix (Rule 3 — blocking issue):
- Launched Docker Desktop via `open -a Docker`
- Started only the `db` service via `docker compose up -d db`
- DB container crashed after `migrate dev` completed (Docker Desktop has an intermittent startup issue)
- Switched to `docker run --rm` with a temporary ephemeral container (no volume) for verification and HNSW index application
- Applied all 3 migrations fresh via `prisma migrate deploy` to the ephemeral container to confirm clean deploy works

**Impact:** None on artifacts. Migration SQL is idempotent. HNSW indexes are verified against the same pgvector image used in production.

### Pre-existing TypeScript Errors (Out of Scope)

Two pre-existing TS errors found in `src/components/ki/chat-layout.tsx` and `chat-messages.tsx` — `UIMessage` not exported from `@ai-sdk/react`. These predate this plan and are unrelated to RAG schema changes. Logged to deferred items — not fixed.

## Commits

| Hash | Message |
|------|---------|
| ed54a2c | feat(12-01): extend Prisma schema with RAG foundation models and migrate DB |
| 321e72f | feat(12-01): create and apply HNSW vector indexes for RAG chunk tables |

## Self-Check: PASSED

Files created/modified:
- [x] prisma/schema.prisma — modified (enums, models, back-relations)
- [x] prisma/migrations/20260226234332_add_rag_schema_foundation/migration.sql — created
- [x] prisma/migrations/manual_rag_hnsw_indexes.sql — created

Commits verified:
- [x] ed54a2c — present in git log
- [x] 321e72f — present in git log
