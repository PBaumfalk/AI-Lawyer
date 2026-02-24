---
phase: 04-document-pipeline-ocr-rag-ingestion
plan: 02
subsystem: document-viewer
tags: [react-pdf, pdfjs-dist, split-view, version-timeline, tag-manager, document-detail, resizable-panels]

# Dependency graph
requires:
  - phase: 04-document-pipeline-ocr-rag-ingestion
    provides: OCR pipeline, OcrStatus fields, DocumentChunk model, DokumentTagKategorie, preview processor
  - phase: 02-deadline-calculation-document-templates
    provides: Dokument model, DokumentVersion, document CRUD API, OnlyOffice integration
provides:
  - react-pdf based in-browser PDF viewer with navigation, zoom, thumbnails, text selection, search, print, fullscreen
  - Document detail page at /akten/[id]/dokumente/[docId] with resizable split-view layout
  - Enhanced GET /api/dokumente/[id]?detail=true with full relations (akte, versions, chunks, presigned URLs)
  - GET /api/dokumente/[id]/preview endpoint for PDF preview URL resolution
  - PUT /api/dokumente/[id]/tags endpoint for tag management with Meilisearch re-indexing
  - VersionTimeline component with restore action
  - DocumentActionsBar component (rename, move, status change, download, delete, re-OCR, OnlyOffice)
  - TagManager component with colored chips, category dropdown, inline creation
  - Document list links to detail page with inline OCR status badges
affects: [04-03, 05-ai-agent]

# Tech tracking
tech-stack:
  added: [react-pdf, pdfjs-dist, core-js]
  patterns: [split-view-document-detail, version-timeline, tag-chips, detail-api-query-param]

key-files:
  created:
    - src/components/dokumente/pdf-viewer.tsx
    - src/components/dokumente/document-detail.tsx
    - src/components/dokumente/version-timeline.tsx
    - src/components/dokumente/document-actions-bar.tsx
    - src/components/dokumente/tag-manager.tsx
    - src/app/(dashboard)/akten/[id]/dokumente/[docId]/page.tsx
    - src/app/api/dokumente/[id]/preview/route.ts
    - src/app/api/dokumente/[id]/tags/route.ts
  modified:
    - src/app/api/dokumente/[id]/route.ts
    - src/components/dokumente/dokumente-tab.tsx
    - package.json

key-decisions:
  - "react-pdf v10 with pdfjs-dist v5 (latest versions) and core-js polyfill for Promise.withResolvers (Node 20)"
  - "?detail=true query parameter on existing GET /api/dokumente/[id] to avoid new endpoint for full relations"
  - "Array.from(new Set()) pattern for downlevelIteration TypeScript compatibility (consistent with project convention)"
  - "Document name in list is a Link to detail page (replaces preview dialog as primary click action)"

patterns-established:
  - "Split-view document detail: resizable panels with PDF left (65%) and metadata right (35%), auto-saved layout"
  - "Version timeline: vertical line with dots, relative dates, restore action on each version"
  - "Tag manager: colored chips from DokumentTagKategorie, combobox add with inline creation"
  - "Detail API: ?detail=true query param pattern to extend existing endpoints with full relations"

requirements-completed: [REQ-DV-006, REQ-DV-007]

# Metrics
duration: 6min
completed: 2026-02-24
---

# Phase 04 Plan 02: Document Detail Page with PDF Viewer Summary

**In-browser PDF viewing via react-pdf with split-view detail page, version timeline, actions bar, and tag management**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-24T17:01:32Z
- **Completed:** 2026-02-24T17:08:23Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- react-pdf v10 PDF viewer with page navigation, zoom (50-300%), thumbnail sidebar, text selection, search, print, fullscreen, and download
- Split-view document detail page with resizable panels and comprehensive metadata display (type, size, dates, uploader, case link, OCR status, version count, AI-indexed chunks)
- Version timeline with restore action, document actions bar with all operations (rename, move, status change, download, delete, re-OCR, OnlyOffice), and tag manager with colored chips
- Document list now links directly to detail page with inline OCR status badges

## Task Commits

Each task was committed atomically:

1. **Task 1: Install react-pdf + Create PDF Viewer Component + Document API** - `19c7fb7` (feat)
2. **Task 2: Document Detail Page + Version Timeline + Actions Bar + Tag Manager + List Link** - `df2fca6` (feat)

## Files Created/Modified

### Created
- `src/components/dokumente/pdf-viewer.tsx` - react-pdf based PDF viewer with full controls (navigation, zoom, thumbnails, search, print, fullscreen, download)
- `src/components/dokumente/document-detail.tsx` - Split-view layout with PDF left, metadata/actions right using resizable panels
- `src/components/dokumente/version-timeline.tsx` - Vertical timeline of document versions with restore action
- `src/components/dokumente/document-actions-bar.tsx` - Actions toolbar: rename, move, status change, download, delete, re-OCR, OnlyOffice
- `src/components/dokumente/tag-manager.tsx` - Tag add/remove with colored chips, category dropdown, inline creation
- `src/app/(dashboard)/akten/[id]/dokumente/[docId]/page.tsx` - Document detail page route
- `src/app/api/dokumente/[id]/preview/route.ts` - PDF preview URL endpoint (original PDF, generated preview, or generating status)
- `src/app/api/dokumente/[id]/tags/route.ts` - Tag update endpoint with Meilisearch re-indexing

### Modified
- `src/app/api/dokumente/[id]/route.ts` - Enhanced GET with ?detail=true mode returning full relations (akte, versions, chunks count, presigned URLs)
- `src/components/dokumente/dokumente-tab.tsx` - Document name links to detail page, inline OCR status badges
- `package.json` - Added react-pdf, pdfjs-dist, core-js dependencies

## Decisions Made
- **react-pdf v10 + pdfjs-dist v5**: Latest versions installed (plan mentioned v9, npm installed v10 which is the current release). core-js added for Promise.withResolvers polyfill needed by pdfjs-dist on Node 20.
- **?detail=true query param**: Extended existing GET /api/dokumente/[id] with a query parameter instead of creating a separate endpoint, keeping the API surface small.
- **Array.from(new Set())**: Used project-established pattern for Set iteration to avoid downlevelIteration TypeScript errors.
- **Link replaces preview click**: Document names in the list now navigate to the detail page instead of opening the preview dialog, making the detail page the primary document interaction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Set spread for downlevelIteration**
- **Found during:** Task 1 (Tags API)
- **Issue:** `[...new Set(tags)]` causes TS2802 error without downlevelIteration flag
- **Fix:** Used `Array.from(new Set(tags))` pattern (consistent with project convention from decision 03-03)
- **Files modified:** src/app/api/dokumente/[id]/tags/route.ts
- **Committed in:** 19c7fb7

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial fix following established project convention. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - react-pdf loads the PDF worker from the installed pdfjs-dist package. No external configuration needed.

## Next Phase Readiness
- Document detail page fully functional for viewing and managing individual documents
- PDF viewer renders all PDFs with text selection for copy/search
- Version history with restore capability ready for document workflow
- Tag management integrated with Meilisearch for searchable tags
- Ready for Plan 03 (RAG embedding pipeline) which will add AI-powered document analysis

## Self-Check: PASSED

All 8 created files verified present. Both task commits (19c7fb7, df2fca6) verified in git log.

---
*Phase: 04-document-pipeline-ocr-rag-ingestion*
*Completed: 2026-02-24*
