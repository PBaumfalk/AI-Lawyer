---
phase: 23-draft-approval-workflow
plan: 03
subsystem: notifications
tags: [socket-io, notifications, helena, draft-workflow, prisma]

# Dependency graph
requires:
  - phase: 23-draft-approval-workflow (plan 01)
    provides: draft-notification.ts helper with notifyDraftCreated function
  - phase: 23-draft-approval-workflow (plan 02)
    provides: Socket.IO infrastructure and notification UI components
provides:
  - notifyDraftCreated wired into all 5 HelenaDraft creation sites (4 tool executors + Schriftsatz pipeline)
  - Socket.IO notifications fire at runtime when Helena creates any draft
affects: [24-scanner-alerts, 26-activity-feed]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget notification pattern: .catch(() => {}) on notification calls to prevent tool/pipeline failure"
    - "Akte owner resolution: anwaltId -> sachbearbeiterId fallback for notification recipients"

key-files:
  created: []
  modified:
    - src/lib/helena/tools/_write/create-draft-dokument.ts
    - src/lib/helena/tools/_write/create-draft-frist.ts
    - src/lib/helena/tools/_write/create-notiz.ts
    - src/lib/helena/tools/_write/create-draft-zeiterfassung.ts
    - src/lib/helena/schriftsatz/index.ts

key-decisions:
  - "sachbearbeiterId as fallback instead of verantwortlichId (field does not exist in Akte schema)"

patterns-established:
  - "Fire-and-forget notification: notifyDraftCreated(...).catch(() => {}) -- never await, never fail the caller"
  - "Akte owner resolution: akte.anwaltId ?? akte.sachbearbeiterId ?? null for recipient fallback"

requirements-completed: [DRFT-06]

# Metrics
duration: 2min
completed: 2026-02-27
---

# Phase 23 Plan 03: Wire Draft Notifications Summary

**notifyDraftCreated() wired into all 5 HelenaDraft creation sites with fire-and-forget pattern for Socket.IO notifications at runtime**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-27T21:43:35Z
- **Completed:** 2026-02-27T21:45:48Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- All 4 tool executors (create-draft-dokument, create-draft-frist, create-notiz, create-draft-zeiterfassung) now import and call notifyDraftCreated after helenaDraft.create()
- Schriftsatz pipeline Stage 6 also wired with notifyDraftCreated after draft creation
- draft-notification.ts is no longer orphaned -- it has 5 active callers at runtime
- Notification failures silently caught (fire-and-forget) to never fail tool execution or pipeline

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire notifyDraftCreated into all 4 tool executors** - `64581d4` (feat)
2. **Task 2: Wire notifyDraftCreated into Schriftsatz pipeline Stage 6** - `ec48704` (feat)

## Files Created/Modified
- `src/lib/helena/tools/_write/create-draft-dokument.ts` - Added notifyDraftCreated import and fire-and-forget call after draft creation
- `src/lib/helena/tools/_write/create-draft-frist.ts` - Added notifyDraftCreated import and fire-and-forget call after draft creation
- `src/lib/helena/tools/_write/create-notiz.ts` - Added notifyDraftCreated import and fire-and-forget call after draft creation
- `src/lib/helena/tools/_write/create-draft-zeiterfassung.ts` - Added notifyDraftCreated import and fire-and-forget call after draft creation
- `src/lib/helena/schriftsatz/index.ts` - Added notifyDraftCreated import and fire-and-forget call in Stage 6

## Decisions Made
- Used `sachbearbeiterId` as fallback instead of `verantwortlichId` -- the plan referenced a `verantwortlichId` field on the Akte model that does not exist in the actual Prisma schema. The closest equivalent is `sachbearbeiterId`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Akte owner field reference from verantwortlichId to sachbearbeiterId**
- **Found during:** Task 1 (Wire notifyDraftCreated into tool executors)
- **Issue:** Plan specified `akte.verantwortlichId` as fallback for notification recipients, but the Akte model in Prisma schema has no `verantwortlichId` field. TypeScript compilation failed with TS2353.
- **Fix:** Used `sachbearbeiterId` as the fallback field instead (Akte has `anwaltId` and `sachbearbeiterId` for assigned staff).
- **Files modified:** All 5 modified files
- **Verification:** TypeScript compiles without errors in all modified files
- **Committed in:** 64581d4 (Task 1), ec48704 (Task 2)

---

**Total deviations:** 1 auto-fixed (1 bug - incorrect schema field reference)
**Impact on plan:** Essential fix for TypeScript compilation. No scope creep. Behavior unchanged (still resolves Akte owner for notification).

## Issues Encountered
None -- pre-existing TypeScript errors in src/lib/helena/index.ts (StepUpdate type mismatch, Date.now() returning number vs string) are unrelated to this plan's changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Draft notification pipeline is now fully connected end-to-end
- Phase 23 (Draft-Approval Workflow) is complete with all 3 plans executed
- Ready for Phase 24 (Scanner + Alerts)

## Self-Check: PASSED

All 5 modified files exist. Both task commits (64581d4, ec48704) verified in git history. SUMMARY.md created.

---
*Phase: 23-draft-approval-workflow*
*Completed: 2026-02-27*
