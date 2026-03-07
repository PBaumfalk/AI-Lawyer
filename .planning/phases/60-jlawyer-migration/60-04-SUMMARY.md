---
phase: 60-jlawyer-migration
plan: "04"
subsystem: api
tags: [nextjs, prisma, jlawyer, migration, etl, admin]

# Dependency graph
requires:
  - phase: 60-02
    provides: ETL functions (etl-akten, etl-kontakte, etl-dokumente, etl-kalender)
  - phase: 60-03
    provides: ETL functions for documents and calendar
provides:
  - Admin API surface for J-Lawyer connection config (GET/POST /api/admin/jlawyer)
  - Admin API for connectivity test (POST /api/admin/jlawyer/test)
  - Admin API for migration trigger and status (GET/POST /api/admin/jlawyer/migrate)
  - etl-akten returns aktenMap (jlCaseId -> Akte.id)
  - etl-kontakte returns kontakteMap (jlContactId -> Kontakt.id)
affects:
  - phase-60-05 (Admin UI that calls these routes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - requireRole("ADMIN") guard on all admin routes
    - SystemSetting upsert pattern for key/value config storage
    - Migration status tracking via SystemSetting keys
    - ETL pipeline returns Maps for downstream use in same migration run

key-files:
  created:
    - src/app/api/admin/jlawyer/route.ts
    - src/app/api/admin/jlawyer/test/route.ts
    - src/app/api/admin/jlawyer/migrate/route.ts
  modified:
    - src/lib/jlawyer/etl-akten.ts
    - src/lib/jlawyer/etl-kontakte.ts

key-decisions:
  - "ETL pipeline runs synchronously in POST /api/admin/jlawyer/migrate (no background jobs — admin one-shot operation)"
  - "Concurrent migration prevention via 409 when jlawyer.migration.status=running"
  - "etl-akten and etl-kontakte return Maps alongside stats using spread return pattern"
  - "Test route accepts optional body credentials for testing before saving (falls back to stored)"

patterns-established:
  - "ETL map return pattern: { ...stats, aktenMap } for stateless testability with runner wiring"
  - "Migration status state machine: idle -> running -> done/error (stored in SystemSetting)"

requirements-completed:
  - MIG-01
  - MIG-08

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 60 Plan 04: Admin API Routes for J-Lawyer Migration Summary

**Three Next.js admin API route files providing CRUD config, connectivity test, and full ETL pipeline trigger with status/report retrieval for J-Lawyer migration**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-07T04:53:56Z
- **Completed:** 2026-03-07T04:59:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- GET /api/admin/jlawyer returns {url, username, hasPassword} (password masked, stored in SystemSetting)
- POST /api/admin/jlawyer saves j-lawyer credentials; POST /api/admin/jlawyer/test validates connectivity
- POST /api/admin/jlawyer/migrate runs full ETL pipeline (akten -> kontakte -> beteiligte -> dokumente -> kalender) and returns aggregated JLawyerMigrationStats
- GET /api/admin/jlawyer/migrate returns migration status, timestamps, and final report
- etl-akten.ts and etl-kontakte.ts updated to return Maps alongside stats for pipeline wiring

## Task Commits

Each task was committed atomically:

1. **Task 1: Connection config and test routes** - `3cef9cf` (feat)
2. **Task 2: Migration trigger and status/report route** - `89a2c86` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/app/api/admin/jlawyer/route.ts` - GET/POST for connection credentials stored in SystemSetting
- `src/app/api/admin/jlawyer/test/route.ts` - POST endpoint to test J-Lawyer connectivity (body or stored creds)
- `src/app/api/admin/jlawyer/migrate/route.ts` - GET status/report, POST triggers full ETL pipeline
- `src/lib/jlawyer/etl-akten.ts` - Updated return type to include aktenMap (jlCaseId -> Akte.id)
- `src/lib/jlawyer/etl-kontakte.ts` - Updated return type to include kontakteMap (jlContactId -> Kontakt.id)

## Decisions Made
- ETL pipeline runs synchronously in the POST route — no background jobs needed for an admin one-shot migration
- 409 Conflict returned if POST /migrate called while status=running to prevent concurrent runs
- Test route accepts optional override credentials in request body, falls back to stored settings
- etl-akten and etl-kontakte use `{ ...stats, map }` spread return pattern for backward compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three API routes are ready for the Admin UI (Plan 05) to call
- Migration can be triggered via POST /api/admin/jlawyer/migrate after credentials are saved
- Status polling available via GET /api/admin/jlawyer/migrate

---
*Phase: 60-jlawyer-migration*
*Completed: 2026-03-07*
