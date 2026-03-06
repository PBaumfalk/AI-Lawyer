# Architecture Patterns

**Domain:** v0.8 Intelligence & Tools -- BI-Dashboard, Helena Intelligence, PDF-Tools, CalDAV-Sync, CSV/XLSX Export
**Researched:** 2026-03-06

## Recommended Architecture

Five feature clusters integrate into the existing architecture at well-defined points. No new Docker services. No new databases. All features use existing infrastructure (Prisma, BullMQ, Stirling-PDF, Vercel AI SDK, Redis, MinIO).

```
                                 +-------------------+
                                 |   Next.js App     |
                                 |   (App Router)    |
                                 +--------+----------+
                                          |
          +----------+----------+---------+---------+----------+
          |          |          |         |         |          |
     BI-Dashboard  Helena    PDF-Tools  CalDAV   CSV/XLSX
     /bi/*         Intel.    /api/pdf/* Sync     Export
     /api/bi/*     /api/ki/* /api/pdf/* /api/    /api/export/*
          |          |          |       caldav/*     |
          |          |          |         |          |
     +----v----+ +---v---+ +---v----+ +--v---+ +---v----+
     | Prisma  | |AI SDK | |Stirling| |tsdav | |ExcelJS |
     | Aggr.   | |v4     | |PDF API | |lib   | |lib     |
     | Queries | |+Tools | |:8080   | |      | |        |
     +----+----+ +---+---+ +--------+ +--+---+ +--------+
          |          |                    |
     +----v----------v----+         +----v----+
     | PostgreSQL 16      |         | External|
     | (existing)         |         | CalDAV  |
     +--------------------+         | Servers |
                                    +---------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | New vs Modified |
|-----------|---------------|-------------------|-----------------|
| **BI-Dashboard Page** | KPI tiles, trend charts, filter bar | Prisma (aggregate queries), Recharts | **NEW** page `/bi/` |
| **BI API Routes** | Aggregate data for KPIs, time-series | Prisma, Redis (cache) | **NEW** `/api/bi/*` |
| **Export Service** | Generate CSV/XLSX from query results | Prisma, ExcelJS | **NEW** `/lib/export/` |
| **Export API Routes** | Download endpoints for all exportable data | Export Service | **NEW** `/api/export/*` |
| **Helena Intelligence** | Falldaten auto-fill, Fallzusammenfassung, global chat | AI SDK, Prisma, Helena tools | **MODIFIED** Helena tools + **NEW** API routes |
| **Global KI-Chat** | Akte-ungebundener Chat mit Helena | AI SDK, Helena tools (subset) | **MODIFIED** ki-chat route (remove akteId requirement) |
| **PDF-Tools Page** | UI for merge/split/rotate/compress/watermark/redact | Stirling-PDF API, MinIO | **NEW** page + API routes |
| **Stirling-PDF Client** | Extended REST client for all PDF operations | Stirling-PDF Docker service | **MODIFIED** `stirling-client.ts` |
| **CalDAV Sync Service** | Bidirectional sync engine | tsdav library, Prisma (KalenderEintrag) | **NEW** `/lib/caldav/` |
| **CalDAV Worker** | BullMQ processor for periodic sync | CalDAV Sync Service | **NEW** queue + processor |
| **CalDAV Settings UI** | Connection config per user | Settings API | **NEW** settings page section |

### Data Flow

#### BI-Dashboard

```
Browser -> GET /api/bi/kpis?from=&to= -> Prisma aggregate queries -> JSON response
Browser -> GET /api/bi/trends?metric=&period= -> Prisma time-series -> JSON response
Browser -> GET /api/export/bi?format=xlsx -> Export Service -> XLSX binary response

Data sources (all existing tables, no new models):
- Akte: count by status, sachgebiet, angelegt date
- Rechnung: sum betragNetto, count by status, monthly trend
- KalenderEintrag: overdue fristen, upcoming deadlines
- HelenaTask: count by status, avg duration
- TokenUsage: total tokens, cost per provider
- Dokument: count, OCR status distribution
- AktenActivity: activity volume over time
```

**Caching strategy:** Redis with 5-minute TTL for aggregate queries. Cache key = `bi:{kanzleiId}:{metric}:{dateRange}`. Invalidation is unnecessary -- stale data for 5 minutes is acceptable for BI dashboards.

#### Helena Intelligence

```
1. Falldaten Auto-Fill:
   User opens Falldaten tab -> clicks "Auto-Fill" ->
   POST /api/akten/{id}/falldaten/auto-fill ->
   Read Akte documents (OCR text + embeddings) ->
   AI SDK generateObject() with FalldatenSchema ->
   Return suggested values (ENTWURF, user confirms each)

2. Fallzusammenfassung:
   User clicks "Zusammenfassung" on Akte ->
   POST /api/akten/{id}/zusammenfassung ->
   Read Akte context (documents, activities, Beteiligte) ->
   AI SDK generateText() with summary prompt ->
   Return markdown summary (cached in Redis, 1h TTL)

3. Global KI-Chat (no akteId):
   User opens /ki-chat without Akte context ->
   POST /api/ki-chat (akteId: null) ->
   Helena with reduced tool set (search_alle_akten, search_gesetze,
   search_urteile, search_muster) ->
   Conversational response with cross-Akte search

4. Template-Vorschlaege:
   User creates new Akte with Sachgebiet ->
   GET /api/vorlagen/suggestions?sachgebiet=X ->
   Prisma query on DokumentVorlage filtered by sachgebiet ->
   Return ranked list (no LLM needed -- rule-based)
```

**Key constraint:** Falldaten auto-fill uses `generateObject()` (deterministic, schema-validated) not free-form text. This matches the existing Schriftsatz pipeline pattern from v0.2.

#### PDF-Tools

```
User selects PDFs from DMS -> opens PDF-Tools modal ->
Chooses operation (merge/split/rotate/compress/watermark/redact) ->

POST /api/pdf/{operation} with documentIds[] ->
API fetches files from MinIO ->
Sends to Stirling-PDF HTTP API ->
Receives result PDF ->
Saves to MinIO as new Dokument (linked to same Akte) ->
Returns new dokumentId

Operations map to Stirling-PDF endpoints:
- Merge:      POST /api/v1/general/merge-pdfs     (fileInput[])
- Split:      POST /api/v1/general/split-pages     (fileInput, pages)
- Rotate:     POST /api/v1/general/rotate-pdf      (fileInput, angle)
- Reorder:    POST /api/v1/general/rearrange-pages  (fileInput, pageOrder)
- Compress:   POST /api/v1/misc/compress-pdf       (fileInput, level)
- Watermark:  POST /api/v1/security/add-watermark  (fileInput, watermarkText, ...)
- Redact:     POST /api/v1/security/auto-redact    (fileInput, searchText)
```

**Important:** PDF operations go through the Next.js API route (not direct browser-to-Stirling). This maintains the MinIO access pattern and audit trail. Large files are streamed via Buffer (existing pattern from OCR processor).

#### CalDAV Sync

```
1. Setup:
   User -> /einstellungen/kalender -> enters CalDAV URL + credentials ->
   POST /api/caldav/connections -> encrypted storage in DB (like EmailKonto pattern)

2. Sync (BullMQ cron, every 15 min):
   Worker picks up caldav-sync job ->
   For each CalDavConnection:
     a. Fetch remote changes (REPORT with sync-token or ctag)
     b. Compare with local KalenderEintrag (externalId field)
     c. Push local changes to remote (PUT/DELETE)
     d. Pull remote changes to local (CREATE/UPDATE)
     e. Store sync-token for next run

3. Conflict resolution:
   Last-write-wins with server preference (remote wins on conflict).
   Rationale: Fristen in AI-Lawyer are authoritative; but if user edits
   in Google Calendar, that edit should be respected.

New Prisma fields on KalenderEintrag:
  externalCalDavId  String?   // Remote event UID
  calDavEtag        String?   // Remote etag for change detection
  calDavConnectionId String?  // Which connection owns this event
  lastSyncedAt      DateTime? // Last successful sync timestamp

New Prisma model:
  CalDavConnection {
    id, userId, url, username, encryptedPassword,
    syncToken, calendarPath, enabled, lastSyncAt, lastError
  }
```

**Encryption:** Reuse the existing `EMAIL_ENCRYPTION_KEY` pattern from EmailKonto for CalDAV credentials. Same AES-256-GCM approach.

#### CSV/XLSX Export

```
Browser -> GET /api/export/{entity}?format=csv|xlsx&filters... ->
Export Service builds query from filters ->
Prisma query (paginated for large datasets) ->
ExcelJS workbook generation (XLSX) or CSV string ->
Stream response with Content-Disposition header

Exportable entities:
- /api/export/akten         -> Akte list with metadata
- /api/export/kontakte      -> Kontakt list
- /api/export/finanzen      -> Buchungen, Rechnungen
- /api/export/fristen       -> Frist/Termin list
- /api/export/zeiterfassung -> Time entries
- /api/export/bi            -> BI-Dashboard report data
```

**Pattern:** Follow the existing team-dashboard CSV export pattern (see `/api/admin/team-dashboard/export/route.ts`). Extend with ExcelJS for XLSX format. No BullMQ queue needed -- exports are synchronous HTTP responses with streaming for large datasets.

## Patterns to Follow

### Pattern 1: Aggregate Query Endpoints

**What:** Dedicated API routes for pre-computed aggregations, not client-side computation.
**When:** BI-Dashboard KPIs, trend data, summary statistics.
**Why:** Prisma `aggregate()` and `groupBy()` push computation to PostgreSQL, which handles it far better than JavaScript.

```typescript
// src/app/api/bi/kpis/route.ts
export async function GET(request: NextRequest) {
  const session = await auth();
  // RBAC: ADMIN, ANWALT, SACHBEARBEITER
  const kanzleiId = (session.user as any).kanzleiId;

  const [aktenCount, offeneFristen, umsatz] = await Promise.all([
    prisma.akte.count({ where: { kanzleiId, archiviert: false } }),
    prisma.kalenderEintrag.count({
      where: {
        akte: { kanzleiId },
        typ: { in: ["FRIST", "NOTFRIST"] },
        erledigt: false,
        datum: { lte: new Date() },
      },
    }),
    prisma.rechnung.aggregate({
      where: { akte: { kanzleiId }, status: "BEZAHLT" },
      _sum: { betragNetto: true },
    }),
  ]);

  return NextResponse.json({
    aktenCount,
    offeneFristen,
    umsatz: umsatz._sum.betragNetto ?? 0,
  });
}
```

### Pattern 2: Stirling-PDF Client Extension

**What:** Extend existing `stirling-client.ts` with new operation functions.
**When:** Each PDF tool operation.
**Why:** Consistent error handling, URL construction, FormData patterns.

```typescript
// Extend src/lib/ocr/stirling-client.ts
export async function mergePdfs(pdfBuffers: Buffer[]): Promise<Buffer> {
  const formData = new FormData();
  pdfBuffers.forEach((buf, i) => {
    formData.append(
      "fileInput",
      new Blob([new Uint8Array(buf)], { type: "application/pdf" }),
      `doc${i}.pdf`
    );
  });

  const response = await fetch(
    `${STIRLING_PDF_URL}/api/v1/general/merge-pdfs`,
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Stirling-PDF merge failed (${response.status}): ${text.slice(0, 200)}`
    );
  }

  return Buffer.from(await response.arrayBuffer());
}
```

### Pattern 3: Helena Tool Extension (Read-Only Intelligence Tools)

**What:** New Helena read tools for Falldaten extraction and Akte summarization.
**When:** Helena Intelligence features.
**Why:** Fits the existing tool registry pattern -- add to `_read/`, register in `index.ts`.

```typescript
// New tool: src/lib/helena/tools/_read/read-falldaten.ts
export function createReadFalldatenTool(ctx: ToolContext): CoreTool<any, any> {
  return tool({
    description: "Liest die Falldaten einer Akte und das zugehoerige Template-Schema",
    parameters: z.object({ akteId: z.string() }),
    execute: async ({ akteId }) => {
      const akte = await ctx.prisma.akte.findUnique({
        where: { id: akteId },
        select: {
          falldaten: true,
          falldatenTemplateId: true,
          falldatenTemplate: {
            select: { schema: true, name: true },
          },
        },
      });
      return akte;
    },
  });
}
```

### Pattern 4: Export Service with Format Strategy

**What:** Centralized export service that accepts entity type, filters, and output format.
**When:** All CSV/XLSX export endpoints.
**Why:** DRY -- one query builder, multiple output formats.

```typescript
// src/lib/export/service.ts
export interface ExportOptions {
  format: "csv" | "xlsx";
  entity: string;
  filters: Record<string, unknown>;
  kanzleiId: string;
}

export async function generateExport(
  options: ExportOptions
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const data = await queryEntity(
    options.entity, options.filters, options.kanzleiId
  );

  if (options.format === "xlsx") {
    return generateXlsx(data, options.entity);
  }
  return generateCsv(data, options.entity);
}
```

### Pattern 5: CalDAV Connection Model (Mirror EmailKonto Pattern)

**What:** Encrypted credentials storage with per-user connections.
**When:** CalDAV sync setup.
**Why:** Exact same security model as existing EmailKonto -- proven pattern.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side BI Aggregation

**What:** Fetching all Akten/Rechnungen to the browser and computing KPIs in JavaScript.
**Why bad:** With 1000+ Akten, this sends megabytes of data and blocks the UI thread.
**Instead:** Use Prisma `aggregate()`, `groupBy()`, `_count`, `_sum` in API routes. Return only the final numbers.

### Anti-Pattern 2: Synchronous CalDAV Sync in API Route

**What:** Running CalDAV sync in a Next.js API route handler.
**Why bad:** CalDAV PROPFIND/REPORT can take 5-30 seconds per calendar. API routes have timeout limits. Multiple concurrent syncs would starve the server.
**Instead:** Use BullMQ queue with periodic cron job. Manual sync button adds a job to the queue, returns immediately.

### Anti-Pattern 3: Helena Global Chat with Full Tool Set

**What:** Giving the global (no-Akte) chat access to all 18 Helena tools.
**Why bad:** Tools like `read_akte_detail`, `read_dokumente_detail`, `create_draft_dokument` require an akteId context. They would fail or return confusing errors.
**Instead:** Define a `GLOBAL_TOOL_WHITELIST` for the global chat: `search_alle_akten`, `search_gesetze`, `search_urteile`, `search_muster`, `get_kosten_rules`. If user mentions a specific Akte, suggest switching to Akte-bound chat.

### Anti-Pattern 4: Direct Browser-to-Stirling PDF Requests

**What:** Having the browser call Stirling-PDF directly on port 8081.
**Why bad:** Exposes internal service, bypasses auth, no audit trail, CORS issues, no MinIO integration.
**Instead:** All PDF operations go through Next.js API routes. API fetches from MinIO, sends to Stirling, saves result to MinIO, creates Dokument record.

### Anti-Pattern 5: New npm Package for CSV Export

**What:** Adding a CSV library when the project already generates CSV manually.
**Why bad:** Existing pattern (team-dashboard export, audit-trail export) uses simple string concatenation for CSV. Adding a library adds dependency for no gain.
**Instead:** CSV via string concatenation (existing pattern). Only add ExcelJS for XLSX (which genuinely needs a library for the binary format).

## New vs Modified Components

### New Files/Directories

| Path | Purpose |
|------|---------|
| `src/app/(dashboard)/bi/page.tsx` | BI-Dashboard page |
| `src/app/api/bi/kpis/route.ts` | KPI aggregate endpoint |
| `src/app/api/bi/trends/route.ts` | Time-series trend endpoint |
| `src/app/api/export/[entity]/route.ts` | Generic export endpoint |
| `src/lib/export/service.ts` | Export service (CSV + XLSX generation) |
| `src/lib/export/xlsx-builder.ts` | ExcelJS workbook builder |
| `src/app/api/pdf/[operation]/route.ts` | PDF tools API (merge/split/rotate/etc.) |
| `src/app/(dashboard)/dokumente/pdf-tools/page.tsx` | PDF tools UI page |
| `src/lib/caldav/client.ts` | CalDAV client wrapper around tsdav |
| `src/lib/caldav/sync-engine.ts` | Bidirectional sync logic |
| `src/lib/queue/processors/caldav-sync.processor.ts` | BullMQ processor |
| `src/app/api/caldav/connections/route.ts` | CalDAV connection CRUD |
| `src/app/api/caldav/sync/route.ts` | Manual sync trigger |
| `src/app/api/akten/[id]/falldaten/auto-fill/route.ts` | Falldaten AI auto-fill |
| `src/app/api/akten/[id]/zusammenfassung/route.ts` | Akte AI summary |
| `src/lib/helena/tools/_read/read-falldaten.ts` | Helena Falldaten read tool |
| `src/components/bi/kpi-grid.tsx` | BI KPI tile grid component |
| `src/components/bi/trend-chart.tsx` | BI trend chart component |
| `src/components/bi/filter-bar.tsx` | BI date range + filter component |
| `src/components/pdf-tools/operation-modal.tsx` | PDF operation modal |

### Modified Files

| Path | Change | Reason |
|------|--------|--------|
| `src/lib/ocr/stirling-client.ts` | Add merge, split, rotate, compress, watermark, redact functions | PDF-Tools feature |
| `src/lib/helena/tools/index.ts` | Register `read_falldaten` tool | Helena Intelligence |
| `src/lib/helena/role-filter.ts` | Add global chat tool whitelist | Global KI-Chat |
| `src/app/api/ki-chat/route.ts` | Allow akteId=null for global chat | Global KI-Chat |
| `src/lib/queue/queues.ts` | Add `caldavSyncQueue` | CalDAV sync |
| `src/worker.ts` | Register CalDAV sync worker + cron | CalDAV sync |
| `prisma/schema.prisma` | Add CalDavConnection model + KalenderEintrag CalDAV fields | CalDAV sync |
| `src/app/(dashboard)/einstellungen/*/page.tsx` | CalDAV connection settings section | CalDAV config |
| `src/app/(dashboard)/layout.tsx` | Add BI nav item to sidebar | Navigation |

### No Changes Required

| Component | Why Unchanged |
|-----------|--------------|
| Docker Compose | Stirling-PDF already exists, no new services |
| Redis | Already used for caching, queues |
| MinIO | Already used for file storage |
| PostgreSQL | Existing, just new models/fields |
| Socket.IO | Not needed for any v0.8 feature |
| OnlyOffice | Not involved |
| Meilisearch | Not needed for BI (aggregates are SQL) |

## Scalability Considerations

| Concern | At 5 users (current) | At 50 users | At 500 users |
|---------|---------------------|-------------|-------------|
| BI queries | Direct Prisma aggregate, no cache needed | Redis cache (5min TTL) | Materialized views or pre-computed daily snapshots |
| PDF operations | Synchronous through API | Queue large operations (>10 pages) | Dedicated Stirling-PDF scaling (multiple containers) |
| CalDAV sync | 15-min cron, sequential per user | Parallel sync per user, 5-min interval | Connection pooling, webhook-based sync |
| XLSX export | In-memory ExcelJS | Streaming for >10k rows | BullMQ async + download link notification |
| Global KI-Chat | Single Ollama instance | Token budget per user/hour | Cloud provider fallback for peaks |

## Build Order (Dependency-Driven)

```
Phase 1: BI-Dashboard + Export (independent, no AI, no new deps beyond ExcelJS)
  - BI API routes (Prisma aggregates)
  - BI Dashboard page (GlassKpiCard + Recharts)
  - Export service (CSV + XLSX via ExcelJS)
  - Export API routes for all entities
  Rationale: Zero dependencies on other v0.8 features. Uses existing
             Recharts + GlassKpiCard. ExcelJS is the only new npm package.

Phase 2: PDF-Tools (independent, extends existing Stirling client)
  - Extend stirling-client.ts with 6 new operations
  - PDF operation API routes
  - PDF-Tools UI (document picker + operation modal)
  Rationale: Stirling-PDF already running. Just extending existing client.
             No schema changes. No worker changes.

Phase 3: Helena Intelligence (depends on existing Helena + Falldaten)
  - Falldaten auto-fill (generateObject with template schema)
  - Akte Zusammenfassung (generateText with context)
  - Global KI-Chat (modify ki-chat route for null akteId)
  - Template-Vorschlaege (rule-based, no LLM)
  - New Helena tool: read_falldaten
  Rationale: Builds on Helena tools pattern. Falldaten auto-fill needs
             understanding of generateObject pattern from Schriftsatz pipeline.

Phase 4: CalDAV-Sync (most complex, new external dependency)
  - CalDavConnection Prisma model + migration
  - KalenderEintrag CalDAV fields migration
  - CalDAV client wrapper (tsdav)
  - Sync engine with conflict resolution
  - BullMQ processor + cron registration
  - Settings UI for connection management
  Rationale: Most complex feature. New npm package (tsdav). New Prisma model.
             External service dependency (Google/Apple CalDAV servers).
             Bidirectional sync is inherently stateful and error-prone.
             Build last so other features ship independently.
```

## Sources

- Existing codebase: `src/lib/ocr/stirling-client.ts`, `src/worker.ts`, `src/lib/queue/queues.ts`, `src/lib/helena/tools/index.ts`, `src/lib/ai/provider.ts`
- [Stirling-PDF API docs](https://docs.stirlingpdf.com/API/) -- endpoint structure and authentication
- [Stirling-PDF GitHub](https://github.com/Stirling-Tools/Stirling-PDF) -- latest features and releases
- [tsdav](https://github.com/natelindev/tsdav) -- CalDAV/WebDAV client for Node.js (used by cal.com)
- [ts-caldav](https://github.com/KlautNet/ts-caldav) -- alternative CalDAV client (lighter, newer)
- [ExcelJS npm](https://www.npmjs.com/package/exceljs) -- XLSX generation with streaming support
- Existing export patterns: `src/app/api/admin/team-dashboard/export/route.ts`, `src/app/api/admin/audit-trail/export/route.ts`
