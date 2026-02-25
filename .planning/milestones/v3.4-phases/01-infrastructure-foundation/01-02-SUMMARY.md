---
phase: 01-infrastructure-foundation
plan: 02
subsystem: infra
tags: [socket.io, websocket, notifications, real-time, redis-adapter, jwt, popover, sonner, date-fns]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Redis connection factory, Socket.IO Redis emitter, Prisma Notification model, esbuild bundling pipeline"
provides:
  - "Custom server.ts wrapping Next.js with Socket.IO on same port 3000"
  - "Socket.IO Redis adapter for horizontal scaling"
  - "JWT authentication middleware for Socket.IO handshake (cookie + explicit token)"
  - "Room management: user:{id}, role:{ROLE}, akte:{id}"
  - "SocketProvider React context with connection state"
  - "Notification service with Prisma persistence and real-time Socket.IO delivery"
  - "REST API for notification catch-up and management (GET/PATCH)"
  - "NotificationProvider with real-time events, toasts, browser push, reconnect catch-up"
  - "NotificationBell with unread count badge and Popover dropdown"
  - "NotificationCenter with type icons, relative time, retry for failed jobs"
affects: [01-03, 02, 03, 04, 05, 06]

# Tech tracking
tech-stack:
  added: ["@radix-ui/react-popover"]
  patterns: [socket-io-jwt-auth, room-naming-convention, notification-service-pattern, catch-up-on-reconnect, cookie-first-auth]

key-files:
  created:
    - src/server.ts
    - src/lib/socket/server.ts
    - src/lib/socket/auth.ts
    - src/lib/socket/rooms.ts
    - src/components/socket-provider.tsx
    - src/lib/notifications/types.ts
    - src/lib/notifications/service.ts
    - src/components/notifications/notification-provider.tsx
    - src/components/notifications/notification-bell.tsx
    - src/components/notifications/notification-center.tsx
    - src/app/api/notifications/route.ts
    - src/components/ui/popover.tsx
    - src/components/ui/separator.tsx
  modified:
    - src/app/(dashboard)/layout.tsx
    - src/components/layout/header.tsx
    - package.json

key-decisions:
  - "Cookie-first auth strategy: Socket.IO extracts NextAuth session-token from cookies (same-origin), falls back to explicit token for cross-origin/mobile"
  - "Room naming convention: user:{userId}, role:{ROLE}, akte:{akteId} — consistent across emitter and server"
  - "Notification catch-up via since parameter on GET /api/notifications — client tracks last-seen timestamp and fetches missed on reconnect"
  - "Browser push notifications only when tab is backgrounded (document.hidden) to avoid double-notification with sonner toast"

patterns-established:
  - "Socket.IO JWT auth: cookie extraction (dev + production prefixed) then explicit token fallback"
  - "Room convention: user:{id} for personal, role:{ROLE} for broadcasts, akte:{id} for case-specific"
  - "Notification lifecycle: create -> persist (Prisma) -> emit (Socket.IO) -> toast (sonner) -> catch-up (REST API)"
  - "Provider hierarchy: SessionProvider > SocketProvider > NotificationProvider in dashboard layout"

requirements-completed: [REQ-IF-003]

# Metrics
duration: 5min
completed: 2026-02-24
---

# Phase 1 Plan 2: Socket.IO + Notification System Summary

**Custom server.ts with Socket.IO WebSocket on same port, JWT auth middleware, notification service with Prisma persistence, real-time delivery, bell icon with dropdown center, and catch-up API for missed notifications**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-24T08:25:18Z
- **Completed:** 2026-02-24T08:31:03Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Custom server.ts wraps Next.js HTTP server with Socket.IO attached on same port 3000, using Redis adapter for horizontal scaling
- JWT authentication middleware validates NextAuth session tokens in Socket.IO handshake (cookie-first, explicit token fallback), rejecting unauthenticated connections with German error messages
- Full notification lifecycle: Prisma persistence, real-time Socket.IO delivery, sonner toasts, browser push notifications, and reconnect catch-up via REST API
- Notification bell icon with unread count badge (99+ cap) and Popover dropdown showing last 50 notifications with type icons, relative time, read/dismiss/retry actions
- Dashboard layout properly wraps content in SessionProvider > SocketProvider > NotificationProvider hierarchy

## Task Commits

Each task was committed atomically:

1. **Task 1: Custom server.ts with Socket.IO, JWT auth, and room management** - `126763e` (feat)
2. **Task 2: Notification service, bell icon, notification center, and catch-up API** - `098b0d8` (feat)

## Files Created/Modified
- `src/server.ts` - Custom Next.js server entrypoint with Socket.IO attached on same HTTP server
- `src/lib/socket/server.ts` - Socket.IO server setup with Redis adapter, auth, and rooms
- `src/lib/socket/auth.ts` - JWT authentication middleware extracting NextAuth tokens from cookies or handshake
- `src/lib/socket/rooms.ts` - Room join/leave logic for user, role, and akte rooms
- `src/components/socket-provider.tsx` - React context providing Socket.IO client instance and connection state
- `src/lib/notifications/types.ts` - NotificationType, NotificationPayload, NotificationResponse type definitions
- `src/lib/notifications/service.ts` - Notification CRUD (create, list, mark read, dismiss) with Socket.IO real-time delivery
- `src/components/notifications/notification-provider.tsx` - Client-side notification state manager with real-time events, toasts, and catch-up
- `src/components/notifications/notification-bell.tsx` - Header bell icon with unread count badge and Popover
- `src/components/notifications/notification-center.tsx` - Dropdown notification list with type icons, time, retry, dismiss
- `src/app/api/notifications/route.ts` - GET (fetch/catch-up) and PATCH (read/readAll/dismiss) endpoints
- `src/components/ui/popover.tsx` - shadcn/ui Popover component for notification dropdown
- `src/components/ui/separator.tsx` - shadcn/ui Separator component for notification center header
- `src/app/(dashboard)/layout.tsx` - Updated with SocketProvider and NotificationProvider wrappers
- `src/components/layout/header.tsx` - Replaced placeholder bell with real NotificationBell component
- `package.json` - Added @radix-ui/react-popover dependency

## Decisions Made
- Cookie-first auth strategy for Socket.IO: extracts NextAuth session-token from cookies (handles both dev and production __Secure- prefix), falls back to explicit token — avoids exposing JWT to client JavaScript
- Room naming convention: user:{userId}, role:{ROLE}, akte:{akteId} — consistent between server rooms and Redis emitter
- Notification catch-up via `since` parameter on GET /api/notifications — client tracks last-seen timestamp and fetches missed on reconnect rather than replaying Socket.IO events
- Browser push notifications only when tab is backgrounded (document.hidden) to avoid double-notification with sonner toast

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing shadcn/ui Popover and Separator components**
- **Found during:** Task 2 (Notification bell and center)
- **Issue:** Popover and Separator UI components were not yet in the project; @radix-ui/react-popover was not installed
- **Fix:** Installed @radix-ui/react-popover, created src/components/ui/popover.tsx and src/components/ui/separator.tsx following shadcn/ui patterns
- **Files modified:** package.json, src/components/ui/popover.tsx, src/components/ui/separator.tsx
- **Verification:** TypeScript compilation passes, components render correctly
- **Committed in:** 098b0d8 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Prisma JSON field type mismatch in notification service**
- **Found during:** Task 2 (Notification service)
- **Issue:** `Record<string, unknown>` not assignable to Prisma's `InputJsonValue` for the `data` field
- **Fix:** Cast to `Prisma.InputJsonValue` with proper null guard
- **Files modified:** src/lib/notifications/service.ts
- **Verification:** TypeScript compilation passes clean
- **Committed in:** 098b0d8 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for functionality. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. All services run in Docker Compose.

## Next Phase Readiness
- Socket.IO server ready for any future real-time features (document collaboration, AI progress updates)
- Notification service ready for use by all future workers and API routes via `createNotification()`
- Room infrastructure ready for case-specific updates (akte rooms)
- Catch-up API ensures no missed notifications after connectivity issues

## Self-Check: PASSED

All 15 created/modified files verified present. Both task commits (126763e, 098b0d8) verified in git log.

---
*Phase: 01-infrastructure-foundation*
*Completed: 2026-02-24*
