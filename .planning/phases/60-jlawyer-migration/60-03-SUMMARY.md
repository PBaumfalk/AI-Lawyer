---
phase: 60-jlawyer-migration
plan: "03"
subsystem: api
tags: [jlawyer, migration, etl, minio, s3, prisma, kalender, dokumente]

requires:
  - phase: 60-01
    provides: JLawyerClient with getCaseDocuments, downloadDocument, getCaseCalendar; jlawyerId fields on Prisma models

provides:
  - migrateDokumente function — downloads binaries, uploads to MinIO, creates Dokument records
  - migrateKalender function — creates/updates KalenderEintrag rows for TERMIN/FRIST/WIEDERVORLAGE

affects: [60-04-run-script, 60-migration-orchestrator]

tech-stack:
  added: []
  patterns:
    - "Array.from(map.entries()) for Map iteration compatibility with TypeScript default target"
    - "Binary upload to MinIO at akten/{akteId}/jlawyer/{docId}_{safeName} path convention"
    - "findFirst by jlawyerId for idempotent upsert on models without @unique constraint"

key-files:
  created:
    - src/lib/jlawyer/etl-dokumente.ts
    - src/lib/jlawyer/etl-kalender.ts
  modified: []

key-decisions:
  - "Use Array.from(aktenMap.entries()) instead of direct Map for...of iteration — TypeScript target compatibility"
  - "KalenderEintrag idempotency uses findFirst+update/create (not upsert) because jlawyerId is @@index not @unique"
  - "MinIO path: akten/{akteId}/jlawyer/{docId}_{safeName} — prefixed with doc.id for uniqueness"

patterns-established:
  - "ETL idempotency: findFirst by jlawyerId, skip/update if found, create if not"
  - "Per-record try/catch with errors array — individual failures do not abort the batch"
  - "systemUserId passed as parameter — caller resolves from DB before calling ETL"

requirements-completed: [MIG-05, MIG-06, MIG-07]

duration: 2min
completed: 2026-03-07
---

# Phase 60 Plan 03: ETL Dokumente and Kalender Summary

**MinIO binary upload for migrated documents and idempotent KalenderEintrag migration for Termine/Fristen/Wiedervorlagen via findFirst upsert pattern**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-07T05:50:24Z
- **Completed:** 2026-03-07T05:52:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `migrateDokumente` downloads each document binary via J-Lawyer REST API, uploads to MinIO at `akten/{akteId}/jlawyer/{docId}_{name}`, and creates a Dokument DB record with jlawyerId for idempotent re-runs
- `migrateKalender` maps J-Lawyer calendar types (APPOINTMENT/DEADLINE/FOLLOW_UP) to Prisma enum (TERMIN/FRIST/WIEDERVORLAGE) and creates/updates KalenderEintrag rows; on re-run it updates mutable fields for existing entries found by jlawyerId
- Both ETL functions use per-record try/catch with error accumulation — individual failures do not abort the batch

## Task Commits

Each task was committed atomically:

1. **Task 1: ETL for Dokumente with MinIO upload** - `b6f5b91` (feat)
2. **Task 2: ETL for Kalendereintraege, Fristen, and Wiedervorlagen** - `f78e2b0` (feat)

## Files Created/Modified

- `src/lib/jlawyer/etl-dokumente.ts` - migrateDokumente: iterates aktenMap, downloads binaries, uploads to MinIO, creates Dokument records; idempotent via jlawyerId skip
- `src/lib/jlawyer/etl-kalender.ts` - migrateKalender: fetches case calendar, maps types, findFirst+update/create for idempotency; covers Termine, Fristen, Wiedervorlagen

## Decisions Made

- Used `Array.from(aktenMap.entries())` instead of direct `for...of` on Map — TypeScript without explicit `target` in tsconfig defaults to ES3, which doesn't support Map iteration without `--downlevelIteration`
- KalenderEintrag idempotency uses `findFirst` + conditional `update`/`create` instead of `upsert` — jlawyerId is `@@index` (not `@unique`), so `upsert`'s `where` clause would not work; `findFirst` is the correct pattern
- MinIO path uses `{docId}_{safeName}` to ensure filename uniqueness across documents with identical names in the same case

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Map iteration TypeScript error**
- **Found during:** Task 1 (ETL for Dokumente)
- **Issue:** `for (const [k, v] of aktenMap)` fails with TS2802 when TypeScript target is below ES2015 — the tsconfig has no `target` set (defaults to ES3/ES5)
- **Fix:** Changed `for (const [jlCaseId, akteId] of aktenMap)` to `for (const [jlCaseId, akteId] of Array.from(aktenMap.entries()))` in both ETL files
- **Files modified:** src/lib/jlawyer/etl-dokumente.ts, src/lib/jlawyer/etl-kalender.ts
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** b6f5b91, f78e2b0 (task commits)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug fix)
**Impact on plan:** Required for TypeScript compilation. No scope creep.

## Issues Encountered

None beyond the TypeScript Map iteration issue (auto-fixed above).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Both ETL functions ready to be wired into the migration orchestrator/run script
- aktenMap parameter must be built by the caller (from 60-01/60-02 ETL results) before calling these functions
- systemUserId must be resolved from DB before calling either function

---
*Phase: 60-jlawyer-migration*
*Completed: 2026-03-07*
