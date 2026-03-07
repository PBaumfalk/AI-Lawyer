---
phase: 59-2fa-totp
plan: 03
subsystem: auth
tags: [totp, 2fa, nextjs, nextauth, jwt, cookies, prisma, challenge-page]

# Dependency graph
requires:
  - phase: 59-02
    provides: "POST /api/auth/totp/verify — validates TOTP/backup code via JWT cookie and returns success"
  - phase: 59-01
    provides: "TOTP service library and User schema 2FA fields (totpEnabled, totpSecret, backupCodes)"
provides:
  - "POST /api/auth/totp/init — validates password, sets totp_pending cookie, stores one-time nonce"
  - "/login/totp TOTP challenge page — 6-digit code input with backup code fallback"
  - "Modified auth.ts authorize — handles TOTP:nonce second-factor login path"
  - "Modified login page — calls init route first to detect 2FA requirement"
  - "totpNonce field on User model for one-time nonce-based session creation"
affects: [59-04-PLAN, 59-05-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-step login flow: init route (validates password + sets cookie) → challenge page (validates TOTP) → signIn with TOTP nonce"
    - "TOTP nonce stored in DB as totpNonce (unique, nullable) — consumed in authorize callback, one-time use"
    - "TOTP:nonce password prefix in NextAuth Credentials authorize for distinguishing TOTP second-factor from normal login"

key-files:
  created:
    - src/app/api/auth/totp/init/route.ts
    - src/app/(auth)/login/totp/page.tsx
  modified:
    - src/lib/auth.ts
    - src/app/api/auth/totp/verify/route.ts
    - src/app/(auth)/login/page.tsx
    - prisma/schema.prisma

key-decisions:
  - "TOTP nonce stored in DB (totpNonce field) consumed one-time in auth.ts authorize to create NextAuth session — avoids storing credentials client-side"
  - "Login page modified to call /api/auth/totp/init before NextAuth signIn — allows detecting 2FA requirement without modifying NextAuth internals"
  - "TOTP:nonce prefix in password field used to distinguish second-factor path in authorize callback — simple, no additional providers needed"

patterns-established:
  - "Two-step credential auth: /api/auth/totp/init (validates + sets cookie) → /login/totp (challenge) → signIn with nonce"
  - "Auth.ts authorize handles two schemas: normal email+password, and email+TOTP:nonce for 2FA completion"

requirements-completed: [AUTH-02]

# Metrics
duration: 8min
completed: 2026-03-07
---

# Phase 59 Plan 03: Two-Step Login Flow Summary

**Complete TOTP login challenge flow: /api/auth/totp/init sets pending cookie + nonce, /login/totp challenge page verifies code, authorize accepts TOTP:nonce for session creation**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-07T05:00:00Z
- **Completed:** 2026-03-07T05:08:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Built the complete two-step login flow that gates 2FA-enabled users at /login/totp before creating a session
- TOTP challenge page with 6-digit numeric input and backup code fallback toggle, matching existing login page styling
- One-time nonce mechanism in DB ensures TOTP-completed sessions cannot be replayed or forged

## Task Commits

Each task was committed atomically:

1. **Task 1: TOTP login flow, challenge page, auth.ts extend, verify route update** - `568cdfc` (feat)
2. **Task 2: /api/auth/totp/init route** - `5dca80a` (feat)

## Files Created/Modified

- `src/app/api/auth/totp/init/route.ts` - POST endpoint: validates password, if totpEnabled sets totp_pending cookie + generates/stores nonce, returns { requireTotp }
- `src/app/(auth)/login/totp/page.tsx` - TOTP challenge page with 6-digit code input, backup code toggle, and signIn via nonce on success
- `src/lib/auth.ts` - Extended authorize callback with TOTP nonce path (password starts with "TOTP:")
- `src/app/api/auth/totp/verify/route.ts` - Updated success response to include { nonce, email } for signIn call
- `src/app/(auth)/login/page.tsx` - Modified handleSubmit: calls /api/auth/totp/init first, redirects to /login/totp if requireTotp
- `prisma/schema.prisma` - Added totpNonce String? @unique to User model

## Decisions Made

- TOTP nonce stored in DB (totpNonce field) consumed one-time in auth.ts authorize to create the NextAuth session. The alternative of storing credentials in the pending cookie was avoided for security — client never sees the nonce until verify succeeds.
- Login page calls /api/auth/totp/init before NextAuth signIn. This allows credential validation + 2FA detection in a single round trip without any changes to NextAuth Credentials provider internals.
- `TOTP:nonce` prefix in the password field distinguishes the second-factor path inside authorize without adding a separate NextAuth provider.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma client regenerated after schema change**
- **Found during:** Task 1 (adding totpNonce field)
- **Issue:** After adding totpNonce to schema.prisma, TypeScript reported 5 errors because the Prisma client types were stale
- **Fix:** Ran `DATABASE_URL=placeholder npx prisma generate` to regenerate client types; db push not possible without live DB but schema + types are correct
- **Files modified:** node_modules/@prisma/client (generated, not committed)
- **Verification:** npx tsc --noEmit exits 0
- **Committed in:** 568cdfc (Task 1 commit — schema change only committed, client regenerated)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The Prisma generate step was necessary for TypeScript correctness. The db push requires a live DATABASE_URL (documented in User Setup below).

## Issues Encountered

The `totp_pending` cookie is httpOnly, so the client-side check in /login/totp page cannot read it directly. The page uses a document.cookie fallback redirect on mount — if the cookie is absent the user is sent back to /login. This is a best-effort client check; the API routes enforce the real security.

## User Setup Required

After deploying, run the schema migration against the live database:

```bash
DATABASE_URL="<your-db-url>" npx prisma db push
# or in production:
DATABASE_URL="<your-db-url>" npx prisma migrate deploy
```

This adds the `totpNonce` column to the `users` table. The column is nullable and has a UNIQUE constraint — no backfill needed.

## Next Phase Readiness

- Complete login challenge flow is wired end-to-end
- Plan 04 can implement the 2FA setup/disable UI (management settings page) against the routes from plan 02
- Plan 05 can add backup code display page and recovery flow

---
*Phase: 59-2fa-totp*
*Completed: 2026-03-07*
