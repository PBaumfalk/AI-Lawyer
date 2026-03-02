# Phase 32: Messaging UI - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

User-facing messaging interface for the channel/message system built in Phase 31. Replaces the /nachrichten placeholder with a full Slack-style messaging UI. Includes channel list, message view, Akte-thread tab, unread badges, typing indicators, and @Helena integration. All API routes exist from Phase 31 — this phase is purely frontend.

</domain>

<decisions>
## Implementation Decisions

### Page Layout
- Slack-style split layout on /nachrichten: left panel channel list (~240px) + right panel message view
- Both panels visible simultaneously — no page navigation to switch channels
- Channel list sidebar uses glass-panel (tier 3), message view uses glass-card (tier 2)
- Replace the existing placeholder at src/app/(dashboard)/nachrichten/page.tsx

### Channel List Sidebar
- Two collapsible sections: ALLGEMEIN at top, AKTEN below
- Channels sorted by most recent activity within each group
- Unread badge per channel (violet Badge component, matching sidebar pattern)
- "+ Neuer Kanal" button at bottom for creating ALLGEMEIN channels
- Selected channel highlighted with active state
- Akte channels show kurzrubrum or Aktenzeichen as channel name

### Message Display
- Chat bubble style: own messages right-aligned, others left-aligned
- Avatar initials + name + timestamp above each message group
- Reply-to shows quoted snippet above the replied message
- Reactions displayed below message bubble as grouped emoji counts
- Soft-deleted messages show "Nachricht geloescht" placeholder
- Edited messages show "(bearbeitet)" label after timestamp
- System messages (Helena) styled distinctly (centered or with bot icon)

### Akte-Thread Integration
- New "Nachrichten" tab in AkteDetailTabs on the Akte detail page
- Shows the same chat UI as /nachrichten but scoped to the Akte's channel
- Auto-creates AKTE channel on first tab visit (lazy creation via GET /api/akten/[id]/channel)
- Also accessible from /nachrichten channel list under AKTEN section

### Composer + @Mention Picker
- Reuse activity feed composer pattern: textarea, Enter=send, Shift+Enter=newline, auto-resize
- Inline autocomplete dropdown: typing @ triggers member list above cursor
- Arrow keys to navigate, Enter to select mention
- @alle option in dropdown for mentioning all members
- @Helena button (Bot icon) like activity feed composer — inserts "@Helena " at cursor
- File attachment button for DMS document picker (attach from existing documents)
- Glass-input styling on composer wrapper

### Unread Badges + Real-Time
- Add badgeKey "unreadMessages" to Nachrichten sidebar NavItem
- Aggregate unread count from GET /api/channels (sum of unreadCount)
- Socket.IO listener for unread count updates (follow helena:alert-badge pattern)
- Banner refetch pattern for new messages — Socket.IO triggers "new messages" banner, click re-fetches
- Typing indicator: "Anna tippt..." text below message list, ephemeral via socket

### Claude's Discretion
- Exact component decomposition and file structure
- Create-channel modal/dialog design
- Loading skeletons and empty states
- Message grouping by time (consecutive messages from same author)
- Scroll-to-bottom behavior on new messages
- Channel search/filter in the channel list
- Responsive behavior (mobile breakpoints)

</decisions>

<specifics>
## Specific Ideas

- Channel list should feel like Slack's sidebar — compact, scannable, unread counts prominent
- Message bubbles should use glass-card styling with subtle backdrop blur, not solid backgrounds
- The composer should be identical in behavior to the activity feed composer (same keyboard shortcuts, same auto-resize)
- Akte channels should show the Akte's Aktenzeichen or kurzrubrum as the channel name, not a generic "Akte Channel"

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/akten/activity-feed-composer.tsx`: Direct template for messaging composer (textarea, @Helena, Enter/Shift+Enter)
- `src/components/akten/activity-feed.tsx`: Scroll container pattern, Socket.IO event handling, banner refetch, cursor pagination
- `src/components/layout/sidebar.tsx`: Badge pattern (badgeKey, violet Badge, socket listener) — lines 93-178
- `src/components/ui/glass-panel.tsx`: GlassPanel component with elevation prop
- `src/components/ui/badge.tsx`: Badge component for unread counts
- `src/components/socket-provider.tsx`: useSocket() hook for real-time events
- `src/components/notifications/notification-provider.tsx`: Socket reconnect catch-up pattern

### Established Patterns
- Glass UI: 4 blur tiers (glass-input, glass-card, glass-panel, glass-panel-elevated)
- Socket.IO: useSocket() hook, event on/off in useEffect cleanup, banner refetch (not auto-insert)
- Data fetching: Server component Prisma fetch + JSON serialize for initial data, client-side SWR/fetch for updates
- Sidebar badges: badgeKey on NavItem, useState + socket listener, badgeCounts record

### Integration Points
- `src/app/(dashboard)/nachrichten/page.tsx`: Replace placeholder with full messaging UI
- `src/components/layout/sidebar.tsx` line 65: Add badgeKey "unreadMessages" to Nachrichten NavItem
- `src/components/akten/akte-detail-tabs.tsx`: Add "Nachrichten" tab for Akte channel
- `src/app/(dashboard)/akten/[id]/page.tsx`: Pass channel data to AkteDetailTabs
- Socket.IO events to listen: message:new, message:edited, message:deleted, typing:update
- API routes: GET/POST /api/channels, GET/POST /api/channels/[id]/messages, POST /api/channels/[id]/read, POST/DELETE /api/channels/[id]/reactions

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-messaging-ui*
*Context gathered: 2026-03-02*
