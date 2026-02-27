---
gsd_state_version: 1.0
milestone: v0.2
milestone_name: Helena Agent
status: unknown
last_updated: "2026-02-27T20:12:17.983Z"
progress:
  total_phases: 14
  completed_phases: 13
  total_plans: 38
  completed_plans: 38
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** Helena wird vom Chat-Bot zum autonomen Agenten — ReAct-Loop mit Tool-Calling, deterministischer Schriftsatz-Orchestrator, proaktiver Background-Scanner mit Alerts, per-Akte Memory und QA-Gates mit Audit-Trail.
**Current focus:** v0.2 Helena Agent — Phase 22 in progress

## Current Position

Phase: 23 of 26 (Draft-Approval Workflow)
Plan: 0 of 2 in current phase
Status: Phase 22 complete, ready for Phase 23
Last activity: 2026-02-27 — Completed 22-02 RAG Assembly + ERV Validator + Pipeline Orchestrator

Progress: [██████░░░░] 56%

## Performance Metrics

**Velocity:**
- Total plans completed: 71 (v3.4: 38 + v3.5: 10 + v0.1: 19)
- v0.2 plans: 9/16

**By Phase (v0.2):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 19. Schema Foundation | 1/1 | 3min | 3min |
| 20. Agent Tools + ReAct Loop | 4/4 | 22min | 5.5min |
| 21. @Helena Task-System | 2/2 | 6min | 3min |
| 22. Schriftsatz Orchestrator | 2/2 | 14min | 7min |
| 23. Draft-Approval Workflow | 0/2 | - | - |
| 24. Scanner + Alerts | 0/2 | - | - |
| 25. Helena Memory | 0/1 | - | - |
| 26. Activity Feed UI + QA-Gates | 0/3 | - | - |

## Accumulated Context

### Decisions

All v0.1 decisions archived in STATE.md history.
Recent decisions affecting v0.2:

- Zero new npm packages — all agent capabilities built on existing AI SDK v4 + BullMQ + Prisma + Socket.IO
- AI SDK stays on v4.3.19 — v5/v6 migration deferred to v0.3
- Two execution modes: inline (5-step, HTTP) and background (20-step, BullMQ)
- Schriftsatz uses deterministic generateObject pipeline, NOT free-form ReAct agent
- ENTWURF gate must be Prisma middleware (not HTTP middleware) — BRAK 2025 compliance
- lockDuration:120000 on helena-agent queue (default 30s would cause duplicate agent runs)
- Strict Prisma enums for Helena Agent models (not strings like HelenaSuggestion)
- JSON steps[] on HelenaTask for agent trace (avoid over-normalization)
- @unique on HelenaMemory.akteId for one-memory-per-Akte upsert pattern
- Named relations HelenaDraftUser/HelenaDraftReviewer for dual User FKs
- ON DELETE CASCADE on all Helena model akteId FKs (DSGVO Art. 17)
- Static import registry for Helena tools (not dynamic require) -- esbuild bundling compatibility
- HelenaDraft.akteId non-nullable -- notes always require Akte context
- create_draft_zeiterfassung uses HelenaDraftTyp.NOTIZ with meta.subtype (no ZEITERFASSUNG enum)
- ToolSet generic type assertion for toolResults in onStepFinish -- AI SDK resolves execute return to never
- Direct trackTokenUsage in orchestrator instead of wrapWithTracking -- aggregates across all steps
- Stall force message injected as user role message for natural conversation flow
- Rule-based complexity classifier (no LLM call) with German legal term patterns for mode/tier selection
- Fail-open rate limiter: allow requests when Redis unavailable, log warning
- Auto-escalation capped at 1 retry to prevent infinite loops on stall
- Model name prefix convention (gpt*/claude* -> cloud) for tier-specific provider routing
- ioredis mock uses class pattern (not vi.fn) for new Redis() constructor compatibility in vitest
- generateText mock uses swappable generateTextMockImpl variable for per-test LLM behavior control
- BullMQ priority inversion: Math.max(1, 10 - prioritaet) maps domain priority to BullMQ priority
- HelenaTaskJobData exported from processor, imported as type in task-service (clean dependency direction)
- In-process AbortController map for task cancellation (not Redis -- must be same process as agent)
- lockDuration:120_000 on Worker instance (not queue) per BullMQ v5 best practice
- Helena API uses requireAuth() + buildAkteAccessFilter() (consistent with existing route patterns)
- No PRAKTIKANT check in Helena API -- role removed in Phase 8, all 4 existing roles can use @Helena
- IntentResultSchema.rechtsgebiet aligns with Prisma Sachgebiet enum (VERKEHRSRECHT, INKASSO) for direct mapping
- fillSlots() is pure function (no LLM, no DB) for deterministic behavior and easy testing
- {{UPPER_SNAKE_CASE}} is the unified Platzhalter standard for all Schriftsatz output
- Akte pre-fill populates all alias slots (PARTEI_A, ANTRAGSTELLER, BERUFUNGSKLAEGER, ABSENDER) from mandant/gegner
- Abmahnung has custom section config (aussergerichtlich nature, no beweisangebote/anlagen/kosten)
- ERV-Validator never hard-blocks draft creation -- warnings only, sorted by severity (KRITISCH/WARNUNG/INFO)
- RAG context capped at 4000 chars per section to keep LLM prompts manageable
- isSchriftsatzIntent is a fast heuristic (no LLM) -- pattern matching on filing terms + action verbs
- Pipeline stores SchriftsatzSchema as HelenaDraft.meta JSON for downstream processing
- Schriftsatz routing is an early return in runHelenaAgent -- ReAct code path completely untouched
- computeGkgFee * 3 for Klageverfahren court costs in Kosten section

### Pending Todos

3 deferred from v0.1:
- Falldatenblaetter — deferred to post-v0.2
- BI-Dashboard — deferred to post-v0.2
- Export CSV/XLSX — deferred to post-v0.2

### Blockers/Concerns

- Ollama qwen3.5:35b tool call format instability — smoke test every tool through full Ollama stack before shipping (Phase 20)
- Schriftsatz section schemas need Anwalt review before Phase 22 ships (ZPO 253, 130)
- Pin Ollama Docker image version before Phase 20 — tool call behavior is version-dependent

## Session Continuity

Last session: 2026-02-27
Stopped at: Completed 22-02-PLAN.md (RAG Assembly + ERV Validator + Pipeline Orchestrator) -- Phase 22 complete
Resume file: .planning/phases/22-deterministic-schriftsatz-orchestrator/22-02-SUMMARY.md
