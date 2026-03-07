---
phase: 60-jlawyer-migration
plan: "02"
subsystem: database, api
tags: [prisma, jlawyer, etl, migration, typescript, upsert]

# Dependency graph
requires:
  - phase: 60-01
    provides: JLawyerClient, jlawyerId fields on Prisma models, TypeScript types
provides:
  - migrateAkten function with Sachgebiet and AkteStatus mapping
  - migrateKontakte function with jlawyerId and email deduplication
  - migrateBeteiligte function with BeteiligterRolle mapping
affects: [60-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Partial<JLawyerMigrationStats> return type for composable ETL functions
    - Array.from(map.entries()) pattern for safe Map iteration under strict tsconfig
    - Email fallback dedup pattern: findFirst by email where jlawyerId null, then update to claim

key-files:
  created:
    - src/lib/jlawyer/etl-akten.ts
    - src/lib/jlawyer/etl-kontakte.ts
  modified: []

key-decisions:
  - "mapSachgebiet uses case-insensitive substring matching (includes) rather than exact match for resilience against J-Lawyer label variations"
  - "Email fallback deduplication in migrateKontakte handles pre-existing contacts created before J-Lawyer migration without creating duplicates"
  - "migrateBeteiligte accepts pre-built Map params from the runner rather than re-querying DB, keeping ETL functions stateless and testable"
  - "Array.from(aktenMap.entries()) used instead of direct for-of on Map to satisfy TypeScript strict lib target requirements"

patterns-established:
  - "ETL composability pattern: each ETL function returns Pick<JLawyerMigrationStats, ...> so the runner can merge partial stats"
  - "Map parameter pattern for migrateBeteiligte: runner builds jlCaseId->Akte.id and jlContactId->Kontakt.id maps, passes them in"

requirements-completed: [MIG-02, MIG-03, MIG-04, MIG-07]

# Metrics
duration: 2min
completed: 2026-03-07
---

# Phase 60 Plan 02: ETL Akten, Kontakte, Beteiligte Summary

**Idempotent ETL pipeline for J-Lawyer cases, contacts, and participants using prisma.upsert by jlawyerId with email fallback deduplication and 7-role BeteiligterRolle mapping**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-07T04:50:21Z
- **Completed:** 2026-03-07T04:51:49Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- migrateAkten: maps all 10 Sachgebiet values and 4 AkteStatus values; generates placeholder aktenzeichen when J-Lawyer fileNumber is empty
- migrateKontakte: upserts by jlawyerId; email fallback deduplication for pre-existing native records; maps PERSON/ORGANIZATION to NATUERLICH/JURISTISCH
- migrateBeteiligte: upserts by compound unique (akteId, kontaktId, rolle); maps 7 J-Lawyer role strings to BeteiligterRolle enum; gracefully handles missing Kontakt in map

## Task Commits

Each task was committed atomically:

1. **Task 1: ETL for Akten** - `02a7fc0` (feat)
2. **Task 2: ETL for Kontakte and Beteiligte** - `828dd8d` (feat)

## Files Created/Modified
- `src/lib/jlawyer/etl-akten.ts` - migrateAkten with mapSachgebiet and mapAkteStatus helpers
- `src/lib/jlawyer/etl-kontakte.ts` - migrateKontakte with email fallback dedup, migrateBeteiligte with role mapping

## Decisions Made
- mapSachgebiet uses lowercase substring matching (`includes`) rather than exact string comparison for resilience against J-Lawyer label variations (e.g. "Familienrecht" and "Familie" both work)
- Email fallback deduplication: if a Kontakt without jlawyerId exists with the same email, update it to claim the jlawyerId rather than creating a duplicate
- migrateBeteiligte takes pre-built Maps from the runner to stay stateless and avoid redundant DB queries per participant
- `Array.from(aktenMap.entries())` required instead of direct for-of on Map to satisfy strict TypeScript ES target configuration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing `etl-dokumente.ts` (presumably created by plan 60-03 ahead of time) has a Map iteration TypeScript error unrelated to this plan's scope. Deferred.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- migrateAkten and migrateKontakte ready for integration into the migration runner (plan 60-03)
- Plan 60-03 must build the jlCaseId→Akte.id and jlContactId→Kontakt.id Maps after migrateAkten/migrateKontakte complete, then pass them to migrateBeteiligte and migrateDokumente

---
*Phase: 60-jlawyer-migration*
*Completed: 2026-03-07*
