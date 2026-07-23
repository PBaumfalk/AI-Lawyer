---
phase: 15-normen-verknuepfung-in-akte
plan: "01"
subsystem: api
tags: [prisma, nextjs, route-handlers, rbac, audit, law-chunks, akte-normen]

# Dependency graph
requires:
  - phase: 14-gesetze-rag
    provides: LawChunk table populated by gesetzeSyncWorker
  - phase: 12-rag-schema-foundation
    provides: AkteNorm model + akte_normen table

provides:
  - REST API for pinning law norms to Akten (GET, POST, DELETE)
  - ILIKE text search over law_chunks for the add-norm modal
  - Audit trail for NORM_VERKNUEPFT and NORM_ENTFERNT events

affects:
  - 15-02 (ki-chat Chain D reads AkteNorm table directly)
  - 15-03 (UI components call these endpoints)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - prisma.$queryRaw with safe template-literal parameter binding for ILIKE queries
    - requireAkteAccess RBAC pattern extended to normen resource
    - 409 Conflict for duplicate pinning attempts

key-files:
  created:
    - src/app/api/akten/[id]/normen/route.ts
    - src/app/api/akten/[id]/normen/search/route.ts
    - src/app/api/akten/[id]/normen/[normId]/route.ts
  modified:
    - src/lib/audit.ts

key-decisions:
  - "NORM_VERKNUEPFT and NORM_ENTFERNT added to AuditAktion union — required for type-safe audit logging"
  - "POST validates law_chunk existence before pinning — returns 404 if gesetzKuerzel+paragraphNr combo not found in DB"
  - "Search route returns LEFT(content, 300) to limit payload; full content only needed in chip detail view"
  - "Minimum q.length < 2 guard in search route prevents unnecessary full-table scans"

patterns-established:
  - "Norm search: prisma.$queryRaw template literal with safe interpolation for ILIKE on law_chunks"

requirements-completed:
  - GESETZ-04

# Metrics
duration: 4min
completed: 2026-02-27
---

# Phase 15 Plan 01: Normen-Verknuepfung API Summary

**Three Next.js route handlers powering AkteNorm CRUD: list/pin with 409 duplicate guard, ILIKE law_chunk search with LEFT(content,300) payload trimming, and RBAC-gated DELETE with audit logging**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-27T07:31:16Z
- **Completed:** 2026-02-27T07:35:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- GET /api/akten/[id]/normen returns pinned normen newest-first with addedBy user name
- POST /api/akten/[id]/normen validates law_chunk existence, checks duplicate, returns 201/404/409
- GET /api/akten/[id]/normen/search?q= runs safe ILIKE on law_chunks with 20-row limit and 300-char content trimming
- DELETE /api/akten/[id]/normen/[normId] removes pinned norm, returns 204, logs audit event
- Added NORM_VERKNUEPFT + NORM_ENTFERNT to AuditAktion union type in audit.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: AkteNorm list + add route (GET + POST)** - `b0fe1c1` (feat)
2. **Task 2: Norm search route + norm delete route** - `1452c68` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `src/app/api/akten/[id]/normen/route.ts` — GET (list) + POST (pin) for AkteNorm
- `src/app/api/akten/[id]/normen/search/route.ts` — ILIKE search over law_chunks for the modal
- `src/app/api/akten/[id]/normen/[normId]/route.ts` — DELETE for removing a pinned norm
- `src/lib/audit.ts` — Added NORM_VERKNUEPFT + NORM_ENTFERNT to AuditAktion union type and AKTION_LABELS

## Decisions Made

- Added `NORM_VERKNUEPFT` and `NORM_ENTFERNT` to the `AuditAktion` union type in `src/lib/audit.ts` — the existing `logAuditEvent` is strongly-typed and would reject string literals not in the union
- POST first checks law_chunk existence before duplicate check — returns 404 before 409 for cleaner error semantics
- Search uses `LEFT(content, 300)` in raw SQL to cap payload size; chip detail view can fetch full content separately
- Minimum query length of 2 characters prevents unintended full-table scans in production

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added NORM_VERKNUEPFT and NORM_ENTFERNT to AuditAktion**
- **Found during:** Task 1 (AkteNorm list + add route)
- **Issue:** `logAuditEvent` has a strongly-typed `aktion: AuditAktion` parameter; calling it with `"NORM_VERKNUEPFT"` would fail TypeScript compilation
- **Fix:** Added both new audit action strings to the `AuditAktion` union type and `AKTION_LABELS` map in `src/lib/audit.ts`
- **Files modified:** src/lib/audit.ts
- **Verification:** `npx tsc --noEmit` reports 0 errors
- **Committed in:** b0fe1c1 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical type registration)
**Impact on plan:** Required for TypeScript correctness. No scope creep.

## Issues Encountered

None - all three routes compiled cleanly on first attempt.

## User Setup Required

None - no external service configuration required. Routes use existing DB tables (akte_normen, law_chunks) created in Phase 12 and 14 migrations.

## Next Phase Readiness

- All three API endpoints ready for Plan 02 (ki-chat reads AkteNorm table) and Plan 03 (UI components)
- No blockers

## Self-Check: PASSED

All 3 route files created and verified present:
- src/app/api/akten/[id]/normen/route.ts — FOUND
- src/app/api/akten/[id]/normen/search/route.ts — FOUND
- src/app/api/akten/[id]/normen/[normId]/route.ts — FOUND

Commits verified:
- b0fe1c1 — FOUND (feat(15-01): add GET+POST handlers)
- 1452c68 — FOUND (feat(15-01): add norm search + delete route handlers)

TypeScript: 0 errors.

---
*Phase: 15-normen-verknuepfung-in-akte*
*Completed: 2026-02-27*
