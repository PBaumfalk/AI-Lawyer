---
phase: 25-helena-memory
plan: 01
subsystem: ai
tags: [helena, memory, generateObject, zod, prisma, system-prompt, german-markdown]

# Dependency graph
requires:
  - phase: 19-schema-foundation
    provides: HelenaMemory Prisma model with akteId @unique, onDelete Cascade
  - phase: 20-agent-tools
    provides: Helena agent public API, buildSystemPrompt, token-budget utilities
  - phase: 21-task-system
    provides: helena-task.processor.ts BullMQ processor
provides:
  - HelenaMemoryService with loadOrRefresh, formatMemoryForPrompt, generateMemory
  - Staleness detection via Akte.geaendert timestamp comparison
  - Structured German markdown memory injection in system prompt
  - Chain G parallel memory loading in ki-chat streaming endpoint
affects: [26-activity-feed-qa-gates]

# Tech tracking
tech-stack:
  added: []
  patterns: [loadOrRefresh service pattern, _meta change tracking, in-memory cooldown map, structured German markdown prompt sections]

key-files:
  created:
    - src/lib/helena/memory-service.ts
  modified:
    - src/lib/helena/system-prompt.ts
    - src/app/api/ki-chat/route.ts
    - src/lib/queue/processors/helena-task.processor.ts

key-decisions:
  - "5-minute cooldown prevents rapid-fire LLM calls during bulk operations"
  - "In-memory Map for cooldown tracking (lost on restart is acceptable -- just re-generates)"
  - "_meta field in HelenaMemory.content for change detection (dokumentCount, beteiligteCount, fristenCount)"
  - "formatMemoryForPrompt caps at ~7000 chars (~2000 tokens) to prevent context window overflow"
  - "Memory injected BEFORE pinned normen in ki-chat system prompt for proper context layering"

patterns-established:
  - "loadOrRefresh pattern: load from DB, check staleness, auto-regenerate via LLM, never throw"
  - "_meta change tracking: store counts in content JSON, compare on refresh for human-readable change strings"
  - "Backward-compatible memory type detection: check for 'summary' field to distinguish structured vs legacy"

requirements-completed: [MEM-02, MEM-03, MEM-04]

# Metrics
duration: 5min
completed: 2026-02-28
---

# Phase 25 Plan 01: Helena Memory Summary

**Per-Akte memory service with LLM-generated case summaries, staleness detection, and structured German markdown prompt injection across both ki-chat streaming and background task paths**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-28T09:06:40Z
- **Completed:** 2026-02-28T09:11:46Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- HelenaMemoryService with full lifecycle: loadOrRefresh, generateMemory, formatMemoryForPrompt
- Staleness detection compares Akte.geaendert vs HelenaMemory.lastRefreshedAt with 5-min cooldown
- Both invocation paths (ki-chat Chain G and helena-task processor) load and refresh memory consistently
- Structured German markdown format replaces raw JSON.stringify for LLM-readable case context
- RejectionPatterns from draft-service.ts preserved across memory refreshes
- DSGVO Art. 17 cascade delete verified via existing Prisma onDelete: Cascade

## Task Commits

Each task was committed atomically:

1. **Task 1: Create HelenaMemory service** - `9d3bd1b` (feat)
2. **Task 2: Wire memory service into ki-chat, helena-task processor, system-prompt** - `6a8bf41` (feat)

## Files Created/Modified
- `src/lib/helena/memory-service.ts` - HelenaMemoryService: loadOrRefresh, formatMemoryForPrompt, generateMemory, HelenaMemoryContentSchema
- `src/lib/helena/system-prompt.ts` - Updated to use formatMemoryForPrompt with legacy JSON fallback
- `src/app/api/ki-chat/route.ts` - Chain G: HelenaMemory loading in parallel, X-Memory-Refreshed header
- `src/lib/queue/processors/helena-task.processor.ts` - loadOrRefresh replaces direct prisma.helenaMemory.findUnique

## Decisions Made
- 5-minute cooldown interval to prevent wasteful LLM calls during bulk operations (e.g., importing 50 documents)
- In-memory Map for cooldown tracking -- process-local, lost on restart is fine (just re-generates next time)
- _meta field approach for change detection: store dokumentCount/beteiligteCount/fristenCount in memory JSON content, compare on refresh
- Token budget cap at ~2000 tokens (~7000 chars) for formatted memory section, truncating summary field first
- Memory injected before pinned normen and RAG sources in ki-chat system prompt for proper context layering
- Backward-compatible type detection: check for 'summary' string field to distinguish structured HelenaMemoryContent from legacy raw JSON

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Map iteration compatibility with ES target**
- **Found during:** Task 1 (memory-service.ts creation)
- **Issue:** `for...of` on Map entries fails without downlevelIteration flag in tsconfig
- **Fix:** Changed to `Array.from(refreshCooldowns.entries()).forEach()` pattern
- **Files modified:** src/lib/helena/memory-service.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors for memory-service.ts
- **Committed in:** 9d3bd1b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor syntax adjustment for TypeScript compatibility. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in src/lib/helena/index.ts (StepUpdate type mismatch) -- out of scope, not related to this plan's changes

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Memory service fully operational, ready for Phase 26 (Activity Feed UI + QA-Gates)
- Helena now has persistent case memory across sessions in both chat and background task modes
- Frontend can detect memory refresh via X-Memory-Refreshed response header for UX indicators

---
*Phase: 25-helena-memory*
*Completed: 2026-02-28*
