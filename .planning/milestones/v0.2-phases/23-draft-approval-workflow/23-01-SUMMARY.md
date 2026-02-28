---
phase: 23-draft-approval-workflow
plan: 01
subsystem: api
tags: [prisma, redis, socket-io, zod, bullmq, draft-workflow, brak-compliance]

# Dependency graph
requires:
  - phase: 19-schema-foundation
    provides: HelenaDraft, HelenaMemory, AktenActivity models
  - phase: 21-helena-task-system
    provides: createHelenaTask for auto-revise enqueue
  - phase: 22-deterministic-schriftsatz-orchestrator
    provides: Schriftsatz pipeline creates drafts that this plan's API manages
provides:
  - Prisma $extends ENTWURF gate on dokument.create/update (BRAK 2025 compliance)
  - HelenaDraft revision tracking fields (parentDraftId, revisionCount, feedbackCategories, noRevise, undoExpiresAt)
  - Draft lifecycle service (acceptDraft, rejectDraft, undoAcceptDraft, editDraft)
  - Draft CRUD API with RBAC and Akte access filtering
  - Redis-backed draft locking with Socket.IO broadcast
  - HelenaMemory rejection pattern storage for future Helena improvement
  - Auto-revise task enqueue on rejection (max 3 revisions)
  - ExtendedPrismaClient and PrismaTransactionClient types for $extends consumers
affects: [23-02-draft-approval-workflow, 24-scanner-alerts, 25-helena-memory, 26-activity-feed-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [prisma-client-extensions, redis-set-nx-ex-lock, zod-discriminated-union, undo-window-pattern]

key-files:
  created:
    - src/lib/helena/draft-service.ts
    - src/app/api/helena/drafts/route.ts
    - src/app/api/helena/drafts/[id]/route.ts
    - src/app/api/helena/drafts/[id]/undo/route.ts
    - src/app/api/helena/drafts/[id]/lock/route.ts
    - prisma/migrations/20260227220716_add_helena_draft_revision_fields/migration.sql
  modified:
    - prisma/schema.prisma
    - src/lib/db.ts
    - src/lib/finance/aktenkonto/booking.ts
    - src/lib/finance/invoice/nummernkreis.ts
    - src/lib/finance/invoice/status-machine.ts
    - src/lib/helena/tools/types.ts
    - src/lib/helena/tools/index.ts
    - src/lib/helena/index.ts
    - src/lib/helena/rate-limiter.ts
    - src/lib/helena/schriftsatz/index.ts
    - src/lib/helena/schriftsatz/intent-router.ts
    - src/lib/helena/schriftsatz/slot-filler.ts

key-decisions:
  - "Prisma $extends on db.ts (not middleware) for ENTWURF gate -- middleware is deprecated, $extends is the Prisma 5 pattern"
  - "ExtendedPrismaClient type exported from db.ts -- all Helena/finance modules updated to use it instead of PrismaClient"
  - "PrismaTransactionClient type exported from db.ts -- derived from $extends-aware $transaction signature for finance modules"
  - "Defense-in-depth: explicit status ENTWURF in acceptDraft tx + $extends gate as global safety net"
  - "Fail-open Redis lock: if Redis unavailable, lock acquisition returns success with warning (no blocking)"
  - "Auto-revise is non-blocking: enqueue failure logs warning but does not fail the rejection"
  - "Undo deletes the accept activity by searching last 10 HELENA_DRAFT activities with matching draftId"

patterns-established:
  - "Prisma $extends ENTWURF gate: all dokument.create/update for AI documents forced to ENTWURF status"
  - "Draft lock pattern: Redis SET NX EX with 5-min TTL, ownership-gated DELETE, Socket.IO broadcast"
  - "Undo window pattern: undoExpiresAt timestamp set on accept, checked on undo, cleared after window"
  - "Zod discriminated union for multi-action PATCH endpoints"

requirements-completed: [DRFT-02, DRFT-04, DRFT-05]

# Metrics
duration: 9min
completed: 2026-02-27
---

# Phase 23 Plan 01: Draft Approval Workflow - Backend Summary

**ENTWURF Prisma gate with $extends, HelenaDraft revision tracking, and full draft lifecycle API (accept/reject/edit/undo/lock) with RBAC, Redis locking, and auto-revise**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-27T21:05:49Z
- **Completed:** 2026-02-27T21:15:18Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments
- Prisma Client Extensions ENTWURF gate ensures AI-created documents never bypass ENTWURF status (BRAK 2025 / BRAO 43)
- Full draft lifecycle API: accept creates real records, reject stores structured feedback in HelenaMemory, edit returns to PENDING, undo reverts within 5s window
- Redis-backed draft locking prevents concurrent review with Socket.IO broadcast for real-time UI updates
- Auto-revise triggers new Helena task on rejection when revisionCount < 3 and feedback provided

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration + ENTWURF Prisma gate** - `ef40083` (feat)
2. **Task 2: Draft service and API routes** - `53c3f10` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `prisma/schema.prisma` - HelenaDraft revision tracking fields (parentDraftId, revisionCount, feedbackCategories, noRevise, undoExpiresAt)
- `src/lib/db.ts` - Prisma $extends ENTWURF gate + ExtendedPrismaClient/PrismaTransactionClient types
- `src/lib/helena/draft-service.ts` - Business logic: acceptDraft, rejectDraft, undoAcceptDraft, editDraft
- `src/app/api/helena/drafts/route.ts` - GET endpoint: list drafts with filters and pagination
- `src/app/api/helena/drafts/[id]/route.ts` - GET single draft, PATCH accept/reject/edit with zod discriminated union
- `src/app/api/helena/drafts/[id]/undo/route.ts` - POST: undo accept within 5s window
- `src/app/api/helena/drafts/[id]/lock/route.ts` - POST/DELETE: Redis-backed review lock with Socket.IO broadcast
- `prisma/migrations/20260227220716_add_helena_draft_revision_fields/migration.sql` - Migration for new fields
- `src/lib/finance/aktenkonto/booking.ts` - Updated PrismaTransaction type to use PrismaTransactionClient from db.ts
- `src/lib/finance/invoice/status-machine.ts` - Updated PrismaTransaction type
- `src/lib/finance/invoice/nummernkreis.ts` - Updated PrismaTransaction type
- `src/lib/helena/tools/types.ts` - ToolContext.prisma uses ExtendedPrismaClient
- `src/lib/helena/tools/index.ts` - CreateHelenaToolsOptions.prisma uses ExtendedPrismaClient
- `src/lib/helena/index.ts` - HelenaAgentOptions.prisma uses ExtendedPrismaClient
- `src/lib/helena/rate-limiter.ts` - checkRateLimit options.prisma uses ExtendedPrismaClient
- `src/lib/helena/schriftsatz/index.ts` - SchriftsatzPipelineOptions.prisma uses ExtendedPrismaClient
- `src/lib/helena/schriftsatz/intent-router.ts` - buildAkteContext prisma param uses ExtendedPrismaClient
- `src/lib/helena/schriftsatz/slot-filler.ts` - prefillSlotsFromAkte prisma param uses ExtendedPrismaClient

## Decisions Made
- Used Prisma $extends (not deprecated middleware) for ENTWURF gate -- the Prisma 5 recommended pattern
- Exported ExtendedPrismaClient type from db.ts and updated all Helena/finance consumers -- prevents type mismatch cascade from $extends
- Exported PrismaTransactionClient from db.ts for finance modules that derive transaction types from the client
- Defense-in-depth: explicit `status: "ENTWURF"` inside acceptDraft transaction AND $extends gate as global safety net (Prisma 5.22 may not fire $extends inside interactive tx)
- Fail-open Redis locking: if Redis unavailable, returns success with warning to avoid blocking workflows
- Auto-revise enqueue is non-blocking: failure logs warning but does not fail the rejection
- Lock TTL 5 minutes with SET NX EX pattern -- keeps Redis operations atomic

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed ExtendedPrismaClient type propagation across codebase**
- **Found during:** Task 1 (ENTWURF Prisma gate)
- **Issue:** Changing prisma export from PrismaClient to $extends return type caused 12+ TypeScript errors in finance modules, helena tools, tests, and task processor where PrismaClient type was expected
- **Fix:** Exported ExtendedPrismaClient and PrismaTransactionClient from db.ts; updated all consuming files (helena tools/types/index, schriftsatz modules, rate-limiter, finance booking/status-machine/nummernkreis, test files) to use the new types
- **Files modified:** src/lib/db.ts, src/lib/helena/tools/types.ts, src/lib/helena/tools/index.ts, src/lib/helena/index.ts, src/lib/helena/rate-limiter.ts, src/lib/helena/schriftsatz/index.ts, src/lib/helena/schriftsatz/intent-router.ts, src/lib/helena/schriftsatz/slot-filler.ts, src/lib/finance/aktenkonto/booking.ts, src/lib/finance/invoice/status-machine.ts, src/lib/finance/invoice/nummernkreis.ts, src/lib/helena/__tests__/orchestrator.test.ts, src/lib/helena/__tests__/tools.test.ts
- **Verification:** `npx tsc --noEmit` passes (only pre-existing errors in helena/index.ts remain)
- **Committed in:** ef40083 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Akte.titel reference to Akte.kurzrubrum**
- **Found during:** Task 2 (API routes)
- **Issue:** Plan specified `akte: { select: { id, aktenzeichen, titel } }` but Akte model has kurzrubrum, not titel
- **Fix:** Changed to `{ id: true, aktenzeichen: true, kurzrubrum: true }` in both drafts/route.ts and drafts/[id]/route.ts
- **Files modified:** src/app/api/helena/drafts/route.ts, src/app/api/helena/drafts/[id]/route.ts
- **Verification:** TypeScript compiles without errors for these files
- **Committed in:** 53c3f10 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness. The $extends type propagation was the expected consequence noted in the plan. No scope creep.

## Issues Encountered
- Database not running locally so `prisma migrate dev` could not run -- created migration SQL manually. Migration will apply on next `prisma migrate deploy`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Draft lifecycle backend complete, ready for Phase 23-02 (UI components)
- All API endpoints follow existing patterns (requireAuth, buildAkteAccessFilter, zod validation)
- Socket.IO events (draft:locked, draft:unlocked) ready for real-time UI consumption
- Auto-revise integration tested at compile level; runtime test requires Helena agent stack

## Self-Check: PASSED

All 7 key files verified present. Both task commits (ef40083, 53c3f10) verified in git log.

---
*Phase: 23-draft-approval-workflow*
*Completed: 2026-02-27*
