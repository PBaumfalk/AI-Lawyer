# Codebase Structure

**Analysis Date:** 2026-02-24

## Directory Layout

```
ai-lawyer/
├── .planning/                    # GSD planning artifacts (generated)
├── .ralph/                       # Project specs, requirements, fix plan
│   ├── PROMPT.md                # Project brief (AI-First law firm software)
│   ├── requirements.md          # Technical specification
│   └── fix_plan.md              # Development task list
├── prisma/
│   ├── schema.prisma            # Datenmodell (Enums + Models) — SOURCE OF TRUTH
│   └── seed.ts                  # Database seeding script
├── src/
│   ├── app/                     # Next.js 14 App Router
│   │   ├── (auth)/              # Public auth routes (no protection)
│   │   │   ├── login/           # Login page
│   │   │   └── layout.tsx       # Auth layout wrapper
│   │   ├── (dashboard)/         # Protected dashboard routes
│   │   │   ├── akten/           # Case management
│   │   │   ├── kontakte/        # Contact/party registry
│   │   │   ├── kalender/        # Calendar/deadlines
│   │   │   ├── dokumente/       # Document search
│   │   │   ├── email/           # Email client
│   │   │   ├── tickets/         # Task/ticket queue
│   │   │   ├── ki-entwuerfe/    # AI draft workspace
│   │   │   ├── finanzen/        # Financials (RVG, invoicing)
│   │   │   ├── bea/             # beA (electronic legal postbox)
│   │   │   ├── nachrichten/     # Internal messaging
│   │   │   ├── einstellungen/   # Settings, admin panel
│   │   │   ├── dashboard/       # Main dashboard
│   │   │   └── layout.tsx       # Dashboard layout (Sidebar, Header, CommandPalette)
│   │   ├── api/                 # API routes (REST endpoints)
│   │   │   ├── akten/           # Case CRUD + subresources (beteiligte, dokumente, historie)
│   │   │   ├── kontakte/        # Contact CRUD + import, KYC, powers of attorney, documents
│   │   │   ├── kalender/        # Calendar CRUD
│   │   │   ├── dokumente/       # Document search + reindex + PDF export
│   │   │   ├── tickets/         # Ticket CRUD
│   │   │   ├── emails/          # Email message list + detail
│   │   │   ├── vorlagen/        # Document templates + placeholders
│   │   │   ├── users/           # User management
│   │   │   ├── auth/            # NextAuth handlers
│   │   │   ├── onlyoffice/      # OnlyOffice editor config + callback + download
│   │   │   └── openclaw/        # External AI orchestrator endpoints (tasks, drafts, notes, process)
│   │   ├── layout.tsx           # Root layout (metadata, Toaster)
│   │   └── page.tsx             # Root page (redirect to /dashboard)
│   ├── components/
│   │   ├── ui/                  # shadcn/ui base components (Button, Card, Dialog, etc.)
│   │   ├── layout/              # Navigation & chrome
│   │   │   ├── sidebar.tsx      # Main sidebar with collapse toggle
│   │   │   ├── header.tsx       # Top bar with user menu
│   │   │   └── command-palette.tsx # Cmd+K command search
│   │   ├── providers/           # Context/provider wrappers
│   │   │   └── session-provider.tsx # SessionProvider for dashboard
│   │   ├── akten/               # Case-specific UI components
│   │   │   ├── akte-list.tsx
│   │   │   ├── akte-detail.tsx
│   │   │   ├── beteiligter-form.tsx
│   │   │   └── ...
│   │   ├── kontakte/            # Contact UI components
│   │   │   ├── kontakt-list.tsx
│   │   │   ├── kontakt-form.tsx
│   │   │   └── ...
│   │   ├── dokumente/           # Document UI components
│   │   │   ├── dokument-list.tsx
│   │   │   ├── dokument-upload.tsx
│   │   │   └── ...
│   │   ├── kalender/            # Calendar UI components
│   │   ├── email/               # Email client UI
│   │   ├── tickets/             # Ticket queue UI
│   │   ├── ki/                  # AI-related UI (chat, drafts, summaries)
│   │   ├── vorlagen/            # Template management UI
│   │   └── editor/              # OnlyOffice editor wrapper
│   ├── lib/
│   │   ├── db.ts                # Prisma singleton with dev logging
│   │   ├── auth.ts              # NextAuth.js v5 config (JWT, session, Credentials provider)
│   │   ├── utils.ts             # Shared utilities (cn, date formatting, etc.)
│   │   ├── audit.ts             # Audit log creation via logAuditEvent()
│   │   ├── storage.ts           # MinIO/S3 client for file uploads/downloads
│   │   ├── meilisearch.ts       # Meilisearch client for full-text document search
│   │   ├── onlyoffice.ts        # OnlyOffice editor config, JWT signing, URL rewriting
│   │   ├── aktenzeichen.ts      # Case number generation logic
│   │   ├── vorlagen.ts          # Document template handling + docxtemplater integration
│   │   ├── conflict-check.ts    # Conflict-of-interest checking
│   │   ├── versand-gate.ts      # Document send/dispatch routing (beA, email, hybrid mail)
│   │   ├── openclaw-auth.ts     # OpenClaw API authentication
│   │   ├── falldaten-schemas.ts # Shared Zod schemas for case data
│   │   ├── ai/
│   │   │   ├── ollama.ts        # Ollama LLM client wrapper
│   │   │   ├── process-tasks.ts # Core AI task queue processor (locking, context, generation)
│   │   │   └── prompt-templates.ts # Prompt templates + action router (ai:draft, ai:summary, etc.)
│   │   └── kontakte/            # Contact-specific utilities
│   │       ├── csv-import.ts    # CSV contact import
│   │       └── vcard-import.ts  # vCard import
│   ├── types/
│   │   └── next-auth.d.ts       # NextAuth session/JWT augmentation with role + kanzleiId
│   ├── hooks/                   # React hooks (client-side state management)
│   └── middleware.ts            # NextAuth middleware; route protection
├── public/                      # Static assets (favicon, etc.)
├── docker-compose.yml           # Full stack (PostgreSQL, MinIO, Meilisearch, OnlyOffice, Ollama)
├── Dockerfile                   # Next.js app container
├── docker-entrypoint.sh         # Startup script
├── tailwind.config.ts           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript config with @/* path alias
├── next.config.mjs              # Next.js configuration
├── .eslintrc.json               # ESLint rules
├── package.json                 # Dependencies + scripts
├── .gitignore                   # Git exclusions
├── .env                         # Local environment (NOT committed)
└── .env.example                 # Template for .env variables
```

## Directory Purposes

**`prisma/`:**
- Purpose: Database schema (Prisma ORM) — single source of truth for all data models
- Contains: Enum definitions (UserRole, AkteStatus, Sachgebiet, etc.), Model definitions (User, Akte, Kontakt, Dokument, etc.)
- Key files: `schema.prisma` (30+ models), `seed.ts` (test data seeding)

**`src/app/`:**
- Purpose: Next.js 14 App Router — defines all routes (pages + API endpoints)
- Route groups: `(auth)` for public, `(dashboard)` for protected
- Dynamic routes use `[param]` syntax; catch-all via `[...param]`

**`src/app/api/`:**
- Purpose: REST API endpoints consumed by frontend and external integrations
- Pattern: One `route.ts` file per resource; nested structure mirrors resource hierarchy
- Example: `akten/[id]/dokumente/route.ts` handles GET/POST for case documents
- Auth: Every handler calls `auth()` first; returns 401 if missing session

**`src/components/`:**
- Purpose: Reusable React components organized by domain
- `ui/`: Base components (Button, Card, Dialog, Form, Select, Table, etc.) from shadcn/ui
- Domain folders: `akten/`, `kontakte/`, `dokumente/` contain feature-specific components
- Layout: `sidebar.tsx`, `header.tsx`, `command-palette.tsx` form the app shell

**`src/lib/`:**
- Purpose: Shared business logic, external integrations, utilities
- Organized by concern: `db.ts` (Prisma), `auth.ts` (authentication), `storage.ts` (MinIO), `meilisearch.ts` (search), etc.
- `ai/`: AI task processing (Ollama integration, task queue, prompt templates)
- `kontakte/`: Contact import utilities (CSV, vCard)
- No UI code here; pure functions and SDK wrappers

**`src/types/`:**
- Purpose: TypeScript type definitions and augmentations
- `next-auth.d.ts`: Extends NextAuth.js User/Session/JWT with role and kanzleiId

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: Root route (redirects to `/dashboard`)
- `src/app/(dashboard)/layout.tsx`: Protected layout (auth check, Sidebar, Header)
- `src/app/(auth)/login`: Public login page
- `src/app/api/auth/[...nextauth]/route.ts`: NextAuth handler

**Configuration:**
- `prisma/schema.prisma`: Data model definition
- `src/lib/db.ts`: Prisma client singleton
- `src/lib/auth.ts`: NextAuth.js configuration
- `tailwind.config.ts`: Tailwind theme + custom tokens
- `tsconfig.json`: Path alias `@/*` → `src/`

**Core Logic:**
- `src/lib/ai/process-tasks.ts`: AI task queue processor (atomic locking, context loading, generation)
- `src/lib/onlyoffice.ts`: OnlyOffice config generation + JWT signing
- `src/lib/storage.ts`: MinIO file operations (upload, download, delete, presigned URLs)
- `src/lib/meilisearch.ts`: Full-text search indexing + queries
- `src/lib/aktenzeichen.ts`: Case number generation

**Testing:**
- None yet (per PROMPT.md: "Max 20% effort on tests, focus on critical business logic only")
- Test files would go in `tests/` directory (Vitest for unit, Playwright for E2E)

## Naming Conventions

**Files:**
- API routes: `route.ts` (always)
- Page components: `page.tsx` (always in route directory)
- Layouts: `layout.tsx` (always)
- Components: `kebab-case.tsx` (e.g., `akte-list.tsx`, `command-palette.tsx`)
- Services/utilities: `kebab-case.ts` (e.g., `audit.ts`, `conflict-check.ts`)
- Types: `kebab-case.d.ts` or `kebab-case.ts` (e.g., `next-auth.d.ts`)

**Directories:**
- Feature folders: lowercase plural or singular depending on domain
  - `akten/` (plural, main feature area)
  - `kontakte/` (plural)
  - `kalender/` (singular, common name)
  - `dokumente/` (plural)
  - `vorlagen/` (plural)
  - `email/` (singular, common name)
  - `tickets/` (plural)
  - `finanzen/` (plural)
  - `bea/` (singular, acronym)
  - `einstellungen/` (plural)
- Layer folders: lowercase
  - `components/`, `lib/`, `types/`, `hooks/`
  - Subfolders within: `layout/`, `ui/`, `providers/`, `ai/`, `kontakte/`

**Functions:**
- camelCase: `generateAktenzeichen()`, `rewriteOnlyOfficeUrl()`, `logAuditEvent()`
- Async functions: same camelCase, implied async pattern in docs
- React components: PascalCase (e.g., `Sidebar`, `Header`, `CommandPalette`)

**Variables/Constants:**
- camelCase: `prismaClient`, `minioEndpoint`, `lockStaleMs`
- CONSTANTS for env/config: SCREAMING_SNAKE_CASE (e.g., `ONLYOFFICE_URL`, `MINIO_BUCKET`)
- Enums: PascalCase values (e.g., `UserRole.ADMIN`, `AkteStatus.OFFEN`)

**Types:**
- Interfaces: PascalCase (e.g., `DokumentSearchRecord`, `ProcessResult`)
- Types: PascalCase (e.g., `OODocumentType`)
- Database models: PascalCase (e.g., `Akte`, `Kontakt`, `Dokument`) — from Prisma schema

## Where to Add New Code

**New Feature (e.g., new module like "Zwangsvollstreckung"):**
1. **Data model**: Add to `prisma/schema.prisma` first; run `npx prisma migrate dev`
2. **API routes**: Create `src/app/api/zvollstreckung/route.ts` for list, `[id]/route.ts` for detail
3. **Page components**: Create `src/app/(dashboard)/zvollstreckung/page.tsx` (list) and `[id]/page.tsx` (detail)
4. **Feature components**: Create `src/components/zvollstreckung/zvollstreckung-list.tsx`, `zvollstreckung-form.tsx`
5. **Business logic**: Create `src/lib/zvollstreckung.ts` for domain-specific functions
6. **Navigation**: Add route to sidebar in `src/components/layout/sidebar.tsx`
7. **Tests** (if critical): Create `tests/unit/zvollstreckung.test.ts` or E2E tests in Playwright

**New Component/Module:**
- UI-only (e.g., new dashboard card): `src/components/akten/new-card.tsx`
- Logic + UI (e.g., new form): `src/components/kontakte/kyc-form.tsx` + `src/lib/kontakte/kyc-validation.ts`
- Shared utility: `src/lib/new-utility.ts` or `src/lib/kontakte/new-utility.ts` if domain-specific

**Utilities:**
- Shared helpers (used across domains): `src/lib/utils.ts`
- Domain-specific helpers: `src/lib/{domain}/helper.ts` (e.g., `src/lib/kontakte/csv-import.ts`)
- AI-related: `src/lib/ai/{concern}.ts` (e.g., `src/lib/ai/process-tasks.ts`)

**API Endpoints:**
- Resource CRUD: `src/app/api/{resource}/route.ts` (GET, POST) and `[id]/route.ts` (GET, PUT, DELETE)
- Subresources: `src/app/api/{resource}/[id]/{subresource}/route.ts`
- Complex operations: `src/app/api/{resource}/{operation}/route.ts` (e.g., `/api/kontakte/import/preview`)
- External callbacks: `src/app/api/{service}/callback` (e.g., `/api/onlyoffice/callback`)

## Special Directories

**`src/app/api/openclaw/`:**
- Purpose: External AI orchestrator integration points
- Generated: No (hand-written)
- Committed: Yes
- Contents: Task queue exposure, case context, draft creation (read-only for status)
- Never allows: Direct email/beA sending, document status update to FREIGEGEBEN

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes (from `npm run build`)
- Committed: No (in `.gitignore`)

**`node_modules/`:**
- Purpose: NPM dependencies
- Generated: Yes (from `npm install`)
- Committed: No (in `.gitignore`)

**`.planning/`:**
- Purpose: GSD (Guided Software Development) planning artifacts
- Generated: Yes (by Claude agents)
- Committed: Yes (to track architectural decisions)

**`.ralph/`:**
- Purpose: Project specifications, requirements, development roadmap
- Generated: Partially (fix_plan.md updated by agents as tasks complete)
- Committed: Yes
- Contents: PROMPT.md (project brief), requirements.md, fix_plan.md (task list)

---

*Structure analysis: 2026-02-24*
