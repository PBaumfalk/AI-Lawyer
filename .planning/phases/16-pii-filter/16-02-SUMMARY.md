---
phase: 16-pii-filter
plan: "02"
subsystem: pii-filter
tags: [ner, pii, bullmq, queue, worker, muster, dsgvo, arbw-03]
dependency_graph:
  requires:
    - src/lib/pii/ner-filter.ts (runNerFilter — Plan 01)
    - src/lib/pii/institution-whitelist.ts (Plan 01)
  provides:
    - src/lib/queue/queues.ts (nerPiiQueue + ALL_QUEUES)
    - src/lib/queue/processors/ner-pii.processor.ts (processNerPiiJob, NerPiiJobData, recoverStuckNerJobs, extractMusterText)
    - src/worker.ts (nerPiiWorker registered, concurrency:1)
  affects:
    - Phase 18 Admin Upload UI (calls nerPiiQueue.add() after upload)
    - Phase 17 Urteile-RAG (calls processUrteilNer inline via processNerPiiJob)
tech_stack:
  added: []
  patterns:
    - BullMQ Worker with concurrency:1 for sequential Ollama GPU usage
    - 3-state async state machine PENDING_NER -> NER_RUNNING -> INDEXED|REJECTED_PII_DETECTED
    - PENDING_NER reset in catch block before re-throw (no stuck NER_RUNNING state)
    - Startup recovery sweep via recoverStuckNerJobs() on worker boot
    - MinIO stream-to-string with windowed slice(0,6000)+slice(-2000) for Muster
key_files:
  created:
    - src/lib/queue/processors/ner-pii.processor.ts
  modified:
    - src/lib/queue/queues.ts
    - src/worker.ts
decisions:
  - "nerPiiQueue attempts:1 — NER timeout is a permanent fail; processor resets nerStatus to PENDING_NER; Phase 18 re-submits manually"
  - "Muster.name used for logging (schema has no dateiname field — plan spec was incorrect; actual field is name)"
  - "extractMusterText() exported for testability; windowing applied in processor not in ner-filter.ts (matches Plan 01 decision)"
  - "processUrteilNer() throws Error on PII (Phase 17 caller skips ingestion); no DB write here — Phase 17 writes piiFiltered:true"
  - "recoverStuckNerJobs() called in startup try/catch block as non-fatal — matches pattern of other recovery sweeps in worker.ts"
metrics:
  duration: "~2m"
  completed: "2026-02-27T08:29:05Z"
  tasks_completed: 2
  files_created: 1
  files_modified: 2
---

# Phase 16 Plan 02: BullMQ NER-PII Queue + Processor Summary

**One-liner:** BullMQ ner-pii queue with 3-state Muster machine (PENDING_NER -> NER_RUNNING -> INDEXED|REJECTED_PII_DETECTED) and startup recovery sweep wired into worker.ts at concurrency:1.

## What Was Built

**`src/lib/queue/queues.ts` (modified)**
- `nerPiiQueue` — new Queue("ner-pii", attempts:1, 24h/7d retention) exported
- Added to `ALL_QUEUES` array for Bull Board auto-discovery

**`src/lib/queue/processors/ner-pii.processor.ts` (created)**
- `NerPiiJobData` interface — `musterId?: string`, `urteilText?: string`, `urteilId?: string`
- `extractMusterText(minioKey)` — reads MinIO object stream, windows to `text.slice(0,6000)+"\n...\n"+text.slice(-2000)` covering Rubrum + signature block
- `processMusterNer(musterId)` — PENDING_NER -> NER_RUNNING -> INDEXED|REJECTED_PII_DETECTED; catch resets to PENDING_NER before re-throw
- `processUrteilNer(urteilText, urteilId)` — inline gate for Phase 17; throws Error on PII so caller skips ingestion
- `recoverStuckNerJobs()` — `updateMany({ where: { nerStatus: "NER_RUNNING" }, data: { nerStatus: "PENDING_NER" } })` on worker boot
- `processNerPiiJob(data)` — main dispatcher; routes to processMusterNer or processUrteilNer based on job data

**`src/worker.ts` (modified)**
- Import `processNerPiiJob, NerPiiJobData, recoverStuckNerJobs` from ner-pii.processor
- `nerPiiWorker` registered with concurrency:1 (sequential Ollama — avoids GPU contention)
- completed/failed/error event handlers added following adjacent worker pattern
- `recoverStuckNerJobs()` called in startup() try/catch block (non-fatal)
- ner-pii added to startup log queue list

## Success Criteria Verification

| Criterion | Status | Evidence |
|-----------|--------|---------|
| nerPiiQueue exported and in ALL_QUEUES | PASS | queues.ts line 139, 162 |
| processNerPiiJob handles musterId 3-state | PASS | processMusterNer() PENDING_NER->NER_RUNNING->INDEXED|REJECTED |
| PENDING_NER reset in catch before re-throw | PASS | catch block in processMusterNer() |
| recoverStuckNerJobs() clears NER_RUNNING on boot | PASS | startup() calls recoverStuckNerJobs() |
| nerPiiWorker in worker.ts with concurrency:1 | PASS | src/worker.ts line 571 |
| No new npm packages installed | PASS | Only used existing imports |
| TypeScript compiles clean | PASS | npx tsc --noEmit exits 0 |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: nerPiiQueue in queues.ts | `e717e2b` | nerPiiQueue + ALL_QUEUES |
| Task 2: ner-pii.processor.ts + worker.ts | `d4a6abf` | Full processor + worker wiring |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Muster.dateiname does not exist in schema**
- **Found during:** Task 2
- **Issue:** Plan spec referenced `dateiname` field on Muster model. Actual Prisma schema has no `dateiname` field — the original filename is stored in `name`.
- **Fix:** Used `muster.name` in log calls instead of `muster.dateiname`. No behavioral change — logging only.
- **Files modified:** src/lib/queue/processors/ner-pii.processor.ts
- **Commit:** d4a6abf (incorporated inline)

## Architecture Notes for Downstream Consumers

**Phase 17 (Urteile-RAG):** Call `processNerPiiJob({ urteilText: chunk.content, urteilId: chunk.id })` directly (not via BullMQ queue). If it throws, skip the Urteil. If it returns, write `piiFiltered: true` to DB. Alternatively, call `runNerFilter()` from ner-filter.ts directly for simpler integration — processUrteilNer is a thin wrapper.

**Phase 18 (Muster-RAG + Admin Upload UI):** After upload to MinIO and creating the Muster row, call `nerPiiQueue.add("ner-muster", { musterId: muster.id })`. The BullMQ worker picks it up and runs the full state machine. Poll `muster.nerStatus` for UI feedback.

## Self-Check: PASSED

Files created:
- [x] `src/lib/queue/processors/ner-pii.processor.ts` — exists, exports processNerPiiJob, NerPiiJobData, recoverStuckNerJobs, extractMusterText

Files modified:
- [x] `src/lib/queue/queues.ts` — nerPiiQueue exported and in ALL_QUEUES
- [x] `src/worker.ts` — nerPiiWorker registered, recoverStuckNerJobs called

Commits:
- [x] `e717e2b` — feat(16-02): add nerPiiQueue to queues.ts and ALL_QUEUES
- [x] `d4a6abf` — feat(16-02): create ner-pii.processor.ts and wire nerPiiWorker into worker.ts

TypeScript: clean (npx tsc --noEmit exits 0)
