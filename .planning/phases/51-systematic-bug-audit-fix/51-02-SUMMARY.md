---
phase: 51-systematic-bug-audit-fix
plan: 02
subsystem: infra
tags: [ollama, env-vars, eslint, react-hooks, docker]

# Dependency graph
requires: []
provides:
  - Single OLLAMA_URL env var across entire codebase
  - Clean ESLint output with 0 "rule not found" errors
  - Fixed compose-popup.tsx auto-save stale closure
affects: [ai-provider, helena, email]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OLLAMA_URL with http://localhost:11434 fallback (Docker sets env explicitly)"
    - "saveDraft useCallback defined before auto-save useEffect for correct deps"

key-files:
  created: []
  modified:
    - src/lib/ai/ollama.ts
    - src/lib/ai/provider.ts
    - src/lib/helena/complexity-classifier.ts
    - src/lib/settings/defaults.ts
    - src/lib/finance/invoice/nummernkreis.ts
    - src/lib/helena/qa/retrieval-log.ts
    - src/lib/gamification/quest-evaluator.ts
    - src/lib/gamification/boss-engine.ts
    - src/lib/db.ts
    - src/components/ki/chat-layout.tsx
    - src/components/email/compose-popup.tsx

key-decisions:
  - "Standardized on OLLAMA_URL (not OLLAMA_BASE_URL) to match docker-compose convention"
  - "Fallback http://localhost:11434 everywhere since Docker sets OLLAMA_URL explicitly"
  - "Removed ESLint disable comments rather than adding @typescript-eslint plugin"
  - "Moved saveDraft useCallback before useEffect to fix declaration order and dependency"

patterns-established:
  - "OLLAMA_URL: single env var for Ollama connection across all files"
  - "No @typescript-eslint disable comments when rule is not configured"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 51 Plan 02: Env Var & ESLint Cleanup Summary

**Standardized OLLAMA_URL env var across 4 files, removed 8 invalid ESLint disable comments, and fixed compose-popup auto-save stale closure**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T06:32:37Z
- **Completed:** 2026-03-04T06:35:48Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Unified all Ollama env var references to OLLAMA_URL with consistent localhost fallback
- Eliminated all "Definition for rule not found" ESLint errors (was 8 comments referencing unconfigured rule)
- Fixed stale closure in compose-popup.tsx auto-save by moving saveDraft before useEffect and adding it to deps

## Task Commits

Each task was committed atomically:

1. **Task 1: Standardize Ollama URL to single env var** - `15c6743` (fix)
2. **Task 2: Remove invalid ESLint disable comments and fix useEffect deps** - `cd30e1a` (fix)

## Files Created/Modified
- `src/lib/ai/ollama.ts` - OLLAMA_BASE_URL -> OLLAMA_URL
- `src/lib/ai/provider.ts` - 3 occurrences OLLAMA_BASE_URL -> OLLAMA_URL, fallback to localhost
- `src/lib/helena/complexity-classifier.ts` - OLLAMA_BASE_URL -> OLLAMA_URL
- `src/lib/settings/defaults.ts` - Default setting value uses OLLAMA_URL
- `src/lib/finance/invoice/nummernkreis.ts` - Removed eslint-disable comment
- `src/lib/helena/qa/retrieval-log.ts` - Removed eslint-disable comment
- `src/lib/gamification/quest-evaluator.ts` - Removed 3 eslint-disable comments
- `src/lib/gamification/boss-engine.ts` - Removed eslint-disable comment
- `src/lib/db.ts` - Removed eslint-disable comment
- `src/components/ki/chat-layout.tsx` - Removed eslint-disable comment
- `src/components/email/compose-popup.tsx` - Moved saveDraft before useEffect, fixed deps

## Decisions Made
- Standardized on OLLAMA_URL (not OLLAMA_BASE_URL) because docker-compose already used OLLAMA_URL
- All fallbacks set to http://localhost:11434 since Docker explicitly sets the env var to http://ollama:11434
- Removed disable comments rather than installing @typescript-eslint/eslint-plugin (simpler, any usage is intentional)
- Cleaned up auto-save useEffect deps: since saveDraft is already a useCallback with all state deps, the useEffect only needs [dirty, saveDraft]

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] saveDraft declared after useEffect that uses it**
- **Found during:** Task 2 (compose-popup.tsx useEffect fix)
- **Issue:** saveDraft useCallback was defined at line 177, after the auto-save useEffect at line 143 that references it. This would cause a reference error since const declarations are not hoisted.
- **Fix:** Moved saveDraft useCallback block before the auto-save useEffect. Also simplified deps to [dirty, saveDraft] since saveDraft's own useCallback deps already capture all form state.
- **Files modified:** src/components/email/compose-popup.tsx
- **Verification:** Grep confirms saveDraft defined before useEffect, deps array includes saveDraft
- **Committed in:** cd30e1a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary for correct execution. No scope creep.

## Issues Encountered
- `.env` is gitignored (correctly, contains credentials) -- the OLLAMA_URL change in .env was applied locally but not committed. Developers must update their own .env files.

## User Setup Required
None - no external service configuration required. Developers should update their local .env from OLLAMA_BASE_URL to OLLAMA_URL.

## Next Phase Readiness
- Ollama integration now uses consistent env var across all files
- ESLint output is clean of "rule not found" errors
- compose-popup auto-save uses current saveDraft reference

---
*Phase: 51-systematic-bug-audit-fix*
*Completed: 2026-03-04*
