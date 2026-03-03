---
phase: 44-portal-authentifizierung
plan: 02
subsystem: auth
tags: [portal, mandant, activation, login, jwt, session, password-reset, bcrypt, auto-logout]

# Dependency graph
requires:
  - phase: 44-portal-authentifizierung
    plan: 01
    provides: "PortalInvite model with token, invite/resend API, email template"
  - phase: 43-portal-schema-shell
    provides: "MANDANT role, kontaktId on User, portal layout, portal login page"
provides:
  - "POST /api/portal/activate endpoint for account activation with token"
  - "Activation page with password form and Glass UI"
  - "Extended NextAuth config with kontaktId on JWT for MANDANT users"
  - "PortalSessionProvider with 30min auto-logout and 5min warning"
  - "Password reset flow (request + confirm API endpoints)"
  - "Password reset email template with Kanzlei branding"
  - "Passwort-vergessen and Passwort-reset pages"
  - "passwordResetToken and passwordResetExpires fields on User model"
affects: [45-portal-api, 46-portal-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Token-based activation with bcrypt password hashing", "Inactivity-based auto-logout with React context provider", "Anti-enumeration password reset (always 200)", "Transaction-based user creation on activation"]

key-files:
  created:
    - src/app/api/portal/activate/route.ts
    - src/app/(portal)/activate/page.tsx
    - src/lib/portal-session.ts
    - src/app/api/portal/password-reset/request/route.ts
    - src/app/api/portal/password-reset/confirm/route.ts
    - src/app/(portal)/passwort-vergessen/page.tsx
    - src/app/(portal)/passwort-reset/page.tsx
    - src/lib/email/templates/portal-password-reset.ts
  modified:
    - src/lib/auth.ts
    - src/middleware.ts
    - src/app/(portal)/login/page.tsx
    - src/app/(portal)/layout.tsx
    - prisma/schema.prisma
    - src/lib/audit.ts

key-decisions:
  - "Transaction-based activation: User creation + invite status update in single $transaction for data consistency"
  - "Anti-enumeration: password reset request always returns 200 regardless of email existence"
  - "crypto.randomUUID for password reset tokens (consistent with invite token pattern)"
  - "30min inactivity timeout with 5min warning dialog using React context + setTimeout"
  - "Activity event throttling at 30s intervals to avoid excessive timer resets"

patterns-established:
  - "Portal auth flow: invite token -> activation -> login -> auto-logout on inactivity"
  - "Password complexity: 8+ chars, 1 uppercase, 1 number (shared regex in client + server)"
  - "Portal public routes bypass middleware via matcher exclusion pattern"

requirements-completed: [AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06]

# Metrics
duration: 6min
completed: 2026-03-03
---

# Phase 44 Plan 02: Portal Authentication Flow Summary

**Complete Mandant auth lifecycle with token-based activation, JWT login with kontaktId, 30min auto-logout with warning dialog, and anti-enumeration password reset flow**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-03T11:59:38Z
- **Completed:** 2026-03-03T12:06:01Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments
- Account activation endpoint validates invite token, creates MANDANT User with bcrypt-hashed password in a transaction, logs audit event
- Activation page with Glass UI, Kanzlei branding, password form, and success redirect to login
- Extended NextAuth JWT/session callbacks to include kontaktId for MANDANT users
- PortalSessionProvider with 30-minute inactivity auto-logout and 5-minute warning dialog
- Complete password reset flow: request endpoint (anti-enumeration 200), confirm endpoint (token + password validation), professional email template
- Middleware updated to allow all portal public routes without authentication
- Portal login page enhanced with "Passwort vergessen?" link

## Task Commits

Each task was committed atomically:

1. **Task 1: Account activation page + API endpoint** - `dd10d68` (feat)
2. **Task 2: Portal login, session management, and auto-logout** - `5ca3d9c` (feat)
3. **Task 3: Password reset flow** - `2185e0c` (feat)

## Files Created/Modified
- `src/app/api/portal/activate/route.ts` - POST endpoint to validate invite token, create MANDANT User with hashed password
- `src/app/(portal)/activate/page.tsx` - Activation page with password form, Glass UI, Kanzlei branding
- `src/lib/auth.ts` - Extended JWT/session callbacks with kontaktId for MANDANT users
- `src/middleware.ts` - Updated matcher to bypass portal public routes
- `src/app/(portal)/login/page.tsx` - Added "Passwort vergessen?" link
- `src/lib/portal-session.ts` - PortalSessionProvider with inactivity tracking and auto-logout
- `src/app/(portal)/layout.tsx` - Wrapped children with PortalSessionProvider
- `src/app/api/portal/password-reset/request/route.ts` - POST endpoint to send password reset email (anti-enumeration)
- `src/app/api/portal/password-reset/confirm/route.ts` - POST endpoint to validate reset token and set new password
- `src/app/(portal)/passwort-vergessen/page.tsx` - Password reset request page with email form
- `src/app/(portal)/passwort-reset/page.tsx` - Password reset confirmation page with new password form
- `src/lib/email/templates/portal-password-reset.ts` - Email template with Kanzlei branding and 1-hour expiry
- `prisma/schema.prisma` - Added passwordResetToken and passwordResetExpires fields to User model
- `src/lib/audit.ts` - Added PORTAL_AKTIVIERT and PORTAL_PASSWORT_RESET audit actions

## Decisions Made
- **Transaction-based activation:** User creation and invite status update wrapped in `$transaction` for atomicity. If user creation fails, invite status is not changed.
- **Anti-enumeration password reset:** Request endpoint always returns HTTP 200 with generic message, preventing attackers from discovering valid email addresses.
- **crypto.randomUUID for reset tokens:** Consistent with the invite token pattern from Plan 44-01.
- **30min/5min inactivity pattern:** Activity tracked via mousemove/keydown/click/scroll/touchstart, throttled to 30s intervals. Warning dialog at 25min, auto-logout at 30min.
- **Shared password regex:** Same `PASSWORD_REGEX` used in both client-side validation and server-side endpoints for consistency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added passwordResetToken and passwordResetExpires fields to User model**
- **Found during:** Task 1 (proactive, needed for Task 3)
- **Issue:** Plan noted "Phase 43 should have added passwordResetToken/passwordResetExpires fields to User model. If not present, add them." -- they were not present.
- **Fix:** Added `passwordResetToken String? @unique` and `passwordResetExpires DateTime?` to User model in Prisma schema
- **Files modified:** prisma/schema.prisma
- **Verification:** Prisma generate succeeds, TypeScript compiles
- **Committed in:** dd10d68 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added PORTAL_AKTIVIERT and PORTAL_PASSWORT_RESET audit actions**
- **Found during:** Task 1 (activation endpoint uses these actions)
- **Issue:** Audit action types did not include portal activation or password reset actions
- **Fix:** Added both actions to AuditAktion type and AKTION_LABELS map
- **Files modified:** src/lib/audit.ts
- **Verification:** TypeScript compiles without errors on audit calls
- **Committed in:** dd10d68 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both were anticipated by the plan ("if not present, add them"). No scope creep.

## Issues Encountered
- 7 pre-existing TypeScript errors in `falldaten-tab.tsx` (2) and `helena/index.ts` (5) -- unrelated to portal auth changes, out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Complete Mandant auth lifecycle operational: invite -> activate -> login -> session -> auto-logout -> password reset
- JWT includes kontaktId for MANDANT users, ready for portal API endpoints (Phase 45)
- Portal layout has PortalSessionProvider, ready for all portal UI pages (Phase 46)
- `npx prisma db push` needed when database service is started (schema has new User fields)

## Self-Check: PASSED

All artifacts verified:
- 44-02-SUMMARY.md exists
- Commit dd10d68 (Task 1) exists
- Commit 5ca3d9c (Task 2) exists
- Commit 2185e0c (Task 3) exists
- activate route exists
- activate page exists
- portal-session.ts exists
- password-reset request route exists
- password-reset confirm route exists
- passwort-vergessen page exists
- passwort-reset page exists
- password-reset email template exists

---
*Phase: 44-portal-authentifizierung*
*Completed: 2026-03-03*
