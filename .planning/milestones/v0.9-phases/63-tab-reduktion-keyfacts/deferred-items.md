# Deferred Items — Phase 63

Out-of-scope discoveries made during plan execution. Not fixed (scope boundary rule).

## From 63-01 + 63-02 (beide Executors, identischer Befund)

- **Pre-existing syntax errors in `src/lib/jlawyer/client.ts`**
  - Found during: Task 1 verification (`npx tsc --noEmit`) in both plans
  - **Issue:** File is syntactically broken at the wave base commit (402cf39b). An extra closing brace at line 49 closes the class body early, making all subsequent class members top-level statements — producing ~30+ TS1005/TS1128/TS1434 errors across the file.
  - **Evidence:** `git show HEAD:src/lib/jlawyer/client.ts` shows `throw lastError ?? new Error("J-Lawyer request failed");` followed by a second `}` at line 49 before `private async get<T>(...)`. Introduced by commit 3de6bbe ("J-Lawyer-Client mit Retry/Timeout", phase 60).
  - **Probable fix:** Remove the stray `}` at line 49 so the class body spans all methods. Not applied here because it is unrelated to phase 63 (scope boundary rule) and the jlawyer integration belongs to phase 60.
  - **Impact:** `npx tsc --noEmit` cannot pass cleanly repo-wide until this is fixed. Since `ignoreBuildErrors: false` (since v0.6), production builds may already be failing — worth verifying separately.
  - **Recommendation:** separate fix plan for the J-Lawyer client file.
