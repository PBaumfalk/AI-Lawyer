---
phase: 08-integration-hardening
plan: 01
subsystem: auth
tags: [rbac, prisma, user-roles, migration, admin-ui]

# Dependency graph
requires:
  - phase: 07-rollen-sicherheit-compliance-observability
    provides: RBAC permission matrix, requireAkteAccess, sidebar role filtering
provides:
  - UserRole enum with 4 roles (ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT)
  - canSeeKanzleiFinanzen Boolean field on User model
  - Migration SQL for safe PRAKTIKANT removal
  - PATCH /api/admin/rollen for toggling canSeeKanzleiFinanzen
  - Admin UI checkbox for kanzlei-wide finance visibility
affects: [08-02-PLAN, 08-03-PLAN, finanzen-module]

# Tech tracking
tech-stack:
  added: []
  patterns: [optimistic-ui-toggle-with-revert, safe-enum-migration-pattern]

key-files:
  created:
    - prisma/migrations/20260225120000_remove_praktikant_add_kanzleifinanz/migration.sql
  modified:
    - prisma/schema.prisma
    - src/lib/rbac.ts
    - src/components/layout/sidebar.tsx
    - src/app/api/admin/rollen/route.ts
    - src/app/api/ki-entwuerfe/route.ts
    - src/app/api/finanzen/aktenkonto/[akteId]/route.ts
    - src/app/api/dokumente/[id]/route.ts
    - src/app/api/akten/route.ts
    - src/app/api/akten/[id]/dokumente/route.ts
    - src/app/(dashboard)/admin/rollen/page.tsx

key-decisions:
  - "PRAKTIKANT users converted to SACHBEARBEITER in migration (safe default role)"
  - "canSeeKanzleiFinanzen toggle only available for ANWALT role in admin UI"
  - "Optimistic UI with full state revert on error for finance toggle"
  - "beA routes left untouched (Plan 08-03 scope)"

patterns-established:
  - "Safe enum migration: UPDATE rows, CREATE new type, ALTER column, RENAME types, DROP old"
  - "Optimistic toggle: update local state, PATCH API, revert on error"

requirements-completed: [REQ-RS-001, REQ-RS-002, REQ-RS-003]

# Metrics
duration: 5min
completed: 2026-02-25
---

# Phase 08 Plan 01: Role Simplification Summary

**Removed PRAKTIKANT role (5 to 4 roles), added canSeeKanzleiFinanzen per-user flag with admin toggle UI**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-25T13:15:24Z
- **Completed:** 2026-02-25T13:20:24Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Simplified UserRole enum from 5 to 4 values (ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT)
- Created safe migration that converts PRAKTIKANT users to SACHBEARBEITER before removing enum value
- Added canSeeKanzleiFinanzen Boolean field to User model for per-ANWALT kanzlei-wide finance visibility
- Cleaned all PRAKTIKANT references from RBAC, sidebar, API routes, and admin UI
- Added PATCH endpoint and checkbox toggle in admin rollen page for canSeeKanzleiFinanzen

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove PRAKTIKANT from schema + migration + rbac.ts + ROLE_LABELS** - `a7ba92d` (feat)
2. **Task 2: Clean PRAKTIKANT references from sidebar + API routes + admin UI** - `ea6003d` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Removed PRAKTIKANT from UserRole enum, added canSeeKanzleiFinanzen to User model
- `prisma/migrations/20260225120000_remove_praktikant_add_kanzleifinanz/migration.sql` - Safe migration: UPDATE users, recreate enum, add column
- `src/lib/rbac.ts` - Removed PRAKTIKANT from PERMISSIONS and ROLE_LABELS, removed PRAKTIKANT edit check from requireAkteAccess
- `src/components/layout/sidebar.tsx` - Removed PRAKTIKANT-only hideForRoles, kept SEKRETARIAT on Einstellungen
- `src/app/api/admin/rollen/route.ts` - Removed PRAKTIKANT from roles array, added canSeeKanzleiFinanzen in user select, added PATCH endpoint
- `src/app/api/ki-entwuerfe/route.ts` - Updated comment (KI open to all roles)
- `src/app/api/finanzen/aktenkonto/[akteId]/route.ts` - Removed PRAKTIKANT read-only check, uses requireAkteAccess
- `src/app/api/dokumente/[id]/route.ts` - Updated comment on canLoeschen permission
- `src/app/api/akten/route.ts` - Updated comment on canCreateAkte permission
- `src/app/api/akten/[id]/dokumente/route.ts` - Updated comment on edit permission check
- `src/app/(dashboard)/admin/rollen/page.tsx` - Added canSeeKanzleiFinanzen checkbox for ANWALT users with optimistic toggle

## Decisions Made
- PRAKTIKANT users converted to SACHBEARBEITER in migration (closest matching role with basic permissions)
- canSeeKanzleiFinanzen toggle only shown for ANWALT users in admin UI (other roles don't need it)
- Optimistic UI with full state revert on error for the finance toggle
- beA routes intentionally left untouched -- Plan 08-03 handles beA-specific PRAKTIKANT references
- finanzen/aktenkonto/[akteId]/route.ts refactored to use requireAkteAccess instead of manual auth check (linter improvement accepted)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma client regeneration required**
- **Found during:** Task 1 (after schema change)
- **Issue:** TypeScript still referenced old UserRole type with PRAKTIKANT after schema edit
- **Fix:** Ran `npx prisma generate` to regenerate client types
- **Files modified:** node_modules/@prisma/client (generated)
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** N/A (generated code not committed)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Standard Prisma workflow -- regeneration always needed after schema changes. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- canSeeKanzleiFinanzen field ready for Plan 08-02 (Financial Access Control) to use
- All 4-role RBAC model consistent across codebase
- beA routes still reference PRAKTIKANT in comments -- Plan 08-03 will clean those

## Self-Check: PASSED

- FOUND: 08-01-SUMMARY.md
- FOUND: migration.sql
- FOUND: commit a7ba92d (Task 1)
- FOUND: commit ea6003d (Task 2)

---
*Phase: 08-integration-hardening*
*Completed: 2026-02-25*
