# Feature Landscape

**Domain:** AI-first Kanzleisoftware (v0.8 Intelligence & Tools)
**Researched:** 2026-03-06
**Overall confidence:** HIGH (builds on existing patterns, established APIs, verified endpoints)

---

## Table Stakes

Features users expect for these modules. Missing = product feels incomplete.

### BI-Dashboard

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| KPI-Kacheln (Offene Akten, Umsatz, Fristenlage, Helena-Nutzung) | Every practice management tool shows headline KPIs at a glance | Low | Existing `GlassKpiCard`, Prisma aggregates | Already have 4 KPIs on dashboard page -- extend with financial + Helena metrics |
| Trend-Charts (Akten-Neuzugang, Umsatz-Monat, Fristenerfuellung) | Static numbers without trends are meaningless for decision-making | Med | Existing `Recharts 3.7`, existing `backlog-trend-chart.tsx` pattern | Reuse LineChart/AreaChart pattern from team-dashboard |
| Zeitraum-Filter (Monat, Quartal, Jahr, Custom) | Users need to scope KPIs to relevant timeframes | Low | Date-fns (already installed) | Filterbar component with preset ranges + custom DateRangePicker |
| Verantwortlicher-Filter | Anwalt needs to see own vs. team vs. kanzlei-wide KPIs | Low | Existing `buildAkteAccessFilter`, User select | Dropdown with "Alle" + user list |
| Sachgebiet-Filter | Practice areas have different dynamics, mixing them hides insight | Low | Existing Sachgebiet enum | Multi-select chips |
| Month-over-Month Delta (arrows + percentage) | Context for whether a number is good or bad | Low | Existing `deltaPercent()` helper in team-dashboard export | Green/red delta badges on each KPI card |

### Helena Intelligence

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Falldaten Auto-Fill from Documents | Core intelligence value: OCR/RAG extracts structured data from uploads | High | Existing RAG pipeline, `generateObject` + Zod, Falldatenblaetter schema | Helena reads document via `read_dokumente_detail`, maps to FalddatenFeld keys via structured extraction |
| Fallzusammenfassung (Timeline + Key Facts) | Already 80% built in `memory-service.ts`; users need a visible, printable version | Med | Existing `HelenaMemoryContent` with summary/keyEvents/risks/proceduralStatus | Render memory-service output as UI component in Akte detail -- timeline view + key facts cards |
| Globaler aktenuebergreifender KI-Chat | Users want to ask "In welchen Akten geht es um Kuendigung?" without switching Akte | Med | Existing `ChatLayout` with `crossAkte` state, `search_alle_akten` tool already exists | ChatLayout already has `crossAkte` mode -- needs dedicated landing page `/ki` and better multi-Akte result rendering |
| Template-Vorschlaege (Falldatenblatt-Empfehlung) | When creating Akte, suggest best-fit template based on Sachgebiet + Rubrum | Low | Existing `FalddatenTemplate` model with sachgebiet index | Simple query: match Sachgebiet + optional text similarity on name/beschreibung |

### PDF-Tools

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Merge PDFs | Lawyers constantly combine filings + exhibits into one document | Low | Stirling-PDF `POST /api/v1/general/merge-pdfs` already running in Docker | Multi-file selection from DMS + order drag |
| Split PDF | Extract specific pages from large court filings | Low | Stirling-PDF `POST /api/v1/general/split-pages` | Page range input (e.g., "1-3,7,10-15") |
| Rotate Pages | Scanned documents often have wrong orientation | Low | Stirling-PDF `POST /api/v1/general/rotate-pdf` | 90/180/270 degree rotation per page or all pages |
| Compress PDF | Large scans from courts eat storage + slow uploads | Low | Stirling-PDF `POST /api/v1/misc/compress-pdf` | Quality slider (web/print/minimal) |

### CalDAV-Sync

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Outbound sync (Fristen/Termine to external calendar) | Lawyers live in Google Calendar / Outlook; duplicate entry = missed deadlines | High | `tsdav` npm package, KalenderEintrag model | iCalendar (RFC 5545) event generation from KalenderEintrag |
| Inbound sync (external events visible in Kanzleisoftware) | Need to see external appointments when scheduling | High | CalDAV REPORT/sync-token polling | BullMQ cron job for periodic pull |
| Multi-provider support (Google, Apple iCloud, Outlook) | Each lawyer uses a different calendar provider | Med | `tsdav` supports Google+Apple; Outlook needs CalDAV or EWS fallback | Google via OAuth2, Apple via app-specific password, Outlook via CalDAV (not all plans) |

### CSV/XLSX Export

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Akten-Liste Export | Accountants, compliance, yearly review -- need tabular Akten data | Low | New: `exceljs` for XLSX, existing CSV pattern from team-dashboard | Columns: Aktenzeichen, Rubrum, Status, Sachgebiet, Anwalt, Erstellt |
| Kontakte Export | Mail merge, CRM migration, Christmas card lists | Low | Same exceljs pattern | Columns: Name, Firma, Adresse, Telefon, E-Mail, Typ |
| Finanzdaten Export | Steuerberater needs billing summaries beyond DATEV | Low | Same pattern | Rechnungen with Aktenzeichen, Betrag, Status, Datum |
| BI-Dashboard Reports Export | Download the dashboard view as spreadsheet / PDF | Med | Aggregate same queries from BI-Dashboard API | Reuse existing `pdf-lib` pattern from team-dashboard export for PDF, `exceljs` for XLSX |

---

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Helena Falddaten Auto-Fill with Confidence Scores | Show per-field confidence (HIGH/MED/LOW) so lawyer knows what to verify | Med | `generateObject` schema extension with confidence fields | Unique: no legal tool does LLM-backed form filling with transparency |
| Fallzusammenfassung as Printable Brief | One-click PDF of case summary for court prep / client meeting | Low | Existing `pdf-lib`, existing `HelenaMemoryContent` | Lawyers print case summaries before hearings |
| PDF Watermark with Kanzlei-Branding | Auto-stamp "ENTWURF" or firm logo on all outgoing drafts | Low | Stirling-PDF `POST /api/v1/security/add-watermark`, existing Kanzlei model | Professional touch that saves manual work |
| PDF Redact (Auto-Redact PII) | DSGVO compliance -- auto-detect and black-out PII before sharing | Med | Stirling-PDF `POST /api/v1/security/auto-redact` | Leverage existing NER pipeline knowledge for custom redaction patterns |
| Page Reorder via Drag-and-Drop | Visual page rearrangement before filing | Med | Stirling-PDF `POST /api/v1/general/rearrange-pages`, `react-pdf` thumbnails | Needs thumbnail rendering for DnD interface |
| BI KPI: Helena Adoption Metrics | Track Helena usage per user/Akte -- conversations, drafts accepted/rejected, scan alerts | Low | Existing AiConversation, HelenaDraft, HelenaAlert models | Unique metric category for AI-assisted law firms |
| BI KPI: Frist Compliance Rate | % of deadlines completed before due date vs. overdue | Low | KalenderEintrag.datum vs. erledigtAm comparison | Critical legal metric, not available in most competing tools |
| CalDAV Conflict Detection | When syncing inbound, detect scheduling conflicts with existing Fristen/Termine | Med | Cross-reference KalenderEintrag with incoming CalDAV events | Prevents double-booking of court dates |
| Global KI-Chat with Multi-Akte Context Window | Helena references multiple Akten in a single answer, showing cross-references | High | Extend search_alle_akten to inject multiple Akte contexts into prompt | Competitive edge: no legal tool does cross-case AI analysis |

---

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time collaborative PDF editing | OnlyOffice handles DOCX collaboration; PDF editing = scope explosion | Use Stirling-PDF for batch operations, OnlyOffice for editing |
| BI Dashboard with custom query builder | Power BI-level flexibility = massive complexity for 5-person firm | Pre-built KPI cards with filter dropdowns; export raw data for custom analysis |
| Auto-sync CalDAV every minute | Too aggressive, rate limits, battery drain for mobile calendar apps | BullMQ cron every 15 minutes; manual sync button for immediate refresh |
| Helena auto-filling Falddaten without review | BRAK 2025 / BRAO 43: AI output must be ENTWURF | Show suggestions as pre-filled form with "accept" per field -- never auto-save |
| Two-way CalDAV sync for Fristen (allow external deletion) | Externally deleted Frist = missed deadline = malpractice risk | Sync Fristen as read-only external events; only Termine are bidirectional |
| PDF annotation / sticky notes | OnlyOffice already provides commenting on DOCX | PDF-Tools module is for batch operations, not interactive editing |
| XLSX import (reverse of export) | Import validation for legal data = huge complexity, rare use case | Existing CSV import for Kontakte covers the main import need |
| BI Dashboard email scheduling | Automated report emails add complexity; team is 5 people in same office | Manual export + download covers the need |

---

## Feature Dependencies

```
BI-Dashboard API endpoints --> BI-Dashboard UI (KPI cards + charts)
BI-Dashboard API endpoints --> CSV/XLSX Export (same data queries)
BI-Dashboard UI --> Zeitraum-Filter component (shared filter bar)

Falddaten Auto-Fill --> Existing RAG pipeline + read_dokumente_detail tool
Falddaten Auto-Fill --> Existing FalddatenTemplate schema (8 field types)
Fallzusammenfassung UI --> Existing HelenaMemoryContent (memory-service.ts)
Globaler KI-Chat --> Existing ChatLayout with crossAkte mode
Globaler KI-Chat --> Existing search_alle_akten tool
Template-Vorschlaege --> Existing FalddatenTemplate model

PDF-Tools API layer --> Existing stirling-client.ts (extend with new methods)
PDF-Tools UI --> Existing DMS file selection patterns
PDF Merge --> react-pdf (existing) for preview thumbnails

CalDAV-Sync --> New: tsdav npm package
CalDAV-Sync --> Existing KalenderEintrag model (Frist, Termin, Wiedervorlage)
CalDAV-Sync --> New: CalDAV account settings in Prisma (CalDavAccount model)
CalDAV-Sync --> BullMQ cron job (existing pattern from scanner/fristen-reminder)

CSV/XLSX Export --> New: exceljs npm package
CSV/XLSX Export --> BI-Dashboard API (shared aggregate queries)
CSV/XLSX Export --> Existing team-dashboard export pattern (PDF via pdf-lib, CSV via TextEncoder)
```

---

## MVP Recommendation

### Phase 1: BI-Dashboard + Export (foundation, immediate value)

Prioritize:
1. **BI-Dashboard KPI API** -- aggregate queries for all KPI categories (Akten, Finanzen, Fristen, Helena)
2. **BI-Dashboard UI** -- GlassKpiCard grid + Recharts trend charts with filter bar
3. **CSV/XLSX Export** -- exceljs-based export for Akten, Kontakte, Finanzen, BI reports

**Rationale:** Dashboard API queries are reused by export. Building them together avoids duplicate work. Immediate value for the law firm's monthly reporting. Low risk because all patterns (GlassKpiCard, Recharts, Prisma aggregates, pdf-lib exports) already exist in codebase.

### Phase 2: PDF-Tools (quick wins, Stirling-PDF already running)

Prioritize:
1. **Stirling-PDF client extensions** -- merge, split, rotate, compress endpoints in `stirling-client.ts`
2. **PDF-Tools UI page** -- file picker from DMS, operation selection, download result
3. **Watermark + Redact** -- add ENTWURF / Kanzlei branding, auto-redact PII

**Rationale:** Stirling-PDF sidecar is already healthy in Docker Compose (`stirlingtools/stirling-pdf:latest-fat`). Client pattern (`stirling-client.ts`) is established with 3 existing methods. Each operation is a thin REST wrapper. Quick wins.

### Phase 3: Helena Intelligence (builds on existing infrastructure)

Prioritize:
1. **Falddaten Auto-Fill** -- Helena extracts structured data from documents into Falddatenblatt fields with confidence scores
2. **Fallzusammenfassung UI** -- render existing HelenaMemoryContent as timeline + key facts in Akte detail
3. **Globaler KI-Chat** -- promote existing crossAkte mode to dedicated `/ki` page
4. **Template-Vorschlaege** -- simple Sachgebiet-based matching on Akte creation

**Rationale:** Memory-service and Falddatenblaetter already exist. Auto-fill is the hardest piece (LLM structured extraction + confidence scoring). Group with other Helena work for context continuity.

### Phase 4: CalDAV-Sync (highest complexity, most unknowns)

Defer to last because:
- Requires new npm package (`tsdav`) and new Prisma model
- OAuth2 setup for Google Calendar (redirect flow, token refresh)
- Bidirectional sync is inherently complex (conflict resolution, deleted event handling)
- Frist safety constraints (read-only external, bidirectional only for Termine)
- Needs thorough testing across 3 providers (Google confirmed, Apple confirmed, Outlook uncertain)

---

## Detailed KPI Categories for BI-Dashboard

Based on legal practice management best practices (Clio 62 KPIs reference) and existing data models:

### Akten-KPIs
| KPI | Calculation | Source |
|-----|-------------|--------|
| Offene Akten | `COUNT(Akte WHERE status = OFFEN)` | Existing dashboard query |
| Neue Akten (Zeitraum) | `COUNT(Akte WHERE erstellt IN range)` | Akte.erstellt |
| Akten pro Sachgebiet | `GROUP BY sachgebiet, COUNT(*)` | Akte.sachgebiet |
| Akten pro Anwalt | `GROUP BY anwaltId, COUNT(*)` | Akte.anwaltId |
| Durchschnittliche Laufzeit | `AVG(archiviert - erstellt)` for archived Akten | Akte.erstellt, Akte.status |

### Finanz-KPIs
| KPI | Calculation | Source |
|-----|-------------|--------|
| Umsatz (Zeitraum) | `SUM(Rechnung.betragNetto WHERE date IN range)` | Existing billing delta pattern |
| Offene Forderungen | `SUM(Rechnung.betragNetto WHERE status = OFFEN)` | Rechnung.status |
| Durchschnittlicher Rechnungsbetrag | `AVG(Rechnung.betragNetto)` | Rechnung |
| Zahlungsquote | `COUNT(BEZAHLT) / COUNT(ALL) * 100` | Rechnung.status |
| Umsatz pro Anwalt | `GROUP BY akte.anwaltId, SUM(betragNetto)` | Rechnung + Akte join |
| Zeiterfassung (Stunden) | `SUM(Zeiterfassung.dauer)` grouped by Zeitraum | Zeiterfassung.dauer |

### Fristen-KPIs
| KPI | Calculation | Source |
|-----|-------------|--------|
| Offene Fristen | `COUNT(KalenderEintrag WHERE typ=FRIST AND erledigt=false)` | Existing dashboard query |
| Ueberfaellige Fristen | `COUNT(WHERE datum < NOW AND erledigt=false)` | Existing dashboard query |
| Frist-Compliance-Rate | `COUNT(erledigtAm <= datum) / COUNT(erledigt=true) * 100` | KalenderEintrag |
| Notfristen aktiv | `COUNT(WHERE istNotfrist=true AND erledigt=false)` | KalenderEintrag.istNotfrist |

### Helena-KPIs
| KPI | Calculation | Source |
|-----|-------------|--------|
| Gespraeche (Zeitraum) | `COUNT(AiConversation WHERE created IN range)` | AiConversation |
| Entwuerfe erstellt | `COUNT(HelenaDraft WHERE created IN range)` | HelenaDraft |
| Entwuerfe akzeptiert | `COUNT(HelenaDraft WHERE status = ACCEPTED)` | HelenaDraft.status |
| Akzeptanzrate | `ACCEPTED / (ACCEPTED + REJECTED) * 100` | HelenaDraft |
| Alerts ausgeloest | `COUNT(HelenaAlert WHERE created IN range)` | HelenaAlert |
| Token-Verbrauch | `SUM(TokenUsage.totalTokens)` grouped by Zeitraum | TokenUsage (existing tracking) |

---

## Complexity Assessment Summary

| Feature Area | Overall Complexity | New Dependencies | Risk |
|--------------|-------------------|------------------|------|
| BI-Dashboard | Medium | None (Recharts + Prisma existing) | Low -- query patterns established |
| CSV/XLSX Export | Low | `exceljs` (1 package) | Low -- thin wrapper over DB queries |
| PDF-Tools | Low-Medium | None (Stirling-PDF already running) | Low -- REST wrappers, UI is main effort |
| Helena Intelligence | Medium-High | None (all existing stack) | Medium -- LLM extraction accuracy for auto-fill |
| CalDAV-Sync | High | `tsdav` (1 package) | High -- OAuth2, conflict resolution, 3 providers |

---

## Sources

- Clio: [62 Essential Law Firm KPIs](https://www.clio.com/blog/law-firm-kpis/) -- MEDIUM confidence (industry standard reference for legal KPIs)
- Stirling-PDF API: [DeepWiki API Reference](https://deepwiki.com/Stirling-Tools/Stirling-PDF/5-api-reference) -- HIGH confidence (endpoint paths verified, consistent with running instance)
- Stirling-PDF Docs: [Official Documentation](https://docs.stirlingpdf.com/API/) -- HIGH confidence
- Stirling-PDF GitHub: [README](https://github.com/Stirling-Tools/Stirling-PDF) -- HIGH confidence (50+ tools, all UI ops available via REST)
- tsdav: [GitHub](https://github.com/natelindev/tsdav) -- MEDIUM confidence (tested with Google + Apple; Outlook CalDAV support varies by plan)
- ts-caldav: [GitHub](https://github.com/KlautNet/ts-caldav) -- LOW confidence (newer library, less battle-tested than tsdav)
- ExcelJS: [npm](https://www.npmjs.com/package/exceljs) -- HIGH confidence (well-maintained, TypeScript types included, 13M+ weekly downloads)
- SheetJS: [npm](https://www.npmjs.com/package/xlsx) -- LOW confidence (npm registry version is stale/unmaintained as of 2025; avoid)
- Existing codebase analysis -- HIGH confidence (direct code inspection of dashboard, stirling-client, helena tools, chat-layout, team-dashboard export, falddaten-schemas, memory-service, kalender)
