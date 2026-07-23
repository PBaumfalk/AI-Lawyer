---
phase: 31-messaging-schema-api
plan: 01
subsystem: database, api, messaging
tags: [prisma, socket.io, messaging, channels, real-time, notifications]

# Dependency graph
requires:
  - phase: 21-helena-task-system
    provides: HelenaTask model, createHelenaTask(), parseHelenaMention()
  - phase: 28-falldatenblaetter-schema-templates
    provides: FalldatenTemplate model (schema insertion point)
provides:
  - Channel, ChannelMember, Message, MessageReaction Prisma models with migration
  - ChannelTyp enum (ALLGEMEIN, AKTE)
  - Socket.IO channel room handlers (join:channel, leave:channel, typing:start, typing:stop)
  - Messaging service layer (channel-service, message-service)
  - Seed function for default channels (#allgemein, #organisation)
  - MessageNewPayload, MessageEditedPayload, MessageDeletedPayload, TypingPayload types
  - "message:mention" NotificationType
affects: [31-02-PLAN, 31-03-PLAN, 32-messaging-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Channel room naming: channel:{channelId}"
    - "Typing indicators: ephemeral Socket.IO events, no DB persistence"
    - "Seed channels: SystemSetting guard pattern (messaging.channels_seed_version)"
    - "@alle expansion: __alle__ sentinel replaced server-side with all channel member IDs"

key-files:
  created:
    - src/lib/messaging/types.ts
    - src/lib/messaging/channel-service.ts
    - src/lib/messaging/message-service.ts
    - prisma/migrations/20260302085552_add_messaging_models/migration.sql
  modified:
    - prisma/schema.prisma
    - src/lib/notifications/types.ts
    - src/lib/socket/rooms.ts
    - src/worker.ts
    - src/components/notifications/notification-center.tsx

key-decisions:
  - "PrismaTransaction type derived from prisma.$transaction parameter for extended client compatibility"
  - "Seed guard uses SystemSetting (messaging.channels_seed_version) matching seedFalldatenTemplates pattern"
  - "gatherAkteMemberIds collects from anwaltId + sachbearbeiterId + Dezernat members via nested include"
  - "syncAkteChannelMembers adds missing members but never removes existing (explicit additions preserved)"

patterns-established:
  - "Channel service pattern: all channel business logic in channel-service.ts, API routes remain thin"
  - "Message service pattern: sendMessage handles create + Socket.IO emit + mention notifications + @Helena in one function"
  - "Mention expansion pattern: client sends __alle__ sentinel, server expands to member IDs excluding author"

requirements-completed: [MSG-01, MSG-02, MSG-03]

# Metrics
duration: 5min
completed: 2026-03-02
---

# Phase 31 Plan 01: Messaging Schema + Service Layer Summary

**4 Prisma models (Channel, ChannelMember, Message, MessageReaction) with Socket.IO channel rooms, messaging service layer, @mention notifications, @Helena integration, and seed default channels**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-02T07:54:03Z
- **Completed:** 2026-03-02T07:59:45Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Channel, ChannelMember, Message, MessageReaction models with ChannelTyp enum, indexes, and cascading deletes
- Socket.IO channel room handlers for join/leave and ephemeral typing indicators
- Complete messaging service layer: channel CRUD, membership management, unread counts, message send/edit/soft-delete
- @mention notification pipeline with @alle expansion and @Helena task creation for AKTE channels
- Seed function for #allgemein and #organisation channels, auto-joining all active users
- Worker startup integration for channel seeding

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema models + migration + NotificationType + messaging types** - `a555344` (feat)
2. **Task 2: Socket.IO channel rooms + messaging service layer + seed function + worker wiring** - `661e1f7` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added 4 new models (Channel, ChannelMember, Message, MessageReaction), ChannelTyp enum, reverse relations on User and Akte, optional channelId on HelenaTask
- `prisma/migrations/20260302085552_add_messaging_models/migration.sql` - SQL migration for all new tables, indexes, foreign keys, and HelenaTask channelId column
- `src/lib/messaging/types.ts` - TypeScript types for Socket.IO payloads (MessageNewPayload, MessageEditedPayload, MessageDeletedPayload, TypingPayload) and API DTOs (ChannelListItem, MessageListItem)
- `src/lib/messaging/channel-service.ts` - Channel service: createChannel, seedDefaultChannels, gatherAkteMemberIds, syncAkteChannelMembers, getUnreadCount, generateSlug
- `src/lib/messaging/message-service.ts` - Message service: sendMessage (with @mention + @Helena), editMessage, softDeleteMessage
- `src/lib/socket/rooms.ts` - Extended with join:channel, leave:channel, typing:start, typing:stop handlers
- `src/lib/notifications/types.ts` - Added "message:mention" to NotificationType union
- `src/worker.ts` - Wired seedDefaultChannels() call after seedFalldatenTemplates()
- `src/components/notifications/notification-center.tsx` - Added message:mention icon (MessageSquare) and color (text-blue-500)

## Decisions Made
- Used SystemSetting guard pattern (messaging.channels_seed_version) for seed idempotency, consistent with seedFalldatenTemplates
- PrismaTransaction type derived from `Parameters<Parameters<typeof prisma.$transaction>[0]>[0]>` for extended client compatibility
- gatherAkteMemberIds collects anwaltId + sachbearbeiterId + all Dezernat members via nested Prisma include
- syncAkteChannelMembers adds missing members but never removes -- preserves explicitly added users
- Channel slug generation: lowercase + German umlaut replacement + non-alphanumeric to hyphens

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added message:mention icon and color to notification-center.tsx**
- **Found during:** Task 2 (TypeScript compilation check)
- **Issue:** Adding "message:mention" to NotificationType union caused TS2741 errors in notification-center.tsx where Record<NotificationType, ...> maps were exhaustive but missing the new type
- **Fix:** Added MessageSquare icon import and "message:mention" entries to both typeIcons and typeColors maps
- **Files modified:** src/components/notifications/notification-center.tsx
- **Verification:** npx tsc --noEmit passes with zero errors
- **Committed in:** 661e1f7 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix necessary for type safety. No scope creep.

## Issues Encountered
- Database server not running locally; migration created manually as SQL file instead of via `prisma migrate dev`. Migration will apply on next Docker Compose startup.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Prisma models and service layer ready for API routes (Plan 31-02 and 31-03)
- Migration file ready to apply on next database startup
- Socket.IO channel rooms ready for client connections
- Seed function wired into worker startup

---
*Phase: 31-messaging-schema-api*
*Completed: 2026-03-02*
