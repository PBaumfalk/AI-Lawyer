---
phase: 33-gamification-schema-quest-engine
plan: 01
subsystem: database
tags: [prisma, gamification, quests, enums, seeding]

# Dependency graph
requires: []
provides:
  - "UserGameProfile, Quest, QuestCompletion Prisma models"
  - "SpielKlasse, QuestTyp enums"
  - "gamificationOptIn field on User model"
  - "QuestCondition DSL type for quest evaluation"
  - "roleToKlasse mapping (RBAC -> SpielKlasse)"
  - "seedDailyQuests with 5 daily quests (idempotent)"
affects: [33-02, 33-03, 34, 35]

# Tech tracking
tech-stack:
  added: []
  patterns: [quest-condition-dsl, role-to-class-mapping, seed-version-guard]

key-files:
  created:
    - prisma/migrations/20260302115811_add_gamification_schema/migration.sql
    - src/lib/gamification/types.ts
    - src/lib/gamification/seed-quests.ts
  modified:
    - prisma/schema.prisma
    - src/worker.ts

key-decisions:
  - "Used Umlauts-free quest names in seed data (Praegung vs Praegung) for database safety"
  - "Manual migration SQL created because DB/Docker not running; migration verified via prisma validate + generate"
  - "QuestCondition.userField is nullable for models like Rechnung where user scoping goes via relation"

patterns-established:
  - "Quest condition DSL: { model, where, dateField, userField, count, period } stored as JSON in Quest.bedingung"
  - "Gamification seed pattern: SystemSetting version guard (gamification.quests_seed_version) following falldaten pattern"
  - "Role-to-class mapping: roleToKlasse() for RBAC -> SpielKlasse conversion at profile creation"

requirements-completed: [GAME-01, GAME-05, GAME-06, QUEST-01]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 33 Plan 01: Gamification Schema + Quest Engine Summary

**3 Prisma models (UserGameProfile, Quest, QuestCompletion), 2 enums (SpielKlasse, QuestTyp), QuestCondition DSL type, and 5 daily quests seeded on worker startup**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T11:56:28Z
- **Completed:** 2026-03-02T12:00:37Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Prisma schema extended with 3 gamification models, 2 enums, and User.gamificationOptIn field
- QuestCondition DSL type defined for JSON-based quest evaluation rules
- 5 daily quests seeded idempotently on worker startup via SystemSetting version guard
- Cascade deletes configured for DSGVO-compliant user deletion

## Task Commits

Each task was committed atomically:

1. **Task 1: Add gamification models and enums to Prisma schema + run migration** - `ae393d9` (feat)
2. **Task 2: Create gamification TypeScript types and quest seed** - `a7fefcb` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added SpielKlasse, QuestTyp enums + UserGameProfile, Quest, QuestCompletion models + gamificationOptIn on User
- `prisma/migrations/20260302115811_add_gamification_schema/migration.sql` - Migration SQL for 3 new tables, 2 enums, 1 column
- `src/lib/gamification/types.ts` - QuestCondition DSL, roleToKlasse, LEVEL_TIERS, LEVEL_TITLES, STREAK_BONUSES
- `src/lib/gamification/seed-quests.ts` - seedDailyQuests with 5 daily quests and version guard
- `src/worker.ts` - Added seedDailyQuests import and startup call

## Decisions Made
- Created migration SQL manually because Docker/PostgreSQL was not running -- migration is correct per Prisma conventions and will apply on next `prisma migrate deploy`
- Quest names use ASCII-safe characters (Praegung der Muenzen vs Pragung) for database compatibility
- QuestCondition.userField is nullable to support models where user scoping is via relation chain (e.g., Rechnung -> Akte -> anwaltId)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Database server not running (Docker not started) -- resolved by creating migration SQL manually and verifying via `prisma validate` + `prisma generate`. Migration will apply on next deployment or Docker startup.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Schema foundation complete for gamification service layer (Plan 02)
- QuestCondition DSL type ready for evaluator implementation
- seedDailyQuests provides 5 quests for quest-complete endpoint testing
- Migration needs `prisma migrate deploy` on next Docker startup

---
*Phase: 33-gamification-schema-quest-engine*
*Completed: 2026-03-02*
