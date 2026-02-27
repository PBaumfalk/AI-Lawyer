---
gsd_state_version: 1.0
milestone: v3.4
milestone_name: Helena Agent
status: in-progress
last_updated: "2026-02-27T15:13:31.000Z"
progress:
  total_phases: 11
  completed_phases: 10
  total_plans: 30
  completed_plans: 31
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** Helena wird vom Chat-Bot zum autonomen Agenten — ReAct-Loop mit Tool-Calling, deterministischer Schriftsatz-Orchestrator, proaktiver Background-Scanner mit Alerts, per-Akte Memory und QA-Gates mit Audit-Trail.
**Current focus:** v0.2 Helena Agent — Phase 20 in progress

## Current Position

Phase: 20 of 26 (Agent Tools + ReAct Loop)
Plan: 3 of 4 in current phase
Status: Plan 20-02 complete, continuing Phase 20
Last activity: 2026-02-27 — Completed 20-02 ReAct Orchestrator (runAgent, token budget, stall detection)

Progress: [██░░░░░░░░] 19%

## Performance Metrics

**Velocity:**
- Total plans completed: 68 (v3.4: 38 + v3.5: 10 + v0.1: 19)
- v0.2 plans: 3/16

**By Phase (v0.2):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 19. Schema Foundation | 1/1 | 3min | 3min |
| 20. Agent Tools + ReAct Loop | 2/4 | 12min | 6min |
| 21. @Helena Task-System | 0/2 | - | - |
| 22. Schriftsatz Orchestrator | 0/2 | - | - |
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
Stopped at: Completed 20-02-PLAN.md (ReAct Orchestrator). Phase 20 in progress (2/4 plans).
Resume file: None
