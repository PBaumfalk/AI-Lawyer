---
phase: 27-activity-feed-qa-pipeline-wiring
plan: 01
subsystem: api, ui
tags: [activity-feed, helena-draft, socket-io, prisma, inline-review]

requires:
  - phase: 26-activity-feed-ui-qa-gates
    provides: ActivityFeedEntry component with DraftReviewActions, AktenActivity model
  - phase: 23-draft-approval-workflow
    provides: HelenaDraft CRUD API with Zod discriminated union PATCH endpoint
provides:
  - createDraftActivity() shared helper for AktenActivity creation on draft events
  - Fixed DraftReviewActions API calls matching Zod ActionSchema discriminated union
  - All 5 draft creation sites wired to create AktenActivity entries
affects: [activity-feed, helena-drafts, schriftsatz-pipeline, inline-review]

tech-stack:
  added: []
  patterns: [fire-and-forget activity logging, createDraftActivity helper pattern]

key-files:
  created:
    - src/lib/helena/draft-activity.ts
  modified:
    - src/components/akten/activity-feed-entry.tsx
    - src/lib/helena/tools/_write/create-draft-dokument.ts
    - src/lib/helena/tools/_write/create-draft-frist.ts
    - src/lib/helena/tools/_write/create-notiz.ts
    - src/lib/helena/tools/_write/create-draft-zeiterfassung.ts
    - src/lib/helena/schriftsatz/index.ts

key-decisions:
  - "createDraftActivity wraps try-catch internally (fire-and-forget) -- callers use .catch(() => {}) for double safety"
  - "userId: null hardcoded in helper for Helena attribution (Bot icon + brand blue border in feed)"
  - "draftInhalt truncated to 200 chars in AktenActivity.inhalt for feed preview"

patterns-established:
  - "createDraftActivity helper: consistent AktenActivity + Socket.IO emission for all draft types"
  - "API action discriminator: all DraftReviewActions use { action: 'accept'|'reject'|'edit' } body"

requirements-completed: [DRFT-02, DRFT-03, DRFT-04, UI-05, UI-06, TASK-03]

duration: 3min
completed: 2026-02-28
---

# Phase 27 Plan 01: Activity Feed + Pipeline Wiring Summary

**Fixed DraftReviewActions API paths (Zod discriminated union) and wired all 5 draft creation sites to create AktenActivity entries for inline feed review**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-28T11:38:33Z
- **Completed:** 2026-02-28T11:41:09Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created shared `createDraftActivity()` helper that creates AktenActivity(typ=HELENA_DRAFT) + emits Socket.IO event
- Fixed all 3 DraftReviewActions fetch calls to use correct `PATCH /api/helena/drafts/{id}` with `{ action }` discriminator body
- Wired createDraftActivity into all 5 draft creation sites (4 write tools + schriftsatz pipeline)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared draft activity helper and fix DraftReviewActions API paths** - `c231430` (feat)
2. **Task 2: Wire createDraftActivity into all 5 draft creation sites** - `7c4bd42` (feat)

## Files Created/Modified
- `src/lib/helena/draft-activity.ts` - Shared helper: creates AktenActivity + emits Socket.IO akten-activity:new event
- `src/components/akten/activity-feed-entry.tsx` - Fixed 3 DraftReviewActions fetch calls to use correct API paths and body shape
- `src/lib/helena/tools/_write/create-draft-dokument.ts` - Added createDraftActivity after notifyDraftCreated
- `src/lib/helena/tools/_write/create-draft-frist.ts` - Added createDraftActivity after notifyDraftCreated
- `src/lib/helena/tools/_write/create-notiz.ts` - Added createDraftActivity after notifyDraftCreated
- `src/lib/helena/tools/_write/create-draft-zeiterfassung.ts` - Added createDraftActivity after notifyDraftCreated
- `src/lib/helena/schriftsatz/index.ts` - Added createDraftActivity after notifyDraftCreated in pipeline

## Decisions Made
- `createDraftActivity` wraps try-catch internally (fire-and-forget) -- callers use `.catch(() => {})` for double safety matching existing `notifyDraftCreated` pattern
- `userId: null` hardcoded in helper for Helena attribution (Bot icon + brand blue border in feed)
- `draftInhalt` truncated to 200 chars in AktenActivity.inhalt for feed preview

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- End-to-end inline draft review flow is now functional: Helena drafts appear in feed AND can be accepted/rejected/edited
- Ready for 27-02 plan execution

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 27-activity-feed-qa-pipeline-wiring*
*Completed: 2026-02-28*
