# Phase 46: Dokument-Freigabe + Portal-DMS - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Anwaelte kontrollieren granular welche Dokumente der Mandant sieht (per-Dokument Toggle), und Mandanten koennen eigene Dokumente hochladen. Dokumentliste, Download via signierte URLs, Upload in dedizierten Mandant-Ordner, Upload-Benachrichtigung an Anwalt.

</domain>

<decisions>
## Implementation Decisions

### Freigabe mechanism
- Per-Dokument "Mandant sichtbar" Boolean toggle on Dokument model
- Default: NOT sichtbar (Anwalt must explicitly share)
- Toggle available in Akte document list (internal dashboard)
- Toggling creates an AktenActivity with mandantSichtbar=true (so Mandant sees "Neues Dokument freigegeben" in Timeline)

### Portal document list
- Mandant sees list of all freigegebene Dokumente for their Akte
- Shows: Document name, date, file type/icon, size
- Documents are read-only — no editing, no OnlyOffice

### Download
- Signed MinIO presigned URLs (existing getDownloadUrl() — 1hr expiry)
- No direct S3 access from portal client

### Mandant Upload
- Mandant can upload files into a dedicated "Mandant" Ordner (auto-created if not exists)
- Standard file upload to MinIO (reuse existing upload pipeline minus OCR/RAG)
- No OCR, no RAG ingestion, no document status workflow for Mandant uploads
- Uploaded document gets erstelltDurch="mandant" marker

### Upload notification
- Anwalt receives notification when Mandant uploads a document
- Notification type: integrate with existing alert system or in-app notification

### Claude's Discretion
- Toggle UI placement (icon button, switch, checkbox in document row)
- Whether to show PDF preview in portal or just download link
- Upload size limit for portal (same 100MB as internal or lower?)
- Mandant Ordner auto-creation timing (on first upload or on portal creation)
- Notification mechanism (Alert, Socket.IO toast, or AktenActivity)

</decisions>

<specifics>
## Specific Ideas

- Mandant should NOT see internal documents (Entwuerfe, interne Notizen) — only explicitly freigegeben docs
- Upload should feel simple — drag & drop or file picker, no metadata forms

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/storage.ts`: uploadFile(), getDownloadUrl(), generateStorageKey() — reuse for portal uploads/downloads
- `POST /api/akten/[id]/dokumente`: Full upload pipeline — simplify for portal (skip OCR, RAG, preview)
- Dokument model: ordner field for folder grouping, erstelltDurch field for attribution
- DokumentStatus: FREIGEGEBEN status exists but is for document approval, not portal visibility — need separate mandantSichtbar field

### Established Patterns
- File upload: formData multipart, 100MB limit, MinIO key format "akten/{akteId}/dokumente/{timestamp}_{filename}"
- Presigned URLs: getDownloadUrl(doc.dateipfad) — 1hr expiry, browser-reachable via publicS3Client

### Integration Points
- prisma/schema.prisma: Add mandantSichtbar Boolean on Dokument model
- Internal Akte document list: Add toggle button for mandantSichtbar
- Portal API: New /api/portal/akten/[id]/dokumente (list + upload + download routes)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 46-dokument-freigabe-portal-dms*
*Context gathered: 2026-03-03*
