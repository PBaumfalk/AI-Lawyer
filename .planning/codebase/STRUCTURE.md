# Codebase Structure

**Analysis Date:** 2026-03-04

## Directory Layout

```
AI-Lawyer/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                 # Login route group (law firm staff)
│   │   ├── (dashboard)/            # Protected staff UI (sidebar + header layout)
│   │   │   ├── admin/              # Admin-only pages (audit, rollen, team-dashboard, etc.)
│   │   │   ├── akten/              # Case management (list + detail)
│   │   │   ├── bea/                # beA electronic legal mailbox
│   │   │   ├── dokumente/          # Document viewer / editor (OnlyOffice)
│   │   │   ├── email/              # Email client (IMAP/SMTP)
│   │   │   ├── finanzen/           # Financial module (RVG, invoices, time-tracking)
│   │   │   ├── gamification/       # Hero card, shop, boss fight, heldenkarte
│   │   │   ├── helena/             # AI chat, KI drafts
│   │   │   ├── kalender/           # Calendar (deadlines + appointments)
│   │   │   ├── kontakte/           # Contact management
│   │   │   ├── nachrichten/        # Internal messaging channels
│   │   │   ├── suche/              # Global search (Meilisearch)
│   │   │   ├── tickets/            # Support tickets
│   │   │   ├── vorlagen/           # Document templates
│   │   │   └── layout.tsx          # Dashboard layout (auth guard, providers)
│   │   ├── (portal)/               # Mandant portal (authenticated, MANDANT role)
│   │   │   ├── portal/
│   │   │   │   ├── akten/          # Case list + detail for Mandant
│   │   │   │   ├── dashboard/      # Mandant dashboard
│   │   │   │   ├── nachrichten/    # Mandant messaging
│   │   │   │   └── profil/         # Mandant profile
│   │   │   └── layout.tsx          # Portal layout (MANDANT role check, 30min session)
│   │   ├── (portal-public)/        # Unauthenticated portal pages
│   │   │   └── portal/
│   │   │       ├── activate/       # Invite acceptance + password set
│   │   │       ├── login/          # Mandant login
│   │   │       ├── passwort-reset/ # Password reset confirm
│   │   │       └── passwort-vergessen/ # Password reset request
│   │   ├── api/                    # REST API (Route Handlers)
│   │   │   ├── akten/              # Case CRUD + feed + dokumente + normen
│   │   │   ├── admin/              # Admin endpoints
│   │   │   ├── auth/[...nextauth]/ # NextAuth handler
│   │   │   ├── channels/           # Messaging channel CRUD
│   │   │   ├── dokumente/          # Document management + OCR + search
│   │   │   ├── finanzen/           # Financial endpoints
│   │   │   ├── gamification/       # Quest, shop, bossfight endpoints
│   │   │   ├── helena/             # AI task + draft + alert endpoints
│   │   │   ├── kalender/           # Calendar endpoints
│   │   │   ├── kontakte/           # Contact CRUD
│   │   │   ├── onlyoffice/         # OnlyOffice callback + config + download
│   │   │   ├── openclaw/           # External OpenClaw API (no auth required)
│   │   │   ├── portal/             # Portal-specific API (MANDANT access isolated)
│   │   │   └── vorlagen/           # Document template endpoints
│   │   ├── globals.css             # Tailwind + oklch glass UI variables
│   │   └── layout.tsx              # Root layout (ThemeProvider, Toaster)
│   ├── components/                 # React components (client + server)
│   │   ├── ui/                     # shadcn/ui primitives (button, dialog, table, etc.)
│   │   ├── layout/                 # Sidebar, Header, CommandPalette
│   │   ├── providers/              # SessionProvider, ThemeProvider, UploadProvider
│   │   ├── akten/                  # Case detail components
│   │   ├── bea/                    # beA message components
│   │   ├── dokumente/              # Document upload panel, viewer
│   │   ├── editor/                 # OnlyOffice wrapper components
│   │   ├── email/                  # Email client UI
│   │   ├── falldaten-templates/    # Case data template forms
│   │   ├── finanzen/               # Financial UI (invoices, RVG calculator)
│   │   ├── fristen/                # Deadline components
│   │   ├── gamification/           # Quest, shop, boss fight, hero card UI
│   │   ├── helena/                 # AI assistant chat UI, draft review
│   │   ├── kalender/               # Calendar UI
│   │   ├── kontakte/               # Contact forms
│   │   ├── messaging/              # Channel + message UI
│   │   ├── notifications/          # Notification provider + toast
│   │   ├── portal/                 # Portal-specific UI (sidebar, header)
│   │   ├── search/                 # Search UI components
│   │   └── tickets/                # Ticket UI
│   ├── hooks/                      # Custom React hooks
│   │   ├── use-email-store.ts      # Email client state (Zustand-like)
│   │   └── use-keyboard-shortcuts.ts
│   ├── lib/                        # Domain service libraries
│   │   ├── ai/                     # AI provider, scan/briefing/proactive processors, reranker
│   │   ├── audit.ts                # Audit event logging (50+ event types)
│   │   ├── auth.ts                 # NextAuth configuration (full, with Prisma adapter)
│   │   ├── auth.config.ts          # Edge-compatible auth config (no Prisma)
│   │   ├── bea/                    # beA (electronic legal mailbox) service
│   │   ├── db.ts                   # Prisma singleton + $extends (BRAK 2025 gates)
│   │   ├── dsgvo/                  # GDPR anonymization + data export
│   │   ├── email/                  # IMAP connection manager + SMTP send processor
│   │   ├── embedding/              # Chunker, embedder, vector store, hybrid search
│   │   ├── falldaten/              # Case data schema + template seed
│   │   ├── finance/                # RVG calculator, invoice, aktenkonto, export (DATEV, SEPA)
│   │   ├── fristen/                # Deadline calculation + presets
│   │   ├── gamification/           # Quest engine, boss fight, shop, badge service, weekly snapshots
│   │   ├── gesetze/                # German legal code sync (GitHub → pgvector)
│   │   ├── health/                 # Health check endpoint logic
│   │   ├── helena/                 # AI agent (orchestrator, tools, schriftsatz pipeline, QA)
│   │   ├── kontakte/               # Contact import + KYC service
│   │   ├── logger.ts               # pino root logger + createLogger(module)
│   │   ├── meilisearch.ts          # Meilisearch client + index management
│   │   ├── messaging/              # Channel service + message service
│   │   ├── muster/                 # Document template (Muster) ingestion + seed
│   │   ├── notifications/          # In-app notification service
│   │   ├── ocr/                    # OCR type definitions
│   │   ├── onlyoffice.ts           # OnlyOffice URL resolver + JWT config helper
│   │   ├── pii/                    # PII filter (NER via Ollama)
│   │   ├── portal/                 # Portal email templates + notification service
│   │   ├── portal-access.ts        # MANDANT data isolation (Kontakt→Beteiligter chain)
│   │   ├── portal-session.ts       # Portal 30-min inactivity session provider (client)
│   │   ├── queue/                  # BullMQ queue instances + processors
│   │   │   ├── queues.ts           # All queue instances + calculateBackoff
│   │   │   └── processors/         # One file per processor (ocr, embedding, helena-task, etc.)
│   │   ├── rbac.ts                 # requireAuth, requireRole, requireAkteAccess, buildAkteAccessFilter
│   │   ├── redis.ts                # Redis connection factory (ioredis)
│   │   ├── scanner/                # Nightly scanner + 4 checks (frist, inaktiv, anomalie, neues-urteil)
│   │   ├── settings/               # SystemSetting service (typed getter/setter)
│   │   ├── socket/                 # Socket.IO server setup, rooms, auth, emitter
│   │   ├── storage.ts              # MinIO/S3 client (AWS SDK v3)
│   │   ├── urteile/                # Court ruling sync (OpenJustiz → pgvector)
│   │   └── vorlagen.ts             # Document template generation
│   ├── middleware.ts               # NextAuth edge middleware (route protection)
│   ├── server.ts                   # Custom HTTP server entry (Next.js + Socket.IO)
│   ├── types/                      # TypeScript declarations
│   │   ├── next-auth.d.ts          # NextAuth session type augmentation (role, kanzleiId, kontaktId)
│   │   └── use-email-store.ts      # Email store types
│   ├── worker.ts                   # BullMQ worker process entry (all 19 workers)
│   └── workers/
│       └── processors/             # Long/complex processor modules
│           ├── frist-reminder.ts   # Deadline reminder processor
│           └── scanner.ts          # Nightly scanner orchestrator
├── prisma/
│   ├── schema.prisma               # Single source of truth (2483 lines, 90+ models)
│   └── migrations/                 # Sequential migration history (2026-02-25 to 2026-03-02)
├── tests/                          # Integration/acceptance tests
│   └── pii/ner-filter.acceptance.test.ts
├── scripts/
│   ├── build-server.ts             # TypeScript build for server entry
│   └── build-worker.ts             # TypeScript build for worker entry
├── public/                         # Static assets
├── dist-server/                    # Compiled web server (gitignored)
├── dist-worker/                    # Compiled worker process (gitignored)
├── docker-compose.yml              # 9 services: app, worker, postgres, redis, minio, meilisearch, onlyoffice, ollama, stirling-pdf
├── next.config.mjs                 # Next.js config (standalone output, webpack aliases)
├── tailwind.config.ts              # Tailwind config
├── tsconfig.json                   # TypeScript config
└── vitest.config.ts                # Vitest test config
```

## Directory Purposes

**`src/app/(dashboard)/`:**
- Purpose: All law firm staff UI pages (ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT roles)
- Contains: RSC page files + `page.tsx`/`layout.tsx` pairs; co-located `*-client.tsx` for client components
- Key files: `layout.tsx` (auth guard + all providers), each subdirectory has `page.tsx`

**`src/app/(portal)/`:**
- Purpose: Mandant client portal (MANDANT role only)
- Contains: Separate sidebar/header from staff dashboard; 10s polling for messages (no Socket.IO)
- Key files: `layout.tsx` (MANDANT role check + 30min inactivity session)

**`src/app/(portal-public)/`:**
- Purpose: Unauthenticated portal pages (invite activation, login, password reset)
- Contains: Pages accessible without session; excluded from middleware protection

**`src/app/api/`:**
- Purpose: All REST API endpoints
- Pattern: Every resource follows RESTful nesting: `/api/{resource}/[id]/{sub-resource}`
- Auth: Every `route.ts` calls `requireAuth()` or `requireRole()` at the top (or `requireMandantAkteAccess()` for portal routes)

**`src/lib/helena/`:**
- Purpose: Complete AI agent implementation
- Contains: Orchestrator (ReAct loop), 14 tools, schriftsatz deterministic pipeline, QA logging, complexity classifier, memory service, task service
- Key files: `orchestrator.ts`, `tools/index.ts`, `schriftsatz/index.ts`, `complexity-classifier.ts`, `task-service.ts`

**`src/lib/queue/processors/`:**
- Purpose: BullMQ job processor functions (one per queue)
- Contains: `ocr.processor.ts`, `embedding.processor.ts`, `helena-task.processor.ts`, `gamification.processor.ts`, `gesetze-sync.processor.ts`, `urteile-sync.processor.ts`, `muster-ingestion.processor.ts`, `ner-pii.processor.ts`, `preview.processor.ts`, `test.processor.ts`, `akte-embedding.processor.ts`

**`src/lib/socket/`:**
- Purpose: Socket.IO server configuration and cross-process emitter
- Contains: `server.ts` (server setup + Redis adapter), `rooms.ts` (room management), `auth.ts` (JWT middleware), `emitter.ts` (worker→browser cross-process emitter)

**`src/components/ui/`:**
- Purpose: shadcn/ui base primitives (do not modify directly)
- Contains: Button, Dialog, Table, Input, Select, Badge, etc.

**`prisma/`:**
- Purpose: PostgreSQL schema (single source of truth) and migration history
- Key: 2483-line schema with 90+ models, pgvector extension for semantic search

---

## Key File Locations

**Entry Points:**
- `src/server.ts`: Custom Next.js server with Socket.IO
- `src/worker.ts`: BullMQ worker process (all 19 queues)
- `src/middleware.ts`: NextAuth edge middleware

**Configuration:**
- `prisma/schema.prisma`: Data model (source of truth)
- `next.config.mjs`: Next.js build config
- `docker-compose.yml`: All service definitions
- `tsconfig.json`: TypeScript paths (`@/` → `src/`)

**Auth & Security:**
- `src/lib/auth.ts`: NextAuth full config (credentials, PrismaAdapter, audit logging)
- `src/lib/auth.config.ts`: Edge-compatible subset (for middleware)
- `src/lib/rbac.ts`: All RBAC helpers + permission matrix
- `src/lib/portal-access.ts`: MANDANT data isolation

**Database:**
- `src/lib/db.ts`: Prisma singleton with BRAK 2025 `$extends` business rules

**AI:**
- `src/lib/ai/provider.ts`: Multi-provider factory (Ollama/OpenAI/Anthropic)
- `src/lib/helena/orchestrator.ts`: ReAct agent loop
- `src/lib/helena/schriftsatz/index.ts`: Deterministic Schriftsatz pipeline
- `src/lib/helena/complexity-classifier.ts`: Rule-based mode/tier router (no LLM)
- `src/lib/embedding/hybrid-search.ts`: BM25 + vector + RRF + reranker

**Infrastructure:**
- `src/lib/storage.ts`: MinIO S3 client
- `src/lib/meilisearch.ts`: Meilisearch client
- `src/lib/redis.ts`: Redis connection factory
- `src/lib/socket/server.ts`: Socket.IO server + Redis adapter
- `src/lib/queue/queues.ts`: All 19 BullMQ queue instances
- `src/lib/logger.ts`: pino logger factory

---

## Naming Conventions

**Files:**
- RSC pages: `page.tsx` (always)
- Client components co-located with pages: `{feature}-client.tsx` (e.g., `akte-detail-client.tsx`)
- Route handlers: `route.ts` (always)
- Layouts: `layout.tsx` (always)
- Service modules: `kebab-case.ts` (e.g., `task-service.ts`, `draft-notification.ts`)
- Processors: `{name}.processor.ts`

**Directories:**
- Feature directories: `kebab-case` matching German domain terminology (e.g., `fristen`, `beteiligte`, `akten`)
- Route groups: `(group-name)` (e.g., `(dashboard)`, `(portal)`, `(portal-public)`)
- Dynamic segments: `[id]`, `[docId]`, `[dId]`, `[[...path]]` for catch-all

**Components:**
- React components: `PascalCase.tsx`
- Client components marked with `"use client"` directive at top

**Exports:**
- Service libs: named exports (no default)
- React components: `export default` for pages, named exports for reusable components

---

## Where to Add New Code

**New Dashboard Page:**
- Page: `src/app/(dashboard)/{feature}/page.tsx`
- Client component: `src/app/(dashboard)/{feature}/{feature}-client.tsx`
- Navigation: Add to `src/components/layout/sidebar.tsx`

**New API Endpoint:**
- Handler: `src/app/api/{resource}/route.ts` or `src/app/api/{resource}/[id]/route.ts`
- Auth guard: Call `requireAuth()` or `requireRole()` at the top of every handler
- Pattern: Follow existing handlers in `src/app/api/akten/` as reference

**New Portal API Endpoint:**
- Handler: `src/app/api/portal/{resource}/route.ts`
- Auth: Use `requireMandantAkteAccess()` from `src/lib/portal-access.ts` (not `requireAkteAccess()`)

**New Background Job:**
1. Add queue to `src/lib/queue/queues.ts`
2. Create processor in `src/lib/queue/processors/{name}.processor.ts`
3. Register new Worker in `src/worker.ts` following existing worker pattern
4. Add queue name to startup log list at end of `startup()` function

**New Helena Tool:**
- Read tool: `src/lib/helena/tools/_read/{tool-name}.ts`
- Write tool: `src/lib/helena/tools/_write/{tool-name}.ts`
- Register in: `src/lib/helena/tools/index.ts`

**New Service Library:**
- Location: `src/lib/{domain-name}/` (new directory) or `src/lib/{domain-name}.ts` (single file)
- Import Prisma via: `import { prisma } from "@/lib/db"` (never `new PrismaClient()`)

**New Component:**
- Feature component: `src/components/{feature}/{component-name}.tsx`
- shadcn primitive: `src/components/ui/{component}.tsx` (generated by shadcn CLI, do not hand-edit)

**Shared Utilities:**
- `src/lib/utils.ts` for generic helpers (cn, date formatting, etc.)

---

## Special Directories

**`.planning/`:**
- Purpose: GSD planning documents, milestones, phases, codebase analysis
- Generated: No (hand-maintained by GSD workflow)
- Committed: Yes

**`.ralph/`:**
- Purpose: Ralph AI assistant logs, docs, specs
- Generated: Partially (logs)
- Committed: Yes (docs/specs)

**`dist-server/`:**
- Purpose: Compiled web server output (from `scripts/build-server.ts`)
- Generated: Yes
- Committed: No (gitignored)

**`dist-worker/`:**
- Purpose: Compiled worker process output (from `scripts/build-worker.ts`)
- Generated: Yes
- Committed: No (gitignored)

**`prisma/migrations/`:**
- Purpose: Ordered PostgreSQL migration history
- Generated: Yes (via `prisma migrate dev`)
- Committed: Yes (required for production deploys)

**`node_modules/`:**
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-03-04*
