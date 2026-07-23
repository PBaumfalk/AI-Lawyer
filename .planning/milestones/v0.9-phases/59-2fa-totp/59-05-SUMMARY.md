---
phase: 59-2fa-totp
plan: 05
subsystem: auth
tags: [totp, 2fa, nextjs, nextauth, jwt, middleware, enforcement, settings]

# Dependency graph
requires:
  - phase: 59-03
    provides: "Two-step login flow with TOTP nonce path in auth.ts authorize"
  - phase: 59-04
    provides: "ZweiFaktorTab UI and Sicherheit tab in Einstellungen"
provides:
  - "auth.totp.requiredRoles SystemSetting definition for admin settings display"
  - "TOTP_REQUIRED_ROLES env var enforcement in auth.config.ts authorized callback"
  - "/2fa-setup-required landing page explaining the enforcement policy"
  - "totpEnabled claim in JWT token and session.user via auth.config.ts callbacks"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Edge middleware 2FA enforcement via JWT claim (totpEnabled) read from token — avoids DB in Edge runtime"
    - "TOTP_REQUIRED_ROLES env var controls per-role enforcement without DB round-trip in middleware"
    - "totpEnabled set to true in TOTP nonce auth path — user who completes 2FA challenge is immediately compliant"

key-files:
  created:
    - src/app/(auth)/2fa-setup-required/page.tsx
  modified:
    - src/lib/settings/defaults.ts
    - src/lib/auth.config.ts
    - src/lib/auth.ts
    - src/middleware.ts

key-decisions:
  - "Edge middleware cannot query DB — totpEnabled stored in JWT at login time; users need to re-login for JWT to reflect 2FA changes after enabling"
  - "TOTP_REQUIRED_ROLES env var (comma-separated roles) used for Edge enforcement; SystemSetting auth.totp.requiredRoles is informational/admin-visible only"
  - "authorized callback placed in auth.config.ts (Edge-compatible) rather than separate middleware logic"

patterns-established:
  - "2FA enforcement pattern: JWT claim check in authorized callback, env var for configuration, informational redirect page"

requirements-completed: [AUTH-04]

# Metrics
duration: 6min
completed: 2026-03-07
---

# Phase 59 Plan 05: 2FA Enforcement and Setup-Required Page Summary

**Admin-configurable 2FA enforcement via TOTP_REQUIRED_ROLES env var with Edge-compatible JWT claim check and /2fa-setup-required redirect landing page**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-07T04:32:36Z
- **Completed:** 2026-03-07T04:38:00Z
- **Tasks:** 2 (+ 1 checkpoint auto-approved)
- **Files modified:** 5

## Accomplishments

- Added `auth.totp.requiredRoles` SystemSetting and "Sicherheit" category label for admin settings visibility
- Extended auth.config.ts with `authorized` callback that enforces 2FA per role via JWT claim (Edge-compatible, no DB)
- Created `/2fa-setup-required` page with ShieldAlert icon, German copy, and link to Einstellungen > Sicherheit
- Added `totpEnabled` to JWT token and session.user so all app code can check 2FA status

## Task Commits

Each task was committed atomically:

1. **Task 1: 2FA enforcement settings and JWT totpEnabled claim** - `6470963` (feat)
2. **Task 2: Middleware enforcement + 2fa-setup-required page** - `4c256c5` (feat)

## Files Created/Modified

- `src/lib/settings/defaults.ts` - Added auth.totp.requiredRoles setting (security category, JSON type) and "Sicherheit" CATEGORY_LABEL
- `src/lib/auth.config.ts` - Added authorized callback for TOTP enforcement, added totpEnabled to JWT and session callbacks
- `src/lib/auth.ts` - Returns totpEnabled in both normal auth path and TOTP nonce path (true for nonce path)
- `src/middleware.ts` - Updated matcher to exclude /2fa-setup-required from protection
- `src/app/(auth)/2fa-setup-required/page.tsx` - Informational page with ShieldAlert, policy explanation, and settings link

## Decisions Made

- Edge middleware cannot query the DB, so totpEnabled is stored in the JWT at login time. If a user enables 2FA after logging in, they must re-login for the JWT to reflect the change. This is acceptable behavior for the security enforcement use case.
- TOTP_REQUIRED_ROLES env var (comma-separated, e.g. `ADMIN,ANWALT`) controls which roles are enforced. The SystemSetting `auth.totp.requiredRoles` is shown in the admin UI as documentation/reference but is not directly read by middleware.
- authorized callback lives in auth.config.ts (not middleware.ts) because it's already the right place for NextAuth edge-compatible session logic.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

To enforce 2FA for admin and lawyer roles, add to `.env.local`:

```
TOTP_REQUIRED_ROLES=ADMIN,ANWALT
```

Then restart the dev/production server. Users in the specified roles who have not enabled 2FA will be redirected to `/2fa-setup-required` on each request until they complete setup.

## Next Phase Readiness

- AUTH-04 is fully satisfied: admin controls enforcement via env var, users are redirected with a clear explanation
- Full 2FA/TOTP feature set is complete: setup UI (AUTH-01), login challenge (AUTH-02), backup codes (AUTH-03), enforcement (AUTH-04)
- All phase 59 plans completed — ready for UAT

---
*Phase: 59-2fa-totp*
*Completed: 2026-03-07*
