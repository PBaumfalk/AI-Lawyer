# Architecture

**Analysis Date:** 2026-03-04

## Pattern Overview

**Overall:** Layered monolith with two distinct runtime processes — a Next.js App Router web server (`src/server.ts`) and a BullMQ background worker (`src/worker.ts`). Both processes share the same Prisma schema and Redis instance.

**Key Characteristics:**
- Next.js 14 App Router with co-located server components, client components, and Route Handlers
- Two separate process executables: web server (HTTP + Socket.IO) and worker (BullMQ consumers)
- Three distinct user surfaces: `(dashboard)` for law firm staff, `(portal)` for Mandant clients, `(portal-public)` for unauthenticated portal pages
- Prisma `$extends` enforces BRAK 2025 / BRAO 43 business invariants at the ORM layer
- AI agent ("Helena") runs as a ReAct loop inside BullMQ jobs, isolated from HTTP response cycle

---

## Layers

**Route Layer (App Router):**
- Purpose: HTTP routing, server-side rendering, auth guards
- Location: `src/app/`
- Contains: `page.tsx` (RSC), `layout.tsx`, route groups, `route.ts` (API handlers)
- Depends on: `src/lib/` services, Prisma via `src/lib/db.ts`
- Used by: Browser clients, worker process (indirectly via shared lib)

**API Layer (Route Handlers):**
- Purpose: REST endpoints consumed by client components and external integrations
- Location: `src/app/api/`
- Contains: `route.ts` files for each resource (`akten`, `dokumente`, `helena`, `portal`, `gamification`, etc.)
- Auth guard: Every handler calls `requireAuth()` / `requireRole()` / `requireAkteAccess()` from `src/lib/rbac.ts` before any DB access
- Depends on: `src/lib/rbac.ts`, `src/lib/db.ts`, domain service libs

**Service Layer (`src/lib/`):**
- Purpose: Domain logic, external integrations, shared utilities
- Location: `src/lib/`
- Contains: One directory per domain (helena, finance, email, gamification, portal, etc.)
- Key singletons: `src/lib/db.ts` (Prisma), `src/lib/meilisearch.ts`, `src/lib/storage.ts` (MinIO/S3)
- Depends on: Prisma, Redis, MinIO, Meilisearch, Ollama/OpenAI/Anthropic

**Queue Layer (`src/lib/queue/`, `src/lib/queue/processors/`):**
- Purpose: BullMQ queue definitions and job processors for all async work
- Location: `src/lib/queue/queues.ts` (queue instances), `src/lib/queue/processors/` (processors)
- Contains: 19 named queues (document-ocr, document-embedding, helena-task, gamification, portal-notification, etc.)
- Depends on: `src/lib/redis.ts`, domain service libs, Socket.IO emitter
- Used by: `src/worker.ts` (consumer), API route handlers (producer)

**Worker Process (`src/worker.ts`, `src/workers/`):**
- Purpose: Standalone Node.js process consuming all BullMQ queues
- Location: `src/worker.ts` (entry), `src/workers/processors/` (complex processor modules)
- Contains: Worker registration, cron scheduling, startup seeding, graceful shutdown
- Depends on: All queue processors, `src/lib/socket/emitter.ts` for Socket.IO cross-process pub/sub
- Used by: `dist-worker/` (compiled output run in Docker)

**Component Layer (`src/components/`):**
- Purpose: React UI components (server and client)
- Location: `src/components/`
- Contains: Feature-namespaced directories (`akten`, `helena`, `dokumente`, `gamification`, `portal`, etc.) + `ui/` (shadcn primitives), `layout/` (Sidebar, Header)
- Depends on: Next.js hooks, route handler APIs, Socket.IO client (via providers)

---

## Data Flow

**Document Upload Pipeline:**
1. User uploads via `POST /api/akten/[id]/dokumente/neu` → file stored in MinIO via `src/lib/storage.ts`
2. API handler enqueues `document-ocr` and `document-preview` jobs in BullMQ
3. Worker OCR processor (`src/lib/queue/processors/ocr.processor.ts`) calls Stirling-PDF, saves text to `Dokument.ocrText`
4. Worker embedding processor (`src/lib/queue/processors/embedding.processor.ts`) calls Ollama embedder, writes chunks to `document_chunks` table (pgvector)
5. Worker indexes document in Meilisearch for BM25 search
6. Socket.IO emitter sends `document:ocr-complete` to `akte:{akteId}` room and `user:{userId}` room
7. Client UI updates via Socket.IO event

**Helena AI Task Flow (background mode):**
1. User mentions `@Helena` in Akte feed → `POST /api/akten/[id]/feed` parses mention via `src/lib/helena/at-mention-parser.ts`
2. Feed handler calls `createHelenaTask()` in `src/lib/helena/task-service.ts` → creates `HelenaTask` DB record, enqueues `helena-task` BullMQ job
3. Worker (`src/lib/queue/processors/helena-task.processor.ts`) picks up job, calls `runHelenaAgent()` (ReAct loop in `src/lib/helena/orchestrator.ts`)
4. ReAct loop (max 20 steps, 3min timeout) invokes tools from `src/lib/helena/tools/` (14 tools: read-akte, search-gesetze, create-draft-dokument, etc.)
5. Agent creates `HelenaDraft` record (`erstelltDurch: "ai"`, status forced to `ENTWURF` by Prisma `$extends`)
6. Socket.IO emitter notifies `akte:{akteId}` room of new draft
7. Lawyer reviews draft and manually sets `FREIGEGEBEN`

**Helena Schriftsatz Pipeline (deterministic, not ReAct):**
1. User requests legal document in chat → complexity classifier routes to schriftsatz pipeline
2. `src/lib/helena/schriftsatz/index.ts` runs 5-stage pipeline: Intent Recognition → Slot Filling → RAG Assembly → ERV Validation → Draft Creation
3. If slots incomplete, returns `needs_input` with `rueckfrage` question → stored as `PendingSchriftsatz`
4. On completion, creates `HelenaDraft` with full `SchriftsatzSchema` in `meta` JSON

**Real-time Notifications:**
1. Worker processes jobs and calls `socketEmitter.to(room).emit(event)` from `src/lib/socket/emitter.ts`
2. Emitter uses `@socket.io/redis-adapter` pub/sub so events cross process boundary (worker → web server)
3. Web server's Socket.IO instance broadcasts to browser clients
4. Client components subscribe via `SocketProvider` in `src/components/socket-provider.tsx`

**State Management:**
- Server state: Prisma (PostgreSQL) as single source of truth
- Client state: React `useState`/`useContext` within feature-specific providers (no global state manager)
- Real-time: Socket.IO rooms (user, role, kanzlei, akte, mailbox, channel)
- Async jobs: Redis via BullMQ (durable queue, retry with exponential backoff)
- Search state: Meilisearch (BM25 text) + pgvector (semantic)

---

## Key Abstractions

**ExtendedPrismaClient (`src/lib/db.ts`):**
- Purpose: Prisma client with `$extends` hooks for BRAK 2025 compliance
- Business rules: AI-created documents forced to `ENTWURF`; cannot leave `ENTWURF` without `freigegebenDurchId`
- Pattern: Import `{ prisma }` everywhere; never instantiate `new PrismaClient()` directly
- Type: `ExtendedPrismaClient` / `PrismaTransactionClient` for typed transaction callbacks

**RBAC Helpers (`src/lib/rbac.ts`):**
- Purpose: Centralized auth + role + Akte access checks for all API handlers
- Functions: `requireAuth()`, `requireRole(...roles)`, `requirePermission(permission)`, `requireAkteAccess(akteId)`, `buildAkteAccessFilter(userId, role)`
- Pattern: Returns `{ session, error }` discriminated union — handlers early-return `if (access.error) return access.error`
- Roles: `ADMIN`, `ANWALT`, `SACHBEARBEITER`, `SEKRETARIAT`, `MANDANT`

**Portal Access Control (`src/lib/portal-access.ts`):**
- Purpose: Separate access layer for MANDANT users in portal routes
- Pattern: `getMandantAkten(userId)` and `requireMandantAkteAccess(akteId, userId)` traverse User→Kontakt→Beteiligter chain
- Returns 404 (not 403) to hide Akte existence from unauthorized users

**Helena Orchestrator (`src/lib/helena/orchestrator.ts`):**
- Purpose: Bounded ReAct agent loop wrapping Vercel AI SDK `generateText({ maxSteps })`
- Features: Stall detection, token budget FIFO truncation, step callbacks, audit logging, abort signal
- Limits: inline=5 steps/30s, background=20 steps/3min

**BullMQ Queue Layer (`src/lib/queue/queues.ts`):**
- Purpose: Typed queue instances shared between producers (API handlers) and consumers (worker)
- Pattern: Export named queue instances; processors are separate files in `src/lib/queue/processors/`
- Backoff: Custom strategy — 10s, 60s, 5min (not exponential)

**AI Provider Factory (`src/lib/ai/provider.ts`):**
- Purpose: Runtime-swappable AI provider (Ollama, OpenAI, Anthropic) driven by `SystemSetting`
- Hard limits enforced: Helena may never send emails, set FREIGEGEBEN, delete data, or modify financial records

**Hybrid Search (`src/lib/embedding/hybrid-search.ts`):**
- Purpose: BM25 (Meilisearch) + vector (pgvector) + RRF fusion + LLM reranker (Ollama)
- Pattern: Parallel retrieval → RRF score merge → rerank → parent chunk lookup for context

---

## Entry Points

**Web Server (`src/server.ts`):**
- Location: `src/server.ts`
- Triggers: `node dist-server/server.js` or `ts-node src/server.ts` in dev
- Responsibilities: Start Next.js, attach Socket.IO to HTTP server, store `globalThis.__socketIO`

**Worker Process (`src/worker.ts`):**
- Location: `src/worker.ts`
- Triggers: `node dist-worker/worker.js` or direct `ts-node src/worker.ts`
- Responsibilities: Register 19 BullMQ workers, schedule cron jobs, run startup seeding (falldaten, quests, shop items, channels), start IMAP connections, graceful shutdown on SIGINT/SIGTERM

**Dashboard Layout (`src/app/(dashboard)/layout.tsx`):**
- Location: `src/app/(dashboard)/layout.tsx`
- Triggers: All `/` routes except `/login`, `/portal/*`
- Responsibilities: Auth redirect, inject SessionProvider > SocketProvider > NotificationProvider > UploadProvider, render Sidebar + Header

**Portal Layout (`src/app/(portal)/layout.tsx`):**
- Location: `src/app/(portal)/layout.tsx`
- Triggers: All `/portal/*` authenticated routes
- Responsibilities: MANDANT role check, inject PortalSessionProvider (30min inactivity logout), render PortalSidebar + PortalHeader

**Edge Middleware (`src/middleware.ts`):**
- Location: `src/middleware.ts`
- Triggers: Every request (Next.js middleware)
- Responsibilities: NextAuth edge-compatible session check; protects all routes except public portal pages, auth endpoints, OnlyOffice, OpenClaw, static files

---

## Error Handling

**Strategy:** Fail-fast with discriminated union returns at service boundaries; non-fatal errors in worker startup wrapped in try/catch with `log.warn`.

**Patterns:**
- API handlers: RBAC helpers return `{ error: NextResponse }` — caller does `if (access.error) return access.error` immediately
- Worker processors: Caught exceptions logged via pino; BullMQ retries 3× with custom backoff (10s/60s/5min)
- Worker startup: Each seeding step in isolated try/catch; failure is non-fatal (logged, process continues)
- AI agent: Stall detector and timeout abort; errors stored in `HelenaTask.fehler` field
- Socket.IO notifications sent to `role:ADMIN` room on final job failure

---

## Cross-Cutting Concerns

**Logging:** pino via `createLogger(module)` from `src/lib/logger.ts`. Dev: pino-pretty colored output. Prod: stdout + daily rotating file (`/var/log/ai-lawyer/`). Log level configurable via `SystemSetting` key `logLevel`, updated via Redis pub/sub `settings:changed` channel.

**Validation:** Zod schemas at API input boundaries (e.g., login form in `src/lib/auth.ts`). Prisma schema as DB constraint layer. `src/lib/helena/schriftsatz/schemas.ts` defines `SchriftsatzSchema` (Zod) for validated AI output via `generateObject`.

**Authentication:** NextAuth.js v5 with PrismaAdapter. Credentials provider (email + bcrypt). Edge middleware for route protection. Separate portal session with 30-minute inactivity auto-logout. Portal password reset via crypto token stored in `PortalInvite`.

**Audit Trail:** `logAuditEvent()` from `src/lib/audit.ts` writes to `AuditLog` table on every significant action (50+ event types). RBAC access denials logged automatically. Portal notifications gated by DSGVO `einwilligungEmail` flag.
