---
phase: 63-tab-reduktion-keyfacts
reviewed: 2026-07-23T12:00:00Z
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
  warning: 3
  info: 14
  total: 17
status: issues_found
---

# Phase 63: Code Review Report (Re-Review, Iteration 4)

**Reviewed:** 2026-07-23T12:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Re-review after the iter-3 fix round. Both warnings from the previous review were verified against the code:

- **WR-01 (Falldaten dirty guard bypassed by soft navigation)** — verified fixed. `AkteDetailTabs` registers `requestGuardedNavigation` via `registerGuardedNavigation` (akte-detail-tabs.tsx:185-199), the parent stores it in `guardedNavRef` (akte-detail-client.tsx:241-243), and the E-Mails KPI routes through it (akte-detail-client.tsx:246-249). The deferred action is held in `pendingAction` and executed on dialog confirm (akte-detail-tabs.tsx:388-397).
- **WR-02 (SSRF deny-list gaps)** — verified fixed. `224.0.0.0/4` + `240.0.0.0/4`, `198.18.0.0/15`, and `192.0.0.0/24` are now blocked (validate-url.ts:52-54); 6to4 `2002::/16` and Teredo `2001::/32` are blocked outright (lines 22-23); URLs with userinfo are rejected (lines 78-80).

No critical issues remain. However, the iter-3 SSRF fixes themselves contain two new bypass classes (trailing-dot hostnames and compressed ULA IPv6), and the day-granularity Frist fix from iter-2 left an off-by-one in the overdue-day count. The eleven Info findings from the previous review were not in the fixer's scope and remain present; they are re-listed with current line numbers, plus three new Info items.

## Warnings

### WR-01: SSRF allowlist bypass via trailing-dot hostnames

**File:** `src/lib/jlawyer/validate-url.ts:10-11, 41`
**Issue:** `new URL()` does not strip a trailing dot from hostnames, so `"localhost."` and `"127.0.0.1."` reach `isPrivateOrLocalHost` verbatim. `"localhost."` fails both `host === "localhost"` and `host.endsWith(".localhost")` (the last 10 chars are `"ocalhost."`), and `"127.0.0.1."` fails the strict anchored IPv4 regex because of the trailing dot. Both fall through to `return false` and are accepted. System resolvers (glibc, macOS) resolve the FQDN forms `localhost.` and `127.0.0.1.` to loopback, so the private-host guard is silently defeated. Exploitation requires control of the j-lawyer base URL (an ADMIN-gated setting), so this is defense-in-depth rather than a remote hole — but this module's entire purpose is to fail closed on exactly this class of input, and the iter-3 fix round hardened far more esoteric ranges while leaving this one open.
**Fix:**
```ts
function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, ""); // strip FQDN trailing dot
  ...
}
```

### WR-02: SSRF allowlist bypass via compressed unique-local IPv6 (`fd::1`, `fc::1`)

**File:** `src/lib/jlawyer/validate-url.ts:18`
**Issue:** The ULA check `/^(fc|fd)[0-9a-f]{2}:/i` requires two hex digits between the `fc`/`fd` prefix and the next colon. The legal compressed forms `fd::1` and `fc::1` (RFC 4193 unique-local, LAN-routable) have `::` immediately after the prefix, so `[0-9a-f]{2}` fails to match and the address passes as "public". The expanded form `fd00::1` is caught, so the guard is inconsistent against trivially equivalent spellings of the same address.
**Fix:**
```ts
if (/^f[cd]([0-9a-f]{2})?:/i.test(v6)) return true; // unique-local fc00::/7, incl. fd::/fc:: shorthand
```

### WR-03: Overdue-Frist day count is off by one for UTC-midnight entries

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:124-126`
**Issue:** `overdueDays = Math.floor((startOfToday.getTime() - new Date(overdueFrist.datum).getTime()) / 86400000)`. `startOfToday` is local midnight, but all-day KalenderEintraege are serialized at UTC midnight — 01:00/02:00 local in Europe/Berlin. A Frist due *yesterday* therefore produces a diff of ~22–23 hours and `Math.floor` returns `0`: the strip renders "(seit 0 Tagen)" for a deadline that expired yesterday, and understates every overdue duration by one day. The iter-2 fix correctly moved the *filter* to day granularity but left this *display* computation on raw millisecond floor. Understating how long a legal deadline has been missed is a correctness problem in this domain.
**Fix:** Normalize the Frist date to its local day before diffing, matching the `startOfToday` approach:
```ts
const d = new Date(overdueFrist.datum);
const fristDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
const overdueDays = overdueFrist
  ? Math.round((startOfToday.getTime() - fristDay.getTime()) / (1000 * 60 * 60 * 24))
  : null;
```

## Info

### IN-01: `completeness` state is write-only (dead state) — carried from iter-2/3

**File:** `src/components/akten/akte-detail-tabs.tsx:140-144, 346`
**Issue:** `completeness` is populated via `onCompletenessChange={setCompleteness}` but never read anywhere in the render — a leftover from the removed Falldaten progress UI. Every completeness update re-renders `AkteDetailTabs` for no visible effect.
**Fix:** Either render the percentage (e.g. a badge on the Falldaten overflow item) or remove the state and the prop wiring.

### IN-02: `hasAnyInfo` guard is effectively dead code — carried from iter-2/3

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:128-130`
**Issue:** The condition includes `akte.status`, a non-nullable field that is always truthy, so `!hasAnyInfo` can never be true and `KeyFactsPanel` always renders.
**Fix:** Drop `akte.status` from the computation or remove the guard entirely.

### IN-03: Unreachable `throw` after retry loop — carried from iter-2/3

**File:** `src/lib/jlawyer/client.ts:51`
**Issue:** `throw lastError ?? new Error("J-Lawyer request failed")` is unreachable: on the final attempt every control path inside the loop either returns a `Response` or rethrows.
**Fix:** Remove the trailing throw, or restructure so exhaustiveness is visible to the compiler.

### IN-04: Inconsistent Frist warning thresholds (7 vs 14 days) — carried from iter-2/3

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:123, 176`
**Issue:** Amber warning styling starts at `<= 7` days, but the "(N Tage)" countdown label appears at `<= 14` days; a Frist 10 days out shows a countdown with no warning color.
**Fix:** Introduce one constant (e.g. `const FRIST_WARN_DAYS = 7`) and use it for both the styling and the countdown display.

### IN-05: Empty-string `firma` renders an empty party name — carried from iter-2/3

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:89, 92, 95`
**Issue:** `kontakt.firma ?? [vorname, nachname]...` only falls through on `null`/`undefined`; an empty-string `firma` (plausible from imports) yields `""` and renders an empty bold span.
**Fix:** Use `||` instead of `??`, and treat an empty joined name as `null`.

### IN-06: "Gegner" label can display the Gegnervertreter's name — carried from iter-2/3

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:85, 206-211`
**Issue:** The lookup accepts `GEGNER` or `GEGNERVERTRETER`, but the panel always labels the match "Gegner:". When only opposing counsel is recorded, the lawyer's name appears under the party label — misleading in a legal context.
**Fix:** Track which role matched and render "Gegnervertreter:" when `rolle === "GEGNERVERTRETER"`.

### IN-07: `setTimeout` scroll after tab switch is a timing race with no cleanup — carried from iter-2/3

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:254-259`
**Issue:** The fixed 150 ms delay assumes the Finanzen tab has mounted; on a slow render `getElementById` returns null and the scroll silently never happens. The timer is also not cleared on unmount. The iter-3 guarded-navigation fix makes the blocked path real: when the tab switch is intercepted by the unsaved-changes dialog, the timer fires while Finanzen is still inactive, so after the user confirms the switch the scroll never occurs.
**Fix:** Scroll from an effect keyed on `activeTab === "finanzen"` (with `requestAnimationFrame` or a ref on the section) instead of a fixed timeout, and clear any pending timer on unmount.

### IN-08: Path segments interpolated without encoding in JLawyerClient — carried from iter-2/3

**File:** `src/lib/jlawyer/client.ts:87, 92, 102, 110, 123`
**Issue:** `caseId`/`docId` are interpolated raw into request paths; an ID containing `/`, `?`, or `#` would corrupt the request. IDs currently come from the j-lawyer API so practical risk is low, but encoding is a one-line defense.
**Fix:** Wrap interpolations in `encodeURIComponent`.

### IN-09: "Naechste Frist" / "Ueberfaellig" labels include Termine, not just Fristen — carried from iter-3

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:107-117, 173, 187`
**Issue:** `openEintraege` filters only on `!k.erledigt`; the `typ` field is never consulted. A plain Termin (e.g. a client meeting) is surfaced under the label "Naechste Frist" — and, when past, as "Ueberfaellig" in rose warning styling, creating false urgency in a deadline UI.
**Fix:** Filter by entry type (`.filter((k) => !k.erledigt && k.typ === "FRIST")` — verify the exact enum value in the Prisma schema), or relabel the strip entries to reflect the actual type.

### IN-10: `decryptJLawyerPassword` fallback masks key misconfiguration — carried from iter-3

**File:** `src/lib/jlawyer/credentials.ts:19-25`
**Issue:** The catch-all fallback returns the raw stored value on *any* decrypt error. If `EMAIL_ENCRYPTION_KEY` is missing/rotated, the stored ciphertext is silently returned as the password and the failure only surfaces later as a j-lawyer 401 — far from the actual cause — while the ciphertext blob is transmitted to the remote server as a credential.
**Fix:** Only fall back for legacy plaintext values: check the ciphertext format first (e.g. `/^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/`) and return raw only when it does *not* match; let decrypt errors on well-formed ciphertext propagate with an explicit "Schluessel falsch/nicht gesetzt" message.

### IN-11: Stale `pendingTab`/`pendingAction` on ESC/overlay close; per-render re-registration — carried from iter-3

**File:** `src/components/akten/akte-detail-tabs.tsx:368, 378-385` and `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:327-332`
**Issue:** (a) Closing the unsaved-changes dialog via ESC or overlay click goes through `onOpenChange={setShowUnsavedDialog}` and leaves `pendingTab`/`pendingAction` set, while the explicit "Abbrechen" button clears both — an inconsistency that is a trap for future edits (e.g. if a second guarded call ever fires while state is stale, the confirm handler at line 388-390 silently prefers `pendingTab` and drops `pendingAction`). (b) `registerTabChange`/`registerGuardedNavigation` are passed as inline arrows, so their identity changes on every parent render and the registration effects (akte-detail-tabs.tsx:176-178, 197-199) re-run each render; harmless but noisy.
**Fix:** (a) Use `onOpenChange={(open) => { setShowUnsavedDialog(open); if (!open) { setPendingTab(null); setPendingAction(null); } }}`. (b) Wrap the parent callbacks in `useCallback` with stable dep sets.

### IN-12: `Tabs` receives both `defaultValue` and `value`

**File:** `src/components/akten/akte-detail-tabs.tsx:238`
**Issue:** The component is fully controlled (`value={currentTab} onValueChange={handleTabChange}`), so `defaultValue="feed"` is ignored and only adds ambiguity about which source wins.
**Fix:** Remove `defaultValue="feed"`.

### IN-13: Tab identifiers duplicated across two files

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:216-219` and `src/components/akten/akte-detail-tabs.tsx:214-219, 241-364`
**Issue:** The valid-tab set (`VALID_TABS`) is maintained separately from the `TabsTrigger`/`TabsContent`/`overflowTabs` definitions. Adding or renaming a tab in `AkteDetailTabs` without updating `VALID_TABS` makes the `?tab=` deep-link silently fall back to `feed`.
**Fix:** Export a single `AKTE_TAB_VALUES` constant from `akte-detail-tabs.tsx` and derive `VALID_TABS` from it.

### IN-14: 429 retries ignore `Retry-After`

**File:** `src/lib/jlawyer/client.ts:42-49`
**Issue:** Rate-limited responses are retried on a fixed linear backoff (500 ms / 1000 ms), ignoring the server's `Retry-After` hint. With only 3 attempts and a 15 s timeout this is unlikely to be abusive, but it makes the retry policy less effective against a throttling j-lawyer server.
**Fix:** On 429, parse `res.headers.get("retry-after")` and use it (capped) as the sleep duration when present.

---

_Reviewed: 2026-07-23T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
