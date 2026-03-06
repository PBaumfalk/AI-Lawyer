# Phase 54 Smoke Tests

**Purpose:** Reproducible manual smoke-test checklist for verifying a clean `docker compose up` deploy.
**Acceptance gate for:** STAB-03 / STAB-04
**Created:** 2026-03-06

---

## Smoke Tests

### Section 1 — Pre-flight Checks (Automated, run before `docker compose up`)

Run these checks on the host before starting the stack. All three must pass.

| Test ID | Description | Command | Expected result |
|---------|-------------|---------|-----------------|
| PF-01 | TypeScript compile check | `npx tsc --noEmit` | Exit 0, no output |
| PF-02 | Next.js production build | `npx next build` | Exit 0, "Route (app) ..." output, no errors |
| PF-03 | Unit/integration test suite (NER excluded) | `npx vitest run --exclude tests/pii` | All tests pass (exit 0) |

**Note on PF-03:** `tests/pii/ner-filter.acceptance.test.ts` is excluded because it requires a live Ollama instance with the `qwen3.5:35b` model. The 10 NER failures in a full `vitest run` are expected and by design (see 54-TRIAGE.md D-01).

---

### Section 2 — Docker Compose Health Matrix

Run after `docker compose up -d`. Wait at least 120 seconds for all services to reach healthy state (OnlyOffice and Stirling-PDF have 60s `start_period`).

#### Individual Service Checks

| Service | Container | Verify command | Expected |
|---------|-----------|----------------|----------|
| PostgreSQL | ailawyer-db | `docker inspect ailawyer-db --format '{{.State.Health.Status}}'` | `healthy` |
| Redis | ailawyer-redis | `docker inspect ailawyer-redis --format '{{.State.Health.Status}}'` | `healthy` |
| MinIO | ailawyer-minio | `docker inspect ailawyer-minio --format '{{.State.Health.Status}}'` | `healthy` |
| Meilisearch | ailawyer-meilisearch | `docker inspect ailawyer-meilisearch --format '{{.State.Health.Status}}'` | `healthy` |
| OnlyOffice | ailawyer-onlyoffice | `docker inspect ailawyer-onlyoffice --format '{{.State.Health.Status}}'` | `healthy` |
| Stirling-PDF | ailawyer-stirling-pdf | `docker inspect ailawyer-stirling-pdf --format '{{.State.Health.Status}}'` | `healthy` |
| Ollama | ailawyer-ollama | `docker inspect ailawyer-ollama --format '{{.State.Health.Status}}'` | `healthy` |
| App | ailawyer-app | `docker inspect ailawyer-app --format '{{.State.Health.Status}}'` | `healthy` |
| Worker | ailawyer-worker | `docker inspect ailawyer-worker --format '{{.State.Running}}'` | `true` (no healthcheck — see TRIAGE C-01) |

#### Aggregate Check Script

Run all service checks at once:

```bash
echo "=== Docker Service Health Check ==="
for c in ailawyer-db ailawyer-redis ailawyer-minio ailawyer-meilisearch ailawyer-onlyoffice ailawyer-stirling-pdf ailawyer-ollama ailawyer-app; do
  status=$(docker inspect $c --format '{{.State.Health.Status}}' 2>/dev/null || echo "not_found")
  echo "$c: $status"
done
# Worker has no healthcheck — check running state separately:
docker inspect ailawyer-worker --format 'ailawyer-worker (running): {{.State.Running}}' 2>/dev/null
```

**Expected output (all services ready):**
```
=== Docker Service Health Check ===
ailawyer-db: healthy
ailawyer-redis: healthy
ailawyer-minio: healthy
ailawyer-meilisearch: healthy
ailawyer-onlyoffice: healthy
ailawyer-stirling-pdf: healthy
ailawyer-ollama: healthy
ailawyer-app: healthy
ailawyer-worker (running): true
```

**Failure diagnosis:**
- `starting` — wait longer (services with `start_period: 60s` may take up to 120s)
- `unhealthy` — `docker logs <container> --tail 50` to diagnose
- `not_found` — container did not start; check `docker compose ps -a` for exit codes

#### Service-specific Healthcheck Notes

| Service | Healthcheck details | Notes |
|---------|--------------------|----|
| Stirling-PDF | `curl -f http://localhost:8080/api/v1/info/status` (internal port 8080) | App env uses `http://stirling-pdf:8080` via Docker network — port matches. Verified correct. |
| OnlyOffice | `curl -f http://localhost/healthcheck` (internal port 80, exposed as 8080:80) | App env uses `http://onlyoffice:80` internally. Verified correct. |
| Worker | No healthcheck (TRIAGE C-01 — fix in 54-02) | Until C-01 is resolved, check worker via `docker logs ailawyer-worker --tail 20` to confirm BullMQ workers are registered |

---

### Section 3 — App Functional Smoke Tests

Run after all services show `healthy` / `running`.

| Test ID | Description | Command | Expected result | Failure diagnosis |
|---------|-------------|---------|-----------------|-------------------|
| ST-01 | Health endpoint status | `curl -s http://localhost:3000/api/health \| jq .status` | `"ok"` or `"degraded"` (never `503`) | 503 = app not ready; check `docker logs ailawyer-app --tail 50`. `"degraded"` = one or more non-critical services unavailable (acceptable) |
| ST-02 | Health endpoint services list | `curl -s http://localhost:3000/api/health \| jq .` | JSON with `services` object listing database, redis, minio, meilisearch, onlyoffice, stirlingPdf, ollama, worker | Missing services = check individual container health. Worker listed as unhealthy = see C-01 in TRIAGE |
| ST-03 | Login page accessible | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login` | `200` | `500` = app crash; check logs. `301`/`302` = redirect (follow with `-L`, expect 200 at final URL) |
| ST-04 | API returns JSON (not crash page) | `curl -s http://localhost:3000/api/health \| python3 -c "import sys,json; json.load(sys.stdin); print('valid JSON')"` | `valid JSON` | HTML response = Next.js error page; app is running but health route is broken |
| ST-05 | Worker alive via health endpoint | `curl -s http://localhost:3000/api/health \| jq '.services.worker'` | `{"status":"ok"}` or similar (not null) | If worker shows unhealthy: `docker logs ailawyer-worker --tail 50` — look for BullMQ worker registration errors or DB connection failures |

#### Full deploy verification one-liner

```bash
echo "--- Pre-checks ---" && \
echo "Health status: $(curl -s http://localhost:3000/api/health | jq -r .status)" && \
echo "Login page: HTTP $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login)" && \
echo "--- Docker health ---" && \
for c in ailawyer-db ailawyer-redis ailawyer-minio ailawyer-meilisearch ailawyer-onlyoffice ailawyer-stirling-pdf ailawyer-ollama ailawyer-app; do \
  echo "$c: $(docker inspect $c --format '{{.State.Health.Status}}' 2>/dev/null || echo not_found)"; \
done && \
echo "ailawyer-worker: $(docker inspect ailawyer-worker --format '{{.State.Running}}' 2>/dev/null || echo not_found) (running)"
```

---

## Known Limitations (as of Phase 54 audit)

| Item | Description | Tracked in |
|------|-------------|------------|
| Worker no healthcheck | Worker status can only be verified via `docker inspect ... Running` or `docker logs` | TRIAGE C-01, fix in 54-02 |
| NER tests require Ollama | `tests/pii/ner-filter.acceptance.test.ts` always fails without live Ollama + qwen3.5:35b model | TRIAGE D-01 |
| OnlyOffice slow start | Takes 60-120s to reach `healthy`; patience required after fresh deploy | By design — `start_period: 60s` |
| Ollama GPU optional | `ailawyer-ollama` healthcheck uses `ollama list`; works without GPU but AI features require a pulled model | Operational concern |

---

## Checklist (copy-paste for deploy verification)

```
[ ] PF-01: npx tsc --noEmit → 0 errors
[ ] PF-02: npx next build → exit 0
[ ] PF-03: npx vitest run --exclude tests/pii → all pass
[ ] Wait 120s after docker compose up -d
[ ] ailawyer-db: healthy
[ ] ailawyer-redis: healthy
[ ] ailawyer-minio: healthy
[ ] ailawyer-meilisearch: healthy
[ ] ailawyer-onlyoffice: healthy
[ ] ailawyer-stirling-pdf: healthy
[ ] ailawyer-ollama: healthy
[ ] ailawyer-app: healthy
[ ] ailawyer-worker: running (true)
[ ] ST-01: /api/health → status "ok" or "degraded"
[ ] ST-02: /api/health → services object present
[ ] ST-03: /login → HTTP 200
[ ] ST-04: /api/health → valid JSON
[ ] ST-05: worker service visible in health response
```
