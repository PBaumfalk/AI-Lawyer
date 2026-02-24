# Architecture Research

**Domain:** AI-First Kanzleisoftware -- Integrating 7 New Capabilities into Existing Monolith
**Researched:** 2026-02-24
**Confidence:** HIGH (current architecture well-understood, patterns verified with multiple sources)

## Core Question

How should IMAP IDLE, RAG pipeline, real-time messaging, client portal, background jobs, CalDAV sync, and Stirling-PDF integrate into the existing Next.js monolith? What stays in-process, what becomes a sidecar, and what needs a separate worker?

## Verdict: Hybrid Monolith + Worker + Sidecars

The existing Next.js standalone monolith cannot handle long-running connections (IMAP IDLE, WebSocket, CalDAV sync) or CPU-heavy background processing (RAG embedding, OCR queue) within its standard request-response model. The architecture must evolve into three tiers:

1. **Next.js App** -- stays as-is for UI, API routes, short-lived requests
2. **Worker Process** -- new Node.js process for background jobs (BullMQ + Redis)
3. **Sidecar Services** -- Stirling-PDF (existing Docker image), Redis (new)

WebSocket and IMAP IDLE are integrated via a custom `server.ts` that wraps the Next.js standalone server, keeping the deployment as a single Docker container.

## System Overview

```
                        Browser Clients              External Calendars
                              |                            |
                              v                            v
                    +---------+----------+        +--------+--------+
                    |   Next.js App      |        |  CalDAV Sync    |
                    |   (Custom Server)  |        |  (in Worker)    |
                    |                    |        +---------+-------+
                    |  +- HTTP Routes    |                  |
                    |  +- WebSocket IO   |                  |
                    |  +- Auth (NextAuth)|                  |
                    +---+----+-----------+                  |
                        |    |                              |
           +------------+    +----------+                   |
           |                            |                   |
           v                            v                   v
  +--------+--------+         +--------+--------+  +-------+--------+
  |   PostgreSQL    |         |     Redis       |  |   PostgreSQL   |
  |   + pgvector    |         |   (Job Queue)   |  |   (shared)     |
  +--------+--------+         +--------+--------+  +----------------+
           |                            |
           |                   +--------+--------+
           |                   |   Worker Node   |
           |                   |   (BullMQ)      |
           |                   |                  |
           |                   |  +- IMAP IDLE   |
           |                   |  +- RAG Embed   |
           |                   |  +- OCR Queue   |
           |                   |  +- CalDAV Sync |
           |                   |  +- AI Tasks    |
           |                   +--------+--------+
           |                            |
           +----------------------------+
           |                            |
  +--------+--------+         +--------+--------+
  |     MinIO       |         | Stirling-PDF    |
  |   (S3 Storage)  |         | (REST API)      |
  +-----------------+         +-----------------+
```

## Component Responsibilities

| Component | Responsibility | Communicates With | Deployment |
|-----------|----------------|-------------------|------------|
| **Next.js App** | UI rendering, REST API routes, WebSocket server, auth | PostgreSQL, Redis, MinIO, Meilisearch, Worker (via Redis) | Docker container (custom server.ts) |
| **Worker Process** | Long-running jobs: IMAP IDLE, RAG embedding, OCR queue, CalDAV sync, AI tasks | PostgreSQL, Redis, MinIO, Meilisearch, Stirling-PDF, Ollama | Same Docker image, separate entrypoint |
| **Redis** | Job queue (BullMQ), WebSocket pub/sub adapter, session cache | Next.js App, Worker | Docker container |
| **Stirling-PDF** | PDF OCR, merge, split, convert, compress, watermark | Worker (via REST API) | Docker container (sidecar) |
| **PostgreSQL + pgvector** | Relational data, vector embeddings for RAG | Next.js App, Worker | Docker container (existing) |
| **Ollama** | LLM inference (embedding generation, text generation) | Worker, Next.js App (for chat) | Docker container or host process |

## What Stays In The Monolith

These capabilities fit naturally into Next.js API routes and require no architectural changes:

| Capability | Why It Stays | Implementation |
|------------|-------------|----------------|
| **RAG retrieval** (query-time) | Short-lived request: embed query, cosine search, return results | API route calls pgvector via raw SQL |
| **AI chat** (streaming) | Request-scoped streaming response | API route using Vercel AI SDK `streamText()` |
| **Client portal auth** | Path-based multi-tenancy, same NextAuth with role check | Middleware + route group `/(portal)/` |
| **Client portal UI** | Standard Next.js pages with restricted data access | Server components with portal session |
| **Document status transitions** | CRUD operations | Existing API routes |
| **Stirling-PDF API calls** (on-demand) | User-triggered, short-lived HTTP call to sidecar | API route proxies to Stirling-PDF |

## What Needs The Worker Process

These capabilities require persistent connections or long-running compute that would block or crash Next.js:

| Capability | Why It Leaves | Worker Implementation |
|------------|--------------|----------------------|
| **IMAP IDLE** | Persistent TCP connection per mailbox, must survive request lifecycle | ImapFlow client per mailbox, reconnect on disconnect, emit events to Redis |
| **RAG embedding** (ingestion) | CPU-heavy: chunk document, generate embeddings for every chunk, store vectors | BullMQ job: fetch from MinIO, chunk, embed via Ollama/OpenAI, insert pgvector |
| **OCR queue** | Network I/O to Stirling-PDF, potentially minutes per large PDF | BullMQ job: send PDF to Stirling-PDF, wait for result, update MinIO + Meilisearch |
| **CalDAV sync** | Periodic polling + bidirectional conflict resolution | BullMQ repeatable job: fetch remote, diff, merge, push changes |
| **AI task processing** | LLM inference can take 10-60s, must not block API | BullMQ job: load context, call Ollama, store draft |
| **Email sending** (SMTP) | Retry logic, rate limiting, attachment handling | BullMQ job: compose, send via SMTP, update status |

## What Becomes a New Docker Service

| Service | Why Separate | Notes |
|---------|-------------|-------|
| **Redis 7** | Required by BullMQ for job queue + Socket.IO adapter for multi-process pub/sub | Lightweight, ~50MB memory for this workload |
| **Stirling-PDF** | Pre-built Docker image with Tesseract OCR, Java runtime -- too heavy to embed | Use `stirlingtools/stirling-pdf:latest-fat` for OCR support |

Ollama is already assumed to run as a separate service (existing pattern).

## Detailed Integration Patterns

### Pattern 1: Custom Server for WebSocket (Next.js + Socket.IO)

**What:** Replace the default Next.js standalone `server.js` with a custom `server.ts` that attaches a Socket.IO server to the same HTTP server.

**Why:** Self-hosted Docker deployment means no serverless constraints. A custom server is the standard pattern for WebSocket support in Next.js on Docker.

**Confidence:** HIGH -- verified with Socket.IO official docs, multiple production examples, and the existing `output: "standalone"` config already generates a `server.js` that can be replaced.

**Trade-offs:**
- Pro: Single port, single container, no extra service for WebSocket
- Pro: Socket.IO handles reconnection, rooms (per-Akte channels), namespaces
- Con: Loses automatic Next.js server optimizations (minor for self-hosted)
- Con: Must use Redis adapter for Socket.IO if scaling to multiple app instances

**Implementation:**

```typescript
// server.ts (replaces default standalone server.js)
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

const app = next({ dev: false, hostname: "0.0.0.0", port: 3000 });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/api/socketio",
    addTrailingSlash: false,
  });

  // Redis adapter for multi-instance support
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));

  // Auth middleware -- verify NextAuth JWT
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    // Verify JWT from NextAuth session
    // Attach user/role to socket.data
    next();
  });

  // Namespaces
  const messaging = io.of("/messaging");
  const notifications = io.of("/notifications");

  httpServer.listen(3000, "0.0.0.0");
});
```

**Dockerfile change:** Replace `exec node server.js` with `exec node server.js` (compile server.ts to server.js during build, copy to standalone output).

### Pattern 2: BullMQ Worker Process (Shared Codebase, Separate Entrypoint)

**What:** A single Worker process running from the same Docker image as the Next.js app, but with a different entrypoint (`node worker.js` instead of `node server.js`).

**Why:** Shares Prisma client, lib code, type definitions. No code duplication. Single Docker image, two services in docker-compose.

**Confidence:** HIGH -- BullMQ is the standard Node.js job queue (successor to Bull). Pattern of same-image-different-entrypoint is well-established in Docker.

**Trade-offs:**
- Pro: Code sharing via imports from `src/lib/`
- Pro: Single build step, single Docker image
- Pro: BullMQ handles retries, backoff, concurrency, rate limiting, job deduplication
- Con: Worker failures do not affect the web app (good isolation)
- Con: Requires Redis (acceptable trade-off for reliability)

**Implementation:**

```typescript
// worker.ts (separate entrypoint)
import { Worker, Queue } from "bullmq";
import { Redis } from "ioredis";

const connection = new Redis(process.env.REDIS_URL!);

// Register job processors
const emailSyncWorker = new Worker("email-sync", processEmailSync, {
  connection, concurrency: 5,
});

const ragEmbedWorker = new Worker("rag-embed", processRagEmbed, {
  connection, concurrency: 2, // CPU-bound, limit concurrency
});

const ocrWorker = new Worker("ocr", processOcr, {
  connection, concurrency: 3,
});

const aiTaskWorker = new Worker("ai-tasks", processAiTask, {
  connection, concurrency: 1, // Ollama is single-threaded
});

const caldavWorker = new Worker("caldav-sync", processCalDavSync, {
  connection, concurrency: 1,
});
```

**Docker Compose addition:**

```yaml
worker:
  build: .
  container_name: ailawyer-worker
  restart: unless-stopped
  entrypoint: ["node", "worker.js"]
  environment:
    DATABASE_URL: postgresql://ailawyer:ailawyer@db:5432/ailawyer
    REDIS_URL: redis://redis:6379
    # ... same env vars as app
  depends_on:
    - db
    - redis
    - stirling-pdf
```

### Pattern 3: IMAP IDLE as a Managed Connection Pool in Worker

**What:** The Worker process maintains persistent IMAP connections (one per configured mailbox) using ImapFlow. New emails trigger a BullMQ job to process and store them.

**Why:** IMAP IDLE requires a persistent TCP connection that stays open indefinitely. This is fundamentally incompatible with Next.js request-response lifecycle. ImapFlow is the modern, maintained IMAP library for Node.js with native IDLE support and async/await.

**Confidence:** MEDIUM -- ImapFlow IDLE support is well-documented. Running persistent connections in a worker is standard practice. However, managing reconnection and multiple mailboxes simultaneously needs careful implementation.

**Implementation:**

```typescript
// src/lib/email/imap-manager.ts
import { ImapFlow } from "imapflow";
import { Queue } from "bullmq";

class ImapConnectionManager {
  private connections = new Map<string, ImapFlow>();
  private emailQueue: Queue;

  async addMailbox(config: MailboxConfig) {
    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.tls,
      auth: { user: config.user, pass: config.password },
    });

    await client.connect();
    await client.mailboxOpen("INBOX");

    // Listen for new emails via IDLE
    client.on("exists", async (data) => {
      // Enqueue job to fetch and process new messages
      await this.emailQueue.add("fetch-new", {
        mailboxId: config.id,
        count: data.count,
      });
    });

    // Handle disconnection with exponential backoff
    client.on("close", () => {
      this.reconnect(config);
    });

    this.connections.set(config.id, client);
  }

  private async reconnect(config: MailboxConfig) {
    // Exponential backoff: 1s, 2s, 4s, 8s, max 60s
  }
}
```

**Data flow:**
1. Worker starts -> loads mailbox configs from DB -> opens IMAP connections
2. IMAP IDLE receives "new email" notification
3. Worker enqueues `fetch-new` job in BullMQ
4. Job processor fetches email, stores in DB, uploads attachments to MinIO
5. Worker emits Socket.IO event via Redis pub/sub -> App pushes to browser
6. Next.js API routes serve email list/detail from DB (no IMAP involvement)

### Pattern 4: RAG Pipeline (Ingestion Worker + Query API Route)

**What:** Split RAG into two halves: ingestion (heavy, async) runs in the Worker, retrieval (fast, sync) runs in Next.js API routes.

**Why:** Embedding a 50-page document can take minutes (chunking + embedding each chunk). Retrieval is a single vector similarity query (~50ms).

**Confidence:** HIGH -- pgvector with Prisma raw SQL is the established pattern. Vercel AI SDK provides `embedMany()` for batch embedding. Chunking is well-understood.

**Ingestion flow (Worker):**
1. Document uploaded via Next.js API -> stored in MinIO + DB
2. API enqueues `rag-embed` job via BullMQ
3. Worker fetches document from MinIO
4. Extracts text (PDF via Stirling-PDF text extraction, DOCX via docxtemplater/mammoth)
5. Chunks text (800 chars, 100 char overlap)
6. Embeds chunks via Ollama `nomic-embed-text` or OpenAI `text-embedding-3-small`
7. Stores embeddings in pgvector table linked to Dokument + Akte

**Retrieval flow (API route):**
```typescript
// src/app/api/ai/rag/route.ts
import { embed } from "ai";

export async function POST(req: Request) {
  const { query, akteId } = await req.json();

  // Embed the query
  const { embedding } = await embed({
    model: embeddingModel,
    value: query,
  });

  // Vector similarity search (raw SQL because Prisma lacks native pgvector)
  const chunks = await prisma.$queryRaw`
    SELECT content, "dokumentId",
           1 - (embedding <=> ${embedding}::vector) as similarity
    FROM "DocumentChunk"
    WHERE "akteId" = ${akteId}
      AND 1 - (embedding <=> ${embedding}::vector) > 0.5
    ORDER BY similarity DESC
    LIMIT 6
  `;

  return Response.json({ chunks });
}
```

**Prisma schema addition:**
```prisma
model DocumentChunk {
  id          String   @id @default(cuid())
  content     String
  chunkIndex  Int
  // embedding stored via raw SQL (Prisma Unsupported type)
  embedding   Unsupported("vector(1536)")?
  dokumentId  String
  dokument    Dokument @relation(fields: [dokumentId], references: [id])
  akteId      String
  akte        Akte     @relation(fields: [akteId], references: [id])
  createdAt   DateTime @default(now())

  @@index([akteId])
  @@index([dokumentId])
}
```

**Vector index (migration SQL):**
```sql
CREATE INDEX ON "DocumentChunk"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### Pattern 5: Client Portal as Path-Based Multi-Tenancy

**What:** The Mandantenportal (client portal) lives under `/(portal)/portal/[...]` with its own layout, auth middleware, and restricted data access. It uses the same NextAuth but with a separate Credentials provider for Mandanten (clients).

**Why:** Path-based tenancy is simpler than subdomain-based for a single-Kanzlei deployment. Same database, same app, just different routes and permissions.

**Confidence:** HIGH -- Next.js official documentation recommends path-based multi-tenancy. NextAuth supports multiple providers.

**Implementation:**

```
src/app/
  (dashboard)/     # Internal (Anwalt, Sachbearbeiter, etc.)
    layout.tsx     # RequireInternalAuth
    akten/
    kontakte/
    ...
  (portal)/        # External (Mandanten)
    layout.tsx     # RequirePortalAuth
    portal/
      login/page.tsx
      dashboard/page.tsx
      akten/[id]/page.tsx      # Read-only case view
      dokumente/page.tsx       # Download freigegebene docs
      nachrichten/page.tsx     # Secure messaging
      upload/page.tsx          # Upload own documents
```

**Auth layer:**
```typescript
// src/lib/auth.ts -- add portal provider
providers: [
  Credentials({ id: "internal", ... }),  // Existing: email + password
  Credentials({ id: "portal", ... }),    // New: invitation token + password
]

// Middleware checks:
// /(dashboard)/* -> session.user.role in [ADMIN, ANWALT, SACHBEARBEITER, ...]
// /(portal)/*    -> session.user.role === "MANDANT"
```

**Data isolation:** API routes for `/(portal)` ONLY return data where the Mandant is a Beteiligter of the Akte, and documents have status `FREIGEGEBEN`.

### Pattern 6: CalDAV Sync as Repeatable Worker Job

**What:** A BullMQ repeatable job that runs every 5 minutes, syncing calendar entries between the internal calendar and external CalDAV servers (Google Calendar, Outlook).

**Why:** CalDAV is a request-response protocol (no push), so periodic polling is required. The `tsdav` library provides TypeScript CalDAV client with sync support.

**Confidence:** MEDIUM -- `tsdav` is the most maintained TypeScript CalDAV client. Bidirectional sync with conflict resolution is inherently complex.

**Implementation:**
```typescript
// Worker job: caldav-sync
const caldavSyncJob = new Worker("caldav-sync", async (job) => {
  const { userId, calendarUrl, credentials } = job.data;
  const client = new DAVClient({ serverUrl: calendarUrl, credentials });
  await client.login();

  // 1. Fetch remote changes since last sync token
  const remote = await client.syncCalendars({ /* syncToken */ });

  // 2. Fetch local changes since last sync
  const local = await prisma.kalenderEintrag.findMany({
    where: { userId, updatedAt: { gt: lastSync } },
  });

  // 3. Merge with conflict resolution (server wins for external changes)
  // 4. Push local changes to remote
  // 5. Pull remote changes to local
  // 6. Store new sync token
}, { connection });
```

### Pattern 7: Stirling-PDF as REST API Sidecar

**What:** Stirling-PDF runs as a Docker container in the compose stack. The Worker calls its REST API for OCR, merge, split, and conversion operations.

**Why:** Stirling-PDF bundles Tesseract OCR, LibreOffice, and Java -- far too heavy to embed in the Node.js container. Its REST API at `/api/v1/*` is well-documented.

**Confidence:** HIGH -- Stirling-PDF is the most popular open-source PDF toolkit on GitHub (100k+ stars). REST API is stable and well-documented.

**Docker Compose addition:**
```yaml
stirling-pdf:
  image: stirlingtools/stirling-pdf:latest-fat   # -fat includes OCR/Tesseract
  container_name: ailawyer-stirling
  restart: unless-stopped
  environment:
    DOCKER_ENABLE_SECURITY: "false"
    LANGS: "de_DE"
  ports:
    - "8081:8080"
  volumes:
    - stirling_data:/configs
```

**Worker integration:**
```typescript
// src/lib/pdf/stirling-client.ts
export async function ocrPdf(pdfBuffer: Buffer, languages = "deu+eng"): Promise<Buffer> {
  const form = new FormData();
  form.append("fileInput", new Blob([pdfBuffer]), "document.pdf");
  form.append("languages", languages);
  form.append("ocrType", "skip-text");  // Only OCR if not already searchable
  form.append("ocrRenderType", "hocr");

  const response = await fetch(`${STIRLING_URL}/api/v1/misc/ocr-pdf`, {
    method: "POST",
    body: form,
  });

  return Buffer.from(await response.arrayBuffer());
}
```

## Data Flow Summary

### Email Ingestion Flow

```
Mailserver (IMAP)
    |  [IMAP IDLE notification]
    v
Worker: ImapConnectionManager
    |  [enqueue fetch-new job]
    v
Worker: BullMQ email-sync processor
    |  [fetch email, parse headers/body/attachments]
    v
PostgreSQL (Email record) + MinIO (attachments)
    |  [emit via Redis pub/sub]
    v
Next.js App: Socket.IO
    |  [push to connected clients]
    v
Browser: Real-time inbox update
```

### Document Upload + AI Processing Flow

```
Browser: File Upload
    |
    v
Next.js API: POST /api/akten/[id]/dokumente
    |  [store file in MinIO, create DB record]
    |  [enqueue rag-embed + ocr jobs]
    v
Redis: BullMQ queue
    |
    +--------> Worker: OCR job
    |              |  [send to Stirling-PDF API]
    |              |  [get searchable PDF back]
    |              |  [update MinIO + Meilisearch]
    |              v
    |          Done (emit ocr-complete event)
    |
    +--------> Worker: RAG embed job
                   |  [extract text from document]
                   |  [chunk into ~800 char pieces]
                   |  [embed via Ollama/OpenAI]
                   |  [store vectors in pgvector]
                   v
               Done (document now searchable via RAG)
```

### Real-Time Messaging Flow

```
Browser A: Send message
    |
    v
Next.js API: POST /api/messaging/[threadId]/messages
    |  [validate, store in DB]
    |  [emit to Socket.IO room via Redis adapter]
    v
Redis pub/sub
    |
    v
Socket.IO server (all instances)
    |  [broadcast to thread room subscribers]
    v
Browser B, C: Receive message in real-time
```

## Recommended Project Structure (New/Changed Files)

```
src/
├── app/
│   ├── (dashboard)/          # Existing internal routes
│   ├── (portal)/             # NEW: Client portal
│   │   ├── layout.tsx        # Portal auth wrapper
│   │   └── portal/
│   │       ├── login/
│   │       ├── dashboard/
│   │       ├── akten/[id]/
│   │       ├── dokumente/
│   │       ├── nachrichten/
│   │       └── upload/
│   └── api/
│       ├── ai/
│       │   ├── chat/route.ts       # Streaming AI chat
│       │   └── rag/route.ts        # RAG retrieval
│       ├── email/                   # Email CRUD (reads from DB, not IMAP)
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── messaging/               # Internal messaging CRUD
│       │   ├── threads/route.ts
│       │   └── [threadId]/messages/route.ts
│       ├── portal/                  # Portal-specific API routes
│       │   └── ...
│       └── jobs/                    # Job management (admin)
│           └── route.ts
├── lib/
│   ├── ai/
│   │   ├── ollama.ts               # Existing
│   │   ├── embedding.ts            # NEW: Embedding generation
│   │   ├── chunking.ts             # NEW: Document chunking
│   │   └── rag.ts                  # NEW: RAG retrieval logic
│   ├── email/
│   │   ├── imap-manager.ts         # NEW: IMAP connection pool
│   │   ├── smtp.ts                 # NEW: SMTP sending
│   │   └── parser.ts               # NEW: Email parsing
│   ├── jobs/
│   │   ├── queues.ts               # NEW: BullMQ queue definitions
│   │   ├── processors/
│   │   │   ├── email-sync.ts
│   │   │   ├── rag-embed.ts
│   │   │   ├── ocr.ts
│   │   │   ├── ai-task.ts
│   │   │   └── caldav-sync.ts
│   │   └── connection.ts           # NEW: Redis connection singleton
│   ├── pdf/
│   │   └── stirling-client.ts      # NEW: Stirling-PDF API client
│   ├── caldav/
│   │   └── sync.ts                 # NEW: CalDAV sync logic
│   ├── messaging/
│   │   └── service.ts              # NEW: Messaging business logic
│   └── socket/
│       ├── server.ts               # NEW: Socket.IO setup
│       └── events.ts               # NEW: Event type definitions
├── worker.ts                        # NEW: Worker entrypoint
└── server.ts                        # NEW: Custom server (replaces standalone server.js)
```

## Build Order (Dependency-Based)

The capabilities have clear dependencies. Build in this order:

### Phase A: Infrastructure Foundation

**Build first:** Redis + BullMQ + Worker process

Everything else depends on background job processing. Without the worker, there is no email sync, no RAG embedding, no OCR, no CalDAV.

**Deliverables:**
- Redis added to docker-compose
- BullMQ queue definitions + connection management
- Worker entrypoint (`worker.ts`) with graceful shutdown
- Custom `server.ts` for Next.js (WebSocket-ready, even if messaging comes later)
- Admin API to view job status/retry failed jobs

**Dependencies:** None (foundation layer)

### Phase B: Email System

**Build second:** IMAP IDLE + email storage + SMTP

Email is the highest-value feature for a law firm. It requires the worker (for IMAP IDLE connections) and the job queue (for email fetching).

**Deliverables:**
- ImapFlow connection manager in worker
- Email DB models (EmailAccount, Email, EmailAttachment)
- Email CRUD API routes (list, detail, search)
- Email compose + SMTP send (via BullMQ job)
- Email-to-Akte linking ("Veraktung")
- Socket.IO notification for new emails

**Dependencies:** Phase A (worker + queue + WebSocket server)

### Phase C: Document Pipeline (Stirling-PDF + OCR)

**Build third:** PDF processing + OCR + Meilisearch indexing

Stirling-PDF is a sidecar with zero coupling to other new features. OCR results feed into Meilisearch (existing) and later into RAG.

**Deliverables:**
- Stirling-PDF added to docker-compose
- OCR queue processor in worker
- Auto-OCR on PDF upload (skip if already searchable)
- OCR status tracking in UI (badge + manual retry)
- PDF merge/split/convert API routes (proxy to Stirling-PDF)

**Dependencies:** Phase A (worker + queue)

### Phase D: RAG Pipeline

**Build fourth:** Embedding + chunking + vector storage + retrieval

RAG ingestion depends on being able to extract text from documents (benefits from OCR in Phase C). RAG retrieval is independent.

**Deliverables:**
- DocumentChunk model with pgvector column
- Chunking logic (sentence-aware, 800 char, 100 overlap)
- Embedding job processor (Ollama or OpenAI)
- RAG retrieval API route
- AI chat with RAG context injection
- Re-embed on document update

**Dependencies:** Phase A (worker), Phase C (OCR for better text extraction)

### Phase E: Real-Time Messaging

**Build fifth:** Internal messaging with WebSocket push

Requires the Socket.IO server from Phase A. Messaging is self-contained after that.

**Deliverables:**
- Thread/Message DB models
- Case threads + general channels
- Socket.IO rooms per thread
- Composer with @mentions, markdown, attachments
- In-app notifications via Socket.IO

**Dependencies:** Phase A (WebSocket server)

### Phase F: Client Portal

**Build sixth:** Mandantenportal with separate auth

Portal reads data that already exists (Akten, Dokumente, Nachrichten). It's a new presentation layer, not new infrastructure.

**Deliverables:**
- Portal route group with restricted layout
- Mandant credentials provider (invitation link + password)
- Read-only case view, document download
- Secure messaging (client <-> Anwalt)
- Document upload

**Dependencies:** Phase E (messaging, for client-lawyer communication)

### Phase G: CalDAV Sync

**Build last:** Bidirectional calendar sync

Most complex sync logic, least urgent. Benefits from stable worker infrastructure.

**Deliverables:**
- CalDAV account configuration UI
- tsdav-based sync processor
- Conflict resolution (last-write-wins with manual override)
- Sync status dashboard

**Dependencies:** Phase A (worker + queue), stable calendar system

## Anti-Patterns to Avoid

### Anti-Pattern 1: Running IMAP IDLE in Next.js API Routes

**What people do:** Open IMAP connections inside API route handlers or use `setInterval` in a global module.
**Why it is wrong:** Next.js API routes are request-scoped. The connection dies when the response ends. Global side effects in modules are unreliable -- Next.js may restart, hot-reload, or run multiple instances.
**Do this instead:** Run IMAP connections in a dedicated worker process that has a stable lifecycle independent of HTTP requests.

### Anti-Pattern 2: Polling for Real-Time Instead of WebSocket

**What people do:** Use `setInterval` + `fetch` on the client to check for new messages every 2 seconds.
**Why it is wrong:** Creates unnecessary database load, wastes bandwidth, and introduces 0-2s latency on every message. With 10 users, that is 300 requests/minute for zero new data.
**Do this instead:** Use Socket.IO with Redis adapter. Push events when state changes. Client subscribes to relevant rooms.

### Anti-Pattern 3: Embedding Documents Synchronously in Upload API Route

**What people do:** When a document is uploaded, chunk and embed it in the same API route handler before returning the response.
**Why it is wrong:** Embedding a 50-page document can take 30+ seconds. The user sees a spinner, the request may timeout, and concurrent uploads will exhaust the server.
**Do this instead:** Return 201 immediately after MinIO upload. Enqueue a `rag-embed` job. Show "Embedding in progress" badge. Notify via Socket.IO when done.

### Anti-Pattern 4: Separate Docker Image for Worker

**What people do:** Create a completely separate project/image for the worker with its own Prisma setup and type definitions.
**Why it is wrong:** Code duplication, type drift, double build times, version mismatches.
**Do this instead:** Single Docker image, two entrypoints. Worker imports from `src/lib/` just like the app. Docker Compose runs two services from the same image with different commands.

### Anti-Pattern 5: Client Portal as Separate Next.js App

**What people do:** Build the Mandantenportal as an entirely separate Next.js application with its own database connection.
**Why it is wrong:** Data duplication, API duplication, deployment complexity. A separate app means maintaining two codebases that access the same data.
**Do this instead:** Path-based multi-tenancy within the same app. Route groups `(dashboard)` and `(portal)` with different layouts and auth middleware. Shared Prisma client, shared components.

### Anti-Pattern 6: Using Prisma's ORM for Vector Operations

**What people do:** Try to use Prisma's standard query builder for cosine similarity, vector indexing, and embedding storage.
**Why it is wrong:** Prisma does not have native vector type support as of 2025/2026. Using `Unsupported("vector(1536)")` means the column exists in the schema but all vector operations must use raw SQL.
**Do this instead:** Use `Unsupported` type in schema for migration tracking. Use `$queryRaw` for all vector operations. Consider adding a thin wrapper function (`findSimilarChunks()`) in `src/lib/ai/rag.ts` that encapsulates the raw SQL.

## Scaling Considerations

| Concern | Current (1 Kanzlei, ~10 users) | Future (multiple Kanzleien, ~100 users) |
|---------|--------------------------------|----------------------------------------|
| WebSocket connections | Single Socket.IO instance, no adapter needed | Redis adapter already in place, add app replicas |
| IMAP connections | ~5 mailboxes, single worker | Shard by mailbox across worker replicas |
| RAG embeddings | Sequential processing fine | Increase worker concurrency, consider GPU-accelerated Ollama |
| Job queue | Single Redis instance | Redis Sentinel or Cluster |
| Database | Single PostgreSQL | Read replicas for portal queries |
| Stirling-PDF | Single instance | Stateless, add replicas behind load balancer |

For the current single-Kanzlei deployment, a single instance of each component is sufficient. The architecture supports horizontal scaling without redesign.

## Integration Points Summary

### External Services (Docker Compose)

| Service | Protocol | Port | Auth | Notes |
|---------|----------|------|------|-------|
| PostgreSQL + pgvector | TCP/PostgreSQL | 5432 | User/password | Existing. Add pgvector extension if not already enabled |
| Redis | TCP/Redis | 6379 | Optional password | NEW. Used by BullMQ + Socket.IO adapter |
| MinIO | HTTP/S3 | 9000 | Access key/secret | Existing |
| Meilisearch | HTTP/REST | 7700 | API key | Existing |
| OnlyOffice | HTTP/WOPI | 80 | JWT | Existing |
| Stirling-PDF | HTTP/REST | 8080 | API key (optional) | NEW. Fat image for OCR |
| Ollama | HTTP/REST | 11434 | None | Existing (external) |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Next.js App <-> Worker | Redis (BullMQ queues) | App enqueues jobs, worker processes them |
| Worker -> App | Redis pub/sub (Socket.IO adapter) | Worker emits events, app broadcasts to clients |
| Next.js App <-> Browser | HTTP + WebSocket (Socket.IO) | REST for CRUD, WebSocket for real-time |
| Worker -> Stirling-PDF | HTTP REST API | Multipart form data, returns processed PDF |
| Worker -> Ollama | HTTP REST API | Embedding generation, text completion |
| Worker -> IMAP server | TCP (IMAP/TLS) | Persistent connection with IDLE |
| Worker -> SMTP server | TCP (SMTP/TLS) | Per-message connection |
| Worker -> CalDAV server | HTTP (CalDAV) | Periodic sync requests |

## Updated Docker Compose (Target State)

```yaml
services:
  app:
    build: .
    container_name: ailawyer-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      # ... existing env vars ...
      REDIS_URL: redis://redis:6379
      STIRLING_PDF_URL: http://stirling-pdf:8080
    depends_on:
      - db
      - redis
      - minio
      - meilisearch
      - onlyoffice

  worker:
    build: .
    container_name: ailawyer-worker
    restart: unless-stopped
    command: ["node", "worker.js"]    # Override default server.js
    environment:
      # Same DATABASE_URL, REDIS_URL, MINIO, MEILISEARCH, OLLAMA vars
      STIRLING_PDF_URL: http://stirling-pdf:8080
    depends_on:
      - db
      - redis
      - minio
      - stirling-pdf

  redis:
    image: redis:7-alpine
    container_name: ailawyer-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  stirling-pdf:
    image: stirlingtools/stirling-pdf:latest-fat
    container_name: ailawyer-stirling
    restart: unless-stopped
    environment:
      DOCKER_ENABLE_SECURITY: "false"
      LANGS: "de_DE"
    ports:
      - "8081:8080"
    volumes:
      - stirling_data:/configs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/v1/info/status"]
      interval: 10s
      timeout: 10s
      retries: 5
      start_period: 30s

  # ... existing db, minio, meilisearch, onlyoffice ...

volumes:
  # ... existing volumes ...
  redisdata:
  stirling_data:
```

## Sources

- [Socket.IO + Next.js official guide](https://socket.io/how-to/use-with-nextjs) -- HIGH confidence
- [BullMQ official documentation](https://docs.bullmq.io/) -- HIGH confidence
- [ImapFlow documentation](https://imapflow.com/) -- HIGH confidence
- [Vercel AI SDK RAG guide](https://ai-sdk.dev/cookbook/guides/rag-chatbot) -- HIGH confidence
- [Prisma pgvector discussion](https://github.com/prisma/prisma/discussions/18220) -- HIGH confidence
- [Stirling-PDF documentation](https://docs.stirlingpdf.com/) -- HIGH confidence
- [Next.js multi-tenant guide](https://nextjs.org/docs/app/guides/multi-tenant) -- HIGH confidence
- [tsdav CalDAV client](https://github.com/natelindev/tsdav) -- MEDIUM confidence
- [Next.js custom server docs](https://nextjs.org/docs/pages/guides/custom-server) -- HIGH confidence
- [Next.js Docker standalone deployment](https://hmos.dev/en/nextjs-docker-standalone-and-custom-server) -- MEDIUM confidence
- [Postgres RAG Stack blog](https://blogs.perficient.com/2025/07/17/postgres-typescript-rag-stack/) -- MEDIUM confidence
- [BullMQ + Next.js integration](https://medium.com/@asanka_l/integrating-bullmq-with-nextjs-typescript-f41cca347ef8) -- MEDIUM confidence

---
*Architecture research for: AI-Lawyer integration of 7 new capabilities*
*Researched: 2026-02-24*
