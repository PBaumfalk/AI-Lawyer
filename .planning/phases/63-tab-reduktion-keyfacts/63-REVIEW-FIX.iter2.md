---
phase: 63-tab-reduktion-keyfacts
fixed_at: 2026-07-23T12:30:00Z
review_path: .planning/phases/63-tab-reduktion-keyfacts/63-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 63: Code Review Fix Report

**Fixed at:** 2026-07-23T12:30:00Z
**Source review:** .planning/phases/63-tab-reduktion-keyfacts/63-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Unsaved Falldaten changes silently lost when navigating via KPI cards

**Files modified:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx`, `src/components/akten/akte-detail-tabs.tsx`
**Commit:** 658fda9
**Status:** fixed: requires human verification
**Applied fix:** Inverted control per the review suggestion. `AkteDetailTabs` now accepts a `registerTabChange` prop and registers its guarded `handleTabChange` via an effect (re-registered whenever `currentTab`/`falldatenDirty` change, so the closure is always fresh). `AkteDetailClient` holds the handler in `tabChangeRef` and `handleKpiClick` calls `tabChangeRef.current(tab)` instead of `setActiveTab(tab)`, so KPI-card navigation now triggers the same unsaved-changes `AlertDialog` as tab triggers and the overflow menu. Behavioral fix — please manually verify: edit a Falldaten field, click a KPI card, confirm the warning dialog appears and cancellation keeps the form state.

### WR-01: "Naechste Frist" hides Fristen due today or already overdue

**Files modified:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx`
**Commit:** 8b50cd5
**Status:** fixed: requires human verification
**Applied fix:** Comparison now uses day granularity (`startOfToday` at local midnight) instead of the current timestamp, so a Frist due today stays visible all day and the previously unreachable `"heute"` branch works. Additionally implemented the reviewer's optional hardening: when no upcoming Frist exists, the most recent overdue (not erledigt) entry is surfaced in rose styling as "Ueberfaellig: titel - datum (seit N Tagen)" so an expired deadline never silently disappears from the Key-Facts strip. `overdueFrist` was added to `hasAnyInfo`. Date-math logic — please spot-check with a Frist dated today and one dated yesterday.

### WR-02: `?tab=` search param only honored on initial mount

**Files modified:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx`
**Commit:** 97d2974
**Applied fix:** Added an effect keyed on `searchParams.get("tab")` that re-applies the param on client-side navigations to the same route (the `useState` initializer is kept for first paint). The sync deliberately routes through `tabChangeRef.current(paramTab)` so the CR-01 Falldaten dirty guard is respected when a `?tab=` navigation would leave the Falldaten tab with unsaved changes.

### WR-03: j-lawyer password stored in plaintext in SystemSetting

**Files modified:** `src/lib/jlawyer/credentials.ts` (new), `src/app/api/admin/jlawyer/route.ts`, `src/app/api/admin/jlawyer/test/route.ts`, `src/app/api/admin/jlawyer/migrate/route.ts`
**Commit:** 8f5f7b1
**Applied fix:** Found the existing AES-256-GCM helper in `src/lib/email/crypto.ts` (`encryptCredential`/`decryptCredential`, key derived from `EMAIL_ENCRYPTION_KEY`) and applied it per the review's fallback instruction. New thin wrapper `src/lib/jlawyer/credentials.ts` exposes `encryptJLawyerPassword`/`decryptJLawyerPassword`; decryption falls back to the raw stored value so legacy plaintext entries keep working. The admin save route encrypts before upsert; both read call sites (test connection, migration) decrypt. Note: saving a new password requires `EMAIL_ENCRYPTION_KEY` (>= 32 chars) to be set, same as the email module. Operators should re-save the j-lawyer password once via the admin UI to convert existing plaintext entries.

### WR-04: Credentials sent to arbitrary admin-supplied URL (SSRF surface)

**Files modified:** `src/lib/jlawyer/validate-url.ts` (new), `src/lib/jlawyer/client.ts`, `src/app/api/admin/jlawyer/test/route.ts`, `src/app/api/admin/jlawyer/route.ts`
**Commit:** 0da7f08
**Applied fix:** New `validateJLawyerBaseUrl` helper enforces: only `http:`/`https:` schemes; `https:` + public host by default; RFC-1918/loopback/link-local/CGNAT IPv4, IPv6 loopback/link-local/ULA, `localhost`, and IPv4-mapped IPv6 (including Node's hex-normalized form, e.g. `[::ffff:7f00:1]`) are blocked unless `JLAWYER_ALLOW_PRIVATE_URLS=true` is set (explicit opt-in for on-prem j-lawyer, which commonly runs at plain-http private IPs). Validation is enforced at three layers: save route (400 before persisting), test route (400 before constructing the client), and the `JLawyerClient` constructor (defense in depth for the migration route and any future caller). Also stripped the response body from the error thrown in `client.ts` `get()` — it is now `J-Lawyer API error ${status} at ${path}` with no reflected body, closing the credential-reflection/read primitive. Detection logic sanity-tested against 17 URL cases (all pass). Known limitation documented in the helper: hostnames resolving to private IPs (DNS rebinding class) are not caught.

---

_Fixed: 2026-07-23T12:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
