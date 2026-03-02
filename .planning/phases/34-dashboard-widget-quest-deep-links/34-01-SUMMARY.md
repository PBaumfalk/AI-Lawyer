---
phase: 34-dashboard-widget-quest-deep-links
plan: 01
subsystem: ui
tags: [gamification, quest, dashboard, widget, xp-bar, deep-link, glass-ui]

# Dependency graph
requires:
  - phase: 33-gamification-schema-quest-engine
    provides: Quest schema, QuestCondition DSL, quest-evaluator, game-profile-service
provides:
  - Combined dashboard gamification API endpoint (profile + quests)
  - QuestWidget client component with XP bar and quest deep-link navigation
  - buildQuestDeepLink utility mapping QuestCondition to routes
  - XpProgressBar animated component
affects: [34-02, dashboard, gamification]

# Tech tracking
tech-stack:
  added: []
  patterns: [self-fetching widget with graceful degradation, absent-until-loaded pattern, convention-based deep-link mapping]

key-files:
  created:
    - src/app/api/gamification/dashboard/route.ts
    - src/components/gamification/quest-widget.tsx
    - src/components/gamification/xp-progress-bar.tsx
    - src/components/gamification/quest-deep-link.ts
  modified:
    - src/app/(dashboard)/dashboard/page.tsx

key-decisions:
  - "Widget uses absent-until-loaded pattern (returns null until fetch completes) to avoid layout shift"
  - "API returns 404 for opted-out users; widget treats 404 as opt-out signal and renders nothing"
  - "Deep-link builder uses static MODEL_TO_PATH lookup with URLSearchParams from condition.where"

patterns-established:
  - "Self-fetching gamification widget: fetch in useEffect, null on error/opt-out, no server-side check needed"
  - "Quest deep-link convention: QuestCondition.model maps to route, .where maps to query params, period=today adds datum=heute"

requirements-completed: [GAME-07, GAME-08, QUEST-08]

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 34 Plan 01: Dashboard Quest Widget Summary

**Self-fetching QuestWidget with animated XP bar, level/streak/Runen badges, quest checklist with deep-link navigation, integrated between KPI cards and Tagesuebersicht on dashboard**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-02T12:59:51Z
- **Completed:** 2026-03-02T13:02:24Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Combined gamification dashboard API that returns profile (level, XP, Runen, streak) and daily quest progress in one request
- QuestWidget client component with graceful degradation (returns null for opted-out users or on error)
- Animated XP progress bar using motion/react (same pattern as GlassKpiCard)
- Quest deep-link utility mapping all 5 seeded quest conditions to correct route paths with query params

## Task Commits

Each task was committed atomically:

1. **Task 1: Create combined dashboard API endpoint + deep-link utility** - `2d1a49b` (feat)
2. **Task 2: Create QuestWidget component with XP bar and integrate into dashboard** - `0eca7f7` (feat)

## Files Created/Modified
- `src/app/api/gamification/dashboard/route.ts` - Combined GET endpoint returning profile + quests JSON
- `src/components/gamification/quest-widget.tsx` - Self-fetching client widget with quest list and deep-link navigation
- `src/components/gamification/xp-progress-bar.tsx` - Animated XP bar with motion/react
- `src/components/gamification/quest-deep-link.ts` - buildQuestDeepLink utility mapping QuestCondition to routes
- `src/app/(dashboard)/dashboard/page.tsx` - Added QuestWidget import and placement between KPI cards and Tagesuebersicht

## Decisions Made
- Widget uses absent-until-loaded pattern (returns null until fetch completes) to avoid layout shift
- API returns 404 for opted-out users; widget treats 404 as opt-out signal and renders nothing
- Deep-link builder uses static MODEL_TO_PATH lookup with URLSearchParams from condition.where fields
- Quest evaluation and completion checks run in parallel per quest via Promise.all

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- QuestWidget is live on dashboard, ready for visual verification
- Plan 34-02 can build on this foundation (e.g., widget refinements, additional gamification UI)
- All gamification components are in src/components/gamification/ for easy discovery

## Self-Check: PASSED

All 5 created files verified on disk. Both task commits (2d1a49b, 0eca7f7) verified in git log.

---
*Phase: 34-dashboard-widget-quest-deep-links*
*Completed: 2026-03-02*
