---
phase: 63-tab-reduktion-keyfacts
reviewed: 2026-07-23T12:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/app/(dashboard)/akten/[id]/akte-detail-client.tsx
  - src/components/akten/akte-detail-tabs.tsx
  - src/lib/jlawyer/client.ts
findings:
  critical: 1
  warning: 4
  info: 8
  total: 13
status: issues_found
---

# Phase 63: Code Review Report

**Reviewed:** 2026-07-23T12:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the Akte detail page refactor (KPI row + Key-Facts strip + overflow tabs) and the new JLawyerClient. One data-loss bug: the Falldaten unsaved-changes guard is completely bypassed when navigating via the KPI cards, and inactive tab content unmounts, so unsaved form state is silently destroyed. The Key-Facts "Naechste Frist" logic hides Fristen that are due today or overdue. The j-lawyer integration stores the password in plaintext and sends credentials to an admin-supplied URL without validation (SSRF surface, traced from client.ts usage).

## Critical Issues

### CR-01: Unsaved Falldaten changes silently lost when navigating via KPI cards

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:207-222` and `src/components/akten/akte-detail-tabs.tsx:141-145,149-160`
**Issue:** The unsaved-changes guard for the Falldaten tab only runs inside `handleTabChange` (akte-detail-tabs.tsx:152-156), which is invoked by the tab triggers and the overflow menu. The KPI cards in `AkteDetailClient` instead call `setActiveTab` directly in the parent (akte-detail-client.tsx:214), which flows down as the `externalTab` prop and is synced into internal state by the effect at akte-detail-tabs.tsx:141-145 — with no dirty check. Because the custom `TabsContent` (`src/components/ui/tabs.tsx:93`) returns `null` for inactive tabs, `FalldatenTab` unmounts on the switch and all unsaved form state is destroyed without the warning dialog ever appearing. Reproduction: open Falldaten, edit a field, click the "Dokumente" (or "Beteiligte" / "Termine/Fristen" / "Zeiterfassung" / "Chat") KPI card — data is gone with no prompt.
**Fix:** Route the guard through the external tab-change path as well. The cleanest option is to invert control: pass a single `onRequestTabChange` from `AkteDetailClient` that delegates to `AkteDetailTabs`' guarded `handleTabChange`, e.g. in `AkteDetailClient`:

```tsx
const tabChangeRef = useRef<(tab: string) => void>(() => {});
// ...
<AkteDetailTabs
  akte={akte}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  registerTabChange={(fn) => (tabChangeRef.current = fn)}
/>
```

and in `AkteDetailTabs` expose the guarded handler via `registerTabChange(handleTabChange)`. Then `handleKpiClick` calls `tabChangeRef.current(tab)` instead of `setActiveTab(tab)`. Alternatively, add the dirty check to the externalTab sync effect and veto the sync by restoring `internalTab` — but the ref/callback approach keeps a single source of truth for guarded switching.

## Warnings

### WR-01: "Naechste Frist" hides Fristen due today or already overdue

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:105-107`
**Issue:** The filter `new Date(k.datum) >= now` compares against the current timestamp. KalenderEintrag.datum is a date (typically midnight), so a Frist due today is filtered out as soon as the current time passes midnight, and overdue (not erledigt) Fristen are never shown at all. For a legal-deadline indicator this is the worst possible omission: the Key-Facts strip can show "no upcoming Frist" on the exact day a Frist expires. The `daysUntilFrist` logic (line 110-113) even has a `"heute"` branch for `daysUntilFrist === 0` that is unreachable for midnight-stored dates.
**Fix:** Compare at day granularity and surface overdue entries explicitly:

```tsx
const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const nextFrist = akte.kalenderEintraege
  ?.filter((k) => !k.erledigt && new Date(k.datum) >= startOfToday)
  .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime())[0] ?? null;
```

Optionally also compute the most recent overdue entry and render it with the amber/rose warning treatment ("ueberfaellig seit N Tagen") instead of dropping it.

### WR-02: `?tab=` search param only honored on initial mount

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:200-205`
**Issue:** `initialTab` is computed once from `searchParams` inside `useState` initialization. On a client-side navigation to the same route with a different `?tab=` value, the component is not remounted, so the new tab param is ignored and the previously active tab stays. Any in-app link targeting `/akten/[id]?tab=kalender` from within the dashboard can silently land on the wrong tab.
**Fix:** Sync the param via an effect:

```tsx
const paramTab = searchParams.get("tab");
useEffect(() => {
  if (paramTab && VALID_TABS.has(paramTab)) setActiveTab(paramTab);
}, [paramTab]);
```

(Keep the `useState` initializer for the first paint.) Note the sync must respect CR-01's dirty guard if the Falldaten tab is active.

### WR-03: j-lawyer password stored in plaintext in SystemSetting

**File:** `src/app/api/admin/jlawyer/route.ts:37` (surfaced while tracing `src/lib/jlawyer/client.ts` usage)
**Issue:** `upserts.push({ key: "jlawyer.password", value: password })` persists the j-lawyer credentials unencrypted in the `SystemSetting` table. `JLawyerClient` then reads them back via `map["jlawyer.password"]` (test/route.ts:29, migrate/route.ts:62-84). Anyone with DB read access (backups, logs, a SQL injection elsewhere, broad Prisma tooling) obtains working credentials for the source case-management system holding the entire legacy Mandanten data set.
**Fix:** Encrypt the value at rest with a server-side key (e.g. AES-256-GCM using an env-held `SETTINGS_ENCRYPTION_KEY`, matching any existing pattern used for other secrets such as mail/API credentials in this codebase) and decrypt in `JLawyerClient` call sites. At minimum, verify whether an encryption helper already exists in the codebase and apply it here.

### WR-04: Credentials sent to arbitrary admin-supplied URL (SSRF surface)

**File:** `src/app/api/admin/jlawyer/test/route.ts:12-36` (surfaced while tracing `src/lib/jlawyer/client.ts:14-21`)
**Issue:** The test endpoint accepts `url`, `username`, and `password` from the request body and `JLawyerClient` unconditionally attaches the Basic-auth header to every request against that `baseUrl`. The endpoint is ADMIN-gated, but there is no validation of the URL: an attacker with an ADMIN session (or an admin tricked into pasting a URL) can make the server issue authenticated requests to arbitrary internal hosts and read the response via the returned `error` message (`testConnection` surfaces `error.message`, which includes the response body via client.ts:59-61). This is a classic SSRF + credential-reflection primitive.
**Fix:** Validate `baseUrl` before constructing the client: require `https:` (or explicitly whitelisted `http:` hosts for on-prem), block RFC-1918/loopback/link-local targets unless explicitly configured, and strip response bodies from errors returned to the client (e.g. `J-Lawyer API error ${res.status} at ${path}` without `await res.text()`, or truncate to a fixed length).

## Info

### IN-01: `completeness` state is write-only (dead state)

**File:** `src/components/akten/akte-detail-tabs.tsx:131-135,307`
**Issue:** `completeness` is populated via `onCompletenessChange={setCompleteness}` but never read anywhere in the component. Presumably a leftover from the removed Falldaten progress UI.
**Fix:** Either render the percentage (e.g. badge on the Falldaten overflow item) or remove the state and the `onCompletenessChange` prop.

### IN-02: `hasAnyInfo` guard is effectively dead code

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:115-117`
**Issue:** The condition includes `akte.status`, which is a non-nullable Prisma field and always truthy, so `!hasAnyInfo` can never be true and `KeyFactsPanel` always renders.
**Fix:** Drop `akte.status` from the `hasAnyInfo` computation (the panel would then render an empty strip only when at least one real fact exists) or remove the guard entirely.

### IN-03: Unreachable `throw` after retry loop

**File:** `src/lib/jlawyer/client.ts:45`
**Issue:** `throw lastError ?? new Error("J-Lawyer request failed")` is unreachable: for `maxRetries >= 1` the loop always either returns a Response (non-retryable or final attempt) or rethrows the fetch error on the final attempt.
**Fix:** Remove the trailing throw, or restructure the loop so the compiler can see exhaustiveness (e.g. `assertNever`). Harmless but misleading to readers.

### IN-04: Inconsistent Frist warning thresholds (7 vs 14 days)

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:113,163`
**Issue:** The amber warning styling kicks in at `<= 7` days, but the "(N Tage)" countdown label appears at `<= 14` days. A Frist 10 days out shows a countdown with no warning color; the thresholds read as arbitrary.
**Fix:** Pick one threshold constant (e.g. `const FRIST_WARN_DAYS = 7`) and use it for both the styling and the countdown display.

### IN-05: Empty-string `firma` renders an empty party name

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:89,92,95-97`
**Issue:** `kontakt.firma ?? [vorname, nachname]...` only falls through on `null`/`undefined`. An empty-string `firma` (possible from imports) yields `""` as the name, rendering an empty bold span.
**Fix:** Use `||` instead of `??`, or normalize: `(mandant.kontakt.firma || [vorname, nachname].filter(Boolean).join(" ")) || null`.

### IN-06: "Gegner" label can display the Gegnervertreter's name

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:85`
**Issue:** The lookup accepts `GEGNER` or `GEGNERVERTRETER`, but the panel always labels the result "Gegner:". When only the opposing counsel is recorded, the panel shows the lawyer's name under the party label "Gegner" — misleading in a legal context where the distinction matters.
**Fix:** Track which role matched and render "Gegnervertreter:" when `rolle === "GEGNERVERTRETER"`.

### IN-07: `setTimeout` scroll after tab switch is a timing race with no cleanup

**File:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx:216-221`
**Issue:** A fixed 150 ms delay assumes the Finanzen tab content has mounted; on a slow render the `getElementById` returns null and the scroll silently never happens. The timeout also isn't cleared if the component unmounts in between.
**Fix:** Replace with a layout effect / `requestAnimationFrame` after the tab becomes active (e.g. track `activeTab === "finanzen"` in an effect and scroll once the section ref exists), and store/clear the timeout id on unmount.

### IN-08: Path segments interpolated without encoding in JLawyerClient

**File:** `src/lib/jlawyer/client.ts:80,85,95,103,116`
**Issue:** `caseId`, `docId`, etc. are interpolated raw into request paths. The IDs come from the j-lawyer API so the practical risk is low, but an ID containing `/`, `?`, or `#` would corrupt the request path; encoding is a one-line defense.
**Fix:** Wrap interpolations in `encodeURIComponent`, e.g. `` `/j-lawyer/api/v2/cases/${encodeURIComponent(caseId)}/contacts` ``.

---

_Reviewed: 2026-07-23T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
