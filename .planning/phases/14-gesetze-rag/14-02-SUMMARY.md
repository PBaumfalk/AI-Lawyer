---
phase: 14-gesetze-rag
plan: "02"
subsystem: infra
tags: [bullmq, cron, redis, gesetze, github-api, worker, sha-cache]

# Dependency graph
requires:
  - phase: 14-01-gesetze-rag
    provides: github-client.ts, markdown-parser.ts, ingestion.ts (upsertLawChunks, loadShaCache, saveShaCache, encodingSmokePassed)
provides:
  - BullMQ gesetze-sync queue with daily cron at 02:00 Europe/Berlin
  - processGesetzeSyncJob() — full sync loop with SHA-based change detection
  - gesetzeSyncQueue in ALL_QUEUES for Bull Board auto-discovery
  - registerGesetzeSyncJob() called in worker.ts startup()
  - Worker registered with concurrency:1 and ADMIN socket notification on failure
affects:
  - 14-03-gesetze-rag (ki-chat Chain D integration)
  - worker.ts operational behavior (new daily cron job)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - BullMQ Worker + upsertJobScheduler cron pattern (attempts:2 for cron, concurrency:1 for sequential)
    - Non-fatal error handling with try/catch in startup() for each cron registration
    - ADMIN socket notification on final job failure (attemptsMade >= attempts)

key-files:
  created:
    - src/lib/queue/processors/gesetze-sync.processor.ts
  modified:
    - src/lib/queue/queues.ts
    - src/worker.ts

key-decisions:
  - "gesetzeSyncWorker uses concurrency:1 — sequential sync avoids GitHub rate limit pressure and Ollama contention"
  - "registerGesetzeSyncJob() wrapped in non-fatal try/catch in startup() — cron registration failure must not prevent worker from starting"
  - "SHA cache saved once at end of sync loop (batch) not per-Gesetz — avoids N Settings writes; files without updated SHA retry on next run"

patterns-established:
  - "Cron processor pattern: separate processor file + queue definition + registerXxxJob() in queues.ts + Worker + startup() call in worker.ts"

requirements-completed: [GESETZ-02]

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 14 Plan 02: Gesetze-Sync Cron Processor Summary

**BullMQ gesetze-sync Worker wired end-to-end: daily 02:00 cron fetches GitHub tree, skips unchanged SHAs, encoding-tests and ingests changed Gesetze into law_chunks**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-27T06:30:01Z
- **Completed:** 2026-02-27T06:31:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `processGesetzeSyncJob()` with full sync loop: SHA cache load, GitHub tree fetch, per-file encoding smoke test + parse + upsert, SHA cache persist
- Added `gesetzeSyncQueue` and `registerGesetzeSyncJob()` to `queues.ts`; queue included in `ALL_QUEUES` for Bull Board
- Registered `gesetzeSyncWorker` (concurrency:1) in `worker.ts` with completed/failed/error handlers; ADMIN notification on final failure
- `startup()` calls `registerGesetzeSyncJob()` for idempotent 02:00 Europe/Berlin cron registration

## Task Commits

Each task was committed atomically:

1. **Task 1: gesetze-sync processor + queue registration** - `f9a7f79` (feat)
2. **Task 2: wire gesetze-sync Worker into worker.ts** - `f09f113` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/queue/processors/gesetze-sync.processor.ts` - processGesetzeSyncJob() with full sync loop including SHA-based incremental detection, encoding smoke test, parse + upsert, batch SHA cache save
- `src/lib/queue/queues.ts` - gesetzeSyncQueue (attempts:2, 24h/7d retention) + registerGesetzeSyncJob() (02:00 Europe/Berlin cron) + gesetzeSyncQueue in ALL_QUEUES
- `src/worker.ts` - gesetzeSyncWorker (concurrency:1, backoff), event handlers, ADMIN notification on failure, registerGesetzeSyncJob() in startup(), "gesetze-sync" in startup log

## Decisions Made
- `concurrency:1` for gesetzeSyncWorker — GitHub raw content fetches are sequential per-Gesetz anyway; parallelism would increase rate limit risk and Ollama contention without meaningful latency benefit for a nightly cron
- `registerGesetzeSyncJob()` in non-fatal try/catch in `startup()` — consistent with the existing pattern for AI job registration; cron scheduling failure must not block worker startup
- SHA cache saved once at end of full sync run — N writes per Gesetz would cause excessive Settings table churn; at-end save means failed-mid-sync Gesetze retry on next cron run (acceptable since upsertLawChunks is idempotent)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript check passed with zero errors after both tasks.

## User Setup Required

None - no external service configuration required. First sync will run at 02:00 Europe/Berlin automatically. For immediate manual trigger: use Bull Board admin UI to enqueue a job on the gesetze-sync queue.

## Next Phase Readiness
- gesetze-sync cron is fully wired; daily incremental sync will populate `law_chunks` starting from first scheduled run
- Plan 03 (ki-chat Chain D integration) can reference `searchLawChunks()` from `src/lib/gesetze/ingestion.ts` immediately
- No blockers for Phase 14 Plan 03

---
*Phase: 14-gesetze-rag*
*Completed: 2026-02-27*
