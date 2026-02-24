# Stack Research: New Capabilities for AI-Lawyer

**Domain:** AI-First Kanzleisoftware (Legal Practice Management) -- Subsequent Milestone
**Researched:** 2026-02-24
**Confidence:** MEDIUM-HIGH (most libraries verified via npm, some niche German finance libs are young)

> This document covers ONLY the libraries/services to ADD to the existing stack.
> The existing stack (Next.js 14, Prisma, PostgreSQL 16, MinIO, Meilisearch, OnlyOffice, NextAuth v5, shadcn/ui) is NOT repeated here.

---

## 1. Email: IMAP Client + SMTP Send

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **imapflow** | 1.2.10 | IMAP client with IDLE support | Modern async/await API, automatic IDLE on inactivity, built-in mailbox locking, handles reconnection. From the creator of Nodemailer (Andris Reinman). The only actively maintained IMAP client for Node.js that is production-quality. | HIGH |
| **nodemailer** | 8.0.1 | SMTP email sending | De facto standard for Node.js email. Zero runtime deps, DKIM signing, OAuth2. No real alternative exists. | HIGH |
| **mailparser** | 3.9.3 | Parse MIME email messages | Also by Andris Reinman. Streaming parser handles 100MB+ messages. Extracts headers, body (text/html), attachments as structured objects. Pairs naturally with ImapFlow. | HIGH |
| **sanitize-html** | 2.17.1 | Sanitize HTML email body | ImapFlow/mailparser do NOT sanitize HTML. Displaying raw email HTML without sanitization = XSS vulnerability. Required for any email display. | HIGH |
| **html-to-text** | 9.0.5 | Convert HTML emails to plain text | For email previews/snippets in inbox list, search indexing, and cases where HTML rendering is not desired. | MEDIUM |

### Why This Combination

ImapFlow + mailparser + nodemailer form a cohesive ecosystem from the same author (Andris Reinman / Nodemailer project). ImapFlow handles IMAP IDLE natively -- IDLE starts automatically on connection inactivity unless `disableAutoIdle` is set. This means real-time email notifications come out of the box without custom IDLE management.

**Architecture note:** ImapFlow needs a persistent connection, which means a background worker/service -- NOT an API route. The IMAP connection must run in a separate Node.js process or a long-lived server-side singleton, not inside Next.js API routes which are short-lived.

### Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| imapflow | node-imap | Unmaintained (last update 2019), callback-based API, manual IDLE handling required |
| imapflow | imap-simple | Wrapper around node-imap -- inherits all its problems plus adds abstraction overhead |
| mailparser | mailparser-mit | Fork with MIT license, but less maintained than original |

---

## 2. Multi-Provider LLM Abstraction

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **ai** (Vercel AI SDK) | ^4.3.19 | Core AI SDK -- streaming, tool calling, structured output | Unified API across all LLM providers. `generateText()`, `streamText()`, `generateObject()` work identically regardless of provider. React hooks (`useChat`, `useCompletion`) for frontend. Node >= 18 compatible. | HIGH |
| **@ai-sdk/openai** | ^1.3.24 | OpenAI provider | Official provider. Supports GPT-4o, o1, embeddings. Works with AI SDK v4. | HIGH |
| **@ai-sdk/anthropic** | ^1.2.12 | Anthropic provider | Official provider. Supports Claude 3.5/4, tool use. Works with AI SDK v4. | HIGH |
| **ollama-ai-provider** | ^1.2.0 | Ollama provider (local LLM) | Community provider for AI SDK v4 compatibility. Supports chat + embeddings via Ollama API. | MEDIUM |

### CRITICAL: Why AI SDK v4, NOT v6

The project uses **zod 3.23.8**. AI SDK v6 requires `zod ^3.25.76 || ^4.1.8` -- a breaking change that would cascade through every form validation, every API route, and every schema in the existing codebase. AI SDK v4:

- Requires `zod ^3.23.8` (exactly what the project has)
- Requires `react ^18` (what the project has)
- Requires `node >= 18` (what the project has)
- Is still actively maintained (v4.3.19 is recent)
- Has all features needed: streaming, tool calling, structured output, provider registry

Upgrading to v6 is possible later when the project is ready for a zod major version bump, but it is NOT required for any of the planned features.

**Provider version alignment:**
- AI SDK v4 uses `@ai-sdk/openai` v1.x and `@ai-sdk/anthropic` v1.x
- AI SDK v6 uses `@ai-sdk/openai` v3.x and `@ai-sdk/anthropic` v3.x
- `ollama-ai-provider` v1.2.0 works with AI SDK v4
- `ai-sdk-ollama` v3.7.1 requires AI SDK v6 (NOT compatible with v4)

### Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Vercel AI SDK v4 | LangChain.js | Heavier abstraction, more complexity than needed for provider switching. LangChain is better for complex chains/agents but overkill for the provider abstraction layer. Use LangChain only for text splitting (see RAG section). |
| Vercel AI SDK v4 | Direct fetch to each API | No streaming abstraction, no unified tool calling, duplicated error handling per provider. Defeats the purpose of multi-provider. |
| Vercel AI SDK v4 | Vercel AI SDK v6 | Requires zod >= 3.25.76 -- breaking change for entire codebase. Not worth the migration risk for no functional gain. |

---

## 3. RAG Pipeline (Embeddings, Chunking, Vector Search)

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **pgvector** (npm) | 0.2.1 | pgvector client for Node.js | Lightweight wrapper for pgvector SQL operations. The project already has PostgreSQL 16 + pgvector extension in Docker. This npm package provides `toSql()` / `fromSql()` for vector serialization. | HIGH |
| **@langchain/textsplitters** | 1.0.1 | Text chunking for documents | RecursiveCharacterTextSplitter is the gold standard for RAG chunking. Handles markdown, code, plain text with configurable chunk size/overlap. No need to reinvent this. | HIGH |
| **@langchain/core** | 1.1.27 | LangChain core (dependency of textsplitters) | Required peer dependency. Also provides Document class used throughout the pipeline. | HIGH |
| Vercel AI SDK embeddings | (via ai + providers) | Generate embeddings | `embed()` and `embedMany()` from AI SDK. Use OpenAI `text-embedding-3-small` or Ollama embeddings. No additional package needed beyond the AI SDK providers above. | HIGH |

### RAG Architecture with Existing Stack

The project already has pgvector in Docker. The RAG pipeline does NOT need a separate vector database:

1. **Chunking:** `@langchain/textsplitters` splits DOCX/PDF text into chunks
2. **Embedding:** AI SDK `embed()` with OpenAI or Ollama generates vectors
3. **Storage:** Prisma + raw SQL with `pgvector` npm package for vector operations
4. **Retrieval:** Cosine similarity search via `pgvector` `<=>` operator in raw SQL through Prisma `$queryRaw`

**Why NOT use LangChain for the full pipeline:** LangChain's retrieval chains add unnecessary abstraction. The AI SDK already handles LLM calls. Use LangChain ONLY for text splitting, which is genuinely the best implementation available. Everything else (embedding, storage, retrieval, generation) is simpler with direct AI SDK + Prisma + raw SQL.

### Chunking Strategy Recommendation

For legal documents:
- **Chunk size:** 512 tokens (legal texts are dense; smaller chunks improve precision)
- **Overlap:** 64 tokens (preserve context at boundaries)
- **Splitter:** `RecursiveCharacterTextSplitter` with separators optimized for legal text (paragraph breaks, section headers, sentence boundaries)

### Text Extraction (for PDF/DOCX before chunking)

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Stirling-PDF API | (Docker service) | Extract text from PDFs, OCR scanned documents | Already planned as Docker service. Use its `/api/v1/convert/pdf/text` endpoint for text extraction. Handles OCR for scanned documents. | MEDIUM |
| **docxtemplater** (already installed) | 3.68.2 | Extract text from DOCX | Already in the project for template processing. Can extract raw text from DOCX for chunking. | HIGH |

### Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| pgvector + Prisma raw SQL | Pinecone/Weaviate/Qdrant | External services violate self-hosted requirement. pgvector is already deployed. |
| @langchain/textsplitters | Custom chunking | RecursiveCharacterTextSplitter handles edge cases (Unicode, mixed content) that take weeks to get right manually |
| AI SDK embed() | OpenAI SDK directly | Would bypass the multi-provider abstraction. AI SDK embed() works with any provider. |

---

## 4. CalDAV Sync (Bidirectional)

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **tsdav** | 2.1.8 | CalDAV/CardDAV/WebDAV client | Written in TypeScript. Supports RFC 6578 WebDAV sync + basic sync fallback. CRUD for calendars/events. Works with Google Calendar, iCloud, Nextcloud, any CalDAV server. Most actively maintained CalDAV client for Node.js (published 3 days ago). | MEDIUM |
| **ical.js** | 2.2.1 | iCalendar (RFC 5545) parsing/generation | Parses and generates VCALENDAR/VEVENT/VTODO. Required because tsdav returns raw iCalendar data that needs parsing into structured objects. From the Mozilla Calendar project (Thunderbird/Lightning). | MEDIUM |

### Architecture Note

CalDAV sync is bidirectional and conflict-prone:
- Use ETag-based change detection (tsdav supports this)
- Store sync tokens (`ctag`, `etag`) per calendar in Prisma
- Implement last-write-wins or prompt-user conflict resolution
- Run sync as a background job (cron-based, not real-time -- CalDAV is not designed for real-time)

### Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| tsdav | ts-caldav | Newer but less proven. Only 1 contributor. tsdav is forked by Cal.com and battle-tested. |
| tsdav | dav (lambdabaa) | Callback-based, last updated 2017. No TypeScript types. |
| tsdav | cdav-library (Nextcloud) | Nextcloud-specific, not general-purpose. |

---

## 5. E-Rechnung (XRechnung + ZUGFeRD)

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **@e-invoice-eu/core** | 2.3.1 | Generate XRechnung and ZUGFeRD e-invoices | Full EN16931 conformance. Supports XRECHNUNG-CII, XRECHNUNG-UBL, Factur-X/ZUGFeRD. TypeScript-native with full type definitions. Generates XML from JSON input -- perfect for server-side invoice generation. Actively maintained (v2.3.1 is recent). | MEDIUM |

### Important Limitations and Workarounds

**ZUGFeRD PDF embedding:** @e-invoice-eu/core generates the XML, but embedding it into a PDF/A-3 requires additional tooling. Options:
1. Use Stirling-PDF to attach the XML to an existing invoice PDF (via its API)
2. Use `pdf-lib` (1.17.1) to manipulate PDFs and attach the XML as an embedded file
3. For ZUGFeRD EXTENDED/COMFORT profiles, the XML must be embedded in a PDF/A-3B compliant file

**XRechnung standalone:** XRechnung is pure XML (UBL or CII format). No PDF embedding needed. Send the XML directly to the recipient.

**Legal requirement since 01.01.2025:** All B2B invoices in Germany must be receivable as e-invoices. Sending obligation has transition periods through 2027.

### Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| @e-invoice-eu/core | node-zugferd | Still beta (0.1.1-beta.1). Limited to ZUGFeRD -- no XRechnung UBL support. |
| @e-invoice-eu/core | horstoeko/zugferd | PHP library, not usable in Node.js. |
| @e-invoice-eu/core | RechnungsAPI (SaaS) | External API dependency violates self-hosted-first constraint. |

---

## 6. SEPA (pain.001 + pain.008)

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **sepa** (kewisch/sepa.js) | 2.1.0 | Generate SEPA XML for credit transfers and direct debits | Supports pain.001.001.09 (credit transfers/Ueberweisungen) and pain.008.001.08 (direct debits/Lastschriften). Works in Node.js and browser. Pure JavaScript, no native deps. Most established SEPA library in the npm ecosystem. | MEDIUM |

### Usage Pattern

```typescript
import SEPA from 'sepa';

// Credit Transfer (pain.001)
const doc = new SEPA.Document('pain.001.001.09');
doc.grpHdr.id = 'XMPL.20240101.TR0';
doc.grpHdr.created = new Date();
const info = doc.createPaymentInfo();
info.requestedExecutionDate = new Date();
info.debtorIBAN = 'DE89370400440532013000';
info.debtorBIC = 'COBADEFFXXX';
const tx = info.createTransaction();
tx.creditorName = 'Max Mustermann';
tx.creditorIBAN = 'DE02120300000000202051';
tx.amount = 145.32;
tx.remittanceInfo = 'Rechnung RE-2024-001';
console.log(doc.toString());
```

### Caveat

The sepa package was last published ~3 years ago. The SEPA XML formats (pain.001.001.09, pain.008.001.08) are stable ISO 20022 standards that do not change frequently. The library works correctly for current SEPA requirements. However, monitor for any new SEPA regulatory changes.

### Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| sepa (kewisch) | sepa-xml | Version 0.6.0, less feature-complete, fewer supported pain format versions |
| sepa (kewisch) | Custom XML generation | SEPA XML has strict validation rules. Reimplementing is error-prone and unnecessary. |

---

## 7. Stirling-PDF Integration (OCR, Merge, Split)

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Stirling-PDF** (Docker) | latest | PDF operations: OCR, merge, split, compress, rotate, convert, watermark | REST API via Swagger. Runs as Docker container alongside the existing stack. No npm package needed -- integrate via HTTP fetch calls to the Stirling-PDF API. Auth via `X-API-KEY` header. | HIGH |

### Integration Pattern

Stirling-PDF is NOT an npm package. It is a Docker service with a REST API:

```yaml
# docker-compose.yml addition
stirling-pdf:
  image: stirlingtools/stirling-pdf:latest
  ports:
    - "8081:8080"
  environment:
    - DOCKER_ENABLE_SECURITY=true
    - SECURITY_ENABLELOGIN=false
    - SECURITY_APIKEY=your-api-key
  volumes:
    - stirling_data:/usr/share/tessdata
```

**Key API endpoints** (via native `fetch()`, no SDK needed):
- `POST /api/v1/security/auto-ocr` -- OCR with auto-detection
- `POST /api/v1/general/merge-pdfs` -- Merge multiple PDFs
- `POST /api/v1/general/split-pdf-by-pages` -- Split PDF
- `POST /api/v1/general/compress-pdf` -- Compress
- `POST /api/v1/convert/pdf/text` -- Extract text (for RAG pipeline)
- `POST /api/v1/security/add-watermark` -- Watermark
- `POST /api/v1/general/rotate-pdf` -- Rotate pages

**Note:** Not all Stirling-PDF features are API-accessible. The Swagger docs at `/swagger-ui/index.html` on the running instance are the authoritative endpoint list.

### Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Stirling-PDF (Docker) | pdf-lib + tesseract.js | Would need separate OCR, separate merge, separate split logic. Stirling-PDF bundles all PDF operations in one service. |
| Stirling-PDF (Docker) | Apache PDFBox | Java-based, would need a JVM sidecar. Stirling-PDF is already a wrapper around PDFBox + LibreOffice. |
| Stirling-PDF (Docker) | Gotenberg | Less PDF manipulation features. Good for HTML-to-PDF but not for OCR/merge/split. |

---

## 8. Internal Messaging (WebSocket / Real-Time)

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **socket.io** | 4.8.3 | Real-time bidirectional communication (server) | Automatic reconnection, room-based messaging (perfect for case threads + channels), fallback to long-polling, binary support for attachments. Explicit Next.js integration guide from Socket.IO docs. | HIGH |
| **socket.io-client** | 4.8.3 | Client-side Socket.IO | Paired with server. React-friendly. | HIGH |

### Architecture: Socket.IO with Next.js

Next.js API routes are stateless and short-lived. WebSocket connections are long-lived. This architectural mismatch requires one of two patterns:

**Recommended: Custom HTTP server alongside Next.js**

```typescript
// server.ts -- runs alongside Next.js
import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';

const app = next({ dev: process.env.NODE_ENV !== 'production' });
const handler = app.getRequestHandler();
const httpServer = createServer(handler);
const io = new Server(httpServer, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  socket.on('join-case', (caseId) => socket.join(`case:${caseId}`));
  socket.on('message', (data) => io.to(`case:${data.caseId}`).emit('message', data));
});

httpServer.listen(3000);
```

This replaces the default `next start` with a custom server that wraps Next.js AND Socket.IO on the same port.

**Room structure:**
- `case:{akteId}` -- case-specific discussion threads
- `channel:{channelId}` -- general channels
- `user:{userId}` -- direct notifications

### Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Socket.IO | ws (raw WebSocket) | No automatic reconnection, no rooms, no fallback transport, no built-in namespacing. More code for less reliability. |
| Socket.IO | Pusher/Ably | External SaaS. Violates self-hosted-first. |
| Socket.IO | Server-Sent Events (SSE) | Unidirectional (server-to-client only). Messaging requires bidirectional. |
| Socket.IO | Liveblocks/PartyKit | External services. Not self-hosted. |

---

## 9. Mandantenportal (Client Portal with Separate Auth)

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **NextAuth.js v5** (already installed) | 5.0.0-beta.25 | Authentication for client portal | Extend the existing auth system with a separate `MANDANT` role. Use JWT session with `tenantType` claim to distinguish internal users from portal users. No additional auth library needed. | HIGH |

### Architecture: NOT a Separate App

The Mandantenportal should be a **route group within the same Next.js app**, not a separate deployment:

```
src/app/
  (dashboard)/     -- Internal users (ADMIN, ANWALT, etc.)
  (portal)/        -- Mandanten (client portal)
  api/portal/      -- Portal-specific API routes
```

**Why same app, not separate:**
- Shared Prisma schema and database
- Shared MinIO for document access
- Shared NextAuth (just different role checks)
- No cross-origin complexity
- One Docker container, not two

**Auth differentiation:**
- Internal users: login at `/login` with existing credentials
- Mandanten: login at `/portal/login` with invitation token + password
- JWT contains `role: 'MANDANT'` + `mandantId` for filtering
- Middleware checks route group and role match

**No additional npm packages needed** -- this is purely an architectural/routing concern using existing NextAuth v5 + Prisma.

---

## Supporting Libraries (Cross-Cutting)

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| **pdf-lib** | 1.17.1 | PDF manipulation in pure JS | Embedding ZUGFeRD XML into PDF/A, generating simple PDF documents, modifying PDF metadata. Lighter than Stirling-PDF for simple operations. | MEDIUM |
| **ical.js** | 2.2.1 | iCalendar parsing/generation | Paired with tsdav for CalDAV sync. Converts between VCALENDAR format and JS objects. | MEDIUM |
| **pgvector** | 0.2.1 | pgvector helper for Node.js | Vector serialization for RAG pipeline. `toSql()` / `fromSql()` for embedding vectors. | HIGH |

---

## Installation

```bash
# Email
npm install imapflow nodemailer mailparser sanitize-html html-to-text

# AI / LLM (use exact v4.x range to avoid v6 auto-upgrade)
npm install ai@^4.3.19 @ai-sdk/openai@^1.3.24 @ai-sdk/anthropic@^1.2.12 ollama-ai-provider@^1.2.0

# RAG Pipeline
npm install @langchain/textsplitters@^1.0.1 @langchain/core@^1.1.27 pgvector@^0.2.1

# CalDAV
npm install tsdav@^2.1.8 ical.js@^2.2.1

# E-Rechnung
npm install @e-invoice-eu/core@^2.3.1

# SEPA
npm install sepa@^2.1.0

# Real-Time Messaging
npm install socket.io@^4.8.3 socket.io-client@^4.8.3

# Supporting
npm install pdf-lib@^1.17.1

# Type definitions (dev)
npm install -D @types/nodemailer @types/sanitize-html @types/html-to-text
```

**Docker Compose additions (no npm):**
```yaml
stirling-pdf:
  image: stirlingtools/stirling-pdf:latest
  # ... (see section 7)
```

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **ai@^6** (AI SDK v6) | Requires zod >= 3.25.76. Would force zod upgrade across entire codebase. | ai@^4.3.19 -- all needed features, compatible with current zod 3.23.8 |
| **ai-sdk-ollama** (v3.x) | Requires AI SDK v6. Incompatible with v4. | ollama-ai-provider@^1.2.0 |
| **node-imap** | Unmaintained since 2019. Callback-based. No async/await. | imapflow |
| **LangChain.js for full RAG** | Overly complex abstraction for embedding/retrieval. Dozens of transitive deps. | LangChain ONLY for text splitting. AI SDK for embedding/generation. Prisma raw SQL for vector search. |
| **Pinecone / Weaviate / Qdrant** | External vector databases. Violates self-hosted constraint. Adds operational complexity. | pgvector (already in the Docker stack) |
| **node-zugferd** | Beta (0.1.1-beta.1). ZUGFeRD only, no XRechnung UBL. | @e-invoice-eu/core |
| **ws** (raw WebSocket) | No rooms, no reconnection, no transport fallback. | socket.io |
| **Separate Next.js app for portal** | Double deployment, shared-nothing DB access, CORS complexity. | Route groups in same app with role-based middleware |

---

## Version Compatibility Matrix

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| ai@^4.3.19 | zod@^3.23.8, react@^18, node >= 18 | Current project stack is fully compatible |
| @ai-sdk/openai@^1.3.24 | ai@^4.x, zod@^3.0.0 | v1.x line for AI SDK v4 |
| @ai-sdk/anthropic@^1.2.12 | ai@^4.x, zod@^3.0.0 | v1.x line for AI SDK v4 |
| ollama-ai-provider@^1.2.0 | ai@^4.x, zod@^3.0.0 | Works with AI SDK v4 (NOT v6) |
| @langchain/textsplitters@^1.0.1 | @langchain/core@^1.1.x | Peer dependency |
| socket.io@^4.8.3 | node >= 12 | Broadly compatible |
| tsdav@^2.1.8 | node >= 16 | TypeScript native |
| imapflow@^1.2.10 | node >= 14 | Async/await based |

---

## Docker Services Summary

| Service | Image | Port | Purpose | New? |
|---------|-------|------|---------|------|
| stirling-pdf | stirlingtools/stirling-pdf:latest | 8081 | PDF OCR/merge/split/compress | NEW |
| app | (custom) | 3000 | Next.js + Socket.IO (custom server) | MODIFIED (custom server for WebSocket) |

All other Docker services (db, minio, meilisearch, onlyoffice, ollama) remain unchanged.

---

## Sources

- [imapflow npm](https://www.npmjs.com/package/imapflow) -- v1.2.10 verified via `npm view`
- [ImapFlow documentation](https://imapflow.com/) -- IDLE behavior, API reference
- [nodemailer](https://nodemailer.com/) -- v8.0.1 verified via `npm view`
- [Vercel AI SDK docs](https://ai-sdk.dev/docs/introduction) -- Provider model, streaming API
- [AI SDK 6 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0) -- Breaking changes (zod requirement)
- [AI SDK providers](https://ai-sdk.dev/docs/foundations/providers-and-models) -- Provider ecosystem
- [ollama-ai-provider](https://github.com/sgomez/ollama-ai-provider) -- v1.2.0, AI SDK v4 compatible
- [LangChain text splitters](https://js.langchain.com/v0.1/docs/modules/data_connection/document_transformers/) -- RecursiveCharacterTextSplitter
- [pgvector npm](https://www.npmjs.com/package/pgvector) -- v0.2.1 verified
- [tsdav](https://github.com/natelindev/tsdav) -- v2.1.8, CalDAV/CardDAV TypeScript client
- [ical.js](https://www.npmjs.com/package/ical.js) -- v2.2.1, iCalendar parser
- [@e-invoice-eu/core](https://github.com/gflohr/e-invoice-eu) -- v2.3.1, XRechnung + ZUGFeRD
- [sepa.js](https://github.com/kewisch/sepa.js) -- v2.1.0, pain.001 + pain.008
- [Stirling-PDF docs](https://docs.stirlingpdf.com/) -- REST API, Docker deployment
- [Stirling-PDF GitHub](https://github.com/Stirling-Tools/Stirling-PDF) -- API capabilities
- [Socket.IO + Next.js guide](https://socket.io/how-to/use-with-nextjs) -- Integration patterns
- [socket.io npm](https://www.npmjs.com/package/socket.io) -- v4.8.3 verified
- [mailparser](https://nodemailer.com/extras/mailparser) -- v3.9.3, MIME parsing
- [sanitize-html npm](https://www.npmjs.com/package/sanitize-html) -- v2.17.1
- [pdf-lib npm](https://www.npmjs.com/package/pdf-lib) -- v1.17.1

---
*Stack research for: AI-Lawyer subsequent milestone capabilities*
*Researched: 2026-02-24*
