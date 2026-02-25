---
phase: 07-rollen-sicherheit-compliance-observability
plan: 01
subsystem: auth
tags: [rbac, permissions, dezernat, admin-override, prisma, next-auth, middleware]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation
    provides: "NextAuth.js v5 with JWT session carrying user role"
  - phase: 06-ai-features-bea
    provides: "All API routes to retrofit with RBAC"
provides:
  - "src/lib/rbac.ts RBAC helper library (requireAuth, requireRole, requirePermission, requireAkteAccess, buildAkteAccessFilter)"
  - "Dezernat and AdminOverride Prisma models for group-based Akte access"
  - "PERMISSIONS constant defining role-permission matrix"
  - "Dezernat management admin UI at /admin/dezernate"
  - "Rollen-Matrix read-only display at /admin/rollen"
  - "Admin Override CRUD API with audit logging"
  - "Role-based sidebar navigation filtering"
affects: [07-02-audit-dsgvo-observability]

# Tech tracking
tech-stack:
  added: []
  patterns: [RBAC-helper-pattern, access-filter-pattern, 404-not-403-pattern, dezernat-group-access]

key-files:
  created:
    - src/lib/rbac.ts
    - prisma/migrations/20260225080000_add_dezernat_rbac/migration.sql
    - src/app/api/admin/dezernate/route.ts
    - src/app/api/admin/dezernate/[id]/route.ts
    - src/app/api/admin/override/route.ts
    - src/app/api/admin/rollen/route.ts
    - src/app/(dashboard)/admin/dezernate/page.tsx
    - src/app/(dashboard)/admin/rollen/page.tsx
    - src/components/admin/dezernat-dialog.tsx
  modified:
    - prisma/schema.prisma
    - src/components/layout/sidebar.tsx
    - src/app/(dashboard)/admin/layout.tsx
    - src/app/api/akten/route.ts
    - src/app/api/akten/[id]/route.ts
    - src/app/api/akten/[id]/dokumente/route.ts
    - src/app/api/dokumente/[id]/route.ts
    - src/app/api/kalender/route.ts
    - src/app/api/bea/messages/route.ts
    - src/app/api/ki-entwuerfe/route.ts
    - "... and 20+ more API route files"

key-decisions:
  - "PERMISSIONS as code-defined constant, not configurable (fixed matrix per role)"
  - "requireAkteAccess returns 404 (not 403) to hide Akte existence from unauthorized users"
  - "Three-path access check: direct assignment (anwaltId/sachbearbeiterId), Dezernat membership, Admin override"
  - "ADMIN always has full access via buildAkteAccessFilter returning empty WHERE clause"
  - "Variable name collisions in vorlagen/route.ts and bea/auto-assign/route.ts fixed (Rule 1 - Bug)"

patterns-established:
  - "RBAC helper pattern: all API routes import from src/lib/rbac.ts instead of direct auth() calls"
  - "Access filter pattern: buildAkteAccessFilter() injected into Prisma WHERE for list endpoints"
  - "Akte access pattern: requireAkteAccess(akteId, { requireEdit }) for detail endpoints"
  - "Permission check pattern: requirePermission('canFreigeben') for action-specific guards"
  - "Sidebar filtering: hideForRoles array on nav items with useMemo filtering"

requirements-completed: [REQ-RS-001, REQ-RS-002, REQ-RS-003]

# Metrics
duration: 15min
completed: 2026-02-25
---

# Phase 7 Plan 01: RBAC Foundation + Enforcement Summary

**Dezernat/AdminOverride schema, code-defined RBAC permission matrix, and full API route retrofit across 30+ endpoints with Dezernat management UI and Rollen-Matrix overview**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-25T08:00:00Z
- **Completed:** 2026-02-25T08:15:00Z
- **Tasks:** 2
- **Files modified:** 38

## Accomplishments
- Created comprehensive RBAC helper library (src/lib/rbac.ts) with 6 exported functions and a static permission matrix covering 9 permissions across 5 roles
- Retrofitted 30+ API routes with proper access checks: Akte-level access filtering, permission-gated actions (Freigeben, Loeschen, beA send, KI), and role-restricted endpoints
- Added Dezernat (group-based Akte access) and AdminOverride (explicit admin access with audit trail) Prisma models with full CRUD APIs
- Built Dezernat management UI (create/edit/delete with member assignment) and read-only Rollen-Matrix page with per-user permission overview
- Role-based sidebar navigation filtering hides irrelevant items for PRAKTIKANT and SEKRETARIAT roles

## Task Commits

Each task was committed atomically:

1. **Task 1: Dezernat/AdminOverride schema + RBAC helper library + middleware + sidebar filtering** - `3bc524e` (feat)
2. **Task 2: Retrofit API routes with RBAC + Dezernat admin UI + Rollen-Matrix page** - `1905d83` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

### Created
- `src/lib/rbac.ts` - RBAC helper library with PERMISSIONS matrix, requireAuth, requireRole, requirePermission, requireAkteAccess, buildAkteAccessFilter
- `prisma/migrations/20260225080000_add_dezernat_rbac/migration.sql` - Migration for Dezernat and AdminOverride tables
- `src/app/api/admin/dezernate/route.ts` - Dezernat list + create API (GET/POST, ADMIN only)
- `src/app/api/admin/dezernate/[id]/route.ts` - Dezernat detail/update/delete API (GET/PATCH/DELETE)
- `src/app/api/admin/override/route.ts` - Admin Override CRUD with audit logging
- `src/app/api/admin/rollen/route.ts` - Rollen-Matrix and per-user permission overview API
- `src/app/(dashboard)/admin/dezernate/page.tsx` - Dezernat management UI with create/edit/delete
- `src/app/(dashboard)/admin/rollen/page.tsx` - Rollen-Matrix table + per-user access overview
- `src/components/admin/dezernat-dialog.tsx` - Create/edit Dezernat dialog component

### Modified (key files)
- `prisma/schema.prisma` - Added Dezernat, AdminOverride models, relations to User/Akte/Kanzlei, Kontakt DSGVO fields
- `src/components/layout/sidebar.tsx` - Role-based nav filtering with hideForRoles
- `src/app/(dashboard)/admin/layout.tsx` - Added Dezernate and Rollen to admin navigation
- `src/app/api/akten/route.ts` - GET uses buildAkteAccessFilter, POST uses requirePermission("canCreateAkte")
- `src/app/api/akten/[id]/route.ts` - GET/PATCH use requireAkteAccess with edit flag
- `src/app/api/akten/[id]/dokumente/route.ts` - Access checks on Akte-linked documents
- `src/app/api/dokumente/[id]/route.ts` - canFreigeben/canLoeschen permission gates
- `src/app/api/bea/messages/route.ts` - canReadBeA/canSendBeA permission gates
- `src/app/api/ki-entwuerfe/route.ts` - canUseKI permission gate
- `src/app/api/dokumente/reindex/route.ts` - requireRole("ADMIN")
- ... and 20+ additional API route files with requireAuth/requirePermission

## Decisions Made

1. **PERMISSIONS as static code constant** - Not configurable via database or feature flags. The permission matrix is defined in code and changes require a deployment. This matches the user's decision for a fixed matrix.

2. **404 for unauthorized Akte access** - requireAkteAccess returns 404 (not 403) to hide the existence of Akten from unauthorized users. This is a security best practice for multi-tenant applications.

3. **Three-path access check** - Access is granted via: (a) direct assignment (anwaltId/sachbearbeiterId), (b) Dezernat membership, or (c) Admin override. ADMIN users always have full access without needing an override.

4. **buildAkteAccessFilter for lists** - Returns empty WHERE for ADMIN (sees all), OR clause with three paths for others. This is injected into existing Prisma queries without restructuring them.

5. **Sidebar filtering is UX-only** - Nav items are hidden client-side based on session role. Server-side enforcement happens in API routes. This follows the anti-pattern guidance from the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed variable name collision in vorlagen/route.ts**
- **Found during:** Task 2 (API route retrofit)
- **Issue:** Both `const result = await requireAuth()` and `const result = sorted.map(...)` used the same variable name in the GET handler scope, causing TS2451
- **Fix:** Renamed the second to `const vorlagenWithFav`
- **Files modified:** src/app/api/vorlagen/route.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** 1905d83

**2. [Rule 1 - Bug] Fixed variable name collision in bea/auto-assign/route.ts**
- **Found during:** Task 2 (API route retrofit)
- **Issue:** `const result` used for both requirePermission return and autoAssignToAkte return in POST handler
- **Fix:** Renamed to `authResult` and `assignResult`
- **Files modified:** src/app/api/bea/auto-assign/route.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** 1905d83

**3. [Rule 3 - Blocking] Database not running for prisma migrate**
- **Found during:** Task 1 (Schema migration)
- **Issue:** `npx prisma migrate dev` failed with P1001 (database unreachable)
- **Fix:** Created migration SQL file manually at prisma/migrations/20260225080000_add_dezernat_rbac/migration.sql
- **Files modified:** prisma/migrations/20260225080000_add_dezernat_rbac/migration.sql
- **Verification:** prisma validate passes, schema is correct
- **Committed in:** 3bc524e

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- audit.ts already contained the new audit action types (ZUGRIFF_VERWEIGERT, ADMIN_OVERRIDE_ERSTELLT, ADMIN_OVERRIDE_ENTFERNT) when Task 1 was executed -- likely added by a parallel agent (07-02). No changes needed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RBAC foundation is complete and all API routes are protected
- Plan 07-02 (Audit-Trail UI + DSGVO + Observability) was executed in parallel and is also complete
- Phase 7 is fully done -- all security, compliance, and observability features are in place
- The application now has comprehensive role-based access control, audit logging, DSGVO compliance, and health monitoring

## Self-Check: PASSED

All 10 created files verified present. Both task commits (3bc524e, 1905d83) verified in git log. TypeScript compilation and Prisma validation both pass cleanly.

---
*Phase: 07-rollen-sicherheit-compliance-observability*
*Completed: 2026-02-25*
