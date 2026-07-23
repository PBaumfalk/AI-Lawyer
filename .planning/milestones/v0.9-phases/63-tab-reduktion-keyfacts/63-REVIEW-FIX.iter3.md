---
phase: 63-tab-reduktion-keyfacts
fixed_at: 2026-07-23T11:05:00Z
review_path: .planning/phases/63-tab-reduktion-keyfacts/63-REVIEW.md
iteration: 2
findings_in_scope: 2
fixed: 2
skipped: 0
status: partial
---

# Phase 63: Code Review Fix Report

**Fixed at:** 2026-07-23T11:05:00Z
**Source review:** .planning/phases/63-tab-reduktion-keyfacts/63-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 2 (WR-01, WR-02; fix_scope = critical_warning, no Critical findings present)
- Fixed: 2 (one as a pragmatic partial mitigation — see WR-01)
- Skipped: 0

**Status rationale:** `partial` — WR-02 is fully fixed; WR-01 received the best pragmatic mitigation available in scope (the App Router has no router-events API, so complete coverage of soft navigation is not safely possible without a global interception refactor or auto-save redesign). The 11 Info findings were out of scope and remain open.

## Fixed Issues

### WR-02: SSRF deny-list in `validate-url.ts` misses several non-public IPv4 ranges

**Files modified:** `src/lib/jlawyer/validate-url.ts`
**Commit:** bdc2641
**Applied fix:** Applied the reviewer's suggestion in full:
- IPv4: block `224.0.0.0/4` (multicast) and `240.0.0.0/4` (reserved) via `a >= 224`, benchmarking range `198.18.0.0/15`, and `192.0.0.0/24` (IETF protocol assignments).
- IPv6: block transition mechanisms with embedded IPv4 outright — 6to4 (`2002::/16`) and Teredo (`2001:0000::/32`) — since the embedded address is not inspected and these prefixes are never legitimate j-lawyer targets.
- Reject URLs with userinfo (`url.username || url.password`) at validation time with the German error message "Zugangsdaten gehoeren nicht in die URL", instead of letting undici fail later with a confusing TypeError.

**Verification:** Tier 1 (re-read modified sections) + Tier 2 (`tsc --noEmit --strict` on the file — passed).

### WR-01: Falldaten unsaved-changes guard is bypassed by in-app navigation away from the page

**Status: fixed — partial mitigation, requires human verification**

**Files modified:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx`, `src/components/akten/akte-detail-tabs.tsx`
**Commit:** 4fc48e9
**Applied fix:** Implemented option (a) from the review: route the E-Mails KPI card's `router.push` through the same unsaved-changes guard as tab switches.
- `AkteDetailTabs` gained a `registerGuardedNavigation` prop. Internally it exposes `requestGuardedNavigation(action)`: if the Falldaten tab is active and dirty, the action is stored as `pendingAction` and the existing `AlertDialog` is shown; otherwise the action runs immediately. On "Trotzdem fortfahren" the deferred action executes; on "Abbrechen" it is discarded.
- `AkteDetailClient` registers this handler into `guardedNavRef` and routes `router.push(/email?akteId=...)` through it.
- Dialog wording generalized ("Moechten Sie trotzdem fortfahren?" / "Trotzdem fortfahren") since it now covers page navigation as well as tab switches.

**Why partial:** The App Router has no router-events API, and `beforeunload` does not fire on client-side navigation. This fix covers the concrete path introduced by this phase (E-Mails KPI card). Arbitrary sidebar-link clicks and browser Back/Forward still bypass the guard. Closing that gap requires either a document-level capture-phase click interceptor on anchors while `falldatenDirty` (fragile, needs careful maintainability review) or eliminating the data-loss class entirely via debounced auto-save of Falldaten drafts (a design decision). Recommend tracking the auto-save option as a deferred item.

**Verification:** Tier 1 (re-read modified sections) + Tier 2 (full-project `tsc --noEmit` in the fix worktree — zero errors). Logic note: the deferred-action flow through the dialog is behavior-level logic that syntax checks cannot validate; manual smoke test recommended (edit Falldaten, click E-Mails KPI, confirm and cancel the dialog).

## Skipped Issues

None — all in-scope findings were addressed.

## Out-of-Scope (Info findings, unchanged)

IN-01 through IN-11 remain open (fix_scope = critical_warning). Notably IN-09 ("Naechste Frist" labels include Termine) and IN-10 (decrypt fallback masks key misconfiguration) may be worth promoting to warnings in a future round.

---

_Fixed: 2026-07-23T11:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
