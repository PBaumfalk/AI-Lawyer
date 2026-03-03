---
phase: 43-portal-schema-shell
verified: 2026-03-03T12:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 43: Portal Schema + Shell Verification Report

**Phase Goal:** Prisma schema (MANDANT role, portal fields) + portal route group (/portal/*) with Glass UI layout shell
**Verified:** 2026-03-03T12:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                              | Status     | Evidence                                                                 |
|----|------------------------------------------------------------------------------------|------------|--------------------------------------------------------------------------|
| 1  | UserRole enum contains MANDANT value                                               | VERIFIED   | `prisma/schema.prisma` line 19: `MANDANT` in UserRole enum              |
| 2  | User model has portal-specific fields (inviteToken, inviteExpiresAt, inviteAcceptedAt, kontaktId) | VERIFIED | Lines 493-497: all four fields present with correct types and @unique constraints |
| 3  | NextAuth authorize() allows MANDANT users to log in and populates role in JWT/session | VERIFIED | `auth.ts` returns `role: user.role` generically — no UserRole filter; JWT/session callbacks pass role through |
| 4  | RBAC PERMISSIONS includes MANDANT role with zero internal permissions              | VERIFIED   | `src/lib/rbac.ts` lines 66-76: MANDANT entry with all nine flags false  |
| 5  | /portal/login renders a Portal-branded Glass UI login page (publicly accessible)  | VERIFIED   | `src/app/(portal)/login/page.tsx`: 107 lines, Shield icon, glass-lg class, `bg-mesh`, signIn("credentials") |
| 6  | /portal/dashboard renders portal layout with sidebar and header                   | VERIFIED   | `src/app/(portal)/layout.tsx`: PortalSidebar + PortalHeader rendered; `dashboard/page.tsx` placeholder exists |
| 7  | Portal layout is visually separate from internal dashboard                        | VERIFIED   | Own sidebar/header components (no internal nav links); no Socket/Notifications/Upload providers imported |
| 8  | Unauthenticated request to /portal/dashboard redirects to /portal/login           | VERIFIED   | `layout.tsx` line 18-20: checks `!session?.user OR role !== "MANDANT"`, calls `redirect("/portal/login")` |
| 9  | Kanzlei name from Briefkopf is displayed in portal sidebar/header                 | VERIFIED   | `layout.tsx` lines 23-29: `prisma.briefkopf.findFirst({ where: { istStandard: true } })` passed as props to PortalSidebar and PortalHeader |

**Score:** 9/9 truths verified

---

### Required Artifacts

#### Plan 43-01 Artifacts

| Artifact                        | Expected                                                        | Status    | Details                                                                          |
|---------------------------------|-----------------------------------------------------------------|-----------|----------------------------------------------------------------------------------|
| `prisma/schema.prisma`          | MANDANT in UserRole enum, portal fields on User, Kontakt.portalUser relation | VERIFIED | MANDANT in enum (line 19), inviteToken/inviteExpiresAt/inviteAcceptedAt/kontaktId on User (lines 493-497), portalUser on Kontakt (line 654) |
| `src/lib/auth.ts`               | Credentials provider handles MANDANT users via generic role passthrough | VERIFIED | Generic `role: user.role` return at line 71; no MANDANT-specific filter needed or present |
| `src/types/next-auth.d.ts`      | Session/JWT types reference UserRole from @prisma/client (auto-includes MANDANT) | VERIFIED | File imports `UserRole` from `@prisma/client` — MANDANT is auto-included after `prisma generate` |
| `src/lib/rbac.ts`               | MANDANT entry in PERMISSIONS with all false; MANDANT in ROLE_LABELS | VERIFIED | PERMISSIONS.MANDANT (lines 66-76) all false; ROLE_LABELS.MANDANT = "Mandant" (line 295) |

#### Plan 43-02 Artifacts

| Artifact                                        | Expected                                                          | Status    | Details                                                                      |
|-------------------------------------------------|-------------------------------------------------------------------|-----------|------------------------------------------------------------------------------|
| `src/middleware.ts`                             | Updated matcher to bypass /portal/login                          | VERIFIED  | Line 6: `portal/login` added to negative lookahead; 8 lines total, substantive |
| `src/app/(portal)/layout.tsx`                  | Portal layout with auth check, SessionProvider, sidebar + header | VERIFIED  | 44 lines; auth() called, MANDANT role guard, Briefkopf fetch, PortalSidebar + PortalHeader rendered |
| `src/app/(portal)/login/page.tsx`              | Portal login page with Glass UI                                   | VERIFIED  | 107 lines; glass-lg, bg-mesh, Shield icon, signIn("credentials"), router.push("/portal/dashboard") |
| `src/app/(portal)/dashboard/page.tsx`          | Portal dashboard placeholder page                                 | VERIFIED  | 14 lines; glass-card, "Willkommen im Mandantenportal" heading              |
| `src/components/portal/portal-sidebar.tsx`     | Slim sidebar with 4 nav items + Kanzlei branding + logout        | VERIFIED  | 88 lines; Meine Akten/Nachrichten/Dokumente/Profil nav items; kanzleiName + logoUrl props; signOut button |
| `src/components/portal/portal-header.tsx`      | Portal header with Kanzlei branding and user name                | VERIFIED  | 20 lines; glass-panel, "{kanzleiName} - Mandantenportal", useSession() for user name |

---

### Key Link Verification

#### Plan 43-01 Key Links

| From                      | To                  | Via                                     | Status  | Details                                                                 |
|---------------------------|---------------------|-----------------------------------------|---------|-------------------------------------------------------------------------|
| `prisma/schema.prisma`    | `src/lib/auth.ts`   | UserRole.MANDANT used in authorize flow | VERIFIED | `auth.ts` returns `role: user.role` — MANDANT included generically via Prisma-generated enum. No filter excludes MANDANT |
| `prisma/schema.prisma`    | `src/lib/rbac.ts`   | MANDANT key in PERMISSIONS record       | VERIFIED | Pattern `MANDANT.*canFreigeben`: `rbac.ts` line 66-67 matches; `canFreigeben: false` present |

#### Plan 43-02 Key Links

| From                             | To                                    | Via                                            | Status  | Details                                                              |
|----------------------------------|---------------------------------------|------------------------------------------------|---------|----------------------------------------------------------------------|
| `src/app/(portal)/layout.tsx`   | `src/lib/auth.ts`                     | auth() call for session check                  | VERIFIED | Line 1 import `auth` from `@/lib/auth`; line 16 `const session = await auth()` |
| `src/app/(portal)/layout.tsx`   | `src/components/portal/portal-sidebar.tsx` | import and render PortalSidebar           | VERIFIED | Line 5 import; line 34 `<PortalSidebar kanzleiName={kanzleiName} logoUrl={logoUrl} />` |
| `src/middleware.ts`             | `/portal/login`                       | matcher exclusion for portal/login             | VERIFIED | Line 6: `portal/login` in negative lookahead regex |

---

### Requirements Coverage

| Requirement | Source Plans | Description                                                        | Status    | Evidence                                                                  |
|-------------|-------------|--------------------------------------------------------------------|-----------|---------------------------------------------------------------------------|
| PORTAL-01   | 43-01, 43-02 | Mandant kann /portal/* Seiten mit eigenem Glass-Layout aufrufen  | SATISFIED | Portal route group with MANDANT-guarded layout, Glass UI sidebar/header, and /portal/login public page all exist and are wired |

**Orphaned requirements check:** No other requirements are mapped to Phase 43 in REQUIREMENTS.md. PORTAL-02, PORTAL-03, PORTAL-04 are assigned to Phases 44 and 45.

---

### Commit Verification

All four commits documented in SUMMARY files are confirmed present in git log:

| Commit    | Task                                                           | Status    |
|-----------|----------------------------------------------------------------|-----------|
| `1b7f743` | feat(43-01): add MANDANT role and portal fields to Prisma schema | VERIFIED |
| `6348ed1` | feat(43-01): add MANDANT role to RBAC permissions and role labels | VERIFIED |
| `b5c6d64` | feat(43-02): add portal layout with auth guard and middleware bypass | VERIFIED |
| `cdeb648` | feat(43-02): create portal sidebar, header, login page, and dashboard | VERIFIED |

---

### Anti-Patterns Found

| File                                          | Line | Pattern           | Severity | Impact                                                        |
|-----------------------------------------------|------|-------------------|----------|---------------------------------------------------------------|
| `src/app/(portal)/login/page.tsx`             | 72, 89 | `placeholder="..."` | Info | HTML input placeholder attributes — not code stubs. No impact |

No blocker or warning anti-patterns found. The `placeholder` attributes are standard HTML form UX — not implementation placeholders.

---

### Human Verification Required

#### 1. Glass UI Visual Appearance

**Test:** Navigate to `/portal/login` in a browser. Inspect the backdrop-blur and frosted glass effect.
**Expected:** Login card shows `glass-lg` frosted glass effect over `bg-mesh` gradient background. Shield icon visible. Portal branding ("Mandantenportal") displayed.
**Why human:** CSS `backdrop-filter` rendering cannot be verified from source code.

#### 2. MANDANT Login Flow End-to-End

**Test:** Create a User with `role = MANDANT` in the database, then log in via `/portal/login`. After login, verify redirect lands on `/portal/dashboard`.
**Expected:** Credentials accepted, JWT populated with `role: "MANDANT"`, redirect to `/portal/dashboard`, portal layout (sidebar with 4 nav items, header with kanzlei name) rendered.
**Why human:** Requires a running database + MANDANT user record to execute the full NextAuth flow.

#### 3. Non-MANDANT Role Redirect Guard

**Test:** Log in as ANWALT (internal role), then navigate to `/portal/dashboard`.
**Expected:** Redirected to `/portal/login` immediately (layout.tsx role guard triggers).
**Why human:** Requires a running application with an active session to test the redirect behavior.

#### 4. Kanzlei Branding Display

**Test:** With a `Briefkopf` record marked `istStandard: true` in the database, load `/portal/dashboard`.
**Expected:** `kanzleiName` from that Briefkopf record appears in both the sidebar header area and the portal header bar ("Kanzleiname - Mandantenportal").
**Why human:** Requires a running database with a seeded Briefkopf record.

---

### Gaps Summary

No gaps found. All 9 observable truths are verified. All 8 artifacts pass all three levels (exists, substantive, wired). All 5 key links are confirmed wired. PORTAL-01 is fully satisfied. No blocker anti-patterns detected.

The one deferred item (db push skipped due to database offline) is documented as an operational concern — the schema validates and Prisma client generates successfully. The schema change is correct and will apply when `npx prisma db push` is run against a live database.

---

_Verified: 2026-03-03T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
