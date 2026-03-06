# Architecture

**Analysis Date:** 2026-03-06

## Pattern Overview

**Overall:** Layered monolith with two runtime processes:
1) **Next.js App Router web server** (HTTP + SSR + API handlers + Socket.IO)
2) **BullMQ worker** (async jobs, cron-like tasks, integrations)

Both share the same **PostgreSQL/Prisma schema** and **Redis** instance. The app is deployed as a multi-service Docker Compose stack (Postgres, Redis, Meilisearch, MinIO, OnlyOffice, etc.).

**User surfaces:**
- **Staff dashboard** (`/(dashboard)`) with full RBAC
- **Mandant portal** (`/(portal)`) with isolated access rules
- **Portal public** (`/(portal-public)`) for onboarding/reset

---

## Layers

**Route/UI Layer (Next.js App Router)**
- Location: `src/app/`
- `page.tsx`/`layout.tsx` for SSR + RSC, route groups for dashboard/portal/auth
- `src/components/` hosts feature-specific UI + shadcn/ui primitives

**API Layer (Route Handlers)**
- Location: `src/app/api/**/route.ts`
- All endpoints use RBAC helpers in `src/lib/rbac.ts`
- Produces/consumes async jobs via `src/lib/queue/queues.ts`

**Service Layer (Domain Libs)**
- Location: `src/lib/`
- Domain modules for `akten`, `dokumente`, `email`, `helena`, `gamification`, `finance`, `fristen`, `portal`, etc.
- Shared infrastructure: Prisma (`db.ts`), Redis (`redis.ts`), Storage (`storage.ts`), Search (`meilisearch.ts`)

**Queue/Worker Layer**
- Location: `src/lib/queue/**` and `src/worker.ts`
- BullMQ queue definitions + processors
- Worker process registers all queue consumers + cron-like tasks + seeding

---

## Runtime Processes

### 1) Web Server (Next.js + Socket.IO)
- Entry: `src/server.ts`
- Responsibilities:
  - SSR + App Router routes
  - REST API route handlers
  - Socket.IO server attached to HTTP server
  - Auth (NextAuth v5) + middleware gate

### 2) Worker Process (BullMQ)
- Entry: `src/worker.ts`
- Responsibilities:
  - Queue consumers (OCR, previews, embeddings, email send/sync, Helena tasks, etc.)
  - Scheduled tasks (deadline reminders, proactive AI, data sync)
  - IMAP connection manager + SMTP transport lifecycle
  - Seeding defaults (quests, shop items, portal channels, templates)

---

## Key Flows

**Document Upload Pipeline**
1. User uploads → API stores file in S3/MinIO (`src/lib/storage.ts`)
2. Enqueue OCR + preview + embedding jobs
3. Worker processes OCR (Stirling-PDF), embedding (pgvector), preview generation
4. Search index updated in Meilisearch
5. Socket.IO broadcasts completion events to user/akte rooms

**Helena AI Task Flow (background)**
1. User triggers AI task from UI
2. API creates task record + enqueues `helena-task`
3. Worker executes ReAct loop + tools (`src/lib/helena/**`)
4. Draft stored in DB; notification via Socket.IO

**Email Sync & Send**
1. IMAP sync jobs created on schedule or user action
2. Worker manages IMAP connections + parses mail
3. Send jobs handled via SMTP processor, status updates emitted

**Notifications**
- Worker uses `src/lib/socket/emitter.ts` with Redis adapter for cross-process events
- Browser clients subscribe via Socket.IO provider

---

## Cross-Cutting Concerns

**Auth/RBAC**
- NextAuth v5 + Prisma adapter
- `requireAuth/requireRole/requireAkteAccess` guards all API handlers
- Separate portal access model in `src/lib/portal-access.ts`

**Data/Storage**
- Prisma/Postgres as source of truth
- MinIO (S3) for files
- Meilisearch for full-text search
- pgvector for semantic search

**Logging/Observability**
- pino logger via `src/lib/logger.ts`
- Worker and server log to stdout (and optional file in Docker)

---

## Entry Points

- **Web:** `src/server.ts` (HTTP + Socket.IO)
- **Worker:** `src/worker.ts` (BullMQ consumers + cron tasks)
- **Middleware:** `src/middleware.ts` (auth gate, public route exceptions)

