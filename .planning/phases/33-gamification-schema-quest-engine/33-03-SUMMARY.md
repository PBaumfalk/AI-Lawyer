---
phase: 33-gamification-schema-quest-engine
plan: 03
subsystem: queue, api, gamification
tags: [bullmq, cron, gamification, quest, fire-and-forget, worker]

# Dependency graph
requires:
  - phase: 33-01
    provides: "Prisma schema (Quest, QuestCompletion, UserGameProfile, gamificationOptIn)"
  - phase: 33-02
    provides: "checkQuestsForUser, enqueueQuestCheck, quest-evaluator, game-profile-service"
provides:
  - "BullMQ gamification queue with quest-check, daily-reset, nightly-safety-net job types"
  - "Gamification processor handling all three job types"
  - "Daily reset cron (00:05) and nightly safety-net cron (23:55) via upsertJobScheduler"
  - "enqueueQuestCheck upgraded to BullMQ queue.add() with hourly dedup"
  - "Business route hooks in kalender, tickets, rechnungen calling enqueueQuestCheck"
affects: [37-weekly-quests, 35-bossfight]

# Tech tracking
tech-stack:
  added: []
  patterns: ["BullMQ gamification queue with idempotent quest evaluation (attempts:1)", "Hourly dedup via jobId pattern for fire-and-forget quest checks"]

key-files:
  created:
    - src/lib/queue/processors/gamification.processor.ts
  modified:
    - src/lib/queue/queues.ts
    - src/worker.ts
    - src/lib/gamification/quest-service.ts
    - src/app/api/kalender/[id]/route.ts
    - src/app/api/tickets/[id]/route.ts
    - src/app/api/finanzen/rechnungen/route.ts

key-decisions:
  - "Gamification queue uses attempts:1 (idempotent, no retry needed)"
  - "Hourly dedup via jobId prevents redundant quest checks per user"
  - "Daily reset is no-op placeholder for Phase 37 weekly quest rotation"
  - "Nightly safety net evaluates all opted-in users sequentially (not parallel) for simplicity"

patterns-established:
  - "Fire-and-forget quest hook pattern: enqueueQuestCheck(userId) after business DB write, never awaited"
  - "BullMQ dedup via jobId template: quest-check-{userId}-{hourSlice}"

requirements-completed: [QUEST-03, QUEST-07]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 33 Plan 03: BullMQ Queue + Crons + Route Hooks Summary

**BullMQ gamification queue with quest-check/daily-reset/nightly-safety-net processors, hourly-dedup enqueueQuestCheck, and 3 business route hooks**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T12:13:48Z
- **Completed:** 2026-03-02T12:18:12Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- BullMQ gamification queue registered with attempts:1 (idempotent, no retry) and added to ALL_QUEUES for Bull Board
- Processor handles quest-check (single user), daily-reset (no-op placeholder), and nightly-safety-net (all opted-in users with streak finalization)
- Daily reset cron at 00:05 and nightly safety-net cron at 23:55 Europe/Berlin via upsertJobScheduler
- enqueueQuestCheck upgraded from direct .catch() to BullMQ queue.add() with hourly dedup per user
- Three business API routes hooked: Frist erledigt (kalender), Ticket/WV ERLEDIGT (tickets), Rechnung create (rechnungen)
- All hooks are fire-and-forget -- never block the business API response

## Task Commits

Each task was committed atomically:

1. **Task 1: Create gamification queue, processor, and cron registration** - `9f7c55b` (feat)
2. **Task 2: Wire gamification into worker + upgrade enqueueQuestCheck + hook business routes** - `01f6f7c` (feat)

**Plan metadata:** (pending) (docs: complete plan)

## Files Created/Modified
- `src/lib/queue/processors/gamification.processor.ts` - BullMQ processor handling quest-check, daily-reset, nightly-safety-net
- `src/lib/queue/queues.ts` - GamificationJobData interface, gamificationQueue definition, registerGamificationCrons export
- `src/worker.ts` - Gamification worker registration + cron startup + queue list update
- `src/lib/gamification/quest-service.ts` - enqueueQuestCheck upgraded to BullMQ queue.add() with hourly dedup
- `src/app/api/kalender/[id]/route.ts` - enqueueQuestCheck hook after Frist marked erledigt
- `src/app/api/tickets/[id]/route.ts` - enqueueQuestCheck hook after Ticket/WV marked ERLEDIGT
- `src/app/api/finanzen/rechnungen/route.ts` - enqueueQuestCheck hook after Rechnung creation

## Decisions Made
- Gamification queue uses attempts:1 because quest evaluation is idempotent (checkQuestsForUser has built-in dedup via QuestCompletion check for today)
- Hourly dedup via jobId (`quest-check-{userId}-{YYYY-MM-DDTHH}`) prevents redundant queue jobs from multiple business actions within the same hour
- Daily reset cron is a no-op placeholder -- quests are static in Phase 33, will be extended in Phase 37 for weekly quest rotation
- Nightly safety net processes users sequentially (not in parallel batches) for simplicity -- the user count is expected to be small (kanzlei-scale: <50 users)
- Rechnungen route path was `src/app/api/finanzen/rechnungen/route.ts` (not `src/app/api/rechnungen/route.ts` as listed in plan)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected Rechnungen route path**
- **Found during:** Task 2 (Hook business routes)
- **Issue:** Plan referenced `src/app/api/rechnungen/route.ts` which does not exist; actual path is `src/app/api/finanzen/rechnungen/route.ts`
- **Fix:** Used the correct path for the Rechnung creation hook
- **Files modified:** src/app/api/finanzen/rechnungen/route.ts
- **Verification:** TypeScript compiles cleanly, import resolves
- **Committed in:** 01f6f7c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Path correction only, no scope change. Hook behavior matches plan exactly.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 33 is complete: schema (Plan 01) + business logic (Plan 02) + async queue wiring (Plan 03)
- Gamification engine is fully functional with opt-in check, quest evaluation, XP/Runen awards, streak tracking, and nightly safety net
- Ready for Phase 34 (Gamification UI) to build the frontend displaying quest progress, XP bars, and streak indicators

## Self-Check: PASSED

All created files verified to exist. All commit hashes (9f7c55b, 01f6f7c) verified in git log.

---
*Phase: 33-gamification-schema-quest-engine*
*Completed: 2026-03-02*
