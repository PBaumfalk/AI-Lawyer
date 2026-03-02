---
phase: 32-messaging-ui
plan: 02
subsystem: ui
tags: [react, socket.io, real-time, typing-indicator, messaging, channels, sidebar-badge, akte-tab]

# Dependency graph
requires:
  - phase: 32-messaging-ui
    plan: 01
    provides: "Static messaging UI components (MessagingLayout, MessageView, MessageList, MessageBubble, MessageComposer, MentionPicker)"
  - phase: 31-messaging-schema-api
    provides: "Socket.IO events (join:channel, leave:channel, typing:start/stop, message:new/edited/deleted), REST API routes, types"
provides:
  - "MessagingSocketBridge for channel room join/leave lifecycle"
  - "TypingIndicator with ephemeral display and 5s auto-cleanup"
  - "Real-time message:new banner refetch, message:edited/deleted local updates"
  - "Sidebar unread messages badge with Socket.IO refresh"
  - "AkteChannelTab for Akte detail Nachrichten tab with lazy channel loading"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [socket-bridge-invisible-component, typing-debounce-3s, banner-refetch-pattern, sidebar-badge-aggregate-fetch]

key-files:
  created:
    - src/components/messaging/messaging-socket-bridge.tsx
    - src/components/messaging/typing-indicator.tsx
    - src/components/messaging/akte-channel-tab.tsx
  modified:
    - src/components/messaging/message-view.tsx
    - src/components/messaging/message-composer.tsx
    - src/components/layout/sidebar.tsx
    - src/components/akten/akte-detail-tabs.tsx

key-decisions:
  - "Banner refetch for message:new (not auto-insert) -- consistent with activity-feed.tsx pattern"
  - "Typing debounce 3s timeout with typing:start on each keystroke and typing:stop on pause"
  - "Sidebar unread badge fetches aggregate from /api/channels on mount + Socket.IO message:new events"
  - "AkteChannelTab has fixed 600px height container for consistent Akte tab layout"

patterns-established:
  - "MessagingSocketBridge: invisible client component for Socket.IO room lifecycle, same pattern as AkteSocketBridge"
  - "TypingIndicator: Map-based state with per-user 5s auto-cleanup timeouts, channelIdRef for stale closure prevention"
  - "onTyping callback pattern: MessageComposer emits typing events via parent-provided callback"

requirements-completed: [MSG-06, MSG-07, MSG-08]

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 32 Plan 02: Real-Time Socket.IO + Akte Nachrichten Tab Summary

**Socket.IO channel room management, typing indicators with 5s auto-cleanup, banner refetch for new messages, sidebar unread badge, and Akte Nachrichten tab with lazy channel loading**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-02T08:57:34Z
- **Completed:** 2026-03-02T09:00:34Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- MessagingSocketBridge joins/leaves channel rooms on channel switch following AkteSocketBridge pattern
- TypingIndicator shows ephemeral "X tippt..." / "X und Y tippen..." with Map-based state and 5s auto-cleanup
- Real-time Socket.IO listeners: message:new triggers banner refetch, message:edited/deleted update local state
- Sidebar Nachrichten NavItem shows violet unread badge with aggregate count from /api/channels
- AkteChannelTab lazy-loads AKTE channel and renders full MessageView in Akte detail Nachrichten tab
- Typing emission in MessageComposer with 3s debounce (typing:start on keystroke, typing:stop on pause)

## Task Commits

Each task was committed atomically:

1. **Task 1: Socket bridge + typing indicator + real-time message handling** - `93253de` (feat)
2. **Task 2: Sidebar unread badge + Akte Nachrichten tab** - `18d09a4` (feat)

## Files Created/Modified
- `src/components/messaging/messaging-socket-bridge.tsx` - Invisible component for Socket.IO channel room join/leave
- `src/components/messaging/typing-indicator.tsx` - Ephemeral typing display with 5s auto-cleanup
- `src/components/messaging/akte-channel-tab.tsx` - Akte tab content: lazy-loads channel, renders MessageView
- `src/components/messaging/message-view.tsx` - Added Socket.IO listeners for message:new/edited/deleted, typing emission, bridge + indicator
- `src/components/messaging/message-composer.tsx` - Added onTyping callback prop, called on each keystroke
- `src/components/layout/sidebar.tsx` - Added unreadMessages badgeKey, fetchMessageCount, Socket.IO listener
- `src/components/akten/akte-detail-tabs.tsx` - Added Nachrichten tab with MessageSquare icon and AkteChannelTab

## Decisions Made
- Banner refetch for message:new (not auto-insert) to stay consistent with activity-feed.tsx pattern and avoid optimistic insertion bugs
- Typing debounce uses 3s timeout: typing:start emitted on every keystroke, typing:stop emitted after 3s pause
- Sidebar unread badge fetches aggregate from /api/channels -- catches message:new in active channel room; for a 5-person Kanzlei, badge is accurate on page load
- AkteChannelTab fixed at 600px height to prevent layout jumping in the Akte detail tab area

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 32 (Messaging UI) is fully complete: static UI (Plan 01) + real-time Socket.IO integration (Plan 02)
- All MSG-06 (sidebar badge), MSG-07 (@Helena mention), MSG-08 (typing indicator) requirements are satisfied
- The messaging system is production-ready for a 5-person Kanzlei with real-time updates

---
*Phase: 32-messaging-ui*
*Completed: 2026-03-02*
