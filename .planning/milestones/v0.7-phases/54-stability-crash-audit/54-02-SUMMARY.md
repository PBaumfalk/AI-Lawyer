---
phase: 54-stability-crash-audit
plan: "02"
subsystem: infra
tags: [docker, redis, ioredis, bullmq, healthcheck, onlyoffice, jwt, ner, ollama, pii, dsgvo, tdd]

requires:
  - phase: 54-01
    provides: Crash triage (54-TRIAGE.md) identifying C-01/C-02/C-03 as P1 fixes

provides:
  - Worker Docker healthcheck (wget app:3000/api/health, 30s interval, 90s start_period)
  - Redis-backed health-alert cooldown (health:alert:cooldown:{service}, EX 3600) with in-memory fallback
  - OnlyOffice callback mandatory JWT guard — returns {error:1} when no token present
  - NER model resolved dynamically from SystemSettings (ai.provider.model) with qwen3.5:35b fallback
  - 5 unit tests for Redis-backed alert cooldown

affects: [docker-smoke-check, health-monitoring, onlyoffice-documents, pii-filter, worker-stability]

tech-stack:
  added: []
  patterns:
    - "Redis TTL key pattern for distributed cooldowns: redis.set(key, '1', 'EX', ttlSeconds) with try/catch fallback"
    - "getNerModel() async helper — resolves SystemSettings with graceful fallback to hardcoded default"
    - "OnlyOffice callback JWT guard: check all three token sources (header, body, query) before processing"

key-files:
  created:
    - src/lib/health/alerts.test.ts
  modified:
    - src/lib/health/alerts.ts
    - src/app/api/onlyoffice/callback/route.ts
    - src/lib/pii/ner-filter.ts
    - docker-compose.yml

key-decisions:
  - "Redis connections for cooldown checks are short-lived (createRedisConnection + disconnect in finally) — no singleton needed for low-frequency health alerts"
  - "OnlyOffice JWT guard also handles query.token (additive, not in plan) — complete token coverage"
  - "NER model key is ai.provider.model (found in defaults.ts) — same model key used by Helena/provider chain"
  - "TypeScript: 0 errors; 422 non-Ollama tests passing (5 new alerts.test.ts added)"
  - "Docker smoke-check: automated pre-checks pass; full Docker smoke-check requires user environment"

requirements-completed: [STAB-02, STAB-03, STAB-04]

duration: 18min
completed: 2026-03-06
---

# Phase 54 Plan 02: P1 Stability Fixes Summary

**Worker Docker healthcheck, Redis-backed alert cooldown, mandatory OnlyOffice JWT guard, and configurable NER model — all P1 crashes from triage closed with 422 tests passing and TypeScript clean**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-03-06T20:33:00Z
- **Completed:** 2026-03-06T20:51:00Z
- **Tasks:** 2 complete + 1 checkpoint auto-approved
- **Files modified:** 5

## Accomplishments

- Worker container now has a Docker healthcheck — `docker inspect ailawyer-worker` will report health status instead of empty; crash loops are detectable
- Health-alert cooldown survives restarts — 60-min TTL stored as `health:alert:cooldown:{service}` Redis key with `EX 3600`, graceful in-memory fallback when Redis unavailable
- OnlyOffice callback no longer processes documents from unauthenticated callers — returns `{error:1}` (HTTP 200) when no JWT present in header, body, or query
- NER filter model reads `ai.provider.model` from SystemSettings at runtime — operators can switch models without code changes; fallback to `qwen3.5:35b` preserves DSGVO gate on settings failure

## Task Commits

1. **Task 1: P1 Infra — Worker healthcheck + Redis-backed health-alert cooldown** - `0707aea` (feat + test TDD)
2. **Task 2: P1 Security + P1 Availability — OnlyOffice callback + NER provider fix** - `4f4dc30` (fix)
3. **Task 3: Docker Smoke-Check** - auto-approved (auto_advance: true; automated checks passed)

## Files Created/Modified

- `src/lib/health/alerts.ts` — Replaced in-memory Map cooldown with Redis TTL keys; graceful in-memory fallback on Redis failure
- `src/lib/health/alerts.test.ts` — 5 TDD unit tests: hasCooldown false/true, setCooldown key+TTL, Redis error fallbacks (2 scenarios)
- `src/app/api/onlyoffice/callback/route.ts` — Added mandatory no-token guard at top of auth block; also validates query.token path
- `src/lib/pii/ner-filter.ts` — Replaced `const NER_MODEL` constant with `getNerModel()` async function reading `ai.provider.model` from SystemSettings
- `docker-compose.yml` — Added healthcheck block to worker service (wget, 30s interval, 10s timeout, 3 retries, 90s start_period)

## Decisions Made

- Redis connections for alert cooldowns are short-lived (create → use → disconnect in finally block). No singleton because health alerts fire at most once per 60 min per service — connection overhead is negligible and avoids a stale connection in the long-lived app process.
- The OnlyOffice JWT fix also handles `query.token` (not in the original plan spec). This is additive and provides complete JWT coverage matching the OnlyOffice documentation.
- NER model key is `ai.provider.model` (verified in `src/lib/settings/defaults.ts:119`). Same key used by the Helena/provider chain, so NER automatically follows operator model changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] OnlyOffice query.token path added**
- **Found during:** Task 2 (OnlyOffice callback fix)
- **Issue:** Plan specified header + body.token check. OnlyOffice can also pass token as query param — omitting this leaves a gap.
- **Fix:** Added `queryToken` extraction and verification as a third token path, consistent with the existing header/body pattern.
- **Files modified:** src/app/api/onlyoffice/callback/route.ts
- **Verification:** TypeScript 0 errors; all tests pass
- **Committed in:** 4f4dc30 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical security path)
**Impact on plan:** Additive security fix. No scope creep. Existing test suite unaffected.

## Issues Encountered

None — all three fixes applied cleanly. TypeScript compiled clean throughout.

## User Setup Required

None — no external service configuration required for these fixes. The Docker smoke-check (Task 3) requires running `docker compose up -d` locally to verify all services reach "healthy" state with the new worker healthcheck.

## Next Phase Readiness

- All P0/P1 crashes from 54-TRIAGE.md are closed (C-01, C-02, C-03)
- P2 items (C-04 through C-09) remain deferred to future milestones — documented in 54-TRIAGE.md
- Codebase: TypeScript 0 errors, 422 tests passing
- Docker: worker healthcheck added; full smoke-check verification requires user environment

---
*Phase: 54-stability-crash-audit*
*Completed: 2026-03-06*
