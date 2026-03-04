# External Integrations

**Analysis Date:** 2026-03-04

## APIs & External Services

**AI / LLM Providers (multi-provider, runtime-switchable):**
- Ollama (local) - Default LLM inference provider, default model `qwen3.5:35b`
  - SDK: `ollama-ai-provider` + Vercel AI SDK
  - URL: `OLLAMA_URL` env var (default `http://localhost:11434`)
  - Docker service: `ailawyer-ollama` (NVIDIA GPU support)
  - Health check: `GET /api/tags` + `GET /api/version`
- OpenAI - Cloud LLM provider (optional, admin-configurable), default model `gpt-4o`
  - SDK: `@ai-sdk/openai`
  - Auth: `ai.provider.apiKey` stored in `SystemSetting` DB table
- Anthropic - Cloud LLM provider (optional, admin-configurable), default model `claude-sonnet-4-20250514`
  - SDK: `@ai-sdk/anthropic`
  - Auth: `ai.provider.apiKey` stored in `SystemSetting` DB table
- Provider selection: runtime switch via `SystemSetting.ai.provider` (Ollama/OpenAI/Anthropic)
  - Config factory: `src/lib/ai/provider.ts` → `getModel()`

**Legal Data Sources:**
- BMJ (Bundesministerium der Justiz) RSS Feeds - Daily sync of German federal court decisions
  - Endpoint: `https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-{court}.xml`
  - Courts: BGH, BAG, BVerwG, BFH, BSG, BPatG, BVerfG
  - Client: `src/lib/urteile/rss-client.ts` (native fetch, no SDK)
  - Trigger: Daily BullMQ cron job `urteile-sync` at 03:00 Europe/Berlin
- GitHub API (bundestag/gesetze) - Daily sync of German law texts
  - Endpoint: `https://api.github.com/repos/bundestag/gesetze`
  - Auth: `GITHUB_TOKEN` env var (optional, unauthenticated = 60 req/hr limit)
  - Client: `src/lib/gesetze/github-client.ts` (native fetch, no SDK)
  - Trigger: Daily BullMQ cron job `gesetze-sync` at 02:00 Europe/Berlin

**beA (besonderes elektronisches Anwaltspostfach):**
- bea.expert API - Browser-based electronic lawyer mailbox integration
  - Architecture: Client-side only (`"use client"`) — crypto operations require browser JS
  - Client: `src/lib/bea/client.ts`
  - Note: bea.expert JS library loaded dynamically at runtime (not installed as npm package)
  - Auth: Software token login with SAFE-ID (keys never transmitted to server)

**OpenClaw AI Agent Gateway:**
- Token-based external API access for AI agent workflows
  - Auth: Bearer token via `OPENCLAW_GATEWAY_TOKEN` env var (constant-time comparison)
  - Auth helper: `src/lib/openclaw-auth.ts`
  - Endpoints: `src/app/api/openclaw/` (tasks, drafts, notes, akten context, process)
  - Middleware bypass: OpenClaw routes excluded from NextAuth middleware

**LanguageTool (Optional):**
- Spell/grammar checking service
  - Docker service: `ailawyer-languagetool` (profile: `full`, not activated by default)
  - Port: 8010
  - Status: Docker service defined, integration not wired into application code

## Data Storage

**Databases:**
- PostgreSQL 16 with pgvector extension
  - Connection: `DATABASE_URL` env var
  - Client: Prisma 5.22 ORM with extended client (`src/lib/db.ts`)
  - ORM config: `prisma/schema.prisma` (84 models, `postgresqlExtensions` preview)
  - Docker service: `ailawyer-db` (`pgvector/pgvector:pg16` image)
  - Vector indexes: HNSW on `document_chunks.embedding` and `akten.summaryEmbedding` (1024-dim, cosine)
  - Migrations: `prisma/migrations/`

**File Storage:**
- MinIO (S3-compatible object storage)
  - Connection: `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` env vars
  - Bucket: `MINIO_BUCKET` env var (default: `dokumente`)
  - Client: AWS SDK v3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`)
  - Client wrapper: `src/lib/storage.ts`
  - Two S3 clients: internal (server ops) + public (presigned URLs for browser)
  - Storage key pattern: `akten/{akteId}/dokumente/{timestamp}_{sanitizedName}`
  - Preview key pattern: `akten/{akteId}/previews/{dokumentId}.pdf`
  - Docker service: `ailawyer-minio`

**Full-Text Search:**
- Meilisearch v1.11 - Full-text document search
  - Connection: `MEILISEARCH_URL`, `MEILISEARCH_API_KEY` env vars
  - Client: `meilisearch` npm package, wrapper in `src/lib/meilisearch.ts`
  - Index: `dokumente` (documents with OCR text, metadata, tags)
  - Searchable: name, OCR text, tags, Aktenzeichen, Kurzrubrum, folder, creator
  - Docker service: `ailawyer-meilisearch`

**Caching / Pub-Sub:**
- Redis 7 (Alpine)
  - Connection: `REDIS_URL` env var (default `redis://localhost:6379`)
  - Client: `ioredis` 5.9
  - Client factory: `src/lib/redis.ts` → `createRedisConnection()`
  - Uses: BullMQ job storage, Socket.IO Redis adapter, settings pub-sub channel (`settings:changed`)
  - Config: AOF persistence, `maxmemory-policy noeviction`
  - Docker service: `ailawyer-redis`

## Authentication & Identity

**Auth Provider:**
- NextAuth.js v5 (beta) - Custom credentials-based authentication
  - Strategy: JWT sessions (edge-compatible)
  - Adapter: `@auth/prisma-adapter` (Prisma session persistence)
  - Provider: Credentials only (email + bcrypt password)
  - Config: `src/lib/auth.ts` (server), `src/lib/auth.config.ts` (edge/middleware)
  - JWT payload: `{ sub, role, kanzleiId, kontaktId (MANDANT only) }`
  - Login page: `/login`
  - Portal login: `/portal/login`

**RBAC:**
- 5 roles: `ADMIN`, `ANWALT`, `SACHBEARBEITER`, `SEKRETARIAT`, `MANDANT`
  - Permission matrix: `src/lib/rbac.ts` → `PERMISSIONS` object
  - Middleware: `src/middleware.ts` (Edge Runtime, JWT-only, excludes portal public routes)
  - Access control helpers: `requireAuth()`, `requireRole()`, `requirePermission()`, `requireAkteAccess()`
  - Akte access: direct assignment OR Dezernat membership (returns 404 not 403 to hide existence)

**Portal Invite Auth:**
- Invite-based activation for MANDANT users
  - Model: `PortalInvite` (crypto.randomUUID tokens)
  - Activation: `/portal/activate` route
  - Password reset: `/portal/passwort-reset` route

## Document Processing Services

**OnlyOffice Document Server:**
- Collaborative office document editing (DOCX, XLSX, PPTX, ODS, etc.)
  - Docker service: `ailawyer-onlyoffice` (`onlyoffice/documentserver:latest`, 4GB RAM limit)
  - Public URL: `ONLYOFFICE_URL` env var (browser-accessible, default `http://localhost:8080`)
  - Internal URL: `ONLYOFFICE_INTERNAL_URL` env var (Docker-to-Docker, default `http://onlyoffice:80`)
  - Auth: JWT-signed editor configs (`ONLYOFFICE_SECRET` env var, `jsonwebtoken` npm)
  - Client: `src/lib/onlyoffice.ts` (config builder, JWT signer, PDF conversion)
  - React component: `@onlyoffice/document-editor-react` v2.1.1
  - CORS: `src/app/api/onlyoffice/` routes allow `Access-Control-Allow-Origin: *`
  - Required Docker flags: `ALLOW_PRIVATE_IP_ADDRESS: "true"`, `ALLOW_META_IP_ADDRESS: "true"`
  - App callback URL: `APP_INTERNAL_URL` env var (OnlyOffice → Next.js, default `http://app:3000`)
  - Endpoints: `/api/onlyoffice/download/[id]` (file fetch), `/api/onlyoffice/callback` (save hook)

**Stirling-PDF:**
- OCR and document conversion service
  - Docker service: `ailawyer-stirling-pdf` (`stirlingtools/stirling-pdf:latest-fat`, 4GB RAM limit)
  - URL: `STIRLING_PDF_URL` env var (default `http://stirling-pdf:8080`)
  - Client: `src/lib/ocr/stirling-client.ts`
  - Operations: OCR PDFs (`/api/v1/misc/ocr-pdf`), convert office docs to PDF, convert images to PDF
  - OCR languages: German (`deu`) + English (`eng`) via Tesseract
  - Triggered by: `document-ocr` BullMQ queue

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry, Datadog, or similar)

**Logs:**
- Pino structured logging (`src/lib/logger.ts`)
  - Development: `pino-pretty` (colored, human-readable stdout)
  - Production: `pino/file` (stdout) + `pino-roll` (daily rotating files at `LOG_FILE_PATH`)
  - Log level: `LOG_LEVEL` env var (default `info`)
  - Log path: `LOG_FILE_PATH` env var (default `/var/log/ai-lawyer/app`)
  - Pattern: `const log = createLogger("module-name")`

**Health Checks:**
- Endpoint: `GET /api/health`
- Checks: PostgreSQL, Redis, MinIO, Meilisearch, OnlyOffice, Ollama, Stirling-PDF
- Used by Docker Compose healthcheck (`GET /api/health`)

**Queue Monitoring:**
- Bull Board UI via Hono adapter (`@bull-board/api`, `@bull-board/hono`)
- Admin-only access

## Real-Time Communication

**WebSockets:**
- Socket.IO 4.8 attached to custom Node.js HTTP server (`src/server.ts`)
- Redis adapter for cross-process pub/sub (`@socket.io/redis-adapter`)
- Worker emits via Redis emitter (`@socket.io/redis-emitter`, `src/lib/socket/emitter.ts`)
- Rooms: `user:{userId}`, `akte:{akteId}`, `role:{roleName}`
- Auth: JWT middleware in `src/lib/socket/auth.ts`
- Portal: 10-second polling (no Socket.IO in portal)

## CI/CD & Deployment

**Hosting:**
- Self-hosted Docker Compose (9 containers)
- Production build: Next.js standalone output + esbuild-bundled `server.ts` and `worker.ts`

**CI Pipeline:**
- Not detected (no GitHub Actions, CircleCI, or similar config)

## Email Infrastructure

**IMAP (Inbound):**
- `imapflow` - Persistent IMAP connections managed via `src/lib/email/imap/connection-manager.ts`
- Supports PLAIN and OAuth2 auth (`EmailAuthTyp`)
- Per-mailbox worker started at worker boot, gracefully stopped on SIGTERM

**SMTP (Outbound):**
- `nodemailer` - Email sending via `src/lib/email/smtp/`
- Transport pool: `src/lib/email/smtp/transport-factory.ts`
- Queued via `email-send` BullMQ queue (max 3 concurrent sends)
- Encryption key: `EMAIL_ENCRYPTION_KEY` env var (32-char key for credential encryption at rest)

## Background Job Queues (19 Named Queues)

All backed by Redis via BullMQ. Queue definitions in `src/lib/queue/queues.ts`.

| Queue Name | Purpose | Concurrency |
|---|---|---|
| `test` | Dev/test verification | 5 |
| `frist-reminder` | Daily deadline reminder scan | 1 (singleton cron) |
| `email-send` | Outgoing SMTP dispatch | 3 |
| `email-sync` | On-demand IMAP sync | 2 |
| `document-ocr` | Stirling-PDF OCR | 1 (memory-heavy) |
| `document-preview` | OnlyOffice → PDF preview | 2 |
| `document-embedding` | Ollama embedding generation | 1 (GPU-bound) |
| `ai-scan` | AI document scan | 1 (sequential, rate limit) |
| `ai-briefing` | Daily AI briefing per lawyer | 1 |
| `ai-proactive` | Proactive AI akte analysis | 1 |
| `gesetze-sync` | GitHub → law text sync | 1 (daily cron 02:00) |
| `ner-pii` | NER-based PII detection | 1 (GPU-bound) |
| `urteile-sync` | BMJ RSS → court decisions | 1 (daily cron 03:00) |
| `muster-ingestion` | Template/document ingestion | 2 |
| `helena-task` | Helena AI agent tasks (2min lock) | 1 |
| `akte-embedding` | Akte summary embedding refresh | 1 (daily cron 02:30) |
| `scanner` | Nightly alert scanner | 1 (singleton cron) |
| `gamification` | XP/quest/boss events | 3 |
| `portal-notification` | Portal email notifications | 2 |

## Legal Standards & File Formats

**XJustiz:**
- German court electronic file format (versions 3.4.1–3.5.1)
- Parser: `src/lib/xjustiz/parser.ts` (via `fast-xml-parser`)
- No external API — parses uploaded XML files

**SEPA:**
- SEPA XML export for payment batches
- Library: `sepa` 2.1 npm package
- Implementation: `src/lib/finance/export/sepa.ts`
- Endpoint: `POST /api/finanzen/export/sepa`

**E-Rechnung (XRechnung / ZUGFeRD):**
- EN16931 compliant e-invoice generation
- Library: `@e-invoice-eu/core` 2.3.x
- Implementation: `src/lib/finance/invoice/e-rechnung.ts`
- Output: XRechnung CII XML + ZUGFeRD PDF/A-3 with embedded XML

**DATEV Export:**
- German accounting software export format
- Implementation: `src/lib/finance/export/datev.ts`
- Endpoint: `GET /api/finanzen/export/datev`

**CAMT Banking Import:**
- ISO 20022 CAMT.053 bank statement XML parsing
- Parser: `src/lib/finance/banking/camt-parser.ts` (via `fast-xml-parser`)
- Also supports CSV bank statement import (`src/lib/finance/banking/csv-parser.ts`)

## Webhooks & Callbacks

**Incoming:**
- `/api/onlyoffice/callback` - OnlyOffice document save callbacks (POST, JWT-verified)
  - Triggered by OnlyOffice Docker container when document is saved
  - Handles save (status 2), force-save (status 6), edit session end
- `/api/openclaw/*` - OpenClaw AI agent gateway (Bearer token auth)

**Outgoing:**
- Email via SMTP (nodemailer) - outgoing mail from configured kanzlei accounts
- BMJ RSS feed fetches (outgoing HTTP GET, daily cron)
- GitHub API fetches (outgoing HTTP GET, daily cron)

## Environment Configuration

**Required env vars (production):**
```
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
AUTH_TRUST_HOST
REDIS_URL
MINIO_ENDPOINT
MINIO_PORT
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
MINIO_BUCKET
MINIO_USE_SSL
MINIO_PUBLIC_URL
MEILISEARCH_URL
MEILISEARCH_API_KEY
EMAIL_ENCRYPTION_KEY
ONLYOFFICE_URL
ONLYOFFICE_INTERNAL_URL
ONLYOFFICE_SECRET
APP_INTERNAL_URL
STIRLING_PDF_URL
OLLAMA_URL
LOG_LEVEL
LOG_FILE_PATH
```

**Optional env vars:**
```
OPENCLAW_GATEWAY_TOKEN   # AI agent gateway (omit to disable)
GITHUB_TOKEN             # GitHub API auth (60 req/hr without, 5000 with)
WORKER_CONCURRENCY       # BullMQ default concurrency (default: 5)
```

**Secrets storage:**
- All secrets in Docker Compose env vars (not committed)
- Email credentials encrypted at rest using `EMAIL_ENCRYPTION_KEY` (AES, stored in DB)
- No secrets management system (Vault, AWS Secrets Manager, etc.) detected

---

*Integration audit: 2026-03-04*
