---
phase: 51-systematic-bug-audit-fix
plan: 04
subsystem: testing, infra
tags: [vitest, typescript, next.js, build-config]

# Dependency graph
requires:
  - phase: 51-systematic-bug-audit-fix
    provides: "Plan 01 fixed TypeScript errors (falldaten-tab.tsx, special-quests)"
provides:
  - "npm test / npm run test:watch scripts for running vitest"
  - "Fixed create_draft_dokument test (missing akte.findUnique + module mocks)"
  - "Build-time TypeScript error checking (ignoreBuildErrors: false)"
affects: [all-future-development]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Build-time TS error checking via ignoreBuildErrors: false"
    - "npm test as standard test runner entry point"

key-files:
  created: []
  modified:
    - package.json
    - src/lib/helena/__tests__/tools.test.ts
    - next.config.mjs

key-decisions:
  - "Added findUnique mock to akte (tool calls findUnique not findFirst for owner lookup)"
  - "Added vi.mock for draft-notification and draft-activity modules (imported by create-draft-dokument)"
  - "Kept eslint.ignoreDuringBuilds: true (317 lint warnings out of scope)"

patterns-established:
  - "All helena tool tests must mock both akte.findFirst and akte.findUnique"
  - "Module-level mocks needed for fire-and-forget helpers (draft-notification, draft-activity)"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-03-04
---

# Phase 51 Plan 04: Test Scripts, Mock Fix & TS Build Checking Summary

**Added npm test scripts, fixed create_draft_dokument mock (missing findUnique + module mocks), enabled build-time TypeScript error checking**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T06:38:12Z
- **Completed:** 2026-03-04T06:40:26Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `test` and `test:watch` scripts to package.json for running vitest
- Fixed `create_draft_dokument` test by adding missing `akte.findUnique` mock and `vi.mock` for `draft-notification` and `draft-activity` modules
- Enabled TypeScript build error checking (`ignoreBuildErrors: false`) -- future TS errors will be caught at build time
- Verified `next build` succeeds cleanly with TS checking enabled

## Task Commits

Each task was committed atomically:

1. **Task 1: Add test scripts and fix tools.test.ts mock** - `de7e0af` (feat)
2. **Task 2: Enable TypeScript build error checking** - `9dcc227` (feat)

## Files Created/Modified
- `package.json` - Added "test": "vitest run" and "test:watch": "vitest" scripts
- `src/lib/helena/__tests__/tools.test.ts` - Added akte.findUnique mock, vi.mock for draft-notification and draft-activity
- `next.config.mjs` - Changed ignoreBuildErrors from true to false

## Decisions Made
- Root cause of create_draft_dokument test failure was twofold: (1) missing `akte.findUnique` mock caused the tool to throw during owner resolution, and (2) missing module mocks for `draft-notification` and `draft-activity` caused import errors
- Kept `eslint.ignoreDuringBuilds: true` unchanged -- 317 lint warnings are a separate concern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Test infrastructure fully operational: `npm test` runs 417+ tests (10 NER tests require Ollama)
- TypeScript errors will now block builds, catching regressions early
- Ready for remaining plans in phase 51

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 51-systematic-bug-audit-fix*
*Completed: 2026-03-04*
