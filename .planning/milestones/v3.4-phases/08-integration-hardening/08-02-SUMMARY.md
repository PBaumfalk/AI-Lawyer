---
phase: 08-integration-hardening
plan: 02
subsystem: api, ui
tags: [rbac, prisma, finance, kpi, access-filter, dashboard]

# Dependency graph
requires:
  - phase: 05-financial-module
    provides: Finance API routes (rechnungen, aktenkonto, zeiterfassung, buchungsperioden, kostenstellen)
  - phase: 07-rollen-sicherheit-compliance-observability
    provides: buildAkteAccessFilter, requireAuth, requireRole, requireAkteAccess helpers in rbac.ts
  - phase: 08-integration-hardening (plan 01)
    provides: canSeeKanzleiFinanzen field on User model, PRAKTIKANT removal
provides:
  - Finance routes with Akte-level RBAC access filtering
  - Dashboard with user-scoped Prisma queries
  - Finance KPI key alignment (API stats key matches frontend)
  - Role-based KPI visibility (SEKRETARIAT/SACHBEARBEITER operative only, ADMIN/ANWALT all)
  - Cross-case aktenkonto fremdgeldAlerts in response
  - gesamtUmsatz (BEZAHLT sum) calculation in rechnungen API
affects: [finance-ui, dashboard, admin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Finance route RBAC: canSeeKanzleiFinanzen lookup -> showKanzleiweit -> buildAkteAccessFilter or empty"
    - "Nested Akte filter on finance models: where.akte = accessFilter"
    - "Single-record endpoints: requireAkteAccess(rechnung.akteId) after lookup"
    - "Aggregate queries reuse same where clause as list queries"

key-files:
  created: []
  modified:
    - src/app/api/finanzen/rechnungen/route.ts
    - src/app/api/finanzen/rechnungen/[id]/route.ts
    - src/app/api/finanzen/aktenkonto/route.ts
    - src/app/api/finanzen/aktenkonto/[akteId]/route.ts
    - src/app/api/finanzen/zeiterfassung/route.ts
    - src/app/api/finanzen/buchungsperioden/route.ts
    - src/app/api/finanzen/kostenstellen/route.ts
    - src/app/(dashboard)/dashboard/page.tsx
    - src/app/(dashboard)/finanzen/page.tsx

key-decisions:
  - "Fix API to match frontend (stats key) rather than changing frontend consumption code"
  - "Provide both stats and summary keys in rechnungen response for backward compatibility"
  - "Fremdgeld alerts computed per-Akte from FREMDGELD bookings with negative saldo detection"
  - "Dashboard access filter applied to akte relation for KalenderEintrag queries"

patterns-established:
  - "Finance RBAC pattern: ADMIN always kanzleiweit, ANWALT conditional on canSeeKanzleiFinanzen, others scoped"
  - "Role-based KPI visibility: canSeeAllKpis = ADMIN || ANWALT, operative KPIs for all"

requirements-completed: [REQ-FI-003, REQ-FI-005, REQ-FI-006]

# Metrics
duration: 8min
completed: 2026-02-25
---

# Phase 8 Plan 2: Finance + Dashboard RBAC Summary

**buildAkteAccessFilter wired into all 7 finance routes and dashboard, KPI keys aligned, role-based KPI visibility for SEKRETARIAT/SACHBEARBEITER vs ADMIN/ANWALT**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-25T13:14:55Z
- **Completed:** 2026-02-25T13:23:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- All finance list routes (rechnungen, aktenkonto, zeiterfassung) now use buildAkteAccessFilter for Akte-level access filtering
- Single-record endpoints (rechnungen/[id], aktenkonto/[akteId]) use requireAkteAccess for per-invoice/per-case authorization
- Dashboard page queries are user-scoped (offene Akten, Fristen, Wiedervorlagen, letzte Akten all filtered by accessible Akten)
- Finance KPI cards display correct data (API response keys match frontend consumption: stats.gesamtUmsatz, stats.offeneForderungen, stats.ueberfaellig)
- SEKRETARIAT/SACHBEARBEITER see only operative KPIs (offene Forderungen, ueberfaellige Rechnungen, Fremdgeld-Warnungen)
- ADMIN/ANWALT see all KPIs including Gesamtumsatz
- Cross-case aktenkonto now includes fremdgeldAlerts in response
- Buchungsperioden and Kostenstellen routes use requireRole('ADMIN') for write operations

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire buildAkteAccessFilter to all finance routes** - `3af5dce` (feat)
2. **Task 2: Dashboard RBAC + Finance KPI key fix + role-based KPI visibility** - `31b725a` (feat)

## Files Created/Modified
- `src/app/api/finanzen/rechnungen/route.ts` - Added Akte access filter, canSeeKanzleiFinanzen, gesamtUmsatz calc, stats key
- `src/app/api/finanzen/rechnungen/[id]/route.ts` - Added requireAkteAccess on GET/PATCH/DELETE
- `src/app/api/finanzen/aktenkonto/route.ts` - Added Akte access filter, fremdgeldAlerts response
- `src/app/api/finanzen/aktenkonto/[akteId]/route.ts` - Replaced raw auth() with requireAkteAccess
- `src/app/api/finanzen/zeiterfassung/route.ts` - Added Akte access filter on GET, requireAkteAccess on POST/PATCH
- `src/app/api/finanzen/buchungsperioden/route.ts` - Switched to requireAuth/requireRole from rbac.ts
- `src/app/api/finanzen/kostenstellen/route.ts` - Switched to requireAuth/requireRole from rbac.ts
- `src/app/(dashboard)/dashboard/page.tsx` - All Prisma queries now user-scoped with buildAkteAccessFilter
- `src/app/(dashboard)/finanzen/page.tsx` - Fixed API key reading, added role-based KPI visibility with useSession

## Decisions Made
- Fixed API to match frontend expectations (added stats key alongside summary for backward compatibility) rather than changing frontend consumption code -- less risky, preserves existing integrations
- gesamtUmsatz calculated as sum of BEZAHLT invoices' betragNetto (not GESTELLT)
- FremdgeldAlerts computed by grouping FREMDGELD bookings per Akte and detecting negative saldo
- Dashboard access filter applied directly to akte relation for KalenderEintrag queries (not akteId field)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Finance RBAC enforcement complete -- ready for Plan 03 (Versand-Gate, beA audit logging, etc.)
- All existing pre-existing TypeScript errors (beA messages route, akte-detail-tabs) are unrelated and unchanged

## Self-Check: PASSED

All 9 modified files verified present. Both task commits (3af5dce, 31b725a) verified in git log.

---
*Phase: 08-integration-hardening*
*Completed: 2026-02-25*
