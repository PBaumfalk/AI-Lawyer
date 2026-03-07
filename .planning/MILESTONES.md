# Milestones

## v0.8 Intelligence & Tools (Shipped: 2026-03-07)

**Delivered:** BI-Dashboard mit KPI-Kacheln, Trend-Charts und Filtern plus CSV/XLSX/PDF-Export fuer alle Datenbereiche, PDF-Tools (Merge/Split/Rotate/Compress/Watermark/Redact) via Stirling-PDF, Helena Intelligence mit Falldaten-Auto-Fill, Fallzusammenfassung, globalem aktenuebergreifendem KI-Chat und Template-Vorschlaegen sowie bidirektionalem CalDAV-Sync mit Google und Apple Calendar.

**Phases:** 4 (55-58)
**Plans:** 12 completed
**Commits:** 42
**Files changed:** 89 (+13,873 / -160)
**Timeline:** 2026-03-06 -> 2026-03-07 (1 day)
**Requirements:** 39/39 satisfied

**Key accomplishments:**
1. BI-Dashboard with KPI tiles (Akten, Finanzen, Fristen, Helena) with month-over-month deltas, Recharts trend charts, and Zeitraum/Anwalt/Sachgebiet filters -- Redis-cached aggregation queries (5min TTL)
2. Generic CSV/XLSX export library (ExcelJS streaming WorkbookWriter) with export endpoints for Akten, Kontakte, Finanzdaten plus BI-Dashboard PDF/XLSX report export with Kanzlei-Briefkopf
3. PDF-Tools via Stirling-PDF REST API: merge, split, rotate, compress, watermark (ENTWURF/Logo), and DSGVO PII auto-redact -- tabbed dialog UI with drag-and-drop page thumbnails
4. Helena Falldaten Auto-Fill: AI extraction from Akte documents with per-field confidence (HOCH/MITTEL/NIEDRIG), source excerpts, and individual accept/reject -- never auto-saved (BRAK 2025)
5. Fallzusammenfassung as timeline + key facts panel in Akte detail, plus global KI-Chat at /ki for cross-Akte RAG queries and template suggestions at Akte creation
6. Bidirectional CalDAV sync: Google OAuth2 + Apple app-password, Fristen as read-only export, Termine bidirectional (create/update/delete), BullMQ 15min cron + manual sync, ETag/CTag incremental tracking, external events in Tagesuebersicht

**Tech debt (non-blocking):**
- Prisma v5->v7 upgrade still deferred
- tsdav added as new dependency (first new npm package since v0.2)
- Virtual EXTERN typ in API response (no Prisma enum change for CalDAV events)

**Archives:**
- `milestones/v0.8-ROADMAP.md`
- `milestones/v0.8-REQUIREMENTS.md`

---

## v0.6.1 Adhoc Bugfixes (Shipped: 2026-03-06)

**Delivered:** Structured triage of 18 accumulated bugs from 6 debug files + Phase 51 deferred items — 5 pre-fixed confirmed, 7 P0/P1 queued for Wave 1, 3 P2 for Wave 2, 3 P3 explicitly deferred with written rationale (Prisma v7 upgrade, silent catches, img-tags).

**Phases:** 1 (Phase 52)
**Plans:** 1 completed
**Tasks:** 3 executed
**Timeline:** 2026-03-06 (1 day)
**Requirements:** No formal REQ-IDs (ad-hoc bugfix milestone — scope defined by bug backlog)

**Key accomplishments:**
1. Aggregated 18 bugs from 6 debug files and Phase 51 deferred items into a normalized triage list with severity, area, wave, repro notes, and source references
2. Classified each bug: 5 pre-fixed (BUG-01 to BUG-05), 7 P0/P1 for Wave 1 (52-02), 3 P2 for Wave 2 (52-03), 3 P3 explicitly deferred
3. Defined Phase 52 scope boundary — Wave 1 restricted to existing-file corrections only, no architectural changes
4. Explicitly deferred Prisma v5→v7 major upgrade with written rationale (breaking changes, needs own sprint)
5. Created CONTEXT.md with P0/P1/P2/P3 decision criteria and scope guard for fix wave execution

**Archives:**
- `milestones/v0.6.1-ROADMAP.md`

---

## v0.6 Stabilisierung (Shipped: 2026-03-04)

**Delivered:** Zero TypeScript errors, consistent env vars, error boundaries on all route groups, passing test suite, and build-time error checking enabled — stabilizing the codebase after 7 feature milestones by fixing all P0/P1/P2 issues from the systematic health audit.

**Phases:** 1 (Phase 51)
**Plans:** 4 completed
**Tasks:** 8 executed
**Lines of Code:** ~141k LOC TypeScript (+3,894 / -1,393 net in v0.6)
**Commits:** 20
**Git range:** `e4672f1` → `0426de2`
**Timeline:** 2026-03-04 (1 day)
**Requirements:** No formal REQ-IDs (stabilization milestone — scope defined by health audit)

**Key accomplishments:**
1. Fixed React hooks violations, TypeScript type mismatches, non-route API exports, and Stirling PDF health check port
2. Standardized OLLAMA_URL env var across entire codebase (4 files unified)
3. Removed 8 invalid ESLint disable comments, fixed compose-popup auto-save stale closure
4. Glass-styled error boundaries for root/dashboard/portal with German recovery UI + custom 404 page
5. Added npm test scripts, fixed create_draft_dokument test mock, enabled build-time TypeScript error checking (ignoreBuildErrors: false)

**Tech debt (deferred to future milestones):**
- Prisma 5.22 → 7.x major upgrade needed
- Next.js 14.2.35 has 5 high-severity CVEs (Next.js 15 upgrade needed)
- 317 ESLint unused-vars warnings across 80+ files
- ~67 API routes without explicit try-catch
- ~80 silent .catch(() => {}) blocks
- compose-popup needs proper draft API (auto-save removed entirely)
- 12 Falldaten UAT tests pending

**Archives:**
- `milestones/v0.6-ROADMAP.md`
- `milestones/v0.6-MILESTONE-AUDIT.md`

---

## v0.5 Mandantenportal (Shipped: 2026-03-03)

**Delivered:** Mandanten erhalten ein eigenes Portal zum Einsehen ihres Aktenstatus, freigegebener Dokumente und zur sicheren Kommunikation mit dem Anwalt — komplett mit Einladungslink-Auth, DSGVO-konformer Datentrennung, granularer Dokument-Freigabe, sicherem Messaging mit Dateianhang und transaktionalen E-Mail-Benachrichtigungen.

**Phases:** 8 (43-50, incl. 2 gap closure phases)
**Plans:** 14 completed
**Lines of Code:** ~141k LOC TypeScript (+10.8k net in v0.5)
**Commits:** 60
**Git range:** `feat(43-01)` → `feat(50-01)`
**Timeline:** 2026-03-03 (1 day)
**Requirements:** 25/25 satisfied

**Key accomplishments:**
1. Portal Infrastructure — MANDANT role in UserRole enum, /portal/* route group with Glass UI layout, auth-guarded middleware, Kanzlei-branded sidebar/header
2. Invite-based Auth — PortalInvite model with secure tokens, account activation, JWT session with 30min auto-logout + 5min warning, password reset flow, anti-enumeration (always 200)
3. DSGVO-compliant Data Room — Server-side isolation via Kontakt→Beteiligter chain, multi-Akte selection, simplified timeline (mandantSichtbar flag), naechste Schritte text, 404 on unauthorized access
4. Granular Document Sharing — Per-document mandantSichtbar toggle, presigned MinIO download URLs, Mandant upload to dedicated folder (50MB limit, skip OCR/RAG), Anwalt notification on upload
5. Secure Portal Messaging — PORTAL ChannelTyp with lazy creation, Mandant-Anwalt messaging, file attachments (5 files, 25MB each), 10s polling, @mention stripping
6. Transactional Email Notifications — BullMQ portal-notification queue, 3 event types (neue-nachricht, neues-dokument, sachstand-update), date-based deduplication, DSGVO einwilligungEmail gate, 3 retries

**Tech debt (non-blocking):**
- console.error in naechste-schritte/route.ts instead of structured logger
- Email deep links redirect to /portal/dashboard after login (no post-login redirect callback)
- 7 pre-existing TypeScript errors in falldaten-tab.tsx and helena/index.ts (not from v0.5)

**Archives:**
- `milestones/v0.5-ROADMAP.md`
- `milestones/v0.5-REQUIREMENTS.md`
- `milestones/v0.5-MILESTONE-AUDIT.md`

---

## v0.4 Quest & Polish (Shipped: 2026-03-03)

**Delivered:** Gamification als Kanzlei-Steuerungsinstrument — vollständiges Quest-System mit XP/Level/Runen/Streak, Team-Bossfight gegen Backlog-Monster, Item-Shop mit 18 Items in 4 Seltenheitsstufen, Heldenkarte mit Badge-Schaukasten, Anti-Missbrauch-Guards und Team-Dashboard mit Monatsreporting. Dazu UX-Quick-Wins: klickbare KPI-Cards, OCR-Recovery-Flow und Empty States.

**Phases:** 10 (33-42)
**Plans:** 21 completed
**Lines of Code:** ~135k LOC TypeScript (+26.1k net in v0.4)
**Commits:** 108
**Git range:** `feat(33-01)` → `feat(42-01)`
**Timeline:** 2026-03-02 → 2026-03-03 (2 days)
**Requirements:** 41/41 satisfied

**Key accomplishments:**
1. Gamification Engine — UserGameProfile, Quest DSL evaluator against Prisma data, XP/Level/Runen/Streak system, BullMQ async processing, daily reset + nightly safety-net crons, DSGVO-compliant (opt-in, self-only visibility)
2. Bossfight — Team Backlog-Monster with dynamic HP from open Wiedervorlagen, 4-phase progression with escalating Runen rewards, Socket.IO real-time HP bar + damage feed + canvas-confetti celebration, admin activation threshold
3. Quest Depth — Class-specific daily quests per RBAC role, weekly delta quests (WeeklySnapshot baselines), time-limited Special Quest campaigns with admin CRUD, QuestWidget with grouped sections and deep-links to filtered views
4. Anti-Missbrauch — Qualified WV completion (30+ char Vermerk), Redis daily Runen cap (40/day), 2% random audits with Sonner action toast, atomic Prisma $transaction, P2002 idempotent dedup
5. Item-Shop + Heldenkarte — 18-item catalog (Common/Rare/Epic/Legendary), atomic Runen purchase, cosmetic equip/unequip, comfort perks (streak-schutz, doppel-runen, fokus-siegel), badge showcase (8 achievement badges), quest history
6. Team-Dashboard + Reporting — Admin KPIs (quest fulfillment rate, backlog delta trend with Recharts, bossfight damage aggregates), monthly PDF/CSV export with Kanzlei Briefkopf
7. Quick Wins — Clickable KPI cards with tab navigation, OCR recovery banner (retry + Vision-Analyse + manual text), empty states in 4 tabs, Chat rename, Zeiterfassung inline editing

**Tech debt (non-blocking):**
- Record<string, any> in quest-evaluator.ts (eslint-suppressed, necessary for Prisma dynamic where)
- Fire-and-forget .catch(() => {}) patterns in audit-listener and quest-service (intentional)
- Doppel-runen 2h window edge case with nightly safety net (product-level, not code defect)
- Pre-existing TS errors in falldaten-tab.tsx and helena/index.ts (not from v0.4)

**Archives:**
- `milestones/v0.4-ROADMAP.md`
- `milestones/v0.4-REQUIREMENTS.md`
- `milestones/v0.4-MILESTONE-AUDIT.md`

---

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

