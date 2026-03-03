---
phase: 40-heldenkarte
plan: 01
subsystem: api
tags: [gamification, badges, prisma, api, profile]

# Dependency graph
requires:
  - phase: 33-gamification-schema
    provides: UserGameProfile model, QuestCompletion model, gamificationOptIn field
  - phase: 35-bossfight
    provides: BossTrophy type, trophies JSON field on UserGameProfile
  - phase: 39-item-shop-inventar
    provides: UserInventoryItem model, ShopItem model, SHOP_ITEM_CATALOG pattern
provides:
  - BADGE_CATALOG with 8 achievement badges (count, streak, trophy types)
  - evaluateBadges() service for lazy badge threshold evaluation
  - badges JSON field on UserGameProfile for persistent badge storage
  - GET /api/gamification/heldenkarte combined endpoint (profile + cosmetics + badges + quest history)
affects: [40-02 heldenkarte-ui, team-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [badge-catalog-pattern, lazy-badge-evaluation, combined-api-endpoint]

key-files:
  created:
    - src/lib/gamification/badge-catalog.ts
    - src/lib/gamification/badge-service.ts
    - src/app/api/gamification/heldenkarte/route.ts
    - prisma/migrations/manual_add_badges_field.sql
  modified:
    - prisma/schema.prisma

key-decisions:
  - "Separate badges JSON field on UserGameProfile (not trophies) for clean separation"
  - "KalenderEintrag badge uses verantwortlichId (not erstelltVonId) and erledigt Boolean (not status enum)"
  - "Lazy badge evaluation on page load via Promise.all for parallel threshold checks"
  - "Single combined endpoint returns profile, cosmetics, badges, and paginated quest history"

patterns-established:
  - "Badge catalog: static TypeScript array like SHOP_ITEM_CATALOG with threshold definitions"
  - "Badge evaluation: lazy on page load, persist-on-earn, never-revoke pattern"
  - "Special where markers (_aggregate, _sum, _distinct) for non-standard Prisma queries"

requirements-completed: [PROFIL-01, PROFIL-02, PROFIL-03]

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 40 Plan 01: Heldenkarte Backend Summary

**Badge catalog with 8 achievement badges, lazy evaluation service, and combined Heldenkarte API endpoint returning profile, cosmetics, badges, and paginated quest history**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T07:18:33Z
- **Completed:** 2026-03-03T07:21:25Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Badge system with 8 curated badges covering count, streak, and trophy evaluation modes
- evaluateBadges() with parallel Promise.all threshold checking and atomic persistence
- Combined GET /api/gamification/heldenkarte endpoint with auth + opt-in guard, returning profile data, equipped cosmetics, badge catalog with earned/locked status, and paginated quest history (20/page)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add badges JSON field + badge catalog + badge service** - `0141e66` (feat)
2. **Task 2: Heldenkarte API endpoint** - `1f2eef4` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added badges Json field to UserGameProfile
- `prisma/migrations/manual_add_badges_field.sql` - Manual ALTER TABLE for badges column
- `src/lib/gamification/badge-catalog.ts` - 8 badge definitions with threshold conditions
- `src/lib/gamification/badge-service.ts` - evaluateBadges() with parallel evaluation and persistence
- `src/app/api/gamification/heldenkarte/route.ts` - Combined GET endpoint with profile, cosmetics, badges, quest history

## Decisions Made
- Used separate `badges` JSON field on UserGameProfile instead of extending `trophies` -- clean separation between boss trophies and achievement badges
- Fixed KalenderEintrag badge query to use `verantwortlichId` (correct field) instead of plan's `erstelltVonId`, and `erledigt: true` (Boolean) instead of `status: "ERLEDIGT"` (nonexistent enum)
- Badge evaluation runs lazily on Heldenkarte page load -- no background evaluation yet
- Single combined API endpoint for all Heldenkarte data to avoid client-side waterfalls

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed KalenderEintrag badge query field names**
- **Found during:** Task 1 (badge-service.ts implementation)
- **Issue:** Plan specified `erstelltVonId` for KalenderEintrag user filtering, but model uses `verantwortlichId`. Plan also used `status: "ERLEDIGT"` but actual field is `erledigt` (Boolean).
- **Fix:** Used `verantwortlichId: userId` and `erledigt: true` in the where clause
- **Files modified:** src/lib/gamification/badge-service.ts, src/lib/gamification/badge-catalog.ts
- **Verification:** Prisma validates and generates successfully; TypeScript compilation passes
- **Committed in:** 0141e66 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential correction for badge evaluation to work against actual schema. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Heldenkarte API endpoint ready for Plan 02 UI consumption
- Badge catalog ready for badge showcase component
- Quest history pagination ready for prev/next navigation UI

## Self-Check: PASSED

All 5 files verified present. Both commit hashes (0141e66, 1f2eef4) confirmed in git log.

---
*Phase: 40-heldenkarte*
*Completed: 2026-03-03*
