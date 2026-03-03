---
phase: 48-e-mail-benachrichtigungen
plan: 02
subsystem: api, queue
tags: [portal, email, notification, mandant, trigger, fire-and-forget]

# Dependency graph
requires:
  - phase: 48-e-mail-benachrichtigungen
    plan: 01
    provides: "enqueuePortalNotification(), PortalNotificationJobData type, portal notification queue and worker"
provides:
  - "triggerPortalNotificationForAkte() helper: resolves Mandant Beteiligte from Akte and enqueues portal notifications"
  - "MSG-04 trigger: PORTAL channel message sends trigger email to Mandant (when author is internal user)"
  - "MSG-05 trigger: document mandantSichtbar=true toggle triggers neues-dokument email to Mandant"
  - "MSG-06 trigger: naechste-schritte STATUS_CHANGE activity triggers sachstand-update email to Mandant"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["triggerPortalNotificationForAkte(): resolve Mandant Beteiligte from Akte then enqueue notification for each", "Fire-and-forget trigger pattern: .catch(() => {}) after async notification call to never block originating action", "Author role check: skip PORTAL notification when Mandant is the message sender (they are already in the portal)"]

key-files:
  created:
    - src/lib/portal/trigger-portal-notification.ts
  modified:
    - src/lib/messaging/message-service.ts
    - src/app/api/akten/[id]/dokumente/[dId]/mandant-sichtbar/route.ts
    - src/app/api/akten/[id]/naechste-schritte/route.ts

key-decisions:
  - "Channel lookup refactored to single query reused for both Helena and PORTAL notification checks in sendMessage()"
  - "MSG-06 wired into naechste-schritte route (only current source of non-document mandantSichtbar activities), not feed POST route"
  - "Author role !== MANDANT check in MSG-04 prevents self-notification when Mandant sends portal messages"

patterns-established:
  - "Portal notification trigger pattern: import triggerPortalNotificationForAkte, call with akteId + type + deepLinkPath, append .catch(() => {})"

requirements-completed: [MSG-04, MSG-05, MSG-06]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 48 Plan 02: E-Mail Benachrichtigungen Trigger Wiring Summary

**Three portal email notification triggers wired into PORTAL messages, document freigabe, and naechste-schritte events with Mandant Beteiligte resolution and fire-and-forget dispatch**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T13:18:40Z
- **Completed:** 2026-03-03T13:23:04Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- triggerPortalNotificationForAkte() helper resolves all Mandant Beteiligte for an Akte and enqueues notifications for each
- MSG-04: PORTAL channel messages from internal users trigger email notification to Mandant
- MSG-05: Document mandantSichtbar=true toggle triggers neues-dokument email notification
- MSG-06: Naechste-schritte STATUS_CHANGE activity triggers sachstand-update email notification
- Document-type activities excluded from MSG-06 to prevent double-notification with MSG-05

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Mandant resolver helper and wire MSG-04 message trigger** - `5ee2e40` (feat)
2. **Task 2: Wire MSG-05 document freigabe trigger and MSG-06 sachstand trigger** - `c4b2c75` (feat)

## Files Created/Modified
- `src/lib/portal/trigger-portal-notification.ts` - Shared helper: resolves Mandant Beteiligte from Akte and enqueues portal notifications (fire-and-forget)
- `src/lib/messaging/message-service.ts` - MSG-04: PORTAL channel message trigger with author role check + refactored channel lookup
- `src/app/api/akten/[id]/dokumente/[dId]/mandant-sichtbar/route.ts` - MSG-05: document freigabe trigger when toggling mandantSichtbar to true
- `src/app/api/akten/[id]/naechste-schritte/route.ts` - MSG-06: sachstand-update trigger when updating naechste Schritte

## Decisions Made
- **Channel lookup consolidation:** Refactored sendMessage() to do a single channel lookup reused for both Helena mention check and PORTAL notification check (previously only looked up channel inside Helena mention block)
- **MSG-06 in naechste-schritte, not feed route:** The feed POST route creates NOTIZ entries (mandantSichtbar defaults to false), so no trigger needed there. The naechste-schritte route is the only current source of non-document mandantSichtbar activities.
- **Author role check for MSG-04:** Added User.role lookup to skip notification when Mandant sends messages (they are already in the portal). Internal users (ADMIN, ANWALT, SACHBEARBEITER) trigger the notification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Feed route not modified (plan listed it as target file)**
- **Found during:** Task 2 analysis
- **Issue:** Plan listed `src/app/api/akten/[id]/feed/route.ts` as a file to modify for MSG-06, but the feed POST route creates NOTIZ entries which have mandantSichtbar=false by default. The feed route is a query endpoint, not an activity creation point.
- **Fix:** Wired MSG-06 into `naechste-schritte/route.ts` instead, which is the actual source of non-document mandantSichtbar activities (STATUS_CHANGE type).
- **Files modified:** src/app/api/akten/[id]/naechste-schritte/route.ts (instead of feed/route.ts)
- **Verification:** npx tsc --noEmit passes; trigger fires on correct event source
- **Committed in:** c4b2c75 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking -- wrong target file in plan)
**Impact on plan:** Correct target file identified and wired. No scope creep.

## Issues Encountered
- 7 pre-existing TypeScript errors in falldaten-tab.tsx and helena/index.ts remain unrelated to changes.

## User Setup Required

None - uses existing notification infrastructure from Plan 01.

## Next Phase Readiness
- All three email notification triggers (MSG-04, MSG-05, MSG-06) are fully wired
- Phase 48 E-Mail Benachrichtigungen is complete
- Portal email pipeline: event trigger -> triggerPortalNotificationForAkte -> enqueuePortalNotification -> BullMQ queue -> processPortalNotification -> SMTP send

## Self-Check: PASSED

All artifacts verified:
- 48-02-SUMMARY.md exists
- Commit 5ee2e40 (Task 1) exists
- Commit c4b2c75 (Task 2) exists
- All 4 files created/modified exist on disk
- triggerPortalNotificationForAkte() export present in trigger-portal-notification.ts
- MSG-04 "neue-nachricht" trigger present in message-service.ts
- MSG-05 "neues-dokument" trigger present in mandant-sichtbar/route.ts
- MSG-06 "sachstand-update" trigger present in naechste-schritte/route.ts

---
*Phase: 48-e-mail-benachrichtigungen*
*Completed: 2026-03-03*
