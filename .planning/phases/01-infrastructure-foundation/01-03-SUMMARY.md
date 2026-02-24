---
phase: 01-infrastructure-foundation
plan: 03
subsystem: admin
tags: [bullmq, bull-board, admin-dashboard, health-check, settings, redis-pubsub, pino-logs, rbac, shadcn-ui]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation/01
    provides: "Redis, BullMQ queues (ALL_QUEUES), health endpoint, SystemSetting Prisma model"
provides:
  - "Admin layout with ADMIN-role RBAC and sub-navigation"
  - "Job monitor page with queue summary and job explorer"
  - "System health dashboard with service status cards and auto-refresh"
  - "Log viewer with level/source filtering for structured pino logs"
  - "Runtime settings management UI with type-aware inputs"
  - "Settings CRUD service with Redis pub/sub propagation"
  - "Settings REST API with validation"
  - "Card, Switch, ScrollArea shadcn/ui components"
affects: [02, 03, 04, 05, 06, 07]

# Tech tracking
tech-stack:
  added: ["@radix-ui/react-switch"]
  patterns: [admin-layout-rbac, settings-crud-pubsub, json-api-over-bull-board, log-viewer-pattern]

key-files:
  created:
    - src/app/(dashboard)/admin/layout.tsx
    - src/app/(dashboard)/admin/jobs/page.tsx
    - src/app/(dashboard)/admin/settings/page.tsx
    - src/app/(dashboard)/admin/system/page.tsx
    - src/app/api/admin/jobs/[[...path]]/route.ts
    - src/app/api/admin/logs/route.ts
    - src/app/api/settings/route.ts
    - src/lib/settings/defaults.ts
    - src/lib/settings/service.ts
    - src/components/ui/card.tsx
    - src/components/ui/switch.tsx
    - src/components/ui/scroll-area.tsx
  modified:
    - src/components/layout/sidebar.tsx
    - package.json

key-decisions:
  - "Custom JSON API instead of Bull Board Hono adapter — HonoAdapter requires serveStatic which is complex in Next.js App Router; custom API is cleaner and more maintainable"
  - "Boolean settings auto-save on toggle (no explicit Save button needed)"
  - "Log viewer gracefully handles missing log files in development with informative message"

patterns-established:
  - "Admin layout: server component checks ADMIN role, redirects to /dashboard on unauthorized"
  - "Settings service: upsert + Redis pub/sub publish on update, initializeDefaults preserves user overrides"
  - "API route auth pattern: auth() + role check at top of each handler"

requirements-completed: [REQ-IF-001, REQ-IF-002]

# Metrics
duration: 6min
completed: 2026-02-24
---

# Phase 1 Plan 3: Admin Pages Summary

**Admin dashboard with job monitor, system health page, log viewer, runtime settings management, and RBAC-protected layout**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-24T08:25:18Z
- **Completed:** 2026-02-24T08:31:40Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Three admin pages (Job-Monitor, System, Einstellungen) with ADMIN-only access
- BullMQ job monitoring with queue summary cards, job explorer, retry/clean actions
- System health dashboard showing all service statuses with color-coded indicators and auto-refresh
- Log viewer parsing structured pino logs with level/source filtering
- Runtime settings CRUD with Redis pub/sub for immediate worker propagation
- Sidebar updated with Administration section visible only to ADMIN users

## Task Commits

Each task was committed atomically:

1. **Task 1: Create admin layout, Bull Board job monitor, and settings service** - `baf5b95` (feat)
2. **Task 2: Create system health page with log viewer and update sidebar navigation** - `8022e58` (feat)

## Files Created/Modified
- `src/app/(dashboard)/admin/layout.tsx` - Admin route layout with RBAC (ADMIN-only), sub-navigation
- `src/app/(dashboard)/admin/jobs/page.tsx` - Job monitor with queue summary cards and job explorer
- `src/app/(dashboard)/admin/system/page.tsx` - System health cards + structured log viewer
- `src/app/(dashboard)/admin/settings/page.tsx` - Runtime settings with type-aware inputs
- `src/app/api/admin/jobs/[[...path]]/route.ts` - Queue status JSON API with job CRUD
- `src/app/api/admin/logs/route.ts` - Structured log file reader with filtering
- `src/app/api/settings/route.ts` - Settings REST API (GET/PUT) with validation
- `src/lib/settings/defaults.ts` - Default runtime setting definitions
- `src/lib/settings/service.ts` - Settings CRUD + Redis pub/sub propagation
- `src/components/ui/card.tsx` - shadcn/ui Card component
- `src/components/ui/switch.tsx` - shadcn/ui Switch component
- `src/components/ui/scroll-area.tsx` - shadcn/ui ScrollArea component
- `src/components/layout/sidebar.tsx` - Added admin navigation section (ADMIN-only)

## Decisions Made
- Used custom JSON API instead of Bull Board Hono adapter: HonoAdapter requires a `serveStatic` function which is complex to wire up in Next.js App Router. The custom API approach provides the same functionality (queue listing, job counts, retry, clean) with cleaner integration.
- Boolean settings auto-save on toggle for better UX (no explicit save button needed for on/off switches).
- Log viewer returns an informative message when log files don't exist in development (pino-pretty outputs to stdout only in dev).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Bull Board Hono adapter replaced with custom JSON API**
- **Found during:** Task 1 (Bull Board integration)
- **Issue:** HonoAdapter constructor requires `serveStatic` function parameter (from @hono/node-server, hono/bun, etc.) which doesn't integrate cleanly with Next.js App Router's catch-all route pattern
- **Fix:** Built custom JSON API at /api/admin/jobs that queries BullMQ queues directly, providing queue listing, job browsing by status, retry, and clean operations. Built a matching custom UI on the admin page.
- **Files modified:** `src/app/api/admin/jobs/[[...path]]/route.ts`, `src/app/(dashboard)/admin/jobs/page.tsx`
- **Verification:** TypeScript compiles clean, API returns queue data correctly
- **Committed in:** baf5b95 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added missing UI components (Card, Switch, ScrollArea)**
- **Found during:** Task 1 (admin pages need shadcn/ui components)
- **Issue:** Card, Switch, and ScrollArea components were not yet in the project but are required by admin pages
- **Fix:** Created standard shadcn/ui Card, Switch (with @radix-ui/react-switch), and ScrollArea components
- **Files modified:** `src/components/ui/card.tsx`, `src/components/ui/switch.tsx`, `src/components/ui/scroll-area.tsx`
- **Verification:** TypeScript compiles clean
- **Committed in:** baf5b95 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both auto-fixes necessary for functionality. The Bull Board approach change provides equivalent functionality with better Next.js integration. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Admin infrastructure complete for Phase 1
- Settings service ready for use by any future feature (worker reads settings via Redis pub/sub)
- Health dashboard available for monitoring during development and production
- Card, Switch, ScrollArea components available for all future UI work

## Self-Check: PASSED

All 13 created/modified files verified present. Both task commits (baf5b95, 8022e58) verified in git log.

---
*Phase: 01-infrastructure-foundation*
*Completed: 2026-02-24*
