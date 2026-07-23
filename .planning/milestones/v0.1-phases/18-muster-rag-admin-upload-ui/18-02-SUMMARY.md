---
phase: 18-muster-rag-admin-upload-ui
plan: "02"
subsystem: api, ui, queue
tags: [bullmq, nextjs, minio, prisma, ner-pii, muster-rag, admin]

requires:
  - phase: 18-01
    provides: insertMusterChunks(), searchMusterChunks(), seedAmtlicheFormulare(), Muster schema with isKanzleiEigen/nerStatus
  - phase: 16-pii-filter
    provides: nerPiiQueue, processNerPiiJob, NER state machine for Muster

provides:
  - musterIngestionQueue exported in queues.ts and visible in Bull Board
  - processMusterIngestionJob — post-NER chunk ingestion processor (INDEXED guard, MinIO fetch)
  - processMusterIngestPending — startup sweep for INDEXED Muster with 0 chunks
  - ner-pii.processor.ts now fires musterIngestionQueue.add() after INDEXED transition
  - musterIngestionWorker registered in worker.ts (concurrency:2)
  - seedAmtlicheFormulare() called at worker startup (idempotent)
  - /admin/muster page with upload form and muster table with NER status badges
  - GET /api/admin/muster: list all Muster with chunk counts
  - POST /api/admin/muster: upload DOCX/PDF, MinIO muster-uploads/, enqueue NER
  - DELETE /api/admin/muster/[id]: remove chunks + MinIO object + DB row
  - PATCH /api/admin/muster/[id]: retry NER for REJECTED/PENDING_NER

affects:
  - 18-03 (Helena chain F — muster RAG search integration, uses searchMusterChunks)
  - worker.ts (all startup sequences)
  - Bull Board (new muster-ingestion queue visible)

tech-stack:
  added: []
  patterns:
    - "musterIngestionQueue: BullMQ queue triggered by NER state machine after INDEXED transition"
    - "Admin upload: multipart/form-data POST -> MinIO -> DB row -> nerPiiQueue (two-step: create row first, update minioKey after upload)"
    - "MIME guard: 415 for non-PDF/DOCX uploads at API level"
    - "Startup sweep: processMusterIngestPending re-enqueues INDEXED Muster with 0 chunks on worker boot"
    - "Admin client page: 'use client' fetching from REST API (consistent with other admin pages)"

key-files:
  created:
    - src/lib/queue/processors/muster-ingestion.processor.ts
    - src/app/api/admin/muster/route.ts
    - src/app/api/admin/muster/[id]/route.ts
    - src/app/(dashboard)/admin/muster/page.tsx
  modified:
    - src/lib/queue/queues.ts
    - src/lib/queue/processors/ner-pii.processor.ts
    - src/worker.ts
    - src/app/(dashboard)/admin/layout.tsx

key-decisions:
  - "Admin muster page is 'use client' (not server component) — consistent with all other admin pages (system/pipeline/etc all use client); GlassPanel/GlassCard are also 'use client' requiring this pattern"
  - "musterIngestionWorker concurrency:2 — allows two concurrent ingestion jobs; embedding inside insertMusterChunks is sequential per chunk anyway"
  - "MinIO deletion in DELETE is best-effort (try/catch non-fatal) — DB row is deleted regardless of MinIO state to prevent orphan records"
  - "processMusterIngestPending called at startup (non-fatal try/catch) — recovers INDEXED Muster with 0 chunks without blocking worker startup"
  - "nerPiiQueue.add trigger in ner-pii.processor.ts placed inside the else branch (no PII path) only — REJECTED_PII_DETECTED never triggers ingestion (PII gate invariant)"

patterns-established:
  - "Queue trigger chain: nerPiiQueue (NER) -> musterIngestionQueue (ingestion) — automatic post-NER pipeline"
  - "INDEXED guard in processor: load muster, check nerStatus, warn+return if not INDEXED (idempotent)"

requirements-completed: [ARBW-02, ARBW-03]

duration: 4min
completed: 2026-02-27
---

# Phase 18 Plan 02: Admin Upload UI + Ingestion Processor Summary

**Full muster upload pipeline: /admin/muster UI + REST API (GET/POST/DELETE/PATCH) + musterIngestionQueue + auto post-NER ingestion trigger + worker registration + seedAmtlicheFormulare on startup**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-27T10:50:07Z
- **Completed:** 2026-02-27T10:54:15Z
- **Tasks:** 2
- **Files modified/created:** 8

## Accomplishments
- Full upload pipeline: admin uploads DOCX/PDF -> MinIO muster-uploads/ -> DB row (PENDING_NER) -> nerPiiQueue -> NER gate -> musterIngestionQueue -> insertMusterChunks()
- musterIngestionQueue registered in queues.ts (ALL_QUEUES), worker.ts, and Bull Board for monitoring
- /admin/muster page with upload form, NER status badges (PENDING/RUNNING/INDEXED/REJECTED), chunk counts, delete and retry actions
- DELETE /api/admin/muster/[id] removes muster_chunks + MinIO object + Muster row atomically
- PATCH /api/admin/muster/[id] retries NER for REJECTED_PII_DETECTED and PENDING_NER Muster
- 6 amtliche Formulare seeded at worker startup via seedAmtlicheFormulare() (idempotent)

## Task Commits

1. **Task 1: musterIngestionQueue + processor + ner-pii trigger + worker** - `e3aee73` (feat)
2. **Task 2: Admin UI + API routes** - `e726582` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/queue/queues.ts` - Added musterIngestionQueue export + ALL_QUEUES entry
- `src/lib/queue/processors/muster-ingestion.processor.ts` - Created: processMusterIngestionJob (INDEXED guard) + processMusterIngestPending (startup sweep)
- `src/lib/queue/processors/ner-pii.processor.ts` - Added musterIngestionQueue import + trigger after INDEXED transition
- `src/worker.ts` - Registered musterIngestionWorker + startup calls for processMusterIngestPending + seedAmtlicheFormulare
- `src/app/(dashboard)/admin/layout.tsx` - Added Muster to admin navigation
- `src/app/(dashboard)/admin/muster/page.tsx` - Created: upload form + muster table with NER badges (342 lines)
- `src/app/api/admin/muster/route.ts` - Created: GET (list) + POST (upload, MIME guard, MinIO, nerPiiQueue)
- `src/app/api/admin/muster/[id]/route.ts` - Created: DELETE (chunks+MinIO+row) + PATCH (retry NER)

## Decisions Made
- Admin muster page implemented as "use client" (consistent with all other admin pages; GlassPanel/GlassCard are client components requiring this pattern)
- MinIO deletion in DELETE is best-effort (non-fatal) to prevent orphan DB rows when MinIO object already gone
- nerPiiQueue trigger in ner-pii processor placed only in the INDEXED (no PII) branch — REJECTED_PII_DETECTED never triggers ingestion (PII gate invariant preserved)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Design Adaptation] Page implemented as "use client" instead of server component**
- **Found during:** Task 2 (Admin UI page)
- **Issue:** Plan specified server component with direct DB query, but GlassPanel/GlassCard are "use client" components. All other admin pages (system, pipeline, etc.) are "use client" client components that fetch from API. Making this page a server component would be an inconsistency and would require refactoring action buttons (DELETE/PATCH require JS fetch calls that HTML forms cannot do natively).
- **Fix:** Implemented as "use client" client component that fetches from /api/admin/muster — clean, consistent, functional
- **Files modified:** src/app/(dashboard)/admin/muster/page.tsx
- **Verification:** TypeScript clean, all required functionality present (upload, list, delete, retry)
- **Committed in:** e726582 (Task 2 commit)

---

**Total deviations:** 1 (design adaptation — no bugs introduced)
**Impact on plan:** Functionally equivalent to spec. All must_haves and success_criteria met. Pattern is consistent with existing codebase.

## Issues Encountered
None beyond the client component adaptation above.

## Next Phase Readiness
- Phase 18 Plan 03: Wire searchMusterChunks into Helena's ki-chat Chain F (ready — ingestion pipeline complete)
- Bull Board shows muster-ingestion queue for monitoring
- Admin can upload Muster immediately — NER gate runs automatically

---
*Phase: 18-muster-rag-admin-upload-ui*
*Completed: 2026-02-27*
