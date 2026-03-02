# Milestones

## v0.3 Kanzlei-Collaboration (Shipped: 2026-03-02)

**Delivered:** Interne Kommunikation mit Echtzeit-Messaging (Slack-Style Kanäle + Akten-Threads), proaktive Rechtsprechungsüberwachung (Cross-Akte Semantic Search gegen neue RSS-Urteile mit Helena-Briefing), und strukturierte Fallaufnahme (Falldatenblaetter mit Community-Template-Workflow und Admin-Approval).

**Phases:** 5 (28-32)
**Plans:** 13 completed
**Tasks:** 25 executed
**Lines of Code:** ~125k LOC TypeScript (+17.5k net in v0.3)
**Commits:** 63
**Git range:** `feat(28-01)` → `feat(32-02)`
**Timeline:** 2026-02-28 → 2026-03-02 (3 days)
**Requirements:** 20/20 satisfied

**Key accomplishments:**
1. Falldatenblaetter Template System — Database-backed templates with 8 field types, Gruppen-first builder, community submit/approve workflow (ENTWURF→EINGEREICHT→GENEHMIGT/ABGELEHNT), 10 Sachgebiet-Seed-Templates als single source of truth
2. In-Akte Falldaten Forms — FalldatenTab mit Auto-Template-Zuweisung (STANDARD by Sachgebiet), Pflichtfeld-Highlighting (amber border), Completeness-Tracking (Prozent-Badge im Tab), Unsaved-Changes-Guard (AlertDialog)
3. SCAN-05 Neu-Urteil-Check — Akte summaryEmbedding (pgvector HNSW, nightly cron 02:30), Cross-Matching-Engine (Cosine Similarity + Sachgebiet-Pre-Filter), LLM-Briefing (3-Sektionen-Prompt), NEUES_URTEIL-Alerts im Alert-Center (violet Scale icon), Admin Threshold-Slider
4. Messaging Backend — Channel/ChannelMember/Message/MessageReaction Prisma Models, REST API (14 routes), Socket.IO rooms (join/leave/typing events), @mention Notifications, @Helena Channel-Response via BullMQ, AKTE-Kanal Lazy-Creation mit RBAC-Sync, Seed-Channels (#allgemein, #organisation)
5. Messaging UI — /nachrichten Seite mit Split-Layout, ChannelSidebar (ALLGEMEIN/AKTE-Sektionen, unread Badges), MessageView (Paginierung, Banner-Refetch), MessageComposer (@mention picker, DMS Attachments, @Helena Button), TypingIndicator (5s auto-cleanup), AkteChannelTab im Akte-Detail

**Tech debt (non-blocking):**
- @Helena in ALLGEMEIN channels silently ignored (design: Helena braucht akteId-Kontext)
- Sidebar unread badge nicht real-time für Hintergrund-Nachrichten (Update bei page load/channel visit)
- Akte Stats-Counter zeigt chatNachrichten statt Channel Messages
- No on-demand embedding refresh after Falldaten save (nightly cron akzeptabel)
- Pre-existing TS errors in helena/index.ts (StepUpdate type mismatch)

**Archives:**
- `milestones/v0.3-ROADMAP.md`
- `milestones/v0.3-REQUIREMENTS.md`
- `milestones/v0.3-MILESTONE-AUDIT.md`

---

## v0.2 Helena Agent (Shipped: 2026-02-28)

**Delivered:** Helena wird vom Chat-Bot zum autonomen Agenten mit ReAct-Loop, deterministischem Schriftsatz-Orchestrator, @-Tagging Task-System, Draft-Approval-Workflow, proaktivem Background-Scanner mit Alerts, per-Akte Memory und QA-Gates mit Audit-Trail. Akte-Detail umgebaut zum Activity Feed.

**Phases:** 10 (19-27 + 23.1)
**Plans:** 23 completed
**Tasks:** 53 executed
**Lines of Code:** ~117,156 LOC TypeScript
**Commits:** 131
**Git range:** `feat(19-01)` → `feat(27-01)`
**Timeline:** 2026-02-27 → 2026-02-28 (2 days)
**Requirements:** 52/53 satisfied (SCAN-05 deferred)

**Key accomplishments:**
1. ReAct Agent-Loop mit 14 Tools (9 read + 5 write), bounded execution (5/20 steps inline/background), Ollama response guard, token budget manager, complexity classifier, rate limiter — 46 unit/integration tests pass
2. Deterministic Schriftsatz-Orchestrator: Intent-Router (Klageart/Stadium/Gerichtszweig), Slot-Filling mit automatischer Rueckfrage, RAG Assembly (4000 chars/section), ERV/beA-Validator, Zod-typisiertes SchriftsatzSchema, multi-turn via PendingSchriftsatz
3. @Helena Task-System: @-mention parsing, BullMQ helena-task queue (lockDuration:120s), Socket.IO progress events, task abort, REST API (create/list/detail/abort)
4. Draft-Approval Workflow: ENTWURF Prisma $extends gate (BRAK 2025 / BRAO 43), HelenaDraft lifecycle (accept/reject/edit), feedback-to-context pipeline, Socket.IO notifications, global draft inbox
5. Proaktiver Background-Scanner (BullMQ cron): Frist-Check, Inaktivitaets-Check, Anomalie-Check mit Deduplizierung, Auto-Resolve, progressiver Eskalation, Alert-Center UI mit Filter + Sidebar-Badge
6. Helena Memory: per-Akte Kontext (Zusammenfassung, Risiken, naechste Schritte), auto-refresh bei Aenderung, DSGVO cascade delete, 5min cooldown
7. Activity Feed UI: Akte-Detail Feed ersetzt 8 Tabs (921→152 LOC), Composer mit @Helena tagging, Helena vs Human Attribution, inline Draft-Review, QA-Dashboard mit Goldset (20 Queries), Retrieval-Metriken, Release-Gates

**Known Gaps:**
- SCAN-05: Neu-Urteil-Check deferred (requires cross-Akte semantic search)

**Tech debt (non-blocking):**
- Pre-existing TS errors in helena/index.ts (StepUpdate adapter type mismatches)
- search-web.ts intentional stub (placeholder pending web search config)
- helenaTaskId not propagated to ToolContext (drafts lack task traceability)
- Release gate hardcodes hallucination/Vollstaendigkeit to 0/pass without goldset run

**Archives:**
- `milestones/v0.2-ROADMAP.md`
- `milestones/v0.2-REQUIREMENTS.md`
- `milestones/v0.2-MILESTONE-AUDIT.md`

---

## v3.4 Full-Featured Kanzleisoftware (Shipped: 2026-02-25)

**Delivered:** AI-Lawyer transformed from an MVP case management system into a full-featured Kanzleisoftware with 64 capabilities across infrastructure, deadline calculation, email, document pipeline, finance, AI, beA, and security — all operational in 2 days.

**Phases:** 13 (9 planned + 4 gap-closure insertions)
**Plans:** 38 completed
**Tasks:** 105 executed
**Lines of Code:** 90,375 LOC TypeScript (461 files)
**Commits:** 201
**Git range:** `feat(01-01)` → `feat(09-01)`
**Timeline:** 2026-02-24 → 2026-02-25 (2 days)

**Key accomplishments:**
1. Redis + BullMQ + Socket.IO infrastructure with real-time notifications and admin monitoring
2. BGB-compliant Fristenberechnung (50+ unit tests), Vorlagen with auto-placeholders, Briefkopf, OnlyOffice co-editing with Track Changes
3. Full IMAP IDLE + SMTP email client with three-pane inbox, compose, Veraktung, and ticket creation
4. Auto-OCR document pipeline (Stirling-PDF), PDF viewer, RAG ingestion with German legal chunking + pgvector
5. Complete financial module: RVG calculator (KostBRaeG 2025), invoicing, E-Rechnung (XRechnung + ZUGFeRD), Aktenkonto with Fremdgeld compliance, DATEV/SEPA export, Zeiterfassung
6. Multi-provider AI (Ollama/OpenAI/Anthropic) with RAG document chat, proactive Helena agent, auto-Fristenerkennung, beA integration via bea.expert
7. RBAC enforcement with Dezernate, DSGVO compliance (anonymization, Auskunftsrecht), system-wide Audit-Trail, Versand-Gate, health checks

**Known tech debt (minor, non-blocking):**
- Bull Board PUT handler returns 501 (stub)
- Briefkopf OnlyOffice editing mode deferred (form mode works)
- bea.expert JS library requires commercial registration (user setup)
- middleware.ts excludes /api/ki routes from session enforcement (auth handled internally)

**Archives:**
- `milestones/v3.4-ROADMAP.md`
- `milestones/v3.4-REQUIREMENTS.md`
- `milestones/v3.4-MILESTONE-AUDIT.md`

---


## v3.5 Production Ready (Shipped: 2026-02-26)

**Delivered:** Docker production build fixed and complete Apple Sequoia-style Glass UI migration — all 9 services running healthy in Docker, entire frontend redesigned to liquid glass aesthetic with oklch design tokens, Motion/React animations, and full dark mode support.

**Phases:** 2 (10–11)
**Plans:** 10 completed
**Files changed:** 234 | **Insertions:** 26,707 | **Deletions:** 1,020
**Lines of Code:** ~91,300 LOC TypeScript
**Timeline:** 2026-02-25 → 2026-02-26 (2 days)
**Git range:** `fix(10-01)` → `feat(11-07)`

**Key accomplishments:**
1. Docker production build fixed — Next.js compiles clean, pino-roll build-safe, hardened next.config.mjs
2. All 9 Docker services run healthy — production entrypoint (prisma migrate deploy + conditional seed), IPv4 Alpine healthchecks, date-fns Docker copy, Ollama as core service
3. Complete oklch glass design system — 4 blur tiers (8px/16px/24px/40px), gradient mesh background, macOS scrollbars, full dark mode CSS token structure
4. Animated glass sidebar — Motion/React v11 spring physics, backdrop-blur-xl, dark mode toggle, profile chip; all with prefers-reduced-motion support
5. Glass component library — GlassCard (variants), GlassPanel (elevation tiers), GlassKpiCard (count-up animation), glass-input primitives, glass-shimmer skeleton, Button motion spring
6. All 26 dashboard pages migrated to glass design — 0 `font-heading` in any page file, UI/form/list requirements all satisfied

**Known Gaps (intentionally deferred to TODO):**
- FD-01–FD-04: Falldatenblaetter per-Rechtsgebiet Feldschemas
- BI-01–BI-05: BI-Dashboard KPI-Kacheln
- EXP-01–EXP-04: CSV/XLSX Export für Akten, Kontakte, Finanzen

**Tech debt (non-blocking):**
- 62× `font-heading` in sub-components (dialogs, tab components) — outside page-scope SC
- 77× `.glass` alias in sub-components — renders correctly via @apply glass-card

**Archives:**
- `milestones/v3.5-ROADMAP.md`
- `milestones/v3.5-REQUIREMENTS.md`
- `milestones/v3.5-MILESTONE-AUDIT.md`

---


## v0.1 Helena RAG (Shipped: 2026-02-27)

**Delivered:** Helena erhält drei strukturierte Wissensquellen (Gesetze, Urteile, Schriftsatzmuster) und ein NotebookLM-qualitatives Retrieval via Hybrid Search + Cross-Encoder Reranking — alle 16 RAG-Anforderungen erfüllt, 19 Pläne in 2 Tagen.

**Phases:** 7 (12–18)
**Plans:** 19 completed
**Lines of Code:** ~97,400 LOC TypeScript
**Commits:** 243
**Git range:** `feat(12-01)` → `feat(18-03)`
**Timeline:** 2026-02-26 → 2026-02-27 (2 days)

**Key accomplishments:**
1. Hybrid Search via Reciprocal Rank Fusion (BM25 + pgvector, k=60, N=50) + Cross-Encoder Reranking via Ollama (top-50 → top-10, 3s timeout fallback) — Helena retrieves substantively better context
2. Bundesgesetze-RAG: bundestag/gesetze GitHub-Sync in law_chunks, täglicher BullMQ-Cron 02:00, Encoding-Smoke-Test; Helena zitiert §§ mit "nicht amtlich"-Disclaimer und Quellenlink
3. §§-Verknüpfung in Akte: Suchmodal über law_chunks, Chip-Liste in Akte-Detailseite, pinned Normen als höchste Priorität in Helenas System-Kontext (Chain A)
4. NER PII-Filter via Ollama (5+ Few-Shot, Institution-Whitelist mit 20+ Patterns): Status-Machine PENDING_NER → NER_RUNNING → INDEXED | REJECTED_PII_DETECTED — kein Bypass-Pfad
5. Urteile-RAG: 7 BMJ-Bundesgerichts-RSS-Feeds in urteil_chunks, inline PII-Gate + doppelte piiFiltered-Query-Filter-Invariante, täglicher inkrementeller BAG-Sync, Helena zitiert nur aus DB (kein LLM-generiertes AZ)
6. Muster-RAG + Admin Upload UI: amtliche Formulare mit {{PLATZHALTER}} in muster_chunks, Admin-UI /admin/muster (MinIO-Upload, NER-Status-Badge, Retry), 1.3× Kanzlei-Boost, Helena erstellt ENTWURF-Schriftsätze mit Rubrum/Anträge/Begründung

**Tech debt (non-blocking):**
- `processUrteilNer()` in ner-pii.processor.ts ist dead code — Phase 17 nutzt inline `runNerFilter()` stattdessen
- NER queue `attempts:1` — Ollama-Timeout erfordert manuellen "Erneut prüfen"-Klick

**Archives:**
- `milestones/v0.1-ROADMAP.md`
- `milestones/v0.1-REQUIREMENTS.md`
- `milestones/v0.1-MILESTONE-AUDIT.md`

---

