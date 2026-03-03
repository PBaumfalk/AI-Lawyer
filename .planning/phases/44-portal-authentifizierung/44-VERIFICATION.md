---
phase: 44-portal-authentifizierung
verified: 2026-03-03T12:10:16Z
status: passed
score: 9/9 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Click 'Portal-Einladung' button on a MANDANT beteiligter in Akte detail, then open the activation URL in a browser and set a password"
    expected: "Email sent (if SMTP configured), activation page loads, password form accepts valid input, account created, redirect to /portal/login"
    why_human: "Requires live database + SMTP config; complete UI flow cannot be verified statically"
  - test: "Log in at /portal/login with activated MANDANT credentials, then reload the page"
    expected: "Session persists, MANDANT is redirected to /portal/dashboard, NOT to /login"
    why_human: "JWT persistence requires live NextAuth session; static analysis cannot verify cookie behavior"
  - test: "Stay idle on a portal page for 25 minutes"
    expected: "Warning dialog appears: 'Sitzung laeuft ab' with minutes remaining and 'Weiter' button; waiting 5 more minutes triggers signOut"
    why_human: "Timer-based behavior cannot be verified statically"
  - test: "Request password reset at /portal/passwort-vergessen with a non-existent email"
    expected: "Response is HTTP 200 with generic message (anti-enumeration); no error reveals whether email exists"
    why_human: "Anti-enumeration behavior requires a live request against the API"
---

# Phase 44: Portal-Authentifizierung Verification Report

**Phase Goal:** Complete Mandant authentication — invite system, account activation, login, session management (30-min auto-logout), password reset
**Verified:** 2026-03-03T12:10:16Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                          | Status     | Evidence                                                                                                         |
|----|-----------------------------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------------------------------------|
| 1  | Anwalt can generate a portal invite link for any Beteiligter with rolle=MANDANT from Akte detail | VERIFIED | `BeteiligteSection` renders `PortalInviteDialog` for `rolle === "MANDANT"`, gated on `ANWALT`/`ADMIN` role      |
| 2  | Invite email is sent with Kanzlei name, Aktenzeichen, and activation link                      | VERIFIED | `portalInviteEmail()` in `portal-invite.ts` injects all three; `invite/route.ts` calls `sendEmail()`           |
| 3  | Each Beteiligter(rolle=MANDANT) can be invited separately to the portal                        | VERIFIED | `POST /api/portal/invite` accepts `beteiligteId`, creates per-Beteiligter `PortalInvite` record                |
| 4  | Invite token is stored in DB with expiry and can be resent                                     | VERIFIED | `PortalInvite` model has `token`, `expiresAt`, `status`; resend route at `/api/portal/invite/[id]/resend`       |
| 5  | Mandant can click invite link and set a password to activate their account                     | VERIFIED | `/portal/activate` page reads token from URL, POSTs to `/api/portal/activate`; creates MANDANT User in `$transaction` |
| 6  | Mandant can log in with email and password at /portal/login                                    | VERIFIED | Login page calls `signIn("credentials", ...)`, redirects to `/portal/dashboard` on success                      |
| 7  | Mandant session persists across browser refresh (JWT)                                          | VERIFIED | `auth.ts`: `session: { strategy: "jwt" }`, JWT/session callbacks stamp `role` and `kontaktId`                   |
| 8  | Mandant is automatically logged out after 30 minutes of inactivity                             | VERIFIED | `PortalSessionProvider` sets `setTimeout` at 30min calling `signOut({ callbackUrl: "/portal/login" })`; wired in `(portal)/layout.tsx` |
| 9  | Mandant can request a password reset email and set a new password                              | VERIFIED | Request route (anti-enum 200), confirm route (token + bcrypt), pages at `/portal/passwort-vergessen` and `/portal/passwort-reset` all exist and are wired |

**Score:** 9/9 truths verified

---

### Required Artifacts

#### Plan 44-01 Artifacts

| Artifact                                                    | Provides                                         | Status     | Details                                                   |
|-------------------------------------------------------------|--------------------------------------------------|------------|-----------------------------------------------------------|
| `prisma/schema.prisma`                                      | PortalInvite model with token, expiry, status    | VERIFIED   | `model PortalInvite` at line 903; `PortalInviteStatus` enum at line 27; `passwordResetToken`/`passwordResetExpires` on User |
| `src/app/api/portal/invite/route.ts`                        | POST endpoint to create invite and send email    | VERIFIED   | 189 lines; exports `POST`; full validate → create → email → audit flow |
| `src/components/akten/portal-invite-dialog.tsx`             | Dialog for Anwalt to trigger portal invite       | VERIFIED   | 154 lines; email display, disabled state, `fetch("/api/portal/invite", ...)`, toast feedback |
| `src/lib/email/templates/portal-invite.ts`                  | Email template for portal invitation             | VERIFIED   | Exports `portalInviteEmail`; includes kanzleiName, aktenzeichen, activationUrl in subject + body + HTML |

#### Plan 44-02 Artifacts

| Artifact                                                              | Provides                                               | Status     | Details                                                           |
|-----------------------------------------------------------------------|--------------------------------------------------------|------------|-------------------------------------------------------------------|
| `src/app/(portal)/activate/page.tsx`                                  | Account activation page with password form             | VERIFIED   | 177 lines; reads token from `useSearchParams`, POSTs to activate API, success redirect to login |
| `src/app/api/portal/activate/route.ts`                                | POST endpoint to validate token and create portal User | VERIFIED   | 157 lines; exports `POST`; token lookup, expiry check, bcrypt hash, `$transaction` user creation + invite update |
| `src/app/(portal)/login/page.tsx`                                     | Portal login page with email/password form             | VERIFIED   | 117 lines; Glass UI, `signIn("credentials")`, redirect to `/portal/dashboard`, "Passwort vergessen?" link |
| `src/lib/auth.ts`                                                     | Extended NextAuth config supporting MANDANT login      | VERIFIED   | `strategy: "jwt"`, `authorize()` returns `kontaktId`, JWT/session callbacks stamp `role` + `kontaktId` for MANDANT |
| `src/lib/portal-session.ts`                                           | Client-side inactivity tracker for auto-logout         | VERIFIED   | 171 lines; exports `PortalSessionProvider`; 30min logout timer + 25min warning dialog + throttled activity tracking |
| `src/app/(portal)/layout.tsx`                                         | Portal layout wrapping children with PortalSessionProvider | VERIFIED | Imports and wraps `<PortalSessionProvider>` at lines 7 and 34    |
| `src/app/api/portal/password-reset/request/route.ts`                  | POST endpoint to send password reset email             | VERIFIED   | 84 lines; exports `POST`; anti-enum 200, crypto.randomUUID token, 1-hour expiry, `sendEmail()` |
| `src/app/api/portal/password-reset/confirm/route.ts`                  | POST endpoint to set new password with reset token     | VERIFIED   | 98 lines; exports `POST`; token lookup with expiry, PASSWORD_REGEX, bcrypt hash, audit log |
| `src/app/(portal)/passwort-vergessen/page.tsx`                        | Password reset request page                            | VERIFIED   | 113 lines; email form, ignores response (shows generic success), link to login |
| `src/app/(portal)/passwort-reset/page.tsx`                            | Password reset confirmation page                       | VERIFIED   | 179 lines; reads token from search params, POSTs to confirm API, success → login link |

---

### Key Link Verification

#### Plan 44-01 Key Links

| From                                          | To                        | Via                              | Status     | Evidence                                                          |
|-----------------------------------------------|---------------------------|----------------------------------|------------|-------------------------------------------------------------------|
| `portal-invite-dialog.tsx`                    | `/api/portal/invite`      | `fetch POST with beteiligteId`   | WIRED      | Line 54: `fetch("/api/portal/invite", { method: "POST", body: JSON.stringify({ beteiligteId: beteiligter.id }) })` |
| `src/app/api/portal/invite/route.ts`          | `prisma.portalInvite`     | `create invite + sendEmail`      | WIRED      | Lines 110, 124: `prisma.portalInvite.updateMany` (revoke) + `prisma.portalInvite.create` |

#### Plan 44-02 Key Links

| From                                          | To                        | Via                              | Status     | Evidence                                                          |
|-----------------------------------------------|---------------------------|----------------------------------|------------|-------------------------------------------------------------------|
| `src/app/(portal)/activate/page.tsx`          | `/api/portal/activate`    | `fetch POST with token + password` | WIRED    | Line 83: `fetch("/api/portal/activate", { method: "POST", body: JSON.stringify({ token, password, passwordConfirm }) })` |
| `src/app/(portal)/login/page.tsx`             | `signIn('credentials')`   | `NextAuth signIn with redirect to /portal/dashboard` | WIRED | Lines 25-36: `signIn("credentials", { email, password, redirect: false })` + `router.push("/portal/dashboard")` |
| `src/lib/auth.ts`                             | `prisma.user`             | `authorize() checks role, MANDANT gets kontaktId` | WIRED | Lines 33-74: `prisma.user.findUnique`, returns `kontaktId`; callbacks stamp `role` and `kontaktId` for MANDANT |
| `src/lib/portal-session.ts`                   | `signOut()`               | `inactivity timer calls signOut after 30min` | WIRED | Lines 81-83: `logoutTimerRef.current = setTimeout(() => { signOut({ callbackUrl: "/portal/login" }); }, INACTIVITY_TIMEOUT_MS)` |
| `src/app/(portal)/layout.tsx`                 | `PortalSessionProvider`   | `import and wrap children`       | WIRED      | Line 7 import + line 34: `<PortalSessionProvider>` wrapping all children |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                       | Status    | Evidence                                                                                  |
|-------------|------------|-----------------------------------------------------------------------------------|-----------|-------------------------------------------------------------------------------------------|
| AUTH-01     | 44-01      | Anwalt kann Einladungslink fuer Mandant-Beteiligten generieren                    | SATISFIED | `BeteiligteSection` shows `PortalInviteDialog` for `rolle=MANDANT`, ANWALT/ADMIN only; `POST /api/portal/invite` creates token + sends email |
| PORTAL-02   | 44-01      | Jeder Beteiligter mit Rolle MANDANT kann separat zum Portal eingeladen werden     | SATISFIED | Per-Beteiligter invite via `beteiligteId`; separate `PortalInvite` records per entry     |
| AUTH-02     | 44-02      | Mandant kann ueber Einladungslink Passwort setzen und Account aktivieren          | SATISFIED | `/portal/activate` + `POST /api/portal/activate` — token validation, bcrypt, `$transaction` user creation |
| AUTH-03     | 44-02      | Mandant kann sich mit E-Mail und Passwort im Portal einloggen                     | SATISFIED | `/portal/login` page with `signIn("credentials")` → `/portal/dashboard`                 |
| AUTH-04     | 44-02      | Mandant-Session bleibt ueber Browser-Refresh erhalten (JWT)                      | SATISFIED | `auth.ts`: `session: { strategy: "jwt" }`, JWT callbacks stamp role + kontaktId         |
| AUTH-05     | 44-02      | Mandant wird nach Inaktivitaet automatisch ausgeloggt                             | SATISFIED | `PortalSessionProvider` 30min setTimeout → `signOut`; wired in `(portal)/layout.tsx`    |
| AUTH-06     | 44-02      | Mandant kann eigenes Passwort ueber E-Mail-Link zuruecksetzen                    | SATISFIED | Request + confirm API routes; password-reset email template; passwort-vergessen + passwort-reset pages |

**All 7 requirements satisfied. No orphaned requirements.**

---

### Anti-Patterns Found

| File                                               | Line | Pattern      | Severity | Impact                                                     |
|----------------------------------------------------|------|--------------|----------|------------------------------------------------------------|
| `src/components/akten/beteiligte-section.tsx`      | 39   | `return null` | Info     | Empty-guard pattern for empty beteiligte array — expected behavior, not a stub |

No blocker or warning-level anti-patterns found. The `return null` at line 39 of `beteiligte-section.tsx` is a legitimate empty-list guard, not a placeholder implementation.

---

### Human Verification Required

#### 1. Full Invite-to-Activation Flow

**Test:** As an Anwalt, open an Akte with a MANDANT beteiligter who has an email. Click "Portal-Einladung" in the Beteiligte section. Open the activation URL from the database (or email if SMTP configured). Enter a valid password.
**Expected:** Dialog shows email address, invite created in DB, activation page loads with "Willkommen im Mandantenportal", password form accepts input meeting complexity requirements, success screen shows "Account aktiviert!" with link to login.
**Why human:** Requires live PostgreSQL + SMTP or direct DB inspection; complete UI flow including toast feedback cannot be verified statically.

#### 2. Portal Login and Session Persistence

**Test:** Log in at `/portal/login` with the activated MANDANT credentials. Verify the browser URL after login. Reload the page.
**Expected:** Redirect to `/portal/dashboard` on login. Session survives page reload. MANDANT role user does NOT land on internal `/login`.
**Why human:** JWT cookie persistence requires a live browser session; NextAuth redirect behavior is runtime-only.

#### 3. Auto-Logout Inactivity Timer

**Test:** Log in as MANDANT. Sit idle on any portal page for 25 minutes.
**Expected:** Warning dialog appears ("Sitzung laeuft ab in X Minuten"). Clicking "Weiter" resets the timer. After total 30min inactivity: automatic logout and redirect to `/portal/login`.
**Why human:** Timer-based behavior cannot be statically verified; requires real-time observation.

#### 4. Password Reset Anti-Enumeration

**Test:** Submit the passwort-vergessen form with an email that does NOT exist in the system.
**Expected:** HTTP 200 response with the generic message. No difference in response time or message compared to a valid email.
**Why human:** Anti-enumeration behavior requires a live HTTP request; response parity cannot be verified statically.

---

### Commit Verification

All 5 phase commits verified in git history:

| Commit    | Task                                                   |
|-----------|--------------------------------------------------------|
| `bb0d57e` | feat(44-01): PortalInvite model, invite API endpoints, email template |
| `1bc1e7b` | feat(44-01): portal invite dialog and beteiligte section in Akte detail |
| `dd10d68` | feat(44-02): account activation page and API endpoint  |
| `5ca3d9c` | feat(44-02): portal login enhancements, session management, auto-logout |
| `2185e0c` | feat(44-02): password reset flow with email template   |

---

### Summary

Phase 44 goal is fully achieved. All 7 requirements (AUTH-01 through AUTH-06, PORTAL-02) are implemented with substantive, wired code. No stubs, no orphaned artifacts, no placeholder implementations found.

The complete Mandant authentication lifecycle is present:

- **Invite system:** `PortalInvite` model with secure `crypto.randomUUID()` token, 7-day expiry, status tracking (PENDING/ACCEPTED/EXPIRED/REVOKED). ANWALT/ADMIN can invite from Akte detail. Revoke-before-create prevents token accumulation.
- **Account activation:** Token validated, bcrypt(12) password hash created, MANDANT User created in atomic `$transaction`, invite marked ACCEPTED.
- **Login:** `POST credentials` via NextAuth, JWT strategy, `kontaktId` stamped on token for MANDANT users, redirect to `/portal/dashboard`.
- **Session:** JWT-based, survives browser refresh. Middleware correctly exempts all portal public routes.
- **Auto-logout:** `PortalSessionProvider` with 25min warning dialog and 30min `signOut`, throttled activity tracking, wired into portal layout.
- **Password reset:** Anti-enumeration 200 on request, `crypto.randomUUID()` token with 1-hour expiry, bcrypt hash on confirm, audit logging on both operations.

The only remaining items are 4 human-verification tests requiring a live environment, all of which are behaviorally expected based on the static code analysis.

---

_Verified: 2026-03-03T12:10:16Z_
_Verifier: Claude (gsd-verifier)_
