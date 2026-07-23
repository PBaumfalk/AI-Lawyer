---
phase: 31-messaging-schema-api
plan: 03
subsystem: api, messaging
tags: [rest-api, messages, reactions, socket.io, helena, cursor-pagination, zod]

# Dependency graph
requires:
  - phase: 31-messaging-schema-api-01
    provides: Channel, ChannelMember, Message, MessageReaction Prisma models, message-service (sendMessage, editMessage, softDeleteMessage), channel-service, Socket.IO channel rooms
provides:
  - GET /api/channels/{id}/messages -- cursor-based paginated message history with author, reactions, reply-to preview
  - POST /api/channels/{id}/messages -- send message with @mention and @Helena processing
  - PATCH /api/channels/{id}/messages/{messageId} -- edit own messages
  - DELETE /api/channels/{id}/messages/{messageId} -- soft-delete (author or ADMIN)
  - POST /api/channels/{id}/reactions -- add emoji reaction with real-time broadcast
  - DELETE /api/channels/{id}/reactions -- remove emoji reaction with real-time broadcast
  - postHelenaResponseToChannel -- Helena processor posts response back to originating channel
  - channelId flow: createHelenaTask accepts channelId, message-service passes it, processor posts back
affects: [32-messaging-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Channel access gate: requireAkteAccess() for AKTE channels, ChannelMember check for ALLGEMEIN"
    - "Cursor-based pagination: ?cursor={id}&limit=50, returns { messages, nextCursor }"
    - "Reaction dedup: P2002 caught and returned as 200 (idempotent)"
    - "Helena channel response: cached system user ID, fire-and-forget message creation"

key-files:
  created:
    - src/app/api/channels/[id]/messages/route.ts
    - src/app/api/channels/[id]/messages/[messageId]/route.ts
    - src/app/api/channels/[id]/reactions/route.ts
  modified:
    - src/lib/queue/processors/helena-task.processor.ts
    - src/lib/helena/task-service.ts
    - src/lib/messaging/message-service.ts

key-decisions:
  - "verifyChannelAccess helper encapsulates AKTE vs ALLGEMEIN access logic for reuse across GET and POST"
  - "Reactions use body-based DELETE (not query params) for consistency with POST schema"
  - "Helena system user lookup uses module-level cached promise with idempotent upsert fallback"
  - "channelId flows through createHelenaTask -> HelenaTask DB record -> processor fetches from DB after completion"

patterns-established:
  - "Channel API route pattern: verifyChannelAccess() gates all channel endpoints with AKTE/ALLGEMEIN branching"
  - "Message pagination pattern: cursor-based with take+1 for nextCursor detection"

requirements-completed: [MSG-03, MSG-05]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 31 Plan 03: Message + Reaction API Routes with Helena Channel Response Summary

**REST API routes for message CRUD (paginated list, send, edit, soft-delete), emoji reactions with real-time broadcast, and Helena processor posting responses back to originating channels**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T08:02:17Z
- **Completed:** 2026-03-02T08:06:58Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Complete message CRUD: GET with cursor-based pagination (reactions, author info, reply-to preview), POST with Zod validation and sendMessage(), PATCH for edit, DELETE for soft-delete
- Emoji reaction routes with P2002 duplicate handling and Socket.IO broadcast (reaction:added, reaction:removed)
- Helena task processor extended to post responses back to originating channel as system messages
- End-to-end channelId flow: message-service passes channelId to createHelenaTask, stored in DB, processor checks after completion

## Task Commits

Each task was committed atomically:

1. **Task 1: Message list/send + edit/delete API routes** - `0f78599` (feat)
2. **Task 2: Reaction routes + Helena processor channel response posting** - `6590725` (feat)

## Files Created/Modified
- `src/app/api/channels/[id]/messages/route.ts` - GET (paginated messages) and POST (send message with mentions)
- `src/app/api/channels/[id]/messages/[messageId]/route.ts` - PATCH (edit message) and DELETE (soft-delete message)
- `src/app/api/channels/[id]/reactions/route.ts` - POST (add reaction) and DELETE (remove reaction) with real-time broadcast
- `src/lib/queue/processors/helena-task.processor.ts` - Added getHelenaUserId(), postHelenaResponseToChannel(), and channelId check after task completion
- `src/lib/helena/task-service.ts` - Added channelId to CreateTaskOptions and passed through to Prisma create
- `src/lib/messaging/message-service.ts` - Passes channelId to createHelenaTask for channel @Helena mentions

## Decisions Made
- verifyChannelAccess() helper encapsulates AKTE vs ALLGEMEIN access logic, reused across GET and POST handlers
- Reactions use body-based DELETE (not query params) for consistency with POST schema and easier Zod validation
- Helena system user lookup uses module-level cached promise to avoid repeated DB queries, with idempotent upsert fallback ensuring runtime robustness even without seeded system user
- channelId flows through DB record (not job data) to keep HelenaTaskJobData interface stable -- processor fetches from DB after completion

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wired channelId through createHelenaTask and message-service**
- **Found during:** Task 2 (Helena processor channel response posting)
- **Issue:** message-service.ts called createHelenaTask() without channelId, and CreateTaskOptions did not accept channelId -- the processor would never have a channelId to post back to
- **Fix:** Added channelId to CreateTaskOptions, passed it through to Prisma create in task-service.ts, updated message-service.ts to pass channelId when creating Helena tasks from channel @mentions
- **Files modified:** src/lib/helena/task-service.ts, src/lib/messaging/message-service.ts
- **Verification:** npx tsc --noEmit passes (no new errors)
- **Committed in:** 6590725 (Task 2 commit)

**2. [Rule 1 - Bug] Added passwordHash to Helena system user upsert create clause**
- **Found during:** Task 2 (Helena processor channel response posting)
- **Issue:** User model requires passwordHash field, but the Helena system user upsert create clause was missing it, causing TS2322 compilation error
- **Fix:** Added `passwordHash: ""` to the create clause (system user -- no login)
- **Files modified:** src/lib/queue/processors/helena-task.processor.ts
- **Verification:** npx tsc --noEmit passes (no new errors in this file)
- **Committed in:** 6590725 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes essential for the Helena channel response feature to work end-to-end. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors (7 errors in falldaten-tab.tsx and helena/index.ts) -- unrelated to this plan, not addressed per scope boundary rules.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All messaging API routes complete -- Phase 32 (messaging-ui) can build the frontend
- Channel access gating pattern established for reuse in Phase 32
- Helena channel response flow is end-to-end wired

## Self-Check: PASSED

All 4 files verified on disk. Both task commits (0f78599, 6590725) verified in git log.

---
*Phase: 31-messaging-schema-api*
*Completed: 2026-03-02*
