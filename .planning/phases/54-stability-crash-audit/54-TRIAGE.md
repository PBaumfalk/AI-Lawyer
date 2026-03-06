# Phase 54 Crash Triage

**Audit date:** 2026-03-06
**Auditor:** gsd-executor (claude-sonnet-4-6)

---

## Status

TypeScript: **0 errors** (`npx tsc --noEmit` — clean compile)
Test suite: **417/427 passing** (10 failures = NER ECONNREFUSED to Ollama — by design, see D-01)

---

## Crashes

| ID | Title | Severity | Area | Status | Wave | Repro |
|----|-------|----------|------|--------|------|-------|
| C-01 | Worker service has no Docker healthcheck | P1 | Infra | Open | 54-02 | `docker compose ps` shows worker as running even after crash; `docker inspect ailawyer-worker --format '{{.State.Health.Status}}'` returns empty — no health gate exists |
| C-02 | OnlyOffice callback unauthenticated path | P1 | Security | Open | 54-02 | POST `/api/onlyoffice/callback?dokumentId=X` with no `Authorization` header and no `body.token` — falls through to full document processing without any auth check (route.ts:49-63) |
| C-03 | NER hardcoded model blocks embeddings when Ollama is offline | P1 | AI/Availability | Open | 54-02 | `src/lib/pii/ner-filter.ts:20` — `NER_MODEL = "qwen3.5:35b"` is a module-level constant; when Ollama is down, all document embedding pipeline calls fail with ECONNREFUSED. Affects: OCR post-processing, document indexing, ki-chat RAG |
| C-04 | Worker DDL race on concurrent startup | P2 | Infra | Open | Deferred | `src/worker.ts:960-980` — two workers starting simultaneously both attempt `CREATE INDEX IF NOT EXISTS akten_summary_embedding_hnsw`; one fails with "relation already exists"; error is caught and swallowed as a warning. Non-fatal in practice but causes misleading log noise |
| C-05 | In-memory health-alert cooldown resets on restart | P2 | Infra | Open | Deferred | `src/lib/health/alerts.ts:12` — module-level `Map<string, number>` for 60-min cooldown; any crash-loop or deploy causes a flood of health-alert emails to admins |
| C-06 | SMTP transport cache stale after credential change | P2 | Email | Open | Deferred | `src/lib/email/smtp/transport-factory.ts:34-36` — `invalidateTransport(kontoId)` is never called from `PUT /api/email-konten/[id]/route.ts`; stale SMTP credentials used until worker restart |
| C-07 | OnlyOffice version snapshot saves new content, not old | P2 | Documents | Open | Deferred | `src/app/api/onlyoffice/callback/route.ts:118-132` — comment confirms: "Save the new content as version snapshot too"; both the live file and the version snapshot contain the new content, not the pre-edit state |
| C-08 | Prisma $extends ENTWURF gate bypassed via updateMany | P2 | Compliance | Open | Deferred | `src/lib/db.ts:24-46` — `$extends` hook covers `dokument.update` but not `dokument.updateMany`; bulk status changes bypass the human-approval gate (BRAO §43a risk) |

---

## Silent Catch Survey

**Total `.catch(` calls in `src/` (excluding tests):** 187

**Sample analysis (first 20 hits):**

| Location | Pattern | Classification |
|----------|---------|----------------|
| `portal/.../upload/route.ts:132` | `.catch(err => console.error(...))` — notification after doc persisted | Acceptable: non-fatal, logged |
| `portal/invite/route.ts:176` | `.catch(() => {})` — audit log | Acceptable: fire-and-forget audit |
| `portal/invite/[id]/resend/route.ts:162` | `.catch(() => {})` — audit log | Acceptable: fire-and-forget audit |
| `portal/password-reset/confirm/route.ts:88` | `.catch(() => {})` — notification | Acceptable: fire-and-forget notification |
| `portal/activate/route.ts:144` | `.catch(() => {})` — notification | Acceptable: fire-and-forget notification |
| `email-konten/[id]/route.ts:153` | `startImapConnection(...).catch(() => {})` | **P2 concern**: IMAP reconnect failure silently swallowed — user gets no feedback if IMAP fails to reconnect after credential update |
| `kontakte/[id]/route.ts:197` | `.catch(() => {})` — Meilisearch re-index | Acceptable: search index update is non-critical |
| `kalender/route.ts:227,231` | `.catch(() => {})` — notifications | Acceptable: fire-and-forget |
| `ki-chat/route.ts:696` | `.catch(err => console.error..., return null)` | Acceptable: RAG degrades gracefully |
| `health/route.ts:216` | `checkAndAlertHealthStatus(...).catch(() => {})` | Acceptable: alert is fire-and-forget from health endpoint |
| `akten/.../naechste-schritte/route.ts:59` | `.catch(() => {}) // Fire-and-forget` | Acceptable: annotated |
| `akten/.../dokumente/neu/route.ts:38` | `req.json().catch(() => ({}))` | Acceptable: body parse fallback |
| `akten/.../dokumente/neu/route.ts:124` | `.catch(() => {})` | Acceptable: Meilisearch update non-critical |
| `akten/.../mandant-sichtbar/route.ts:86` | `.catch(() => {}) // Fire-and-forget` | Acceptable: annotated |

**Critical-path silent catches identified:** 1 (C-09 below — IMAP reconnect)

| ID | Title | Severity | Area | Status | Wave | Repro |
|----|-------|----------|------|--------|------|-------|
| C-09 | IMAP reconnect failure silently swallowed | P2 | Email | Open | Deferred | `src/app/api/email-konten/[id]/route.ts:153` — `startImapConnection(fullKonto).catch(() => {})` after credential update; if reconnect fails, user receives HTTP 200 but IMAP is silently broken |

---

## Deferred / Non-Crash Items

| ID | Title | Severity | Why deferred |
|----|-------|----------|--------------|
| D-01 | NER acceptance tests fail without live Ollama | INFO | By design — `tests/pii/ner-filter.acceptance.test.ts` tagged `requires-ollama`; ECONNREFUSED to port 11434 is the expected failure mode when Ollama is not running locally. Not a crash, not a regression. |
| D-02 | In-memory health-alert cooldown | P2 | Tech debt — alerts.ts uses module-level Map; resets on restart causes email flood. Not a crash but a nuisance post-deploy |
| D-03 | Worker DDL race on concurrent startup | P2 | Non-fatal — `CREATE INDEX IF NOT EXISTS` failure is caught and logged as warning; single-worker deployments are unaffected |
| D-04 | SMTP transport cache not invalidated | P2 | Not a crash; stale credentials = delivery failure, recoverable by restart |
| D-05 | OnlyOffice version snapshot saves wrong content | P2 | Data quality defect, not a crash |
| D-06 | Prisma updateMany bypasses ENTWURF gate | P2 | BRAO compliance concern; no current code path uses updateMany on Dokument status in production |
| D-07 | IMAP reconnect silent catch | P2 | Functional defect; IMAP can be manually reconnected via settings |
| D-08 | session.user as any in 68+ files | P3 | Type-safety debt, compiles cleanly, no runtime crash risk |
| D-09 | In-memory rate limiter in openclaw route | P3 | Affects multi-instance deploys; single-instance production unaffected |

---

## Docker Healthcheck Audit

| Service | Container | Healthcheck | Status |
|---------|-----------|-------------|--------|
| PostgreSQL | ailawyer-db | `pg_isready -U ailawyer` (5s interval) | Verified |
| Redis | ailawyer-redis | `redis-cli ping` (5s interval) | Verified |
| MinIO | ailawyer-minio | `mc ready local` (5s interval) | Verified |
| Meilisearch | ailawyer-meilisearch | `curl -f http://localhost:7700/health` (5s interval) | Verified |
| OnlyOffice | ailawyer-onlyoffice | `curl -f http://localhost/healthcheck` (10s interval, 60s start) | Verified |
| Stirling-PDF | ailawyer-stirling-pdf | `curl -f http://localhost:8080/api/v1/info/status` (30s interval, 60s start) | Verified — internal port 8080 is correct; app uses `http://stirling-pdf:8080` via Docker network, also correct |
| Ollama | ailawyer-ollama | `ollama list` (10s interval) | Verified |
| App | ailawyer-app | `wget -q --spider http://127.0.0.1:3000/api/health` (30s interval, 60s start) | Verified |
| Worker | ailawyer-worker | **NO HEALTHCHECK** | **P1 — C-01** — worker can crash silently; Docker reports "running" with no health gate |

---

## Fix Wave Assignment

### Wave 54-02 (P0/P1 — immediate fixes):

- C-01: Add Docker healthcheck to worker service
- C-02: Enforce mandatory JWT auth on OnlyOffice callback
- C-03: Make NER model configurable / fall back gracefully when Ollama offline

### Deferred to future milestone (P2/P3):

- C-04 (D-03): Worker DDL race on concurrent startup
- C-05 (D-02): In-memory health-alert cooldown — migrate to Redis TTL key
- C-06 (D-04): SMTP transport cache invalidation
- C-07 (D-05): OnlyOffice version snapshot saves wrong content
- C-08 (D-06): Prisma updateMany bypasses ENTWURF gate
- C-09 (D-07): IMAP reconnect silent catch
- D-08: session.user as any type safety
- D-09: In-memory rate limiter (multi-instance issue)
