# Roadmap: AI-Lawyer Milestone 2

## Overview

Milestone 2 transforms AI-Lawyer from an MVP case management system into a full-featured Kanzleisoftware with 64 new capabilities across 7 phases. The roadmap follows a strict dependency order: infrastructure foundation first (Redis, Worker, WebSocket), then high-impact daily-use features (deadlines, templates, email), then the document pipeline and financial module (both legally mandated), then AI differentiation (RAG, proactive agent, beA), and finally security/compliance hardening. Every phase delivers a coherent, verifiable capability. Legal-risk features (deadline calculation, RVG, Fremdgeld, E-Rechnung) are prioritized and require near-100% test coverage regardless of the general 20% test effort rule.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure Foundation** - Redis, BullMQ worker process, custom server.ts with Socket.IO, graceful shutdown
- [x] **Phase 2: Deadline Calculation + Document Templates** - BGB Fristenberechnung, Feiertagskalender, Vorfristen, Vorlagen, Briefkopf, PDF-Export, WOPI rebuild (completed 2026-02-24)
- [x] **Phase 2.1: Wire Frist-Reminder Pipeline + Settings Init** - Register frist-reminder processor in worker.ts, consolidate queue registry, schedule cron job, call initializeDefaults() (INSERTED -- gap closure, completed 2026-02-24)
- [ ] **Phase 2.2: Fix API Routes + UI Paths** - Create /api/ordner-schemata/[id] route, fix favorit toggle URL, fix build failure (INSERTED — gap closure)
- [x] **Phase 3: Email Client** - IMAP IDLE worker, SMTP send, Inbox UI, Veraktung, Compose, Ticket-from-Email (completed 2026-02-24)
- [ ] **Phase 3.1: Wire Email Real-Time + Compose Integration** - Socket.IO mailbox room wiring, email-signature API, ComposeManager provider (INSERTED — gap closure)
- [x] **Phase 4: Document Pipeline (OCR + RAG Ingestion)** - Stirling-PDF, auto-OCR, PDF preview, document detail page, chunking, embedding, pgvector storage (completed 2026-02-24)
- [ ] **Phase 4.1: Wire Akte Real-Time + Email Compose + Admin Pipeline** - Socket.IO akte room join, Neue E-Mail button, admin pipeline dashboard (INSERTED — gap closure)
- [ ] **Phase 5: Financial Module** - RVG calculation, invoicing, Aktenkonto, Fremdgeld compliance, E-Rechnung, DATEV, SEPA, banking import, Zeiterfassung
- [ ] **Phase 6: AI Features + beA** - Multi-provider AI, RAG retrieval, document chat, proactive agent, deadline recognition, beA integration via bea.expert
- [ ] **Phase 7: Rollen/Sicherheit + Compliance + Observability** - RBAC enforcement, Audit-Trail UI, DSGVO compliance, health checks, structured logs

## Phase Details

### Phase 1: Infrastructure Foundation
**Goal**: All background job processing infrastructure is operational -- Redis coordinates job queues and real-time pub/sub, the BullMQ worker process handles long-running tasks, and Socket.IO enables real-time browser notifications, all running within a single Docker Compose deployment.
**Depends on**: Nothing (first phase)
**Requirements**: REQ-IF-001, REQ-IF-002, REQ-IF-003, REQ-IF-005
**Research flag**: Standard patterns -- skip phase research. BullMQ + Redis + custom server.ts is well-documented.
**Success Criteria** (what must be TRUE):
  1. Redis container is running in Docker Compose and the app + worker both connect to it successfully
  2. A test BullMQ job enqueued from a Next.js API route is picked up and processed by the worker within 5 seconds
  3. Socket.IO WebSocket connections from the browser successfully establish through the custom server.ts on port 3000
  4. Worker process shuts down gracefully (in-flight jobs complete, no data loss) when receiving SIGTERM
  5. Admin can view job queue status (pending/active/completed/failed counts) via an API endpoint or dashboard page
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Redis + BullMQ + worker.ts + esbuild bundling + Docker Compose + health endpoint + logging
- [ ] 01-02-PLAN.md — Custom server.ts with Socket.IO + notification system (bell, center, toasts, catch-up)
- [ ] 01-03-PLAN.md — Admin pages (Bull Board job monitor, system health + log viewer, runtime settings)

### Phase 2: Deadline Calculation + Document Templates
**Goal**: Attorneys can calculate legally correct deadlines with automatic weekend/holiday extension per BGB Sections 187-193, receive configurable pre-deadline reminders with deputy/vacation coverage, and create documents from templates with auto-filled placeholders and firm letterhead, exportable as PDF. Includes stable OnlyOffice co-editing with Track Changes and document status workflow.
**Depends on**: Phase 1 (worker for future reminder notifications)
**Requirements**: REQ-FK-001, REQ-FK-002, REQ-FK-003, REQ-FK-004, REQ-FK-005, REQ-DV-001, REQ-DV-002, REQ-DV-003, REQ-DV-008, REQ-DV-009, REQ-DV-010, REQ-DV-011
**Research flag**: Standard patterns for templates; deadline calculation requires verification against LTO Fristenrechner and DAV test cases. WOPI rebuild needs careful implementation research (OnlyOffice lock management, PutFile callbacks).
**Success Criteria** (what must be TRUE):
  1. FristenRechner correctly calculates end dates for Ereignisfristen and Beginnfristen including month-end overflow (Jan 31 + 1 month = Feb 28), weekend/holiday extension per Section 193 BGB, and Bundesland-specific holidays (NRW default) -- verified by >50 passing unit tests
  2. User can configure Vorfristen (7/3/1 day default) and receives reminders for upcoming deadlines with 5-level priority (Sehr niedrig through Dringend)
  3. User can create a document from a template with placeholders (mandant.name, akte.aktenzeichen, gegner.name etc.) auto-filled from case data, with firm letterhead applied
  4. User can manage the Briefkopf (logo + firm data) in OnlyOffice and it is automatically applied to all outgoing documents and PDF exports
  5. WOPI protocol handles Laden/Speichern reliably including sessions >1 hour, with Track Changes, Comments, and multi-user collaboration working
  6. Vertretung & Urlaub system routes deadline notifications to deputy when user is on vacation
**Plans**: 6 plans

Plans:
- [ ] 02-01-PLAN.md — FristenRechner TDD: pure-function library (BGB 187-193, feiertagejs, Vorfristen, Halbfrist) with >50 unit tests
- [ ] 02-02-PLAN.md — Calendar enhancements: schema, Fristen API (incl. Sonderfaelle + Fristenzettel PDF), FristenRechner UI (sidebar sheet + Tagesuebersicht + Warn-Ampel), reminder worker, Auto-WV + Keine-Akte-ohne-Frist validation
- [ ] 02-03-PLAN.md — OnlyOffice Callback rebuild: stable document.key, co-editing, Track Changes, Comments, versioning, DOCX-to-PDF conversion API, Dokument-Status-Workflow (Entwurf -> Freigegeben -> Versendet with Schreibschutz)
- [ ] 02-04-PLAN.md — Vorlagen-System backend: schema (versioning, Freigabe, custom fields), template engine (conditionals, loops), Briefkopf library, generation endpoint, Briefkopf CRUD, Ordner-Schemata API
- [ ] 02-05-PLAN.md — Vorlagen-System UI: card browser, 4-step wizard, placeholder sidebar, Briefkopf editor, PDF export dialog, Kanzlei-Einstellungen tabs (Fristen, Vorlagen, Briefkopf, Ordner-Schemata, Benachrichtigungen) with audit-trail + reset
- [ ] 02-06-PLAN.md — Vertretung & Urlaub: User model enhancements, Vertretungs-Modus, vacation management, reminder worker integration, settings Import/Export JSON, Onboarding-Wizard

### Phase 2.1: Wire Frist-Reminder Pipeline + Settings Init
**Goal**: The frist-reminder worker processor is live at runtime — pre-deadline reminders (7/3/1 day) are scheduled via cron, processed by the BullMQ worker, and delivered as notifications. The dual queue registry is consolidated so the frist-reminder queue is visible in admin monitoring. SystemSettings defaults are initialized at startup for fresh installs.
**Depends on**: Phase 1 (worker infrastructure), Phase 2 (frist-reminder processor code)
**Requirements**: REQ-FK-003
**Gap Closure**: Closes gaps from v3.4 audit — REQ-FK-003 unsatisfied, frist-reminder integration, Vorfrist Reminder flow
**Research flag**: No research needed — wiring existing code, all pieces already built.
**Success Criteria** (what must be TRUE):
  1. `processFristReminders()` is imported and registered as a BullMQ Worker in `src/worker.ts` for the `frist-reminder` queue
  2. `registerFristReminderJob()` is called at worker startup, scheduling the repeatable cron job
  3. The frist-reminder queue appears in `ALL_QUEUES` and is visible in the admin Bull Board monitor
  4. `initializeDefaults()` is called at app/worker startup so fresh installs have default settings
  5. E2E flow: a Frist with Vorfrist 7 days out triggers a reminder notification when the cron runs
**Plans**: 1 plan

Plans:
- [x] 02.1-01-PLAN.md — Consolidate queue registry, add email transport, enhance frist-reminder processor (deduplication, dual-channel, weekend shift, catch-up), register in worker.ts with startup init

### Phase 2.2: Fix API Routes + UI Paths
**Goal**: Ordner-Schemata can be updated and deleted from the admin UI, and template favoriting works from the Vorlagen overview — both currently returning 404 due to missing/wrong API routes.
**Depends on**: Phase 2 (existing Ordner-Schemata and Vorlagen code)
**Requirements**: REQ-DV-008, REQ-DV-009
**Gap Closure**: Closes gaps from v3.4 audit — REQ-DV-008 partial, REQ-DV-009 partial, OrdnerSchema/Favorit flows
**Research flag**: No research needed — straightforward API route creation and URL fix.
**Success Criteria** (what must be TRUE):
  1. `PATCH /api/ordner-schemata/${id}` updates an Ordner-Schema and returns 200
  2. `DELETE /api/ordner-schemata/${id}` deletes an Ordner-Schema and returns 204
  3. Favorit toggle in `vorlagen-uebersicht.tsx` calls the correct endpoint (`PATCH /api/vorlagen/[id]` with `{action: "favorite"}`)
  4. `next build` passes without the ordner-schemata non-route export error
**Plans**: 1 plan

Plans:
- [ ] 02.2-01-PLAN.md — Create /api/ordner-schemata/[id]/route.ts, fix favorit toggle URL, extract helper to fix build, upgrade delete UX with AlertDialog, optimistic favorit toggle

### Phase 3: Email Client
**Goal**: Law firm staff can receive, read, compose, and send emails directly within the application, with real-time notifications for incoming mail, and can assign any email to a case file (Veraktung) with one click -- the primary daily workflow entry point.
**Depends on**: Phase 1 (worker process for IMAP IDLE connections and SMTP send queue)
**Requirements**: REQ-EM-001, REQ-EM-002, REQ-EM-003, REQ-EM-004, REQ-EM-005, REQ-EM-006, REQ-EM-007, REQ-EM-008
**Research flag**: ImapFlow IDLE reconnection strategy and multi-mailbox management need implementation research. HTML email sanitization patterns are standard.
**Success Criteria** (what must be TRUE):
  1. New emails arrive in the Inbox within seconds of being received on the mail server (IMAP IDLE, not polling) with real-time browser notification via Socket.IO
  2. User can configure and use both a shared Kanzlei mailbox and individual per-user mailboxes
  3. User can view email list with pagination and filter by veraktet/unveraktet, Akte, and Verantwortlicher, and view email details with correctly rendered HTML body and downloadable attachments
  4. User can compose and send emails (To, CC, BCC, rich text, attachments from DMS, case linking) via SMTP
  5. User can assign an email to a case (Veraktung) with auto-suggested case matching and one-click confirmation, with attachments automatically saved to the case DMS; user can create a Ticket from an email with pre-filled data
**Plans**: 4 plans

Plans:
- [ ] 03-01-PLAN.md — Prisma schema (6 email models), IMAP connection manager with IDLE + reconnection, email sync engine, BullMQ queues, email CRUD + mailbox config APIs, SMTP send processor, AES-256 credential encryption
- [ ] 03-02-PLAN.md — Three-pane resizable Inbox UI (folder tree, virtualized email list, detail pane), sanitized HTML rendering, attachment strip, filter bar, keyboard shortcuts
- [ ] 03-03-PLAN.md — Gmail-style floating compose popup with TipTap editor, recipient auto-complete, DMS attachments, signature system, send with 10s undo + scheduled sending, mailbox admin settings page
- [ ] 03-04-PLAN.md — Veraktung slide-over with auto-suggest + DMS copy, Ticket-from-Email, Akte E-Mail Tab, Verantwortlicher assignment, sidebar navigation

### Phase 3.1: Wire Email Real-Time + Compose Integration
**Goal**: Real-time email notifications arrive in the browser via Socket.IO (mailbox room wiring), compose preview shows the email signature, and ComposeManager is available app-wide for compose-from-anywhere — closing all 3 integration gaps and 2 broken E2E flows from the v3.4 audit.
**Depends on**: Phase 1 (Socket.IO rooms), Phase 3 (email client code)
**Requirements**: REQ-IF-003, REQ-EM-001, REQ-EM-003, REQ-EM-006 (all already satisfied — this phase fixes cross-phase wiring)
**Gap Closure**: Closes INT-001 (critical), INT-002 (medium), INT-003 (low) from v3.4 audit
**Research flag**: No research needed — pure wiring of existing code.
**Success Criteria** (what must be TRUE):
  1. Socket.IO clients join `mailbox:{kontoId}` room when viewing email — `rooms.ts` handles `join:mailbox` event
  2. `email:folder-update` emitted by IMAP connection-manager reaches the browser and triggers folder tree / inbox refresh
  3. `GET /api/email-signature?kontoId=` returns the rendered signature HTML for compose preview
  4. `<ComposeManager>` provider is mounted in the email layout so `useComposeManager()` works from any email page
**Plans**: TBD

Plans:
- [ ] 03.1-01-PLAN.md — Wire Socket.IO mailbox rooms, create email-signature API route, mount ComposeManager provider

### Phase 4: Document Pipeline (OCR + RAG Ingestion)
**Goal**: Uploaded PDF documents are automatically OCR-processed (if not already searchable), indexed in Meilisearch, and chunked+embedded into pgvector for AI retrieval -- with a rich document detail page and in-browser PDF preview.
**Depends on**: Phase 1 (worker process for OCR and embedding jobs), Phase 2 (WOPI for document viewing)
**Requirements**: REQ-DV-004, REQ-DV-005, REQ-DV-006, REQ-DV-007, REQ-IF-004, REQ-KI-001
**Research flag**: Needs phase research -- German-capable embedding model selection requires validation with real legal documents. Stirling-PDF OCR endpoint API needs verification.
**Success Criteria** (what must be TRUE):
  1. Stirling-PDF Docker sidecar runs in Docker Compose and PDFs uploaded to a case are automatically OCR-processed in the background (skipping already-searchable PDFs), with OCR status visible as a badge and manual retry available
  2. OCR-processed text is automatically indexed in Meilisearch and documents become findable via full-text search
  3. User can view PDFs in-browser with navigation, zoom, and download (pdf.js viewer)
  4. Document detail page shows metadata, version history, status, tags, and audit history with an actions bar for rename, move, tag, and status changes
  5. Documents are chunked (paragraph-aware for German legal text) and embedded into pgvector with embedding model version tracked per vector, ready for RAG retrieval in Phase 6
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md — Stirling-PDF Docker sidecar + Prisma schema (OCR fields, DocumentChunk, DokumentTagKategorie) + BullMQ queues (ocr, embedding, preview) + OCR processor + upload panel + OCR badges + admin pipeline dashboard + tag management
- [ ] 04-02-PLAN.md — react-pdf PDF viewer + document detail page (split view) + version timeline + actions bar + tag manager + document APIs
- [ ] 04-03-PLAN.md — RAG ingestion pipeline (German legal chunking + Ollama embedding + pgvector storage) + search API with highlighting + /suche advanced search page + Cmd+K document search

### Phase 4.1: Wire Akte Real-Time + Email Compose + Admin Pipeline
**Goal**: Real-time OCR status updates reach the browser via Socket.IO (akte room wiring), users can start new email composition from the inbox, and admins can monitor the document pipeline — closing all 3 integration gaps and 2 broken E2E flows from the 3rd v3.4 audit.
**Depends on**: Phase 1 (Socket.IO rooms), Phase 3.1 (ComposeManager), Phase 4 (OCR pipeline + admin API)
**Requirements**: REQ-DV-004, REQ-DV-005, REQ-EM-006 (all already satisfied — this phase fixes cross-phase wiring)
**Gap Closure**: Closes INT-004 (critical), INT-005 (medium), INT-006 (low) from v3.4 3rd audit
**Research flag**: No research needed — pure wiring of existing code.
**Success Criteria** (what must be TRUE):
  1. Akte pages emit `join:akte`/`leave:akte` on mount/unmount — `akte:{akteId}` room is populated when user views documents
  2. `document:ocr-complete` events from worker reach the browser and upload panel OCR status transitions in real-time
  3. "Neue E-Mail" button in email inbox header calls `openCompose()` and opens the compose popup
  4. Admin pipeline dashboard page (or section in admin/system) displays OCR/embedding queue stats from `/api/admin/pipeline`
**Plans**: 1 plan

Plans:
- [ ] 04.1-01-PLAN.md — Wire akte Socket.IO room join/leave + global OCR toasts, Neue E-Mail FAB button, admin pipeline dashboard page with navigation

### Phase 5: Financial Module
**Goal**: Attorneys can calculate fees using current RVG tables, create legally compliant invoices with PDF and E-Rechnung export, track all financial movements per case in the Aktenkonto with Fremdgeld compliance safeguards, and export data to DATEV and SEPA formats.
**Depends on**: Phase 2 (Briefkopf/letterhead for invoice PDFs, template system for Rechnungs-PDF)
**Requirements**: REQ-FI-001, REQ-FI-002, REQ-FI-003, REQ-FI-004, REQ-FI-005, REQ-FI-006, REQ-FI-007, REQ-FI-008, REQ-FI-009, REQ-FI-010, REQ-FI-011
**Research flag**: Needs phase research -- RVG table data structure and Anrechnung algorithm, ZUGFeRD PDF/A-3 generation toolchain, DATEV EXTF_ header format.
**Success Criteria** (what must be TRUE):
  1. RVG calculator correctly computes fees from Streitwert input with VV numbers (3100, 3104, 1000/1003, 7002, 1008), including Anrechnung (VV Vorbem. 3 Abs. 4), Erhoehungsgebuehr, and KostBRaeG 2025 rates -- verified against DAV Prozesskostenrechner for 10+ test cases
  2. User can create invoices with all Section 14 UStG required fields, atomic Nummernkreis, status flow (Entwurf -> Gestellt -> Bezahlt -> Storniert), and generate invoice PDF with firm letterhead
  3. User can export invoices as XRechnung (CII) and ZUGFeRD (PDF/A-3) -- validated against official XRechnung Validator
  4. Aktenkonto displays all bookings (Einnahme/Ausgabe/Fremdgeld/Auslage) with Fremdgeld displayed separately, 5-business-day forwarding alerts, and 15k EUR Anderkonto threshold warnings
  5. User can export Buchungsstapel to DATEV CSV, generate SEPA pain.001/pain.008 XML files, import bank statements (CSV + CAMT053) with semi-automatic invoice matching, and track time per case
**Plans**: TBD

Plans:
- [ ] 05-01: RVG calculator as pure-function library with versioned fee tables + unit tests
- [ ] 05-02: Invoice system (DB model, Nummernkreis, status flow, PDF generation)
- [ ] 05-03: Aktenkonto + Fremdgeld compliance
- [ ] 05-04: E-Rechnung (XRechnung + ZUGFeRD) export
- [ ] 05-05: DATEV CSV + SEPA XML + Banking import + Zeiterfassung

### Phase 6: AI Features + beA
**Goal**: OpenClaw proactively scans incoming emails and documents to suggest actions and create drafts, attorneys can chat with case documents via RAG, deadlines are auto-recognized from Schriftsaetze, and beA messages can be sent and received through the application -- with every AI output starting as a human-reviewable draft, never auto-sent.
**Depends on**: Phase 3 (email system for AI to scan), Phase 4 (OCR + RAG ingestion pipeline for document understanding)
**Requirements**: REQ-KI-002, REQ-KI-003, REQ-KI-004, REQ-KI-005, REQ-KI-006, REQ-KI-007, REQ-KI-008, REQ-KI-009, REQ-KI-010, REQ-KI-011, REQ-KI-012, REQ-BA-001, REQ-BA-002, REQ-BA-003, REQ-BA-004, REQ-BA-005, REQ-BA-006
**Research flag**: Needs phase research -- bea.expert API authentication flow, XJustiz namespace v3.4.1, German embedding model benchmarks, proactive agent trigger architecture (event-driven vs polling).
**Success Criteria** (what must be TRUE):
  1. User can switch between LLM providers (Ollama/Mistral local, OpenAI, Anthropic) in settings and all AI features work with any selected provider via Vercel AI SDK v4
  2. User can ask questions about documents within a specific case (document chat) and receives answers with source citations (document name + section), confidence indication, and "I don't know" responses below confidence threshold
  3. OpenClaw proactively scans new emails and documents, suggests actions (deadline detected, response draft, party recognized, document classified), and all suggestions appear as ENTWURF requiring explicit human approval -- never auto-sent
  4. Deadlines recognized from Schriftsaetze are created as DRAFT calendar entries; chat history is saved per user and per case; token usage is tracked per user/case with admin dashboard
  5. beA messages can be received (auto-assigned to cases), sent (with document attachments), eEB acknowledged, Pruefprotokolle displayed, Safe-IDs managed on contacts, and XJustiz documents parsed and viewable
**Plans**: TBD

Plans:
- [ ] 06-01: Multi-provider AI setup (AI SDK v4) + KI-Entwurf-Workflow enforcement + rate limits
- [ ] 06-02: RAG retrieval API + document chat UI + source citations + chat history
- [ ] 06-03: Proactive agent (OpenClaw) + deadline recognition + party recognition
- [ ] 06-04: beA integration via bea.expert REST API (inbox, outbox, eEB, XJustiz)

### Phase 7: Rollen/Sicherheit + Compliance + Observability
**Goal**: Fine-grained access control is enforced across the application with role-specific permissions, administrators have full audit trail visibility, DSGVO compliance is implemented, and the system is observable with health checks and structured logging.
**Depends on**: Phase 1-6 (security layer applied to all existing features)
**Requirements**: REQ-RS-001, REQ-RS-002, REQ-RS-003, REQ-RS-004, REQ-RS-005, REQ-RS-006
**Research flag**: Standard patterns -- RBAC enforcement extends existing NextAuth roles, Audit-Trail UI reads existing logAuditEvent data.
**Success Criteria** (what must be TRUE):
  1. Akten access is enforced via personal assignment, Gruppen/Dezernate membership, and Admin override -- users cannot access cases they are not authorized for
  2. SEKRETARIAT role can perform Sachbearbeiter tasks but cannot Freigeben documents; PRAKTIKANT role can only read and create drafts on assigned cases
  3. Admin can view the full system-wide Audit-Trail (who/when/what) with filtering, and per-Akte audit history is visible on the case detail page
  4. DSGVO compliance is operational: data deletion workflow, Auskunftsrecht export, and Einwilligungsmanagement are functional
  5. Health check endpoints report status of App, Worker, Redis, Ollama, and all Docker services; structured logging is enabled for production troubleshooting
**Plans**: TBD

Plans:
- [ ] 07-01: RBAC enforcement (Akten-Zugriff, SEKRETARIAT, PRAKTIKANT permissions)
- [ ] 07-02: Audit-Trail UI + DSGVO compliance + Observability

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 2.1 -> 2.2 -> 3 -> 3.1 -> 4 -> 4.1 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Infrastructure Foundation | 3/3 | Complete    | 2026-02-24 |
| 2. Deadline Calculation + Document Templates | 5/6 | Complete    | 2026-02-24 |
| 2.1 Wire Frist-Reminder Pipeline + Settings Init | 1/1 | Complete    | 2026-02-24 |
| 2.2 Fix API Routes + UI Paths | 0/1 | Not started | - |
| 3. Email Client | 0/4 | Complete    | 2026-02-24 |
| 3.1 Wire Email Real-Time + Compose Integration | 0/1 | Not started | - |
| 4. Document Pipeline (OCR + RAG Ingestion) | 0/3 | Complete    | 2026-02-24 |
| 4.1 Wire Akte Real-Time + Email Compose + Admin Pipeline | 0/1 | Not started | - |
| 5. Financial Module | 0/5 | Not started | - |
| 6. AI Features + beA | 0/4 | Not started | - |
| 7. Rollen/Sicherheit + Compliance + Observability | 0/2 | Not started | - |

## Coverage Matrix

Every v1 requirement mapped to exactly one phase. No orphans.

| REQ-ID | Requirement (short) | Phase | Priority |
|--------|---------------------|-------|----------|
| REQ-IF-001 | Redis 7 in Docker Compose | Phase 1 | P0 |
| REQ-IF-002 | Worker-Prozess (worker.ts, BullMQ) | Phase 1 | P0 |
| REQ-IF-003 | Custom server.ts (Next.js + Socket.IO) | Phase 1 | P1 |
| REQ-IF-005 | Graceful Shutdown fuer Worker | Phase 1 | P1 |
| REQ-FK-001 | BGB Sections 187-193 Fristberechnung | Phase 2 | P0 |
| REQ-FK-002 | Feiertagskalender pro Bundesland | Phase 2 | P0 |
| REQ-FK-003 | Vorfristen-Erinnerungen (7/3/1 Tag) | Phase 2.1 | P1 |
| REQ-FK-004 | Tagesuebersicht + Quick-Actions | Phase 2 | P1 |
| REQ-FK-005 | Prioritaeten: 5 Stufen | Phase 2 | P1 |
| REQ-DV-001 | Vorlagen-System mit Platzhaltern | Phase 2 | P1 |
| REQ-DV-002 | Briefkopf-Verwaltung | Phase 2 | P1 |
| REQ-DV-003 | PDF-Export mit Briefkopf | Phase 2 | P1 |
| REQ-DV-008 | Ordner-Schemata fuer Akten | Phase 2.2 | P1 |
| REQ-DV-009 | Vorlagenkategorien | Phase 2.2 | P1 |
| REQ-DV-010 | WOPI-Protokoll stabil | Phase 2 | P1 |
| REQ-DV-011 | Track Changes, Kommentare, Versionierung | Phase 2 | P1 |
| REQ-EM-001 | IMAP-Sync mit IDLE | Phase 3 | P1 |
| REQ-EM-002 | Shared + per-User Mailboxen | Phase 3 | P1 |
| REQ-EM-003 | Inbox-Seite mit Filtern | Phase 3 | P1 |
| REQ-EM-004 | E-Mail-Detailansicht | Phase 3 | P1 |
| REQ-EM-005 | E-Mail verakten | Phase 3 | P1 |
| REQ-EM-006 | Compose-View + SMTP | Phase 3 | P1 |
| REQ-EM-007 | Ticket aus E-Mail | Phase 3 | P1 |
| REQ-EM-008 | Akte Tab E-Mails | Phase 3 | P1 |
| REQ-DV-004 | Auto-OCR bei PDF-Upload | Phase 4 | P1 |
| REQ-DV-005 | OCR-Status + Badge + Retry | Phase 4 | P1 |
| REQ-DV-006 | PDF-Preview im Browser | Phase 4 | P1 |
| REQ-DV-007 | Dokument-Detailseite | Phase 4 | P1 |
| REQ-IF-004 | Stirling-PDF Docker-Sidecar | Phase 4 | P1 |
| REQ-KI-001 | RAG-Pipeline (pgvector, Chunking, Embedding) | Phase 4 | P2 |
| REQ-FI-001 | RVG-Berechnung | Phase 5 | P1 |
| REQ-FI-002 | RVG-Gebuehrentabelle versioniert | Phase 5 | P1 |
| REQ-FI-003 | Rechnungen (DB, Nummernkreis, Status) | Phase 5 | P1 |
| REQ-FI-004 | Rechnungs-PDF mit Briefkopf | Phase 5 | P1 |
| REQ-FI-005 | Aktenkonto | Phase 5 | P1 |
| REQ-FI-006 | Fremdgeld-Compliance | Phase 5 | P1 |
| REQ-FI-007 | E-Rechnung (XRechnung + ZUGFeRD) | Phase 5 | P1 |
| REQ-FI-008 | DATEV CSV-Export | Phase 5 | P2 |
| REQ-FI-009 | SEPA pain.001 + pain.008 | Phase 5 | P2 |
| REQ-FI-010 | Banking-Import CSV + CAMT053 | Phase 5 | P2 |
| REQ-FI-011 | Zeiterfassung | Phase 5 | P2 |
| REQ-KI-002 | Multi-Provider AI (Vercel AI SDK v4) | Phase 6 | P2 |
| REQ-KI-003 | Document Chat (per-case RAG) | Phase 6 | P2 |
| REQ-KI-004 | Proaktive KI-Agentin OpenClaw | Phase 6 | P2 |
| REQ-KI-005 | Auto-Fristenerkennung | Phase 6 | P2 |
| REQ-KI-006 | Auto-Beteiligte-Erkennung | Phase 6 | P2 |
| REQ-KI-007 | Chat-Verlauf speichern | Phase 6 | P2 |
| REQ-KI-008 | Token-Usage-Tracking | Phase 6 | P2 |
| REQ-KI-009 | KI-Entwurf-Workflow (DRAFT only) | Phase 6 | P0 |
| REQ-KI-010 | Quellennachweise bei KI-Antworten | Phase 6 | P1 |
| REQ-KI-011 | AI-Runner Idempotenz + Retry | Phase 6 | P2 |
| REQ-KI-012 | Rate-Limits fuer OpenClaw | Phase 6 | P1 |
| REQ-BA-001 | beA-Posteingang | Phase 6 | P2 |
| REQ-BA-002 | beA-Postausgang | Phase 6 | P2 |
| REQ-BA-003 | eEB | Phase 6 | P2 |
| REQ-BA-004 | Pruefprotokoll | Phase 6 | P2 |
| REQ-BA-005 | Safe-ID-Verwaltung | Phase 6 | P2 |
| REQ-BA-006 | XJustiz-Parser + Viewer | Phase 6 | P2 |
| REQ-RS-001 | Akten-Zugriff (Persoenlich + Gruppen) | Phase 7 | P1 |
| REQ-RS-002 | SEKRETARIAT eingeschraenkt | Phase 7 | P1 |
| REQ-RS-003 | PRAKTIKANT nur Lesen + Entwuerfe | Phase 7 | P1 |
| REQ-RS-004 | Systemweiter Audit-Trail | Phase 7 | P1 |
| REQ-RS-005 | DSGVO Compliance | Phase 7 | P1 |
| REQ-RS-006 | Observability (Health-Checks + Logs) | Phase 7 | P1 |

**Coverage: 64/64 v1 requirements mapped. No orphans.**

---
*Created: 2026-02-24*
*Depth: comprehensive*
*Source: REQUIREMENTS.md + research/SUMMARY.md + research/FEATURES.md + research/ARCHITECTURE.md*
