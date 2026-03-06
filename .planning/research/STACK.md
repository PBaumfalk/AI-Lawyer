# Technology Stack

**Project:** AI-Lawyer v0.8 Intelligence & Tools
**Researched:** 2026-03-06

## Executive Summary

v0.8 adds five feature clusters to a 141k LOC TypeScript codebase. The good news: most capabilities build on existing infrastructure. The new dependencies are limited to **3 runtime packages** (`exceljs`, `tsdav`, `ical-generator`) plus one dev-dependency (`@types/exceljs` is not needed -- ExcelJS ships its own types). No new Docker services required -- Stirling-PDF is already running with all needed API endpoints available. Helena Intelligence features use the existing Vercel AI SDK v4 + Prisma patterns. The BI-Dashboard uses existing Recharts.

---

## Recommended Stack

### Core Technologies (No Changes)

Existing stack handles BI-Dashboard, Helena Intelligence, and PDF-Tools without modifications.

| Technology | Version | v0.8 Role | Why Sufficient |
|---|---|---|---|
| Next.js 14+ (App Router) | ^14.2.21 | API routes for BI queries, PDF-tool operations, CalDAV sync, export endpoints | Same route patterns as v0.4-v0.7 |
| TypeScript | ^5.7.2 | Type-safe BI aggregation, CalDAV event mapping, export schemas | Already in use |
| Tailwind CSS + shadcn/ui | ^3.4.17 | BI-Dashboard KPI cards, filter bars, charts layout | Glass design tokens already established |
| PostgreSQL 16 + Prisma | ^5.22.0 | BI aggregation queries, CalDAV sync state tables, export queries | `$queryRaw` available for complex aggregations. New models for CalDAV sync state (~3 tables). |
| Recharts | ^3.7.0 | Trend charts for BI-Dashboard (Akten, Finanzen, Fristen, Helena KPIs) | Already used in Team Dashboard backlog-trend-chart. Extend with BarChart, PieChart, AreaChart. |
| Vercel AI SDK v4 | ^4.3.19 | Helena Intelligence: `generateObject` for Falldaten auto-fill, `generateText` for Fallzusammenfassung | Same patterns as Schriftsatz pipeline (v0.2). `generateObject` with Zod schema for structured extraction. |
| BullMQ | ^5.70.1 | CalDAV sync cron job, BI cache refresh cron, export queue for large datasets | 16+ workers already registered. Same `upsertJobScheduler` pattern. |
| Redis + Socket.IO | 5.9.3 / 4.8.3 | Real-time BI dashboard updates, CalDAV sync status notifications | Existing broadcast patterns |
| MinIO | existing | Source for PDF files (PDF-Tools read/write), export file staging | Already integrated via `@aws-sdk/client-s3` |
| Stirling-PDF | latest-fat | PDF merge, split, rotate, rearrange, compress, watermark, redact -- ALL via existing REST API | Already running as Docker sidecar. `stirling-client.ts` pattern established. |
| Zod | ^3.23.8 | Validate BI filter params, CalDAV event schemas, export options, Helena Intelligence output schemas | Same pattern as FalldatenTemplate and Schriftsatz |
| pdf-lib | ^1.17.1 | Client-side PDF page reorder preview (lightweight, before Stirling-PDF server call) | Already installed |
| date-fns / date-fns-tz | ^4.1.0 / ^3.2.0 | BI date range filters, CalDAV date/timezone handling | Already installed |

### New Dependencies (3 packages)

| Library | Version | Purpose | Why This One |
|---|---|---|---|
| `exceljs` | ^4.4.0 | XLSX export for Akten, Kontakte, Finanzen, BI-Reports | 4.7M weekly downloads, streaming support for large datasets, cell styling for professional reports, built-in TypeScript types. The only serious contender is SheetJS (`xlsx`) which has licensing concerns (Community Edition is limited). ExcelJS is MIT-licensed, actively maintained, and handles everything needed: worksheets, formatting, auto-filters, freeze panes. |
| `tsdav` | ^2.1.8 | CalDAV protocol client for bidirectional sync with Google/Outlook/Apple Calendar | Native TypeScript, zero dependencies, 324 GitHub stars, 36k weekly downloads. End-to-end tested with Apple and Google Cloud. Supports sync-token and ctag/etag for incremental sync. The only mature TypeScript CalDAV client. `ts-caldav` (v0.2.8) is too new and less battle-tested. `dav` is JavaScript-only and unstable API. |
| `ical-generator` | ^10.0.0 | Generate iCalendar VCALENDAR/VEVENT objects for CalDAV PUT operations | tsdav handles the CalDAV transport protocol but does NOT parse or generate iCalendar data. `ical-generator` creates RFC 5545 compliant VCALENDAR strings. 1.3M weekly downloads, actively maintained, TypeScript types included. Needed to convert Prisma Frist/Termin models into VEVENT format for CalDAV servers. |

### Existing Libraries Reused (Key v0.8 Roles)

| Library | Version | v0.8 Role | How Used |
|---|---|---|---|
| Recharts | ^3.7.0 | BI-Dashboard: LineChart (trends), BarChart (Akten by Sachgebiet), PieChart (status distribution), AreaChart (financial trends) | Extend from single backlog-trend-chart to full BI dashboard with 6+ chart types. Glass-styled tooltips already established. |
| Vercel AI SDK (`ai`) | ^4.3.19 | Helena Intelligence: `generateObject()` with Zod schema for Falldaten auto-fill from documents; `generateText()` for Fallzusammenfassung; `streamText()` for global KI-Chat | Same provider factory, same model switching. No new AI SDK features needed. |
| Zod | ^3.23.8 | BI filter validation, export options schema, CalDAV event mapping schema, Helena `generateObject` output schemas | Exact same pattern as Schriftsatz pipeline schemas |
| pdf-lib | ^1.17.1 | Lightweight client-side page count/thumbnail extraction for PDF-Tools UI before heavy Stirling-PDF calls | Already used for PDF manipulation. Use for page counting before merge/split preview. |
| fast-xml-parser | ^5.3.8 | Parse CalDAV XML responses if tsdav returns raw XML in edge cases | Already installed. Fallback only -- tsdav handles most XML parsing internally. |
| Motion/React | ^12.34.3 | BI-Dashboard KPI card animations, PDF-Tools drag-and-drop reorder animations | Same spring physics patterns as existing GlassKpiCard |
| Sonner | ^1.7.1 | Success/error toasts for PDF operations, export completion, CalDAV sync status | Same toast pattern |

---

## Feature-Specific Stack Decisions

### 1. BI-Dashboard (Zero New Dependencies)

The BI-Dashboard uses existing Recharts + Prisma aggregation queries + GlassKpiCard components.

**Architecture:**
- Server Components for initial data load (Prisma aggregation queries)
- Client Components for interactive charts (Recharts) and filter bar
- API routes for filtered/date-ranged queries
- Optional: BullMQ cron for pre-computing expensive aggregations into a `BiCache` table

**KPI Data Sources (all existing Prisma models):**

| KPI Category | Source Models | Query Pattern |
|---|---|---|
| Akten | Akte, AkteStatus | `groupBy` + `count` |
| Finanzen | Rechnung, Aktenkonto, Zeiterfassung | `aggregate` + `sum` |
| Fristen | KalenderEintrag (FRIST type) | `count` with date filters |
| Helena | HelenaAlert, HelenaDraft, AiUsage | `count` + `groupBy` |
| E-Mail | Email | `count` with veraktet filter |

**Chart Types (all Recharts):**

| Chart | Recharts Component | Data |
|---|---|---|
| Akten-Trend (monthly) | `<LineChart>` | New Akten per month |
| Status-Verteilung | `<PieChart>` | Akten by status |
| Umsatz-Trend | `<AreaChart>` | Monthly revenue |
| Fristen-Heatmap (weekly) | `<BarChart>` | Fristen per week |
| Helena-Nutzung | `<LineChart>` | AI tokens per week |
| Top-Sachgebiete | `<BarChart>` | Akten by Sachgebiet |

**Confidence:** HIGH -- Recharts is already proven in the codebase, Prisma aggregation is standard.

### 2. Helena Intelligence (Zero New Dependencies)

All Helena Intelligence features build on existing Vercel AI SDK v4 patterns.

**Falldaten Auto-Fill:**

```typescript
// Same pattern as Schriftsatz generateObject
const result = await generateObject({
  model: getModel(),
  schema: falldatenAutoFillSchema, // Zod schema matching FalldatenTemplate fields
  prompt: `Extract case data from these documents for template "${template.name}": ${chunks.join('\n')}`,
});
```

Uses existing RAG pipeline to retrieve document chunks, then `generateObject` to extract structured data matching the Falldatenblatt template schema. The template schema is already stored in `FalldatenTemplate.schema` as JSON.

**Fallzusammenfassung:**

```typescript
const { text } = await generateText({
  model: getModel(),
  prompt: `Erstelle eine Fallzusammenfassung fuer Akte ${akte.aktenzeichen}: ${context}`,
  maxTokens: 2000,
});
```

Uses existing Helena Memory context + document chunks. Output stored as `AktenActivity` with `typ: 'ZUSAMMENFASSUNG'`.

**Globaler KI-Chat (aktenuebergreifend):**

The existing `/api/ki-chat/route.ts` is Akte-scoped. The global chat needs a new route `/api/ki-chat/global/route.ts` that:
- Does NOT require `akteId`
- Uses cross-Akte Meilisearch search instead of per-Akte RAG
- Still uses `streamText()` with the same provider factory
- Stores conversation in `ChatNachricht` with `akteId: null`

**Template-Vorschlaege:**

```typescript
const { object } = await generateObject({
  model: getModel(),
  schema: z.object({
    templateId: z.string(),
    confidence: z.number(),
    reason: z.string(),
  }).array(),
  prompt: `Given case type "${akte.sachgebiet}" and parties ${beteiligte}, suggest relevant Falldatenblatt templates from: ${availableTemplates}`,
});
```

Pure LLM classification against existing `FalldatenTemplate` list. No new infrastructure.

**Confidence:** HIGH -- all patterns are proven in v0.2 (Schriftsatz pipeline uses identical `generateObject`/`generateText` calls).

### 3. PDF-Tools via Stirling-PDF (Zero New Dependencies)

Stirling-PDF is already running as a Docker sidecar (`stirlingtools/stirling-pdf:latest-fat`). The existing `stirling-client.ts` pattern (multipart/form-data POST, Buffer response) applies to ALL PDF-Tool operations.

**New functions to add to `stirling-client.ts`:**

| Operation | Stirling-PDF Endpoint | Key Parameters |
|---|---|---|
| Merge | `POST /api/v1/general/merge-pdfs` | `fileInput` (multiple files), `sortType` |
| Split | `POST /api/v1/general/split-pages` | `fileInput`, `pageNumbers` (e.g., "1,3,5-8") |
| Rotate | `POST /api/v1/general/rotate-pdf` | `fileInput`, `angle` (90, 180, 270) |
| Rearrange | `POST /api/v1/general/rearrange-pages` | `fileInput`, `pageOrder` (e.g., "3,1,2,4") |
| Compress | `POST /api/v1/misc/compress-pdf` | `fileInput`, `optimizeLevel` (1-5) |
| Watermark | `POST /api/v1/security/add-watermark` | `fileInput`, `watermarkText`, `fontSize`, `rotation`, `opacity` |
| Redact | `POST /api/v1/security/auto-redact` | `fileInput`, `listOfText` (text to redact), `useRegex` |

Each function follows the identical pattern of the existing `ocrPdf()`:

```typescript
export async function mergePdfs(pdfBuffers: Buffer[], filenames: string[]): Promise<Buffer> {
  const formData = new FormData();
  pdfBuffers.forEach((buf, i) => {
    formData.append('fileInput', new Blob([new Uint8Array(buf)], { type: 'application/pdf' }), filenames[i]);
  });
  const response = await fetch(`${STIRLING_PDF_URL}/api/v1/general/merge-pdfs`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error(`Stirling-PDF merge failed (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}
```

**No Docker changes needed.** The existing `stirling-pdf` service with `DOCKER_ENABLE_SECURITY: "false"` exposes all API endpoints. The `latest-fat` image includes all dependencies (LibreOffice, Tesseract, etc.) needed for these operations.

**Confidence:** HIGH -- `stirling-client.ts` already proves the pattern works. Adding 7 more functions is mechanical.

### 4. CalDAV-Sync (2 New Dependencies: `tsdav` + `ical-generator`)

Bidirectional CalDAV sync is the most architecturally complex new feature. It requires:

1. **tsdav** -- CalDAV transport (PROPFIND, REPORT, PUT, DELETE against CalDAV servers)
2. **ical-generator** -- Convert Prisma Frist/Termin models to RFC 5545 VEVENT format
3. **New Prisma models** -- Track sync state per user per calendar

**Sync Architecture:**

```
Prisma KalenderEintrag <---> CalDAV Sync Engine <---> External CalDAV Server
                                    |
                              BullMQ Cron (every 5 min)
                                    |
                              tsdav (transport)
                              ical-generator (serialization)
```

**New Prisma Models:**

| Model | Purpose | Key Fields |
|---|---|---|
| `CalDavAccount` | User's external calendar connection | `userId`, `serverUrl`, `authType` (BASIC/OAUTH), `credentials` (encrypted), `provider` (GOOGLE/APPLE/OUTLOOK/GENERIC) |
| `CalDavCalendar` | Individual calendar within an account | `accountId`, `calendarUrl`, `ctag`, `syncToken`, `displayName`, `color` |
| `CalDavSyncMapping` | Maps KalenderEintrag to remote event | `kalenderEintragId`, `calendarId`, `remoteUid`, `remoteEtag`, `lastSyncedAt` |

**Sync Strategy:**

1. **Outbound (Prisma -> CalDAV):** When a Frist/Termin is created/updated/deleted, enqueue a `caldav-push` job. The worker converts to VEVENT via `ical-generator` and PUTs via `tsdav`.
2. **Inbound (CalDAV -> Prisma):** BullMQ cron every 5 minutes calls `tsdav.syncCalendars()` with stored sync-token. Changed events are parsed and upserted into `KalenderEintrag` with `quelle: 'EXTERN'` flag.
3. **Conflict Resolution:** Last-write-wins with timestamp comparison. External changes overwrite unless the local entry was modified within the last 60 seconds (prevents ping-pong).

**Provider-Specific Notes:**

| Provider | Auth | CalDAV URL | Notes |
|---|---|---|---|
| Google | OAuth2 (refresh token) | `https://apidata.googleusercontent.com/caldav/v2/` | Requires Google Cloud Console app. tsdav has built-in Google OAuth helper. |
| Apple iCloud | Basic (app-specific password) | `https://caldav.icloud.com/` | User generates app-specific password in Apple ID settings. tsdav tested with Apple. |
| Outlook/Exchange | OAuth2 or Basic | `https://outlook.office365.com/caldav/` | Microsoft CalDAV support is limited; may need Graph API fallback for some features. |
| Generic (Nextcloud, etc.) | Basic | User-provided URL | Standard CalDAV, well-supported by tsdav. |

**Credential Storage:** Encrypt credentials at rest using the existing `EMAIL_ENCRYPTION_KEY` pattern (AES-256-GCM, same as IMAP credentials).

**Confidence:** MEDIUM -- tsdav is well-tested with Google/Apple, but bidirectional sync has inherent complexity (conflict resolution, timezone edge cases, recurring events). Outlook CalDAV support is notably weaker than Google/Apple. Recommend starting with Google + Apple, adding Outlook later.

### 5. CSV/XLSX Export (1 New Dependency: `exceljs`)

**CSV Export:** Use Node.js built-in string concatenation. No library needed for CSV -- the existing DATEV CSV export pattern (`src/lib/finance/datev.ts`) proves CSV generation without dependencies.

**XLSX Export:** ExcelJS provides:
- Multiple worksheets (one per data category)
- Cell formatting (headers bold, dates formatted, currency aligned)
- Auto-filter on header row
- Freeze panes (first row frozen)
- Streaming writer for large datasets (10k+ rows)
- Buffer output (no filesystem needed -- stream directly to HTTP response)

**Export Endpoints:**

| Export | Data Source | Format | Notes |
|---|---|---|---|
| Akten-Liste | `Akte` with relations | CSV + XLSX | Columns: Aktenzeichen, Sachgebiet, Status, Mandant, Gegner, Anwalt, Erstellt |
| Kontakte | `Kontakt` | CSV + XLSX | All contact fields, respect DSGVO (no portal passwords) |
| Finanzen | `Rechnung`, `Aktenkonto`, `Zeiterfassung` | CSV + XLSX | Multiple worksheets in XLSX: Rechnungen, Kontobewegungen, Zeiten |
| BI-Report | Aggregated KPI data | XLSX | Current dashboard snapshot with charts data |

**Response Pattern:**

```typescript
import ExcelJS from 'exceljs';

export async function GET(req: Request) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Akten');

  sheet.columns = [
    { header: 'Aktenzeichen', key: 'az', width: 20 },
    { header: 'Sachgebiet', key: 'sachgebiet', width: 25 },
    // ...
  ];

  const akten = await prisma.akte.findMany({ /* ... */ });
  akten.forEach(akte => sheet.addRow(akte));

  // Style header row
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: 'A1', to: `G1` };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="akten-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx"`,
    },
  });
}
```

**For large exports (10k+ rows):** Use ExcelJS streaming writer + BullMQ queue. The worker generates the file, uploads to MinIO, and sends a download link via Socket.IO.

**Confidence:** HIGH -- ExcelJS is battle-tested (4.7M weekly downloads), CSV is trivial with existing patterns.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| XLSX Export | `exceljs` ^4.4.0 | `xlsx` (SheetJS) | SheetJS Community Edition has limited features; Pro version is paid. ExcelJS is fully MIT-licensed with styling, streaming, and auto-filter support. |
| XLSX Export | `exceljs` ^4.4.0 | `xlsx-populate` | Less maintained, smaller community. ExcelJS has 10x more weekly downloads. |
| CalDAV Client | `tsdav` ^2.1.8 | `ts-caldav` ^0.2.8 | Too new (v0.2.8, first stable 3 days ago). Not battle-tested. tsdav is used by Cal.com (enterprise calendar platform). |
| CalDAV Client | `tsdav` ^2.1.8 | `dav` | JavaScript-only, unstable API (README warns about frequent breaking changes). No TypeScript types. |
| iCal Generation | `ical-generator` ^10.0.0 | `ics` | `ics` is simpler but `ical-generator` handles VTIMEZONE, RRULE (recurring events), and VALARM (reminders) which are needed for Fristen. |
| iCal Generation | `ical-generator` ^10.0.0 | Manual string building | RFC 5545 is deceptively complex (line folding, escaping, timezone handling). A library prevents subtle compliance bugs. |
| BI Charts | Recharts (existing) | D3.js | D3 is low-level; Recharts wraps D3 with React components. Already installed and proven. |
| BI Charts | Recharts (existing) | Chart.js / react-chartjs-2 | Would add a second charting library. Recharts already handles all needed chart types. |
| PDF Manipulation | Stirling-PDF API (existing) | pdf-lib (existing) | pdf-lib can do merge/split/rotate in-process, but Stirling-PDF adds watermark, redact, and compress which pdf-lib cannot. Consistent API surface via one service is cleaner. |
| Global State | React state + fetch | TanStack Query / SWR | The codebase uses `fetch()` + `useEffect` + `router.refresh()` everywhere. Adding a data-fetching library now would create two patterns. Not worth the migration cost. |

---

## Installation

```bash
# New runtime dependencies (3 packages)
npm install exceljs tsdav ical-generator

# No new dev dependencies needed -- all three ship TypeScript types

# After Prisma schema changes for CalDAV:
npx prisma migrate dev --name v08-caldav-sync-accounts
npx prisma generate
```

---

## Docker Compose Changes

**No new services.** Stirling-PDF already runs with all needed endpoints.

**No configuration changes needed** for Stirling-PDF -- `DOCKER_ENABLE_SECURITY: "false"` means all API endpoints are open to the internal Docker network.

**Optional:** If CalDAV sync to Google Calendar requires OAuth callback, the `app` service may need an additional env var (`GOOGLE_CALDAV_CLIENT_ID`, `GOOGLE_CALDAV_CLIENT_SECRET`). This is a runtime configuration change, not a Docker service change.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|---|---|---|
| `xlsx` (SheetJS) | Community Edition licensing restrictions; Pro features required for styling | `exceljs` (MIT, full styling) |
| `csv-writer` / `csv-stringify` / `papaparse` | Overkill for CSV generation. CSV is just comma-separated strings. | Manual CSV string building (same as DATEV export) |
| `dav` npm package | Unstable API, no TypeScript, maintainer warns about breaking changes | `tsdav` (TypeScript-native, stable API) |
| `node-ical` | For parsing inbound iCal -- tsdav returns calendar objects, minimal parsing needed | `tsdav` built-in response handling |
| `@microsoft/microsoft-graph-client` | Graph API is an alternative for Outlook CalDAV, but adds massive Microsoft dependency | `tsdav` with CalDAV protocol (works for most Outlook configurations) |
| `chartjs` / `d3` / `plotly` | Second charting library alongside Recharts | Recharts (existing, proven) |
| TanStack Query / SWR | Would introduce a second data-fetching pattern | `fetch()` + `useEffect` (existing pattern) |
| `zustand` / `jotai` | No global state pattern exists in codebase | React state + `router.refresh()` |
| `react-dnd` / `dnd-kit` | For PDF page reorder drag-and-drop. Use HTML5 Drag and Drop API or simple button-based reorder. | Native HTML5 DnD or arrow-button reorder (simpler, no dependency) |
| Additional Docker services | No new services needed for v0.8 | Existing Stirling-PDF, Redis, PostgreSQL handle all new features |

---

## Prisma Schema Changes Summary

### New Models (CalDAV only)

| Model | Fields (approx.) | Purpose |
|---|---|---|
| `CalDavAccount` | ~8 | User's external calendar connection (URL, auth, provider) |
| `CalDavCalendar` | ~8 | Individual calendar with sync state (ctag, syncToken) |
| `CalDavSyncMapping` | ~6 | Maps local KalenderEintrag to remote CalDAV event UID |

### Modified Models

| Model | Change | Purpose |
|---|---|---|
| `KalenderEintrag` | Add `quelle` enum field (INTERN/EXTERN) | Distinguish locally-created vs. CalDAV-synced events |
| `KalenderEintrag` | Add `externalUid` optional field | Store CalDAV event UID for sync mapping |

### New Enums

| Enum | Values |
|---|---|
| `CalDavProvider` | GOOGLE, APPLE, OUTLOOK, GENERIC |
| `CalDavAuthType` | BASIC, OAUTH2 |
| `KalenderQuelle` | INTERN, EXTERN |

---

## BullMQ Queues (New)

| Queue | Schedule | Processor Logic |
|---|---|---|
| `caldav-sync` (inbound) | `*/5 * * * *` (every 5 min) | For each CalDavAccount: call `tsdav.syncCalendars()`, detect changed/deleted events, upsert KalenderEintrag |
| `caldav-push` (outbound) | On-demand (triggered by KalenderEintrag create/update/delete) | Convert KalenderEintrag to VEVENT via `ical-generator`, PUT/DELETE via `tsdav` |
| `bi-cache-refresh` | `0 */6 * * *` (every 6 hours) | Pre-compute expensive BI aggregations into cache table |
| `export` | On-demand | Generate large XLSX exports, upload to MinIO, notify user via Socket.IO |

---

## Socket.IO Events (New)

| Event | Direction | Room Target | Payload |
|---|---|---|---|
| `export:ready` | server -> client | `user:{userId}` | `{ exportId, filename, downloadUrl }` |
| `caldav:sync-status` | server -> client | `user:{userId}` | `{ accountId, status: 'syncing' \| 'done' \| 'error', message? }` |
| `bi:refresh` | server -> client | all role rooms | `{ timestamp }` (triggers client-side refetch) |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---|---|---|
| `exceljs@^4.4.0` | Node.js 16+, any React version | Server-side only (API routes). Ships TypeScript types. No browser dependency. |
| `tsdav@^2.1.8` | Node.js 16+, TypeScript 4.5+ | Zero dependencies. Server-side only. Used by Cal.com in production. |
| `ical-generator@^10.0.0` | Node.js 16+, TypeScript 4.5+ | Server-side only. RFC 5545 compliant VCALENDAR generation. |
| Recharts ^3.7.0 (existing) | React 18, existing setup | No version change needed. Already at latest. |
| Vercel AI SDK ^4.3.19 (existing) | All new Helena Intelligence features | No version change needed. `generateObject`, `generateText`, `streamText` all available. |
| Stirling-PDF latest-fat (existing) | All PDF-Tool API endpoints | No version or config change needed. |

---

## Confidence Assessment

| Area | Confidence | Reason |
|---|---|---|
| BI-Dashboard | HIGH | Recharts + Prisma aggregation, both proven in codebase |
| Helena Intelligence | HIGH | Identical `generateObject`/`generateText` patterns as v0.2 Schriftsatz |
| PDF-Tools | HIGH | Stirling-PDF already running, `stirling-client.ts` pattern proven, 7 new functions are mechanical |
| CSV Export | HIGH | Manual string building, same pattern as DATEV export |
| XLSX Export | HIGH | ExcelJS is mature (4.7M weekly downloads), well-documented, MIT-licensed |
| CalDAV (Google + Apple) | MEDIUM | tsdav is tested with Google/Apple, but bidirectional sync has inherent complexity (conflicts, timezones, recurring events) |
| CalDAV (Outlook) | LOW | Microsoft CalDAV support is limited and inconsistent. May need Graph API fallback. Flag for deeper research in phase. |

---

## Sources

- [ExcelJS npm](https://www.npmjs.com/package/exceljs) -- v4.4.0, 4.7M weekly downloads, MIT license
- [ExcelJS GitHub](https://github.com/exceljs/exceljs) -- streaming XLSX writer, cell styling, auto-filter
- [tsdav npm](https://www.npmjs.com/package/tsdav) -- v2.1.8, 36k weekly downloads, zero dependencies
- [tsdav GitHub](https://github.com/natelindev/tsdav) -- 324 stars, CalDAV/CardDAV/WebDAV, tested with Google + Apple
- [tsdav Documentation](https://tsdav.vercel.app/) -- smart calendar sync, OAuth helpers, sync-token support
- [ical-generator npm](https://www.npmjs.com/package/ical-generator) -- v10.0.0, 1.3M weekly downloads
- [Stirling-PDF API Reference (DeepWiki)](https://deepwiki.com/Stirling-Tools/Stirling-PDF/5-api-reference) -- full endpoint list: merge, split, rotate, rearrange, compress, watermark, redact
- [Stirling-PDF Official Docs](https://docs.stirlingpdf.com/API/) -- multipart/form-data pattern, Swagger UI
- [CalDAV Sync Protocol (sabre/dav)](https://sabre.io/dav/building-a-caldav-client/) -- ctag/etag sync strategy, WebDAV-Sync (RFC 6578)
- Codebase analysis (all HIGH confidence):
  - `src/lib/ocr/stirling-client.ts` -- existing Stirling-PDF client pattern (OCR, convert, health check)
  - `src/components/admin/team-dashboard/backlog-trend-chart.tsx` -- existing Recharts usage
  - `src/lib/ai/provider.ts` -- AI provider factory for multi-provider support
  - `src/lib/helena/schriftsatz/` -- `generateObject` pattern for structured AI output
  - `src/app/api/ki-chat/route.ts` -- existing chat route (Akte-scoped, to be extended for global)
  - `docker-compose.yml` -- Stirling-PDF service config (`latest-fat`, security disabled)
  - `package.json` -- full dependency audit confirming 3 new packages needed

---

*Stack research for: AI-Lawyer v0.8 -- Intelligence & Tools*
*Researched: 2026-03-06*
