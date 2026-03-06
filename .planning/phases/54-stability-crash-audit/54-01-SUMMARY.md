---
phase: 54-stability-crash-audit
plan: 01
subsystem: infra
tags: [docker, vitest, typescript, bullmq, healthcheck, security, crash-audit]

# Dependency graph
requires: []
provides:
  - "54-TRIAGE.md: classified crash vectors P0/P1/P2 with fix-wave assignments"
  - "54-SMOKE-TESTS.md: reproducible deploy verification checklist for all 9 Docker services"
affects: [54-02-PLAN.md, STAB-03, STAB-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Crash triage pattern: scan TypeScript + test suite + runtime vectors + silent catches + Docker healthchecks"
    - "Smoke test pattern: pre-flight (tsc/build/test) → health matrix → functional checks"

key-files:
  created:
    - .planning/phases/54-stability-crash-audit/54-TRIAGE.md
    - .planning/phases/54-stability-crash-audit/54-SMOKE-TESTS.md
  modified: []

key-decisions:
  - "NER ECONNREFUSED (10 test failures) classified as INFO/by-design — requires-ollama tag, not a crash"
  - "Worker missing healthcheck is P1 (C-01) — silently crashes without Docker knowing"
  - "OnlyOffice callback unauthenticated path is P1 (C-02) — private Docker network is only mitigation"
  - "NER hardcoded model blocking embeddings when Ollama offline is P1 (C-03) — availability risk"
  - "All P2 items (DDL race, SMTP cache, health alert cooldown, version snapshot, updateMany bypass, IMAP silent catch) deferred to future milestone"
  - "TypeScript: 0 errors — codebase compiles cleanly"
  - "Silent catch survey: 187 total; all critical-path catches are either logged or fire-and-forget annotated; no P0 silent swallowers found"

patterns-established:
  - "Phase 54 fix-wave pattern: P0/P1 → 54-02 immediate fixes; P2/P3 → deferred"

requirements-completed: [STAB-01]

# Metrics
duration: 12min
completed: 2026-03-06
---

# Phase 54 Plan 01: Crash Audit Summary

**Full crash audit producing 54-TRIAGE.md (9 classified vectors C-01..C-09, P1/P2) and 54-SMOKE-TESTS.md (pre-flight + health matrix + functional checks for all 9 Docker services)**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-06T20:29:10Z
- **Completed:** 2026-03-06T20:41:30Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- TypeScript check confirmed 0 errors — codebase is clean
- Test suite: 417/427 passing; 10 NER failures documented as by-design (requires live Ollama)
- 3 P1 crash vectors identified and assigned to 54-02: worker no healthcheck, OnlyOffice unauthenticated callback path, NER hardcoded model blocks embeddings
- 6 P2 tech-debt items documented and deferred (DDL race, SMTP cache, health alert cooldown, version snapshot bug, Prisma updateMany bypass, IMAP silent catch)
- Silent catch survey: 187 catches analyzed; all critical-path ones are logged or annotated fire-and-forget; no silent P0 crash swallowers found
- All 8 core service Docker healthchecks verified as correct (Stirling-PDF port alignment confirmed)
- Worker confirmed to have NO healthcheck — P1 risk documented
- Smoke test checklist: 3 pre-flight + 9-service health matrix + 5 functional tests + copy-paste deploy checklist

## Task Commits

1. **Task 1: Crash audit — scan and classify all crash vectors** - `b4b51d8` (feat)
2. **Task 2: Create smoke-test suite for Docker deploy verification** - `ddb6e46` (feat)

## Files Created/Modified

- `.planning/phases/54-stability-crash-audit/54-TRIAGE.md` — Crash triage document with P1/P2 classification, silent catch survey, Docker healthcheck audit, fix-wave assignment
- `.planning/phases/54-stability-crash-audit/54-SMOKE-TESTS.md` — Smoke-test suite with pre-flight checks, health matrix for all 9 services, aggregate bash script, functional tests ST-01..ST-05, deploy checklist

## Decisions Made

- NER acceptance test failures (10 tests, all ECONNREFUSED to Ollama port 11434) are INFO/by-design — test file is tagged `requires-ollama` and tests are expected to fail without a live Ollama instance running locally
- Worker missing Docker healthcheck elevated to P1: Docker Compose reports `running` but cannot detect a crashed/stuck worker process, making it invisible to orchestration
- OnlyOffice callback auth gap elevated to P1: the `if authHeader ... else if body.token ... else { proceed }` pattern means unauthenticated requests from the public internet (if port 8080 is exposed) reach full document processing. Current mitigation (private Docker network) is fragile
- All P2 items deferred — none are runtime crashes; all are operational/data-quality concerns

## Deviations from Plan

None — plan executed exactly as written. All scan sources (tsc, vitest, runtime vectors, silent catch grep, docker-compose.yml audit) were completed in order.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

54-TRIAGE.md provides Plan 02 with a clear, actionable list:
- C-01: Add Docker healthcheck to worker service
- C-02: Enforce mandatory JWT on OnlyOffice callback
- C-03: Make NER model configurable / degrade gracefully when Ollama offline

54-SMOKE-TESTS.md is the acceptance gate for STAB-03/STAB-04 deploy verification.

---
*Phase: 54-stability-crash-audit*
*Completed: 2026-03-06*
