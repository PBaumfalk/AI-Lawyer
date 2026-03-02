---
phase: 38-anti-missbrauch
plan: 01
subsystem: gamification
tags: [redis, prisma, anti-abuse, rate-limiting, transactions]

# Dependency graph
requires:
  - phase: 33-gamification-schema
    provides: Quest + QuestCompletion models, quest-evaluator, quest-service
  - phase: 35-bossfight
    provides: Boss engine pattern with atomic Prisma transactions
provides:
  - AuditStatus enum and QuestCompletion audit fields (pendingXp, pendingRunen, auditStatus, completedDate)
  - Redis-based daily Runen cap module (checkAndRecordRunenCap, getDailyRunenUsed)
  - Atomic $transaction for quest completions (XP+Runen+record in one tx)
  - Qualified WV completion validation (30+ char erledigungsgrund)
  - Follow-up WV bonus (+5 Runen)
  - P2002 idempotent concurrent completion handling
  - Dashboard cap indicator data (dailyRunenUsed, dailyRunenCap)
  - gamification.daily_runen_cap SystemSetting (admin-configurable, default 40)
affects: [38-02-PLAN, item-shop, team-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [redis-incr-expire-daily-cap, prisma-transaction-atomic-rewards, p2002-idempotent-catch, findmany-js-filter-string-length]

key-files:
  created:
    - prisma/migrations/manual_anti_missbrauch.sql
    - src/lib/gamification/runen-cap.ts
  modified:
    - prisma/schema.prisma
    - src/lib/gamification/types.ts
    - src/lib/settings/defaults.ts
    - src/lib/gamification/quest-evaluator.ts
    - src/lib/gamification/quest-service.ts
    - src/app/api/gamification/dashboard/route.ts
    - src/components/gamification/quest-widget.tsx

key-decisions:
  - "Redis INCR+EXPIRE pattern for daily Runen cap (mirrors rate-limiter.ts, fail-open on Redis unavailability)"
  - "findMany + JS filter for WV 30+ char check (Prisma lacks string length WHERE clause)"
  - "Runen cap applied to WV quests only (non-WV quests uncapped)"
  - "P2002 catch for concurrent completions -- idempotent no-op instead of error"
  - "completedDate (DATE-only) replaces completedAt for unique constraint (tighter daily dedup)"
  - "Follow-up WV bonus uses verantwortlichId + createdAt (not erstelltVon which does not exist on model)"

patterns-established:
  - "Redis daily cap: INCR+EXPIRE with fail-open, configurable via SystemSetting"
  - "Atomic quest rewards: prisma.$transaction wrapping profile update + completion create"
  - "P2002 idempotent catch: concurrent quest completions silently skipped"

requirements-completed: [ABUSE-01, ABUSE-02, ABUSE-04]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 38 Plan 01: Anti-Missbrauch Core Summary

**Daily Runen cap via Redis INCR+EXPIRE, qualified WV completion (30+ char Vermerk), atomic $transaction for quest rewards, and P2002 idempotent concurrent handling**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T22:04:53Z
- **Completed:** 2026-03-02T22:09:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- WV quest completions now require 30+ char erledigungsgrund (prevents gaming with empty/trivial notes)
- Daily Runen cap (default 40) enforced via Redis for WV quests only, admin-configurable
- All quest completions use prisma.$transaction for atomic XP/Runen + completion recording
- Concurrent quest completions handled gracefully via P2002 unique constraint catch
- Dashboard widget shows cap indicator at 80%+ daily Runen usage
- Follow-up WV bonus (+5 Runen) incentivizes creating new Wiedervorlagen after completing old ones

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration + Runen cap module + settings default** - `78594a6` (feat)
2. **Task 2: Harden quest evaluator + service + dashboard API + widget cap indicator** - `56f7dfa` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - AuditStatus enum, QuestCompletion fields (completedDate, pendingXp, pendingRunen, auditStatus)
- `prisma/migrations/manual_anti_missbrauch.sql` - Idempotent migration SQL with enum, columns, backfill, constraint swap
- `src/lib/gamification/runen-cap.ts` - Redis INCR+EXPIRE daily Runen cap module (checkAndRecordRunenCap, getDailyRunenUsed)
- `src/lib/gamification/types.ts` - AuditStatusType, FOLLOW_UP_WV_BONUS_RUNEN constant
- `src/lib/settings/defaults.ts` - gamification.daily_runen_cap setting (default 40, range 10-200)
- `src/lib/gamification/quest-evaluator.ts` - WV qualified completion check (findMany + 30+ char JS filter)
- `src/lib/gamification/quest-service.ts` - Atomic $transaction, Runen cap enforcement, follow-up bonus, P2002 catch
- `src/app/api/gamification/dashboard/route.ts` - dailyRunenUsed/dailyRunenCap in profile response, completedDate dedup
- `src/components/gamification/quest-widget.tsx` - Cap indicator UI at 80%+ daily usage

## Decisions Made
- Redis INCR+EXPIRE pattern for daily Runen cap (mirrors rate-limiter.ts, fail-open on Redis unavailability)
- findMany + JS filter for WV 30+ char check (Prisma lacks string length WHERE clause)
- Runen cap applied to WV quests only (non-WV quests uncapped)
- P2002 catch for concurrent completions -- idempotent no-op instead of error
- completedDate (DATE-only) replaces completedAt for unique constraint (tighter daily dedup)
- Follow-up WV bonus uses verantwortlichId + createdAt (plan specified erstelltVon which does not exist on KalenderEintrag model)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed follow-up WV bonus field names**
- **Found during:** Task 2 (quest-service.ts)
- **Issue:** Plan specified `erstelltVon` and `erstelltAm` fields which do not exist on KalenderEintrag model
- **Fix:** Used `verantwortlichId` (user scope) and `createdAt` (date scope) which are the correct field names
- **Files modified:** src/lib/gamification/quest-service.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 56f7dfa (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correct field references. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Anti-Missbrauch core is complete, ready for Plan 02 (audit system, admin review UI)
- AuditStatus enum and pending fields are in place but `needsAudit` is hardcoded to `false` -- Plan 02 will wire the audit trigger logic
- Migration SQL must be applied to database before deployment

---
*Phase: 38-anti-missbrauch*
*Completed: 2026-03-02*
