---
phase: 43-portal-schema-shell
plan: 02
subsystem: ui
tags: [nextjs, portal, glass-ui, middleware, mandant, layout, sidebar]

# Dependency graph
requires:
  - "43-01: MANDANT role in UserRole enum, portal fields on User, RBAC entry"
provides:
  - "Portal route group (portal) with auth-guarded layout"
  - "Portal login page at /portal/login (public, Glass UI)"
  - "Portal dashboard placeholder at /portal/dashboard"
  - "PortalSidebar with 4 nav items + Kanzlei branding"
  - "PortalHeader with Kanzlei name and user session"
  - "Middleware bypass for /portal/login"
affects: [44-portal-auth, 45-portal-api, 46-portal-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Portal route group with MANDANT role guard", "Briefkopf-based Kanzlei branding in portal layout"]

key-files:
  created:
    - src/app/(portal)/layout.tsx
    - src/app/(portal)/login/page.tsx
    - src/app/(portal)/dashboard/page.tsx
    - src/components/portal/portal-sidebar.tsx
    - src/components/portal/portal-header.tsx
  modified:
    - src/middleware.ts

key-decisions:
  - "Portal layout uses (session.user as any).role check since next-auth types use UserRole from @prisma/client"
  - "Portal login page uses Shield icon (not Scale) to visually distinguish from internal login"
  - "Briefkopf kanzleiName fetched server-side in layout and passed as props to sidebar/header"

patterns-established:
  - "Portal route group (portal) mirrors (dashboard) pattern but simplified (no Socket, Notifications, Upload providers)"
  - "Portal sidebar is static nav (no Socket.IO badges, no collapse) -- simpler than internal sidebar"

requirements-completed: [PORTAL-01]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 43 Plan 02: Portal Route Shell Summary

**Glass UI portal shell with /portal/login and /portal/dashboard routes, MANDANT role guard, Kanzlei-branded sidebar/header, and middleware bypass**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T11:41:48Z
- **Completed:** 2026-03-03T11:44:24Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Updated middleware to bypass /portal/login for public access
- Created portal layout with MANDANT role check and Briefkopf branding
- Built PortalSidebar with 4 navigation items (Meine Akten, Nachrichten, Dokumente, Profil) and logout
- Built PortalHeader showing Kanzlei name and current user from session
- Created Glass UI portal login page with credentials auth redirecting to /portal/dashboard
- Created placeholder dashboard page with welcome message

## Task Commits

Each task was committed atomically:

1. **Task 1: Update middleware and create portal layout with auth + role guard** - `b5c6d64` (feat)
2. **Task 2: Create portal sidebar, header, login page, and dashboard page** - `cdeb648` (feat)

## Files Created/Modified
- `src/middleware.ts` - Added portal/login to middleware bypass matcher
- `src/app/(portal)/layout.tsx` - Portal layout with auth + MANDANT role guard, Briefkopf branding
- `src/app/(portal)/login/page.tsx` - Glass UI portal login page with Shield branding
- `src/app/(portal)/dashboard/page.tsx` - Placeholder dashboard with welcome message
- `src/components/portal/portal-sidebar.tsx` - Slim sidebar with 4 nav items + Kanzlei logo/name + logout
- `src/components/portal/portal-header.tsx` - Header with Kanzlei name + user name from session

## Decisions Made
- Portal layout uses `(session.user as any).role` cast since the extended NextAuth types infer UserRole from @prisma/client automatically
- Used Shield icon for portal login (instead of Scale used in internal login) to visually distinguish the two entry points
- Briefkopf kanzleiName is fetched server-side in the layout and passed as props to client components (sidebar/header), avoiding client-side DB queries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in falldaten-tab.tsx and helena/index.ts (unrelated to portal changes). Portal files compile cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Portal route shell complete with auth guard and Glass UI
- Ready for Phase 44 (Portal Auth: invite flow, password reset, email verification)
- `npx prisma db push` still needed when database service is started (from Plan 01)

## Self-Check: PASSED

All artifacts verified:
- 43-02-SUMMARY.md exists
- Commit b5c6d64 (Task 1) exists
- Commit cdeb648 (Task 2) exists
- src/middleware.ts contains portal/login bypass
- src/app/(portal)/layout.tsx exists with MANDANT guard
- src/app/(portal)/login/page.tsx exists with Glass UI
- src/app/(portal)/dashboard/page.tsx exists with placeholder
- src/components/portal/portal-sidebar.tsx exists with 4 nav items
- src/components/portal/portal-header.tsx exists with Kanzlei branding

---
*Phase: 43-portal-schema-shell*
*Completed: 2026-03-03*
