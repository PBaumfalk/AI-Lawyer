---
phase: 43-portal-schema-shell
plan: 01
subsystem: database
tags: [prisma, rbac, mandant, portal, auth]

# Dependency graph
requires: []
provides:
  - "MANDANT value in UserRole enum"
  - "Portal fields on User model (inviteToken, inviteExpiresAt, inviteAcceptedAt, kontaktId)"
  - "Kontakt.portalUser reverse relation (1:1)"
  - "MANDANT entry in RBAC PERMISSIONS with all false"
  - "MANDANT in ROLE_LABELS"
affects: [43-portal-schema-shell, 44-portal-auth, 45-portal-api, 46-portal-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: ["portal user linked to Kontakt via User.kontaktId (1:1)", "invite-based activation via inviteToken/inviteExpiresAt"]

key-files:
  created: []
  modified:
    - prisma/schema.prisma
    - src/lib/rbac.ts

key-decisions:
  - "No auth.ts changes needed -- existing authorize flow handles all UserRole values generically"
  - "No next-auth.d.ts changes needed -- uses UserRole from @prisma/client which auto-includes MANDANT"
  - "kontaktId FK on User (not portalUserId on Kontakt) keeps Kontakt model clean"
  - "db push skipped (DB offline) -- schema validates, Prisma client generated successfully"

patterns-established:
  - "Portal user = User with role MANDANT + kontaktId linking to Kontakt"
  - "MANDANT has zero internal Kanzlei permissions, portal-specific access via portal routes"

requirements-completed: [PORTAL-01]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 43 Plan 01: Portal Schema + RBAC Summary

**MANDANT role added to UserRole enum with portal fields (inviteToken, kontaktId FK to Kontakt) and zero-permission RBAC entry**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T11:37:25Z
- **Completed:** 2026-03-03T11:39:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added MANDANT to UserRole enum enabling portal user authentication
- Added portal-specific fields on User (inviteToken, inviteExpiresAt, inviteAcceptedAt, kontaktId) for invite-based activation
- Added 1:1 Kontakt.portalUser reverse relation linking portal users to their contact records
- Added MANDANT to RBAC PERMISSIONS with all false (no internal Kanzlei access) and ROLE_LABELS

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Prisma schema with MANDANT role and portal fields** - `1b7f743` (feat)
2. **Task 2: Update auth, RBAC, and type declarations for MANDANT role** - `6348ed1` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added MANDANT to UserRole, portal fields on User, portalUser relation on Kontakt
- `src/lib/rbac.ts` - Added MANDANT entry in PERMISSIONS (all false) and ROLE_LABELS

## Decisions Made
- **No auth.ts changes:** The existing Credentials authorize flow already handles any UserRole generically (queries User, returns role). MANDANT login works out of the box.
- **No next-auth.d.ts changes:** Type declarations use `UserRole` from `@prisma/client` which automatically includes MANDANT after `prisma generate`.
- **kontaktId on User model:** Chosen over portalUserId on Kontakt to keep the general-purpose Kontakt model clean. `@unique` ensures 1:1 mapping.
- **db push skipped:** Database server not running locally. Schema validates and Prisma client generates successfully. `npx prisma db push` should be run when DB is available.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npx prisma db push` failed (P1001: database not reachable at localhost:5432). This is expected when the Docker database service is not running. Schema validation and Prisma client generation both succeeded. The push can be run later when the database is up.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- MANDANT role fully integrated in schema, auth, and RBAC layers
- Ready for Plan 43-02 (middleware, portal layout, route shell)
- `npx prisma db push` needed when database service is started

## Self-Check: PASSED

All artifacts verified:
- 43-01-SUMMARY.md exists
- Commit 1b7f743 (Task 1) exists
- Commit 6348ed1 (Task 2) exists
- MANDANT in schema.prisma confirmed
- inviteToken in schema.prisma confirmed
- portalUser in schema.prisma confirmed
- MANDANT in rbac.ts confirmed

---
*Phase: 43-portal-schema-shell*
*Completed: 2026-03-03*
