---
status: awaiting_human_verify
trigger: "DOCX files show 'Vorschau wird generiert...' forever. The 'DOCX-Datei - Vorschau als PDF' button does nothing."
created: 2026-02-27T12:00:00Z
updated: 2026-02-27T12:15:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two frontend issues cause the broken DOCX preview experience
test: n/a (root cause confirmed)
expecting: n/a
next_action: Await human verification

## Symptoms

expected: When opening a DOCX document detail page, either an inline preview should render OR the "Vorschau als PDF" button should convert and show a PDF preview.
actual: Preview area shows generic document icon with "Vorschau wird generiert..." text that never resolves. The "DOCX-Datei - Vorschau als PDF" button does nothing on click.
errors: No visible errors in UI.
reproduction: Upload any DOCX file to an Akte, then open the document detail page.
started: Current state. PDF preview recently fixed. DOCX preview likely never worked on the detail page.

## Eliminated

## Evidence

- timestamp: 2026-02-27T12:05:00Z
  checked: document-detail.tsx lines 250-251 and 345-369
  found: hasPdfPreview is only true for PDFs or when previewUrl is set. When previewUrl is null (preview not yet generated), it shows "Vorschau wird generiert..." with NO polling mechanism -- it fetches once and never checks again.
  implication: Even if the worker generates the preview in the background, the UI never learns about it.

- timestamp: 2026-02-27T12:06:00Z
  checked: document-detail.tsx lines 339-341
  found: "DOCX-Datei - Vorschau als PDF" is a plain `<span>` element, not a button or link. It has no click handler.
  implication: Users see "Vorschau als PDF" text but cannot click it to do anything.

- timestamp: 2026-02-27T12:07:00Z
  checked: Backend pipeline: upload route, preview queue, preview processor, worker registration
  found: Pipeline is complete -- upload enqueues to previewQueue (for non-PDF inside needsOcr block), worker processes it via Stirling-PDF convertToPdf, stores in MinIO, updates previewPfad in DB. Worker IS registered for "document-preview" queue.
  implication: Backend is wired up correctly. If Stirling-PDF is running, previews should be generated.

- timestamp: 2026-02-27T12:08:00Z
  checked: /api/dokumente/[id]/preview/route.ts
  found: Returns { url, status: "ready" } when previewPfad exists, or { url: null, status: "generating" } (202) when not yet generated.
  implication: API correctly reports preview status. Frontend just never re-checks it.

- timestamp: 2026-02-27T12:09:00Z
  checked: /api/dokumente/[id]/route.ts detail=true (lines 59-65)
  found: previewUrl is set to null when there is no previewPfad. Component receives previewUrl=null.
  implication: On initial load, previewUrl is null for DOCX files that haven't been processed yet, which is expected. The missing piece is re-fetching.

## Resolution

root_cause: Two frontend issues in document-detail.tsx:
  1. NO POLLING: The component fetches document data once. For non-PDF files where preview generation is async (via BullMQ worker + Stirling-PDF), the UI shows "Vorschau wird generiert..." but never re-checks whether the preview has been generated. The backend pipeline works (enqueue -> Stirling convert -> store -> update previewPfad), but the frontend never re-fetches to see the updated previewPfad/previewUrl.
  2. NON-INTERACTIVE TEXT: The "DOCX-Datei - Vorschau als PDF" text in the blue bar is a plain <span>, not a button. Users expect to click it but nothing happens.

fix: Added two changes to src/components/dokumente/document-detail.tsx:
  1. Added a useEffect that polls fetchDocument() every 3 seconds when the document is non-PDF and previewPfad is null. Polling stops automatically when previewUrl becomes available (guard conditions at top of effect).
  2. Replaced the plain <span> with a <Button> that re-checks the preview endpoint and triggers a fetchDocument() if the preview is ready. When the preview IS already available, it falls back to a plain text label.

verification: ESLint passes with no new warnings. Logic verified by reading: polling starts when previewPfad===null, stops when previewUrl is truthy or previewPfad is no longer null. Button calls preview API and refreshes on success.

files_changed:
  - src/components/dokumente/document-detail.tsx
