---
phase: 49-portal-route-guard-fix
plan: 01
subsystem: auth
tags: [nextjs, route-groups, portal, auth-guard, bcrypt, profil, password-change]

requires:
  - phase: 43-mandantenportal-grundgeruest
    provides: Portal layout, sidebar, login page, dashboard
  - phase: 44-portal-aktivierung
    provides: Activation + password reset flows

provides:
  - (portal-public) route group for unauthenticated portal pages
  - Fixed portal URL structure (pages now at /portal/* URLs)
  - /portal/profil page with contact info + password change
  - POST /api/portal/password-change endpoint with bcrypt verification
  - Clean 3-item sidebar (Meine Akten, Nachrichten, Profil)

affects: [portal, auth, mandantenportal]

tech-stack:
  added: []
  patterns:
    - "Dual route groups: (portal) for guarded, (portal-public) for public portal pages"
    - "Server component wrapper for auth redirect + client form component pattern"

key-files:
  created:
    - src/app/(portal-public)/layout.tsx
    - src/app/(portal-public)/portal/login/page.tsx
    - src/app/(portal-public)/portal/login/portal-login-form.tsx
    - src/app/(portal-public)/portal/activate/page.tsx
    - src/app/(portal-public)/portal/passwort-vergessen/page.tsx
    - src/app/(portal-public)/portal/passwort-reset/page.tsx
    - src/app/(portal)/portal/profil/page.tsx
    - src/app/(portal)/portal/profil/password-change-form.tsx
    - src/app/api/portal/password-change/route.ts
  modified:
    - src/components/portal/portal-sidebar.tsx

key-decisions:
  - "Split login into server component (auth redirect) + PortalLoginForm client component"
  - "Adresse relation fallback to legacy Kontakt address fields for profil page"
  - "[Rule 3] Fixed portal URL structure by adding /portal segment inside route groups"

patterns-established:
  - "(portal-public) route group: public portal pages without auth guard"
  - "Server component auth-redirect wrapper for public pages that should redirect authenticated users"

requirements-completed: [AUTH-02, AUTH-03, AUTH-06]

duration: 7min
completed: 2026-03-03
---

# Phase 49 Plan 01: Portal Route Guard Fix Summary

**Public portal auth pages extracted to (portal-public) route group with fixed URL structure, sidebar cleaned to 3 items, and new /portal/profil page with contact display + bcrypt password change**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-03T20:52:56Z
- **Completed:** 2026-03-03T21:00:04Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Extracted login, activate, passwort-vergessen, passwort-reset pages from guarded (portal) layout to unguarded (portal-public) route group
- Fixed portal URL structure so all pages map to /portal/* URLs matching code references
- Created /portal/profil page with read-only Kontakt data display + interactive password change form
- Created POST /api/portal/password-change with zod validation, MANDANT auth, bcrypt verification
- Cleaned sidebar to 3 items (removed broken Dokumente link)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract public auth pages to (portal-public) route group + fix sidebar** - `017791c` (feat)
2. **Task 2: Create /portal/profil page with contact info + password change** - `1df433a` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `src/app/(portal-public)/layout.tsx` - Minimal pass-through layout with no auth guard
- `src/app/(portal-public)/portal/login/page.tsx` - Server component with auth redirect for authenticated MANDANT
- `src/app/(portal-public)/portal/login/portal-login-form.tsx` - Client form component extracted from old login page
- `src/app/(portal-public)/portal/activate/page.tsx` - Account activation page (moved from guarded layout)
- `src/app/(portal-public)/portal/passwort-vergessen/page.tsx` - Password forgot page (moved)
- `src/app/(portal-public)/portal/passwort-reset/page.tsx` - Password reset page (moved)
- `src/app/(portal)/portal/profil/page.tsx` - Server component with Kontakt data display + PasswordChangeForm
- `src/app/(portal)/portal/profil/password-change-form.tsx` - Client form with bcrypt-verified password change
- `src/app/api/portal/password-change/route.ts` - POST endpoint with zod, auth, bcrypt compare+hash
- `src/components/portal/portal-sidebar.tsx` - Removed Dokumente entry, now 3 items

## Decisions Made
- Split login page into server component (auth redirect check) + client PortalLoginForm component, maintaining same UI but adding authenticated MANDANT redirect to dashboard
- Profil page uses Adresse relation (HAUPTANSCHRIFT) with fallback to legacy Kontakt address fields (strasse, plz, ort, land)
- Password change API uses same regex validation as activation page for consistency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed portal URL structure by adding /portal segment inside route groups**
- **Found during:** Task 1 (Extract public auth pages)
- **Issue:** All portal pages in (portal) route group mapped to root URLs (e.g., /dashboard instead of /portal/dashboard) because Next.js route groups in parentheses don't create URL segments. But all code references (sidebar links, layout redirects, middleware matcher, signOut callbacks) used /portal/* URLs.
- **Fix:** Added a `portal` subdirectory inside both (portal) and (portal-public) route groups so pages map to correct /portal/* URLs. Moved existing guarded pages (dashboard, nachrichten, akten) from `(portal)/dashboard/` to `(portal)/portal/dashboard/` etc.
- **Files modified:** All portal page file paths restructured
- **Verification:** URL mapping confirmed correct: (portal)/portal/dashboard/page.tsx -> /portal/dashboard
- **Committed in:** 017791c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential structural fix that was prerequisite for correct portal routing. Without it, all portal page URLs would have been wrong. No scope creep.

## Issues Encountered
None beyond the URL structure issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Portal auth flow is now functional: unauthenticated users can access login/activate/password-reset pages without redirect loop
- Portal sidebar navigation works with correct 3-item menu
- Profil page ready for use with contact display and password change
- All v0.5 gap requirements (AUTH-02, AUTH-03, AUTH-06) closed

## Self-Check: PASSED

All 10 files verified present. Both task commits (017791c, 1df433a) confirmed in git log.

---
*Phase: 49-portal-route-guard-fix*
*Completed: 2026-03-03*
