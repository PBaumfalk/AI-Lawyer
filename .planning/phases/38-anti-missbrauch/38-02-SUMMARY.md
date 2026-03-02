---
phase: 38-anti-missbrauch
plan: 02
subsystem: gamification
tags: [socket.io, bullmq, sonner, audit, anti-abuse, quest]

# Dependency graph
requires:
  - phase: 38-anti-missbrauch-01
    provides: "QuestCompletion schema with auditStatus/pendingXp/pendingRunen fields, Runen cap, dedup"
provides:
  - "Random audit sampling (2%) in quest-service with Socket.IO event emission"
  - "Audit confirm/decline API endpoint with ownership check"
  - "BullMQ audit-auto-confirm delayed job (24h fallback)"
  - "Global Sonner action toast listener for audit events in dashboard layout"
affects: [39-item-shop, 40-team-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Socket.IO event + Sonner action toast for user confirmation flow", "BullMQ delayed job as timeout fallback for user inaction"]

key-files:
  created:
    - src/app/api/gamification/audit/confirm/route.ts
    - src/components/gamification/gamification-audit-listener.tsx
  modified:
    - src/lib/gamification/quest-service.ts
    - src/lib/queue/queues.ts
    - src/lib/queue/processors/gamification.processor.ts
    - src/app/(dashboard)/layout.tsx

key-decisions:
  - "2% audit rate (Math.random < 0.02) as midpoint of 1-3% range"
  - "Toast duration: Infinity -- server-side 24h auto-confirm is the real timeout"
  - "Fire-and-forget fetch on toast buttons -- no client-side error handling needed"
  - "Listener mounted in SocketProvider (not inside QuestWidget) for global coverage"

patterns-established:
  - "Socket.IO event -> Sonner action toast pattern for async user confirmations"
  - "BullMQ delayed job as 24h auto-confirm fallback for unresolved audits"

requirements-completed: [ABUSE-03]

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 38 Plan 02: Audit Sampling Summary

**Random 2% audit sampling with Sonner action toast, confirm/decline API, and 24h BullMQ auto-confirm fallback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T22:12:35Z
- **Completed:** 2026-03-02T22:15:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Wired random audit sampling (Math.random < 0.02) replacing Plan 01 placeholder
- Socket.IO gamification:audit-needed event emitted to user room on audit flag
- BullMQ audit-auto-confirm delayed job (24h) credits pending rewards if still PENDING
- /api/gamification/audit/confirm POST endpoint with ownership validation and CONFIRMED/DECLINED handling
- Global GamificationAuditListener in dashboard layout with Sonner action toast (duration: Infinity)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire audit sampling in quest-service + audit-auto-confirm job + confirm API endpoint** - `02923aa` (feat)
2. **Task 2: Global audit Socket.IO listener with Sonner action toast** - `a1d40be` (feat)

## Files Created/Modified
- `src/lib/gamification/quest-service.ts` - Added Math.random audit sampling, Socket.IO event emission, auto-confirm job scheduling
- `src/lib/queue/queues.ts` - Added completionId to GamificationJobData interface
- `src/lib/queue/processors/gamification.processor.ts` - Added audit-auto-confirm handler with PENDING check and atomic reward credit
- `src/app/api/gamification/audit/confirm/route.ts` - New POST endpoint for user confirm/decline with ownership validation
- `src/components/gamification/gamification-audit-listener.tsx` - New client component with useSocket hook and Sonner action toast
- `src/app/(dashboard)/layout.tsx` - Mounted GamificationAuditListener inside SocketProvider

## Decisions Made
- 2% audit rate chosen as midpoint of the 1-3% range specified in CONTEXT.md
- Toast uses duration: Infinity because the server-side 24h auto-confirm handles the real timeout
- Fire-and-forget fetch on button clicks (no .then() error handling) -- simplicity over client-side error handling since server auto-confirm is the safety net
- Audit listener mounted directly inside SocketProvider (before NotificationProvider) for global coverage regardless of page

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Audit sampling is fully operational for quest completions
- All ABUSE requirements (01-04) now implemented across Plans 01 and 02
- Ready for Phase 39 (Item-Shop) which depends on Runen cap being in place

---
*Phase: 38-anti-missbrauch*
*Completed: 2026-03-02*
