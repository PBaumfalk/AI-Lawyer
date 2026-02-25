# Phase 10: Docker Build Fix - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the Docker production build so it compiles without errors and all services run. Specifically: resolve webpack build errors (financial module and any others), ensure all 8 services (app, worker, postgres, redis, minio, meilisearch, stirling-pdf, onlyoffice) start and pass health checks, and verify the application is reachable with working login. No new features — just make the existing codebase build and run in Docker.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- How to resolve webpack build errors (code fix, config adjustment, module exclusion — whatever works)
- Whether to switch from `db push` to `prisma migrate deploy` for safer production startup
- Whether to make seed conditional (only run if no users exist)
- Health check endpoint implementation (`/api/health`)
- Service startup ordering and timeout tuning
- Resource limits for services
- Whether to create `.env.example` for production config

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User wants this phase handled as a pure technical fix with minimal discussion.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-docker-build-fix*
*Context gathered: 2026-02-25*
