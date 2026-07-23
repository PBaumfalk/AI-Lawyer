---
phase: 59-2fa-totp
plan: 02
subsystem: auth
tags: [totp, 2fa, nextjs-route-handler, jsonwebtoken, jwt, cookies, audit]

# Dependency graph
requires:
  - phase: 59-01
    provides: "TOTP service library (generateTotpSecret, verifyTotpCode, generateBackupCodes, verifyBackupCode) and User schema 2FA fields"
provides:
  - "POST /api/auth/totp/setup — generate secret + QR code for authenticated user"
  - "POST /api/auth/totp/verify-setup — confirm code, persist secret, enable TOTP, return backup codes once"
  - "POST /api/auth/totp/disable — disable TOTP after verifying current code"
  - "POST /api/auth/totp/backup-codes — regenerate backup codes (requires TOTP verification)"
  - "POST /api/auth/totp/verify — verify TOTP or backup code during login challenge via JWT cookie"
  - "TOTP_AKTIVIERT, TOTP_DEAKTIVIERT, TOTP_LOGIN_ERFOLG, TOTP_BACKUP_CODES_REGENERIERT audit events"
affects: [59-03-PLAN, 59-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Signed JWT (jsonwebtoken) in httpOnly cookie for stateless login challenge state"
    - "TOTP pending state cookie named totp_pending with 10-min expiry"
    - "Backup code consumption on success (remainingCodes written back to DB)"

key-files:
  created:
    - src/app/api/auth/totp/setup/route.ts
    - src/app/api/auth/totp/verify-setup/route.ts
    - src/app/api/auth/totp/disable/route.ts
    - src/app/api/auth/totp/backup-codes/route.ts
    - src/app/api/auth/totp/verify/route.ts
  modified:
    - src/lib/audit.ts

key-decisions:
  - "Login challenge state stored in signed JWT httpOnly cookie (totp_pending) rather than server-side session, keeping the verify route stateless"
  - "MANDANT role blocked from enabling 2FA (403) on all management routes"
  - "Backup code verification consumes the used code atomically in the same DB update"

patterns-established:
  - "TOTP routes: 401 without session, 403 for MANDANT role, 400 for invalid codes"
  - "Audit events logged for all security-relevant TOTP actions"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 59 Plan 02: TOTP API Routes Summary

**5 Next.js route handlers for the full 2FA lifecycle: setup, activation, login challenge, backup code regeneration, and disabling — all with session guards, role checks, and audit logging**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T04:30:00Z
- **Completed:** 2026-03-07T04:35:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Built complete server-side API surface for 2FA lifecycle across 5 route handlers
- Login challenge route uses signed JWT cookie (totp_pending) for stateless pending-state tracking
- Extended audit.ts with 4 new TOTP audit event types and German labels

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TOTP setup and management routes** - `9f77dc4` (feat)
2. **Task 2: Create TOTP login challenge verification route** - `fecce79` (feat)

## Files Created/Modified

- `src/app/api/auth/totp/setup/route.ts` - Generates secret + QR code, stores pending totpSecret
- `src/app/api/auth/totp/verify-setup/route.ts` - Verifies TOTP, enables 2FA, returns plaintext backup codes once
- `src/app/api/auth/totp/disable/route.ts` - Verifies TOTP then clears all 2FA data
- `src/app/api/auth/totp/backup-codes/route.ts` - Regenerates backup codes after TOTP verification
- `src/app/api/auth/totp/verify/route.ts` - Login challenge: verifies TOTP or backup code via JWT cookie
- `src/lib/audit.ts` - Added TOTP_AKTIVIERT, TOTP_DEAKTIVIERT, TOTP_LOGIN_ERFOLG, TOTP_BACKUP_CODES_REGENERIERT

## Decisions Made

- Login challenge state is stored in a short-lived signed JWT httpOnly cookie (`totp_pending`) rather than server-side session storage. This keeps the `/api/auth/totp/verify` route fully stateless — it only reads the cookie and the DB, no session dependency.
- MANDANT role is blocked on all 4 management routes (setup, verify-setup, disable, backup-codes) — the verify route has no role restriction since it's called during login before full session establishment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added TOTP audit event types to audit.ts**
- **Found during:** Task 1 (creating management routes)
- **Issue:** Plan specified logging TOTP_AKTIVIERT and TOTP_DEAKTIVIERT but these were not in the AuditAktion union type in audit.ts
- **Fix:** Added TOTP_AKTIVIERT, TOTP_DEAKTIVIERT, TOTP_LOGIN_ERFOLG, TOTP_BACKUP_CODES_REGENERIERT to AuditAktion union and AKTION_LABELS map
- **Files modified:** src/lib/audit.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 9f77dc4 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Required addition for correctness — routes would not compile without the audit event types. No scope creep.

## Issues Encountered

None — all planned functionality implemented cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 API routes ready for UI integration in plans 03 and 04
- Plan 03 must implement the totp_pending cookie-setting logic in auth.ts (when password login succeeds and user has totpEnabled=true)
- Plan 04 can wire setup/disable UI against these endpoints

---
*Phase: 59-2fa-totp*
*Completed: 2026-03-07*
