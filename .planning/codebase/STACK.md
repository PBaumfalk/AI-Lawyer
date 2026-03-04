# Technology Stack

**Analysis Date:** 2026-03-04

## Languages

**Primary:**
- TypeScript 5.7.x - All application code (Next.js, workers, scripts, tests)

**Secondary:**
- SQL (PostgreSQL) - Raw queries via Prisma `$executeRawUnsafe` for pgvector index management
- HTML/CSS - Tailwind CSS utility classes + oklch CSS variables in `src/app/globals.css`

## Runtime

**Environment:**
- Node.js 20 (Alpine Linux in Docker, `node:20-alpine`)
- Two independent Node.js processes: custom HTTP server (`src/server.ts`) and BullMQ worker (`src/worker.ts`)

**Package Manager:**
- npm (lockfile: `package-lock.json` present)

## Frameworks

**Core:**
- Next.js 14.2.x (App Router, `^14.2.21`) - Full-stack framework, server components, API routes
  - Output: `standalone` (self-contained Docker image)
  - Turbopack enabled in dev (`next dev --turbo`)
  - TypeScript build errors enforced (`ignoreBuildErrors: false`)
- React 18.3.x - UI rendering

**UI Component Layer:**
- shadcn/ui (not a package — components inlined in `src/components/ui/`)
  - Built on Radix UI primitives (`@radix-ui/*`)
- Tailwind CSS 3.4.x - Utility-first styling
  - Config: `tailwind.config.ts`
  - Plugin: `@tailwindcss/typography`
  - Dark mode via `class` strategy
  - Custom oklch color system (CSS variables, 4 blur tiers Glass UI)
- Lucide React 0.468 - Icon library
- Framer Motion (`motion` 12.x) - Animations
- Recharts 3.7 - Charts/data visualization

**Rich Text & Document Editing:**
- Tiptap 3.20 (`@tiptap/react`, `@tiptap/starter-kit`, extensions) - Rich text editor for messages/notes
- OnlyOffice Document Editor React 2.1.1 (`@onlyoffice/document-editor-react`) - Full office document editing (DOCX/XLSX/PPTX)

**Forms & Validation:**
- React Hook Form 7.54 + `@hookform/resolvers`
- Zod 3.23 - Schema validation (shared between client and server)

**AI / LLM:**
- Vercel AI SDK v4 (`ai` 4.3.x) - Unified streaming interface + `generateText`/`generateObject`
- `@ai-sdk/openai` 1.3.x - OpenAI provider adapter
- `@ai-sdk/anthropic` 1.2.x - Anthropic provider adapter
- `@ai-sdk/react` 1.2.x - React hooks for streaming AI
- `ollama-ai-provider` 1.2 - Ollama local LLM adapter
- LangChain Core 1.1.x + LangChain Text Splitters 1.0 - Document chunking

**Queue / Background Jobs:**
- BullMQ 5.70 - Job queue library (19 named queues)
- `@bull-board` 6.19 - Queue monitoring UI (Hono server adapter)

**Server / Custom HTTP:**
- Hono 4.12 - Lightweight HTTP framework (used for Bull Board API)
- Socket.IO 4.8 - Real-time WebSocket server (attached to custom HTTP server)
- `socket.io-client` 4.8 - Client-side Socket.IO
- `@socket.io/redis-adapter` 8.3 - Redis pub/sub for horizontal Socket.IO scaling
- `@socket.io/redis-emitter` 5.1 - Emit from worker process without direct server connection

**Database ORM:**
- Prisma 5.22 (`prisma`, `@prisma/client`) - ORM + migration tool
  - 84 models in `prisma/schema.prisma`
  - Extended client with business invariants via `$extends` in `src/lib/db.ts`
  - `postgresqlExtensions` preview feature enabled (for pgvector)
- `pgvector` 0.2.1 - Node.js pgvector bindings

**Email:**
- `imapflow` 1.2 - IMAP client (persistent connections via connection-manager)
- `nodemailer` 7.0 - SMTP sending
- `mailparser` 3.9 - Parse raw email messages

**PDF & Documents:**
- `pdf-lib` 1.17 - PDF manipulation (ZUGFeRD/XRechnung embedding)
- `pdf-parse` 2.4 - Text extraction from PDFs
- `pdfjs-dist` 5.4.296 (pinned) - PDF rendering in browser (`react-pdf`)
- `react-pdf` 10.4 - PDF viewer component
- `docxtemplater` 3.68 + `pizzip` 3.2 - DOCX template filling

**Finance / Legal Standards:**
- `sepa` 2.1 - SEPA XML generation
- `@e-invoice-eu/core` 2.3 - EN16931/ZUGFeRD/XRechnung e-invoice generation
- `feiertagejs` 1.5 - German public holiday calculation
- `date-fns` 4.1 + `date-fns-tz` 3.2 - Date manipulation with timezone support

**Security & Auth:**
- `bcryptjs` 2.4 - Password hashing
- `jsonwebtoken` 9.0 - JWT signing/verification (OnlyOffice integration)
- `dompurify` 3.3 - HTML sanitization (client-side)
- `sanitize-html` 2.17 - HTML sanitization (server-side)

**Utilities:**
- `fast-xml-parser` 5.3 - XML parsing (XJustiz, RSS feeds, CAMT banking files)
- `date-fns` 4.1 - Date utilities
- `clsx` 2.1 + `tailwind-merge` 2.6 - Conditional class merging
- `class-variance-authority` 0.7 - Component variant system
- `cmdk` 1.0 - Command palette
- `sonner` 1.7 - Toast notifications
- `canvas-confetti` 1.9 - Confetti animation (gamification)
- `@tanstack/react-virtual` 3.13 - Virtual list rendering
- `react-resizable-panels` 4.6 - Resizable panel layouts
- `react-markdown` 10.1 + `remark-gfm` 4.0 - Markdown rendering

**Testing:**
- Vitest 4.0.x - Test runner (config: `vitest.config.ts`)
  - Environment: `node`
  - Globals: enabled

**Build/Dev:**
- tsx 4.19 - TypeScript execution for scripts/dev mode
- esbuild 0.27 - Bundle `server.ts` and `worker.ts` for production
- ESLint 8.57 + `eslint-config-next` 14 - Linting
- PostCSS 8 + Autoprefixer 10 - CSS processing
- pino 10.3 + pino-pretty 13 + pino-roll 4 - Structured logging with file rotation

## Key Dependencies

**Critical:**
- `next@^14.2.21` - Core framework (App Router)
- `@prisma/client@^5.22.0` - Database access layer (84 models)
- `ai@^4.3.19` - AI SDK for all LLM interactions
- `bullmq@^5.70.1` - All background job processing (19 queues)
- `socket.io@^4.8.3` - Real-time notifications
- `next-auth@^5.0.0-beta.25` - Authentication (JWT sessions, RBAC)
- `@onlyoffice/document-editor-react@^2.1.1` - Document editing

**Infrastructure:**
- `@aws-sdk/client-s3@^3.995.0` + `@aws-sdk/s3-request-presigner` - MinIO S3-compatible storage
- `ioredis@^5.9.3` - Redis client (BullMQ + Socket.IO adapter)
- `meilisearch@^0.55.0` - Full-text search client
- `pino@^10.3.1` + `pino-roll@^4.0.0` - Production logging with daily rotation

## Configuration

**Environment:**
- All env vars injected at Docker runtime via `docker-compose.yml`
- No `.env` file committed — Docker Compose provides env for both `app` and `worker` containers
- Key required env vars:
  - `DATABASE_URL` - PostgreSQL connection string
  - `NEXTAUTH_SECRET` / `NEXTAUTH_URL` / `AUTH_TRUST_HOST`
  - `REDIS_URL`
  - `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_USE_SSL`, `MINIO_PUBLIC_URL`
  - `MEILISEARCH_URL`, `MEILISEARCH_API_KEY`
  - `ONLYOFFICE_URL`, `ONLYOFFICE_INTERNAL_URL`, `ONLYOFFICE_SECRET`, `APP_INTERNAL_URL`
  - `STIRLING_PDF_URL`
  - `OLLAMA_URL`
  - `EMAIL_ENCRYPTION_KEY`
  - `LOG_LEVEL`, `LOG_FILE_PATH`
  - `WORKER_CONCURRENCY` (default: `5`)
  - `OPENCLAW_GATEWAY_TOKEN` - Token for OpenClaw AI agent gateway (optional)
  - `GITHUB_TOKEN` - For GitHub API (Gesetze sync, optional but recommended)

**Build:**
- `next.config.mjs` - Next.js config (standalone output, serverComponentsExternalPackages, Turbopack aliases)
- `tsconfig.json` - TypeScript strict mode, path alias `@/*` → `./src/*`
- `tailwind.config.ts` - Tailwind theme (oklch colors, Glass UI shadows)
- `vitest.config.ts` - Test config (node environment, `@/` alias)
- `postcss.config.mjs` - PostCSS (Tailwind + Autoprefixer)

## Platform Requirements

**Development:**
- Node.js 20
- Docker + Docker Compose (9 services)
- Sufficient RAM for OnlyOffice (4GB limit), Stirling-PDF (4GB limit), Ollama (GPU recommended)

**Production:**
- Docker Compose deployment (9 services: app, worker, db, redis, minio, meilisearch, onlyoffice, stirling-pdf, ollama)
- Optional: LanguageTool (docker profile `full`)
- NVIDIA GPU recommended for Ollama (local LLM inference)
- Node.js 20 Alpine in Docker image
- Log volume mounted at `/var/log/ai-lawyer/`

---

*Stack analysis: 2026-03-04*
