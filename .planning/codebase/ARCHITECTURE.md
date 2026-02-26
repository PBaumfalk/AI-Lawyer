# Architecture

**Analysis Date:** 2026-02-24

## Pattern Overview

**Overall:** Server-Driven Full-Stack Monolith (Next.js App Router) + Microservices-Ready Backend

**Key Characteristics:**
- Next.js 14+ (App Router) with TypeScript for frontend and API routes
- Authentication integrated at middleware level via NextAuth.js v5
- Prisma ORM as single source of truth for data models
- External service integrations (MinIO, Meilisearch, OnlyOffice, Ollama) consumed via SDK clients
- Role-Based Access Control (RBAC) embedded in session tokens
- AI task processing decoupled via tagged task queue pattern (tags with `ai:` prefix)
- Public/internal URL patterns for container-to-container communication (OnlyOffice, MinIO)

## Layers

**Presentation Layer (React/Next.js):**
- Purpose: Server components (layouts, pages) and client components (interactive UI)
- Location: `src/app/` (App Router structure) and `src/components/`
- Contains: Page definitions, layouts, form components, lists, modals
- Depends on: HTTP API routes, auth session, state providers
- Used by: Browser clients
- Pattern: Server-first with minimal client-side state; SessionProvider wraps dashboard; layouts auto-redirect unauthenticated users

**API Routes Layer (RESTful):**
- Purpose: HTTP endpoint definitions for CRUD operations, file handling, AI task triggering
- Location: `src/app/api/` (nested RESTful structure following Next.js conventions)
- Contains: Route handlers (GET/POST/PUT/DELETE), request validation via Zod, response formatting
- Depends on: Prisma ORM, auth middleware, external services (MinIO, Meilisearch)
- Used by: Frontend pages, external integrations (OnlyOffice callbacks, OpenClaw)
- Pattern: One `route.ts` file per endpoint; Zod schemas for validation; auth check at handler start; JSON responses

**Business Logic Layer (Services/Libraries):**
- Purpose: Core domain logic isolated from HTTP layer
- Location: `src/lib/` (organized by domain)
- Contains:
  - `auth.ts`: NextAuth.js configuration, JWT callbacks, role mapping
  - `db.ts`: Prisma singleton with dev logging
  - `storage.ts`: MinIO/S3 client wrapper
  - `meilisearch.ts`: Full-text search indexing and queries
  - `onlyoffice.ts`: Document editor config generation, JWT signing, URL rewriting
  - `ai/`: AI task processing (prompt templates, task queue logic, Ollama client)
  - `audit.ts`: Audit log creation
  - `conflict-check.ts`: Conflict-of-interest checks (business rule)
  - `aktenzeichen.ts`: Case number generation
  - `vorlagen.ts`: Document template handling
  - Domain-specific: `kontakte/` (contact import/vCard handling), etc.
- Depends on: Prisma, external SDKs
- Used by: API routes, components

**Data Layer (Prisma ORM + PostgreSQL):**
- Purpose: All database operations through single Prisma client
- Location: `prisma/schema.prisma` (schema definition), `src/lib/db.ts` (client singleton)
- Contains: 30+ models covering users, cases, contacts, documents, calendar, financials, audit logs
- Depends on: PostgreSQL 16 with pgvector extension
- Used by: All business logic

**External Integrations:**
- MinIO (S3-compatible): Document/file storage via `src/lib/storage.ts` (AWS SDK)
- Meilisearch: Full-text document search via `src/lib/meilisearch.ts`
- OnlyOffice Docs: WYSIWYG document editing via API config generation in `src/lib/onlyoffice.ts`
- Ollama: Local LLM inference via `src/lib/ai/ollama.ts`
- NextAuth.js: Authentication with Prisma adapter
- Sonner: Toast notifications (client-side)
- Zod: Request validation (all API routes)

## Data Flow

**Case Management Workflow:**

1. User navigates to `/akten` page (server component)
2. Page fetches list via `GET /api/akten?status=OFFEN` (API route)
3. API route calls `auth()` to verify session, then `prisma.akte.findMany()`
4. Results returned as JSON; page renders component tree with case list
5. User clicks "New Case" → form submission to `POST /api/akten`
6. API validates input with Zod schema, calls `generateAktenzeichen()` (business logic)
7. Case created in DB, audit log recorded via `logAuditEvent()`
8. Response redirects frontend; page re-fetches list (revalidation)

**Document Processing Workflow:**

1. User uploads file via `/akten/[id]/dokumente` (form → `POST /api/akten/[id]/dokumente`)
2. File streamed to MinIO via `uploadFile()` from `src/lib/storage.ts`
3. Document record created in Prisma (stores MinIO key, metadata)
4. Async: Document indexed in Meilisearch for full-text search
5. User edits document → OnlyOffice editor (React component + iframe)
6. OnlyOffice calls `GET /api/onlyoffice/config/[dokumentId]` for editor config
7. Config generation in `src/lib/onlyoffice.ts`: creates JWT-signed config with document URL
8. OnlyOffice saves → callback to `POST /api/onlyoffice/callback`
9. Callback updates document in MinIO and Prisma

**AI Task Processing Workflow:**

1. User creates Ticket with `ai:draft` tag → stored in DB with tag array
2. External process (cron or OpenClaw) calls `GET /api/openclaw/tasks`
3. Fetches tasks where `tags` contains `ai:*` pattern
4. For each task: `src/lib/ai/process-tasks.ts` acquires atomic lock
5. Load case context (Dokument records, ChatNachricht history)
6. Call `ollamaGenerate()` with prompt built from `prompt-templates.ts`
7. Result written as ChatNachricht (userId=null, role="assistant") with status ENTWURF
8. Lock released; task marked with `ai:done` tag
9. User reviews draft, manually creates Dokument with status FREIGEGEBEN before sending

**State Management:**

- Session state: Stored in JWT, decoded by `auth()` middleware, available to all components/routes
- UI state: Minimal client-side state (collapsible sidebar, search filters); mostly server-derived
- Database state: Prisma is authoritative; all mutations go through API routes
- No client-side stores (Redux/Zustand) needed; form state via react-hook-form

## Key Abstractions

**Akte (Case) Model:**
- Purpose: Central entity representing a legal case
- Examples: `src/app/api/akten/route.ts`, `src/app/(dashboard)/akten/[id]/page.tsx`
- Pattern: Always fetch with related contacts (beteiligte), documents, calendar entries; expose via REST

**Dokument (Document) Model:**
- Purpose: File + metadata for storage in MinIO, editing in OnlyOffice, searching in Meilisearch
- Status field: ENTWURF → ZUR_PRUEFUNG → FREIGEGEBEN → VERSENDET (state machine)
- Examples: `src/app/api/akten/[id]/dokumente/route.ts`, `src/components/dokumente/`
- Pattern: Always validate status before allowing download/send; audit creator and approver

**Kontakt (Contact) Model:**
- Purpose: Party registry for cases (mandants, opponents, courts, experts)
- Supports: Natural persons + legal entities with extended KYC, relationship mapping
- Examples: `src/app/api/kontakte/route.ts`, `src/components/kontakte/`
- Pattern: Flexible schema; relationships modeled via Beziehung (many-to-many)

**Ticket (Task) Model:**
- Purpose: Work item queue for lawyers, optional AI automation
- Tags field: Array of strings; `ai:*` prefix signals AI automation intent
- Examples: `src/app/api/tickets/route.ts`, `src/lib/ai/process-tasks.ts`
- Pattern: Atomic lock mechanism for concurrent AI processing; status lifecycle (OFFEN → IN_BEARBEITUNG → ERLEDIGT)

**KalenderEintrag (Calendar Entry) Model:**
- Purpose: Deadlines, appointments, review dates tied to cases
- Types: TERMIN, FRIST (deadline), WIEDERVORLAGE (reminder)
- Examples: `src/app/api/kalender/route.ts`
- Pattern: Linked to Akte; verantwortlichUserId for assignment

## Entry Points

**Web Application Root:**
- Location: `src/app/page.tsx`
- Triggers: User navigates to `/`
- Responsibilities: Redirects to `/dashboard`

**Dashboard Layout:**
- Location: `src/app/(dashboard)/layout.tsx`
- Triggers: Any route under `/dashboard/*`
- Responsibilities:
  - Auth check via `auth()` middleware → redirect to `/login` if missing
  - Wrap in SessionProvider
  - Render Sidebar, Header, CommandPalette layout
  - Force dynamic rendering (no static generation for protected routes)

**Auth Route Group:**
- Location: `src/app/(auth)/login` (layout at `src/app/(auth)/layout.tsx`)
- Triggers: User navigates to `/login`
- Responsibilities: Login form, credential validation via NextAuth
- Uses: Credentials provider (email/password stored in DB)

**API Route: NextAuth Handler:**
- Location: `src/app/api/auth/[...nextauth]/route.ts`
- Triggers: All requests to `/api/auth/*` (login, logout, callback, session)
- Responsibilities: NextAuth configuration, session generation

**OnlyOffice Config Endpoint:**
- Location: `src/app/api/onlyoffice/config/[dokumentId]/route.ts`
- Triggers: OnlyOffice editor iframe requests config (browser CORS call)
- Responsibilities: Generate JWT-signed editor configuration with secure document URL

**Document Callback Endpoint:**
- Location: `src/app/api/onlyoffice/callback`
- Triggers: OnlyOffice server notifies app of save/version changes
- Responsibilities: Download converted file from OnlyOffice, update MinIO + Prisma

**OpenClaw AI Integration:**
- Location: `src/app/api/openclaw/*` (multiple endpoints)
- Triggers: External OpenClaw orchestrator queries for tasks, updates results
- Responsibilities: Expose task queue, case context, allow draft creation (never auto-send)

## Error Handling

**Strategy:** Fail-safe with user-friendly messages; audit all errors

**Patterns:**
- API routes: Try-catch wraps handler, returns `NextResponse.json({ error: "..." }, { status: 500 })`
- Validation: Zod schema parsing; `safeParse()` returns error details
- Auth errors: 401 (unauthorized), redirect to login for session-protected routes
- DB errors: Wrapped in try-catch; logged to audit; generic error message to user (no DB details exposed)
- File operations (MinIO): Fallback URLs, timeout handling
- OnlyOffice integration: Timeout for JWT generation; fallback config

## Cross-Cutting Concerns

**Logging:**
- Approach: Audit log via `logAuditEvent()` for critical operations (create, update, delete)
- Location: `src/lib/audit.ts`
- Pattern: Injected into API routes; records userId, action, resource, timestamp

**Validation:**
- Approach: Zod schemas at API route entry points
- Pattern: Schema defined near endpoint; `safeParse()` used; detailed error messages
- Example: `src/app/api/kontakte/route.ts` line 6-70 (large schema for contact creation)

**Authentication:**
- Approach: NextAuth.js v5 with JWT session + Credentials provider
- Pattern: `auth()` async function called in server components and API routes
- Roles embedded in token (RBAC): ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT, PRAKTIKANT
- Middleware at `src/middleware.ts` protects routes; exemptions for auth, onlyoffice, openclaw

---

*Architecture analysis: 2026-02-24*
