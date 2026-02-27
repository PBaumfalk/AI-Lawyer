# Roadmap: AI-Lawyer

## Milestones

- ✅ **v3.4 Full-Featured Kanzleisoftware** — Phases 1-9 (shipped 2026-02-25)
- ✅ **v3.5 Production Ready** — Phases 10-11 (shipped 2026-02-26)
- ✅ **v0.1 Helena RAG** — Phases 12-18 (shipped 2026-02-27)
- 🚧 **v0.2 Helena Agent** — Phases 19-26 (in progress)

## Phases

<details>
<summary>v3.4 Full-Featured Kanzleisoftware (Phases 1-9) -- SHIPPED 2012-02-25</summary>

- [x] Phase 1: Infrastructure Foundation (3/3 plans) -- completed 2012-02-24
- [x] Phase 2: Deadline Calculation + Document Templates (6/6 plans) -- completed 2012-02-24
- [x] Phase 2.1: Wire Frist-Reminder Pipeline + Settings Init (1/1 plan) -- completed 2012-02-24
- [x] Phase 2.2: Fix API Routes + UI Paths (1/1 plan) -- completed 2012-02-24
- [x] Phase 3: Email Client (4/4 plans) -- completed 2012-02-24
- [x] Phase 3.1: Wire Email Real-Time + Compose Integration (1/1 plan) -- completed 2012-02-24
- [x] Phase 4: Document Pipeline (OCR + RAG Ingestion) (3/3 plans) -- completed 2012-02-24
- [x] Phase 4.1: Wire Akte Real-Time + Email Compose + Admin Pipeline (1/1 plan) -- completed 2012-02-24
- [x] Phase 5: Financial Module (6/6 plans) -- completed 2012-02-24
- [x] Phase 6: AI Features + beA (5/5 plans) -- completed 2012-02-25
- [x] Phase 7: Rollen/Sicherheit + Compliance + Observability (3/3 plans) -- completed 2012-02-25
- [x] Phase 8: Integration Hardening (3/3 plans) -- completed 2012-02-25
- [x] Phase 9: Final Integration Wiring + Tech Debt (1/1 plan) -- completed 2012-02-25

**Total: 13 phases, 38 plans, 105 tasks, 64/64 requirements**

See: `milestones/v3.4-ROADMAP.md` for full phase details.

</details>

<details>
<summary>✅ v3.5 Production Ready (Phases 10-11) — SHIPPED 2026-02-26</summary>

- [x] Phase 10: Docker Build Fix (3/3 plans) — completed 2026-02-25
- [x] Phase 11: Glass UI Migration (7/7 plans) — completed 2026-02-26

**Total: 2 phases, 10 plans**

See: `milestones/v3.5-ROADMAP.md` for full phase details.

</details>

<details>
<summary>✅ v0.1 Helena RAG (Phases 12-18) — SHIPPED 2026-02-27</summary>

- [x] Phase 12: RAG Schema Foundation (1/1 plan) — completed 2026-02-26
- [x] Phase 13: Hybrid Search + Reranking (3/3 plans) — completed 2026-02-27
- [x] Phase 14: Gesetze-RAG (3/3 plans) — completed 2026-02-27
- [x] Phase 15: Normen-Verknüpfung in Akte (3/3 plans) — completed 2026-02-27
- [x] Phase 16: PII-Filter (3/3 plans) — completed 2026-02-27
- [x] Phase 17: Urteile-RAG (3/3 plans) — completed 2026-02-27
- [x] Phase 18: Muster-RAG + Admin Upload UI (3/3 plans) — completed 2026-02-27

**Total: 7 phases, 19 plans, 16/16 requirements**

See: `milestones/v0.1-ROADMAP.md` for full phase details.

</details>

### 🚧 v0.2 Helena Agent (In Progress)

**Milestone Goal:** Helena wird vom Chat-Bot zum autonomen Agenten — ReAct-Loop mit Tool-Calling, deterministischer Schriftsatz-Orchestrator, @-Tagging Task-System, Draft-Approval-Workflow, proaktiver Background-Scanner mit Alerts, per-Akte Memory und QA-Gates mit Audit-Trail. Akte-Detail wird zum Activity Feed.

- [x] **Phase 19: Schema Foundation** - Prisma models for HelenaTask, HelenaDraft, HelenaAlert, HelenaMemory, AktenActivity (completed 2026-02-27)
- [x] **Phase 20: Agent Tools + ReAct Loop** - Shared tool library (9 read + 5 write) and bounded ReAct agent loop with safeguards (completed 2026-02-27)
- [x] **Phase 21: @Helena Task-System** - @-mention parsing, HelenaTask queue, BullMQ worker, task lifecycle (completed 2026-02-27)
- [x] **Phase 22: Deterministic Schriftsatz Orchestrator** - Intent-Router, Slot-Filling, SchriftsatzSchema, RAG Assembly, ERV-Validator (completed 2026-02-27)
- [x] **Phase 23: Draft-Approval Workflow** - HelenaDraft lifecycle, ENTWURF Prisma middleware gate, accept/reject/edit with feedback (completed 2026-02-27)
- [ ] **Phase 24: Scanner + Alerts** - Background scanner cron, 6 alert types, deduplication, alert-center, Socket.IO push
- [ ] **Phase 25: Helena Memory** - Per-Akte context storage, auto-refresh, DSGVO cascade delete
- [ ] **Phase 26: Activity Feed UI + QA-Gates** - Akte-Detail feed umbau, composer, alert-center widget, QA goldset, retrieval metrics, audit trail

## Phase Details

### Phase 19: Schema Foundation
**Goal**: All database models for the Helena Agent system exist and are migrated — the data layer that every subsequent phase depends on
**Depends on**: Phase 18 (v0.1 Helena RAG)
**Requirements**: TASK-02, DRFT-01, ALRT-01, MEM-01
**Success Criteria** (what must be TRUE):
  1. `npx prisma migrate deploy` succeeds with all 5 new models (HelenaTask, HelenaDraft, HelenaAlert, HelenaMemory, AktenActivity) in the database
  2. HelenaTask has status enum (PENDING, RUNNING, DONE, FAILED, WAITING_APPROVAL, ABGEBROCHEN) and JSON steps[] field for agent trace
  3. HelenaDraft has type enum (DOKUMENT, FRIST, NOTIZ, ALERT) and status enum (PENDING, ACCEPTED, REJECTED, EDITED) with feedback field
  4. All new models have proper foreign keys to Akte and User with ON DELETE CASCADE for DSGVO compliance
  5. Prisma Client generates cleanly and existing application starts without errors
**Plans**: 1 plan

Plans:
- [ ] 19-01-PLAN.md --- Add 5 Helena Agent models (HelenaTask, HelenaDraft, HelenaAlert, HelenaMemory, AktenActivity) + 5 enums + reverse relations + migration

### Phase 20: Agent Tools + ReAct Loop
**Goal**: Helena can execute bounded multi-step reasoning with tool calls as a pure TypeScript library testable in isolation — the engine that powers all agent features
**Depends on**: Phase 19
**Requirements**: AGNT-01, AGNT-02, AGNT-03, AGNT-04, AGNT-05, AGNT-06
**Success Criteria** (what must be TRUE):
  1. Helena executes a ReAct loop (Reason-Act-Observe) up to 20 steps in background mode and 5 steps in inline mode, returning a user-friendly fallback message at the cap
  2. All 9 read-tools return Akte/document/deadline/law/ruling/muster/cost data from the database when called by the agent
  3. All 5 write-tools create their outputs exclusively as drafts/proposals (never as final records directly)
  4. Ollama tool-call response guard detects JSON-as-content responses from qwen3.5:35b and corrects them before the loop continues
  5. Token budget manager truncates oldest tool results when approaching 75% of context window — no context overflow crashes
  6. Rate limiter enforces admin-configurable per-user per-hour request limits
  7. Unit tests for tool factory functions and integration tests for the ReAct loop pass
**Plans**: 4 plans

Plans:
- [ ] 20-01-PLAN.md — Shared tool library: types, factory, 18+ tool modules (12 read + 6 write), role filter, cache, audit, system prompt
- [ ] 20-02-PLAN.md — ReAct orchestrator: generateText wrapper with stall detector, token budget manager, step tracing, parallel tool call support
- [ ] 20-03-PLAN.md — Ollama response guard, complexity classifier, rate limiter, unified runHelenaAgent() entry point
- [ ] 20-04-PLAN.md — Unit tests for tools + infrastructure, integration tests for ReAct loop with mock LLM

### Phase 21: @Helena Task-System
**Goal**: Users can trigger Helena tasks by typing @Helena in any note/comment field and track task progress in real-time
**Depends on**: Phase 20
**Requirements**: TASK-01, TASK-03, TASK-04, TASK-05, AGNT-07
**Success Criteria** (what must be TRUE):
  1. Typing "@Helena [Aufgabe]" in a note or comment field creates a HelenaTask in PENDING status and enqueues a BullMQ job
  2. Running tasks emit Socket.IO progress events showing current step number and tool being used
  3. HelenaTask stores the complete agent trace (thoughts + tool calls as JSON steps[]) after completion
  4. Manually triggered tasks (via @-tag) run at higher priority than scanner-generated tasks
  5. User can abort a running task from the UI, and the agent loop stops between steps (status -> ABGEBROCHEN)
**Plans**: 2 plans

Plans:
- [ ] 21-01-PLAN.md — @Helena mention parser, task service, BullMQ helena-task queue, and processor with Socket.IO progress
- [ ] 21-02-PLAN.md — Helena task API routes (create/list/detail/abort), worker registration with lockDuration: 120_000, startup recovery

### Phase 22: Deterministic Schriftsatz Orchestrator
**Goal**: Helena can draft legally-structured court filings via a deterministic pipeline (not free-form agent), with every section validated against retrieved legal sources
**Depends on**: Phase 20
**Requirements**: ORCH-01, ORCH-02, ORCH-03, ORCH-04, ORCH-05, ORCH-06, ORCH-07
**Success Criteria** (what must be TRUE):
  1. Helena produces a Zod-validated SchriftsatzSchema with all mandatory sections (Rubrum, Antraege, Sachverhalt, Rechtliche Wuerdigung, Beweisangebote, Anlagen, Kosten, Formales)
  2. Intent-Router correctly identifies Klageart, Stadium, and Gerichtszweig from natural language user input (KSchG-Klage, Mahnung, EV-Antrag, etc.)
  3. Missing mandatory fields (Klaeger, Beklagter, Kuendigungsdatum etc.) trigger automatic Rueckfrage to the user before proceeding
  4. Every generated Schriftsatz contains retrieval_belege[] documenting which RAG chunks were used (audit trail)
  5. ERV/beA-Validator runs as the last step and produces warnings[] for PDF/A compliance, signature requirements, and file size limits
**Plans**: TBD

Plans:
- [ ] 22-01: SchriftsatzSchema (Zod), Intent-Router, Slot-Filling with automatic Rueckfrage
- [ ] 22-02: RAG Assembly pipeline, unified Platzhalter standard, and ERV-Validator with retrieval_belege audit trail

### Phase 23: Draft-Approval Workflow
**Goal**: Every Helena output goes through explicit human approval before becoming a real record, with BRAK-compliant enforcement at the database level
**Depends on**: Phase 19, Phase 20
**Requirements**: DRFT-02, DRFT-03, DRFT-04, DRFT-05, DRFT-06
**Success Criteria** (what must be TRUE):
  1. Prisma middleware enforces that any document created by Helena always has status=ENTWURF — cannot be bypassed even by direct Prisma calls (BRAK 2025 / BRAO 43)
  2. HelenaDraft entries appear in the Akte feed as "Helena-Entwurf - ausstehend" with Accept/Reject/Edit buttons
  3. Rejecting a draft with feedback stores the reason in Helena context for future improvement
  4. Accepting a draft automatically creates the corresponding Dokument/Frist/Notiz in the Akte
  5. Socket.IO notification fires to the responsible user when Helena creates a new draft
**Plans**: TBD

Plans:
- [ ] 23-01: ENTWURF Prisma middleware gate and HelenaDraft lifecycle (accept/reject/edit with auto-creation)
- [ ] 23-02: Draft notification (Socket.IO) and rejection-feedback-to-context pipeline

### Phase 23.1: Integration Wiring Fixes
**Goal**: Close cross-phase integration gaps found by milestone audit — wire orphaned modules and fix multi-turn Schriftsatz flow
**Depends on**: Phase 22, Phase 23
**Requirements**: DRFT-06, ORCH-04
**Gap Closure:** Closes integration gaps from v0.2 audit
**Success Criteria** (what must be TRUE):
  1. `update-akte-rag.ts` calls `notifyDraftCreated` after `helenaDraft.create` (completes DRFT-06 for all 6 write-tool sites)
  2. Schriftsatz pipeline Rueckfragen can be answered via follow-up message — `userSlotValues` routing through agent options or conversation state persistence enables multi-turn slot-filling (ORCH-04)
**Plans**: TBD

### Phase 24: Scanner + Alerts
**Goal**: Helena proactively scans all open cases nightly and surfaces critical issues as prioritized alerts without users needing to ask
**Depends on**: Phase 19, Phase 20
**Requirements**: SCAN-01, SCAN-02, SCAN-03, SCAN-04, SCAN-05, SCAN-06, ALRT-02, ALRT-03, ALRT-04, ALRT-05
**Success Criteria** (what must be TRUE):
  1. A BullMQ cron job runs nightly scanning all open Akten for Frist-Check, Inaktivitaets-Check, Anomalie-Check, and Neu-Urteil-Check
  2. Scanner thresholds are configurable per check type (days for Frist warning, inactivity period, etc.)
  3. Duplicate alerts (same type + same Akte within 24h) are suppressed automatically
  4. Alert-Center in the dashboard shows filterable alerts by type, Akte, priority, and gelesen/ungelesen status
  5. FRIST_KRITISCH alerts trigger an additional Socket.IO push notification to the responsible user in real-time
**Plans**: TBD

Plans:
- [ ] 24-01: Background scanner processor (BullMQ cron) with 4 check types and configurable thresholds
- [ ] 24-02: Alert service with deduplication, Alert-Center REST API, and Socket.IO push for critical alerts

### Phase 25: Helena Memory
**Goal**: Helena remembers case context across sessions and automatically refreshes her understanding when a case changes
**Depends on**: Phase 19, Phase 20
**Requirements**: MEM-02, MEM-03, MEM-04
**Success Criteria** (what must be TRUE):
  1. When Helena is invoked on an Akte, her system prompt includes the stored case summary, recognized risks, next steps, and open questions
  2. Memory auto-refreshes when the Akte has changed since the last memory update (new document, new deadline, new Beteiligte, etc.)
  3. Deleting an Akte cascading-deletes all associated HelenaMemory entries (DSGVO Art. 17 compliance)
**Plans**: TBD

Plans:
- [ ] 25-01: HelenaMemory service (load into agent context, staleness detection, auto-refresh trigger, DSGVO cascade)

### Phase 26: Activity Feed UI + QA-Gates
**Goal**: The Akte detail page shows a unified chronological activity feed replacing tabs, and Helena quality is measurable via goldset tests, retrieval metrics, and hallucination checks
**Depends on**: Phase 21, Phase 22, Phase 23, Phase 24
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, QA-01, QA-02, QA-03, QA-04, QA-05, QA-06, QA-07
**Success Criteria** (what must be TRUE):
  1. Akte detail shows a chronological Activity Feed with all events (documents, deadlines, emails, Helena drafts, alerts, notes) replacing old tab navigation
  2. Users can write notes and @Helena directly in a composer widget within the feed
  3. Every feed entry clearly shows whether it was created by Helena or a human (visual attribution with distinct styling)
  4. Alert-Center dashboard widget shows badge count for unread alerts
  5. Helena task progress is visible in-chat (step X of Y, current tool name) and draft review is possible inline without page navigation
**Plans**: TBD

Plans:
- [ ] 26-01: Activity Feed component (REST + Socket.IO), Akte detail integration, Helena vs Human attribution
- [ ] 26-02: Feed Composer with @Helena tagging, Alert-Center dashboard widget, task progress display
- [ ] 26-03: QA goldset (>=20 queries Arbeitsrecht), retrieval metrics (Recall@k, MRR, hallucination check), retrieval log per draft, release gates, no-PII-in-logs

## Progress

**Execution Order:**
Phases execute: 19 -> 20 -> 21 + 22 + 23 -> 23.1 -> 24 + 25 (parallel-eligible, executed sequentially) -> 26

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 19. Schema Foundation | v0.2 | 1/1 | Complete | 2026-02-27 |
| 20. Agent Tools + ReAct Loop | v0.2 | 4/4 | Complete | 2026-02-27 |
| 21. @Helena Task-System | v0.2 | 2/2 | Complete | 2026-02-27 |
| 22. Schriftsatz Orchestrator | v0.2 | 2/2 | Complete | 2026-02-27 |
| 23. Draft-Approval Workflow | v0.2 | 3/3 | Complete | 2026-02-27 |
| 23.1. Integration Wiring Fixes | 3/3 | Complete   | 2026-02-27 | - |
| 24. Scanner + Alerts | v0.2 | 0/2 | Not started | - |
| 25. Helena Memory | v0.2 | 0/1 | Not started | - |
| 26. Activity Feed UI + QA-Gates | v0.2 | 0/3 | Not started | - |

---
*Roadmap created: 2026-02-27*
*Last updated: 2026-02-27*
