# Phase 10: Docker Build Fix - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the Docker production build so it compiles without errors and all services run. Resolve webpack build errors, ensure all services start and pass health checks, and verify the application is reachable with working login. No new features — just make the existing codebase build and run in Docker.

</domain>

<decisions>
## Implementation Decisions

### Docker Deployment Strategy

**Service health:**
- All services required — app reports unhealthy if any service fails its health check
- Always full stack — no profiles, all services run every time with `docker compose up`

**Startup & lifecycle:**
- `depends_on` with health checks for service ordering (postgres/redis healthy before app/worker)
- Restart policy: `unless-stopped`
- Ollama models auto-pulled on startup via environment variable `OLLAMA_MODELS`
- Worker auto-registers all job processors on startup
- Prisma migrations run on app startup (entrypoint)
- Conditional seed — only if no users exist
- Meilisearch indexes auto-created on app startup

**Infrastructure:**
- Single Docker network — all services communicate by service name (Docker DNS)
- Named volumes for persistent data (postgres, minio, meilisearch)
- Redis persists with AOF (append-only file) in a volume
- Ollama runs inside Docker (part of compose)
- pgvector: use official `pgvector/pgvector:pg16` image
- OnlyOffice: volume-backed for persistent editing sessions
- Worker runs in same container as app (not separate)

**Networking & proxy:**
- Nginx reverse proxy for SSL and routing
- Self-signed certs for local development
- WebSocket proxy configured for OnlyOffice and real-time features
- MinIO files served through app API proxy (`/api/files/[id]`)
- Direct port exposure behind nginx

**Configuration:**
- `.env` file for secrets (gitignored), `.env.example` documenting all vars
- Setup script (`scripts/setup.sh` or `make setup`) for first-run: copies .env.example, generates JWT/NextAuth secrets, validates prerequisites
- Makefile for common operations (build, up, down, logs, rebuild, clean)
- Environment variable for Ollama model list
- Separate compose files: `docker-compose.yml` (prod) + `docker-compose.dev.yml` (dev with hot-reload, debug port 9229)
- `ailawyer-` container name prefix

**Build:**
- Single-stage Dockerfile (not multi-stage)
- BuildKit enabled for cache mounts
- Optimize layers: copy package*.json first, npm ci, then copy source
- `npm ci` for reproducible installs
- Explicit `npx prisma generate` step
- Fail build on tsc/eslint errors
- `npm audit` during build (warn, don't fail)
- Comprehensive `.dockerignore` (exclude .git, node_modules, dist, .planning, .env, *.md, .vscode)
- HEALTHCHECK instruction in Dockerfile (`curl /api/health`)
- Fail-fast on missing required environment variables in entrypoint
- Pin major versions of base images (e.g., `node:20-slim`)

**Image & platform:**
- Multi-platform builds (linux/amd64 + linux/arm64)
- Git-based image tags (commit hash or branch name)
- No container registry — local builds only
- Explicit `docker compose build` required (no auto-rebuild on up)
- Display build time and image size after build
- Docker Compose V2 only (`docker compose`, no hyphen)

**Security & ops:**
- Non-root user in app container
- UTC timezone in all containers
- Structured JSON logging to stdout
- Log rotation: max-size 10m, max-file 3
- Deep health check endpoint (`/api/health`) — checks postgres, redis, minio, ollama status
- Optional GPU support for Ollama (deploy.resources.reservations.devices, falls back to CPU)
- No monitoring stack (Prometheus/Grafana) — logs + health checks only
- No DB GUI (pgAdmin) in compose
- Backups handled outside Docker (manual pg_dump)

**Additional services:**
- MailHog for dev email catching
- LanguageTool moved to core services (always runs)

### KI-Chat (Helena) Verification Criteria

**Minimum viable:**
- Chat + RAG + quality — Helena responds with document context and legally relevant answers
- Inline source citations: `[Vertrag vom 15.03, S.3]`
- 60-second timeout for CPU-only Ollama responses
- If RAG fails, Helena still responds from general knowledge (subtle indicator that document context unavailable)

**Chat features:**
- Streaming responses (tokens appear as generated)
- Persist chat history across sessions (saved to DB)
- Multiple conversation threads per Akte (sidebar with conversation list, New Chat button)
- Rich markdown formatting in responses (headings, lists, bold, code blocks)
- Regenerate button on each Helena response
- Message editing with conversation branching from edit point
- Thumbs up/down feedback per response
- Auto-summarize older messages when approaching token limit
- Export conversation to PDF

**Persona & behavior:**
- Legal persona system prompt: "Du bist Helena, eine KI-Rechtsassistentin..."
- German language only (always responds in German)
- No AI disclaimer (users are lawyers, they know)
- Full Akte context in system prompt (Rechtsgebiet, Beteiligte, Aktenzeichen, Status)
- Rechtsgebiet-specific prompt templates (different instructions per legal area)
- Full actions capability: draft Schriftsaetze, create Fristenlisten, generate Mandantenanschreiben
- Generated documents presented in chat first with "In Akte speichern" button
- Predefined prompt templates as quick action chips: Zusammenfassung, Fristen, Beteiligte, Risikobewertung
- Collapsible "thinking mode" showing reasoning process

**Access & visibility:**
- Both global sidebar (context-aware) + dedicated Akte tab
- RAG scope: user-switchable toggle between "Nur diese Akte" and "Alle Akten"
- Chat messages shared per Akte (all team members see same history)
- Role-based access (RBAC): Anwalt full access, Sachbearbeiter basic queries, Praktikant read-only
- Admin-configurable LLM model selection
- Multi-provider support: Ollama + OpenAI + Anthropic
- Token usage tracking per user/Akte/month
- No file attachments in chat — documents uploaded via Dokumente tab
- No voice input for now

### Post-Fix Validation

**Smoke test scope:**
- All services must be healthy (no exceptions)
- Login works + multi-role RBAC test (Admin, Anwalt, Sachbearbeiter)
- KI-Chat sends/receives messages with RAG
- Document upload to MinIO works
- Akte CRUD with Beteiligte
- OnlyOffice: open and edit a document
- Meilisearch: functional search test (create Akte, verify it appears in search)
- Worker: upload PDF, verify OCR job processes
- Stirling PDF: functional conversion test
- Email: trigger test email, verify in MailHog

**Documentation:**
- Written SMOKE-TEST.md with step-by-step checklist
- Test results logged per run (date + pass/fail per item)
- Sign-off by developer + one peer

**Stability:**
- 24h soak test after smoke test passes
- Monitor: container restart counts + error log scan
- No performance benchmarks for Phase 10

**Safety:**
- Rollback guide documented (revert image, database rollback, emergency procedures)

### Build Pipeline Hardening

- No CI/CD pipeline for Phase 10 (manual builds)
- Makefile includes `clean` target to remove all Docker artifacts
- Build info displayed after build (duration + image size)

### Claude's Discretion
- Exact resource limits per service (memory/CPU)
- Webpack error resolution approach
- nginx configuration details
- Makefile target names and structure
- Setup script implementation details
- Health check endpoint response format

</decisions>

<specifics>
## Specific Ideas

- Worker and app in same container (user preference to reduce service count)
- LanguageTool promoted from full profile to core service
- KI-Chat Helena modeled after ChatGPT UX (threads, regenerate, edit, thinking mode)
- Legal persona with Rechtsgebiet-specific prompts for domain expertise

</specifics>

<deferred>
## Deferred Ideas

- Voice input for Helena (speech-to-text) — future phase
- CI/CD pipeline with GitHub Actions — infrastructure phase
- Container registry (GHCR) — infrastructure phase
- Prometheus + Grafana monitoring — operations phase
- Performance benchmarks — optimization phase
- Docker image security scanning (trivy) — security phase

</deferred>

---

*Phase: 10-docker-build-fix*
*Context gathered: 2026-02-25*
