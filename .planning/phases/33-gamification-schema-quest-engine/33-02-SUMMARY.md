---
phase: 33-gamification-schema-quest-engine
plan: 02
subsystem: api
tags: [gamification, xp, level, runen, streak, quest-evaluator, quest-service, prisma, fire-and-forget]

# Dependency graph
requires:
  - phase: 33-01
    provides: "UserGameProfile, Quest, QuestCompletion Prisma models; QuestCondition DSL type; roleToKlasse; LEVEL_TIERS/TITLES/STREAK_BONUSES constants"
provides:
  - "getRequiredXp/getLevelForXp/getLevelTitle/getStreakMultiplier pure functions"
  - "getOrCreateGameProfile with lazy creation and role-to-class mapping"
  - "awardRewards with atomic Prisma increment for XP and Runen"
  - "calculateStreak with workday awareness (weekends, holidays, vacation)"
  - "evaluateQuestCondition DSL evaluator against Prisma COUNT queries"
  - "checkQuestsForUser orchestrator with dedup and reward awarding"
  - "enqueueQuestCheck fire-and-forget entry point for business routes"
  - "GET /api/gamification/profile self-only GameProfile endpoint"
affects: [33-03, 34, 35]

# Tech tracking
tech-stack:
  added: []
  patterns: [quest-dsl-evaluator, model-dispatch-switch, fire-and-forget-quest-check, atomic-xp-runen-increment, workday-aware-streak]

key-files:
  created:
    - src/lib/gamification/game-profile-service.ts
    - src/lib/gamification/quest-evaluator.ts
    - src/lib/gamification/quest-service.ts
    - src/app/api/gamification/profile/route.ts
    - src/lib/gamification/__tests__/game-profile-service.test.ts
  modified: []

key-decisions:
  - "gamificationOptIn queried from DB in API route (not session token) since auth.ts does not expose it"
  - "enqueueQuestCheck uses direct .catch() fallback until Plan 03 wires BullMQ queue"
  - "Streak multiplier applied to Runen only (not XP) per CONTEXT.md specification"

patterns-established:
  - "Quest DSL evaluator: model dispatch switch + date range + user scoping via Prisma COUNT"
  - "Fire-and-forget quest check: enqueueQuestCheck wraps checkQuestsForUser in .catch()"
  - "Atomic increment: awardRewards uses prisma.update({ data: { xp: { increment }, runen: { increment } } })"
  - "Workday-aware streak: walks backward through days, skips weekends/holidays/vacation"
  - "Self-only API: profile endpoint returns only requesting user's data (DSGVO)"

requirements-completed: [GAME-02, GAME-03, GAME-04, QUEST-02, QUEST-03]

# Metrics
duration: 5min
completed: 2026-03-02
---

# Phase 33 Plan 02: Quest Engine Business Logic Summary

**XP/Level/Runen/Streak game engine with tiered progression, workday-aware streaks, quest DSL evaluator against Prisma data, fire-and-forget orchestrator, and self-only profile API**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-02T12:03:22Z
- **Completed:** 2026-03-02T12:08:45Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Pure game math functions with 31 passing tests (getRequiredXp, getLevelForXp, getLevelTitle, getStreakMultiplier)
- Quest condition DSL evaluator translating JSON conditions into Prisma COUNT queries with model dispatch, date-range filtering, and user scoping
- Quest check orchestrator with daily dedup via QuestCompletion check and atomic XP/Runen awarding
- Workday-aware streak calculation using feiertagejs holidays, weekends, and UrlaubZeitraum vacation
- DSGVO-compliant self-only profile API endpoint

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for pure functions** - `be2ead2` (test)
2. **Task 1 GREEN: GameProfile service implementation** - `81bffa0` (feat)
3. **Task 2: Quest evaluator, quest service, profile API** - `49f4ced` (feat)

## Files Created/Modified
- `src/lib/gamification/game-profile-service.ts` - XP/Level/Runen/Streak calculation + GameProfile CRUD + atomic rewards
- `src/lib/gamification/quest-evaluator.ts` - QuestCondition DSL to Prisma COUNT with model dispatch and date-range filtering
- `src/lib/gamification/quest-service.ts` - Quest check orchestrator with dedup + enqueueQuestCheck fire-and-forget
- `src/app/api/gamification/profile/route.ts` - GET /api/gamification/profile self-only endpoint
- `src/lib/gamification/__tests__/game-profile-service.test.ts` - 31 tests for pure game math functions

## Decisions Made
- Queried `gamificationOptIn` from DB in API route instead of relying on session token, since auth.ts does not include it in JWT/session callbacks
- Implemented `enqueueQuestCheck` as direct `.catch()` wrapper (not BullMQ) since the BullMQ queue will be created in Plan 03
- Streak multiplier applied to Runen only per CONTEXT.md locked decision

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed gamificationOptIn access in API route**
- **Found during:** Task 2 (API route implementation)
- **Issue:** Plan referenced `session.user.gamificationOptIn` but auth.ts does not expose this field in the session token
- **Fix:** Query `prisma.user.findUnique({ select: { gamificationOptIn: true } })` directly from DB
- **Files modified:** src/app/api/gamification/profile/route.ts
- **Verification:** TypeScript compiles cleanly, no type errors
- **Committed in:** 49f4ced (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correctness. No scope creep.

## Issues Encountered
None - all implementations followed established codebase patterns.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Game engine complete: XP, Level, Runen, Streak all functional
- Quest evaluator ready to evaluate all 5 seeded daily quests
- enqueueQuestCheck ready to be called from business routes
- Profile API ready for Phase 34 UI consumption
- Plan 03 will wire BullMQ queue, crons, and hook business routes

## Self-Check: PASSED

All 5 created files verified on disk. All 3 commits (be2ead2, 81bffa0, 49f4ced) found in git log.

---
*Phase: 33-gamification-schema-quest-engine*
*Completed: 2026-03-02*
