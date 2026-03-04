---
phase: 51-systematic-bug-audit-fix
plan: 01
subsystem: ui, api, infra
tags: [react-hooks, typescript, next-api-routes, health-checks, falldaten]

# Dependency graph
requires: []
provides:
  - "Fixed React hooks ordering in rollen/page.tsx"
  - "Type-safe TemplateField with FalldatenFeldTypDB in falldaten-tab.tsx"
  - "Clean route exports in special-quests/route.ts"
  - "Extracted CONDITION_TEMPLATES to src/lib/gamification/condition-templates.ts"
  - "Correct Stirling PDF health check port (8081)"
affects: [gamification, falldaten, health-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-route exports must be in lib/ files, not route.ts files"
    - "Hooks before early returns (Rules of Hooks)"

key-files:
  created:
    - src/lib/gamification/condition-templates.ts
  modified:
    - src/app/(dashboard)/admin/rollen/page.tsx
    - src/components/akten/falldaten-tab.tsx
    - src/app/api/gamification/special-quests/route.ts
    - src/app/api/gamification/special-quests/[id]/route.ts
    - src/lib/health/checks.ts

key-decisions:
  - "Extracted CONDITION_TEMPLATES to lib/ instead of just removing export keyword, so both route files can import it cleanly"

patterns-established:
  - "Next.js route files must only export GET/POST/PUT/DELETE/PATCH handlers"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 51 Plan 01: Fix P0 Critical Bugs Summary

**Fixed React hooks violation, TypeScript type mismatches, non-route API export, and wrong Stirling PDF health check port**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T06:32:27Z
- **Completed:** 2026-03-04T06:35:16Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Moved `useCallback` before early returns in rollen/page.tsx to satisfy React's Rules of Hooks
- Aligned `TemplateField.typ` type from `string` to `FalldatenFeldTypDB` in falldaten-tab.tsx and converted null beschreibung to undefined
- Extracted `CONDITION_TEMPLATES` from route.ts to `src/lib/gamification/condition-templates.ts` eliminating non-route export
- Fixed Stirling PDF health check fallback port from 8090 to 8081 matching docker-compose mapping
- Zero TypeScript errors in all modified files

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix React hooks violation and type mismatches** - `c5d095b` (fix)
2. **Task 2: Extract non-route export and fix health check port** - `5530efd` (fix)

## Files Created/Modified
- `src/app/(dashboard)/admin/rollen/page.tsx` - Moved useCallback before early returns
- `src/components/akten/falldaten-tab.tsx` - Changed typ to FalldatenFeldTypDB, null-to-undefined conversion
- `src/lib/gamification/condition-templates.ts` - New file with extracted ConditionTemplate interface and CONDITION_TEMPLATES array
- `src/app/api/gamification/special-quests/route.ts` - Removed inline CONDITION_TEMPLATES, imports from lib/
- `src/app/api/gamification/special-quests/[id]/route.ts` - Updated import path from ../route to @/lib/gamification/condition-templates
- `src/lib/health/checks.ts` - Fixed Stirling PDF fallback URL port 8090 to 8081

## Decisions Made
- Extracted CONDITION_TEMPLATES to a shared lib/ module rather than just removing the export keyword, since `[id]/route.ts` also imports it. This is the correct Next.js pattern for shared data between route handlers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated [id]/route.ts import path**
- **Found during:** Task 2 (Extract non-route export)
- **Issue:** `src/app/api/gamification/special-quests/[id]/route.ts` imports CONDITION_TEMPLATES from `../route` -- moving the export would break this file
- **Fix:** Updated the import to `@/lib/gamification/condition-templates`
- **Files modified:** `src/app/api/gamification/special-quests/[id]/route.ts`
- **Verification:** `npx tsc --noEmit` passes with zero errors in modified files
- **Committed in:** 5530efd (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to avoid breaking the [id] route handler. No scope creep.

## Issues Encountered
- Pre-existing TypeScript error in `compose-popup.tsx` (unrelated to this plan) -- logged to `deferred-items.md`

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- P0 bugs are resolved, ready for P1/P2 bug fixes in subsequent plans
- All modified files compile cleanly

## Self-Check: PASSED

- All 6 files verified to exist on disk
- Both commits (c5d095b, 5530efd) verified in git history
- Zero TypeScript errors in modified files

---
*Phase: 51-systematic-bug-audit-fix*
*Completed: 2026-03-04*
