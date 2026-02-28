---
phase: 20-agent-tools-react-loop
plan: 02
subsystem: ai-agent
tags: [helena, react-loop, orchestrator, token-budget, stall-detection, ai-sdk, generateText]

# Dependency graph
requires:
  - "Phase 20 Plan 01: 18 Helena tool modules, createHelenaTools factory, audit-logger, system-prompt"
provides:
  - "runAgent() ReAct orchestrator wrapping AI SDK generateText with bounded steps"
  - "Token budget manager with FIFO truncation at 75% context window"
  - "Stall detector for duplicate-call and no-new-info patterns"
  - "AgentStep[] trace format for HelenaTask.steps JSON storage"
affects: [20-03-response-guard, 21-helena-task-system, 22-schriftsatz-orchestrator, 24-scanner-alerts, 25-helena-memory]

# Tech tracking
tech-stack:
  added: []
  patterns: [react-loop-orchestrator, token-budget-truncation, stall-detection-state-machine, abort-controller-composition, step-progress-callbacks]

key-files:
  created:
    - src/lib/helena/orchestrator.ts
    - src/lib/helena/token-budget.ts
    - src/lib/helena/stall-detector.ts
  modified: []

key-decisions:
  - "ToolSet generic type assertion for toolResults -- AI SDK ToolSet resolves execute return to never, requiring explicit cast for result access"
  - "Token tracking via trackTokenUsage directly instead of wrapWithTracking -- orchestrator aggregates usage across all steps before recording"
  - "Stall force message injected as user message (not system) to ensure LLM processes it in conversation flow"

patterns-established:
  - "ReAct loop pattern: generateText({ maxSteps, onStepFinish }) with stall/budget/audit in callback"
  - "AbortController composition: external signal + timeout merged via single controller"
  - "Step trace: AgentStep[] array captures thought/toolCall/toolResult/error for HelenaTask persistence"
  - "Sorted params stringify for deterministic tool call deduplication"

requirements-completed: [AGNT-01, AGNT-06]

# Metrics
duration: 5min
completed: 2026-02-27
---

# Phase 20 Plan 02: ReAct Agent Orchestrator Summary

**Bounded ReAct loop wrapping AI SDK generateText with stall detection, 75% token budget FIFO truncation, and full AgentStep trace capture**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-27T15:08:00Z
- **Completed:** 2026-02-27T15:13:31Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Built token budget manager with conservative estimation (chars/3.5), model-specific context windows, and FIFO message truncation preserving system + first user message
- Created stall detector state machine detecting duplicate tool calls (same name+sorted params 2x) and no-new-info (3 consecutive identical results)
- Implemented core ReAct orchestrator wrapping AI SDK generateText with mode-based caps (inline: 5 steps/30s, background: 20 steps/3min), stall detection, token budget truncation, audit logging, and step progress callbacks
- Full AgentStep[] trace captures thought/toolCall/toolResult/error for HelenaTask.steps JSON persistence

## Task Commits

Each task was committed atomically:

1. **Task 1: Token budget manager and stall detector** - `95556aa` (feat)
2. **Task 2: ReAct orchestrator with generateText wrapper** - `8a76b37` (feat)

## Files Created/Modified
- `src/lib/helena/token-budget.ts` - Token estimation (chars/3.5), context window lookup, FIFO message truncation at 75%
- `src/lib/helena/stall-detector.ts` - Stall detection state machine with duplicate-call and no-new-info patterns
- `src/lib/helena/orchestrator.ts` - Core ReAct loop wrapping generateText with stall/budget/audit/abort/progress

## Decisions Made
- **ToolSet type assertion for toolResults:** AI SDK's `ToolSet` generic resolves the `execute` return type to `never` when tools are `Record<string, CoreTool>`. Added explicit type cast for `toolResults` entries to access `.result` property safely.
- **Direct trackTokenUsage instead of wrapWithTracking:** The orchestrator aggregates token usage across all steps (multiple LLM calls) before recording a single usage entry, whereas wrapWithTracking expects a single generateText result object.
- **Stall force message as user role:** Injected the German force-answer message as a `user` message (not `system`) so it appears in the natural conversation flow and the LLM treats it as a direct instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ToolSet generic resolving toolResults to never**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** `toolResults` in `onStepFinish` callback has type `ToolResultArray<ToolSet>` which resolves `result` to `never` because `ToolSet = Record<string, Tool>` has no specific execute return type
- **Fix:** Added explicit type assertion: `(toolResults ?? []) as Array<{ toolCallId: string; toolName: string; result: unknown }>`
- **Files modified:** src/lib/helena/orchestrator.ts
- **Verification:** TypeScript compiles with zero errors
- **Committed in:** 8a76b37 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Type assertion necessary for TypeScript compilation with generic ToolSet. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- runAgent() ready for Plan 03 (response-guard) to wrap with ollamaResponseGuard repairToolCall hook
- AgentStep[] format compatible with HelenaTask.steps JSON field from Phase 19 schema
- Token budget and stall detection fully self-contained -- no external configuration needed
- Plan 03 will create `runHelenaAgent()` convenience wrapper that composes tools + system prompt + orchestrator

## Self-Check: PASSED

- FOUND: src/lib/helena/token-budget.ts
- FOUND: src/lib/helena/stall-detector.ts
- FOUND: src/lib/helena/orchestrator.ts
- FOUND: .planning/phases/20-agent-tools-react-loop/20-02-SUMMARY.md
- FOUND: commit 95556aa (Task 1)
- FOUND: commit 8a76b37 (Task 2)

---
*Phase: 20-agent-tools-react-loop*
*Completed: 2026-02-27*
