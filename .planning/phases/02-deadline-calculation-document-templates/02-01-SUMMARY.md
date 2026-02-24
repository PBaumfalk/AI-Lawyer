---
phase: 02-deadline-calculation-document-templates
plan: 01
subsystem: fristen
tags: [date-fns, feiertagejs, vitest, BGB-187, BGB-188, BGB-193, TDD, pure-functions]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation
    provides: Next.js project structure with date-fns installed
provides:
  - Pure function FristenRechner library (berechneFrist, berechneFristRueckwaerts)
  - Holiday wrapper for all 16 Bundeslaender (istFeiertag, getFeiertage)
  - Vorfrist and Halbfrist calculation
  - 18 common German legal deadline presets
  - 77 unit tests covering all BGB 187-193 scenarios
affects: [02-02 (calendar UI), 02-03 (Frist API), fristen-UI, fristen-worker]

# Tech tracking
tech-stack:
  added: [feiertagejs, vitest]
  patterns: [pure-function-library, TDD-red-green-refactor, timezone-safe-holiday-detection]

key-files:
  created:
    - src/lib/fristen/types.ts
    - src/lib/fristen/feiertage.ts
    - src/lib/fristen/rechner.ts
    - src/lib/fristen/vorfrist.ts
    - src/lib/fristen/presets.ts
    - src/lib/fristen/index.ts
    - src/lib/fristen/rechner.test.ts
    - vitest.config.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Normalize dates to noon (12:00) before passing to feiertagejs to avoid timezone-related false negatives in CET/CEST"
  - "date-fns addMonths handles BGB 188(3) month-end overflow natively (Jan 31 + 1mo = Feb 28)"
  - "Ereignisfrist month/year calculation applies period to event date directly per BGB 188(2), not to frist start"
  - "Section 193 defaults to true when not specified in FristInput"

patterns-established:
  - "Pure function library: no DB, no side effects, no process.env, thread-safe"
  - "TDD cycle: RED (failing tests) -> GREEN (implementation) -> REFACTOR (cleanup)"
  - "Timezone-safe holiday detection via noon normalization wrapper around feiertagejs"

requirements-completed: [REQ-FK-001, REQ-FK-002]

# Metrics
duration: 9min
completed: 2026-02-24
---

# Phase 02 Plan 01: FristenRechner Pure Function Library Summary

**BGB 187-193 deadline calculator with feiertagejs holidays, 18 presets, and 77 unit tests (TDD) covering Ereignisfrist, Beginnfrist, month-end overflow, Section 193 shifts, all 16 Bundeslaender, backward calculation, Vorfristen, and Halbfrist**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-24T10:33:12Z
- **Completed:** 2026-02-24T10:42:02Z
- **Tasks:** 4 (TDD: setup, RED, GREEN, REFACTOR)
- **Files created:** 8
- **Tests:** 77 passing (requirement: >50)

## Accomplishments
- Pure function FristenRechner implementing BGB Sections 187-193 with zero side effects
- Correct handling of Ereignisfrist (event day not counted) and Beginnfrist (start day counted)
- Month-end overflow handled by date-fns (Jan 31+1mo=Feb 28, leap year aware)
- Section 193 extension shifts deadlines past weekends and Bundesland-specific holidays
- All 16 Bundeslaender holiday calendars supported via feiertagejs with timezone-safe wrapper
- Backward calculation (Fristende to latest Zustellungstermin) implemented
- Vorfristen shifted to PREVIOUS business day (not next)
- Halbfrist computed only for deadlines > 2 weeks
- 18 common legal deadline presets (ZPO, VwGO, StPO, KSchG, BGB)
- 77 exhaustive unit tests covering all edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Setup (vitest, feiertagejs, types)** - `2a912f9` (chore)
2. **Task 2: RED - Failing test suite** - `881246e` (test)
3. **Task 3: GREEN - Implementation** - `811ffc1` (feat)
4. **Task 4: REFACTOR - Cleanup** - `29c8b7f` (refactor)

## Files Created/Modified
- `vitest.config.ts` - Test runner configuration with path aliases
- `src/lib/fristen/types.ts` - All TypeScript types (FristInput, FristErgebnis, BundeslandCode, etc.)
- `src/lib/fristen/feiertage.ts` - feiertagejs wrapper with timezone-safe noon normalization
- `src/lib/fristen/rechner.ts` - Core berechneFrist() and berechneFristRueckwaerts() functions
- `src/lib/fristen/vorfrist.ts` - berechneVorfristen() and berechneHalbfrist() with backward shift
- `src/lib/fristen/presets.ts` - 18 common German legal deadline presets
- `src/lib/fristen/index.ts` - Barrel export
- `src/lib/fristen/rechner.test.ts` - 77 unit tests (909 lines)

## Decisions Made
- **Timezone normalization:** feiertagejs.isHoliday() compares UTC dates internally. Dates created at midnight in CET/CEST map to the previous day in UTC, causing false negatives. Solution: normalize all dates to noon (12:00) before passing to feiertagejs.
- **BGB 188(2) month calculation:** For Ereignisfrist with month/year periods, the end date corresponds to the event day's number in the target month (applied to event date, not frist start). date-fns addMonths handles overflow (clamps to last day of month) which matches BGB 188(3).
- **Section 193 default:** section193 defaults to true when not specified, matching standard legal practice.
- **Vitest for testing:** Added vitest as the test runner since the project had no test infrastructure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Timezone-safe holiday detection**
- **Found during:** Task 3 (GREEN - Implementation)
- **Issue:** feiertagejs.isHoliday() returned false for valid holidays because `new Date(2026, 3, 3)` at midnight CET becomes April 2 in UTC
- **Fix:** Added toNoon() normalization in feiertage.ts wrapper to use 12:00 instead of 00:00
- **Files modified:** src/lib/fristen/feiertage.ts
- **Verification:** All 16 Bundeslaender holiday tests pass, Karfreitag detected correctly everywhere
- **Committed in:** 811ffc1 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential bug fix for correct holiday detection. No scope creep.

## Issues Encountered
- feiertagejs timezone sensitivity required the noon normalization pattern. This is a known issue with JavaScript Date in non-UTC timezones and was resolved during the GREEN phase.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FristenRechner library is complete and tested, ready for UI integration (Plan 02-02)
- All exports are available via `@/lib/fristen` barrel import
- Pure function design allows use in API routes, UI components, workers, and batch contexts
- Vitest is now configured project-wide for future test suites

## Self-Check: PASSED

All 9 created files verified present. All 4 task commits verified in git log.

---
*Phase: 02-deadline-calculation-document-templates*
*Completed: 2026-02-24*
