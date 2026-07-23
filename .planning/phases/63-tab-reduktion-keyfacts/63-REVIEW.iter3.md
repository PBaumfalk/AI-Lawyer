---
phase: 63-tab-reduktion-keyfacts
reviewed: 2026-07-23T10:34:12Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/app/(dashboard)/akten/[id]/akte-detail-client.tsx
  - src/components/akten/akte-detail-tabs.tsx
  - src/lib/jlawyer/client.ts
  - src/lib/jlawyer/credentials.ts
  - src/lib/jlawyer/validate-url.ts
findings:
  critical: 0
  warning: 2
  info: 11
  total: 13
status: issues_found
---

# Phase 63: Code Review Report (Re-Review, Iteration 3)

**Reviewed:** 2026-07-23T10:34:12Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Re-review after the iter-2 fix round. All five fixed findings from the previous review were verified against the code:

- **CR-01 (KPI cards bypassed Falldaten dirty guard)** — verified fixed. `AkteDetailTabs` registers its guarded `handleTabChange` via `registerTabChange` (akte-detail-tabs.tsx:168-170), and `AkteDetailClient.handleKpiClick` routes through `tabChangeRef.current(tab)` (akte-detail-client.tsx:245).
- **WR-01 (Frist due today/overdue hidden)** — verified fixed. Day-granularity comparison via `startOfToday` (akte-detail-client.tsx:106-110) plus an explicit overdue-Frist fallback surfaced in rose styling (lines 113-117, 184-195).
- **WR-02 (`?tab=` ignored on soft navigation)** — verified fixed. Effect keyed on `paramTab` routes through the guarded handler (akte-detail-client.tsx:258-263).
- **WR-03 (plaintext j-lawyer password)** — verified fixed. `encryptJLawyerPassword` applied at save (api/admin/jlawyer/route.ts:46), decryption at both read sites (test/route.ts:31, migrate/route.ts:85), reusing the AES-256-GCM helper from `src/lib/email/crypto.ts`.
- **WR-04 (SSRF / credential reflection)** — verified fixed. `validateJLawyerBaseUrl` enforced at save route, test route, and in the `JLawyerClient` constructor (client.ts:17-20); error body reflection removed from `get()` (client.ts:68).

No critical issues remain. Two new warnings were found this round: the Falldaten dirty guard still does not cover soft navigation away from the page (the new "E-Mails" KPI card is one such path), and the SSRF deny-list in `validate-url.ts` misses several non-public IPv4 ranges. The eight Info findings from the previous review were not in the fixer's scope and are still present; they are re-listed here with current line numbers, plus three new Info items.

## Warnings

### WR-01: Falldaten unsaved-changes guard is bypassed by in-app navigation away from the page

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:239-241` and `src/components/akten/akte-detail-tabs.tsx:174-182`
**Issue:** The data-loss protection for dirty Falldaten has two layers: the tab-switch guard in `handleTabChange` and a `beforeunload` listener. Neither fires on Next.js App Router client-side (soft) navigation — `beforeunload` only fires on full document unload. The "E-Mails" KPI card added in this phase calls `router.push(\`/email?akteId=${akte.id}\`)` (akte-detail-client.tsx:240), which is exactly such a soft navigation. Reproduction: open Falldaten, edit a field, click the "E-Mails" KPI card (or any sidebar link, or browser Back) — the page unmounts, `FalldatenTab` state is destroyed, and no warning ever appears. The guard gives a false sense of protection while the most common navigation paths remain uncovered.
**Fix:** There is no router-events API in the App Router, so the pragmatic mitigations are: (a) route the E-Mails KPI through the same guarded path — e.g. before `router.push`, check the dirty state via a ref mirrored from `AkteDetailTabs` (register an `isFalldatenDirty` getter alongside `registerTabChange`) and show the same `AlertDialog` before pushing; and (b) for arbitrary link/back navigation, intercept document-level clicks on anchors (`capture`-phase click listener while `falldatenDirty`) or accept the gap and reduce reliance on client-side form state by auto-saving Falldaten (debounced draft persistence), which removes the data-loss class entirely. Option (a) is a small change covering the path introduced by this phase; (b) is a design decision worth a deferred item.

### WR-02: SSRF deny-list in `validate-url.ts` misses several non-public IPv4 ranges

**File:** `src/lib/jlawyer/validate-url.ts:36-47`
**Issue:** The IPv4 check blocks 0/8, 10/8, 127/8, 172.16/12, 192.168/16, 169.254/16, and 100.64/10, but passes other non-public/reserved ranges: `224.0.0.0/4` (multicast), `240.0.0.0/4` (reserved, including 255.255.255.255), `198.18.0.0/15` (benchmarking — legitimately used inside lab/overlay networks), and `192.0.0.0/24` (IETF protocol assignments). On the IPv6 side, transition mechanisms that embed an IPv4 address — 6to4 (`2002::/16`) and Teredo (`2001::/32`) — are not inspected, so e.g. `[2002:7f00:1::]` (6to4 for 127.0.0.1) passes. Practical exploitability is low (the endpoint is ADMIN-gated and these ranges are rarely routable), but this file is the phase's SSRF control and a deny-list should be exhaustive or fail closed. Also note: a `baseUrl` containing userinfo (`https://user:pass@host/`) passes validation but undici's `fetch` rejects credentialed URLs at request time, surfacing a confusing `TypeError` instead of a validation error.
**Fix:** Extend the IPv4 checks:

```ts
if (a >= 224) return true;                            // 224/4 multicast + 240/4 reserved
if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking 198.18/15
if (a === 192 && b === 0 && Number(m[3]) === 0) return true; // 192.0.0.0/24
```

For IPv6, either decode 6to4/Teredo embedded IPv4 and recurse into the IPv4 check, or simply block `2002::/16` and `2001::/32` outright (they are never legitimate j-lawyer targets). Also reject URLs with userinfo in `validateJLawyerBaseUrl` (`if (url.username || url.password) return { ok: false, error: "Zugangsdaten gehoeren nicht in die URL" }`). Longer term, an allow-list or DNS-resolution check is more robust than an expanding deny-list — the DNS-rebinding limitation is already documented in the file header.

## Info

### IN-01: `completeness` state is write-only (dead state) — carried from iter-2

**File:** `src/components/akten/akte-detail-tabs.tsx:135-139,317`
**Issue:** `completeness` is populated via `onCompletenessChange={setCompleteness}` but never read anywhere in the component — a leftover from the removed Falldaten progress UI.
**Fix:** Either render the percentage (e.g. a badge on the Falldaten overflow item, which would make the overflow menu more informative) or remove the state and the prop wiring.

### IN-02: `hasAnyInfo` guard is effectively dead code — carried from iter-2

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:128-130`
**Issue:** The condition includes `akte.status`, a non-nullable Prisma field that is always truthy, so `!hasAnyInfo` can never be true and `KeyFactsPanel` always renders.
**Fix:** Drop `akte.status` from the computation or remove the guard entirely.

### IN-03: Unreachable `throw` after retry loop — carried from iter-2

**File:** `src/lib/jlawyer/client.ts:51`
**Issue:** `throw lastError ?? new Error("J-Lawyer request failed")` is unreachable: for `maxRetries >= 1` every control path inside the loop either returns a `Response` or rethrows on the final attempt.
**Fix:** Remove the trailing throw, or restructure so exhaustiveness is visible to the compiler.

### IN-04: Inconsistent Frist warning thresholds (7 vs 14 days) — carried from iter-2

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:123,176`
**Issue:** Amber warning styling starts at `<= 7` days, but the "(N Tage)" countdown label appears at `<= 14` days; a Frist 10 days out shows a countdown with no warning color.
**Fix:** Introduce one constant (e.g. `const FRIST_WARN_DAYS = 7`) and use it for both the styling and the countdown display.

### IN-05: Empty-string `firma` renders an empty party name — carried from iter-2

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:89,92,95`
**Issue:** `kontakt.firma ?? [vorname, nachname]...` only falls through on `null`/`undefined`; an empty-string `firma` (plausible from imports) yields `""` and renders an empty bold span.
**Fix:** Use `||` instead of `??`, and treat an empty joined name as `null`.

### IN-06: "Gegner" label can display the Gegnervertreter's name — carried from iter-2

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:85,206-211`
**Issue:** The lookup accepts `GEGNER` or `GEGNERVERTRETER`, but the panel always labels the match "Gegner:". When only opposing counsel is recorded, the lawyer's name appears under the party label — misleading in a legal context.
**Fix:** Track which role matched and render "Gegnervertreter:" when `rolle === "GEGNERVERTRETER"`.

### IN-07: `setTimeout` scroll after tab switch is a timing race with no cleanup — carried from iter-2

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:247-252`
**Issue:** The fixed 150 ms delay assumes the Finanzen tab has mounted; on a slow render `getElementById` returns null and the scroll silently never happens. The timer is also not cleared on unmount. New interaction since the CR-01 fix: if the tab switch is intercepted by the unsaved-changes dialog, the timer fires while the Finanzen tab is still inactive, so after the user confirms the switch the scroll never occurs.
**Fix:** Scroll from an effect keyed on `activeTab === "finanzen"` (with `requestAnimationFrame` or a ref on the section) instead of a fixed timeout, and clear any pending timer on unmount.

### IN-08: Path segments interpolated without encoding in JLawyerClient — carried from iter-2

**File:** `src/lib/jlawyer/client.ts:87,92,102,110,123`
**Issue:** `caseId`/`docId` are interpolated raw into request paths; an ID containing `/`, `?`, or `#` would corrupt the request. IDs come from the j-lawyer API so practical risk is low, but encoding is a one-line defense.
**Fix:** Wrap interpolations in `encodeURIComponent`.

### IN-09: "Naechste Frist" / "Ueberfaellig" labels include Termine, not just Fristen

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:107-117,173,187`
**Issue:** `openEintraege` filters only on `!k.erledigt`; the `typ` field on `kalenderEintraege` (AkteData, akte-detail-tabs.tsx:75) is never consulted. A plain Termin (e.g. a client meeting) is surfaced under the label "Naechste Frist" — and, when overdue, as "Ueberfaellig" in rose warning styling. In a legal-deadline UI, presenting an ordinary appointment as an overdue Frist creates false urgency; conversely the strip's purpose suggests filtering to the FRIST type for deadline semantics, and optionally showing the next Termin separately.
**Fix:** Filter the Frist computations by entry type: `.filter((k) => !k.erledigt && k.typ === "FRIST")` (verify the exact enum value in the Prisma schema / KalenderEintrag model), or relabel the strip entries to reflect the actual type.

### IN-10: `decryptJLawyerPassword` fallback masks key misconfiguration

**File:** `src/lib/jlawyer/credentials.ts:19-25`
**Issue:** The catch-all fallback returns the raw stored value on *any* decrypt error. If `EMAIL_ENCRYPTION_KEY` is missing/too short (getEncryptionKey throws, src/lib/email/crypto.ts:22-27) or was rotated, the stored ciphertext is silently returned as the password and the failure only surfaces later as a j-lawyer 401 — far from the actual cause. The admin test endpoint will report "J-Lawyer API error 401" instead of "encryption key misconfigured".
**Fix:** Only fall back for legacy plaintext values, not for decryption failures: check the format first (e.g. `/^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/`) and return the raw value only when it does *not* match; let decrypt errors propagate (or wrap them in an explicit "Schluessel falsch/nicht gesetzt" error).

### IN-11: Stale `pendingTab` on ESC/overlay close; per-render re-registration of tab handler

**File:** `src/components/akten/akte-detail-tabs.tsx:339,349-356` and `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:320-322`
**Issue:** (a) Closing the unsaved-changes dialog via ESC or overlay click goes through `onOpenChange={setShowUnsavedDialog}` and leaves `pendingTab` set, while the explicit "Abbrechen" button clears it — an inconsistency (harmless today because `pendingTab` is always overwritten before the dialog reopens, but a trap for future edits). (b) `registerTabChange` is passed as an inline arrow, so its identity changes on every parent render and the registration effect (akte-detail-tabs.tsx:168-170) re-runs each render; harmless but noisy.
**Fix:** (a) Use `onOpenChange={(open) => { setShowUnsavedDialog(open); if (!open) setPendingTab(null); }}`. (b) Wrap the parent callback in `useCallback` with a stable dep set.

---

_Reviewed: 2026-07-23T10:34:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
