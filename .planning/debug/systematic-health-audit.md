---
status: diagnosed
trigger: "systematic health audit - broad stabilization audit to find ALL issues"
created: 2026-03-04T10:00:00Z
updated: 2026-03-04T11:00:00Z
---

## Current Focus

hypothesis: Application has multiple categories of issues spanning TypeScript errors, lint violations, env var inconsistencies, missing error boundaries, and outdated dependencies
test: Completed systematic audit across build, lint, tests, routes, features, Docker
expecting: n/a - audit complete
next_action: Return comprehensive findings

## Symptoms

expected: Application runs cleanly - all features work, database stable, no errors
actual: Multiple features broken, database issues, widespread problems
errors: See Issues Found section
reproduction: General usage of the application
started: Accumulated issues, v0.6 milestone is dedicated to stabilization

## Eliminated

(n/a - audit mode, not single-bug investigation)

## Evidence

- timestamp: 2026-03-04T10:01
  checked: TypeScript compilation (npx tsc --noEmit)
  found: 3 unique errors (6 lines, some repeated): falldaten-tab type mismatch, special-quests non-route export
  implication: Build passes only because next.config.mjs has ignoreBuildErrors: true

- timestamp: 2026-03-04T10:02
  checked: Prisma validate
  found: Schema is valid. Prisma 5.22.0, latest is 7.4.2 (major version behind)
  implication: No immediate schema issues, but significant tech debt

- timestamp: 2026-03-04T10:03
  checked: ESLint (npx next lint)
  found: 1 real error (conditional hook call), 7 "rule not found" errors, 317 warnings
  implication: One rule-of-hooks violation is a real bug; eslint-disable comments reference @typescript-eslint/no-explicit-any but rule is not configured

- timestamp: 2026-03-04T10:04
  checked: Build (npx next build)
  found: Build succeeds (with ignoreBuildErrors + ignoreDuringBuilds masking issues)
  implication: Production builds work but hide problems

- timestamp: 2026-03-04T10:05
  checked: Test suite (npx vitest run)
  found: 416/427 tests pass. 2 test files fail: ner-filter (needs Ollama), tools.test.ts (1 mock issue)
  implication: Test infrastructure is mostly healthy, NER filter tests need external service

- timestamp: 2026-03-04T10:06
  checked: Ollama URL env vars across codebase
  found: Inconsistent env var names - some files use OLLAMA_BASE_URL, some use OLLAMA_URL. Defaults also inconsistent (some http://ollama:11434, some http://localhost:11434)
  implication: In Docker (where OLLAMA_URL is set), files using OLLAMA_BASE_URL rely on hardcoded fallbacks. In local dev (where OLLAMA_BASE_URL is set), files using OLLAMA_URL rely on fallbacks.

- timestamp: 2026-03-04T10:07
  checked: Stirling PDF health check URL
  found: health/checks.ts defaults to http://localhost:8090 but docker-compose maps 8081:8080 and .env has http://localhost:8081
  implication: Health check always reports Stirling as unhealthy in local dev without STIRLING_PDF_URL env var

- timestamp: 2026-03-04T10:08
  checked: Error boundaries and error pages
  found: Zero error.tsx, zero loading.tsx, zero not-found.tsx across entire app
  implication: Any unhandled error crashes to a blank/generic page with no recovery option

- timestamp: 2026-03-04T10:09
  checked: npm audit
  found: 11 vulnerabilities (2 low, 4 moderate, 5 high), all in Next.js 14.2.35 and minimatch
  implication: Security vulnerabilities in production deployment

- timestamp: 2026-03-04T10:10
  checked: next.config.mjs settings
  found: ignoreBuildErrors: true AND ignoreDuringBuilds: true
  implication: TypeScript and ESLint errors are silently swallowed during builds

- timestamp: 2026-03-04T10:11
  checked: React hooks rule violation
  found: admin/rollen/page.tsx calls useCallback after early returns (line 82 after lines 59-73)
  implication: Can cause React runtime crash or inconsistent behavior on that page

- timestamp: 2026-03-04T10:12
  checked: compose-popup.tsx useEffect dependencies
  found: saveDraft missing from dependency array (line 153)
  implication: Stale closure - auto-save may use outdated data

## Issues Found

### CRITICAL

1. **React Hooks Rule Violation - admin/rollen/page.tsx**
   File: `src/app/(dashboard)/admin/rollen/page.tsx:82`
   `useCallback` called after early return (lines 59-73). Violates Rules of Hooks.
   Can cause React runtime crash or unpredictable behavior.

### HIGH

2. **TypeScript Errors Masked by Build Config**
   Files: `src/components/akten/falldaten-tab.tsx:309-310`, `src/app/api/gamification/special-quests/route.ts:29`
   - falldaten-tab.tsx: `TemplateField.typ` is `string` but `FalldatenForm` expects `FalldatenFeldTypDB` union type. Also `beschreibung` is `string | null` but `TemplateSchema` expects `string | undefined`.
   - special-quests/route.ts: exports `CONDITION_TEMPLATES` from a route file (Next.js only allows route handler exports). Could cause runtime issues.
   Config: `next.config.mjs` has `ignoreBuildErrors: true` and `ignoreDuringBuilds: true`.

3. **Ollama URL Environment Variable Inconsistency**
   Files using `OLLAMA_BASE_URL`: `src/lib/ai/ollama.ts`, `src/lib/ai/provider.ts`, `src/lib/helena/complexity-classifier.ts`, `src/lib/settings/defaults.ts`
   Files using `OLLAMA_URL`: `src/lib/health/checks.ts`, `src/lib/pii/ner-filter.ts`, `src/lib/embedding/embedder.ts`, `src/lib/ai/reranker.ts`
   `.env` sets `OLLAMA_BASE_URL`, docker-compose sets `OLLAMA_URL`. Neither covers all files.
   Fallback defaults also inconsistent: some default to `http://ollama:11434` (Docker only), some to `http://localhost:11434` (local only).

4. **Stirling PDF Health Check Wrong Port**
   File: `src/lib/health/checks.ts:48`
   Fallback URL `http://localhost:8090` is wrong. docker-compose maps `8081:8080`, .env says `http://localhost:8081`.
   Health dashboard always shows Stirling as unhealthy in local dev.

5. **No Error Boundaries in Entire App**
   Missing: `error.tsx`, `loading.tsx`, `not-found.tsx` across all route groups.
   Any unhandled error in a Server Component or page render results in a blank/generic error page with no recovery mechanism for the user.

6. **npm Security Vulnerabilities (5 high severity)**
   Package: `next@14.2.35`
   - DoS via Image Optimizer remotePatterns (GHSA-9g9p-9gw9-jx7f)
   - HTTP request deserialization DoS (GHSA-h25m-26qc-wcjf)
   Fix: Upgrade to Next.js 15+ (breaking change) or latest 14.x patch.

7. **ESLint Rule References to Non-Existent Rule**
   8 files contain `eslint-disable-next-line @typescript-eslint/no-explicit-any` but `.eslintrc.json` doesn't extend `@typescript-eslint` config.
   Causes 7 ESLint "Definition for rule not found" errors.
   Files: `chat-layout.tsx`, `db.ts`, `nummernkreis.ts`, `quest-evaluator.ts`, `boss-engine.ts`, `retrieval-log.ts`

### MEDIUM

8. **useEffect Missing Dependency (compose-popup.tsx)**
   File: `src/components/email/compose-popup.tsx:153`
   `saveDraft` not in dependency array of auto-save interval. Can lead to stale data being saved.

9. **Vitest/Jest Confusion**
   Tests use Vitest but `npx jest` finds them too (and all 12 fail). No `test` script in package.json.
   Developers might accidentally run `npx jest` instead of `npx vitest`.

10. **317 ESLint Warnings (no-unused-vars)**
    Across ~80+ files. Mostly unused imports, variables, and function parameters.
    Not blocking but significant code hygiene issue. Many are in core feature components.

11. **1 Failing Unit Test (tools.test.ts)**
    File: `src/lib/helena/__tests__/tools.test.ts:450`
    `create_draft_dokument` test - `result.data` is undefined.
    Mock setup issue - likely broken after a refactor.

12. **Prisma Major Version Behind (5.22 vs 7.4.2)**
    Not urgent but accumulating tech debt. Major upgrade needed eventually.

### LOW

13. **80 Silent `.catch(() => {})` Blocks**
    Across 59 files. Most are fire-and-forget (logging, audit events) which is OK.
    Some may swallow important errors in user-facing flows.

14. **compose-popup.tsx Missing kontoId Dependency**
    File: `src/components/email/compose-popup.tsx:118`
    useEffect for loading konten has empty dependency array, references kontoId but it's not included.
    Minor since it only runs on mount.

15. **Unused `<img>` Tags (should use next/image)**
    Files: `briefkopf-editor.tsx`, `audit-timeline.tsx`, `portal-sidebar.tsx`
    Performance impact for LCP. Should use `<Image />`.

16. **Falldaten UAT Tests Not Started**
    All 12 tests in `29-UAT.md` still pending/deferred.

## Resolution

root_cause: Multiple accumulated issues across categories - type safety masked by build config, env var inconsistencies between local/Docker, missing Next.js error handling patterns, one React hooks violation, and outdated dependencies with security vulnerabilities.
fix: See prioritized fix plan below
verification: TBD - each fix needs individual verification

### Prioritized Fix Plan

**P0 - Fix Immediately:**
1. Fix React Hooks violation in rollen/page.tsx (move useCallback before early returns)
2. Fix falldaten-tab.tsx TS errors (align TemplateField type)
3. Fix special-quests route export (move CONDITION_TEMPLATES to a separate file)
4. Fix Stirling PDF health check port (8090 -> 8081)

**P1 - Fix This Sprint:**
5. Standardize Ollama env var to single name (OLLAMA_URL everywhere)
6. Add error.tsx for root, dashboard, and portal route groups
7. Add loading.tsx for key route groups
8. Fix ESLint config (add @typescript-eslint or remove disable comments)
9. Fix compose-popup.tsx stale dependency

**P2 - Fix This Milestone:**
10. Add `test` script to package.json pointing to vitest
11. Fix tools.test.ts mock
12. Evaluate Next.js security patches (14.x latest or plan 15 upgrade)
13. Clean up major unused-vars warnings

**P3 - Backlog:**
14. Plan Prisma major upgrade (5 -> 7)
15. Audit and fix silent catch blocks
16. Replace `<img>` with `<Image />`
17. Consider removing ignoreBuildErrors once TS errors are fixed

files_changed: []
