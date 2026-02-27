---
phase: 20-agent-tools-react-loop
plan: 03
subsystem: ai
tags: [ollama, ai-sdk, rate-limiting, ioredis, react-loop, tool-calling]

# Dependency graph
requires:
  - phase: 20-agent-tools-react-loop (plan 01)
    provides: Helena tools (createHelenaTools, filterToolsByRole, buildSystemPrompt)
  - phase: 20-agent-tools-react-loop (plan 02)
    provides: ReAct orchestrator (runAgent, token budget, stall detection)
provides:
  - Ollama response guard (JSON repair + content scan) for broken tool calls
  - Rule-based complexity classifier (mode + tier selection)
  - Per-user per-hour rate limiter via ioredis
  - Unified public API runHelenaAgent() combining all Helena components
affects: [21-helena-task-system, 22-schriftsatz-orchestrator, 24-scanner-alerts]

# Tech tracking
tech-stack:
  added: []
  patterns: [fail-open-redis, rule-based-classification, tier-based-model-selection, auto-escalation]

key-files:
  created:
    - src/lib/helena/response-guard.ts
    - src/lib/helena/complexity-classifier.ts
    - src/lib/helena/rate-limiter.ts
    - src/lib/helena/index.ts
  modified: []

key-decisions:
  - "Rule-based complexity classifier (no LLM call) -- first match wins with German legal term patterns"
  - "Tier 3 cloud model only for Schriftsatz + legal filings (Klage, Antrag, Berufung)"
  - "Rate limiter uses lazy Redis singleton separate from BullMQ connections"
  - "Fail open on Redis unavailability -- log warning but allow request"
  - "Auto-escalation capped at 1 retry to prevent infinite loops"
  - "Model name prefix detection (gpt/claude/ollama) for tier-specific provider resolution"

patterns-established:
  - "fail-open-redis: rate limiter allows requests when Redis is unavailable"
  - "tier-model-selection: SystemSettings keys ai.helena.tier1/2/3_model with fallback chain"
  - "auto-escalation: stalled agent retries once with next-tier model"
  - "content-scan-guard: detect tool-call JSON in plain text for Ollama quirk detection"

requirements-completed: [AGNT-04, AGNT-05]

# Metrics
duration: 5min
completed: 2026-02-27
---

# Phase 20 Plan 03: Guard, Classifier, Rate Limiter & Entry Point Summary

**Ollama response guard with JSON repair, rule-based German legal complexity classifier, ioredis rate limiter, and unified runHelenaAgent() entry point combining all Helena components**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-27T15:16:50Z
- **Completed:** 2026-02-27T15:21:31Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- Two-layer Ollama response guard: experimental_repairToolCall hook for broken JSON + contentScanGuard for tool calls emitted as text
- Rule-based complexity classifier with German legal domain patterns determining inline/background mode and model tier 1/2/3
- Per-user per-hour rate limiter using ioredis INCR+EXPIRE with admin-configurable limits from SystemSettings
- Unified runHelenaAgent() that wires rate-limit -> classify -> tools -> prompt -> orchestrator -> guard with auto-escalation

## Task Commits

Each task was committed atomically:

1. **Task 1: Ollama response guard, complexity classifier, and rate limiter** - `697440f` (feat)
2. **Task 2: Unified Helena agent entry point (index.ts)** - `74ac387` (feat)

## Files Created/Modified
- `src/lib/helena/response-guard.ts` - ollamaResponseGuard (SDK repair hook) + contentScanGuard (text scanner)
- `src/lib/helena/complexity-classifier.ts` - classifyComplexity, getModelForTier, escalateTier
- `src/lib/helena/rate-limiter.ts` - checkRateLimit with ioredis per-user per-hour counter
- `src/lib/helena/index.ts` - runHelenaAgent public API + re-exports

## Decisions Made
- Rule-based classifier over LLM-based: zero latency for classification, no token cost, deterministic results
- Tier 3 (cloud) only activated for Schriftsatz + specific legal filing types -- all other complex tasks use tier 2 (big local)
- Rate limiter creates its own Redis connection (lazy singleton) separate from BullMQ to avoid maxRetriesPerRequest conflicts
- Fail open on Redis errors -- availability > protection for internal tool
- Auto-escalation limited to 1 retry: stall -> next tier -> if still stalled, return result (no infinite loop)
- Model name prefix convention (gpt*/claude* -> cloud, else -> ollama) enables tier-specific provider routing without separate config

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full Helena agent library complete at `src/lib/helena/`
- `runHelenaAgent()` is callable from any API route or background worker
- Plan 04 (smoke test / integration verification) can validate end-to-end flow
- Downstream phases (21-26) can import from `@/lib/helena` directly

## Self-Check: PASSED

All 4 created files verified on disk. Both task commits (697440f, 74ac387) verified in git log.

---
*Phase: 20-agent-tools-react-loop*
*Completed: 2026-02-27*
