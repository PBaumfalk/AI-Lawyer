---
phase: 28-falldatenblaetter-schema-templates
plan: "02"
subsystem: api
tags: [next-api, rest, falldaten, templates, approval-workflow, rbac, notifications, zod]

# Dependency graph
requires:
  - phase: 28-01
    provides: FalldatenTemplate Prisma model, Zod validation schemas, FalldatenTemplateStatus enum
provides:
  - GET /api/falldaten-templates (list with visibility rules)
  - POST /api/falldaten-templates (create with Zod validation)
  - GET /api/falldaten-templates/[id] (detail with access control)
  - PATCH /api/falldaten-templates/[id] (edit, creator-only, status-gated)
  - DELETE /api/falldaten-templates/[id] (delete, creator-only, ENTWURF-only)
  - POST /api/falldaten-templates/[id]/einreichen (submit for review)
  - POST /api/falldaten-templates/[id]/genehmigen (approve, ADMIN-only, 4-Augen-Prinzip)
  - POST /api/falldaten-templates/[id]/ablehnen (reject with reason, ADMIN-only)
  - template:approved and template:rejected notification types
affects: [28-03 UI (template builder + admin review queue), 29 Akte-detail form rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "createNotification service for DB+Socket.IO notifications in API routes (replaces inline prisma.notification.create + emitter calls)"
    - "4-Augen-Prinzip: admin count check for self-approval gate"
    - "Visibility-based listing with OR clause (public statuses + own templates)"

key-files:
  created:
    - src/app/api/falldaten-templates/route.ts
    - src/app/api/falldaten-templates/[id]/route.ts
    - src/app/api/falldaten-templates/[id]/einreichen/route.ts
    - src/app/api/falldaten-templates/[id]/genehmigen/route.ts
    - src/app/api/falldaten-templates/[id]/ablehnen/route.ts
  modified:
    - src/lib/notifications/types.ts
    - src/components/notifications/notification-center.tsx

key-decisions:
  - "Used createNotification service helper instead of inline prisma.notification.create + Socket.IO emitter -- cleaner, already handles DB persistence + real-time emission"
  - "Added template:approved and template:rejected to NotificationType union + updated notification-center icon/color maps for completeness"

patterns-established:
  - "Template CRUD API follows existing admin/muster pattern: auth check, try/catch, NextResponse.json, Zod safeParse for body validation"
  - "params typed as Promise<{ id: string }> with await for Next.js 14+ dynamic route segments"

requirements-completed: [FD-03, FD-04, FD-05, FD-06]

# Metrics
duration: 4min
completed: 2026-02-28
---

# Phase 28 Plan 02: API Routes Summary

**8 REST handlers for Falldatenblatt template CRUD and approval workflow with RBAC, Zod validation, 4-Augen-Prinzip, and real-time notifications**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-28T17:20:36Z
- **Completed:** 2026-02-28T17:24:29Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Complete REST API for template lifecycle: create (ENTWURF) -> edit -> submit (EINGEREICHT) -> approve (GENEHMIGT) or reject (ABGELEHNT) -> re-edit -> re-submit
- Visibility rules ensuring GENEHMIGT/STANDARD templates are public while drafts are private to creators
- 4-Augen-Prinzip enforcement on approval (multi-admin check for self-approval prevention)
- Real-time notifications via createNotification service on approve/reject

## Task Commits

Each task was committed atomically:

1. **Task 1: Create template list + create API routes** - `6e9a665` (feat)
2. **Task 2: Create template detail + edit + delete + workflow transition routes** - `0f43c92` (feat)

## Files Created/Modified
- `src/app/api/falldaten-templates/route.ts` - GET list with visibility + POST create with Zod validation
- `src/app/api/falldaten-templates/[id]/route.ts` - GET detail + PATCH edit (creator/status-gated) + DELETE (ENTWURF-only)
- `src/app/api/falldaten-templates/[id]/einreichen/route.ts` - POST submit for review (ENTWURF/ABGELEHNT -> EINGEREICHT)
- `src/app/api/falldaten-templates/[id]/genehmigen/route.ts` - POST approve (ADMIN, 4-Augen-Prinzip, notification)
- `src/app/api/falldaten-templates/[id]/ablehnen/route.ts` - POST reject with reason (ADMIN, notification)
- `src/lib/notifications/types.ts` - Added template:approved and template:rejected notification types
- `src/components/notifications/notification-center.tsx` - Added icon/color mappings for new notification types

## Decisions Made
- Used `createNotification` service helper instead of inline `prisma.notification.create` + Socket.IO emitter -- the service already handles both DB persistence and real-time emission with error handling
- Added notification types to `NotificationType` union and updated notification-center UI maps to prevent TypeScript errors and ensure UI displays template notifications correctly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed User.active -> User.aktiv field name**
- **Found during:** Task 2 (genehmigen route)
- **Issue:** Plan referenced `active: true` but Prisma User model has `aktiv` (German naming convention)
- **Fix:** Changed `active: true` to `aktiv: true` in admin count query
- **Files modified:** src/app/api/falldaten-templates/[id]/genehmigen/route.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** 0f43c92 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added notification types to NotificationType union + UI maps**
- **Found during:** Task 1 (after adding notification types)
- **Issue:** Adding `template:approved` and `template:rejected` to notification types caused TypeScript errors in notification-center.tsx where Record<NotificationType, ...> maps were incomplete
- **Fix:** Added both types to NotificationType, plus icon (CheckCircle2/XCircle) and color (emerald/rose) mappings in notification-center.tsx
- **Files modified:** src/lib/notifications/types.ts, src/components/notifications/notification-center.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** 6e9a665 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both auto-fixes necessary for type safety and correctness. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in `src/lib/helena/index.ts` remain (unrelated to this work, documented in 28-01-SUMMARY.md)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 8 API handlers ready for template builder UI consumption (Plan 03)
- Notification types registered for approve/reject workflows
- STANDARD template immutability enforced across all endpoints
- Zod schemas from Plan 01 integrated into request validation

## Self-Check: PASSED

All 7 files verified present. Both task commits (6e9a665, 0f43c92) verified in git log.

---
*Phase: 28-falldatenblaetter-schema-templates*
*Completed: 2026-02-28*
