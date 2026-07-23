---
phase: 63-tab-reduktion-keyfacts
fixed_at: 2026-07-23T13:00:00Z
review_path: .planning/phases/63-tab-reduktion-keyfacts/63-REVIEW.md
iteration: 3
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 63: Code Review Fix Report

**Fixed at:** 2026-07-23T13:00:00Z
**Source review:** .planning/phases/63-tab-reduktion-keyfacts/63-REVIEW.md
**Iteration:** 3

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03; fix_scope = critical_warning, no Critical findings present)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: SSRF allowlist bypass via trailing-dot hostnames

**Files modified:** `src/lib/jlawyer/validate-url.ts`
**Commit:** e61349d
**Applied fix:** `isPrivateOrLocalHost` now strips the FQDN trailing dot after lowercasing (`hostname.toLowerCase().replace(/\.$/, "")`), so `localhost.` and `127.0.0.1.` are normalized before the localhost suffix check and the anchored IPv4 regex and can no longer fall through to `return false`.

**Verification:** Tier 1 (fix text confirmed present) + Tier 2 (`tsc --noEmit` — no errors referencing the file).

### WR-02: SSRF allowlist bypass via compressed unique-local IPv6 (`fd::1`, `fc::1`)

**Files modified:** `src/lib/jlawyer/validate-url.ts`
**Commit:** 2ce814e
**Applied fix:** ULA regex changed from `/^(fc|fd)[0-9a-f]{2}:/i` to `/^f[cd]([0-9a-f]{2})?:/i`, making the two hex digits between the `fc`/`fd` prefix and the next colon optional, so the compressed forms `fd::1` / `fc::1` are blocked alongside the expanded `fd00::…` / `fc00:…` forms.

**Verification:** Tier 1 (re-read) + Tier 2 (`tsc --noEmit` — no errors referencing the file) + functional regex sanity check: must-block cases `fd::1`, `fc::1`, `fd00::1`, `fc00:abcd::1`, `FD::1`, `fd12:3456::1` all match; public v6 prefixes (`2001:4860:…`, `2a01::1`, `fe80::1`) do not.

### WR-03: Overdue-Frist day count is off by one for UTC-midnight entries

**Status: fixed — requires human verification** (logic bug; syntax and simulation verified, but per protocol logic fixes are flagged for manual confirmation)

**Files modified:** `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx`
**Commit:** 251c290
**Applied fix:** The overdue-day computation now normalizes the Frist date to its local day before diffing against `startOfToday`, replacing the raw millisecond diff + `Math.floor`. The reviewer's suggested snippet dereferenced `overdueFrist.datum` before the null check; the applied version introduces an `overdueFristDate` intermediate (mirroring the existing `nextFristDate` pattern) to stay null-safe:

```ts
const overdueFristDate = overdueFrist ? new Date(overdueFrist.datum) : null;
const overdueDays = overdueFristDate
  ? Math.round(
      (startOfToday.getTime() -
        new Date(overdueFristDate.getFullYear(), overdueFristDate.getMonth(), overdueFristDate.getDate()).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  : null;
```

**Verification:** Tier 1 (re-read) + Tier 2 (project-wide `tsc --noEmit` — no errors referencing the file) + behavioral simulation under `TZ=Europe/Berlin`: a Frist due yesterday serialized at UTC midnight produced `0` days with the old code (the reported bug) and `1` with the new code. Manual smoke test recommended: create a Frist dated yesterday and confirm the strip renders "(seit 1 Tag)".

## Skipped Issues

None — all in-scope findings were fixed.

## Out-of-Scope (Info findings, unchanged)

IN-01 through IN-14 remain open (fix_scope = critical_warning).

---

_Fixed: 2026-07-23T13:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
