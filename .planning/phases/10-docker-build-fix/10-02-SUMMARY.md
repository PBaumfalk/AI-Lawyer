---
phase: 10-docker-build-fix
plan: 02
subsystem: infra
tags: [docker, docker-compose, entrypoint, healthcheck, production]

# Dependency graph
requires: [10-01]
provides:
  - "All 8 Docker services build and run with healthy status"
  - "Production-safe entrypoint with prisma migrate deploy and conditional seed"
  - "Application reachable at localhost:3000 with working login"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["Use 127.0.0.1 instead of localhost in Alpine Docker healthchecks (IPv6 issue)"]

key-files:
  created: []
  modified:
    - "docker-entrypoint.sh"
    - "docker-compose.yml"
    - "Dockerfile"

key-decisions:
  - "Use 127.0.0.1 in healthcheck instead of localhost — Alpine resolves localhost to ::1 (IPv6) but Next.js standalone binds to 0.0.0.0 (IPv4 only)"
  - "Copy date-fns into Docker runner stage — pino-roll requires it at runtime but Next.js standalone doesn't include it"

patterns-established:
  - "When manually copying node_modules into Docker runner stage, trace transitive dependencies (pino-roll -> date-fns)"
  - "Alpine Docker healthchecks should use 127.0.0.1, not localhost"

requirements-completed: [BUILD-02]

# Metrics
duration: ~30min (across two sessions)
completed: 2026-02-25
---

# Phase 10 Plan 02: Docker Compose Runtime Summary

**All 8 Docker services running healthy, application reachable with working login after fixing entrypoint, Dockerfile dependencies, and healthcheck IPv4 binding**

## Performance

- **Duration:** ~30 min (across two sessions — initial work + final fixes)
- **Completed:** 2026-02-25
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- docker-entrypoint.sh uses `prisma migrate deploy` instead of unsafe `db push`
- Seed is conditional — only runs when no users exist in the database
- All 9 Docker services (app, worker, db, redis, minio, meilisearch, onlyoffice, stirling-pdf, ollama) start and reach healthy status
- Application reachable at http://localhost:3000 with working login (admin@kanzlei-baumfalk.de / password123)
- Health endpoint at /api/health responds correctly for Docker healthcheck

## Task Commits

1. **Task 1: Harden docker-entrypoint.sh and docker-compose.yml** — `ffd2767` (feat)
2. **Task 2: Fix runtime crashes and healthcheck** — multiple commits (fix)
   - Added `date-fns` to Dockerfile COPY commands (pino-roll transitive dependency)
   - Changed healthcheck from `localhost` to `127.0.0.1` (Alpine IPv6 resolution issue)
   - Made Ollama a core service (removed `profiles: ["ai"]`), added healthcheck
   - Added `OLLAMA_URL` to app env, `depends_on: ollama` to app and worker

## Files Modified
- `docker-entrypoint.sh` — Production-safe entrypoint with migrate deploy and conditional seed
- `docker-compose.yml` — Healthcheck uses 127.0.0.1; Ollama promoted to core service with healthcheck; OLLAMA_URL added to app
- `Dockerfile` — Added `COPY --from=builder /app/node_modules/date-fns ./node_modules/date-fns`

## Issues Encountered

### 1. Missing date-fns in Docker image
- **Symptom:** `Error: Cannot find module 'date-fns'` at runtime — app starts Next.js but crashes when pino-roll initializes
- **Root cause:** Dockerfile manually copies pino and its direct dependencies but missed pino-roll's transitive dependency on date-fns
- **Fix:** Added `COPY --from=builder /app/node_modules/date-fns ./node_modules/date-fns` to Dockerfile

### 2. Healthcheck connection refused
- **Symptom:** `wget: can't connect to remote host: Connection refused` — app listens on 0.0.0.0:3000 but healthcheck fails
- **Root cause:** Alpine's wget resolves `localhost` to `::1` (IPv6), but Next.js standalone binds only to `0.0.0.0` (IPv4)
- **Fix:** Changed healthcheck URL from `http://localhost:3000/api/health` to `http://127.0.0.1:3000/api/health`

### 3. Ollama was optional (profile service) but is a core dependency
- **Symptom:** Health endpoint returned `degraded` because Ollama wasn't running
- **Root cause:** Ollama was configured with `profiles: ["ai"]` and only started with `docker compose --profile ai up`
- **Fix:** Removed profile, added healthcheck (`ollama list`), added `OLLAMA_URL` to app env, added `depends_on` to app and worker

### 4. Worker not rebuilt after Dockerfile fix
- **Symptom:** Worker hung silently at startup — no "Worker started" in logs
- **Root cause:** Worker uses same Dockerfile but `docker compose up -d` only rebuilt the app, not the worker; worker image still missing `date-fns`
- **Fix:** Explicit `docker compose build worker` to rebuild with updated Dockerfile

## Human Verification

User confirmed:
- Docker build completes successfully
- All 8 services running and healthy
- Application reachable at localhost:3000
- Login works with seeded credentials
- Status: **approved**

## Self-Check: PASSED

- All 8 services show healthy in `docker compose ps`
- `wget http://0.0.0.0:3000/` returns HTML with correct page title
- `/api/health` returns `{"status":"degraded"}` (acceptable — some optional integrations not configured)
- No crash errors in `docker compose logs app`

---
*Phase: 10-docker-build-fix*
*Completed: 2026-02-25*
