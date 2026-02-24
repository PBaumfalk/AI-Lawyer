# Phase 4: Document Pipeline (OCR + RAG Ingestion) - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Uploaded documents are automatically OCR-processed, indexed in Meilisearch for full-text search, and chunked+embedded into pgvector for AI retrieval. Includes a rich document detail page with in-browser PDF preview, document upload experience, and tagging system. AI chat/retrieval features using the embeddings belong to Phase 6.

</domain>

<decisions>
## Implementation Decisions

### PDF Viewer
- Split view layout: PDF on the left, metadata/actions panel on the right
- Resizable panels with draggable divider, default ~65/35 split
- Extended controls: page navigation, zoom, fit-to-width, thumbnail sidebar, search within PDF, print, fullscreen toggle, download
- Text layer enabled — users can select and copy text from OCR'd documents

### Document Detail Page
- Comprehensive metadata display: filename, type, size, upload date, uploader, case link, OCR status, tags, document status (Entwurf/Freigegeben/Archiviert), version count
- Version history as vertical timeline in the right sidebar panel — each version shows date, author, and "restore" action
- Full actions bar: rename, move to folder, add/remove tags, change status, download, delete, re-OCR, open in OnlyOffice (if editable format)
- Audit trail display deferred to Phase 7 — events are logged silently for now

### OCR Status & Feedback
- Color badges on documents in lists: gray=pending, blue=processing, green=done, red=failed
- Toast notification + bell/notification center entry when OCR completes (success or failure) via Socket.IO
- Auto-retry 2x with backoff on failure, then show manual retry button if still failed
- Admin OCR dashboard showing all OCR jobs with status, queue depth, failed documents, and bulk retry

### Search Integration
- Rich snippet results: document name, case link, highlighted matching text snippet, OCR badge, relevance score
- Dual search: Cmd+K palette for quick document search + dedicated /suche page for advanced filtering
- Full filter set on advanced page: case, document type, date range, uploader, tags, OCR status, document status — all combinable
- Full-text content search via Meilisearch (OCR'd text) combined with metadata search (name, tags, case)

### Upload Experience
- Drag-and-drop zone + traditional file picker button on case documents tab, multi-file support
- Per-file progress bars showing individual status (uploading, OCR queued, done)
- Floating upload panel in bottom-right corner (Google Drive style) — persists while navigating away
- 100 MB per file size limit

### Document Tagging
- Predefined tag categories managed by admin (Schriftsatz, Vertrag, Rechnung, Gutachten, Korrespondenz, etc.) + users can create custom tags
- Colored tags — each predefined category gets a distinct color, custom tags get a default color
- Multiple tags per document supported
- Tag management in Kanzlei-Einstellungen area (new "Dokument-Tags" section), consistent with existing template/schema management

### Embedding / AI-Ready Status
- Subtle AI-indexed indicator on document detail page only (small icon/chip) — not in lists
- Embedding failures visible only in admin pipeline dashboard, not to regular users
- ALL text-bearing file formats go into the RAG pipeline: PDF, DOCX, ODT, HTML, XLSX, CSV, TXT, and any other format with extractable text — text is extracted and embedded

### Non-PDF Handling
- Non-PDF documents (DOCX, ODT, etc.) get a PDF preview generated via Stirling-PDF/LibreOffice for consistent viewer experience
- Scanned images (JPG, PNG, TIFF) also go through OCR for text extraction, search, and RAG
- OCR language: German (primary) + English (secondary) — covers legal documents and international contracts
- Editable formats (DOCX, ODT) show PDF preview by default with a prominent "In OnlyOffice bearbeiten" button to open the original

### Claude's Discretion
- Loading skeleton design for document views
- Exact spacing, typography, and component sizing
- Error state handling and empty state designs
- Chunking algorithm specifics (paragraph-aware for German legal text)
- Embedding model selection (research determines this)
- Meilisearch index configuration
- Stirling-PDF Docker configuration details
- PDF preview generation queue priority vs OCR priority

</decisions>

<specifics>
## Specific Ideas

- Upload panel should feel like Google Drive's floating upload widget — persistent, non-intrusive, shows per-file progress
- OCR badges should be glanceable — color-coded like traffic lights (gray/blue/green/red)
- Search results should feel like Google — highlighted snippets showing where the match is in the document text
- Tag management follows the same pattern as existing Kanzlei-Einstellungen tabs (Vorlagen, Briefkopf, Ordner-Schemata)
- "Feuer frei" approach to RAG: if a file has text, extract it and embed it — no restrictions on format

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-document-pipeline-ocr-rag-ingestion*
*Context gathered: 2026-02-24*
