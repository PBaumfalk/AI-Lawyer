# Project Research Summary

**Project:** AI-Lawyer (KI-First Kanzleisoftware)
**Domain:** German Legal Practice Management (Kanzleisoftware) — Milestone 2 Capabilities
**Researched:** 2026-02-24
**Confidence:** MEDIUM-HIGH

## Executive Summary

AI-Lawyer is being expanded from an MVP case management system into a full-featured German Kanzleisoftware with AI differentiators. The German legal software market is dominated by RA-MICRO, AnNoText, and Advoware — all of which share a common pattern: email-centric workflows ("Veraktung"), RVG-based billing, strict compliance requirements (BRAO, BGB, UStG), and deep document management. The research confirms that matching these table stakes is a prerequisite before any AI differentiation can be realized. The proactive AI agent ("OpenClaw") is the primary strategic differentiator — no incumbent offers proactive, context-aware AI suggestions embedded in the core workflow.

The recommended technical approach is a **hybrid monolith + worker + sidecars** architecture. The existing Next.js application handles UI and short-lived API requests; a new Node.js worker process (same Docker image, separate entrypoint) handles long-running operations via BullMQ job queues; Redis serves as the coordination layer for both job queues and Socket.IO pub/sub; and Stirling-PDF runs as a Docker sidecar for PDF/OCR operations. This architecture evolves the existing single-container deployment into five containers (app, worker, redis, stirling-pdf, plus existing db/minio/meilisearch/onlyoffice) while sharing a single codebase and Prisma schema.

The key risks are concentrated in three domains: (1) legal compliance — deadline calculation errors (BGB §§187-193) and Fremdgeld mishandling (BRAO §43a) carry direct malpractice and disciplinary liability, requiring near-100% test coverage in those modules; (2) architectural mistakes — running IMAP IDLE inside Next.js API routes is the single most common failure pattern and must be prevented from day one by committing to the worker architecture before writing any email code; and (3) AI safety — RAG hallucinations in German legal context require semantic chunking, German-capable embedding models, confidence thresholds, and mandatory source citations on every AI response.

## Key Findings

### Recommended Stack

The existing stack (Next.js 14+, Prisma, PostgreSQL 16 + pgvector, MinIO, Meilisearch, OnlyOffice, NextAuth v5, shadcn/ui) requires targeted additions rather than changes. The additions form coherent ecosystem clusters: email uses the Andris Reinman suite (imapflow 1.2.10, nodemailer 8.0.1, mailparser 3.9.3); AI uses Vercel AI SDK v4 (NOT v6 — zod version lock) with provider-specific packages; RAG uses LangChain text splitters only (not full LangChain) with pgvector for storage; real-time messaging uses Socket.IO 4.8.3 with Redis adapter; and German-specific financial formats use @e-invoice-eu/core (XRechnung/ZUGFeRD) and sepa.js (pain.001/pain.008).

**Core new technologies:**
- **imapflow 1.2.10**: IMAP client with native IDLE — only actively maintained async IMAP library for Node.js
- **nodemailer 8.0.1**: SMTP sending — de facto standard, zero runtime deps
- **ai@^4.3.19 (Vercel AI SDK v4)**: Multi-provider LLM abstraction — v4 required due to zod 3.23.8 lock (v6 would require zod upgrade across entire codebase)
- **@ai-sdk/openai@^1.3.24 + @ai-sdk/anthropic@^1.2.12 + ollama-ai-provider@^1.2.0**: LLM providers — v1.x line matches AI SDK v4
- **@langchain/textsplitters@^1.0.1**: Text chunking only — RecursiveCharacterTextSplitter is best-in-class; avoid full LangChain for RAG
- **pgvector@^0.2.1**: Vector serialization helper for existing pgvector PostgreSQL extension
- **socket.io@^4.8.3 + socket.io-client@^4.8.3**: Real-time messaging — room-based, reconnection, Redis adapter for multi-process
- **@e-invoice-eu/core@^2.3.1**: XRechnung + ZUGFeRD — EN16931 compliant, mandatory since 01.01.2025
- **sepa@^2.1.0**: SEPA pain.001 + pain.008 XML generation
- **tsdav@^2.1.8 + ical.js@^2.2.1**: CalDAV sync — TypeScript-native, handles RFC 6578
- **Stirling-PDF (Docker, stirlingtools/stirling-pdf:latest-fat)**: PDF OCR, merge, split — REST API sidecar, no npm package
- **Redis 7 (Docker)**: BullMQ job queue + Socket.IO pub/sub adapter
- **BullMQ**: Job queue in worker process — retries, backoff, concurrency, deduplication
- **feiertagejs**: German holiday calendar per Bundesland — required for BGB §193 deadline extension

### Expected Features

**Must have (P0/P1 — table stakes or legal requirements):**
- **BGB §§187-193 deadline calculation** — malpractice liability if wrong; Fristenversaeumnis is #1 attorney liability claim
- **Holiday calendar per Bundesland** — required for §193 BGB extension; feiertagejs handles this
- **Pre-deadline reminders (Vorfristen)** — 7/3/1 day configurable; best practice required by insurance
- **IMAP inbox with Veraktung** — core daily workflow; email-to-case assignment is THE feature
- **SMTP send** — attorneys cannot switch to external client for sending
- **Document template system with placeholders** — lawyers create 20-50 docs/day from templates
- **Letterhead (Briefkopf) management** — legally required per BRAO for all correspondence
- **Auto-OCR on PDF upload** — prerequisite for AI features on scanned documents
- **RVG fee calculation** — attorneys cannot bill without it; KostBRaeG 2025 rates (6% increase June 2025)
- **Invoice creation with PDF** — §14 UStG compliance; Nummernkreis, status flow
- **Aktenkonto** — §43a Abs. 7 BRAO legally mandates Fremdgeld tracking
- **E-Rechnung (XRechnung + ZUGFeRD)** — mandatory B2B receipt since 01.01.2025
- **beA message management** — §31a BRAO legal obligation for every attorney

**Should have (P2 — competitive differentiators):**
- **Proactive AI agent ("OpenClaw")** — scans incoming emails/documents, suggests actions, creates drafts; no incumbent has this
- **AI deadline recognition from documents** — NLP extraction from Schriftsaetze; creates calendar DRAFTS only
- **Per-case document chat (RAG)** — "Was fordert der Gegner?" over case documents
- **DATEV CSV export** — de facto standard for tax advisor handoff
- **SEPA payment file generation** — automates bank transfers
- **Banking import (CSV + CAMT053)** — invoice reconciliation

**Should have (P3 — platform extension):**
- **Mandantenportal (client portal)** — emerging differentiator; ActaPort launched 2025; most incumbents don't have it
- **Case-bound internal messaging** — replaces Teams/Slack for case discussion
- **Mahnwesen (dunning)** — automated payment reminders
- **Case summary + global legal chat** — advanced AI requiring per-case AI validation first
- **Advanced PDF tools** — merge/split/watermark via Stirling-PDF

**Defer to v2+:**
- Full Finanzbuchhaltung module — competes with DATEV; multi-year effort
- Bidirectional IMAP sync — conflict-prone; one-way import is correct approach
- Native mobile app — responsive web covers 90% of use cases
- Zwangsvollstreckung module — specialized, low frequency
- AI auto-send of any kind — absolute no-go per BRAK 2025 AI guidelines; BRAO duty requires attorney oversight

### Architecture Approach

The architecture evolves to a **Hybrid Monolith + Worker + Sidecars** pattern. The Next.js app handles all UI and short-lived API requests (including RAG retrieval queries at ~50ms). A separate worker process (same Docker image, `node worker.js` entrypoint) runs BullMQ job processors for all long-running operations. Redis coordinates between app and worker via job queues, and between Socket.IO instances via pub/sub adapter. The Mandantenportal lives as a route group `/(portal)/` within the same Next.js app — path-based multi-tenancy avoids cross-origin complexity and code duplication.

**Major components:**
1. **Next.js App (custom server.ts)** — UI, REST API routes, Socket.IO server (WebSocket), NextAuth; wraps Next.js with custom HTTP server to support WebSocket on same port
2. **Worker Process (worker.ts)** — BullMQ processors for: IMAP IDLE connections, RAG embedding ingestion, OCR jobs, AI task processing, CalDAV sync, SMTP sending; shares `src/lib/` with app
3. **Redis 7** — BullMQ job queue backend + Socket.IO Redis adapter for multi-process pub/sub
4. **Stirling-PDF (Docker sidecar)** — PDF OCR (Tesseract, German tessdata), merge, split, convert; called via REST API from worker
5. **PostgreSQL + pgvector** — relational data + vector embeddings for RAG in same database; cosine similarity via raw SQL `$queryRaw`
6. **Mandantenportal (route group)** — separate Credentials provider in NextAuth, separate `PortalUser` table, portal-specific middleware, `FREIGEGEBEN` document gating

### Critical Pitfalls

1. **IMAP IDLE in Next.js request lifecycle** — persistent TCP connections die when API routes end; run ALL IMAP code in the dedicated worker process with ImapFlow; Next.js only reads emails from DB; prevent this architectural mistake in the first task of the email phase before any IMAP code is written

2. **BGB §§187-193 deadline calculation edge cases** — month-end overflow (Jan 31 + 1 month = Feb 28, not Mar 2), §193 weekend extension only applies to specific deadline types, Bundesland-specific holidays (Fronleichnam in NRW but not Berlin), event-triggered vs. date-triggered start dates; build FristenRechner as a pure function library with >50 unit test cases before any UI integration; this is the one area where the "max 20% test effort" rule does NOT apply

3. **RVG version drift** — hardcoded fee tables silently break when law changes; store fee tables as versioned data with effective date ranges; KostBRaeG 2025 takes effect June 1, 2025 with 6% increase; missing Anrechnung rules (VV Vorbem. 3 Abs. 4) causes over/under-billing; validate against DAV Prozesskostenrechner reference implementation

4. **Fremdgeld compliance violations (BRAO §43a Abs. 7)** — Fremdgeld must be displayed separately from office funds; amounts over €15,000 require individual Anderkonto per §4 BORA; Fremdgeld older than 5 business days without outgoing transfer must trigger alert; violations lead to bar disciplinary proceedings and potential disbarment

5. **RAG hallucinations in German legal text** — fixed-size chunking splits legal clauses mid-argument; general English embedding models handle German compound legal terms poorly; use semantic/layout-aware chunking at paragraph boundaries; use multilingual embedding model (multilingual-e5-large or German-capable via Ollama); store embedding model version per vector for migration safety; always show source citations; implement confidence threshold ("I don't know" response below threshold)

6. **Portal authentication isolation failure** — shared JWT secrets or cookie domain scope allows portal users to escalate to internal API access; use separate `PortalUser` table (not internal `User`), separate JWT signing key with distinct `aud` claim, share-based document access via explicit `PortalFreigabe` table — define this architecture in the first task of the portal phase before building any UI

7. **E-Rechnung format validation gaps** — ZUGFeRD PDF visual and embedded XML can diverge; XRechnung requires CII syntax for most German authorities (UBL also supported but check recipient); missing Leitweg-ID causes public sector rejection; PDF/A-3 conformance required (not standard PDF); validate every generated invoice against official XRechnung Validator (erechnungsvalidator.service-bw.de) before declaring done

## Implications for Roadmap

Based on combined research, a 7-phase structure is recommended, following the architecture's dependency graph:

### Phase 1: Infrastructure Foundation
**Rationale:** Redis, BullMQ, and the worker process are prerequisites for email, OCR, RAG, and messaging. Building the foundation first avoids retrofitting the architecture into already-written code — the most expensive mistake possible. The custom `server.ts` for WebSocket must also be established here, even if messaging comes later.
**Delivers:** Redis in docker-compose; BullMQ queue definitions; `worker.ts` entrypoint with graceful shutdown; custom `server.ts` wrapping Next.js with Socket.IO; admin job status dashboard; worker health monitoring
**Addresses:** Foundation for all subsequent phases
**Avoids:** IMAP IDLE in Next.js (Pitfall 1); synchronous embedding (Architecture Anti-Pattern 3)
**Research flag:** Standard patterns — skip phase research

### Phase 2: Deadline Calculation + Document Templates
**Rationale:** Deadline calculation has zero external dependencies (only needs holiday data) and is the highest legal-risk feature in the entire system. It must be built, tested, and verified BEFORE the AI deadline recognition feature touches it. Document templates (letterhead, placeholders, PDF export) gate invoicing. Both are foundational with no dependency on the worker.
**Delivers:** FristenRechner pure-function library with >50 edge case unit tests; BGB §§187-193 + §193 weekend/holiday extension; per-Bundesland holiday calendar (feiertagejs); Vorfristen configuration; document template system with placeholders; Briefkopf management; PDF export via OnlyOffice
**Features addressed:** F1, F2, F3, D1, D2, D3
**Avoids:** Fristenberechnung edge cases (Pitfall 2)
**Research flag:** Standard patterns for templates; deadline calculation needs verification against LTO Fristenrechner and DAV Prozesskostenrechner test cases

### Phase 3: Email Client (IMAP + SMTP + Veraktung)
**Rationale:** Email is the highest user-facing impact feature and the primary daily workflow entry point for all law firm employees. It depends on Phase 1 (worker architecture) and is an enabler for the AI agent (Phase 5). Veraktung (email-to-case assignment) is THE killer feature — without it, email is useless in a Kanzlei context.
**Delivers:** ImapFlow connection manager in worker (IMAP IDLE per mailbox); email DB models; email CRUD API routes; HTML rendering with sanitize-html (XSS prevention); attachment handling (MinIO storage); email compose + SMTP send via BullMQ; Veraktung (auto-suggest case from sender, one-click assign); Socket.IO real-time new-email notification
**Features addressed:** E1, E2, E3
**Stack used:** imapflow, nodemailer, mailparser, sanitize-html, socket.io
**Avoids:** IMAP IDLE in Next.js (Pitfall 1); XSS via unsanitized HTML email display
**Research flag:** ImapFlow IDLE reconnection strategy needs implementation research; multi-mailbox management (shared + per-user) needs task-level design

### Phase 4: Document Pipeline (OCR + RAG Ingestion)
**Rationale:** Stirling-PDF is a Docker sidecar with minimal coupling to other features. Auto-OCR on upload makes all scanned documents searchable — this is a prerequisite for AI to read court documents. RAG ingestion (chunking + embedding) must be built before the AI chat features in Phase 5 can work. Both use the worker queue infrastructure from Phase 1.
**Delivers:** Stirling-PDF in docker-compose (fat image with Tesseract, German tessdata); OCR BullMQ processor (async, skip-if-searchable, retry on failure); OCR status tracking in UI; DocumentChunk Prisma model with pgvector column; HNSW vector index; chunking with @langchain/textsplitters (semantic/paragraph-aware for German legal text); embedding generation via AI SDK (Ollama nomic-embed-text or OpenAI text-embedding-3-small); embedding model version stored per vector
**Features addressed:** O1, O2
**Stack used:** Stirling-PDF REST API, @langchain/textsplitters, pgvector npm, ai + providers
**Avoids:** Synchronous OCR timeout (Integration Gotcha); RAG hallucinations from poor chunking (Pitfall 6); embedding model version mismatch
**Research flag:** German-capable embedding model selection needs validation with real legal documents; Stirling-PDF OCR endpoint URL needs verification against current API

### Phase 5: Financial Module (RVG + Invoicing + Aktenkonto + E-Rechnung + DATEV)
**Rationale:** Finance is the most complex and legally demanding feature cluster. It builds on letterhead (Phase 2) and must deliver RVG calculation, invoicing, Aktenkonto, and E-Rechnung together — these are tightly interdependent. E-Rechnung cannot be deferred because it is legally mandatory. Fremdgeld compliance must be built correctly from the start, not hardened later.
**Delivers:** RVG calculator as versioned pure-function library (Streitwert brackets, VV numbers, Anrechnung, Erhöhungsgebühr, Auslagenpauschale, KostBRaeG 2025 rates); invoice creation with PDF (§14 UStG fields, Nummernkreis, status flow: Entwurf→Gestellt→Bezahlt→Storniert); Aktenkonto (Einnahme/Ausgabe/Fremdgeld/Auslage bookings, Fremdgeld separate display, 5-day forwarding alert, €15k Anderkonto threshold warning); E-Rechnung export (XRechnung CII + ZUGFeRD PDF/A-3 via @e-invoice-eu/core); DATEV CSV Buchungsstapel export; SEPA pain.001 + pain.008 generation
**Features addressed:** FI1, FI2, FI3, FI4, FI5, FI6
**Stack used:** @e-invoice-eu/core, sepa.js, pdf-lib (ZUGFeRD PDF/A-3 embedding)
**Avoids:** RVG version drift (Pitfall 3); Fremdgeld compliance violations (Pitfall 5); E-Rechnung format validation gaps (Pitfall 7)
**Research flag:** Needs phase research — RVG table data structure, Anrechnung rules, ZUGFeRD PDF/A-3 generation with pdf-lib vs Stirling-PDF, DATEV field format limits

### Phase 6: AI Features (OpenClaw Proactive Agent + Document Chat)
**Rationale:** AI features depend on OCR (Phase 4, so AI can read scanned documents) and email (Phase 3, so the agent can scan incoming emails). The RAG retrieval infrastructure (pgvector queries, AI SDK streaming) is built here on top of the ingestion pipeline from Phase 4. The proactive agent is the primary differentiator — build it after infrastructure is solid.
**Delivers:** RAG retrieval API route (pgvector cosine similarity, Akte-scoped, confidence threshold); AI chat with streaming (streamText, useChat hook); per-case document chat (AI4); automatic deadline recognition from documents (creates DRAFT calendar entries only, never auto-confirmed) (AI2); proactive agent worker job (scans new emails/documents: party recognition, response draft suggestions, document classification, case status alerts) (AI1); case summary generation (AI3); DRAFT-only enforcement (all AI output starts as ENTWURF, requires explicit human FREIGEGEBEN transition); source citations on every response; beA integration via bea.expert REST API
**Features addressed:** AI1, AI2, AI3, AI4, B1
**Stack used:** ai@^4.3.19, @ai-sdk/openai, @ai-sdk/anthropic, ollama-ai-provider, multilingual embedding model
**Avoids:** RAG hallucinations on German legal text (Pitfall 6); AI auto-send (BRAK 2025 AI guidelines compliance)
**Research flag:** Needs phase research — bea.expert API authentication flow, XJustiz namespace versioning, proactive agent trigger architecture (event-driven vs polling), German embedding model benchmarks

### Phase 7: Client Portal + Internal Messaging + CalDAV
**Rationale:** These three features are independent of each other and of the AI features, but depend on the core infrastructure being stable. The portal requires separate auth architecture. Messaging builds on the Socket.IO infrastructure from Phase 1. CalDAV sync is the most complex sync logic and is appropriately last.
**Delivers:** Mandantenportal route group `/(portal)/` with separate `PortalUser` table, separate JWT signing key + `aud` claim, `PortalFreigabe` table for explicit document sharing, invitation-link auth, read-only case view, document download, secure client-attorney messaging, document upload (CP1, CP2); case-bound internal messaging threads with Socket.IO rooms, @mentions, attachment linking to DMS (M1); CalDAV sync worker job (tsdav, bidirectional with ETag conflict detection, 5-minute poll interval) (CalDAV); Mahnwesen dunning process (FI8)
**Features addressed:** CP1, CP2, M1, FI8, CalDAV (from v2+ consideration, moved up if demand validates)
**Stack used:** tsdav, ical.js, socket.io (rooms), NextAuth separate Credentials provider
**Avoids:** Portal auth isolation failure (Pitfall 8); CalDAV sync loops
**Research flag:** Needs phase research — portal invitation link flow, CalDAV conflict resolution strategy, Socket.IO room cleanup on case close

### Phase Ordering Rationale

- Infrastructure before features: No email, OCR, RAG, or messaging feature can be built correctly without the worker process and Redis queue. This ordering prevents the most expensive architectural mistake.
- Deadline calculation before AI: The FristenRechner must be a tested, verified pure function before the AI deadline recognition feature calls it. Getting this wrong creates malpractice liability.
- Email before AI: The proactive AI agent's primary trigger is incoming emails. Email must be operational for AI to demonstrate its core value proposition.
- OCR + RAG ingestion before AI chat: AI cannot answer questions about scanned court documents without OCR text, and cannot retrieve context without vector embeddings.
- Finance as standalone phase: The RVG + invoicing + Aktenkonto + E-Rechnung cluster is tightly interdependent and legally demanding. Grouping it prevents partial builds with compliance gaps.
- Portal last: Portal reads existing data (Akten, Dokumente, Nachrichten) from earlier phases. Building it last means it has mature data to display and avoids building against unstable APIs.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 5 (Financial):** RVG fee table data structure, Anrechnung algorithm implementation, ZUGFeRD PDF/A-3 with pdf-lib vs Stirling-PDF approach, DATEV EXTF_ header format details — all require task-level research before implementation
- **Phase 6 (AI/beA):** bea.expert API authentication token flow, XJustiz namespace v3.4.1 handling, German embedding model benchmark on legal text, proactive agent event-trigger architecture
- **Phase 7 (Portal/CalDAV):** Portal invitation link expiry + session invalidation on Mandant removal, CalDAV timezone (CET/CEST DST) in VTIMEZONE component

**Phases with standard, well-documented patterns (can skip phase research):**
- **Phase 1 (Infrastructure):** BullMQ + Redis + custom server.ts pattern is thoroughly documented; Socket.IO + Next.js official guide is authoritative
- **Phase 2 (Deadlines/Templates):** BGB §§187-193 rules are statutory and deterministic; docxtemplater pattern is established; feiertagejs is straightforward
- **Phase 3 (Email):** ImapFlow + nodemailer ecosystem is well-documented; the main risk is architectural (worker placement), not technical

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm package versions verified via `npm view`; AI SDK v4/v6 split is a hard constraint from zod version; ecosystem choices have clear rationale |
| Features | HIGH | Table stakes verified against RA-MICRO/AnNoText public docs; legal requirements (BGB, BRAO, UStG) verified against authoritative sources; RVG KostBRaeG 2025 changes confirmed |
| Architecture | HIGH | Worker + BullMQ + Socket.IO pattern is well-documented with official guides; pgvector raw SQL pattern is established; path-based multi-tenancy is Next.js recommended approach |
| Pitfalls | HIGH | Legal compliance pitfalls verified against official sources (gesetze-im-internet.de, DAV, BRAK); technical pitfalls corroborated from primary sources (GitHub issues, official docs) |

**Overall confidence:** HIGH

### Gaps to Address

- **beA API practical integration**: The bea.expert JavaScript API was archived May 2025. The REST API itself is still active but practical integration examples are sparse. Requires implementation research in Phase 6 before writing beA tasks.
- **ZUGFeRD PDF/A-3 generation toolchain**: @e-invoice-eu/core generates the XML but PDF/A-3 embedding is ambiguous — pdf-lib may not produce strict PDF/A-3 conformance. Needs validation in Phase 5 planning; Stirling-PDF may be the correct tool for this step.
- **German embedding model for Ollama**: multilingual-e5-large is recommended for German legal text but benchmark data on legal domain performance is sparse. Validate with a sample of 20 real Kanzlei documents before committing to the embedding model in Phase 4.
- **CalDAV conflict resolution in practice**: tsdav handles protocol-level sync but the business logic for conflict resolution (last-write-wins vs. user prompt) needs design decisions that depend on user feedback. CalDAV should start with export-only and add bidirectional in Phase 7 only if demand validates.
- **sepa.js maintenance status**: Last published ~3 years ago. SEPA pain.001.001.09 and pain.008.001.08 formats are stable ISO 20022 standards, so the library should still be correct. Monitor for regulatory changes before Phase 5 implementation.

## Sources

### Primary (HIGH confidence)
- BGB §§187-193 — gesetze-im-internet.de (deadline calculation statutory rules)
- BRAO §43a Abs. 7 — dejure.org (Fremdgeld legal obligation)
- BORA §4 — dejure.org (Anderkonto threshold requirement)
- RVG KostBRaeG 2025 — Anwaltsblatt (DAV official publication; 6% fee increase June 2025)
- BRAK AI Guidelines 2025 — brak.de (AI draft-only requirement)
- E-Rechnungspflicht — Anwaltsblatt + e-rechnung-bund.de (mandatory since 01.01.2025)
- Socket.IO + Next.js — socket.io official guide (custom server pattern)
- BullMQ — docs.bullmq.io (job queue patterns)
- ImapFlow — imapflow.com (IDLE behavior, API reference)
- Vercel AI SDK v4 — ai-sdk.dev (provider model, zod requirement)
- AI SDK v6 migration guide — ai-sdk.dev (breaking change: zod >= 3.25.76)
- Stirling-PDF — docs.stirlingpdf.com (REST API, Docker, OCR)
- OnlyOffice WOPI FAQ — api.onlyoffice.com (lock management, token expiry)
- Next.js multi-tenant guide — nextjs.org (path-based tenancy)
- Prisma pgvector discussion — GitHub (Unsupported type + $queryRaw pattern)
- DATEV Buchungsstapel format — conaktiv Handbuch (field limits, encoding)
- XRechnung FAQ — e-rechnung-bund.de (syntax, Leitweg-ID)
- EGVP Drittprodukte Anforderungen — egvp.justiz.de (OSCI protocol complexity)

### Secondary (MEDIUM confidence)
- RA-MICRO Posteingang Wiki — onlinehilfen.ra-micro.de (competitor email workflow)
- RA-MICRO RVG Berechnung Wiki — onlinehilfen.ra-micro.de (RVG implementation patterns)
- AnNoText document automation — wolterskluwer.com (competitor template patterns)
- ActaPort Mandantenportal — actaport.de (client portal as emerging differentiator)
- bea.expert API — bea.expert/api (REST API, ~40 functions, EUR 10/month/mailbox)
- tsdav — github.com/natelindev/tsdav (CalDAV TypeScript client)
- @e-invoice-eu/core — npm + GitHub (XRechnung/ZUGFeRD generation)
- ZUGFeRD/XRechnung comparison — finmatics.com (format confusion, PDF/A-3 requirement)
- pgvector HNSW performance — multiple sources (index requirement above 10k vectors)
- RAG chunking strategies — Weaviate blog + Stack Overflow blog (semantic vs fixed-size)
- OnlyOffice GitHub Issue #1884 — github.com (missing PutFile callback, real bug)

### Tertiary (LOW confidence)
- pgvector performance at scale — single blog post, needs benchmark validation
- German embedding model legal domain performance — inference from general multilingual model benchmarks, needs domain validation

---
*Research completed: 2026-02-24*
*Ready for roadmap: yes*
