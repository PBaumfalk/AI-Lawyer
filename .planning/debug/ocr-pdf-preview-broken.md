---
status: resolved
trigger: "OCR pipeline does not work and PDF preview does not work. Docker is running with all containers."
created: 2026-02-26T00:00:00Z
updated: 2026-02-27T09:00:00Z
resolved: 2026-02-27T09:00:00Z
---

## Resolution

Five issues found and fixed across two sessions:

1. **pdf-parse v2 API change** — `require("pdf-parse")` returns `{PDFParse}` class, not callable. Fixed extractTextFromBuffer to use new API.
2. **PDF preview URL** — document-detail.tsx used downloadUrl instead of previewUrl for PdfViewer.
3. **OCR file size** — OCR processor didn't update `groesse` after replacing file in MinIO.
4. **Turbopack canvas alias** — Added webpack/turbopack alias for `@napi-rs/canvas`.
5. **pdfjs-dist version mismatch** — Package had ^5.4.624 but react-pdf needs 5.4.296. Pinned to matching version, updated worker file.

Verified: User confirmed OCR and PDF preview work.
