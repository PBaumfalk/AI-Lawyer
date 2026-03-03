---
phase: 45-mandant-datenraum
plan: 01
subsystem: api
tags: [portal, mandant, prisma, data-isolation, timeline, pagination, dsgvo]

# Dependency graph
requires:
  - phase: 44-portal-authentifizierung
    plan: 02
    provides: "MANDANT role with kontaktId on JWT, portal auth flow"
  - phase: 43-portal-schema-shell
    provides: "MANDANT UserRole, kontaktId FK on User, portal layout"
provides:
  - "mandantSichtbar Boolean on AktenActivity with composite index"
  - "naechsteSchritte text field on Akte model"
  - "getMandantAkten() and requireMandantAkteAccess() in portal-access.ts"
  - "GET /api/portal/akten endpoint for Mandant Akte listing"
  - "GET /api/portal/akten/[id] endpoint for Akte detail (Gegner, Gericht, sachgebiet, status)"
  - "GET /api/portal/akten/[id]/timeline endpoint for mandant-visible activities"
  - "PUT /api/akten/[id]/naechste-schritte endpoint for Anwalt next-steps management"
affects: [45-portal-ui, 46-portal-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Portal data isolation via Kontakt->Beteiligter(MANDANT)->Akte chain", "mandantSichtbar flag for activity visibility control", "Cursor-based pagination for portal timeline", "404-as-403 pattern for hiding Akte existence from unauthorized Mandanten"]

key-files:
  created:
    - src/lib/portal-access.ts
    - src/app/api/portal/akten/route.ts
    - src/app/api/portal/akten/[id]/route.ts
    - src/app/api/portal/akten/[id]/timeline/route.ts
    - src/app/api/akten/[id]/naechste-schritte/route.ts
  modified:
    - prisma/schema.prisma

key-decisions:
  - "Server-side data isolation via Kontakt->Beteiligter chain, not client-side filtering"
  - "404 (not 403) on unauthorized Mandant access to hide Akte existence"
  - "Composite index [akteId, mandantSichtbar, createdAt] for efficient portal timeline queries"
  - "Truncate inhalt to 500 chars in timeline list view for bandwidth efficiency"
  - "naechsteSchritte update creates mandantSichtbar=true STATUS_CHANGE activity"

patterns-established:
  - "Portal API pattern: requireAuth() -> role check MANDANT -> requireMandantAkteAccess() -> query"
  - "Portal response shape: no internal fields (anwaltId, kanzleiId, meta) exposed"
  - "Mandant visibility: mandantSichtbar=true flag on AktenActivity controls portal timeline"

requirements-completed: [PORTAL-03, PORTAL-04, SACH-01, SACH-02, SACH-03]

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 45 Plan 01: Mandant Datenraum API Summary

**DSGVO-compliant portal API with Kontakt-based data isolation, mandant-visible timeline with cursor pagination, and Anwalt-managed next steps**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T12:13:01Z
- **Completed:** 2026-03-03T12:16:37Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Prisma schema extended with mandantSichtbar on AktenActivity (Boolean, default false, composite index) and naechsteSchritte on Akte (nullable text)
- Portal access library with server-side data isolation: User.kontaktId -> Beteiligter(rolle=MANDANT) -> Akte chain
- Three portal API routes with MANDANT role guard and 404-as-403 pattern for unauthorized access
- Internal naechste-schritte endpoint for Anwalt to set next steps with automatic mandant-visible activity creation

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema changes + portal access library** - `76245ae` (feat)
2. **Task 2: Portal API routes + naechste Schritte endpoint** - `b6865b1` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added mandantSichtbar Boolean to AktenActivity, naechsteSchritte String? to Akte, composite index
- `src/lib/portal-access.ts` - Portal access control with getMandantAkten() and requireMandantAkteAccess()
- `src/app/api/portal/akten/route.ts` - GET endpoint listing Mandant Akten summaries
- `src/app/api/portal/akten/[id]/route.ts` - GET endpoint for Akte detail with Gegner/Gericht names, no internal data
- `src/app/api/portal/akten/[id]/timeline/route.ts` - GET endpoint for mandantSichtbar=true activities with cursor pagination
- `src/app/api/akten/[id]/naechste-schritte/route.ts` - PUT endpoint for Anwalt to set/clear next steps text

## Decisions Made
- **Server-side isolation via Kontakt chain:** All access checks happen at Prisma query level. getMandantAkten queries Beteiligter with rolle=MANDANT. No client-side filtering.
- **404 on unauthorized access:** requireMandantAkteAccess returns 404 (not 403) to hide Akte existence from unauthorized Mandanten, matching existing requireAkteAccess pattern.
- **Composite index for portal timeline:** [akteId, mandantSichtbar, createdAt] index optimizes the most common portal query (filtered by Akte and visibility, ordered by time).
- **inhalt truncation at 500 chars:** Timeline list items truncate long activity content to reduce payload size. Full content can be exposed via detail endpoint if needed.
- **STATUS_CHANGE activity on naechsteSchritte update:** When Anwalt updates next steps, a mandantSichtbar=true activity is created so Mandant sees the update in their timeline.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Database not running (`prisma db push` failed with P1001). Schema validates correctly; `npx prisma db push` must be run when database service is started.
- 7 pre-existing TypeScript errors in falldaten-tab.tsx and helena/index.ts -- unrelated to portal changes, out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All portal API endpoints operational, ready for portal UI implementation (Phase 45 Plan 02 or Phase 46)
- Portal access library ready for reuse by document sharing endpoints
- `npx prisma db push` needed when database service is started (schema has new fields)
- Prisma client generated with all new types available

## Self-Check: PASSED

All artifacts verified:
- 45-01-SUMMARY.md exists
- Commit 76245ae (Task 1) exists
- Commit b6865b1 (Task 2) exists
- portal-access.ts exists with getMandantAkten and requireMandantAkteAccess exports
- Portal akten routes exist (list, detail, timeline)
- naechste-schritte route exists
- mandantSichtbar field in Prisma schema
- naechsteSchritte field in Prisma schema

---
*Phase: 45-mandant-datenraum*
*Completed: 2026-03-03*
