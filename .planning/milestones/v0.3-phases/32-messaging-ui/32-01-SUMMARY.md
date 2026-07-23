---
phase: 32-messaging-ui
plan: 01
subsystem: ui
tags: [react, messaging, channels, chat, mentions, glass-ui, slack-style]

# Dependency graph
requires:
  - phase: 31-messaging-schema-api
    provides: "Channel + Message Prisma models, REST API routes (/api/channels, /api/channels/[id]/messages, /api/channels/[id]/members, /api/channels/[id]/read, /api/channels/[id]/reactions), ChannelListItem and MessageListItem types"
provides:
  - "Slack-style /nachrichten split layout with channel sidebar + message view"
  - "Channel list with ALLGEMEIN/AKTEN sections and unread count badges"
  - "Create channel dialog (POST /api/channels)"
  - "Message list with author grouping, pagination, and chat bubble display"
  - "Message composer with Enter=send, @mention picker, DMS document attachment"
  - "Reaction emoji pills with toggle on click"
affects: [32-02-PLAN, real-time-socket-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [slack-style-split-layout, mention-picker-inline-autocomplete, banner-refetch-pattern, author-grouping-5min-window]

key-files:
  created:
    - src/components/messaging/messaging-layout.tsx
    - src/components/messaging/channel-sidebar.tsx
    - src/components/messaging/channel-list-item.tsx
    - src/components/messaging/create-channel-dialog.tsx
    - src/components/messaging/message-view.tsx
    - src/components/messaging/message-list.tsx
    - src/components/messaging/message-bubble.tsx
    - src/components/messaging/message-composer.tsx
    - src/components/messaging/mention-picker.tsx
  modified:
    - src/app/(dashboard)/nachrichten/page.tsx

key-decisions:
  - "MentionPicker uses document-level keydown listener for Enter selection to avoid double-handling with textarea"
  - "DMS document picker fetches from /api/dokumente (global) not akte-scoped, since channels are cross-akte"
  - "Array.from(new Set()) instead of spread for Set to avoid downlevelIteration TS config"

patterns-established:
  - "Slack-style split layout: glass-panel sidebar (w-60) + glass-card message view with flex gap-4"
  - "Author grouping: consecutive messages from same author within 5 minutes hide repeated headers"
  - "@mention picker: triggered by @ in textarea, filtered by startsWith, arrow keys + Enter navigation"
  - "Message alignment: own=right with violet tint, other=left, system=centered with Bot icon"

requirements-completed: [MSG-06]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 32 Plan 01: Core Messaging UI Summary

**Slack-style split layout at /nachrichten with channel sidebar (ALLGEMEIN/AKTEN sections, unread badges), chat-bubble message view with author grouping, @mention picker, DMS attachment support, and create-channel dialog**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T08:50:00Z
- **Completed:** 2026-03-02T08:54:33Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Replaced placeholder nachrichten page with full Slack-style messaging UI (10 components)
- Channel sidebar with collapsible ALLGEMEIN/AKTEN sections, sorted by lastMessageAt, violet unread count badges
- Message view with chat bubbles (own=right violet, other=left, system=centered), author grouping (5min window), pagination, mark-as-read
- Message composer with Enter=send, Shift+Enter=newline, @mention inline picker, @Helena button, DMS document attachment via Paperclip button
- Create channel dialog with name + beschreibung fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Messaging page shell + split layout + channel sidebar with unread badges** - `ebfd95f` (feat)
2. **Task 2: Message view + message list + message bubble + composer + @mention picker** - `ccfe9dd` (feat)

## Files Created/Modified
- `src/app/(dashboard)/nachrichten/page.tsx` - Server component shell rendering MessagingLayout
- `src/components/messaging/messaging-layout.tsx` - Slack-style split layout with channel sidebar + message view, state lifting for selectedChannelId
- `src/components/messaging/channel-sidebar.tsx` - Left panel with ALLGEMEIN/AKTEN collapsible sections, unread badges, + Neuer Kanal button
- `src/components/messaging/channel-list-item.tsx` - Channel row with Hash/FolderOpen icon, name, violet unread Badge
- `src/components/messaging/create-channel-dialog.tsx` - Dialog with name/beschreibung fields, POST /api/channels, success toast
- `src/components/messaging/message-view.tsx` - Right panel: fetches messages, mark-as-read, load-older pagination, new-messages banner
- `src/components/messaging/message-list.tsx` - Scrollable message container with author grouping, scroll-to-bottom, shimmer skeleton
- `src/components/messaging/message-bubble.tsx` - Chat bubble with alignment (own/other/system), avatar initials, reply-to snippet, reaction pills
- `src/components/messaging/message-composer.tsx` - Textarea with Enter=send, @mention trigger, @Helena button, Paperclip DMS picker, attachment chips
- `src/components/messaging/mention-picker.tsx` - Inline autocomplete dropdown with @alle, @Helena, arrow key navigation

## Decisions Made
- MentionPicker uses document-level keydown listener (capture phase) for Enter selection to avoid double-handling with textarea onKeyDown
- DMS document picker fetches from /api/dokumente (global, not akte-scoped) since channels are cross-akte
- Used Array.from(new Set()) instead of spread operator to avoid TS downlevelIteration requirement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Set spread TypeScript error**
- **Found during:** Task 2 (message-composer.tsx)
- **Issue:** `[...new Set(mentionIds)]` fails with TS error TS2802 (downlevelIteration flag)
- **Fix:** Changed to `Array.from(new Set(mentionIds))`
- **Files modified:** src/components/messaging/message-composer.tsx
- **Verification:** `npx tsc --noEmit` passes with no messaging errors
- **Committed in:** ccfe9dd (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial syntax fix for TypeScript compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 10 messaging UI components ready for Plan 02 (Socket.IO real-time integration)
- Components consume Phase 31 REST APIs for channels, messages, members, reactions, mark-as-read
- State-lifting pattern in messaging-layout.tsx enables refetch callbacks from any child component
- Banner refetch pattern ready for Socket.IO new-message events to set hasNewMessages flag

## Self-Check: PASSED

All 10 files verified present. Both task commits (ebfd95f, ccfe9dd) verified in git log.

---
*Phase: 32-messaging-ui*
*Completed: 2026-03-02*
