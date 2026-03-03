---
phase: 35-bossfight
plan: 01
subsystem: gamification
tags: [prisma, bossfight, socket.io, bullmq, api, game-engine]

# Dependency graph
requires:
  - phase: 33-gamification-schema-quest-engine
    provides: UserGameProfile, Quest, QuestCompletion, gamification queue, game-profile-service
  - phase: 34-dashboard-widget
    provides: Dashboard widget pattern, opt-in toggle, deep-links
provides:
  - Bossfight + BossfightDamage Prisma models with BossfightStatus enum
  - Boss engine service (spawn, damage, heal, phase transitions, defeat, rewards)
  - Boss constants (names, phases, multipliers, thresholds)
  - GET /api/gamification/bossfight (active boss state or teaser)
  - GET/PATCH /api/gamification/bossfight/admin (admin config)
  - Queue jobs for boss-damage, boss-heal, boss-check
  - Socket.IO kanzlei room auto-join for team-wide broadcasts
  - Boss event emission (boss:spawned, boss:damage, boss:phase-change, boss:defeated, boss:heal)
  - Admin-configurable boss threshold and cooldown settings
  - Trophy system (BossTrophy type + awardTrophy function)
affects: [35-02-bossfight-ui, 37-weekly-quests, team-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [atomic-hp-mutation, phase-transition-bitmask, kanzlei-room-broadcast, fire-and-forget-queue-hooks]

key-files:
  created:
    - src/lib/gamification/boss-engine.ts
    - src/lib/gamification/boss-constants.ts
    - src/app/api/gamification/bossfight/route.ts
    - src/app/api/gamification/bossfight/admin/route.ts
    - prisma/migrations/manual_bossfight_schema.sql
  modified:
    - prisma/schema.prisma
    - src/lib/gamification/types.ts
    - src/lib/gamification/game-profile-service.ts
    - src/lib/settings/defaults.ts
    - src/lib/socket/rooms.ts
    - src/lib/queue/queues.ts
    - src/lib/queue/processors/gamification.processor.ts
    - src/app/api/kalender/[id]/erledigt/route.ts
    - src/app/api/kalender/route.ts

key-decisions:
  - "Boss HP mutations use Prisma $transaction with atomic decrement/increment to prevent race conditions"
  - "Phase transition rewards tracked via bitmask (phaseRewardsGiven) to prevent duplicate awards"
  - "Kanzlei room (kanzlei:{kanzleiId}) used for team-wide broadcasts instead of role-based rooms"
  - "Victory rewards use fire-and-forget pattern consistent with existing quest check hooks"
  - "Boss spawn check runs both in nightly cron AND on-demand after new WV creation"

patterns-established:
  - "Kanzlei room pattern: auto-join kanzlei:{kanzleiId} on Socket.IO connect for team-wide events"
  - "Boss engine transaction pattern: check-then-create inside $transaction for spawn, re-read for damage"
  - "Phase bitmask pattern: phaseRewardsGiven tracks awarded phases via bitwise OR"

requirements-completed: [BOSS-01, BOSS-02, BOSS-04]

# Metrics
duration: 14min
completed: 2026-03-02
---

# Phase 35 Plan 01: Bossfight Engine Summary

**Bossfight data model, engine state machine, API routes, queue jobs, and route hooks for team Backlog-Monster mechanic with atomic HP mutations and Socket.IO kanzlei-room broadcasts**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-02T15:20:12Z
- **Completed:** 2026-03-02T15:34:12Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Bossfight + BossfightDamage Prisma models with full lifecycle support (spawn -> damage/heal -> phase transitions -> defeat -> rewards)
- Boss engine with atomic HP mutations inside $transaction, preventing race conditions from concurrent WV clears
- Only ONE active boss per kanzlei enforced by check-then-create in transaction
- Phase transitions (75%/50%/25% HP thresholds) with escalating Runen multipliers (1x/1.5x/2x/3x) and team-wide bonuses
- Victory awards Legendary trophy + XP/Runen bonus to ALL participants
- Socket.IO kanzlei room auto-join + boss event broadcasts (spawned, damage, phase-change, defeated, heal)
- Admin-configurable threshold and cooldown via SystemSetting
- Automatic boss spawn in nightly cron + on-demand after new WV creation

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema + boss constants + trophies + kanzlei room + admin settings** - `57332b8` (feat)
2. **Task 2: Boss engine service + queue integration + API routes + route hooks** - `1147e85` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added BossfightStatus enum, Bossfight + BossfightDamage models, trophies field, reverse relations
- `src/lib/gamification/boss-constants.ts` - Boss names, phase thresholds, Runen multipliers, calculatePhase function
- `src/lib/gamification/boss-engine.ts` - Core state machine: spawn, damage, heal, phase transitions, defeat, victory rewards
- `src/lib/gamification/types.ts` - BossTrophy interface
- `src/lib/gamification/game-profile-service.ts` - awardTrophy function for boss victory trophies
- `src/lib/settings/defaults.ts` - gamification.boss.threshold and cooldownHours admin settings
- `src/lib/socket/rooms.ts` - kanzlei:{kanzleiId} room auto-join for team-wide broadcasts
- `src/lib/queue/queues.ts` - Extended GamificationJobData with kanzleiId and userName
- `src/lib/queue/processors/gamification.processor.ts` - boss-damage, boss-heal, boss-check handlers + nightly spawn check
- `src/app/api/gamification/bossfight/route.ts` - GET endpoint for boss state or teaser
- `src/app/api/gamification/bossfight/admin/route.ts` - GET/PATCH for admin boss config (ADMIN only)
- `src/app/api/kalender/[id]/erledigt/route.ts` - Hook boss damage on WV erledigt
- `src/app/api/kalender/route.ts` - Hook boss heal + spawn check on new WV creation
- `prisma/migrations/manual_bossfight_schema.sql` - Manual migration for bossfight tables

## Decisions Made
- Used Prisma `$transaction` with atomic `decrement`/`increment` for all HP mutations to prevent race conditions from concurrent WV clears
- Tracked phase transition rewards via bitmask (`phaseRewardsGiven`) to prevent duplicate awards on redundant phase checks
- Chose `kanzlei:{kanzleiId}` room for team-wide broadcasts (more precise than role-based rooms, supports multi-kanzlei setups)
- Boss spawn runs both in nightly cron AND on-demand after new WV creation (dual trigger for responsiveness)
- Victory rewards use fire-and-forget pattern consistent with existing quest check hooks
- Manual migration SQL created (Docker not running) -- apply on next deploy

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required. Manual migration SQL at `prisma/migrations/manual_bossfight_schema.sql` should be applied on next deploy.

## Next Phase Readiness
- Boss engine is complete and ready for UI consumption (Plan 02)
- API endpoints serve both active boss state and teaser data
- Socket.IO events ready for real-time UI updates
- All constants (phase icons, boss names, multipliers) exported for UI components

## Self-Check: PASSED

- All 14 files verified present
- Both task commits verified (57332b8, 1147e85)
- Prisma client generates successfully
- No new TypeScript errors introduced (all errors pre-existing)

---
*Phase: 35-bossfight*
*Completed: 2026-03-02*
