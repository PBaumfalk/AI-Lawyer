---
phase: 30-scan-05-neu-urteil-check
plan: "01"
subsystem: database, queue, scanner
tags: [pgvector, embedding, bullmq, cron, prisma, ollama]

# Dependency graph
requires:
  - phase: 21-phase21-embedding-pipeline
    provides: "generateEmbedding(), pgvector, HNSW index pattern"
  - phase: 24-phase24-scanner-infra
    provides: "ScannerConfig, scanner processor, SystemSettings pattern"
provides:
  - "summaryEmbedding vector(1024) column on Akte model"
  - "assembleAkteSummaryText() for case context assembly"
  - "refreshAkteEmbeddings() nightly batch refresh"
  - "BullMQ akte-embedding cron at 02:30 Europe/Berlin"
  - "scanner.neues_urteil_enabled and scanner.neues_urteil_threshold SystemSettings"
affects: [30-02, scan-05-matching]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Akte-level embedding via raw SQL pgvector update", "Manual SQL migration for vector columns"]

key-files:
  created:
    - src/lib/scanner/akte-embedding.ts
    - src/lib/queue/processors/akte-embedding.processor.ts
    - prisma/migrations/manual_akte_summary_embedding.sql
  modified:
    - prisma/schema.prisma
    - src/lib/settings/defaults.ts
    - src/lib/scanner/types.ts
    - src/lib/queue/queues.ts
    - src/worker.ts
    - src/workers/processors/scanner.ts

key-decisions:
  - "AkteNorm fields (gesetzKuerzel, paragraphNr) read directly -- no separate Norm model relation needed"
  - "Cron at 02:30 slots between gesetze-sync (02:00) and urteile-sync (03:00)"
  - "attempts:1 for embedding queue -- embedding failures are non-retryable (Ollama state)"

patterns-established:
  - "Akte-level vector embedding via raw SQL UPDATE with pgvector.toSql()"
  - "Manual SQL migration for Unsupported vector columns (not prisma migrate dev)"

requirements-completed: [SCAN-01, SCAN-04]

# Metrics
duration: 4min
completed: 2026-02-28
---

# Phase 30 Plan 01: Akte Summary Embedding Infrastructure Summary

**Akte summary embedding with pgvector vector(1024), nightly BullMQ cron at 02:30, and admin-configurable Neu-Urteil threshold settings**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-28T22:30:56Z
- **Completed:** 2026-02-28T22:35:04Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Akte model extended with summaryEmbedding vector(1024) and summaryEmbeddingAt timestamp
- assembleAkteSummaryText concatenates Sachgebiet, Kurzrubrum, Wegen, HelenaMemory, Falldaten, and Normen
- Nightly BullMQ cron refreshes all OFFEN Akten embeddings with per-Akte error isolation
- Two new SystemSettings for admin-configurable Neu-Urteil matching toggle and threshold

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema migration + SystemSettings + ScannerConfig update** - `65af5f8` (feat)
2. **Task 2: Akte summary text assembler + embedding refresh cron job** - `039f564` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added summaryEmbedding and summaryEmbeddingAt to Akte model
- `prisma/migrations/manual_akte_summary_embedding.sql` - Idempotent DDL for vector column + HNSW index
- `src/lib/settings/defaults.ts` - scanner.neues_urteil_enabled and scanner.neues_urteil_threshold settings
- `src/lib/scanner/types.ts` - Extended ScannerConfig with neuesUrteilEnabled and neuesUrteilThreshold
- `src/workers/processors/scanner.ts` - Wired new ScannerConfig fields from SystemSettings
- `src/lib/scanner/akte-embedding.ts` - assembleAkteSummaryText + refreshAkteEmbeddings
- `src/lib/queue/processors/akte-embedding.processor.ts` - BullMQ processor delegating to refreshAkteEmbeddings
- `src/lib/queue/queues.ts` - akteEmbeddingQueue + registerAkteEmbeddingJob at 02:30 daily
- `src/worker.ts` - Worker registration, startup cron registration, HNSW index creation on boot

## Decisions Made
- AkteNorm has gesetzKuerzel/paragraphNr directly on the model (no separate Norm relation) -- adapted plan accordingly
- Cron at 02:30 fits between gesetze-sync (02:00) and urteile-sync (03:00) in the nightly pipeline
- Used `as unknown as AkteWithContext` cast for Prisma extended client compatibility with manual type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed AkteNorm relation: no Norm model exists**
- **Found during:** Task 2 (akte-embedding.ts)
- **Issue:** Plan referenced `an.norm.gesetzKuerzel` but AkteNorm has those fields directly (no separate Norm relation)
- **Fix:** Changed to `an.gesetzKuerzel` and `an.paragraphNr`, removed `{ include: { norm: true } }` from query
- **Files modified:** src/lib/scanner/akte-embedding.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 039f564 (Task 2 commit)

**2. [Rule 3 - Blocking] Wired new ScannerConfig fields in scanner processor**
- **Found during:** Task 1 (types.ts update)
- **Issue:** Adding fields to ScannerConfig type without updating the scanner processor would cause TS error
- **Fix:** Added neuesUrteilEnabled and neuesUrteilThreshold loading from SystemSettings in scanner.ts
- **Files modified:** src/workers/processors/scanner.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 65af5f8 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for type correctness and accurate schema mapping. No scope creep.

## Issues Encountered
- Prisma extended client (ExtendedPrismaClient) types don't support `Prisma.AkteGetPayload<>` generics cleanly -- resolved with manual type composition using `Akte & { helenaMemory: ..., normen: ... }` and cast at query site

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Akte summary embeddings are ready for Plan 02 to consume for cross-matching against new Urteile
- HNSW index ensures efficient cosine similarity search at scale
- Admin can toggle and tune the matching threshold via SystemSettings UI

---
*Phase: 30-scan-05-neu-urteil-check*
*Completed: 2026-02-28*
