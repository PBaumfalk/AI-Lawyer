---
phase: 24-scanner-alerts
plan: 01
subsystem: background-jobs
tags: [bullmq, prisma, scanner, alerts, cron, socket-io, deduplication, escalation]

# Dependency graph
requires:
  - phase: 19-schema-foundation
    provides: HelenaAlert model, AktenActivity model, KalenderEintrag model
  - phase: 23.1-integration-wiring
    provides: notification service, socket emitter, settings service patterns
provides:
  - scannerQueue with nightly BullMQ cron (01:00 Europe/Berlin)
  - 3 deterministic check modules (FRIST_KRITISCH, AKTE_INAKTIV, BETEILIGTE_FEHLEN/DOKUMENT_FEHLT)
  - Alert service with 24h deduplication, auto-resolve, progressive escalation
  - 7 configurable scanner.* SystemSettings
  - Vertreter routing for alert recipients
affects: [26-activity-feed-ui, 24-02-alert-center-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [batch-query-check-pattern, alert-dedup-24h, auto-resolve-on-condition-fix, progressive-escalation-3d-7d]

key-files:
  created:
    - src/lib/scanner/types.ts
    - src/lib/scanner/service.ts
    - src/lib/scanner/checks/frist-check.ts
    - src/lib/scanner/checks/inaktiv-check.ts
    - src/lib/scanner/checks/anomalie-check.ts
    - src/workers/processors/scanner.ts
  modified:
    - src/lib/queue/queues.ts
    - src/lib/settings/defaults.ts
    - src/worker.ts
    - src/lib/notifications/types.ts
    - src/components/notifications/notification-center.tsx

key-decisions:
  - "No LLM calls in scanner -- purely deterministic Prisma queries for speed and reliability"
  - "Alert dedup uses 24h window per akteId+typ (not per userId) to prevent multiple alerts for same issue"
  - "FRIST_KRITISCH gets Socket.IO push + notification but NOT email (frist-reminder.ts handles email)"
  - "Auto-resolve checks each alert type against its specific fix condition rather than generic staleness"
  - "DOKUMENT_FEHLT uses case-insensitive partial name matching with Vollmacht special case"
  - "Progressive escalation uses meta fields (escalatedAt3d/escalatedAt7d) to prevent re-escalation"

patterns-established:
  - "Batch query check pattern: single Prisma query per check type, iterate results for alert creation"
  - "Alert dedup pattern: findFirst with 24h createdAt window before creating new alert"
  - "Auto-resolve pattern: scan unresolved alerts, check current state, update meta with resolvedAt+reason"
  - "Scanner settings pattern: all thresholds configurable via SystemSetting with scanner.* prefix"

requirements-completed: [SCAN-01, SCAN-02, SCAN-03, SCAN-04, SCAN-06, ALRT-04, ALRT-03]

# Metrics
duration: 8min
completed: 2026-02-28
---

# Phase 24 Plan 01: Scanner Backend Summary

**Nightly deterministic Akten scanner with 3 batch-query checks (FRIST_KRITISCH/AKTE_INAKTIV/Anomalie), 24h alert deduplication, auto-resolve on condition fix, and progressive escalation (severity bump after 3d, admin notify after 7d)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-28T08:13:32Z
- **Completed:** 2026-02-28T08:21:39Z
- **Tasks:** 5/5
- **Files modified:** 11

## Accomplishments
- BullMQ cron scanner running nightly at 01:00 Europe/Berlin scanning all open Akten
- 3 deterministic check modules: FRIST_KRITISCH (severity 8), AKTE_INAKTIV (severity 4), BETEILIGTE_FEHLEN (severity 5) + DOKUMENT_FEHLT (severity 3)
- Alert service with 24h deduplication, AktenActivity feed integration, Socket.IO badge updates
- Auto-resolve when underlying condition is fixed (Frist erledigt, new activity, Beteiligte added, Dokument uploaded)
- Progressive escalation: +2 severity after 3 days, admin notification after 7 days
- All thresholds configurable via 7 scanner.* SystemSettings
- Vertreter routing for alert recipients when primary user is on vacation

## Task Commits

Each task was committed atomically:

1. **Task 1: Scanner types, SystemSettings defaults, and queue registration** - `6ba9cac` (feat)
2. **Task 2: Alert creation service with deduplication and notifications** - `4e86770` (feat)
3. **Task 3: Auto-resolve and progressive escalation** - `6b3b76c` (feat)
4. **Task 4: Three check functions (FRIST_KRITISCH, AKTE_INAKTIV, Anomalie)** - `5ef3905` (feat)
5. **Task 5: Scanner processor and worker registration** - `075ec9c` (feat)

## Files Created/Modified
- `src/lib/scanner/types.ts` - CheckResult, ScanResult, ScannerConfig types
- `src/lib/scanner/service.ts` - createScannerAlert (24h dedup), resolveAlertRecipients, resolveStaleAlerts, escalateUnresolved
- `src/lib/scanner/checks/frist-check.ts` - runFristCheck: batch query Fristen within threshold
- `src/lib/scanner/checks/inaktiv-check.ts` - runInaktivCheck: batch query inactive Akten with _count
- `src/lib/scanner/checks/anomalie-check.ts` - runAnomalieCheck: combined BETEILIGTE_FEHLEN + DOKUMENT_FEHLT
- `src/workers/processors/scanner.ts` - processScanner orchestrating all checks + resolve + escalation
- `src/lib/queue/queues.ts` - scannerQueue definition + registerScannerJob
- `src/lib/settings/defaults.ts` - 7 scanner.* settings + Scanner category label
- `src/worker.ts` - Scanner worker registration, cron startup, settings:changed handler
- `src/lib/notifications/types.ts` - helena:alert-critical + scanner:admin-escalation types
- `src/components/notifications/notification-center.tsx` - Icon/color mappings for new notification types

## Decisions Made
- No LLM calls in scanner -- purely deterministic Prisma queries for speed and reliability
- Alert dedup uses 24h window per akteId+typ (not per userId) to prevent multiple alerts for same issue across Vertreter
- FRIST_KRITISCH gets Socket.IO push + notification but NOT email (frist-reminder.ts handles email for upcoming/overdue)
- Auto-resolve checks each alert type against its specific fix condition rather than generic staleness
- DOKUMENT_FEHLT uses case-insensitive partial name matching; Vollmacht also matches "mandatsvollmacht"
- Progressive escalation uses meta fields (escalatedAt3d/escalatedAt7d) to prevent re-escalation on subsequent scanner runs
- Dokument model has no kategorie field -- adjusted DOKUMENT_FEHLT to use name-only matching

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added notification types for scanner alerts**
- **Found during:** Task 2 (Alert creation service)
- **Issue:** NotificationType union did not include "helena:alert-critical" or "scanner:admin-escalation", causing TS errors
- **Fix:** Added both types to NotificationType in src/lib/notifications/types.ts, plus icon/color mappings in notification-center.tsx
- **Files modified:** src/lib/notifications/types.ts, src/components/notifications/notification-center.tsx
- **Verification:** TypeScript compiles without scanner-related errors
- **Committed in:** 4e86770 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Prisma type-only import used as value**
- **Found during:** Task 2 (Alert creation service)
- **Issue:** `Prisma` imported as `import type` but used as value for `Prisma.JsonNull` and `Prisma.InputJsonValue`
- **Fix:** Changed to value import `import { Prisma } from "@prisma/client"`
- **Files modified:** src/lib/scanner/service.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 4e86770 (Task 2 commit)

**3. [Rule 1 - Bug] Adjusted DOKUMENT_FEHLT to use name-only matching**
- **Found during:** Task 4 (Anomalie check)
- **Issue:** Plan referenced `Dokument.kategorie` field but Dokument model has no kategorie field in Prisma schema
- **Fix:** Used name-only matching with case-insensitive partial match for all document types
- **Files modified:** src/lib/scanner/checks/anomalie-check.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 5ef3905 (Task 4 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for TypeScript compilation and schema correctness. No scope creep.

## Issues Encountered
- 5 pre-existing TypeScript errors in src/lib/helena/index.ts (timestamp type mismatch) -- not related to scanner changes, left untouched as out-of-scope

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Scanner backend complete, ready for Plan 24-02 (Alert Center UI)
- All alert creation, dedup, resolve, and escalation logic is in place
- Socket.IO events (helena:alert-badge, helena:alert-critical) ready for frontend consumption
- SCAN-05 (NEUES_URTEIL) explicitly deferred per CONTEXT.md

## Self-Check: PASSED

All 6 created files verified present. All 5 task commits verified in git log.

---
*Phase: 24-scanner-alerts*
*Completed: 2026-02-28*
