# Roadmap: AI-Lawyer

## Milestones

- ✅ **v3.4 Full-Featured Kanzleisoftware** — Phases 1-9 (shipped 2026-02-25)
- ✅ **v3.5 Production Ready** — Phases 10-11 (shipped 2026-02-26)
- ✅ **v0.1 Helena RAG** — Phases 12-18 (shipped 2026-02-27)
- ✅ **v0.2 Helena Agent** — Phases 19-27 (shipped 2026-02-28)
- [ ] **v0.3 Kanzlei-Collaboration** — Phases 28-32 (in progress)

## Phases

<details>
<summary>v3.4 Full-Featured Kanzleisoftware (Phases 1-9) -- SHIPPED 2026-02-25</summary>

- [x] Phase 1: Infrastructure Foundation (3/3 plans) -- completed 2026-02-24
- [x] Phase 2: Deadline Calculation + Document Templates (6/6 plans) -- completed 2026-02-24
- [x] Phase 2.1: Wire Frist-Reminder Pipeline + Settings Init (1/1 plan) -- completed 2026-02-24
- [x] Phase 2.2: Fix API Routes + UI Paths (1/1 plan) -- completed 2026-02-24
- [x] Phase 3: Email Client (4/4 plans) -- completed 2026-02-24
- [x] Phase 3.1: Wire Email Real-Time + Compose Integration (1/1 plan) -- completed 2026-02-24
- [x] Phase 4: Document Pipeline (OCR + RAG Ingestion) (3/3 plans) -- completed 2026-02-24
- [x] Phase 4.1: Wire Akte Real-Time + Email Compose + Admin Pipeline (1/1 plan) -- completed 2026-02-24
- [x] Phase 5: Financial Module (6/6 plans) -- completed 2026-02-24
- [x] Phase 6: AI Features + beA (5/5 plans) -- completed 2026-02-25
- [x] Phase 7: Rollen/Sicherheit + Compliance + Observability (3/3 plans) -- completed 2026-02-25
- [x] Phase 8: Integration Hardening (3/3 plans) -- completed 2026-02-25
- [x] Phase 9: Final Integration Wiring + Tech Debt (1/1 plan) -- completed 2026-02-25

**Total: 13 phases, 38 plans, 105 tasks, 64/64 requirements**

See: `milestones/v3.4-ROADMAP.md` for full phase details.

</details>

<details>
<summary>v3.5 Production Ready (Phases 10-11) -- SHIPPED 2026-02-26</summary>

- [x] Phase 10: Docker Build Fix (3/3 plans) -- completed 2026-02-25
- [x] Phase 11: Glass UI Migration (7/7 plans) -- completed 2026-02-26

**Total: 2 phases, 10 plans**

See: `milestones/v3.5-ROADMAP.md` for full phase details.

</details>

<details>
<summary>v0.1 Helena RAG (Phases 12-18) -- SHIPPED 2026-02-27</summary>

- [x] Phase 12: RAG Schema Foundation (1/1 plan) -- completed 2026-02-26
- [x] Phase 13: Hybrid Search + Reranking (3/3 plans) -- completed 2026-02-27
- [x] Phase 14: Gesetze-RAG (3/3 plans) -- completed 2026-02-27
- [x] Phase 15: Normen-Verknuepfung in Akte (3/3 plans) -- completed 2026-02-27
- [x] Phase 16: PII-Filter (3/3 plans) -- completed 2026-02-27
- [x] Phase 17: Urteile-RAG (3/3 plans) -- completed 2026-02-27
- [x] Phase 18: Muster-RAG + Admin Upload UI (3/3 plans) -- completed 2026-02-27

**Total: 7 phases, 19 plans, 16/16 requirements**

See: `milestones/v0.1-ROADMAP.md` for full phase details.

</details>

<details>
<summary>v0.2 Helena Agent (Phases 19-27) -- SHIPPED 2026-02-28</summary>

- [x] Phase 19: Schema Foundation (1/1 plan) -- completed 2026-02-27
- [x] Phase 20: Agent Tools + ReAct Loop (4/4 plans) -- completed 2026-02-27
- [x] Phase 21: @Helena Task-System (2/2 plans) -- completed 2026-02-27
- [x] Phase 22: Deterministic Schriftsatz Orchestrator (2/2 plans) -- completed 2026-02-27
- [x] Phase 23: Draft-Approval Workflow (3/3 plans) -- completed 2026-02-27
- [x] Phase 23.1: Integration Wiring Fixes (3/3 plans) -- completed 2026-02-27
- [x] Phase 24: Scanner + Alerts (2/2 plans) -- completed 2026-02-28
- [x] Phase 25: Helena Memory (1/1 plan) -- completed 2026-02-28
- [x] Phase 26: Activity Feed UI + QA-Gates (3/3 plans) -- completed 2026-02-28
- [x] Phase 27: Activity Feed + QA Pipeline Wiring (2/2 plans) -- completed 2026-02-28

**Total: 10 phases, 23 plans, 53 tasks, 52/53 requirements (SCAN-05 deferred)**

See: `milestones/v0.2-ROADMAP.md` for full phase details.

</details>

### v0.3 Kanzlei-Collaboration (In Progress)

**Milestone Goal:** Interne Kommunikation (Echtzeit-Messaging mit Akten-Bezug), proaktive Rechtsprechungsüberwachung (SCAN-05), und strukturierte Fallaufnahme (Falldatenblaetter mit Community-Template-Workflow).

**Phase Numbering:**
- Integer phases (28, 29, 30, ...): Planned milestone work
- Decimal phases (28.1, 28.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 28: Falldatenblaetter Schema + Templates** - Database-backed template system with community approval workflow and seed migration (completed 2026-02-28)
- [x] **Phase 29: Falldatenblaetter UI** - User-facing form rendering with completeness tracking in Akte detail (completed 2026-02-28)
- [x] **Phase 30: SCAN-05 Neu-Urteil-Check** - Cross-Akte semantic matching of new court decisions with proactive alerts (completed 2026-02-28)
- [x] **Phase 31: Messaging Schema + API** - Channel/thread models, REST API, Socket.IO real-time delivery, @mentions (completed 2026-03-02)
- [ ] **Phase 32: Messaging UI** - Channel list, message view, Akte-thread panel, unread badges, @Helena integration

## Phase Details

### Phase 28: Falldatenblaetter Schema + Templates
**Goal**: Users and admins have a database-backed template system for structured case data collection, replacing the static TypeScript schema registry
**Depends on**: Nothing (first phase of v0.3)
**Requirements**: FD-03, FD-04, FD-05, FD-06, FD-07
**Success Criteria** (what must be TRUE):
  1. User can create a custom Falldatenblatt template with all 7 field types (Text, Datum, Dropdown, Checkbox, Zahl, Textbereich, Mehrfachauswahl)
  2. User can submit a custom template for Admin review and sees it in EINGEREICHT status
  3. Admin can approve or reject submitted templates with the result visible to the submitting user
  4. Approved templates appear as available Standardfaelle for all users when creating or editing Falldatenblaetter
  5. The 10 existing Sachgebiet schemas from TypeScript are present as seed templates in the database (single source of truth)
**Plans**: 4 plans

Plans:
- [x] 28-01-PLAN.md — Prisma schema (enum + model + Akte FK), Zod validation, seed function, worker wiring
- [x] 28-02-PLAN.md — Template CRUD API routes + workflow transitions (einreichen/genehmigen/ablehnen)
- [x] 28-03-PLAN.md — User template list, Gruppen-first builder, admin review queue + detail
- [ ] 28-04-PLAN.md — Gap closure: Admin visibility override in GET /api/falldaten-templates (FD-05 fix)

### Phase 29: Falldatenblaetter UI
**Goal**: Users can view, fill out, and track completeness of Falldatenblaetter directly within an Akte
**Depends on**: Phase 28
**Requirements**: FD-01, FD-02
**Success Criteria** (what must be TRUE):
  1. User can open an Akte and fill out a Falldatenblatt matching the Akte's Sachgebiet, with all field types rendering correctly
  2. User sees a completeness percentage for each Falldatenblatt on an Akte, reflecting how many required fields are filled
  3. Saved Falldatenblatt data persists and is visible when the user returns to the Akte
**Plans**: 2 plans

Plans:
- [ ] 29-01-PLAN.md — API extension (falldatenTemplateId PATCH), FalldatenForm multiselect + required highlights + completeness
- [ ] 29-02-PLAN.md — FalldatenTab wrapper (template resolution, auto-assign, switch) + tab integration with controlled switching + unsaved changes guard

### Phase 30: SCAN-05 Neu-Urteil-Check
**Goal**: The system proactively detects when newly ingested court decisions are relevant to active cases and alerts the responsible user with a Helena-generated briefing
**Depends on**: Phase 29 (Falldaten content enriches Akte summary embeddings)
**Requirements**: SCAN-01, SCAN-02, SCAN-03, SCAN-04, SCAN-05
**Success Criteria** (what must be TRUE):
  1. Each active Akte has a summary embedding generated from its case context (kurzrubrum, sachgebiet, wegen, HelenaMemory, Falldaten)
  2. After RSS-Urteil ingestion completes, new Urteile are matched against active Akten via semantic similarity and relevant matches are detected
  3. User receives a NEUES_URTEIL alert in the existing Alert-Center when a relevant Urteil is found for one of their Akten
  4. Admin can configure the relevance threshold via SystemSetting in the admin panel
  5. Each NEUES_URTEIL alert includes a Helena-generated briefing explaining why the Urteil is relevant to the specific Akte
**Plans**: 2 plans

Plans:
- [ ] 30-01-PLAN.md — Prisma schema migration (summaryEmbedding vector column + HNSW index), SystemSettings (threshold + toggle), Akte summary text assembler, nightly embedding refresh cron
- [ ] 30-02-PLAN.md — Cross-matching engine (pgvector cosine similarity + Sachgebiet pre-filter), LLM briefing generation, NEUES_URTEIL alert creation, worker trigger, Alert-Center UI config, admin threshold slider

### Phase 31: Messaging Schema + API
**Goal**: The backend supports persistent channels, Akte-bound threads, real-time message delivery, and @mention notifications
**Depends on**: Nothing (independent of Falldatenblaetter/SCAN-05; parallel Prisma migration sequenced after Phase 30)
**Requirements**: MSG-01, MSG-02, MSG-03, MSG-04, MSG-05
**Success Criteria** (what must be TRUE):
  1. User can create a channel with name and optional description via API, and the channel persists in the database
  2. User can join and leave channels, with membership reflected immediately
  3. User can send a message to a channel and other members receive it in real-time via Socket.IO
  4. User can post messages in an Akte-bound thread that inherits the Akte's RBAC (only users with Akte access can read/write)
  5. User can @mention another user in a message, and the mentioned user receives an in-app notification
**Plans**: 3 plans

Plans:
- [ ] 31-01-PLAN.md — Prisma schema (Channel, ChannelMember, Message, MessageReaction), NotificationType, Socket.IO rooms, messaging service layer, seed channels, worker wiring
- [ ] 31-02-PLAN.md — Channel CRUD API routes, membership join/leave, AKTE channel lazy creation with RBAC, read-marking
- [ ] 31-03-PLAN.md — Message send/list/edit/delete API routes, emoji reactions, @mention notifications, @Helena channel response posting

### Phase 32: Messaging UI
**Goal**: Users have a complete messaging interface with channel navigation, unread tracking, typing indicators, and Helena integration
**Depends on**: Phase 31
**Requirements**: MSG-06, MSG-07, MSG-08
**Success Criteria** (what must be TRUE):
  1. User sees unread message count badges per channel in the messaging sidebar, updating in real-time as new messages arrive
  2. User can @Helena in a channel message and a HelenaTask is created and processed, with Helena's response appearing in the channel
  3. User sees a typing indicator when another user is composing a message in the same channel
**Plans**: TBD

Plans:
- [ ] 32-01: TBD
- [ ] 32-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 28 -> 28.1 -> 29 -> 30 -> 31 -> 32

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-9 | v3.4 | 38/38 | Complete | 2026-02-25 |
| 10-11 | v3.5 | 10/10 | Complete | 2026-02-26 |
| 12-18 | v0.1 | 19/19 | Complete | 2026-02-27 |
| 19-27 | v0.2 | 23/23 | Complete | 2026-02-28 |
| 28. Falldatenblaetter Schema + Templates | 4/4 | Complete    | 2026-02-28 | - |
| 29. Falldatenblaetter UI | 2/2 | Complete    | 2026-02-28 | - |
| 30. SCAN-05 Neu-Urteil-Check | 2/2 | Complete    | 2026-02-28 | - |
| 31. Messaging Schema + API | 3/3 | Complete    | 2026-03-02 | - |
| 32. Messaging UI | v0.3 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-24*
*Last updated: 2026-02-28 after Phase 30 planning*
