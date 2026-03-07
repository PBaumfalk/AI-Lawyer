---
phase: 58-caldav-sync
plan: 02
subsystem: api
tags: [caldav, icalendar, bullmq, sync-engine, bidirectional-sync, etag, ctag]

requires:
  - phase: 58-caldav-sync
    provides: "CalDavKonto model, tsdav client wrapper, CalDavSyncMapping model"
provides:
  - "CalDAV sync engine with push-Fristen, bidi-Termine, pull-external logic"
  - "iCalendar VEVENT builder/parser for KalenderEintrag conversion"
  - "BullMQ caldav-sync queue with 15-min cron and manual sync API"
affects: [58-03-PLAN]

tech-stack:
  added: []
  patterns: [caldav-sync-engine, ical-builder-parser, incremental-etag-ctag-sync]

key-files:
  created:
    - src/lib/caldav/ical-builder.ts
    - src/lib/caldav/sync-engine.ts
    - src/lib/queue/processors/caldav-sync.processor.ts
    - src/app/api/caldav-konten/[id]/sync/route.ts
  modified:
    - src/lib/queue/queues.ts
    - src/worker.ts

key-decisions:
  - "Remote wins on BIDI conflict (safer for external calendar authority)"
  - "Deterministic UID pattern ${id}@ai-lawyer.local to distinguish own events from external"
  - "PULL mappings with kalenderEintragId=null for external events (displayed separately in Plan 03)"

patterns-established:
  - "CalDAV sync engine: three-phase sync (push Fristen, bidi Termine, pull external)"
  - "ETag per-event and CTag per-calendar for incremental change detection"

requirements-completed: [CAL-03, CAL-04, CAL-05, CAL-07]

duration: 4min
completed: 2026-03-07
---

# Phase 58 Plan 02: CalDAV Sync Engine Summary

**Bidirectional CalDAV sync engine with read-only Frist export, bidi Termine sync, ETag/CTag incremental tracking, 15-min BullMQ cron, and manual sync API endpoint**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T00:32:04Z
- **Completed:** 2026-03-07T00:36:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- iCalendar VEVENT builder converts KalenderEintrag to/from iCalendar format with Frist/Termin differentiation
- Sync engine implements three-phase logic: push Fristen (read-only), bidirectional Termine, pull external events
- ETag per-event and CTag per-calendar tracking for incremental sync (no full resync each cycle)
- BullMQ caldav-sync queue with every-15-minute cron and manual sync via POST API

## Task Commits

Each task was committed atomically:

1. **Task 1: iCal builder + sync engine** - `4b2d513` (feat)
2. **Task 2: BullMQ queue, processor, worker registration + manual sync endpoint** - `5e6e5dd` (feat)

## Files Created/Modified
- `src/lib/caldav/ical-builder.ts` - kalenderEintragToVEvent and vEventToCalDavEvent for iCal conversion
- `src/lib/caldav/sync-engine.ts` - syncCalDavKonto with push-Fristen, bidi-Termine, pull-external phases
- `src/lib/queue/processors/caldav-sync.processor.ts` - BullMQ processor for single and all-konten sync
- `src/app/api/caldav-konten/[id]/sync/route.ts` - POST endpoint for manual sync trigger
- `src/lib/queue/queues.ts` - Added caldavSyncQueue, CalDavSyncJobData, registerCalDavSyncJob
- `src/worker.ts` - Registered caldav-sync worker with concurrency=1 and cron startup

## Decisions Made
- Remote wins on BIDI conflict (safer for external calendar authority -- external calendar is source of truth)
- Deterministic UID pattern `${id}@ai-lawyer.local` distinguishes own pushed events from external ones during pull
- PULL mappings created with kalenderEintragId=null for external events (will be displayed separately in Plan 03 UI)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed JSDoc comment closing in queues.ts**
- **Found during:** Task 2
- **Issue:** JSDoc comment containing `*/15` in cron pattern prematurely closed the comment block
- **Fix:** Simplified JSDoc text to avoid literal cron pattern in comment
- **Files modified:** src/lib/queue/queues.ts
- **Committed in:** 5e6e5dd (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Map iteration in sync-engine.ts**
- **Found during:** Task 1 verification
- **Issue:** `for...of` on Map requires downlevelIteration flag
- **Fix:** Used `Array.from(remoteByUid.entries())` for iteration
- **Files modified:** src/lib/caldav/sync-engine.ts
- **Committed in:** 4b2d513 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correct compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed items above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sync engine fully operational, ready for UI integration (Plan 03)
- Manual sync endpoint available for settings page sync button
- PULL mappings ready for external event display in calendar UI

---
*Phase: 58-caldav-sync*
*Completed: 2026-03-07*
