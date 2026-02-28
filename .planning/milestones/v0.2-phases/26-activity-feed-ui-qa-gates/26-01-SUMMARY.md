---
phase: 26-activity-feed-ui-qa-gates
plan: 01
subsystem: ui
tags: [react, activity-feed, tabs, cursor-pagination, prisma, next-api]

# Dependency graph
requires:
  - phase: 19-schema-foundation
    provides: AktenActivity model with 8 event types and indexes
  - phase: 24-scanner-alerts
    provides: AktenActivity entries created by scanner service
provides:
  - GET /api/akten/[id]/feed endpoint with cursor pagination and type filtering
  - ActivityFeed component with filter chips and load-more pagination
  - ActivityFeedEntry polymorphic component with Helena vs Human attribution
  - ActivityFeedSkeleton loading component
  - Restructured akte-detail-tabs.tsx with 4 tabs (Feed + Dokumente + Kalender + Finanzen)
affects: [26-02-PLAN, 26-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [polymorphic-feed-entry, cursor-pagination-feed, severity-border-class, 4-tab-akte-layout]

key-files:
  created:
    - src/app/api/akten/[id]/feed/route.ts
    - src/components/akten/activity-feed.tsx
    - src/components/akten/activity-feed-entry.tsx
    - src/components/akten/activity-feed-skeleton.tsx
  modified:
    - src/components/akten/akte-detail-tabs.tsx

key-decisions:
  - "requireAkteAccess from @/lib/rbac for feed endpoint access control (consistent with existing route patterns)"
  - "Cursor pagination with take+1 pattern for hasMore detection (matches existing historie endpoint)"
  - "Severity border class inline in activity-feed-entry.tsx (self-contained, no cross-module dependency)"
  - "Feed absorbs 8 former tabs; file reduced from 921 to 152 lines"

patterns-established:
  - "Polymorphic feed entry: single component renders all 8 AktenActivityTyp variants with expand/collapse"
  - "Helena attribution: user===null means Helena, shown with Bot icon + brand blue border for drafts"
  - "Filter chips with combined types: Helena=HELENA_DRAFT+HELENA_ALERT, Status=BETEILIGTE+STATUS_CHANGE"
  - "Feed API cursor pattern: fetch take+1, slice, return nextCursor+hasMore"

requirements-completed: [UI-01, UI-03]

# Metrics
duration: 5min
completed: 2026-02-28
---

# Phase 26 Plan 01: Activity Feed UI Summary

**Activity Feed with cursor-paginated API, polymorphic entry components (Helena vs Human attribution), and 4-tab Akte detail restructuring from 12 tabs**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-28T10:25:11Z
- **Completed:** 2026-02-28T10:30:11Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- GET /api/akten/[id]/feed with cursor pagination and type filtering via requireAkteAccess RBAC
- ActivityFeedEntry component with polymorphic rendering for all 8 AktenActivityTyp variants, Helena vs Human attribution (robot icon, brand blue border for drafts, severity borders for alerts)
- Filter chips: Alle, Dokumente, Fristen, E-Mails, Helena (HELENA_DRAFT+HELENA_ALERT), Notizen, Status (BETEILIGTE+STATUS_CHANGE)
- Restructured akte-detail-tabs.tsx from 12 tabs to 4 tabs (Feed as default, Dokumente, Kalender, Finanzen) -- 921 lines reduced to 152

## Task Commits

Each task was committed atomically:

1. **Task 1: Create feed API endpoint** - `af001a2` (feat)
2. **Task 2: Create ActivityFeedEntry, ActivityFeedSkeleton, ActivityFeed** - `ae68655` (feat)
3. **Task 3: Restructure akte-detail-tabs from 12 to 4 tabs** - `dfcf8d3` (refactor)

## Files Created/Modified
- `src/app/api/akten/[id]/feed/route.ts` - Paginated AktenActivity feed endpoint with type filtering
- `src/components/akten/activity-feed-entry.tsx` - Polymorphic feed entry with expand/collapse, Helena attribution, severity borders
- `src/components/akten/activity-feed-skeleton.tsx` - Loading skeleton with 5 animated placeholder entries
- `src/components/akten/activity-feed.tsx` - Main feed component with filter chips, pagination, entry list
- `src/components/akten/akte-detail-tabs.tsx` - Restructured from 12 tabs to 4 (Feed + Dokumente + Kalender + Finanzen)

## Decisions Made
- Used requireAkteAccess from @/lib/rbac for feed API (consistent with existing /api/akten/[id]/historie pattern)
- Cursor pagination with take+1 overfetch for hasMore detection (proven pattern from historie endpoint)
- Severity border class defined inline in activity-feed-entry.tsx rather than importing from akte-alerts-section.tsx (keeps component self-contained)
- Removed AkteHistorie, BeaPruefprotokoll, AuditDetails inline components and all related constants from akte-detail-tabs.tsx (feed supersedes all)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adjusted auth import path**
- **Found during:** Task 1 (Feed API endpoint)
- **Issue:** Plan referenced `requireAuth` + `buildAkteAccessFilter` from `@/lib/auth`, but project uses `requireAkteAccess` from `@/lib/rbac`
- **Fix:** Used `requireAkteAccess` from `@/lib/rbac` matching existing `/api/akten/[id]/historie/route.ts` pattern
- **Files modified:** src/app/api/akten/[id]/feed/route.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** af001a2

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auth import correction was necessary for compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Feed components ready for plan 26-02 (Socket.IO real-time updates, composer, @Helena interaction)
- Endpoint ready for plan 26-02 POST handler (note creation + @Helena task trigger)
- Feed entry structure ready for plan 26-02 inline draft review (Accept/Edit/Reject)

## Self-Check: PASSED

All 5 created/modified files verified to exist on disk. All 3 task commits verified in git log (af001a2, ae68655, dfcf8d3). TypeScript compilation introduces zero new errors.

---
*Phase: 26-activity-feed-ui-qa-gates*
*Completed: 2026-02-28*
