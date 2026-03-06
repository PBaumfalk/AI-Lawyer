# Project Research Summary

**Project:** AI-Lawyer v0.8 Intelligence & Tools
**Domain:** AI-first Kanzleisoftware (legal practice management)
**Researched:** 2026-03-06
**Confidence:** HIGH

## Executive Summary

v0.8 adds five feature clusters -- BI-Dashboard, Helena Intelligence, PDF-Tools, CalDAV-Sync, and CSV/XLSX Export -- to a mature 141k LOC TypeScript codebase. The critical finding across all research: most of these features build on existing, proven infrastructure. Only 3 new npm packages are needed (`exceljs`, `tsdav`, `ical-generator`), no new Docker services, and the dominant patterns (Prisma aggregation, Stirling-PDF REST calls, Vercel AI SDK `generateObject`/`generateText`, BullMQ workers) are already established in the codebase. This dramatically reduces implementation risk for 4 of the 5 clusters.

The recommended approach is a four-phase build ordered by dependency chain and risk. BI-Dashboard and Export come first because they share query infrastructure, have zero new dependencies beyond ExcelJS, and deliver immediate value for monthly reporting. PDF-Tools follow as quick wins (Stirling-PDF is already running). Helena Intelligence builds third, leveraging the same `generateObject` pattern from v0.2's Schriftsatz pipeline. CalDAV-Sync comes last because it is the only feature with genuine architectural complexity -- bidirectional sync, OAuth token management across providers, and conflict resolution for legally-sensitive Frist data.

The primary risks are: (1) LLM hallucination in Falldaten auto-fill corrupting case data -- mitigated by treating all AI output as VORSCHLAG with confidence scores and source excerpts; (2) CalDAV sync creating duplicate or lost entries, especially for Fristen -- mitigated by making Fristen read-only in external calendars; (3) BI aggregation queries degrading production database performance -- mitigated by Redis caching and raw SQL with statement timeouts; (4) XLSX export crashing on large datasets -- mitigated by ExcelJS streaming mode and BullMQ worker isolation.

## Key Findings

### Recommended Stack

The existing stack (Next.js 14, Prisma, Recharts, Vercel AI SDK v4, Stirling-PDF, BullMQ, Redis, MinIO) handles 4 of 5 feature clusters without any new dependencies. Only CalDAV-Sync and Export require new packages.

**New dependencies (3 packages total):**
- `exceljs` ^4.4.0: XLSX export with streaming, cell styling, auto-filters -- MIT-licensed, 4.7M weekly downloads
- `tsdav` ^2.1.8: CalDAV transport protocol client -- zero dependencies, TypeScript-native, used by Cal.com in production
- `ical-generator` ^10.0.0: RFC 5545 VEVENT serialization for CalDAV PUT operations -- 1.3M weekly downloads

**Key reuse (no changes needed):**
- Recharts 3.7 for all BI charts (already proven in backlog-trend-chart)
- Vercel AI SDK v4 `generateObject`/`generateText` for Helena Intelligence (identical to Schriftsatz pipeline)
- Stirling-PDF API for all PDF operations (7 new functions following existing `stirling-client.ts` pattern)

**What NOT to add:** SheetJS (licensing issues), `csv-writer` (manual CSV is sufficient), `dav` (unstable API), Chart.js/D3 (Recharts already installed), TanStack Query (would create second data-fetching pattern), `react-dnd` (use native HTML5 DnD).

### Expected Features

**Must have (table stakes):**
- BI-Dashboard: KPI tiles (Akten, Umsatz, Fristen, Helena), trend charts, date/Sachgebiet/Anwalt filters
- Helena Falldaten Auto-Fill: extract structured data from documents into Falldatenblatt fields
- Helena Fallzusammenfassung: render existing HelenaMemoryContent as timeline + key facts
- Helena Global KI-Chat: cross-Akte chat using existing `search_alle_akten` tool
- PDF merge, split, rotate, compress via Stirling-PDF API
- CalDAV outbound sync (Fristen/Termine to Google/Apple Calendar)
- CalDAV inbound sync (external events visible in Kanzleisoftware)
- CSV/XLSX export for Akten, Kontakte, Finanzen, BI reports

**Should have (differentiators):**
- Per-field confidence scores on Falldaten auto-fill (unique in legal tech)
- Frist compliance rate KPI (critical legal metric, rare in competing tools)
- Helena adoption metrics (AI usage tracking per user/Akte)
- PDF watermark with Kanzlei branding, PDF redact for DSGVO compliance
- CalDAV conflict detection for scheduling

**Defer (v2+):**
- Real-time collaborative PDF editing (use OnlyOffice for DOCX)
- Custom BI query builder (export raw data instead)
- XLSX import (complex validation, rare use case)
- BI email scheduling (manual export covers the need)
- Outlook CalDAV (limited Microsoft support; may need Graph API)

### Architecture Approach

All five clusters integrate at well-defined points in the existing architecture. No new Docker services, no new databases. The pattern is consistent: Next.js API routes handle requests, delegate to service layers (Prisma aggregates, Stirling-PDF REST, AI SDK calls, tsdav transport), and results flow back through established channels (JSON responses, MinIO storage, BullMQ notifications).

**Major components:**
1. **BI API + Dashboard Page** -- Prisma aggregate queries with Redis cache (5min TTL), Recharts visualization, shared filter builder
2. **Export Service** -- centralized CSV/XLSX generation with format strategy pattern, shared query layer with BI
3. **Stirling-PDF Client Extensions** -- 7 new functions in existing `stirling-client.ts`, each following the proven FormData + fetch pattern
4. **Helena Intelligence Pipelines** -- deterministic `generateObject`/`generateText` pipelines (NOT new ReAct tools), global chat with tool whitelist
5. **CalDAV Sync Engine** -- tsdav transport + ical-generator serialization, BullMQ cron, encrypted credential storage mirroring EmailKonto pattern, 3 new Prisma models

### Critical Pitfalls

1. **Helena Falldaten hallucination** -- LLMs hallucinate 17-33% even with RAG. Every auto-filled field must be VORSCHLAG with source excerpt and confidence score. Never auto-save. Monitor rejection rate (>30% = quality too low).
2. **CalDAV sync duplicates/data loss** -- Fristen must sync as READ-ONLY to external calendars. External deletion of a Frist must never propagate. Use ETag/CTag tracking, stable UUIDs (not CUIDs), sync state machine.
3. **BI queries degrading production DB** -- Aggregation queries must use Redis cache (5min TTL), `$queryRaw` for complex joins, and `statement_timeout` (10s). Never send raw rows to frontend.
4. **XLSX export heap overflow** -- Always use ExcelJS `WorkbookWriter` (streaming), generate in BullMQ worker (not API route), enforce 10k row limit with pagination.
5. **Stirling-PDF endpoint assumptions** -- Not all Stirling-PDF features have API endpoints. Verify each endpoint on the running instance before designing the feature. Redact endpoint behavior may differ from expectations.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: BI-Dashboard + CSV/XLSX Export

**Rationale:** Zero feature dependencies on other v0.8 work. Dashboard API queries are reused by export endpoints, so building them together avoids duplicate query logic. Only new dependency is ExcelJS. All UI patterns (GlassKpiCard, Recharts, filter bars) are already proven in the codebase. Immediate business value for monthly reporting.

**Delivers:** KPI dashboard with 6+ chart types, date/Sachgebiet/Anwalt filters, CSV and XLSX export for Akten/Kontakte/Finanzen/BI reports.

**Addresses features:** All BI-Dashboard table stakes (KPI tiles, trend charts, filters, MoM deltas), all Export table stakes, Frist compliance rate differentiator, Helena adoption metrics differentiator.

**Avoids pitfalls:** #3 (DB performance -- implement Redis cache from day one), #4 (XLSX heap overflow -- use streaming ExcelJS in worker), #9 (Recharts performance -- server-side aggregation), #11 (CSV encoding -- UTF-8 BOM), #14 (filter mismatch -- shared filter builder).

### Phase 2: PDF-Tools

**Rationale:** Stirling-PDF is already running in Docker. The `stirling-client.ts` pattern is proven with 3 existing methods. Each operation is a thin REST wrapper. No schema changes, no new workers. Quick wins with visible user value.

**Delivers:** PDF merge, split, rotate, compress, watermark, redact via Stirling-PDF API. UI with document picker from DMS and operation modal.

**Addresses features:** All PDF-Tools table stakes (merge, split, rotate, compress), watermark and redact differentiators.

**Avoids pitfalls:** #5 (endpoint verification -- check Swagger first), #12 (lost bookmarks -- add via pdf-lib post-merge), #13 (redact not removing text -- verify with extraction test).

### Phase 3: Helena Intelligence

**Rationale:** Builds on existing Helena tools, Vercel AI SDK patterns from v0.2 Schriftsatz pipeline. Falldaten auto-fill is the hardest piece (LLM structured extraction + confidence scoring). Group all Helena work together for context continuity.

**Delivers:** Falldaten auto-fill with confidence scores and source excerpts, Fallzusammenfassung as timeline + key facts, global KI-Chat at `/ki`, template suggestions on Akte creation.

**Addresses features:** All Helena Intelligence table stakes, confidence scores differentiator, global KI-Chat with multi-Akte context differentiator.

**Avoids pitfalls:** #1 (hallucination -- VORSCHLAG pattern from day one), #6 (global chat context -- tool whitelist with `search_alle_akten` first), #8 (context window -- two-pass retrieval with truncation), #10 (template matching -- Sachgebiet-first, not semantic), #15 (too many tools -- use deterministic pipelines, not new ReAct tools).

### Phase 4: CalDAV-Sync

**Rationale:** Highest complexity, most unknowns. Requires 2 new npm packages, 3 new Prisma models, OAuth2 setup, and bidirectional sync state machine. External service dependency (Google/Apple CalDAV servers). Build last so other features ship independently regardless of CalDAV complexity.

**Delivers:** Bidirectional calendar sync with Google and Apple Calendar. Fristen sync as read-only, Termine as bidirectional. Encrypted credential storage. BullMQ cron for periodic sync.

**Addresses features:** All CalDAV table stakes (outbound, inbound, multi-provider), conflict detection differentiator.

**Avoids pitfalls:** #2 (duplicates/data loss -- Frist read-only rule, ETag tracking, sync state machine), #7 (OAuth management -- start with Google, defer Outlook).

### Phase Ordering Rationale

- **Dependency chain:** BI queries power export endpoints; building them together in Phase 1 creates shared infrastructure.
- **Risk gradient:** Phases 1-2 are low risk (proven patterns), Phase 3 is medium (LLM accuracy), Phase 4 is high (external sync complexity). This lets the team ship value early while deferring the hardest work.
- **Independence:** Phases 1-3 have no inter-dependencies. Phase 4 is independent of all others. Any phase can slip without blocking the rest.
- **New dependency introduction:** Phase 1 adds ExcelJS (trivial). Phase 4 adds tsdav + ical-generator (complex). Spreading new dependencies reduces integration risk.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Helena Intelligence):** Falldaten auto-fill prompt engineering and confidence scoring calibration need experimentation with real German legal documents. The LLM extraction accuracy for dates, amounts, and legal references is the key unknown.
- **Phase 4 (CalDAV-Sync):** CalDAV protocol specifics (sync-token vs ctag, recurring events, VTIMEZONE handling), Google OAuth2 setup, and Apple app-specific password flow all need `/gsd:research-phase` before implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (BI-Dashboard + Export):** Prisma aggregation, Recharts, ExcelJS are all well-documented with existing codebase patterns to follow.
- **Phase 2 (PDF-Tools):** Stirling-PDF endpoints are documented and verifiable via Swagger UI. Pattern is identical to existing OCR client.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only 3 new packages, all well-maintained with high download counts. Existing stack handles 80% of v0.8. |
| Features | HIGH | Feature landscape well-defined. Clear table stakes vs differentiators. Anti-features identified. |
| Architecture | HIGH | All components integrate at known extension points. No new services. Patterns proven in codebase. |
| Pitfalls | HIGH | Critical pitfalls (hallucination, sync duplicates, DB perf, heap overflow) are well-documented with clear prevention strategies. |

**Overall confidence:** HIGH

### Gaps to Address

- **Outlook CalDAV support:** Microsoft's CalDAV implementation is inconsistent across plans. May need Graph API fallback. Defer to post-v0.8 or validate during Phase 4 research.
- **Stirling-PDF redact endpoint behavior:** The exact behavior of `/api/v1/security/auto-redact` needs verification on the running instance. Text-based vs visual redaction semantics are unclear from docs alone.
- **LLM extraction accuracy for German legal formats:** Hallucination rates for structured extraction from German legal documents (inconsistent date formats, complex party name structures) need empirical testing during Phase 3.
- **Recurring CalDAV events (RRULE):** Research suggests deferring recurring event sync to a follow-up. The complexity of RRULE parsing and bidirectional sync of recurring series is significant.
- **ExcelJS streaming limits:** GitHub issue #709 documents memory failures even with streaming for very large datasets. Row count limits (10k) and pagination strategy should be designed upfront.

## Sources

### Primary (HIGH confidence)
- [Stirling-PDF API Docs](https://docs.stirlingpdf.com/API/) -- endpoint structure, multipart patterns
- [Stirling-PDF GitHub](https://github.com/Stirling-Tools/Stirling-PDF) -- available features, API limitations
- [ExcelJS npm](https://www.npmjs.com/package/exceljs) -- streaming XLSX, 4.7M weekly downloads, MIT
- [Stanford HAI: Hallucinating Law](https://hai.stanford.edu/news/hallucinating-law-legal-mistakes-large-language-models-are-pervasive) -- LLM hallucination rates in legal applications
- [Stanford Legal RAG Hallucinations Study 2025](https://dho.stanford.edu/wp-content/uploads/Legal_RAG_Hallucinations.pdf) -- 17-33% hallucination even with RAG
- Codebase analysis: `stirling-client.ts`, `backlog-trend-chart.tsx`, Helena `orchestrator.ts`, `tools/index.ts`, `memory-service.ts`, `datev.ts`, `team-dashboard/export`

### Secondary (MEDIUM confidence)
- [tsdav npm](https://www.npmjs.com/package/tsdav) -- CalDAV client, 36k weekly downloads, tested with Google + Apple
- [tsdav Documentation](https://tsdav.vercel.app/) -- sync-token support, OAuth helpers
- [ical-generator npm](https://www.npmjs.com/package/ical-generator) -- RFC 5545 VCALENDAR generation, 1.3M weekly downloads
- [Clio: 62 Essential Law Firm KPIs](https://www.clio.com/blog/law-firm-kpis/) -- industry standard legal KPI reference
- [CalDAV Sync Protocol (sabre/dav)](https://sabre.io/dav/building-a-caldav-client/) -- ctag/etag sync strategy

### Tertiary (LOW confidence)
- [ts-caldav](https://github.com/KlautNet/ts-caldav) -- alternative CalDAV client, too new for production use
- Outlook CalDAV support -- inconsistent across Microsoft 365 plans, needs empirical validation

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*
