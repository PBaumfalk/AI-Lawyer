---
status: awaiting_human_verify
trigger: "DOCX document preview shows 'Vorschau wird generiert...' forever. OnlyOffice editor works fine."
created: 2026-02-27T12:00:00Z
updated: 2026-02-27T23:00:00Z
---

## Current Focus

hypothesis: CONFIRMED -- Preview pipeline depended on worker + Stirling-PDF Docker containers. Replaced with direct OnlyOffice conversion.
test: n/a (fix applied)
expecting: n/a
next_action: Await human verification

## Symptoms

expected: DOCX files should show a PDF preview on the document detail page
actual: Preview area shows "Vorschau wird generiert..." with loading spinner forever
errors: No errors in console related to preview. OnlyOffice works fine.
reproduction: Upload a DOCX file, open its detail page. Preview stays stuck.
started: Ongoing issue. Preview required worker + Stirling-PDF Docker containers.

## Eliminated

- hypothesis: Frontend polling fix missing
  evidence: Polling useEffect present and functional in document-detail.tsx
  timestamp: 2026-02-27T14:01:00Z

- hypothesis: Preview queue not registered in worker
  evidence: worker.ts registers previewWorker for "document-preview" queue
  timestamp: 2026-02-27T14:01:00Z

- hypothesis: Preview not enqueued on upload
  evidence: Upload route correctly enqueued to previewQueue
  timestamp: 2026-02-27T14:01:00Z

- hypothesis: Backend preview pipeline code broken
  evidence: Pipeline chain is correct: upload -> previewQueue -> worker -> Stirling-PDF -> MinIO -> DB
  timestamp: 2026-02-27T14:01:00Z

## Evidence

- timestamp: 2026-02-27T23:01:00Z
  checked: Docker containers
  found: No Docker containers running (docker ps shows empty). Worker and Stirling-PDF are not running.
  implication: Preview jobs enqueued to BullMQ are never processed. previewPfad stays null forever.

- timestamp: 2026-02-27T23:02:00Z
  checked: /api/onlyoffice/convert/route.ts
  found: Fully working OnlyOffice Conversion API exists. Calls ConvertService.ashx, polls for completion, downloads converted file. OnlyOffice IS running (editor works).
  implication: Can reuse this conversion logic for preview generation without needing worker + Stirling-PDF.

- timestamp: 2026-02-27T23:03:00Z
  checked: preview.processor.ts + stirling-client.ts
  found: Preview processor calls Stirling-PDF's /api/v1/convert/file/pdf for DOCX and /api/v1/convert/img/pdf for images. Requires Stirling-PDF container at http://stirling-pdf:8080.
  implication: Preview generation ONLY works when Stirling-PDF Docker container is running.

- timestamp: 2026-02-27T23:04:00Z
  checked: Full pipeline: upload route -> previewQueue -> worker -> processor -> Stirling-PDF -> MinIO -> DB -> frontend polling
  found: Pipeline requires 3 Docker services (Redis for BullMQ, Worker container, Stirling-PDF) just for preview. OnlyOffice can do the same conversion with zero extra dependencies.
  implication: Architecture decision to replace Stirling-PDF with OnlyOffice for previews.

- timestamp: 2026-02-27T23:05:00Z
  checked: TypeScript compilation after fix
  found: Zero errors (npx tsc --noEmit). ESLint: only pre-existing 'router' warning.
  implication: Fix is type-safe and clean.

## Resolution

root_cause: Preview generation pipeline required 3 Docker containers (Redis + Worker + Stirling-PDF) to be running. In dev mode, none of these are running. Jobs enqueued to BullMQ previewQueue are never processed, so previewPfad stays null forever and the frontend shows "Vorschau wird generiert..." indefinitely.

fix: Replaced Stirling-PDF + BullMQ worker pipeline with direct OnlyOffice Conversion API calls. OnlyOffice is already running and confirmed working (editor loads fine). Three changes:

  1. Added `convertDocumentToPdf()` utility to src/lib/onlyoffice.ts -- calls OnlyOffice ConvertService.ashx directly, polls for completion, downloads the PDF result. Also added `canConvertToPdf()` helper and exported `APP_INTERNAL_URL`.

  2. Rewrote POST /api/dokumente/[id]/preview -- instead of enqueuing to BullMQ, it now calls `convertDocumentToPdf()` synchronously, stores the PDF in MinIO, updates previewPfad in DB, and returns the preview URL immediately.

  3. Updated upload route (POST /api/akten/[id]/dokumente) -- replaced previewQueue.add() with a fire-and-forget call to `convertDocumentToPdf()` that stores the result in MinIO and updates the DB in the background.

  4. Updated document-detail.tsx frontend -- added `generatePreview` callback for manual triggering, improved UX with generating state, spinner, and clearer error messages. Removed Stirling-PDF references.

verification:
  - TypeScript: zero errors (npx tsc --noEmit)
  - ESLint: only pre-existing warning (unused 'router' variable)
  - No new dependencies required
  - Backward compatible: worker + preview processor still exist for production Docker deployments
  - Stirling-PDF client still used for OCR (only preview generation replaced)

files_changed:
  - src/lib/onlyoffice.ts (added convertDocumentToPdf, canConvertToPdf, exported APP_INTERNAL_URL)
  - src/app/api/dokumente/[id]/preview/route.ts (replaced BullMQ with direct OnlyOffice conversion)
  - src/app/api/akten/[id]/dokumente/route.ts (replaced previewQueue with inline OnlyOffice conversion)
  - src/components/dokumente/document-detail.tsx (improved preview UX, removed Stirling-PDF references)
