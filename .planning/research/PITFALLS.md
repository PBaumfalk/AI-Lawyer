# Domain Pitfalls

**Domain:** Adding BI-Dashboard, Helena Intelligence, PDF-Tools, CalDAV-Sync, CSV/XLSX Export to AI-Lawyer (legal practice management)
**Researched:** 2026-03-06

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Helena Falldaten Auto-Fill Hallucinating Field Values

**What goes wrong:** LLM extracts structured data from documents (party names, dates, amounts, court references) and silently fills incorrect values into Falldatenblatt fields. A wrong Aktenzeichen, wrong opposing party name, or wrong deadline date in a legal case file can cause downstream legal errors that are hard to detect.

**Why it happens:** LLMs hallucinate 17-33% of the time even with RAG grounding (Stanford HAI, 2025). Structured extraction (dates, monetary amounts, legal references) is particularly error-prone because the model confidently generates plausible-looking values. German legal documents use inconsistent formatting (e.g., dates as "12.03.2026", "12. Maerz 2026", "2026-03-12"), making extraction fragile.

**Consequences:** Incorrect case data propagated to Fristen (wrong deadlines), Schriftsaetze (wrong party names), Rechnungen (wrong amounts). Legal malpractice liability if undetected. Trust erosion -- one wrong auto-fill makes users distrust all auto-fills.

**Prevention:**
- Every auto-filled field MUST be marked as VORSCHLAG (suggestion), never silently committed
- Show source excerpt alongside each extracted value (which document, which paragraph)
- Use `generateObject` with strict Zod schemas, not free-form text extraction
- Confidence score per field -- only auto-fill fields above threshold (e.g., 0.8), leave others empty with "Konnte nicht ermittelt werden"
- Never auto-fill Aktenzeichen or Frist dates without human confirmation
- Unit tests with real German legal document excerpts (Urteil, Klageschrift, Mahnbescheid)

**Detection:** Monitor rejection rate of auto-filled values. If users override >30% of suggestions, the extraction quality is too low.

**Phase:** Helena Intelligence phase -- implement suggestion-with-source pattern from day one.

---

### Pitfall 2: CalDAV Bidirectional Sync Creating Duplicate or Lost Entries

**What goes wrong:** Events created in AI-Lawyer appear twice in Google/Outlook, or events deleted externally reappear in AI-Lawyer. Fristen with BGB-calculated deadlines get their dates overwritten by external calendar edits, breaking legal compliance.

**Why it happens:** CalDAV sync requires tracking ETags and CTags for change detection. Without proper conflict resolution, both sides see a "new" event and create duplicates. The KalenderEintrag model has complex Frist-specific fields (fristablauf, vorfristen, halbfrist, hauptfristId, bundesland, istNotfrist) that have no CalDAV/iCal equivalent. Round-tripping these through external calendars loses data. Additionally, Nextcloud (since v22) forbids recreating calendar items with previously-deleted UIDs.

**Consequences:** Lawyers miss Fristen because they trust their synced Google Calendar which shows wrong dates. Duplicate entries cause confusion and manual cleanup overhead. Data integrity loss when external edits overwrite BGB-calculated fields.

**Prevention:**
- Fristen (KalenderTyp.FRIST) should sync as READ-ONLY to external calendars. External changes to Frist events must be rejected or ignored. Only TERMIN and WIEDERVORLAGE types sync bidirectionally.
- Store CalDAV UID, ETag, and CTag per KalenderEintrag (new DB columns needed)
- Use `tsdav` library (TypeScript, MIT, maintained by Cal.com fork) -- it handles Google/Apple/Nextcloud auth flows
- Implement sync state machine: LOCAL_ONLY -> SYNCED -> CONFLICT -> RESOLVED
- Never delete locally on external deletion of a FRIST -- mark as "extern geloescht" for manual review
- Generate stable UUIDs for iCal UIDs (not CUIDs, which contain slashes that break some CalDAV servers)
- BullMQ cron job for sync (every 5 min), not real-time webhooks (CalDAV has no reliable push)

**Detection:** Sync audit log tracking creates/updates/conflicts per sync run. Alert if conflict rate >5%.

**Phase:** CalDAV-Sync phase -- design sync state machine and readonly-FRIST rule before writing any sync code.

---

### Pitfall 3: BI-Dashboard Queries Degrading Production Database Performance

**What goes wrong:** Aggregation queries for KPI dashboards (COUNT across 90+ models, date-range GROUP BY, cross-table JOINs for financial summaries) lock rows or cause full table scans, slowing down the main application for all users.

**Why it happens:** BI queries are fundamentally different from OLTP queries. A simple "Umsatz der letzten 12 Monate pro Sachgebiet" requires joining Rechnung -> Akte -> multiple aggregations with date filters. With 90+ Prisma models and no materialized views, these queries hit the same PostgreSQL 16 instance serving real-time requests.

**Consequences:** Page load times spike during dashboard viewing. Worst case: long-running aggregation query blocks Prisma connection pool (default 5 connections), causing timeouts across the entire app.

**Prevention:**
- Create a dedicated set of database views or materialized views for KPI aggregations, refreshed by BullMQ cron (e.g., every 15 minutes)
- Use `prisma.$queryRaw` for complex aggregations instead of chaining Prisma client calls (which generate N+1 queries)
- Add `statement_timeout` to BI queries (e.g., 10 seconds max)
- Server-side data aggregation -- never send raw rows to the frontend for Recharts to aggregate
- Cache KPI results in Redis with TTL (e.g., 5 minutes) -- dashboards don't need real-time data
- Add database indexes for common BI filter columns: `Akte.createdAt`, `Rechnung.datum`, `KalenderEintrag.datum`, `Zeiterfassung.datum`

**Detection:** Monitor Prisma query durations via existing logging. Any query >2s in a dashboard route is a red flag.

**Phase:** BI-Dashboard phase -- implement Redis caching layer and raw SQL aggregations from the start, not as optimization later.

---

### Pitfall 4: XLSX Export Crashing on Large Datasets (Heap Out of Memory)

**What goes wrong:** Exporting all Akten or all financial records to XLSX causes Node.js to run out of heap memory, crashing the worker or app process.

**Why it happens:** Both ExcelJS and SheetJS load entire workbooks into memory by default. A Kanzlei with 5,000 Akten, each with multiple Beteiligte and Dokumente, can easily produce 100k+ rows. The default Node.js heap (1.5GB in Docker) is insufficient for large XLSX generation.

**Consequences:** Worker process crashes, affecting BullMQ job processing (OCR, Helena tasks, notifications). If done in the app process instead of worker, all users experience downtime.

**Prevention:**
- Always generate exports in the BullMQ worker process, never in API route handlers
- Use ExcelJS `WorkbookWriter` (streaming mode), not `Workbook` (in-memory mode)
- Implement row-count limits with pagination: max 10,000 rows per export, offer "Export Teil 1/3" for larger datasets
- For CSV exports, use Node.js streams directly (no library needed) -- CSV is always preferred for data >50k rows
- Stream the result to MinIO as a temporary file, then serve a download link (not a direct response body)
- Add `--max-old-space-size=2048` to worker process if needed

**Detection:** Monitor worker memory usage. Add a pre-flight row count check before starting export.

**Phase:** Export phase -- choose streaming architecture from the start.

---

## Moderate Pitfalls

### Pitfall 5: Stirling-PDF API Endpoints Not Matching Expectations

**What goes wrong:** Developers assume all Stirling-PDF features are available via API, but the docs explicitly state "not all functionalities are accessible via the API." Front-end exclusive features like visual PDF signing or the interactive reorder UI are unavailable through the REST API. The redact endpoint may not exist or work differently than expected.

**Prevention:**
- Before implementing any PDF tool, verify the specific endpoint exists on the running Stirling-PDF instance by hitting `/swagger-ui/index.html`
- Known working endpoints: `/api/v1/general/merge-pdfs`, `/api/v1/general/split-pages`, `/api/v1/security/add-watermark`, `/api/v1/misc/compress-pdf`
- For redaction: Stirling-PDF may require text-based redaction (search-and-replace with black boxes), not visual box-drawing. If visual redaction is needed, use `pdf-lib` (already in the project) for client-side box coordinates + server-side flattening
- For rotate/reorder: may need to be done client-side with `pdf-lib` and then upload the result
- Extend existing `stirling-client.ts` pattern (FormData + fetch) for each new endpoint

**Phase:** PDF-Tools phase -- spend first 30 minutes verifying available endpoints on the running Stirling-PDF Docker container before designing the feature.

---

### Pitfall 6: Globaler KI-Chat Without Akte Context Producing Unusable Answers

**What goes wrong:** A "global" Helena chat (not scoped to a specific Akte) tries to answer legal questions but has no context about which case the user is asking about. The existing orchestrator requires `akteId` for most tools. Without it, Helena cannot search documents, read Beteiligte, or check Fristen.

**Why it happens:** The entire Helena tool system is designed around `akteId` scoping. The `ToolContext` type requires `akteId: string | null`, and most read tools use `akteAccessFilter` which implicitly scopes to the user's accessible Akten. A global chat breaks this assumption.

**Prevention:**
- Global chat should use `search_alle_akten` tool (already exists, tool #11) as the primary entry point -- it searches across all accessible Akten and returns summaries
- Allow Helena to first identify relevant Akten, then "scope into" them for deeper queries
- Provide a different system prompt for global mode that instructs Helena to always identify the relevant Akte first
- Do NOT create a separate global orchestrator -- reuse the existing one with `akteId: null` and ensure all tools gracefully handle null akteId
- Limit global chat to read-only tools (no draft creation without explicit Akte selection)

**Detection:** Track how often global chat responses include "Ich kann diese Frage nicht beantworten" or similar -- high rates indicate the tool scoping is too restrictive.

**Phase:** Helena Intelligence phase -- design the global chat prompt and tool filtering before implementing UI.

---

### Pitfall 7: CalDAV OAuth Token Management Across Google/Outlook/Apple

**What goes wrong:** Each CalDAV provider (Google, Outlook/Exchange, Apple iCloud) has different authentication flows. Google requires OAuth2 with refresh tokens. Outlook uses Microsoft Identity Platform (also OAuth2 but different scopes). Apple iCloud requires app-specific passwords (no OAuth). Developers build for one provider and assume the others work the same.

**Prevention:**
- Start with a single provider (Google CalDAV is best documented with `tsdav`)
- Store OAuth tokens encrypted in the database (like existing email encryption key pattern)
- Implement token refresh logic in the BullMQ sync job, not in API routes
- For Apple iCloud: use app-specific password + CalDAV basic auth (different flow entirely)
- For Outlook: consider whether CalDAV or Microsoft Graph API is better (Graph has push notifications, CalDAV does not)
- Add a provider abstraction layer from day one: `CalDAVProvider` interface with `GoogleCalDAVProvider`, `AppleCalDAVProvider`, etc.

**Phase:** CalDAV-Sync phase -- implement Google first as MVP, defer Apple/Outlook to follow-up.

---

### Pitfall 8: Fallzusammenfassung Exceeding LLM Context Window

**What goes wrong:** A comprehensive case summary requires all Aktenaktivitaeten, all Dokument contents (via RAG chunks), all Beteiligte, all Fristen, and the Falldatenblatt. For a complex case this easily exceeds the context window (128k tokens for qwen3.5:35b), causing truncated or incoherent summaries.

**Prevention:**
- Use a two-pass approach: (1) retrieve and rank relevant chunks via existing hybrid search, (2) generate summary from top-k chunks only
- Cap input to 60% of context window, leaving room for generation
- Reuse the existing `truncateMessages` FIFO mechanism from the orchestrator
- Structure the summary with fixed sections (Sachverhalt, Beteiligte, Verfahrensstand, Offene Fristen, Risikobewertung) so missing data results in "Keine Angaben" rather than hallucination
- Cache summaries per Akte with invalidation on new AktenActivity

**Phase:** Helena Intelligence phase -- design the retrieval strategy before implementing the summary prompt.

---

### Pitfall 9: BI-Dashboard Recharts Performance with Time Series Data

**What goes wrong:** Rendering 12 months of daily data points (365 data points per chart, multiple charts on one page) causes visible lag and janky scrolling. Recharts uses SVG which creates one DOM node per data point.

**Prevention:**
- Aggregate data server-side: daily data -> weekly for 3-month view, monthly for 12-month view
- Limit visible data points to ~50 per chart maximum
- Use `React.lazy` + `Suspense` for chart components (avoid loading all charts on initial render)
- Follow the existing `BacklogTrendChart` pattern (already in codebase) -- it handles empty states and uses responsive container correctly
- Do NOT switch to ECharts or another library -- Recharts is already in the project, the data volume for a 5-person Kanzlei is manageable with proper aggregation

**Phase:** BI-Dashboard phase -- server-side aggregation is part of the API design, not a frontend concern.

---

### Pitfall 10: Template-Vorschlaege Without Clear Match Criteria

**What goes wrong:** Helena suggests Vorlagen (templates) for a case but the suggestions are based on vague semantic similarity rather than structured matching. Users get irrelevant template suggestions (e.g., a Mietrecht template for an Arbeitsrecht case) which erodes trust.

**Prevention:**
- Match templates primarily by `Sachgebiet` (structured field on both Akte and FalldatenTemplate), not by semantic search
- Use the existing FalldatenTemplate model which already has `sachgebiet: Sachgebiet?` field
- Only fall back to semantic search within the matched Sachgebiet
- Show match reason: "Vorgeschlagen weil Sachgebiet = Arbeitsrecht" is more trustworthy than a vague AI recommendation
- Rank by community approval status (FREIGEGEBEN > ENTWURF)

**Phase:** Helena Intelligence phase.

---

## Minor Pitfalls

### Pitfall 11: CSV Export Encoding Issues with German Characters

**What goes wrong:** Exported CSV files opened in Excel show garbled Umlauts (ae, oe, ue, ss) because Excel defaults to ANSI encoding, not UTF-8.

**Prevention:**
- Prepend UTF-8 BOM (`\uFEFF`) to all CSV output -- this tells Excel to use UTF-8
- The existing DATEV export in `src/lib/finance/export/datev.ts` likely already handles this -- check and reuse the pattern
- Offer both CSV (with BOM) and XLSX (no encoding issues) as export formats
- Test with German special characters: Ue, Ae, Oe, ss, and also Euro sign

**Phase:** Export phase -- trivial fix but causes 100% of user complaints if missed.

---

### Pitfall 12: PDF Merge Losing Document Metadata and Bookmarks

**What goes wrong:** Merging multiple PDFs via Stirling-PDF produces a single PDF but loses individual document titles, bookmarks, and internal links. Lawyers expect merged court submissions to retain structure.

**Prevention:**
- After merge, add bookmarks/table-of-contents using `pdf-lib` (already in project) with the original document names
- Store merge order and source document IDs in the resulting Dokument metadata for traceability
- Set the merged PDF title to a meaningful name (e.g., "Anlagenkonvolut K1-K5")

**Phase:** PDF-Tools phase.

---

### Pitfall 13: Redact Feature Not Actually Removing Text from PDF

**What goes wrong:** A common mistake is drawing black boxes over text without actually removing the underlying text data from the PDF. The text is still extractable via copy-paste or programmatic tools, creating a DSGVO violation.

**Prevention:**
- Stirling-PDF's redact endpoint (if available) should flatten the PDF after redaction
- Verify by extracting text from the redacted PDF programmatically -- the redacted text must be completely gone
- If using `pdf-lib` for client-side redaction: draw black rectangles AND remove the underlying text content streams
- Add a warning in the UI: "Redaktion entfernt Text unwiderruflich"
- Always create a copy, never modify the original document in MinIO

**Phase:** PDF-Tools phase -- critical for DSGVO compliance, must be verified with automated tests.

---

### Pitfall 14: Export Filters Not Matching BI-Dashboard Filters

**What goes wrong:** User applies filters in the BI-Dashboard (date range, Sachgebiet, Anwalt), then clicks "Export." The export produces unfiltered data because the export API route doesn't receive the current filter state.

**Prevention:**
- Pass filter parameters as query params to the export endpoint: `/api/export/akten?von=2025-01-01&bis=2025-12-31&sachgebiet=ARBEITSRECHT`
- Reuse the exact same Prisma WHERE clause for both dashboard queries and export queries (extract into a shared filter builder)
- Include the applied filters as a header row in the export file ("Zeitraum: 01.01.2025 - 31.12.2025, Sachgebiet: Arbeitsrecht")

**Phase:** Export phase -- design the filter-to-query pipeline to be shared between dashboard and export from the start.

---

### Pitfall 15: Adding Too Many New Helena Tools at Once

**What goes wrong:** Adding tools for Falldaten auto-fill, Fallzusammenfassung, template suggestions, and global chat all at once overwhelms the LLM's tool selection. With 14 existing tools + 4-5 new ones, the system prompt becomes too long and the model makes worse tool choices.

**Prevention:**
- New Helena features (auto-fill, summary) should be deterministic pipelines (like the existing Schriftsatz pipeline), not new ReAct tools
- Use `generateObject` for structured extraction (Falldaten), not tool calls
- Only add a new tool to the ReAct registry if it genuinely needs multi-step reasoning
- The existing 18-tool limit (12 read + 6 write) is already near optimal for qwen3.5:35b -- going above 20 tools degrades selection accuracy

**Phase:** Helena Intelligence phase -- decide for each feature whether it's a tool, a pipeline, or a standalone endpoint.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| BI-Dashboard | Slow aggregation queries blocking production DB | Redis cache + materialized views + raw SQL |
| BI-Dashboard | Recharts lag with too many data points | Server-side aggregation, max 50 points per chart |
| Helena Intelligence (Auto-fill) | Hallucinated field values accepted without review | VORSCHLAG pattern, confidence scores, source excerpts |
| Helena Intelligence (Global Chat) | No Akte context = useless answers | search_alle_akten first, then scope into specific Akte |
| Helena Intelligence (Summary) | Context window overflow for large cases | Two-pass retrieval + truncation + structured sections |
| Helena Intelligence (Templates) | Irrelevant suggestions erode trust | Sachgebiet-first matching, show match reason |
| PDF-Tools | Assuming all Stirling-PDF features have API endpoints | Verify endpoints on running instance before design |
| PDF-Tools (Redact) | Black box overlay without text removal = DSGVO violation | Verify text extraction after redaction, always flatten |
| PDF-Tools (Merge) | Lost bookmarks and metadata | Add bookmarks via pdf-lib post-merge |
| CalDAV-Sync | Duplicate events, lost Frist data on round-trip | FRIST = read-only sync, ETag/CTag tracking, stable UIDs |
| CalDAV-Sync | OAuth token management across 3 providers | Provider abstraction, start with Google only |
| CalDAV-Sync | Recurring events edge cases | Start with single events, add recurrence in follow-up |
| CSV/XLSX Export | Heap out of memory on large exports | ExcelJS streaming mode, BullMQ worker, row limits |
| CSV/XLSX Export | Garbled Umlauts in CSV | UTF-8 BOM prefix |
| CSV/XLSX Export | Filters not passed to export | Shared filter builder between dashboard and export |

## Sources

- [Stanford HAI: Hallucinating Law - Legal Mistakes with Large Language Models](https://hai.stanford.edu/news/hallucinating-law-legal-mistakes-large-language-models-are-pervasive) -- Hallucination rates in legal LLM applications (HIGH confidence)
- [Stanford Legal RAG Hallucinations Study (2025)](https://dho.stanford.edu/wp-content/uploads/Legal_RAG_Hallucinations.pdf) -- 17-33% hallucination rate even with RAG (HIGH confidence)
- [Stirling-PDF API Documentation](https://docs.stirlingpdf.com/API/) -- "not all functionalities are accessible via the API" (HIGH confidence)
- [Stirling-PDF GitHub](https://github.com/Stirling-Tools/Stirling-PDF) -- Available endpoints and limitations (HIGH confidence)
- [tsdav - CalDAV TypeScript library](https://www.npmjs.com/package/tsdav) -- Primary CalDAV client recommendation (MEDIUM confidence)
- [ts-caldav - Alternative CalDAV library](https://github.com/KlautNet/ts-caldav) -- Lightweight alternative with syncChanges support (LOW confidence -- newer, less adoption)
- [ExcelJS Streaming Issues (GitHub #709)](https://github.com/exceljs/exceljs/issues/709) -- Memory failures even with streams for very large datasets (HIGH confidence)
- [SheetJS Large Dataset Handling](https://docs.sheetjs.com/docs/demos/bigdata/stream/) -- Streaming write documentation (HIGH confidence)
- [CalDAV Bidirectional Sync Tools Comparison 2025](https://calendhub.com/blog/best-bidirectional-calendar-sync-tools-2025) -- Conflict resolution patterns (MEDIUM confidence)
- Existing codebase analysis: `stirling-client.ts`, `backlog-trend-chart.tsx`, Helena `orchestrator.ts`, `tools/index.ts`, `KalenderEintrag` schema (HIGH confidence -- primary source)
