---
phase: 04-document-pipeline-ocr-rag-ingestion
plan: 01
subsystem: document-pipeline
tags: [ocr, stirling-pdf, bullmq, meilisearch, prisma, pgvector, drag-and-drop, upload]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation
    provides: BullMQ queue infrastructure, MinIO storage, Meilisearch, Redis
  - phase: 02-deadline-calculation-document-templates
    provides: Dokument model, DokumentVersion, document CRUD API
provides:
  - Stirling-PDF Docker sidecar for OCR and document conversion
  - OcrStatus enum and Dokument OCR fields in Prisma schema
  - DocumentChunk model for RAG embeddings with pgvector
  - DokumentTagKategorie model for document categorization
  - BullMQ queues for OCR, embedding, and preview processing
  - Stirling-PDF REST API client (ocrPdf, convertToPdf, convertImageToPdf)
  - OCR processor with MIME-type routing and auto-retry
  - Preview processor for non-PDF document PDF generation
  - Manual re-OCR endpoint for failed document retry
  - Admin pipeline dashboard API with queue stats and bulk retry
  - Enhanced Meilisearch index with OCR/document status filters and highlighting
  - Tag category CRUD API with admin-only create/delete
  - UploadProvider context with XHR progress tracking
  - Floating upload panel (Google Drive style)
  - Drag-and-drop upload zone on case documents tab
  - OCR status badge component with retry button
affects: [04-02, 04-03, 05-ai-agent]

# Tech tracking
tech-stack:
  added: [stirling-pdf, pdf-parse, pgvector]
  patterns: [ocr-pipeline, drag-and-drop-upload, floating-upload-panel, stream-to-buffer]

key-files:
  created:
    - src/lib/ocr/stirling-client.ts
    - src/lib/ocr/types.ts
    - src/lib/queue/processors/ocr.processor.ts
    - src/lib/queue/processors/preview.processor.ts
    - src/components/dokumente/ocr-status-badge.tsx
    - src/components/providers/upload-provider.tsx
    - src/components/dokumente/upload-panel.tsx
    - src/app/api/dokumente/[id]/ocr/route.ts
    - src/app/api/admin/pipeline/route.ts
    - src/app/api/dokumente/tags/route.ts
    - src/app/(dashboard)/einstellungen/dokument-tags/page.tsx
  modified:
    - docker-compose.yml
    - prisma/schema.prisma
    - src/lib/queue/queues.ts
    - src/lib/meilisearch.ts
    - src/worker.ts
    - src/app/api/akten/[id]/dokumente/route.ts
    - src/components/dokumente/dokumente-tab.tsx
    - src/app/(dashboard)/layout.tsx
    - .env.example

key-decisions:
  - "Stirling-PDF skip-text OCR mode to avoid re-processing already-searchable PDFs"
  - "pdf-parse (via require) for text extraction from OCR'd PDFs with regex fallback"
  - "streamToBuffer handles AWS SDK SdkStreamMixin, Blob, ReadableStream, and Node.js Readable"
  - "XHR for upload progress tracking (fetch API lacks upload progress events)"
  - "dragCounter ref pattern to prevent false drag-leave events on child elements"
  - "Upload provider mounted after NotificationProvider for Socket.IO OCR event access"
  - "OCR concurrency:1 (memory-heavy), preview concurrency:2 in worker"
  - "Text files (plain, CSV, HTML) bypass OCR and get indexed directly"

patterns-established:
  - "OCR pipeline: upload -> queue -> process -> index -> embed chain"
  - "streamToBuffer: universal AWS SDK/Web/Node stream to Buffer conversion"
  - "UploadProvider: global upload state with XHR progress and Socket.IO status updates"
  - "Drag-and-drop: dragCounter ref pattern for reliable drag zone detection"

requirements-completed: [REQ-IF-004, REQ-DV-004, REQ-DV-005]

# Metrics
duration: 11min
completed: 2026-02-24
---

# Phase 04 Plan 01: Document Pipeline (OCR + RAG Ingestion) Summary

**Stirling-PDF OCR pipeline with BullMQ processing, drag-and-drop upload, floating progress panel, and Meilisearch full-text indexing**

## Performance

- **Duration:** 11 min
- **Started:** 2026-02-24T16:45:41Z
- **Completed:** 2026-02-24T16:56:31Z
- **Tasks:** 3
- **Files modified:** 22

## Accomplishments
- Complete OCR processing pipeline: upload triggers BullMQ job, Stirling-PDF processes PDF/image/office/text, result indexed in Meilisearch, chains to embedding queue
- Drag-and-drop upload zone on case documents tab with visual overlay and native file picker, floating Google Drive-style upload panel
- Admin pipeline dashboard with queue stats, failed document listing, and bulk retry
- Tag category management with predefined German legal document tags (Schriftsatz, Vertrag, Rechnung, etc.)

## Task Commits

Each task was committed atomically:

1. **Task 1: Docker + Schema + Queues + Stirling-PDF Client** - `a7d29c0` (feat)
2. **Task 2: OCR Processor + Preview Processor + Worker Registration + Upload Pipeline + APIs** - `145a64f` (feat)
3. **Task 3: OCR Badge + Upload Provider + Upload Panel + Drag-and-Drop Zone + Tag Settings Page** - `c581d5c` (feat)

## Files Created/Modified

### Created
- `src/lib/ocr/stirling-client.ts` - Stirling-PDF REST API client (ocrPdf, convertToPdf, convertImageToPdf, checkHealth)
- `src/lib/ocr/types.ts` - OCR/embedding/preview job data interfaces
- `src/lib/queue/processors/ocr.processor.ts` - OCR job processor with MIME routing, retry, Meilisearch indexing
- `src/lib/queue/processors/preview.processor.ts` - PDF preview generator for non-PDF documents
- `src/components/dokumente/ocr-status-badge.tsx` - Color-coded OCR status badge with retry button
- `src/components/providers/upload-provider.tsx` - Upload context with XHR progress and Socket.IO events
- `src/components/dokumente/upload-panel.tsx` - Floating bottom-right upload panel (Google Drive style)
- `src/app/api/dokumente/[id]/ocr/route.ts` - Manual OCR retry endpoint
- `src/app/api/admin/pipeline/route.ts` - Admin pipeline dashboard (queue stats, bulk retry)
- `src/app/api/dokumente/tags/route.ts` - Tag category CRUD API
- `src/app/(dashboard)/einstellungen/dokument-tags/page.tsx` - Tag management settings page

### Modified
- `docker-compose.yml` - Added Stirling-PDF sidecar and optional Ollama service
- `prisma/schema.prisma` - OcrStatus enum, Dokument OCR fields, DocumentChunk, DokumentTagKategorie, pgvector extension
- `src/lib/queue/queues.ts` - Added ocrQueue, embeddingQueue, previewQueue
- `src/lib/meilisearch.ts` - Enhanced filters, highlighting, ocrStatus/dokumentStatus fields
- `src/worker.ts` - Registered OCR and preview workers with Socket.IO notifications
- `src/app/api/akten/[id]/dokumente/route.ts` - Upload enqueues OCR jobs, 100MB limit, text file direct indexing
- `src/components/dokumente/dokumente-tab.tsx` - Drag-and-drop zone, file picker, OCR badges
- `src/app/(dashboard)/layout.tsx` - Mounted UploadProvider and UploadPanel
- `.env.example` - Added STIRLING_PDF_URL, OLLAMA_URL, EMBEDDING_MODEL

## Decisions Made
- **Stirling-PDF skip-text OCR**: Automatically detects already-searchable PDFs and skips redundant OCR processing
- **pdf-parse with require()**: Used CommonJS require to avoid ESM import issues; includes regex fallback for basic text extraction
- **Universal streamToBuffer**: Handles AWS SDK v3 SdkStreamMixin (transformToByteArray), Blob, Web ReadableStream, and Node.js Readable
- **XHR for uploads**: Fetch API does not support upload progress events; XHR enables per-file progress bars
- **dragCounter pattern**: Prevents false drag-leave events when cursor moves between child elements in the drop zone
- **OCR concurrency 1**: Memory-intensive Stirling-PDF OCR limited to one concurrent job; preview gets concurrency 2
- **Text files skip OCR**: Plain text, CSV, HTML, JSON read directly and indexed without Stirling-PDF processing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Buffer to Blob TypeScript compatibility**
- **Found during:** Task 1 (Stirling-PDF client)
- **Issue:** `new Blob([buffer])` fails TypeScript checks due to Buffer/ArrayBuffer incompatibility
- **Fix:** Wrapped buffers with `new Uint8Array(buffer)` before creating Blobs
- **Files modified:** src/lib/ocr/stirling-client.ts
- **Committed in:** a7d29c0

**2. [Rule 3 - Blocking] Regenerated Prisma client after schema changes**
- **Found during:** Task 2 (OCR processor)
- **Issue:** New OcrStatus enum and fields not recognized by TypeScript after schema change
- **Fix:** Ran `npx prisma generate` to regenerate the Prisma client
- **Committed in:** 145a64f

**3. [Rule 1 - Bug] Fixed S3 stream type compatibility in processors**
- **Found during:** Task 2 (OCR/preview processors)
- **Issue:** AWS SDK v3 returns SdkStreamMixin, not standard ReadableStream
- **Fix:** Created universal streamToBuffer that handles SdkStreamMixin, Blob, Web/Node streams
- **Files modified:** src/lib/queue/processors/ocr.processor.ts, src/lib/queue/processors/preview.processor.ts
- **Committed in:** 145a64f

**4. [Rule 3 - Blocking] Installed pdf-parse dependency**
- **Found during:** Task 2 (OCR processor text extraction)
- **Issue:** pdf-parse not installed, needed for extracting text from OCR'd PDFs
- **Fix:** `npm install pdf-parse @types/pdf-parse`
- **Files modified:** package.json, package-lock.json
- **Committed in:** 145a64f

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking)
**Impact on plan:** All fixes necessary for type safety and correct operation. No scope creep.

## Issues Encountered
- Database not running locally, so `prisma db push` could not apply schema changes. Schema validates correctly and changes will apply on next Docker Compose up.

## User Setup Required
None - Stirling-PDF runs automatically via Docker Compose. No external API keys needed.

## Next Phase Readiness
- OCR pipeline infrastructure ready for Plan 02 (RAG embedding pipeline)
- DocumentChunk model with pgvector column ready for embedding storage
- embeddingQueue registered and OCR processor chains to it after processing
- Meilisearch index enhanced for full-text search with OCR content

## Self-Check: PASSED

All 11 created files verified present. All 3 task commits (a7d29c0, 145a64f, c581d5c) verified in git log.

---
*Phase: 04-document-pipeline-ocr-rag-ingestion*
*Completed: 2026-02-24*
