---
phase: 10-docker-build-fix
plan: 01
subsystem: infra
tags: [pino, next-build, docker, esbuild, standalone]

# Dependency graph
requires: []
provides:
  - "Working next build that exits 0 (compilation + page data collection + static generation)"
  - "Build-safe pino logger that defers file transport to runtime"
  - "Hardened next.config.mjs with top-level serverExternalPackages"
  - "Dockerfile with /var/log/ai-lawyer directory for pino-roll runtime"
  - ".dockerignore excluding .planning, dist-server, dist-worker"
affects: [10-02-docker-compose-runtime]

# Tech tracking
tech-stack:
  added: []
  patterns: ["NEXT_PHASE check to skip file-system operations during build"]

key-files:
  created:
    - ".dockerignore"
  modified:
    - "src/lib/logger.ts"
    - "next.config.mjs"
    - "Dockerfile"
    - "src/app/api/health/route.ts"

key-decisions:
  - "Use NEXT_PHASE env var to detect build-time SSR and skip pino-roll file transport"
  - "Move serverComponentsExternalPackages from experimental to top-level serverExternalPackages"
  - "Add force-dynamic to health route to prevent static generation timeout on Redis"

patterns-established:
  - "Build-phase guard: check process.env.NEXT_PHASE === 'phase-production-build' before file-system or network operations in server modules"
  - "API routes that connect to external services must export const dynamic = 'force-dynamic'"

requirements-completed: [BUILD-01]

# Metrics
duration: 6min
completed: 2026-02-25
---

# Phase 10 Plan 01: Next.js Build Fix Summary

**Build-safe pino logger with NEXT_PHASE guard, dynamic health route, and hardened next.config.mjs with top-level serverExternalPackages**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-25T18:37:14Z
- **Completed:** 2026-02-25T18:42:59Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Next.js production build completes all phases (compilation, page data collection, static generation) with exit code 0
- pino-roll file transport skipped during build via NEXT_PHASE environment variable check
- Migrated from deprecated experimental.serverComponentsExternalPackages to top-level serverExternalPackages
- esbuild server bundle (1.3MB) and worker bundle (8.3MB) created successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix pino logger to be build-safe** - `6ae3119` (fix)
2. **Task 2: Harden next.config.mjs and Dockerfile for production build** - `eb2ed49` (chore)

## Files Created/Modified
- `src/lib/logger.ts` - Added NEXT_PHASE guard to skip pino-roll during build
- `src/app/api/health/route.ts` - Added `export const dynamic = "force-dynamic"` to prevent static generation
- `next.config.mjs` - Moved to top-level serverExternalPackages, added 5 more Node-only packages
- `Dockerfile` - Added /var/log/ai-lawyer directory creation with correct ownership
- `.dockerignore` - Added .planning, dist-server, dist-worker exclusions

## Decisions Made
- Used `process.env.NEXT_PHASE === 'phase-production-build'` to detect build-time SSR -- this is set by Next.js internally and is the most reliable way to detect the build phase without custom environment variables.
- Added `force-dynamic` to health route because it imports Redis, BullMQ, and Prisma at the top level, causing static generation to hang on connection attempts during build.
- Added `@prisma/client`, `pdf-parse`, `imapflow`, `nodemailer`, `pino-pretty` to serverExternalPackages to prevent webpack from bundling Node-only modules.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added force-dynamic to health route**
- **Found during:** Task 1 (Fix pino logger)
- **Issue:** After fixing the pino logger, `next build` still failed with a timeout during static page generation for `/api/health`. The route imports Redis, BullMQ testQueue, and Prisma at the top level, causing connection attempts that hang when services are not running.
- **Fix:** Added `export const dynamic = "force-dynamic"` to `src/app/api/health/route.ts` to skip static generation for this route.
- **Files modified:** src/app/api/health/route.ts
- **Verification:** `next build` completes with exit code 0, health route shown as dynamic (f) in build output
- **Committed in:** 6ae3119 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary fix to unblock the build. Health endpoint is inherently dynamic (checks live services) so force-dynamic is the correct setting regardless.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `next build` completes successfully, enabling Docker image creation
- Plan 10-02 (Docker Compose runtime) can proceed with the working build artifacts
- `.next/standalone/`, `dist-server/index.js`, and `dist-worker/index.js` are all generated

## Self-Check: PASSED

- All 5 modified/created files exist on disk
- Both task commits (6ae3119, eb2ed49) found in git log
- `next build` exits 0 (verified twice)
- `.next/standalone/` exists
- `dist-server/index.js` exists (1.3MB)
- `dist-worker/index.js` exists (8.3MB)

---
*Phase: 10-docker-build-fix*
*Completed: 2026-02-25*
