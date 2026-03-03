---
phase: 47-portal-messaging
plan: 01
subsystem: api, ui, database
tags: [portal, mandant, messaging, channel, prisma, nextjs, api-routes, glass-ui]

# Dependency graph
requires:
  - phase: 46-dokument-freigabe-portal-dms
    provides: "Portal API infrastructure, requireMandantAkteAccess, Mandant auth pattern"
  - phase: 44-portal-authentifizierung
    provides: "MANDANT UserRole, kontaktId on User, portal session auth"
  - phase: 31-messaging
    provides: "Channel/Message models, message-service, channel-service, ChannelMember, MessageView component"
provides:
  - "PORTAL value in ChannelTyp enum for isolated Mandant-Anwalt channels"
  - "createPortalChannel() lazy creation with P2002 race handling"
  - "GET /api/portal/akten/[id]/channel for portal-side channel creation"
  - "GET+POST /api/portal/akten/[id]/messages for portal message history and sending"
  - "GET /api/akten/[id]/portal-channels for Anwalt-side portal channel listing"
  - "Mandantenportal section in /nachrichten sidebar with PORTAL channels"
  - "Portal tab in Akte-Detail with PortalChannelTab component"
affects: [47-portal-messaging-plan-02]

# Tech tracking
tech-stack:
  added: []
  patterns: ["PORTAL channel lazy creation per Mandant+Akte pair", "Compound unique (akteId, typ, mandantUserId) replacing simple @unique on akteId", "Portal message API with stripped mentions (no @Helena/@alle)", "PortalChannelTab with auto-select for single Mandant, list for multiple"]

key-files:
  created:
    - src/app/api/portal/akten/[id]/channel/route.ts
    - src/app/api/portal/akten/[id]/messages/route.ts
    - src/app/api/akten/[id]/portal-channels/route.ts
    - prisma/migrations/manual_add_portal_channel_typ.sql
  modified:
    - prisma/schema.prisma
    - src/lib/messaging/types.ts
    - src/lib/messaging/channel-service.ts
    - src/app/api/channels/route.ts
    - src/app/api/akten/[id]/channel/route.ts
    - src/components/messaging/channel-sidebar.tsx
    - src/components/messaging/channel-list-item.tsx
    - src/components/messaging/akte-channel-tab.tsx
    - src/components/akten/akte-detail-tabs.tsx

key-decisions:
  - "No separate MandantUser model: MANDANT is a regular User with role=MANDANT and kontaktId"
  - "mandantUserId on Channel (not separate MandantUser FK) since Mandant is a User record"
  - "Compound unique (akteId, typ, mandantUserId) replaces @unique on akteId to support multiple channel types per Akte"
  - "Akte-to-Channel relation changed from one-to-one to one-to-many (Channel[] on Akte)"
  - "Portal messages strip all mentions -- no @Helena or @alle from portal side"
  - "PortalChannelTab auto-selects when single Mandant, shows list for multiple"

patterns-established:
  - "Portal channel lazy creation: check existing -> create in transaction -> P2002 catch"
  - "Portal API auth pattern: requireAuth() + role check + requireMandantAkteAccess()"
  - "PORTAL channels use mandantUserId field for Mandant identification"

requirements-completed: [MSG-01, MSG-02]

# Metrics
duration: 6min
completed: 2026-03-03
---

# Phase 47 Plan 01: Portal Messaging Channel Infrastructure Summary

**PORTAL ChannelTyp with lazy channel creation per Mandant+Akte pair, bidirectional message API, and Mandantenportal sidebar section in /nachrichten**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-03T12:50:07Z
- **Completed:** 2026-03-03T12:57:04Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- PORTAL added to ChannelTyp enum with mandantUserId field on Channel model and compound unique constraint
- Portal channel API routes enable Mandant to lazy-create channels and send/receive messages per Akte
- /nachrichten sidebar shows three collapsible sections: ALLGEMEIN, AKTEN, Mandantenportal
- Akte-Detail page has a Portal tab listing PORTAL channels with PortalChannelTab component
- All mentions stripped from portal messages (security: no @Helena or @alle from Mandant side)

## Task Commits

Each task was committed atomically:

1. **Task 1: PORTAL ChannelTyp + portal channel service + API routes** - `937e72f` (feat)
2. **Task 2: Anwalt-side UI -- Mandantenportal sidebar section + Akte portal tab** - `5be55b7` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - PORTAL enum value, mandantUserId field, compound unique, Akte->Channel[] one-to-many
- `prisma/migrations/manual_add_portal_channel_typ.sql` - Migration SQL for enum, column, indexes, FK
- `src/lib/messaging/types.ts` - ChannelListItem.typ includes PORTAL, mandantUserId/mandantUserName fields
- `src/lib/messaging/channel-service.ts` - createPortalChannel() with lazy creation and P2002 handling
- `src/app/api/portal/akten/[id]/channel/route.ts` - Portal-side channel lazy creation endpoint
- `src/app/api/portal/akten/[id]/messages/route.ts` - Portal-side paginated messages GET + send POST
- `src/app/api/akten/[id]/portal-channels/route.ts` - Anwalt-side portal channel listing per Akte
- `src/app/api/channels/route.ts` - PORTAL typ filter support, mandantUser info in response
- `src/app/api/akten/[id]/channel/route.ts` - Updated from findUnique to findFirst (no longer @unique on akteId)
- `src/components/messaging/channel-sidebar.tsx` - Third collapsible section: Mandantenportal
- `src/components/messaging/channel-list-item.tsx` - UserCircle icon and mandantUserName display for PORTAL
- `src/components/messaging/akte-channel-tab.tsx` - PortalChannelTab component with multi-Mandant support
- `src/components/akten/akte-detail-tabs.tsx` - Portal tab trigger and content

## Decisions Made
- **No MandantUser model needed:** Plan referenced MandantUser but codebase uses regular User with role=MANDANT and kontaktId linking to Kontakt. Simplified all code accordingly.
- **Compound unique replaces @unique on akteId:** Since an Akte can now have both an AKTE channel and multiple PORTAL channels (one per Mandant), the old 1:1 @unique constraint was replaced with @@unique([akteId, typ, mandantUserId]).
- **One-to-many Akte->Channel:** Changed Akte.channel (Channel?) to Akte.channels (Channel[]) to support multiple channel types per Akte.
- **Mentions stripped from portal:** Portal messages pass empty mentions array to sendMessage() preventing @Helena triggers or @alle expansion from Mandant side.
- **PortalChannelTab auto-select:** When an Akte has exactly one PORTAL channel (one Mandant), it auto-selects and shows MessageView directly. Multiple Mandanten shows a selectable list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated AKTE channel route from findUnique to findFirst**
- **Found during:** Task 1 (schema changes)
- **Issue:** Removing @unique on akteId broke `channel.findUnique({ where: { akteId } })` in the AKTE channel route
- **Fix:** Changed to `channel.findFirst({ where: { akteId, typ: "AKTE" } })` in all 3 occurrences
- **Files modified:** src/app/api/akten/[id]/channel/route.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** 937e72f (Task 1 commit)

**2. [Rule 3 - Blocking] Changed Akte model relation from Channel? to Channel[]**
- **Found during:** Task 1 (Prisma generate)
- **Issue:** Removing @unique on akteId made the one-to-one relation invalid; Prisma required @unique or one-to-many
- **Fix:** Changed `channel Channel?` to `channels Channel[]` on Akte model
- **Files modified:** prisma/schema.prisma
- **Verification:** Prisma generate succeeds, no downstream references to akte.channel found
- **Committed in:** 937e72f (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both were necessary consequences of the compound unique constraint change. No scope creep.

## Issues Encountered
- 7 pre-existing TypeScript errors in falldaten-tab.tsx and helena/index.ts remain unrelated to changes.
- Plan referenced MandantUser as a separate model but the actual architecture uses User with role=MANDANT. Adapted all code to use existing User model.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PORTAL channel infrastructure complete: schema, service, API routes, sidebar, Akte-Detail tab
- Ready for Phase 47 Plan 02 (Portal UI chat page for Mandant)
- Portal-side pages can fetch channels via /api/portal/akten/[id]/channel and messages via /api/portal/akten/[id]/messages

## Self-Check: PASSED

All artifacts verified:
- 47-01-SUMMARY.md exists
- Commit 937e72f (Task 1) exists
- Commit 5be55b7 (Task 2) exists
- All 13 files created/modified exist
- PORTAL in schema, createPortalChannel in service, Mandantenportal in sidebar, PortalChannelTab in detail tabs

---
*Phase: 47-portal-messaging*
*Completed: 2026-03-03*
