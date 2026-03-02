---
phase: 31-messaging-schema-api
plan: 02
subsystem: api, messaging
tags: [next.js, api-routes, channels, membership, rbac, zod, messaging]

# Dependency graph
requires:
  - phase: 31-messaging-schema-api
    provides: Channel, ChannelMember Prisma models, channel-service.ts (createChannel, gatherAkteMemberIds, syncAkteChannelMembers, getUnreadCount, generateSlug)
provides:
  - GET/POST /api/channels (list with unread counts + browse mode, create ALLGEMEIN)
  - GET/PATCH/DELETE /api/channels/{id} (detail with members, update name/description, archive)
  - GET/POST/DELETE /api/channels/{id}/members (list, join, leave ALLGEMEIN channels)
  - PATCH /api/channels/{id}/read (mark channel as read)
  - GET /api/akten/{id}/channel (lazy-create AKTE channel with RBAC member sync)
affects: [31-03-PLAN, 32-messaging-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin API routes calling service layer: route files validate + delegate to channel-service.ts"
    - "Browse mode: ?browse=true on GET /api/channels returns all ALLGEMEIN channels with joined flag"
    - "AKTE channel lazy creation: GET creates on first access, handles P2002 race condition"
    - "AKTE channels are immutable from API: no PATCH or DELETE allowed"

key-files:
  created:
    - src/app/api/channels/route.ts
    - src/app/api/channels/[id]/route.ts
    - src/app/api/channels/[id]/members/route.ts
    - src/app/api/channels/[id]/read/route.ts
    - src/app/api/akten/[id]/channel/route.ts
  modified: []

key-decisions:
  - "Browse mode on GET /api/channels returns all non-archived ALLGEMEIN channels with joined boolean, not just user memberships"
  - "AKTE channel lazy creation fetches kurzrubrum separately since requireAkteAccess only returns limited select"
  - "P2002 race condition on AKTE channel creation handled by catch-and-retry findUnique pattern"
  - "Membership join/leave restricted to ALLGEMEIN channels only; AKTE membership managed by syncAkteChannelMembers"

patterns-established:
  - "Channel API route pattern: requireAuth/requireAkteAccess first, Zod validation, then service layer call"
  - "AKTE immutability pattern: PATCH and DELETE reject with 400 for AKTE channels"
  - "Member-only access pattern: channel detail returns 404 for non-members (hides channel existence)"

requirements-completed: [MSG-01, MSG-02, MSG-04]

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 31 Plan 02: Channel API Routes Summary

**5 REST API route files covering channel CRUD, browse/join/leave membership, read-marking, and AKTE channel lazy creation with RBAC gating**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T08:02:47Z
- **Completed:** 2026-03-02T08:05:18Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Channel list endpoint with unread counts, typ filtering, and browse mode for discovering channels to join
- Full channel CRUD: create ALLGEMEIN channels with Zod validation, update name/description, archive (soft-delete)
- Membership management: join/leave for ALLGEMEIN channels, list members with user details
- AKTE channel lazy creation on first GET with RBAC member sync and P2002 race condition handling
- Read-marking endpoint updates lastReadAt on ChannelMember for unread tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Channel list/create + detail/update/archive API routes** - `529e534` (feat)
2. **Task 2: Membership routes + read-marking + AKTE channel lazy creation** - `d3bac7d` (feat)

## Files Created/Modified
- `src/app/api/channels/route.ts` - GET (list user channels with unread counts + browse mode), POST (create ALLGEMEIN channel)
- `src/app/api/channels/[id]/route.ts` - GET (channel detail with members), PATCH (update name/description), DELETE (archive)
- `src/app/api/channels/[id]/members/route.ts` - GET (list members), POST (join ALLGEMEIN channel), DELETE (leave)
- `src/app/api/channels/[id]/read/route.ts` - PATCH (mark channel as read via lastReadAt update)
- `src/app/api/akten/[id]/channel/route.ts` - GET (lazy-create AKTE channel with RBAC member sync)

## Decisions Made
- Browse mode (GET /api/channels?browse=true) returns all non-archived ALLGEMEIN channels with a `joined` boolean flag for the requesting user
- AKTE channel name uses kurzrubrum fetched separately since requireAkteAccess returns limited select fields
- Race condition on concurrent AKTE channel creation handled via P2002 catch with findUnique retry
- AKTE channels reject PATCH and DELETE with 400 status -- they are managed by the Akte lifecycle
- Membership join/leave restricted to ALLGEMEIN only; AKTE membership managed automatically by syncAkteChannelMembers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 channel API routes ready for Phase 31-03 (message CRUD routes) and Phase 32 (messaging UI)
- Channel list endpoint with unread counts ready for sidebar channel list component
- Browse mode ready for "discover channels" UI panel
- AKTE channel lazy creation ready for Akte detail page integration

---
*Phase: 31-messaging-schema-api*
*Completed: 2026-03-02*
