---
phase: 20-agent-tools-react-loop
plan: 04
subsystem: testing
tags: [vitest, mocking, prisma, ai-sdk, react-loop, stall-detection, rate-limiter, tool-cache]

# Dependency graph
requires:
  - phase: 20-agent-tools-react-loop (plans 01-03)
    provides: Helena tool factories, orchestrator, rate limiter, complexity classifier, response guard
provides:
  - "Unit tests for all 18 Helena tool factory functions with mocked Prisma"
  - "Integration tests for ReAct loop with mock LLM (stall detection, token budget, error handling)"
  - "Infrastructure tests for cache, stall-detector, token-budget, rate-limiter modules"
affects: [21-helena-task-system, 22-schriftsatz-orchestrator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mock Prisma client pattern for Helena tool testing"
    - "Mock ioredis class pattern for rate limiter testing"
    - "Mock generateText pattern for AI SDK agent loop testing"
    - "generateTextMockImpl swap pattern for per-test LLM behavior"

key-files:
  created:
    - "src/lib/helena/__tests__/tools.test.ts"
    - "src/lib/helena/__tests__/orchestrator.test.ts"
  modified: []

key-decisions:
  - "ioredis mock uses class pattern (not vi.fn().mockImplementation) for new Redis() compatibility"
  - "generateText mock uses swappable generateTextMockImpl variable for per-test LLM response sequences"
  - "Rate limiter tests rely on module-level mock since singleton Redis client persists across calls"

patterns-established:
  - "Helena mock Prisma factory: createMockPrisma() with vi.fn() stubs for all used Prisma methods"
  - "Helena mock tool context: createMockToolContext() with default ADMIN role and test akteId"
  - "AI SDK mock pattern: vi.mock('ai') with generateTextMockImpl swap for per-test behavior control"

requirements-completed: [AGNT-01, AGNT-02, AGNT-03, AGNT-04, AGNT-05, AGNT-06]

# Metrics
duration: 5min
completed: 2026-02-27
---

# Phase 20 Plan 04: Unit and Integration Tests for Helena Agent Summary

**46 vitest tests covering all 18 tool factories, ReAct orchestrator loop, stall detection, token budget, and rate limiter with fully mocked Prisma and AI SDK**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-27T15:24:31Z
- **Completed:** 2026-02-27T15:29:44Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- 32 unit tests across 8 describe blocks covering tool factory output shape, RBAC role filtering (4 roles), read/write tool execution, cache determinism, stall detection patterns, token budget truncation, and rate limiting
- 14 integration tests across 6 describe blocks covering ReAct loop basic flow, stall detection with force message injection, token budget truncation, timeout/abort/error handling, step update callbacks, and runHelenaAgent entry point wiring
- All 46 tests pass in under 600ms with zero real DB or LLM dependencies

## Task Commits

Each task was committed atomically:

1. **Task 1: Unit tests for tool factory functions and infrastructure** - `681b2b3` (test)
2. **Task 2: Integration tests for ReAct loop with mock LLM** - `80d7300` (test)

## Files Created/Modified
- `src/lib/helena/__tests__/tools.test.ts` - 721 lines: Unit tests for createHelenaTools factory, filterToolsByRole (4 role tiers), read tool RBAC and error handling, write tool HelenaDraft/HelenaAlert creation, tool-cache, stall-detector, token-budget, rate-limiter
- `src/lib/helena/__tests__/orchestrator.test.ts` - 830 lines: Integration tests for runAgent with mock generateText, stall detection with duplicate call detection and force message injection, token budget truncation under context window limits, timeout/abort/error finishReasons, step update callbacks, runHelenaAgent rate limiting and complexity classification

## Decisions Made
- ioredis mock uses a class definition (not vi.fn().mockImplementation()) because `new Redis(url, opts)` requires a proper constructor -- vitest's mock factory function approach does not work with `new`
- generateText mock uses a module-level `generateTextMockImpl` variable that tests swap before execution, enabling different LLM response sequences per test without re-mocking the entire module
- Rate limiter tests only verify the allow path (not deny path) directly because the module-level Redis singleton and redisUnavailable flag require careful module state management -- the deny path is covered indirectly through the runHelenaAgent integration test

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ioredis mock to use class pattern**
- **Found during:** Task 1 (rate-limiter tests)
- **Issue:** vi.fn().mockImplementation() does not produce a proper constructor for `new Redis()` in vitest ESM context
- **Fix:** Changed to `class MockRedis { ... }` definition in the vi.mock factory
- **Files modified:** src/lib/helena/__tests__/tools.test.ts
- **Verification:** Rate limiter tests pass (checkRateLimit allows, returns limit info)
- **Committed in:** 681b2b3 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed token budget test input size for truncation trigger**
- **Found during:** Task 2 (token budget tests)
- **Issue:** Initial test used 50000 char message (14290 tokens) which was below 75% threshold of 32768-token context window (24576 tokens)
- **Fix:** Used multiple 30000-char messages to exceed the 75% budget threshold (7 messages totaling ~34000+ tokens)
- **Files modified:** src/lib/helena/__tests__/orchestrator.test.ts
- **Verification:** Token budget truncation test passes, result.truncated === true
- **Committed in:** 80d7300 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for test correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 20 (Agent Tools + ReAct Loop) is now complete with all 4 plans executed
- Full Helena agent library is built and tested: 18 tools, orchestrator, stall detector, token budget, rate limiter, complexity classifier, response guard, and public entry point
- Ready for Phase 21 (Helena Task System) which will add BullMQ job processing and HelenaTask persistence

---
*Phase: 20-agent-tools-react-loop*
*Completed: 2026-02-27*
