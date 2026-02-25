# Phase 4: Document Pipeline (OCR + RAG Ingestion) - Research

**Researched:** 2026-02-24
**Domain:** Document processing pipeline (OCR, full-text search indexing, vector embeddings, PDF viewing)
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **PDF Viewer:** Split view layout (PDF left, metadata/actions right), resizable panels ~65/35 default, extended controls (navigation, zoom, fit-to-width, thumbnail sidebar, search within PDF, print, fullscreen, download), text layer enabled
- **Document Detail Page:** Comprehensive metadata display (filename, type, size, upload date, uploader, case link, OCR status, tags, document status, version count), version history as vertical timeline in right sidebar, full actions bar (rename, move, tag, status, download, delete, re-OCR, open in OnlyOffice), audit trail display deferred to Phase 7
- **OCR Status & Feedback:** Color badges (gray=pending, blue=processing, green=done, red=failed), toast notification + bell/notification center via Socket.IO on OCR complete, auto-retry 2x with backoff then manual retry button, admin OCR dashboard with queue depth/failed docs/bulk retry
- **Search Integration:** Rich snippet results with document name, case link, highlighted text, OCR badge, relevance score. Dual search: Cmd+K palette + dedicated /suche page. Full filter set on advanced page (case, document type, date range, uploader, tags, OCR status, document status)
- **Upload Experience:** Drag-and-drop zone + file picker, multi-file, per-file progress bars, floating upload panel (Google Drive style, bottom-right, persists while navigating), 100 MB file size limit
- **Document Tagging:** Predefined tag categories managed by admin (Schriftsatz, Vertrag, Rechnung, Gutachten, Korrespondenz, etc.) + custom tags, colored tags, multiple per document, tag management in Kanzlei-Einstellungen ("Dokument-Tags" section)
- **Embedding/AI-Ready Status:** Subtle AI-indexed indicator on document detail page only (small icon/chip), embedding failures visible only in admin pipeline dashboard, ALL text-bearing formats go into RAG pipeline (PDF, DOCX, ODT, HTML, XLSX, CSV, TXT, etc.)
- **Non-PDF Handling:** Non-PDF documents get PDF preview via Stirling-PDF/LibreOffice, scanned images (JPG, PNG, TIFF) also go through OCR, OCR language German (primary) + English (secondary), editable formats show PDF preview with "In OnlyOffice bearbeiten" button

### Claude's Discretion
- Loading skeleton design for document views
- Exact spacing, typography, and component sizing
- Error state handling and empty state designs
- Chunking algorithm specifics (paragraph-aware for German legal text)
- Embedding model selection (research determines this)
- Meilisearch index configuration
- Stirling-PDF Docker configuration details
- PDF preview generation queue priority vs OCR priority

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-DV-004 | Auto-OCR bei PDF-Upload (Stirling-PDF Docker, Tesseract, deutsche Sprachdaten) | Stirling-PDF Docker sidecar with `ocrType: "skip-text"` for smart OCR, BullMQ queue for async processing |
| REQ-DV-005 | OCR-Status speichern + anzeigen (Badge + manueller Retry) | New Prisma fields on Dokument model, Socket.IO notifications for status changes, Meilisearch re-index on OCR completion |
| REQ-DV-006 | PDF-Preview im Browser (Viewer mit Navigation, Zoom, Download) | react-pdf (wojtekmaj) v9 with pdfjs-dist, text layer + annotation layer CSS, split-view with react-resizable-panels |
| REQ-DV-007 | Dokument-Detailseite (Metadaten, Versionen, Status, Tags, Historie) | New route `/akten/[id]/dokumente/[docId]`, version timeline, actions bar, tag management UI |
| REQ-IF-004 | Stirling-PDF Docker-Sidecar (Fat-Image mit Tesseract + deutsche Sprachdaten) | `stirlingtools/stirling-pdf:latest` image with tessdata volume mount, REST API at `/api/v1/misc/ocr-pdf` and `/api/v1/convert/file/pdf` |
| REQ-KI-001 | RAG-Pipeline: Embedding-Storage (pgvector), semantisches Chunking, Embedding-Job (Worker) | pgvector with Prisma raw SQL, multilingual-e5-large-instruct via Ollama, `@langchain/textsplitters` for chunking, model version tracked per vector |
</phase_requirements>

## Summary

Phase 4 builds the document processing pipeline that transforms uploaded files into searchable, AI-ready resources. The architecture centers on a Stirling-PDF Docker sidecar for OCR and document conversion, BullMQ worker queues for asynchronous processing, Meilisearch for full-text search, and pgvector for vector embeddings. The frontend adds a rich document detail page with in-browser PDF viewing (react-pdf/pdfjs-dist), a floating upload panel, OCR status badges, and a dedicated search page.

The project already has substantial infrastructure in place: BullMQ worker process (`src/worker.ts`), Meilisearch client and index (`src/lib/meilisearch.ts`), MinIO storage (`src/lib/storage.ts`), Socket.IO emitter for notifications, and a documents tab with upload, preview, and ONLYOFFICE editor integration. Phase 4 extends this foundation by adding the OCR/embedding processing pipeline, enhancing the Meilisearch index with OCR text, creating a dedicated document detail page, and introducing a proper PDF viewer.

The primary technical risk is embedding model selection for German legal text. Research identifies `multilingual-e5-large-instruct` (1024 dimensions) as the strongest open-source choice, available through Ollama for self-hosted deployment. For the chunking strategy, `@langchain/textsplitters` with customized separators for German legal document structure provides paragraph-aware splitting.

**Primary recommendation:** Use Stirling-PDF's `ocrType: "skip-text"` to intelligently OCR only non-searchable pages, `react-pdf` v9 for the PDF viewer with text layer, `multilingual-e5-large-instruct` via Ollama for embeddings, and `@langchain/textsplitters` for paragraph-aware chunking of German legal text.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stirlingtools/stirling-pdf` | `:latest` Docker | OCR (Tesseract) + document conversion (LibreOffice) | #1 open-source PDF tool on GitHub; includes Tesseract + LibreOffice + REST API in single container |
| `react-pdf` (wojtekmaj) | 9.x | In-browser PDF rendering with text layer | 1.3M+ weekly npm downloads; wraps pdf.js cleanly; text selection + annotation layer |
| `pdfjs-dist` | 4.x (peer dep) | PDF.js engine used by react-pdf | Mozilla's PDF rendering engine; industry standard |
| `@langchain/textsplitters` | 0.1.x | Text chunking for RAG pipeline | LangChain's official JS text splitting; RecursiveCharacterTextSplitter with custom separators |
| `meilisearch` | 0.55.x (existing) | Full-text search index for OCR text | Already in stack; excellent German language support with typo tolerance |
| `pgvector` (PostgreSQL ext) | 0.8.x | Vector similarity search for embeddings | Already in Docker Compose (`pgvector/pgvector:pg16` image); native PostgreSQL extension |
| `bullmq` | 5.x (existing) | Async job queue for OCR + embedding jobs | Already in stack; proven in email/frist-reminder pipelines |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-resizable-panels` | 4.x (existing) | Split-view layout for document detail page | PDF viewer (left) + metadata panel (right) with draggable divider |
| `pgvector` npm | 0.2.x | Vector formatting for pgvector SQL queries | Formatting JS arrays as pgvector-compatible `[1,2,3]` strings in raw SQL |
| `core-js` | 3.x | Promise.withResolvers polyfill for react-pdf on Node < 22 | Required if running Next.js with Node 20.x |
| `@langchain/core` | 0.3.x | Required peer dependency for @langchain/textsplitters | Peer dep of textsplitters |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-pdf (wojtekmaj) | @react-pdf-viewer/core | react-pdf-viewer last published 3 years ago; react-pdf actively maintained |
| Stirling-PDF | Gotenberg | Gotenberg has better DOCX conversion fidelity, but Stirling-PDF includes OCR + conversion + more tools in one container |
| @langchain/textsplitters | Custom regex splitter | LangChain provides battle-tested recursive splitting with metadata propagation; not worth hand-rolling |
| multilingual-e5-large-instruct | OpenAI text-embedding-3-small | OpenAI requires API key + network; E5 via Ollama is self-hosted, privacy-first, and MMTEB-validated for multilingual |

**Installation:**
```bash
npm install react-pdf pgvector @langchain/textsplitters @langchain/core
```

Note: `core-js` may also be needed if Promise.withResolvers polyfill is required:
```bash
npm install core-js
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── akten/[id]/dokumente/[docId]/  # Document detail page
│   │   └── suche/                          # Dedicated search page
│   └── api/
│       ├── dokumente/
│       │   ├── [id]/
│       │   │   ├── ocr/route.ts            # Manual re-OCR trigger
│       │   │   └── preview/route.ts        # PDF preview (generated for non-PDFs)
│       │   └── tags/route.ts               # Tag management CRUD
│       ├── admin/
│       │   └── pipeline/route.ts           # Admin OCR/embedding dashboard API
│       └── search/route.ts                 # Enhanced search with highlighting
├── components/
│   ├── dokumente/
│   │   ├── pdf-viewer.tsx                  # react-pdf based PDF viewer
│   │   ├── document-detail.tsx             # Full document detail page
│   │   ├── ocr-status-badge.tsx            # Color-coded OCR status badge
│   │   ├── upload-panel.tsx                # Floating upload panel (Google Drive style)
│   │   ├── version-timeline.tsx            # Version history vertical timeline
│   │   └── tag-manager.tsx                 # Tag CRUD component
│   └── search/
│       ├── search-page.tsx                 # Advanced search page
│       └── search-result-card.tsx          # Rich snippet search result
├── lib/
│   ├── ocr/
│   │   ├── stirling-client.ts              # Stirling-PDF REST API client
│   │   ├── text-detector.ts                # Check if PDF already has text layer
│   │   └── types.ts                        # OCR job types
│   ├── embedding/
│   │   ├── chunker.ts                      # Paragraph-aware German legal text chunking
│   │   ├── embedder.ts                     # Embedding generation via Ollama
│   │   └── vector-store.ts                 # pgvector CRUD (raw SQL via Prisma)
│   └── queue/
│       └── processors/
│           ├── ocr.processor.ts            # OCR job processor
│           ├── embedding.processor.ts      # Embedding job processor
│           └── preview.processor.ts        # PDF preview generation processor
└── workers/
    └── processors/                         # Worker-side processor implementations
```

### Pattern 1: Multi-Stage Document Processing Pipeline
**What:** When a document is uploaded, a chain of BullMQ jobs processes it in stages: (1) OCR/text extraction, (2) Meilisearch indexing, (3) chunking + embedding
**When to use:** Every document upload or re-OCR trigger
**Example:**
```typescript
// In upload API route (after file saved to MinIO + DB record created):
import { ocrQueue, embeddingQueue } from "@/lib/queue/queues";

// Stage 1: OCR (or text extraction for non-PDFs)
await ocrQueue.add("ocr-document", {
  dokumentId: dokument.id,
  akteId,
  storagePath: storageKey,
  mimeType: file.type,
  fileName: file.name,
}, {
  attempts: 3,
  backoff: { type: "custom" },
});

// Stage 2 + 3 are triggered by the OCR processor on completion:
// ocrProcessor -> updates DB ocrText -> indexes Meilisearch -> adds embedding job
```

### Pattern 2: Stirling-PDF API Client
**What:** HTTP client that calls Stirling-PDF REST API for OCR and document conversion
**When to use:** OCR processing, generating PDF previews for non-PDF documents
**Example:**
```typescript
// Source: Stirling-PDF API docs (https://docs.stirlingpdf.com/API/)
const STIRLING_URL = process.env.STIRLING_PDF_URL ?? "http://stirling-pdf:8080";

export async function ocrPdf(
  pdfBuffer: Buffer,
  languages = "deu+eng"
): Promise<Buffer> {
  const form = new FormData();
  form.append("fileInput", new Blob([pdfBuffer]), "document.pdf");
  form.append("languages", languages);
  form.append("ocrType", "skip-text");      // Skip pages that already have text
  form.append("ocrRenderType", "hocr");     // Preserve layout with hOCR

  const res = await fetch(`${STIRLING_URL}/api/v1/misc/ocr-pdf`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error(`Stirling OCR failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function convertToPdf(
  fileBuffer: Buffer,
  filename: string
): Promise<Buffer> {
  const form = new FormData();
  form.append("fileInput", new Blob([fileBuffer]), filename);

  const res = await fetch(`${STIRLING_URL}/api/v1/convert/file/pdf`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error(`Stirling conversion failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
```

### Pattern 3: pgvector with Prisma Raw SQL
**What:** Store and query vector embeddings using Prisma's `$queryRaw`/`$executeRaw` since Prisma does not natively support the `vector` type
**When to use:** Embedding storage and retrieval
**Example:**
```typescript
// Schema: new DocumentChunk model uses Unsupported("vector") type
// Must use raw SQL for all vector operations

import { prisma } from "@/lib/db";
import pgvector from "pgvector";

// Insert embedding
export async function insertChunk(
  dokumentId: string,
  chunkIndex: number,
  content: string,
  embedding: number[],
  modelVersion: string
): Promise<void> {
  const vectorStr = pgvector.toSql(embedding);
  await prisma.$executeRaw`
    INSERT INTO document_chunks (id, dokument_id, chunk_index, content, embedding, model_version, created_at)
    VALUES (gen_random_uuid(), ${dokumentId}, ${chunkIndex}, ${content},
            ${vectorStr}::vector, ${modelVersion}, NOW())
  `;
}

// Cosine similarity search
export async function searchSimilar(
  queryEmbedding: number[],
  akteId: string,
  limit = 5
): Promise<{ content: string; dokumentId: string; score: number }[]> {
  const vectorStr = pgvector.toSql(queryEmbedding);
  return prisma.$queryRaw`
    SELECT dc.content, dc.dokument_id as "dokumentId",
           1 - (dc.embedding <=> ${vectorStr}::vector) as score
    FROM document_chunks dc
    JOIN dokumente d ON d.id = dc.dokument_id
    WHERE d.akte_id = ${akteId}
    ORDER BY dc.embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;
}
```

### Pattern 4: react-pdf Viewer with Text Layer
**What:** In-browser PDF rendering with selectable text, thumbnail sidebar, zoom controls
**When to use:** Document detail page, PDF preview
**Example:**
```typescript
// Must be a client component, skip SSR
"use client";

import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Set worker source (must be in same file as Document/Page usage)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export function PdfViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);

  return (
    <Document
      file={url}
      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
    >
      <Page
        pageNumber={pageNumber}
        scale={scale}
        renderTextLayer={true}
        renderAnnotationLayer={true}
      />
    </Document>
  );
}
```

### Pattern 5: Floating Upload Panel (Google Drive Style)
**What:** Persistent upload status panel that remains visible while user navigates away from the upload page
**When to use:** Multi-file document uploads
**Example:**
```typescript
// Global context provider wrapping the dashboard layout
// Upload state persists across page navigations

interface UploadItem {
  id: string;
  file: File;
  akteId: string;
  progress: number;           // 0-100
  status: "uploading" | "ocr-queued" | "ocr-processing" | "done" | "error";
  error?: string;
}

// UploadManager context provides:
// - addFiles(akteId, files) -- starts upload
// - uploads: UploadItem[]   -- current state
// - clearCompleted()        -- remove done items
// Panel component reads from context and renders in bottom-right corner
```

### Anti-Patterns to Avoid
- **Synchronous OCR in API route:** Never call Stirling-PDF synchronously in the upload route. Always enqueue a BullMQ job and return immediately.
- **Storing embeddings in Prisma without raw SQL:** Prisma does not support the `vector` type natively. Using `Unsupported("vector")` columns requires `$queryRaw`/`$executeRaw` for all read/write operations.
- **Single monolithic processing job:** Do not combine OCR + indexing + embedding in one job. Use separate stages so failures in embedding do not block search indexing.
- **Embedding all at once:** For large documents, chunk and embed incrementally. Do not attempt to embed an entire document in a single API call.
- **Hardcoding embedding dimensions:** Always derive vector dimensions from the model configuration, not magic numbers. Track model version per chunk.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OCR processing | Custom Tesseract integration | Stirling-PDF Docker sidecar | Handles preprocessing (deskew, clean), language packs, and outputs searchable PDF in one call |
| PDF rendering | Canvas-based custom renderer | react-pdf + pdfjs-dist | Text layer, annotations, accessibility all built-in; 1.3M weekly downloads |
| Text chunking | Regex-based paragraph splitter | `@langchain/textsplitters` RecursiveCharacterTextSplitter | Handles edge cases (nested sections, tables, lists), metadata propagation, configurable overlap |
| Vector formatting | Manual `[1,2,3]` string building | `pgvector` npm package | Handles float precision, escaping, and type casting correctly |
| Document conversion | LibreOffice CLI wrapper | Stirling-PDF `/api/v1/convert/file/pdf` | Already running as sidecar; REST API is simpler than managing LibreOffice processes |
| Full-text search | PostgreSQL LIKE/ILIKE queries | Meilisearch (already in stack) | Typo tolerance, ranking, highlighting, German stemming, sub-millisecond response |
| Async job processing | setTimeout/setInterval polling | BullMQ (already in stack) | Retry logic, backoff, job progress, repeatable jobs, Redis-backed persistence |

**Key insight:** This phase integrates many moving parts (OCR, conversion, indexing, embedding, PDF viewing) but every complex piece has a battle-tested solution. The main implementation work is orchestration and UI, not low-level processing.

## Common Pitfalls

### Pitfall 1: react-pdf Worker File Resolution in Next.js
**What goes wrong:** PDF.js worker file fails to load with "Can't resolve pdfjs-dist/build/pdf.worker.min.mjs" error, or worker version mismatch
**Why it happens:** Next.js bundler does not automatically handle the pdf.js web worker. The worker `.mjs` extension changed in v4. Module execution order can overwrite custom `workerSrc`.
**How to avoid:** Set `pdfjs.GlobalWorkerOptions.workerSrc` in the SAME file that uses `Document`/`Page` components. Use `import.meta.url` for worker path resolution. If on Node < 22, add `core-js/full/promise/with-resolvers` polyfill.
**Warning signs:** "Promise.withResolvers is not a function", blank PDF rendering, console errors about worker version.

### Pitfall 2: Stirling-PDF Container Memory
**What goes wrong:** OCR of large scanned documents causes Stirling-PDF container to OOM-kill, especially with concurrent jobs
**Why it happens:** Tesseract OCR + LibreOffice both consume significant memory per document
**How to avoid:** Set `deploy.resources.limits.memory: 4g` in docker-compose. Limit OCR worker concurrency to 1-2 concurrent jobs. Enforce the 100 MB file size limit strictly.
**Warning signs:** Container restarts, truncated OCR output, HTTP 502/503 from Stirling-PDF.

### Pitfall 3: Prisma and pgvector Type Mismatch
**What goes wrong:** Prisma Studio crashes on tables with `vector` columns. Migrations fail or generate incorrect SQL for vector columns.
**Why it happens:** Prisma ORM represents `vector` as `Unsupported("vector(1024)")` which is not queryable through the Prisma client API.
**How to avoid:** Use `Unsupported("vector(1024)")` in schema for type tracking only. All vector operations must use `$queryRaw`/`$executeRaw`. Create the vector column and HNSW index in a manual migration SQL file, not through Prisma's auto-generation.
**Warning signs:** "Unknown arg" errors, empty query results, Prisma Studio white screen.

### Pitfall 4: Meilisearch Index Settings Not Applied
**What goes wrong:** Search returns unexpected results because index settings (searchable attributes, filterable attributes) were not applied or were overwritten
**Why it happens:** Meilisearch settings are eventually consistent -- `updateSettings` returns a task that may not complete before the first search. Creating a new index and immediately searching returns no results.
**How to avoid:** Call `ensureDokumenteIndex()` at application startup (already done in existing code). Add new filterable attributes (OCR status, document status, tags, uploader, date range) in the settings update. Wait for task completion in critical paths.
**Warning signs:** Filters not working, attributes not appearing in search results.

### Pitfall 5: Embedding Model Version Tracking
**What goes wrong:** After changing embedding models, old vectors are incompatible with new query vectors, producing garbage similarity scores
**Why it happens:** Different models produce vectors in different dimensional spaces. Mixing model versions in the same vector space is mathematically meaningless.
**How to avoid:** Store `modelVersion` string (e.g., "multilingual-e5-large-instruct@1.0") per chunk. When model changes, mark old chunks for re-embedding. Filter searches to matching model version. Include model version in query.
**Warning signs:** Cosine similarity scores uniformly near 0 or near random for known-relevant documents.

### Pitfall 6: Large Document Embedding Memory Exhaustion
**What goes wrong:** Embedding a 500-page legal document in one batch exceeds available memory in the worker process
**Why it happens:** Chunking a large document produces hundreds of chunks; embedding all at once loads them all into memory
**How to avoid:** Process chunks in batches of 10-20. Use streaming/pagination when reading document text from storage. Set Node.js `--max-old-space-size` on worker process for safety margin.
**Warning signs:** Worker process killed by OOM, embedding jobs stuck at "active" state.

### Pitfall 7: File Format Detection for OCR vs Conversion
**What goes wrong:** Binary files (images, spreadsheets) are sent to the OCR endpoint which only accepts PDFs, causing errors
**Why it happens:** The OCR endpoint (`/api/v1/misc/ocr-pdf`) only accepts PDF files. Non-PDF files need conversion first.
**How to avoid:** Route by MIME type: PDFs go directly to OCR. Images (JPG, PNG, TIFF) should be converted to PDF first via `/api/v1/convert/img/pdf`, then OCR'd. DOCX/ODT go to `/api/v1/convert/file/pdf` for preview generation and text extraction from the source file.
**Warning signs:** HTTP 400/415 from Stirling-PDF, empty OCR text for non-PDF files.

## Code Examples

### Stirling-PDF Docker Compose Sidecar
```yaml
# Addition to existing docker-compose.yml
stirling-pdf:
  image: stirlingtools/stirling-pdf:latest
  container_name: ailawyer-stirling-pdf
  restart: unless-stopped
  ports:
    - "8081:8080"
  environment:
    DOCKER_ENABLE_SECURITY: "false"
    SYSTEM_DEFAULTLOCALE: de-DE
    SYSTEM_MAXFILESIZE: 100           # 100 MB max upload
    TESSERACT_LANGS: deu,eng          # German + English OCR packs
  volumes:
    - stirling_configs:/configs
    - stirling_logs:/logs
    - stirling_tessdata:/usr/share/tessdata
  deploy:
    resources:
      limits:
        memory: 4g
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8080/api/v1/info/status"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 60s

# Add volumes
volumes:
  stirling_configs:
  stirling_logs:
  stirling_tessdata:
```

### OCR Queue and Processor Pattern
```typescript
// src/lib/queue/queues.ts -- add OCR + embedding queues
export const ocrQueue = new Queue("document-ocr", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 3,     // Auto-retry 2x (initial + 2 retries)
  },
});

export const embeddingQueue = new Queue("document-embedding", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
  },
});

export const previewQueue = new Queue("document-preview", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,
  },
});
```

### Prisma Schema Extension for OCR + Embeddings
```prisma
// Extensions needed in schema
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}

// New enum for OCR status
enum OcrStatus {
  AUSSTEHEND    // Pending -- just uploaded
  IN_BEARBEITUNG // Processing
  ABGESCHLOSSEN  // Done -- OCR text extracted
  FEHLGESCHLAGEN  // Failed -- error during OCR
  NICHT_NOETIG   // Not needed -- already searchable or non-applicable
}

// Add fields to existing Dokument model
model Dokument {
  // ... existing fields ...
  ocrStatus       OcrStatus @default(AUSSTEHEND)
  ocrFehler       String?   @db.Text     // Error message if OCR failed
  ocrVersuche     Int       @default(0)  // Number of OCR attempts
  ocrAbgeschlossen DateTime? // When OCR completed
  // Preview PDF for non-PDF documents
  previewPfad     String?   // MinIO path to generated PDF preview
}

// New model for document chunks + embeddings
model DocumentChunk {
  id           String   @id @default(cuid())
  dokumentId   String
  dokument     Dokument @relation(fields: [dokumentId], references: [id], onDelete: Cascade)
  chunkIndex   Int      // Order within document
  content      String   @db.Text
  embedding    Unsupported("vector(1024)")?  // pgvector column
  modelVersion String   // e.g., "multilingual-e5-large-instruct@1.0"
  createdAt    DateTime @default(now())

  @@unique([dokumentId, chunkIndex])
  @@index([dokumentId])
  @@map("document_chunks")
}

// New model for document tags (admin-managed categories)
model DokumentTagKategorie {
  id        String   @id @default(cuid())
  name      String   @unique
  farbe     String   // Hex color code
  sortierung Int     @default(0)
  system    Boolean  @default(false)  // True for predefined, false for custom
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("dokument_tag_kategorien")
}
```

### Manual Migration SQL for pgvector
```sql
-- Must be run as a manual migration step since Prisma cannot generate vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create HNSW index for cosine similarity search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### German Legal Text Chunking Configuration
```typescript
// src/lib/embedding/chunker.ts
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// German legal documents have specific paragraph markers:
// - §, Art., Abs., Nr., S. (paragraph/article references)
// - "I.", "II.", "III." (section numbering)
// - Double newlines between paragraphs
// - "Tenor:", "Tatbestand:", "Entscheidungsgründe:" (judgment sections)
const GERMAN_LEGAL_SEPARATORS = [
  "\n\nTenor\n",
  "\n\nTatbestand\n",
  "\n\nEntscheidungsgründe\n",
  "\n\nGründe\n",
  "\n\n",                // Standard paragraph break
  "\n",                  // Line break
  ". ",                  // Sentence boundary
  " ",                   // Word boundary
  "",                    // Character-level fallback
];

export function createLegalTextSplitter() {
  return new RecursiveCharacterTextSplitter({
    chunkSize: 1000,         // ~250 tokens (4 chars/token for German)
    chunkOverlap: 200,       // 20% overlap to maintain context
    separators: GERMAN_LEGAL_SEPARATORS,
  });
}
```

### Enhanced Meilisearch Index Configuration
```typescript
// Updated ensureDokumenteIndex with Phase 4 fields
export async function ensureDokumenteIndex(): Promise<void> {
  try {
    await meiliClient.getIndex(DOKUMENTE_INDEX);
  } catch {
    await meiliClient.createIndex(DOKUMENTE_INDEX, { primaryKey: "id" });
  }

  const index = meiliClient.index(DOKUMENTE_INDEX);

  await index.updateSettings({
    searchableAttributes: [
      "name",
      "ocrText",
      "tags",
      "aktenzeichen",
      "kurzrubrum",
      "ordner",
      "createdByName",
    ],
    filterableAttributes: [
      "akteId",
      "mimeType",
      "ordner",
      "tags",
      "createdById",
      "ocrStatus",           // NEW: Filter by OCR status
      "dokumentStatus",      // NEW: Filter by document status
      "createdAt",           // NEW: Date range filtering
    ],
    sortableAttributes: ["createdAt", "name"],
    displayedAttributes: [
      "id", "akteId", "name", "mimeType", "ordner", "tags",
      "createdById", "createdByName", "aktenzeichen", "kurzrubrum",
      "createdAt", "ocrStatus", "dokumentStatus",
    ],
    // Enable highlighting for search snippets
    // (applied per-query, not in settings -- but ensure ocrText is searchable)
  });
}
```

### Embedding via Ollama
```typescript
// src/lib/embedding/embedder.ts
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const EMBEDDING_MODEL = "blaifa/multilingual-e5-large-instruct";
const EMBEDDING_DIMENSIONS = 1024;

export async function generateEmbedding(text: string): Promise<number[]> {
  // E5 instruction format: prefix with "passage: " for documents, "query: " for queries
  const prefixedText = `passage: ${text}`;

  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: prefixedText,
    }),
  });

  if (!res.ok) throw new Error(`Ollama embed failed: ${res.status}`);
  const data = await res.json();
  return data.embeddings[0];
}

export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const prefixedQuery = `query: ${query}`;

  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: prefixedQuery,
    }),
  });

  if (!res.ok) throw new Error(`Ollama embed failed: ${res.status}`);
  const data = await res.json();
  return data.embeddings[0];
}

export const MODEL_VERSION = `${EMBEDDING_MODEL}@1.0`;
export { EMBEDDING_DIMENSIONS };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tesseract CLI wrapper | Stirling-PDF REST API (wraps Tesseract + LibreOffice) | 2024 | Single container for all PDF operations; no need to manage Tesseract/LibreOffice separately |
| pdf.js manual integration | react-pdf v9 (wojtekmaj) | 2024 | Clean React wrapper with text layer, annotation layer, and proper ESM support |
| Prisma native vector type | Prisma `Unsupported("vector")` + raw SQL | 2025 | pgvector support in Prisma Postgres announced but native ORM support not yet stable |
| IVFFlat indexes | HNSW indexes for pgvector | 2024 | HNSW provides better recall and does not require periodic re-indexing |
| sentence-transformers | multilingual-e5-large-instruct via Ollama | 2025 | Best open-source multilingual model per MMTEB benchmark; 1024 dimensions |
| Manual text splitting | @langchain/textsplitters | 2024 | Production-ready recursive splitting with metadata propagation |

**Deprecated/outdated:**
- `@react-pdf-viewer/core` (last published 3 years ago) -- use `react-pdf` (wojtekmaj) instead
- `IVFFlat` pgvector index -- use `HNSW` for better recall without periodic rebuild
- `pdfjs-dist` v3 (`.js` worker) -- v4+ uses `.mjs` worker extension

## Open Questions

1. **Ollama Docker Service**
   - What we know: Ollama is needed for `multilingual-e5-large-instruct` embeddings; it can run as a Docker service
   - What's unclear: Whether to add Ollama to docker-compose now (Phase 4) or defer to Phase 6 (AI features). Embedding generation requires ~2GB VRAM or will run on CPU (slower but functional).
   - Recommendation: Add Ollama to docker-compose in Phase 4 with a `profiles: ["ai"]` flag so it is optional. If Ollama is unavailable, embedding jobs should gracefully skip with a log warning. This allows the pipeline to work without a GPU while being ready for Phase 6.

2. **PDF Preview Storage Strategy**
   - What we know: Non-PDF documents need a generated PDF preview stored in MinIO
   - What's unclear: Whether to generate previews eagerly (on upload) or lazily (on first view)
   - Recommendation: Generate eagerly via a `document-preview` queue job triggered immediately after upload for non-PDF files. Store at `akten/{akteId}/previews/{dokumentId}.pdf`. Preview generation should have lower priority than OCR.

3. **Text Extraction from Non-PDF Formats**
   - What we know: DOCX, ODT, XLSX, CSV, TXT all need text extracted for Meilisearch and RAG
   - What's unclear: Best approach for extracting text from each format
   - Recommendation: For PDF files, use OCR text. For DOCX/ODT, extract text via Stirling-PDF's `/api/v1/convert/pdf/text` or use `mammoth` npm for DOCX (lightweight, good fidelity). For TXT/CSV/HTML, read directly. For XLSX, use a simple text extraction. Store extracted text in `Dokument.ocrText` regardless of source.

4. **Embedding Batch Size via Ollama**
   - What we know: Ollama's `/api/embed` endpoint accepts a single input or an array
   - What's unclear: Optimal batch size for throughput vs memory
   - Recommendation: Start with batch size of 1 (single chunk per request) for simplicity and reliability. Optimize to batches of 5-10 if performance is insufficient. The bottleneck will be model inference time, not HTTP overhead.

## Sources

### Primary (HIGH confidence)
- [Stirling-PDF Official Docs](https://docs.stirlingpdf.com/) -- API endpoints, Docker configuration, OCR parameters
- [Stirling-PDF GitHub](https://github.com/Stirling-Tools/Stirling-PDF) -- Docker compose examples, image tags
- [react-pdf GitHub (wojtekmaj)](https://github.com/wojtekmaj/react-pdf) -- Next.js integration, worker setup, text layer
- [pgvector GitHub](https://github.com/pgvector/pgvector) -- HNSW index, cosine similarity, SQL syntax
- [Prisma PostgreSQL Extensions Docs](https://www.prisma.io/docs/postgres/database/postgres-extensions) -- `Unsupported()` type, raw SQL for extensions
- [LangChain.js textsplitters](https://www.npmjs.com/package/@langchain/textsplitters) -- RecursiveCharacterTextSplitter API

### Secondary (MEDIUM confidence)
- [MMTEB Benchmark](https://arxiv.org/abs/2502.13595) -- multilingual-e5-large-instruct is best open-source multilingual model (verified multiple sources)
- [Stirling-PDF DeepWiki](https://deepwiki.com/Stirling-Tools/Stirling-PDF/4-api-reference) -- Complete API endpoint list, OCR + conversion endpoints verified
- [react-pdf npm](https://www.npmjs.com/package/react-pdf) -- v9 with pdfjs-dist 4.x, worker .mjs extension

### Tertiary (LOW confidence)
- Ollama batch embedding performance -- untested; batch size recommendations based on general patterns, not specific benchmarks
- Stirling-PDF memory requirements -- 4GB recommendation based on community reports, not official benchmarks
- German legal text chunking separators -- based on domain knowledge of German legal document structure, not empirical testing with this specific pipeline

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries verified via npm/GitHub/official docs; versions confirmed current
- Architecture: MEDIUM-HIGH -- Patterns based on existing codebase conventions (BullMQ, Meilisearch, MinIO) extended with verified APIs
- Pitfalls: MEDIUM -- react-pdf/Next.js issues confirmed via GitHub issues; pgvector/Prisma limitations documented; Stirling-PDF memory from community reports
- Embedding model: MEDIUM -- MMTEB benchmark validates multilingual-e5-large-instruct as best open-source multilingual model, but not tested specifically with German legal text in this pipeline

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (30 days -- stable libraries, well-documented APIs)
