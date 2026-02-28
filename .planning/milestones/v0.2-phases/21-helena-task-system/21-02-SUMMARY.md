---
phase: 21-helena-task-system
plan: 02
subsystem: api
tags: [rest-api, bullmq, worker, rbac, abort, next-api-routes]

# Dependency graph
requires:
  - phase: 21-helena-task-system
    provides: "task-service, at-mention-parser, helena-task processor, helenaTaskQueue"
provides:
  - "POST /api/helena/tasks -- create task with Zod validation and Akte access check"
  - "GET /api/helena/tasks -- paginated task list with status/akteId filters"
  - "GET /api/helena/tasks/[id] -- full task detail with steps trace and drafts"
  - "PATCH /api/helena/tasks/[id] -- abort running task (DB + AbortController)"
  - "helena-task BullMQ worker with lockDuration:120_000 and concurrency:1"
  - "Startup recovery for stuck RUNNING HelenaTask records"
affects: [22-schriftsatz-orchestrator, 26-activity-feed-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: ["requireAuth() + buildAkteAccessFilter() for Helena API routes", "lockDuration on Worker (not Queue) per BullMQ v5 docs", "updateMany startup recovery for orphaned RUNNING tasks"]

key-files:
  created:
    - src/app/api/helena/tasks/route.ts
    - src/app/api/helena/tasks/[id]/route.ts
  modified:
    - src/worker.ts

key-decisions:
  - "Used kurzrubrum (not rubrum) in Akte select -- matches actual Prisma schema column name"
  - "No PRAKTIKANT RBAC check -- role was removed in Phase 8, all 4 existing roles can use @Helena"
  - "lockDuration:120_000 on Worker instance (not queue definition) per BullMQ v5 best practice"

patterns-established:
  - "Helena API auth pattern: requireAuth() + ownership check (userId match or ADMIN)"
  - "Abort flow: DB status update first, then in-process AbortController signal"
  - "Startup recovery: updateMany WHERE status=RUNNING SET FAILED with German error message"

requirements-completed: [TASK-01, TASK-05, AGNT-07]

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 21 Plan 02: Helena Task API Routes and Worker Registration Summary

**REST API for Helena task create/list/detail/abort with RBAC, plus BullMQ worker registration with 120s lockDuration and startup recovery for stuck tasks**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T16:53:29Z
- **Completed:** 2026-02-27T16:56:34Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Complete REST API for Helena tasks: create with Zod validation, paginated list with filters, detail with steps trace, abort with AbortController signal
- RBAC enforcement: users see/abort only their own tasks, ADMIN sees all
- helena-task BullMQ worker with concurrency:1 (Ollama GPU) and lockDuration:120_000 (anti-stall AGNT-07)
- Startup recovery marks orphaned RUNNING tasks as FAILED with German error message

## Task Commits

Each task was committed atomically:

1. **Task 1: Helena task API routes (create, list, detail, abort)** - `8004a17` (feat)
2. **Task 2: Register helena-task worker with lockDuration and startup recovery** - `048813a` (feat)

## Files Created/Modified
- `src/app/api/helena/tasks/route.ts` - POST (create task) and GET (list tasks) endpoints with Zod validation
- `src/app/api/helena/tasks/[id]/route.ts` - GET (task detail) and PATCH (abort) endpoints with ownership checks
- `src/worker.ts` - helena-task worker registration (concurrency:1, lockDuration:120_000) + startup recovery

## Decisions Made
- Used `kurzrubrum` instead of plan's `rubrum` in Akte select -- `rubrum` doesn't exist in schema, `kurzrubrum` is the actual column
- Skipped PRAKTIKANT RBAC check from plan -- PRAKTIKANT role was removed in Phase 8 (only 4 roles remain: ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT), all of which can use @Helena
- Used existing `requireAuth()` + `buildAkteAccessFilter()` patterns from `@/lib/rbac` instead of raw `auth()` calls -- consistent with project conventions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected Akte column name from rubrum to kurzrubrum**
- **Found during:** Task 1 (API routes)
- **Issue:** Plan specified `rubrum` in Akte select, but schema uses `kurzrubrum`
- **Fix:** Used `kurzrubrum` in all Akte select clauses
- **Files modified:** src/app/api/helena/tasks/route.ts, src/app/api/helena/tasks/[id]/route.ts
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 8004a17 (Task 1 commit)

**2. [Rule 1 - Bug] Removed non-existent PRAKTIKANT role check**
- **Found during:** Task 1 (API routes)
- **Issue:** Plan specified PRAKTIKANT RBAC exclusion, but enum UserRole has only 4 values (ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT) -- PRAKTIKANT was removed in Phase 8
- **Fix:** Used `requireAuth()` without role exclusion since all existing roles can use @Helena
- **Files modified:** src/app/api/helena/tasks/route.ts
- **Verification:** Verified against prisma/schema.prisma enum UserRole and Phase 8 verification report
- **Committed in:** 8004a17 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs -- plan referenced outdated schema)
**Impact on plan:** Both fixes necessary for TypeScript compilation and runtime correctness. No scope creep.

## Issues Encountered
None -- plan executed cleanly after adjusting for schema reality.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full @Helena task-system backend is complete: parser, service, queue, processor, API routes, worker
- Phase 22 (Schriftsatz Orchestrator) can consume Helena task infrastructure
- Phase 26 (Activity Feed UI) can use the REST API for task display and abort
- All Socket.IO events documented in processor for frontend integration

## Self-Check: PASSED

- All 3 source files exist on disk
- Both task commits verified: 8004a17, 048813a
- `npx tsc --noEmit` passes clean

---
*Phase: 21-helena-task-system*
*Completed: 2026-02-27*
