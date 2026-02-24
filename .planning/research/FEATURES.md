# Feature Research: German Kanzleisoftware (Milestone 2 Features)

**Domain:** AI-First Legal Practice Management (Kanzleisoftware) -- Germany
**Researched:** 2026-02-24
**Confidence:** MEDIUM-HIGH (competitor analysis via public docs + official legal requirements verified)

## Context

This research covers features being **added** to an existing MVP that already has: case management CRUD, contact management, document management with OnlyOffice, calendar/deadlines basic CRUD, ticket system, AI drafts workspace, and basic Ollama LLM integration.

The German Kanzleisoftware market is dominated by RA-MICRO (70,000+ workstations, market leader), AnNoText (Wolters Kluwer, deep feature set), Advoware (SMB focus), and newer cloud entrants like ActaPort and KanzLaw. Open-source alternative j-lawyer.org exists but has limited financial features.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features every serious Kanzleisoftware must have. Missing these means the product cannot replace incumbent tools like RA-MICRO or Advoware.

| # | Feature | Why Expected | Complexity | Notes |
|---|---------|--------------|------------|-------|
| **EMAIL** | | | | |
| E1 | IMAP inbox with case assignment (Verakten) | Every competitor has this. RA-MICRO's entire "E-Workflow" centers on routing emails to cases. Lawyers receive 50-100+ emails/day that must land in the correct electronic file. | HIGH | IMAP IDLE for real-time. Must handle shared + per-user mailboxes. HTML rendering, attachments. |
| E2 | SMTP send from within the app | Cannot force lawyers to switch to external email client for sending. RA-MICRO, Advoware, AnNoText all have integrated send. | MEDIUM | Compose view with To/CC/BCC, rich text, file attachment from DMS, case linking. |
| E3 | Email-to-case assignment (Veraktung) | Core workflow: every email must be assignable to a case file. This IS the email feature's raison d'etre for law firms. | MEDIUM | One-click assign, auto-suggest case from sender/subject, save attachments to DMS. |
| **DOCUMENTS** | | | | |
| D1 | Document template system with placeholders | Every competitor has this. RA-MICRO, AnNoText, Advoware all auto-fill templates with case/contact data. Lawyers create 20-50 documents/day from templates. | MEDIUM | {{mandant.name}}, {{akte.aktenzeichen}}, {{gegner.name}}, etc. Use docxtemplater (already partially exists). |
| D2 | Letterhead (Briefkopf) management | Mandatory per BRAO -- law firm correspondence must include specific information (name, address, Fachanwaltsbezeichnung, Kammerzugehoerigkeit). Every competitor has letterhead auto-application. | MEDIUM | Logo + firm data configurable. Applied automatically to all outgoing documents. Editable in OnlyOffice. |
| D3 | PDF export with letterhead | Standard output format for court submissions, client correspondence. All competitors support this. | LOW | OnlyOffice can export PDF. Need to ensure letterhead is embedded. |
| **DEADLINES** | | | | |
| F1 | BGB deadline calculation (SS 187-193) | **Legal requirement.** Missing a deadline = malpractice. Every Kanzleisoftware calculates deadlines automatically. Fristenversaeumnis is the #1 cause of attorney liability claims. | HIGH | Ereignisfrist vs. Beginnfrist, weekend/holiday extension per SS 193 BGB. Must be 100% correct. |
| F2 | Holiday calendar per Bundesland | Deadlines shift based on state-specific holidays. SS 193 BGB requires Feiertag-aware calculation. Each Bundesland has different holidays. | LOW | Use `feiertagejs` npm package (4,891 weekly downloads, no deps, TypeScript). Default: NRW. |
| F3 | Pre-deadline reminders (Vorfristen) | Standard practice: 7 days, 3 days, 1 day before deadline. Required by insurance and bar association best practices. All competitors have this. | LOW | Configurable reminder intervals. Notification to responsible attorney + Sachbearbeiter. |
| **FINANCE** | | | | |
| FI1 | RVG fee calculation | Core billing mechanism for German attorneys. Cannot bill clients without RVG calculation. All competitors have this built-in. RA-MICRO has deep VV-number-based fee selection. | HIGH | Streitwert to Gebuehr mapping per SS 13 RVG table. VV numbers: 3100 (Verfahrensgebuehr, 1.3x), 3104 (Terminsgebuehr, 1.2x), 1000/1003 (Einigungsgebuehr, 1.0x), 7002 (Postpauschale), Nr. 1008 (Mehrvertretungszuschlag). Must track KostBRaeG 2025 changes (6% increase from June 2025). |
| FI2 | Invoice creation with PDF | Must generate proper Rechnungen with all legally required fields (SS 14 UStG). All competitors support this. | HIGH | Nummernkreis, atomare Vergabe, Rechnungsstatus-Flow (Entwurf -> Gestellt -> Bezahlt -> Storniert). |
| FI3 | Aktenkonto (case account) | Tracks all financial movements per case: fees, expenses, Fremdgeld, Auslagen. **Legally required** per SS 43a Abs. 7 BRAO for Fremdgeld tracking. All competitors have this. | HIGH | Einnahme/Ausgabe/Fremdgeld/Auslage bookings. Saldo calculation. Beleg linking to DMS documents. |
| FI4 | E-Rechnung (XRechnung + ZUGFeRD) | **Mandatory since 01.01.2025** for B2B receipt. Mandatory for sending from 2027 (transitional rules until end 2026 for paper). Courts require XRechnung. Companies prefer ZUGFeRD (hybrid PDF+XML). | HIGH | Use `@e-invoice-eu/core` or `node-zugferd` npm packages. Must support EN16931 standard. |
| FI5 | DATEV CSV export | **De facto standard** for tax advisor data exchange. Nearly every German business uses DATEV-format for Steuerberater handoff. All competitors support this. | MEDIUM | Buchungsstapel CSV format. Well-documented DATEV format specification. |
| **beA** | | | | |
| B1 | beA message display and basic management | **Legal obligation** per SS 31a BRAO: every attorney must maintain a beA postbox and check it. Integration in Kanzleisoftware eliminates manual portal login. RA-MICRO, AnNoText, Advoware all have this. | HIGH | Use bea.expert REST API (~40 functions, EUR 10/month per mailbox). PostboxOverview, GetMessage, FolderOverview. Requires local software token management + encryption handling. |
| **OCR/PDF** | | | | |
| O1 | Auto-OCR on PDF upload | Table stakes for any modern DMS. Scanned court documents must be searchable. RA-MICRO, AnNoText do this automatically. | MEDIUM | Stirling-PDF Docker service with Tesseract. Async queue with retries. Only OCR if PDF not already searchable. German language tessdata. |
| O2 | PDF preview in browser | Users must view documents without downloading. Standard in all competitors. | LOW | pdf.js viewer or similar. Navigation, zoom, download button. |

### Differentiators (Competitive Advantage)

Features that set AI-Lawyer apart from incumbents. These are the "why switch" reasons.

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| **AI AGENT** | | | | |
| AI1 | Proactive AI agent ("OpenClaw") that suggests actions | **Primary differentiator.** No incumbent has this. AnNoText Expert AI and Legal Twin are reactive (user asks, AI answers). OpenClaw should PROACTIVELY scan new emails/documents and suggest: "Frist erkannt", "Antwort-Entwurf erstellt", "Neuer Beteiligter erkannt". 78% of German lawyers now use AI (2026), but none have a proactive agent embedded in their Kanzleisoftware. | VERY HIGH | RAG pipeline, multi-provider LLM, document chunking/embedding, proactive scanning of incoming emails + documents. Must NEVER auto-send anything -- always drafts requiring human approval. |
| AI2 | Automatic deadline recognition from documents | Scans incoming Schriftsaetze/court letters, extracts deadlines, creates calendar drafts. No incumbent does this automatically. Gartner predicts 33% of enterprise software will have agentic AI by 2028 -- law firms are behind. | HIGH | NLP/LLM parsing of German legal documents. Pattern matching for "Frist von X Wochen", "bis zum DD.MM.YYYY", court summons dates. Always creates DRAFT entries (never auto-confirmed). |
| AI3 | Case summary with timeline + key facts | One-click case overview. Saves 15-30 min per case when attorney needs to catch up. AnNoText Expert AI claims "85% faster" task completion. | HIGH | RAG over all case documents. Extract parties, claims, dates, amounts. Generate structured summary. |
| AI4 | Document chat (per-case RAG) | Ask questions about documents within a case. "Was fordert der Gegner?" "Welche Fristen sind noch offen?" | HIGH | Embedding + retrieval per case. Vector store (pgvector already in stack). Context-aware responses. |
| AI5 | Global legal chat (cross-case RAG) | Cross-case knowledge: "Wie haben wir in aehnlichen Faellen argumentiert?" "Gibt es Praezedenzen in unseren Akten?" | VERY HIGH | Cross-case embedding search. Privacy boundaries per user role. Much larger context management challenge. |
| **CLIENT PORTAL** | | | | |
| CP1 | Mandantenportal with document sharing | ActaPort launched this with Silberfluss partnership. Most incumbents do NOT have this yet -- it is emerging as a differentiator. Clients expect digital interaction (not fax/mail). | HIGH | Separate auth flow (invitation link + password). Read-only document access. Secure messaging. Upload capability. |
| CP2 | Client self-service status view | Clients can see case status without calling the office. Reduces phone interruptions (major pain point per Keuthen AG research). | MEDIUM | Case status dashboard for clients. Limited to what attorney explicitly shares. |
| **FINANCE ADVANCED** | | | | |
| FI6 | SEPA payment file generation (pain.001 + pain.008) | Automates bank transfers and direct debits. Not all competitors have this -- many rely on manual banking. | MEDIUM | Use `sepa` or `sepa-xml` npm packages. Generate XML files for bank upload. |
| FI7 | Banking import (CSV + CAMT053) | Import bank statements, match to invoices/cases. Saves hours of manual reconciliation. Advanced feature -- RA-MICRO has it, smaller competitors often don't. | MEDIUM | Use `camt-parser` npm package for CAMT053 XML. CSV parser for bank-specific formats. Semi-automatic matching (suggest, human confirms). |
| FI8 | Mahnwesen (dunning process) | Automated payment reminders in stages (Mahnung 1, 2, 3). Reduces manual follow-up on unpaid invoices. | MEDIUM | Mahnstufen configuration. Auto-generate Mahn-PDFs from templates. Track per invoice. |
| **MESSAGING** | | | | |
| M1 | Case-bound internal threads | Replace scattered emails/Slack messages about cases. Context stays with the case. Not offered by most incumbents (they rely on external tools like Teams/Slack). | MEDIUM | Thread per case. @mentions. Notifications. Attachments. Link to documents in DMS. |
| **PDF TOOLS** | | | | |
| O3 | PDF merge, split, watermark, redact | Power-user tools that save time. Stirling-PDF provides all of these via API. Not all competitors offer in-app PDF manipulation. | MEDIUM | Stirling-PDF REST API. Expose key operations in UI: merge, split, reorder, rotate, compress, watermark, redact. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Explicitly decide NOT to build these.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Full FiBu (Finanzbuchhaltung) module | "We want everything in one system" | Enormously complex (GoBD compliance, Kontenrahmen, Bilanz). Every Kanzlei already has a Steuerberater using DATEV. Building FiBu is a multi-year effort that competes with DATEV, a billion-euro company. | DATEV CSV export covers the interface. Let Steuerberater handle FiBu in DATEV. |
| Bidirectional IMAP sync (flags/delete back to mailserver) | "Keep email client and Kanzleisoftware in sync" | Extremely fragile. IMAP flag sync across clients causes conflicts, data loss, race conditions. RA-MICRO does not do this either -- they import and manage within. | One-way import. Emails are COPIED into the system. Original stays on mailserver untouched. |
| beA live/direct integration (bypass bea.expert) | "No monthly API fees" | beA's native API requires JAVA Client Security, hardware token management, complex OSCI protocol. The bea.expert API abstracts all of this for EUR 10/month. Building native integration is months of work for marginal savings. | Use bea.expert REST API. EUR 10/month/mailbox is negligible vs development cost. |
| Native mobile app | "Lawyers want mobile access" | Doubles frontend codebase. Responsive web covers 90% of mobile use cases. React Native/Flutter = separate team/skillset. App store approval delays. | Responsive web design. PWA if needed later. |
| Full Zwangsvollstreckung module | "Complete legal workflow coverage" | Extremely specialized domain with its own forms, processes, timelines. Low-frequency for most law firms. | Defer to v2+. Focus on core mandate workflow first. |
| Real-time collaborative editing everywhere | "Google Docs for everything" | OnlyOffice already handles document collaboration. Extending real-time to templates, forms, case notes adds massive complexity (CRDT, conflict resolution) for marginal benefit. | OnlyOffice for document collaboration. Simple locking for other editable resources. |
| CalDAV bidirectional sync in v1 | "Sync with Google Calendar / Outlook" | CalDAV is notoriously flaky. Bidirectional sync = conflict resolution nightmares. Most Kanzleisoftware does NOT have this. | Export/subscribe (read-only CalDAV feed) first. Bidirectional only if demand proves real. |
| AI auto-send (emails, documents) | "Full automation" | **Absolute no-go.** BRAO professional duty requires attorney oversight. AI-generated content sent without review = malpractice risk + ethical violation. BRAK's 2025 AI guidelines explicitly warn against this. | AI creates DRAFTS only. Human reviews and explicitly approves every outgoing communication. |
| VoIP integration in core product | "Unified communications" | Telephony integration (SIP/VoIP) is a deep rabbit hole with hardware dependencies, carrier-specific quirks, echo cancellation, etc. Low value vs effort. | Simple Sipgate journal API import (just log calls). Actual VoIP stays in dedicated phone system. |

---

## Feature Dependencies

```
[F1] Deadline Calculation (BGB SS 187-193)
    +-- requires --> [F2] Holiday Calendar per Bundesland
    +-- enhances --> [F3] Pre-deadline Reminders
    +-- enhanced by --> [AI2] Auto Deadline Recognition

[E1] IMAP Inbox
    +-- requires --> [E3] Email-to-Case Assignment (core workflow)
    +-- enhanced by --> [E2] SMTP Send (compose from inbox)
    +-- enhanced by --> [AI1] Proactive AI (scan incoming emails)
    +-- enhanced by --> [AI2] Auto Deadline Recognition (from email attachments)

[D1] Document Templates
    +-- requires --> [D2] Letterhead Management (templates need letterhead)
    +-- enhanced by --> [D3] PDF Export (templates exported as PDF)
    +-- enhanced by --> [FI2] Invoice PDF (invoices use template+letterhead)

[FI1] RVG Calculation
    +-- feeds into --> [FI2] Invoice Creation
    +-- feeds into --> [FI3] Aktenkonto (calculated fees booked to case account)

[FI2] Invoice Creation
    +-- requires --> [D2] Letterhead (invoices need firm header)
    +-- requires --> [FI1] RVG Calculation (or manual fee entry)
    +-- enhanced by --> [FI4] E-Rechnung (XRechnung/ZUGFeRD export)
    +-- enhanced by --> [FI8] Mahnwesen (dunning unpaid invoices)

[FI3] Aktenkonto
    +-- enhanced by --> [FI7] Banking Import (auto-match payments)
    +-- enhanced by --> [FI5] DATEV Export (export bookings)

[B1] beA Integration
    +-- enhanced by --> [E3] Email-to-Case (beA messages treated like emails)
    +-- independent of --> email system (separate protocol via bea.expert API)

[O1] Auto-OCR
    +-- feeds into --> Meilisearch Full-Text Index (already exists)
    +-- enhanced by --> [AI1/AI4] AI features (OCR text enables AI to read scanned docs)

[CP1] Mandantenportal
    +-- requires --> existing auth system (invitation-based)
    +-- requires --> existing DMS (document sharing)
    +-- enhanced by --> [M1] Case Threads (client can message attorney)

[AI1] Proactive AI Agent
    +-- requires --> RAG pipeline (embeddings, chunking, vector search)
    +-- requires --> [O1] Auto-OCR (AI needs readable text)
    +-- enhanced by --> [E1] Email Inbox (AI scans incoming emails)
    +-- enhanced by --> [AI4] Document Chat (shared RAG infrastructure)

[M1] Internal Messaging (Case Threads)
    +-- independent module, but --
    +-- enhanced by --> existing case management (thread per case)
    +-- enhanced by --> existing DMS (link documents in messages)
```

### Dependency Notes

- **Deadline calculation (F1) is foundational:** It has zero external dependencies (only needs holiday data) and enables both manual and AI-driven deadline management. Build early.
- **Email (E1-E3) unlocks AI value:** The proactive AI agent becomes dramatically more useful when it can scan incoming emails. Email is both table stakes AND an AI enabler.
- **RVG (FI1) gates invoicing:** Cannot create proper invoices without fee calculation. And invoices gate the entire financial workflow (Aktenkonto, Mahnwesen, DATEV, E-Rechnung).
- **OCR (O1) gates AI on scanned documents:** Many court documents arrive as scanned PDFs. Without OCR, AI cannot read them. Build OCR before or alongside AI enhancements.
- **Letterhead (D2) gates templates AND invoices:** Both document templates and invoice PDFs need the firm letterhead. Build letterhead management early.

---

## MVP Definition (Milestone 2)

### Launch With (Phase 1 of Milestone 2)

Foundation features that unblock everything else:

- [x] **F1 + F2: Deadline calculation with holiday calendar** -- Zero malpractice tolerance. Highest legal risk if wrong. Low external dependencies. Build and test first.
- [x] **D1 + D2 + D3: Templates + Letterhead + PDF export** -- Unblocks invoicing and daily document work. Already partially exists (docxtemplater).
- [x] **O1 + O2: Auto-OCR + PDF preview** -- Unblocks AI features on scanned docs. Stirling-PDF Docker is straightforward.
- [x] **E1 + E2 + E3: Full email client** -- Table stakes. Primary daily workflow for every law firm employee. Highest user-facing impact.

### Add After Foundation (Phase 2 of Milestone 2)

Features that build on the foundation:

- [ ] **FI1 + FI2 + FI3: RVG + Invoicing + Aktenkonto** -- Complex but critical. Needs letterhead (D2) to be ready. Trigger: templates working, letterhead configured.
- [ ] **FI4 + FI5: E-Rechnung + DATEV export** -- Legal requirement (E-Rechnung) and practical necessity (DATEV). Trigger: invoicing working.
- [ ] **B1: beA interface** -- Legal obligation but can be deferred slightly because lawyers can still use beA web portal directly. Trigger: email system stable (similar UX patterns).
- [ ] **AI1 + AI2 + AI4: Proactive AI + deadline recognition + document chat** -- Primary differentiator. Needs OCR + email to be functional. Trigger: email and OCR working.

### Add After Validation (Phase 3 of Milestone 2)

Features that extend the platform:

- [ ] **CP1 + CP2: Mandantenportal** -- Differentiator but not blocking daily work. Trigger: core features stable, client demand validated.
- [ ] **M1: Internal messaging** -- Nice to have. Most firms currently use Teams/Slack/Email. Trigger: enough users that internal coordination becomes a pain point.
- [ ] **FI6 + FI7 + FI8: SEPA + Banking import + Mahnwesen** -- Advanced financial features. Trigger: basic invoicing heavily used.
- [ ] **AI3 + AI5: Case summary + global legal chat** -- Advanced AI. Trigger: per-case AI validated and trusted.
- [ ] **O3: Advanced PDF tools** -- Power user features. Trigger: OCR stable, user requests for merge/split.

### Future Consideration (v2+)

- [ ] **CalDAV bidirectional sync** -- Only if client demand proves real.
- [ ] **Zwangsvollstreckung module** -- Specialized, low priority.
- [ ] **VoIP integration** -- Sipgate journal import only.
- [ ] **Falldatenblaetter** -- Practice-area-specific case data sheets. Valuable but each Rechtsgebiet is a separate effort.

---

## Feature Prioritization Matrix

| Feature | User Value | Impl. Cost | Legal Requirement | Priority |
|---------|------------|------------|-------------------|----------|
| F1: Deadline calc (BGB) | CRITICAL | HIGH | YES (malpractice prevention) | **P0** |
| F2: Holiday calendar | HIGH | LOW | YES (part of F1) | **P0** |
| F3: Pre-deadline reminders | HIGH | LOW | Best practice | **P1** |
| E1: IMAP inbox | CRITICAL | HIGH | No, but table stakes | **P1** |
| E2: SMTP send | HIGH | MEDIUM | No, but table stakes | **P1** |
| E3: Email-to-case | CRITICAL | MEDIUM | No, but table stakes | **P1** |
| D1: Document templates | HIGH | MEDIUM | No, but table stakes | **P1** |
| D2: Letterhead management | HIGH | MEDIUM | YES (BRAO) | **P1** |
| D3: PDF export w/ letterhead | HIGH | LOW | Practical necessity | **P1** |
| O1: Auto-OCR | HIGH | MEDIUM | No, but enables AI | **P1** |
| O2: PDF preview | MEDIUM | LOW | No | **P1** |
| FI1: RVG calculation | CRITICAL | HIGH | YES (billing basis) | **P1** |
| FI2: Invoice creation | CRITICAL | HIGH | YES (SS 14 UStG) | **P1** |
| FI3: Aktenkonto | HIGH | HIGH | YES (SS 43a BRAO for Fremdgeld) | **P1** |
| FI4: E-Rechnung | HIGH | HIGH | YES (since 01.01.2025) | **P1** |
| FI5: DATEV export | HIGH | MEDIUM | De facto standard | **P2** |
| B1: beA integration | HIGH | HIGH | YES (SS 31a BRAO) | **P2** |
| AI1: Proactive AI agent | VERY HIGH | VERY HIGH | No (differentiator) | **P2** |
| AI2: Auto deadline recognition | HIGH | HIGH | No (differentiator) | **P2** |
| AI4: Document chat | HIGH | HIGH | No (differentiator) | **P2** |
| FI6: SEPA generation | MEDIUM | MEDIUM | No | **P2** |
| FI7: Banking import | MEDIUM | MEDIUM | No | **P2** |
| FI8: Mahnwesen | MEDIUM | MEDIUM | No | **P3** |
| CP1: Mandantenportal | MEDIUM | HIGH | No (differentiator) | **P3** |
| CP2: Client status view | MEDIUM | MEDIUM | No | **P3** |
| M1: Case threads | MEDIUM | MEDIUM | No | **P3** |
| AI3: Case summary | HIGH | HIGH | No (differentiator) | **P3** |
| AI5: Global legal chat | HIGH | VERY HIGH | No (differentiator) | **P3** |
| O3: Advanced PDF tools | LOW | MEDIUM | No | **P3** |

**Priority key:**
- **P0:** Legal requirement, build first, zero tolerance for errors
- **P1:** Must have for this milestone, table stakes
- **P2:** Should have, competitive advantage, add when P1 stable
- **P3:** Nice to have, defer to later phases within milestone

---

## Competitor Feature Analysis

| Feature | RA-MICRO | AnNoText (Wolters Kluwer) | Advoware | ActaPort (Cloud) | j-lawyer.org (OSS) | Our Approach |
|---------|----------|---------------------------|----------|-------------------|---------------------|--------------|
| Email integration | Full E-Workflow (Posteingang/Postausgang), auto-sort, case assignment | Integrated email with case assignment | Email integration with case linking | Basic email | Basic email via plugin | IMAP IDLE + SMTP, shared + per-user mailboxes, Veraktung |
| Document templates | Deep integration, RA-MICRO Designer, auto-fill from case/address data | Document automation with AI-assisted generation | Template system with placeholders | Template system | LibreOffice templates | docxtemplater + OnlyOffice, placeholder auto-fill, folder-based template organization |
| Letterhead | RA-MICRO Briefkopf-Designer, auto-application | Integrated | Integrated | Integrated | Manual | OnlyOffice-editable letterhead, auto-applied to templates + invoices |
| Deadline calculation | Full BGB SS 187-193, per-Bundesland holidays, Vorfrist | Full calculation | Full calculation | Basic | Basic | BGB-compliant calc with feiertagejs, configurable Vorfrist intervals |
| RVG calculation | Deep VV-number selection, multi-table (pre/post KostBRaeG), XRechnung | Full RVG with automation | Full RVG, auto-updated per KostBRaeG | Basic | Basic | Full RVG table with VV numbers, KostBRaeG 2025 rates, Streitwert-to-fee mapping |
| Aktenkonto | Full (Einnahmen/Ausgaben/Fremdgeld, FiBu I + II integration) | Full | Full | Basic | Limited | Bookings per case, Fremdgeld tracking, Beleg linking |
| E-Rechnung | XRechnung + ZUGFeRD (since 2025 updates) | XRechnung (ZUGFeRD in progress) | Supported | Not yet | No | XRechnung + ZUGFeRD via @e-invoice-eu/core or node-zugferd |
| DATEV export | Full integration | Full integration | Full integration | Limited | No | CSV Buchungsstapel export |
| beA integration | Full (direct, no third-party API) | Full (integrated postbox) | Full (since v5) | Basic | Plugin | bea.expert REST API (EUR 10/month/mailbox). ~40 functions. |
| Client portal | WebAkte (limited) | No native portal | No | Yes (with Silberfluss, new 2025) | No | Built-in portal with invitation auth, document sharing, secure messaging |
| AI features | Basic (no proactive agent) | Expert AI (reactive, 85% faster claims) | Legal Twin (reactive) | JUPUS integration (intake automation) | None | **Proactive AI agent** (OpenClaw): auto-scans, suggests actions, creates drafts. Primary differentiator. |
| Internal messaging | Postkorb (task routing, not chat) | No dedicated chat | No | No | No | Case-bound threads + general channels, @mentions, document linking |
| OCR/PDF tools | Auto-OCR on scan | Integrated | Limited | Limited | No | Stirling-PDF Docker: auto-OCR + merge/split/watermark/redact |
| SEPA | GiroCode on invoices | Supported | Supported | No | No | pain.001 + pain.008 XML generation via sepa.js |
| Banking import | Yes | Yes | Yes | No | No | CSV + CAMT053 import, semi-automatic case matching |

---

## Key Findings by Feature Area

### 1. Email Client (IMAP + SMTP)

**Confidence: HIGH** (RA-MICRO docs verified, competitor pattern clear)

Every serious Kanzleisoftware treats the email inbox as the primary workflow entry point. RA-MICRO's "Posteingang" is the central hub where all electronic correspondence (email, fax, scan, beA) arrives, gets a case number assigned, and routes to the responsible person's "Postkorb."

**Critical capability:** "Veraktung" (case assignment) is THE feature. An email without a case assignment is useless in a law firm. Auto-suggestion of the case based on sender/subject/content should be a day-one feature.

**Architecture note:** Shared Kanzlei-Postfach + per-user mailboxes is standard (confirmed by PROJECT.md). IMAP IDLE for real-time is the right call -- polling creates unacceptable delays for incoming court deadlines.

### 2. Proactive AI Agent ("KI-Rechtsanwaltsfachangestellte")

**Confidence: MEDIUM** (this is genuinely novel; no competitor has this exact concept)

Current AI in German Kanzleisoftware is **reactive**: AnNoText Expert AI, Beck-Noxtua, Legal Twin, BEAMON AI -- all require the user to ask a question or trigger an action. Wolters Kluwer predicts "agentische KI" will transform legal workflows, and Gartner says 33% of enterprise software will have agentic AI by 2028.

**What OpenClaw should do (in priority order):**
1. **Deadline detection** from incoming documents/emails -> create calendar DRAFT
2. **Party recognition** from documents -> suggest adding Beteiligte to case
3. **Response drafts** for routine correspondence (Empfangsbekenntnis, Fristverlängerung)
4. **Case status alerts** ("Frist in 3 Tagen, noch kein Schriftsatz erstellt")
5. **Document classification** (incoming document -> suggest case + document type)
6. **Per-case Q&A** (RAG over case documents)
7. **Cross-case knowledge** (find similar cases, precedent arguments)

**BRAK AI guidelines (2025):** AI may be used but attorney must always maintain oversight. AI-generated content must never be auto-sent. This aligns perfectly with the "drafts only" approach.

### 3. Document Template System with Letterhead

**Confidence: HIGH** (well-established pattern across all competitors)

This is thoroughly solved domain. All competitors use placeholder-based templates. RA-MICRO uses a proprietary Briefkopf-Designer. AnNoText has document automation. Key placeholders needed: case data (Aktenzeichen, Rechtsgebiet, Streitwert), contact data (Name, Adresse, Anrede), firm data (Kanzleiname, Adresse, Bankverbindung, Fachanwaltsbezeichnungen).

The existing docxtemplater integration is the right approach. OnlyOffice for letterhead editing avoids building a custom designer.

### 4. Financial Features (RVG, Invoicing, Aktenkonto, DATEV, SEPA, E-Rechnung)

**Confidence: HIGH** (legal requirements verified, RVG structure confirmed)

This is the largest and most complex feature cluster. Key facts:

- **RVG table (SS 13 RVG):** Progressive fee table. Streitwert brackets with base fees, multiplied by VV-specific rates (1.3x Verfahrensgebuehr, 1.2x Terminsgebuehr, etc.). Must handle KostBRaeG 2025 changes (6% increase, effective June 2025). The table has ~100 Streitwert brackets.
- **E-Rechnung:** Mandatory receipt since 01.01.2025. Sending obligation phases in. XRechnung = pure XML (courts/government), ZUGFeRD = hybrid PDF+XML (B2B). Both must be supported.
- **Aktenkonto:** Legal requirement for Fremdgeld tracking (SS 43a Abs. 7 BRAO). Mishandling Fremdgeld can lead to disbarment (SS 113, 114 BRAO). This is not optional.
- **DATEV:** CSV Buchungsstapel format is the universal exchange format with tax advisors. Well-documented specification.
- **SEPA:** `sepa.js` npm package handles pain.001 (credit transfers) and pain.008 (direct debits).

### 5. Deadline Calculation (BGB SS 187-193)

**Confidence: HIGH** (statutory rules, verified with legal sources)

The calculation rules are deterministic and codifiable:

- **SS 187 I BGB (Ereignisfrist):** Day of event does not count. Most common type.
- **SS 187 II BGB (Beginnfrist):** Day of beginning counts. Rare.
- **SS 188 BGB:** End date calculation (days, weeks, months, years).
- **SS 193 BGB:** If deadline falls on Saturday, Sunday, or public holiday -> extends to next Werktag.
- **SS 222 ZPO:** Court deadlines follow BGB rules.

`feiertagejs` npm package (TypeScript, no dependencies, 4,891 weekly downloads) provides per-Bundesland holiday data.

**CRITICAL:** This must be 100% correct. Fristenversaeumnis is the #1 cause of attorney malpractice claims in Germany. Unit tests for every edge case.

### 6. Client Portal (Mandantenportal)

**Confidence: MEDIUM** (emerging feature, ActaPort just launched theirs)

This is NOT yet table stakes -- most incumbents (RA-MICRO, AnNoText, Advoware) do NOT have native client portals. ActaPort launched one in partnership with Silberfluss in 2025. jur|nodes offers one for Steuerberater.

Building a Mandantenportal is a differentiator, not a requirement. But it is becoming expected -- clients increasingly want digital self-service. The proposed approach (invitation link + password, document viewing, secure messaging, status display) is sound and matches what ActaPort offers.

### 7. Internal Messaging

**Confidence: MEDIUM** (low priority based on market evidence)

No major Kanzleisoftware has integrated chat. RA-MICRO has "Postkorb" (task/message routing), but it is a task queue, not a chat system. Most firms use Microsoft Teams, Slack, or email for internal communication.

Building case-bound discussion threads is a genuinely useful differentiator (context stays with the case), but it is not blocking daily work. Prioritize lower than email and finance.

### 8. beA Integration

**Confidence: HIGH** (bea.expert API documented, pricing confirmed)

The bea.expert REST API is the pragmatic choice. It provides ~40 functions, abstracts away the complex OSCI/JAVA/hardware-token infrastructure of native beA, and costs EUR 10/month per attorney mailbox. A JavaScript implementation exists on GitHub (though it was archived in May 2025 -- the API itself remains active).

Key functions needed: PostboxOverview, GetMessage, SendMessage, eEBanswer (electronic acknowledgment of receipt), FolderOverview. Integration requires managing software tokens locally and handling message encryption/decryption.

### 9. OCR/PDF Pipeline

**Confidence: HIGH** (Stirling-PDF well-documented, Docker-ready)

Stirling-PDF with Tesseract OCR is the right choice for self-hosted deployment. Three Docker image variants (Fat, Standard, Ultra-Lite). The Fat image includes OCR support with Tesseract. German language tessdata must be included.

Pipeline: Upload -> check if already searchable -> if not, queue OCR job -> store result -> index in Meilisearch. The async queue with retries is essential because OCR can fail on corrupted PDFs.

---

## Sources

### Official Legal Sources (HIGH confidence)
- [SS 187-193 BGB via gesetze-im-internet.de](https://www.gesetze-im-internet.de/bgb/__187.html)
- [SS 43a BRAO (Fremdgeld obligation)](https://dejure.org/gesetze/BORA/4.html)
- [E-Rechnungspflicht - Anwaltsblatt](https://anwaltsblatt.anwaltverein.de/de/themen/kanzlei-praxis/e-rechnungspflicht)
- [RVG KostBRaeG 2025 - Anwaltsblatt](https://anwaltsblatt.anwaltverein.de/de/themen/recht-gesetz/rvg-kostbraeg-2025)
- [BRAK AI Guidelines 2025](https://www.brak.de/newsroom/newsletter/nachrichten-aus-berlin/2025/ausgabe-1-2025-v-812025/kuenstliche-intelligenz-in-anwaltskanzleien-brak-veroeffentlicht-leitfaden/)

### Competitor Documentation (MEDIUM-HIGH confidence)
- [RA-MICRO Posteingang Wiki](https://onlinehilfen.ra-micro.de/index.php/Posteingang)
- [RA-MICRO RVG Berechnung Wiki](https://onlinehilfen.ra-micro.de/index.php/RVG_Berechnung)
- [RA-MICRO Briefkoepfe Wiki](https://onlinehilfen.ra-micro.de/index.php/Briefk%C3%B6pfe_und_Aktenvorbl%C3%A4tter)
- [AnNoText beA Integration](https://www.wolterskluwer.com/de-de/solutions/annotext/mandatsmanagement/bea-kommunikation)
- [AnNoText Document Automation](https://www.wolterskluwer.com/de-de/solutions/annotext/mandatsmanagement/document-automation)
- [ActaPort Mandantenportal](https://www.actaport.de/update/actaport-und-silberfluss-ver%C3%B6ffentlichen-das-mandantenportal)
- [j-lawyer.org](https://www.j-lawyer.org/)

### Technical/API Sources (MEDIUM-HIGH confidence)
- [bea.expert API](https://bea.expert/api/) -- REST API, ~40 functions, EUR 10/month/mailbox
- [bea.expert JavaScript API (archived)](https://github.com/beaexpert/beA-API-Javascript)
- [Stirling-PDF Docker docs](https://docs.stirlingpdf.com/Installation/Docker%20Install/)
- [Stirling-PDF OCR docs](https://docs.stirlingpdf.com/Configuration/OCR/)
- [feiertagejs npm](https://www.npmjs.com/package/feiertagejs) -- German holidays per Bundesland
- [sepa.js npm](https://www.npmjs.com/package/sepa) -- SEPA XML generation
- [node-zugferd GitHub](https://github.com/jslno/node-zugferd) -- ZUGFeRD PDF generation
- [@e-invoice-eu/core npm](https://www.npmjs.com/package/@e-invoice-eu/core) -- XRechnung + ZUGFeRD
- [camt-parser GitHub](https://github.com/oroce/camt-parser) -- CAMT053 bank statement parsing
- [RVG Gebuehrentabelle 2025](https://www.gebuehren-portal.de/gebuehrentabelle)
- [RVG Fristenrechner](https://www.gebuehren-portal.de/fristenrechner)

### Market Analysis (MEDIUM confidence)
- [Kanzleisoftware Vergleich 2025 - meetergo](https://meetergo.com/blog/juristische-software)
- [KI Tools fuer Kanzleien 2026 - legal-tech-verzeichnis](https://legal-tech-verzeichnis.de/fachartikel/top-ki-tools-fuer-kanzleien-2026/)
- [Wolters Kluwer KI 2026 Outlook](https://www.wolterskluwer.com/de-de/news/ki-auf-dem-rechtsmarkt-2026)
- [Kanzlei-Software-Check Datengrundlage - Anwaltsblatt](https://anwaltsblatt.anwaltverein.de/de/apps/kanzlei-software-check/datengrundlage)
- [Legalvisio interne Kommunikation](https://www.legalvisio.de/digitalisierung-kanzlei/interne-kommunikation/)

---
*Feature research for: AI-First Kanzleisoftware (German Legal Practice Management)*
*Researched: 2026-02-24*
