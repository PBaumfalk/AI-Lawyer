---
phase: 17-urteile-rag
plan: "02"
subsystem: infra
tags: [bullmq, cron, rss, urteile, queue, worker]

# Dependency graph
dependency_graph:
  requires:
    - phase: 17-urteile-rag
      plan: "01"
      provides: "fetchUrteileFeed, BMJ_RSS_FEEDS (rss-client.ts), ingestUrteilItem, loadGuidCache, saveGuidCache (ingestion.ts)"
  provides:
    - src/lib/queue/processors/urteile-sync.processor.ts (processUrteileSyncJob)
    - src/lib/queue/queues.ts (urteileSyncQueue, registerUrteileSyncJob)
    - src/worker.ts (urteile-sync Worker + startup cron registration)
  affects:
    - Phase 17 Plan 03 (ki-chat Chain E — no direct dependency on Plan 02, but pipeline is now operational)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - BullMQ Worker with concurrency:1 for sequential Ollama/NER-safe sync
    - upsertJobScheduler for idempotent daily cron registration (safe on every worker boot)
    - Per-court error isolation: fetch failure increments failed count and continues, never aborts full sync
    - Batch GUID cache save after all courts processed (mirrors gesetze SHA cache pattern)

key-files:
  created:
    - src/lib/queue/processors/urteile-sync.processor.ts
  modified:
    - src/lib/queue/queues.ts
    - src/worker.ts

key-decisions:
  - "urteileSyncQueue cron at 03:00 Europe/Berlin — one hour after gesetzeSyncJob at 02:00 to avoid simultaneous Ollama embedding calls"
  - "concurrency:1 for urteile-sync Worker — sequential RSS sync avoids GPU contention during NER gate + embedding generation"
  - "pii_rejected GUIDs ARE added to guidCache — prevents expensive Ollama NER re-run on same item; item is permanently rejected"
  - "error GUIDs NOT added to guidCache — transient errors (Ollama timeout, DB failure) retry on next cron automatically"

patterns-established:
  - "urteile-sync mirrors gesetze-sync pattern exactly: Queue + registerJob() in queues.ts, Worker in worker.ts, startup cron call in startup()"

requirements-completed: [URTEIL-01, URTEIL-02]

# Metrics
duration: ~2min
completed: "2026-02-27"
---

# Phase 17 Plan 02: Urteile-RAG BullMQ Wiring Summary

**BullMQ processor, Queue, and daily 03:00 cron for all 7 BMJ court RSS feeds — urteile_chunks pipeline is now operational via worker.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-27T09:43:57Z
- **Completed:** 2026-02-27T09:45:35Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `urteile-sync.processor.ts`: processUrteileSyncJob() orchestrates all 7 courts with per-court fetch error isolation — network failure increments failed count and continues, never aborts the full sync run
- `queues.ts`: urteileSyncQueue + registerUrteileSyncJob() wired with daily 03:00 Europe/Berlin cron; urteileSyncQueue added to ALL_QUEUES for Bull Board discovery
- `worker.ts`: urteile-sync Worker registered with concurrency:1, completed/failed/error handlers, startup cron call added after registerGesetzeSyncJob(), "urteile-sync" added to startup log queues list
- GUID cache semantics correctly implemented: pii_rejected items cached (no NER retry), error items NOT cached (retry enabled on next cron)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create urteile-sync.processor.ts — BullMQ processor for all 7 courts** - `938096b` (feat)
2. **Task 2: Wire urteileSyncQueue + Worker in queues.ts and worker.ts** - `cd225b0` (feat)

## Files Created/Modified

- `src/lib/queue/processors/urteile-sync.processor.ts` — processUrteileSyncJob() with per-court error isolation, GUID cache write rules, batch saveGuidCache
- `src/lib/queue/queues.ts` — urteileSyncQueue (attempts:2, 7-day retention), registerUrteileSyncJob() (03:00 daily), urteileSyncQueue in ALL_QUEUES
- `src/worker.ts` — import processUrteileSyncJob + registerUrteileSyncJob, Worker registration with concurrency:1, startup cron call, queues log list updated

## Decisions Made

- Cron at 03:00 Europe/Berlin (one hour after Gesetze sync at 02:00) to avoid simultaneous Ollama embedding calls between the two ingestion pipelines
- concurrency:1 for urteile-sync Worker — sequential sync prevents GPU contention during inline NER gate and embedding generation inside ingestUrteilItem
- pii_rejected GUID behavior: add to cache to permanently skip — prevents expensive Ollama NER re-run on the same PII-containing item on every cron
- error GUID behavior: do NOT add to cache — transient errors (Ollama timeout, DB failure) should retry on next daily cron

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Plan 02 complete — urteile_chunks pipeline is fully operational: RSS fetched daily → PII-gated ingestion → pgvector INSERT
- Plan 03 (ki-chat Chain E) can proceed — it imports searchUrteilChunks from ingestion.ts (Plan 01 output), not from this plan
- TypeScript compiles clean across all modified files

## Self-Check: PASSED

Files created/modified:
- [x] `src/lib/queue/processors/urteile-sync.processor.ts` — exists, exports processUrteileSyncJob
- [x] `src/lib/queue/queues.ts` — exports urteileSyncQueue and registerUrteileSyncJob
- [x] `src/worker.ts` — urteile-sync Worker registered, startup cron added, queues log updated

Commits:
- [x] `938096b` — feat(17-02): create urteile-sync.processor.ts
- [x] `cd225b0` — feat(17-02): wire urteileSyncQueue + urteile-sync Worker in queues.ts and worker.ts

TypeScript: clean (`npx tsc --noEmit` exits 0, zero errors)

---
*Phase: 17-urteile-rag*
*Completed: 2026-02-27*
