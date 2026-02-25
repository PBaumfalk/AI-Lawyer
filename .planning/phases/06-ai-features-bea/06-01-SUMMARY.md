---
phase: 06-ai-features-bea
plan: 01
subsystem: ai
tags: [ai-sdk, openai, anthropic, ollama, token-tracking, rate-limiting, provider-factory]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation
    provides: SystemSetting model, settings service, prisma db, middleware
  - phase: 04-document-pipeline-ocr-rag
    provides: Existing AI prompt templates, process-tasks.ts, ollama.ts
provides:
  - Multi-provider AI factory (getModel, testProviderConnection, isProviderAvailable)
  - Token usage tracking (trackTokenUsage, getTokenUsageSummary, checkBudget)
  - Helena system bot user with isSystem flag
  - Admin AI settings page at /einstellungen/ki
  - Rate-limited /api/openclaw/process endpoint (ADMIN + gateway)
  - KI-Entwurf workflow enforcement (all AI output = ENTWURF)
  - Provider test API at /api/ki/provider-test
  - Token usage API at /api/ki/usage
affects: [06-02, 06-03, 06-04, 06-05]

# Tech tracking
tech-stack:
  added: [ai@4.3, @ai-sdk/openai@1.3, @ai-sdk/anthropic@1.2, @ai-sdk/react@1.2, ollama-ai-provider@1.2]
  patterns: [multi-provider-factory, token-tracking-wrapper, in-memory-rate-limiter, helena-bot-attribution]

key-files:
  created:
    - src/lib/ai/provider.ts
    - src/lib/ai/token-tracker.ts
    - src/app/(dashboard)/einstellungen/ki/page.tsx
    - src/app/api/ki/provider-test/route.ts
    - src/app/api/ki/usage/route.ts
  modified:
    - package.json
    - prisma/schema.prisma
    - prisma/seed.ts
    - src/lib/ai/ollama.ts
    - src/lib/ai/process-tasks.ts
    - src/lib/settings/defaults.ts
    - src/app/api/openclaw/process/route.ts
    - src/middleware.ts

key-decisions:
  - "ollama-ai-provider (not ollama-ai-provider-v2) as the package name for Ollama AI SDK support"
  - "Helena user has SACHBEARBEITER role + isSystem:true + aktiv:false (cannot login, identified by isSystem flag)"
  - "In-memory sliding window rate limiter (10 req/min per user) for /api/openclaw/process"
  - "Provider instance caching with config-change invalidation to avoid per-request creation"
  - "OpenClaw gateway token kept as secondary auth method on /api/openclaw/process for backward compatibility"
  - "Array.from pattern for Map iteration (downlevelIteration TS compat, consistent with project convention)"

patterns-established:
  - "Provider factory pattern: getModel() reads from SystemSetting, caches instances, invalidates on config change"
  - "Token tracking wrapper: wrapWithTracking() records usage from AI SDK result.usage automatically"
  - "Helena attribution: getHelenaUserId() cached lookup, used in all AI-generated content"
  - "Rate limiter: in-memory Map with sliding window timestamps, cleanup interval"

requirements-completed: [REQ-KI-002, REQ-KI-009, REQ-KI-012, REQ-KI-008]

# Metrics
duration: 7min
completed: 2026-02-25
---

# Phase 6 Plan 1: AI Foundation Summary

**AI SDK v4 multi-provider factory with Ollama/OpenAI/Anthropic, token tracking with monthly budget, Helena bot user, admin settings UI, and rate-limited OpenClaw endpoint**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-25T05:18:08Z
- **Completed:** 2026-02-25T05:25:29Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Multi-provider AI factory reading provider config from SystemSetting, supporting Ollama, OpenAI, and Anthropic with cached instances
- Token usage tracking with per-request recording, period aggregation, and monthly budget enforcement
- Admin AI settings page at /einstellungen/ki with provider selection, connection test, token usage dashboard, and budget visualization
- Helena system bot user in seed, attributed as author of all AI-generated content
- Rate-limited and RBAC-restricted /api/openclaw/process endpoint (ADMIN + gateway only, 10 req/min)
- Graceful degradation with "Helena ist gerade nicht verfuegbar" banner when provider unreachable

## Task Commits

Each task was committed atomically:

1. **Task 1: Install AI SDK v4 + Create Provider Factory + Schema Changes + Helena User** - `e0ad619` (feat)
2. **Task 2: Admin AI Settings Page + Rate Limiting + KI-Entwurf Enforcement + Graceful Degradation** - `8a79c0e` (feat)

## Files Created/Modified
- `src/lib/ai/provider.ts` - Multi-provider AI factory with getModel(), testProviderConnection(), getHelenaUserId()
- `src/lib/ai/token-tracker.ts` - Token usage tracking, aggregation, budget enforcement, wrapWithTracking()
- `src/lib/ai/ollama.ts` - Refactored to use AI SDK via provider factory (backward-compatible signature)
- `src/lib/ai/process-tasks.ts` - Updated to use AI SDK, Helena attribution, token tracking
- `prisma/schema.prisma` - Added TokenUsage model and User.isSystem field
- `prisma/seed.ts` - Added Helena system user (helena@system.local, isSystem: true)
- `src/lib/settings/defaults.ts` - Added AI and beA default settings (12 new settings)
- `src/app/(dashboard)/einstellungen/ki/page.tsx` - Admin AI settings page with full configuration UI
- `src/app/api/ki/provider-test/route.ts` - POST endpoint for testing provider connection
- `src/app/api/ki/usage/route.ts` - GET endpoint for token usage summary and budget
- `src/app/api/openclaw/process/route.ts` - RBAC + rate limiting + provider availability check
- `src/middleware.ts` - Added /api/ki/* to path exemptions
- `package.json` - Added AI SDK v4 dependencies

## Decisions Made
- Used `ollama-ai-provider` package (not `ollama-ai-provider-v2` from plan, as the actual npm package name is `ollama-ai-provider`)
- Helena user created with `aktiv: false` to prevent login, identified via `isSystem: true` flag
- Provider instances cached and invalidated when configuration changes (key/URL mismatch detection)
- OpenClaw gateway token auth preserved alongside new ADMIN RBAC for backward compatibility
- Rate limiter uses in-memory Map with 5-minute cleanup interval (sufficient for single-process deployment)
- /api/ki/* routes added to middleware exemptions (auth handled within route handlers)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Package name ollama-ai-provider (not ollama-ai-provider-v2)**
- **Found during:** Task 1 (npm install)
- **Issue:** Plan specified `ollama-ai-provider-v2` but the actual npm package is `ollama-ai-provider`
- **Fix:** Used correct package name `ollama-ai-provider@^1.2`
- **Files modified:** package.json
- **Verification:** npm ls confirms installed correctly
- **Committed in:** e0ad619

**2. [Rule 1 - Bug] Array.from for Map iteration (TS downlevelIteration)**
- **Found during:** Task 2 (rate limiter cleanup)
- **Issue:** `for..of` on Map.entries() fails without downlevelIteration flag
- **Fix:** Used `Array.from(requestLog.entries())` pattern (consistent with project convention)
- **Files modified:** src/app/api/openclaw/process/route.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 8a79c0e

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Minor corrections for correct package name and TypeScript compatibility. No scope creep.

## Issues Encountered
- Database not running locally (prisma db push failed), but prisma generate succeeded -- schema changes will apply at next deployment or Docker start.

## User Setup Required
None - no external service configuration required. AI provider configuration is done via the admin UI at /einstellungen/ki.

## Next Phase Readiness
- Provider factory ready for document chat (Plan 02) and KI-Entwurf generation (Plan 03)
- Token tracking infrastructure ready for all AI features
- Helena user available for attribution in all subsequent AI plans
- Settings defaults registered for scan, briefing, and beA configuration

---
*Phase: 06-ai-features-bea*
*Completed: 2026-02-25*
