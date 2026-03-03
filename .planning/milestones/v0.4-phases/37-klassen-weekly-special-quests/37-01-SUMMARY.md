---
phase: 37-klassen-weekly-special-quests
plan: 01
subsystem: gamification
tags: [prisma, bullmq, quest-dsl, delta-evaluator, weekly-snapshot, class-filtering]

# Dependency graph
requires:
  - phase: 33-gamification-foundation
    provides: Quest model, QuestCondition DSL, evaluator, seed, BullMQ crons
  - phase: 35-bossfight
    provides: Boss engine integration in gamification processor
provides:
  - Quest.klasse field for class-based quest filtering
  - WeeklySnapshot model for delta condition baselines
  - CountCondition | DeltaCondition union type (backward compat)
  - evaluateDeltaCondition() for weekly aggregate quests
  - createWeeklySnapshots() Monday cron for baseline creation
  - Grouped dashboard API response { daily, weekly, special }
  - ~15 class-specific daily quests + 3 weekly quests seed
affects: [37-02 frontend widget sections, 37-02 special quest admin CRUD]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "QuestCondition union type with backward-compat type? discriminator"
    - "WeeklySnapshot baseline model for delta quest evaluation"
    - "Type-aware dedup: DAILY=startOfDay, WEEKLY=startOfWeek, SPECIAL=startDatum"
    - "Grouped API response shape for widget sections"

key-files:
  created:
    - src/lib/gamification/weekly-snapshot.ts
    - prisma/migrations/manual_quest_klasse_weekly_snapshot.sql
  modified:
    - prisma/schema.prisma
    - src/lib/gamification/types.ts
    - src/lib/gamification/quest-evaluator.ts
    - src/lib/gamification/quest-service.ts
    - src/lib/gamification/seed-quests.ts
    - src/lib/queue/queues.ts
    - src/lib/queue/processors/gamification.processor.ts
    - src/app/api/gamification/dashboard/route.ts
    - src/components/gamification/quest-widget.tsx

key-decisions:
  - "QuestCondition union type with optional type? field for backward compat (existing quests treated as count)"
  - "WeeklySnapshot model with compound unique (model, weekStart, userId) for delta baselines"
  - "Dashboard API returns grouped quests { daily, weekly, special } instead of flat array"
  - "Widget temporarily flattens grouped response; Plan 02 adds proper section headers"

patterns-established:
  - "Delta condition evaluation: snapshot lookup + current count comparison"
  - "Class-filtered quest loading: OR [klasse=null, klasse=userKlasse]"
  - "Campaign period: custom date range passed to evaluator for SPECIAL quests"

requirements-completed: [QUEST-04, QUEST-05]

# Metrics
duration: 6min
completed: 2026-03-02
---

# Phase 37 Plan 01: Klassen + Weekly + Special Quests Backend Summary

**Class-filtered quest loading, weekly delta evaluator with WeeklySnapshot baselines, grouped dashboard API, and 18-quest seed pool (15 daily + 3 weekly)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-02T19:49:59Z
- **Completed:** 2026-03-02T19:56:02Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Quest model extended with klasse (SpielKlasse?), startDatum, endDatum fields + WeeklySnapshot model
- QuestCondition refactored into CountCondition | DeltaCondition union with full backward compatibility
- Quest service evaluates ALL quest types (DAILY, WEEKLY, SPECIAL) with klasse filtering and type-aware dedup
- Seed expanded from 5 to 18 quests: 2 universal daily + 12 class-specific daily (3 per SpielKlasse) + 3 weekly quests
- Dashboard API returns grouped quests { daily, weekly, special } for widget section rendering
- Monday 00:00 cron creates WeeklySnapshot baselines for Ticket and KalenderEintrag

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration + types + delta evaluator + weekly snapshot** - `ae22531` (feat)
2. **Task 2: Quest service klasse filtering + weekly dedup + cron + seed + dashboard API** - `25590ae` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Quest.klasse, startDatum, endDatum fields + WeeklySnapshot model
- `prisma/migrations/manual_quest_klasse_weekly_snapshot.sql` - Manual migration SQL
- `src/lib/gamification/types.ts` - CountCondition | DeltaCondition union, campaign QuestPeriod
- `src/lib/gamification/quest-evaluator.ts` - Delta evaluator with snapshot lookup, campaign date range
- `src/lib/gamification/weekly-snapshot.ts` - createWeeklySnapshots() for Monday cron
- `src/lib/gamification/quest-service.ts` - Klasse filtering, all quest types, type-aware dedup
- `src/lib/gamification/seed-quests.ts` - 15 daily + 3 weekly quests, SEED_VERSION v0.4.1
- `src/lib/queue/queues.ts` - Weekly snapshot cron at Monday 00:00
- `src/lib/queue/processors/gamification.processor.ts` - weekly-snapshot job handler
- `src/app/api/gamification/dashboard/route.ts` - Grouped response { daily, weekly, special }
- `src/components/gamification/quest-widget.tsx` - Adapted for grouped API response

## Decisions Made
- QuestCondition union type with optional `type?` field ensures existing quests (no type field) still evaluate as "count"
- WeeklySnapshot uses compound unique constraint (model, weekStart, userId) for efficient delta lookups
- Dashboard API changes response shape from flat array to grouped object; widget updated to flatten for now
- Existing 5 daily quests reassigned: 2 universal (Chroniken, Skriptorium) + 3 class-specific (Siegel->JURIST, Muenzen->SCHREIBER, Bote->WAECHTER)
- Delta quests evaluate open-item count (not date-scoped) against Monday baseline snapshot

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated quest-widget.tsx for new API response shape**
- **Found during:** Task 2 (Dashboard API grouping)
- **Issue:** API response changed from `quests: DashboardQuest[]` to `quests: { daily, weekly, special }`, widget would crash
- **Fix:** Updated DashboardData type and temporarily flatten grouped quests for rendering; Plan 02 adds proper section headers
- **Files modified:** src/components/gamification/quest-widget.tsx
- **Verification:** TypeScript compiles without errors
- **Committed in:** 25590ae (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix to prevent runtime crash from API shape change. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend fully ready for Plan 02 (frontend widget sections, special quest admin CRUD)
- Grouped API response enables widget section rendering with headers
- Manual migration SQL ready to apply on next deploy
- Weekly snapshot cron will create baselines automatically on first Monday after deploy

## Self-Check: PASSED

All 11 files verified present. Both task commits (ae22531, 25590ae) verified in git log.

---
*Phase: 37-klassen-weekly-special-quests*
*Completed: 2026-03-02*
