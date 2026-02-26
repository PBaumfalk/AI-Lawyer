# External Integrations

**Analysis Date:** 2025-02-24

## APIs & External Services

**Document Editing:**
- ONLYOFFICE Document Server - Browser-based office suite (Word, Excel, Powerpoint)
  - SDK/Client: `@onlyoffice/document-editor-react` 2.1.1
  - Auth: JWT signing with `ONLYOFFICE_SECRET`
  - Integration: `src/lib/onlyoffice.ts`
  - Endpoints:
    - Editor config: Internal config generation for document opening
    - Callback URL: `/api/onlyoffice/callback` (document save callbacks)
    - Conversion API: Internal server-to-server calls to ONLYOFFICE for PDF generation
  - URL config:
    - `ONLYOFFICE_URL` - External URL (for browser, e.g. `http://localhost:8080`)
    - `ONLYOFFICE_INTERNAL_URL` - Server-to-server URL (same or Docker network URL)
    - `APP_INTERNAL_URL` - URL that ONLYOFFICE uses to reach Next.js (Docker: `http://app:3000`)
  - Status: **Implemented** with component `src/components/editor/onlyoffice-editor.tsx`

**AI & Language Models:**
- Ollama - Local LLM inference server
  - Client: Direct HTTP/REST API calls (no SDK)
  - Integration: `src/lib/ai/ollama.ts`
  - Endpoint: `OLLAMA_BASE_URL` (default: `http://localhost:11434`)
  - Auth: None (local network, no auth required)
  - Available models: Configurable via `OLLAMA_DEFAULT_MODEL` (default: `mistral:7b`)
  - Context window: `OLLAMA_NUM_CTX` (default: 32768 tokens)
  - Use case: Task processing, document analysis
  - Status: **Integrated** with health check and generation API

- OpenAI API
  - Auth: `OPENAI_API_KEY` environment variable
  - Provider: Selectable via `AI_PROVIDER=openai`
  - Model: Configurable via `AI_MODEL` (e.g., `gpt-4o`)
  - Status: **Prepared** - env vars present, no implementation yet

- Anthropic API
  - Auth: `ANTHROPIC_API_KEY` environment variable
  - Provider: Selectable via `AI_PROVIDER=anthropic`
  - Model: Configurable via `AI_MODEL`
  - Status: **Prepared** - env vars present, no implementation yet

- OpenClaw AI Agent Gateway
  - Purpose: AI task orchestration and agent framework
  - Endpoint: `OPENCLAW_GATEWAY_URL` (default: `http://localhost:18789`)
  - Auth: `OPENCLAW_GATEWAY_TOKEN` (dev token in env)
  - Integration: `src/lib/openclaw-auth.ts`
  - Endpoints:
    - `/api/openclaw/tasks` - Retrieve/manage AI tasks
    - `/api/openclaw/drafts` - Handle AI-generated drafts
    - `/api/openclaw/process` - Process tasks through gateway
  - Status: **Integrated** with API routes (`src/app/api/openclaw/*`)

## Data Storage

**Databases:**
- PostgreSQL 16 with pgvector
  - Connection: `DATABASE_URL` (format: `postgresql://user:pass@host:5432/database`)
  - Client: `@prisma/client` 5.22.0 (Prisma ORM)
  - Schema: `prisma/schema.prisma` (single source of truth)
  - Extensions: pgvector for semantic vector search
  - Docker service: `db` (image: `pgvector/pgvector:pg16`)
  - Data volume: `pgdata`
  - Health check: `pg_isready` command

**File Storage:**
- MinIO (S3-compatible object storage)
  - Endpoint: `MINIO_ENDPOINT:MINIO_PORT` (default: `localhost:9000`)
  - Credentials: `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
  - Bucket: `MINIO_BUCKET` (default: `dokumente`)
  - Client SDK: `@aws-sdk/client-s3` with S3Client
  - Configuration: `forcePathStyle: true` for MinIO compatibility
  - Public URL: `MINIO_PUBLIC_URL` (for presigned download URLs)
  - Use: Document uploads, WYSIWYG exports, file attachments
  - Integration: `src/lib/storage.ts`
  - Functions:
    - `uploadFile()` - Upload with content type
    - `getDownloadUrl()` - Pre-signed URL (1 hour expiration)
    - `getFileStream()` - Stream file content
    - `deleteFile()` - Remove file
  - Docker service: `minio` with S3 API (9000) and console (9001)
  - Data volume: `miniodata`

**Search & Indexing:**
- Meilisearch - Full-text search engine
  - Endpoint: `MEILISEARCH_URL` (default: `http://localhost:7700`)
  - Auth: `MEILISEARCH_API_KEY`
  - Client SDK: `meilisearch` 0.55.0
  - Indexes:
    - `dokumente` - Document search (name, OCR text, tags, case reference)
  - Integration: `src/lib/meilisearch.ts`
  - Features:
    - Search documents by name, content, tags, case number
    - Filterable by: akteId, mimeType, ordner, tags, createdById
    - Sortable by: createdAt, name
  - Docker service: `meilisearch` (image: `getmeili/meilisearch:v1.11`)
  - Data volume: `meilidata`

**Caching:**
- None configured (prepared for future implementation)

## Authentication & Identity

**Auth Provider:**
- NextAuth.js v5 (Custom)
  - Implementation: `src/lib/auth.ts`
  - Strategy: JWT sessions
  - Provider: Credentials (username/password)
  - Database adapter: `@auth/prisma-adapter` with PostgreSQL
  - Password hashing: bcryptjs (salted)
  - Roles: ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT, PRAKTIKANT
  - Session persistence: Prisma User, Account, Session models
  - Callback: JWT enrichment with role and kanzleiId
  - Login page: `/login` (custom page route)

## Monitoring & Observability

**Error Tracking:**
- None detected (prepared for future implementation)

**Logs:**
- Console-based logging (logs appear in Docker container logs)
- Structured error logging in API routes
- No centralized log aggregation configured

## CI/CD & Deployment

**Hosting:**
- Self-hosted Docker Compose
- No cloud provider integration
- Deployment: Local/on-premise via `docker compose up`

**CI Pipeline:**
- None configured (GitHub Actions ready in directory structure)

## Environment Configuration

**Required env vars:**
```
# Database
DATABASE_URL=postgresql://ailawyer:ailawyer@db:5432/ailawyer?schema=public

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret-change-in-production-abc123xyz
AUTH_TRUST_HOST=true

# MinIO (S3 Storage)
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=ailawyer
MINIO_SECRET_KEY=ailawyer123
MINIO_BUCKET=dokumente
MINIO_USE_SSL=false
MINIO_PUBLIC_URL=http://localhost:9000

# Meilisearch
MEILISEARCH_URL=http://meilisearch:7700
MEILISEARCH_API_KEY=ailawyer-meili-key

# ONLYOFFICE
ONLYOFFICE_URL=http://localhost:8080
ONLYOFFICE_INTERNAL_URL=http://onlyoffice
ONLYOFFICE_SECRET=dev-onlyoffice-secret
APP_INTERNAL_URL=http://app:3000

# AI Models
AI_PROVIDER=openai|anthropic|ollama
AI_MODEL=gpt-4o|claude-3-opus|mistral:7b
OPENAI_API_KEY=(optional if using OpenAI)
ANTHROPIC_API_KEY=(optional if using Anthropic)
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_DEFAULT_MODEL=mistral:7b
OLLAMA_NUM_CTX=32768

# OpenClaw Gateway
OPENCLAW_GATEWAY_URL=http://openclaw-gateway:18789
OPENCLAW_GATEWAY_TOKEN=your-openclaw-token-change-in-production
```

**Secrets location:**
- `.env` file (local development, not committed)
- Docker Compose environment sections (production, change defaults before deployment)

## Webhooks & Callbacks

**Incoming:**
- ONLYOFFICE Callback: `/api/onlyoffice/callback` - Document save events (PUT)
- Not yet implemented, structure prepared

**Outgoing:**
- None currently configured
- beA integration planned for email notifications

## Multi-Provider AI Architecture

**Provider Selection:**
- `AI_PROVIDER` environment variable switches between:
  - `ollama` - Self-hosted local models
  - `openai` - OpenAI API
  - `anthropic` - Anthropic API

**Usage Pattern:**
- Process tasks via OpenClaw gateway when available
- Fall back to direct LLM API calls for simple operations
- Default configuration in `.env.example` shows full setup

---

*Integration audit: 2025-02-24*
