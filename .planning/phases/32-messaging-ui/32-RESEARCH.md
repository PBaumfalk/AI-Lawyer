# Phase 32: Messaging UI - Research

**Researched:** 2026-03-02
**Domain:** Real-time chat UI (Slack-style messaging interface)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Slack-style split layout on /nachrichten: left panel channel list (~240px) + right panel message view
- Both panels visible simultaneously -- no page navigation to switch channels
- Channel list sidebar uses glass-panel (tier 3), message view uses glass-card (tier 2)
- Replace the existing placeholder at src/app/(dashboard)/nachrichten/page.tsx
- Two collapsible sections: ALLGEMEIN at top, AKTEN below
- Channels sorted by most recent activity within each group
- Unread badge per channel (violet Badge component, matching sidebar pattern)
- "+ Neuer Kanal" button at bottom for creating ALLGEMEIN channels
- Selected channel highlighted with active state
- Akte channels show kurzrubrum or Aktenzeichen as channel name
- Chat bubble style: own messages right-aligned, others left-aligned
- Avatar initials + name + timestamp above each message group
- Reply-to shows quoted snippet above the replied message
- Reactions displayed below message bubble as grouped emoji counts
- Soft-deleted messages show "Nachricht geloescht" placeholder
- Edited messages show "(bearbeitet)" label after timestamp
- System messages (Helena) styled distinctly (centered or with bot icon)
- New "Nachrichten" tab in AkteDetailTabs on the Akte detail page
- Shows the same chat UI as /nachrichten but scoped to the Akte's channel
- Auto-creates AKTE channel on first tab visit (lazy creation via GET /api/akten/[id]/channel)
- Also accessible from /nachrichten channel list under AKTEN section
- Reuse activity feed composer pattern: textarea, Enter=send, Shift+Enter=newline, auto-resize
- Inline autocomplete dropdown: typing @ triggers member list above cursor
- Arrow keys to navigate, Enter to select mention
- @alle option in dropdown for mentioning all members
- @Helena button (Bot icon) like activity feed composer -- inserts "@Helena " at cursor
- File attachment button for DMS document picker (attach from existing documents)
- Glass-input styling on composer wrapper
- Add badgeKey "unreadMessages" to Nachrichten sidebar NavItem
- Aggregate unread count from GET /api/channels (sum of unreadCount)
- Socket.IO listener for unread count updates (follow helena:alert-badge pattern)
- Banner refetch pattern for new messages -- Socket.IO triggers "new messages" banner, click re-fetches
- Typing indicator: "Anna tippt..." text below message list, ephemeral via socket

### Claude's Discretion
- Exact component decomposition and file structure
- Create-channel modal/dialog design
- Loading skeletons and empty states
- Message grouping by time (consecutive messages from same author)
- Scroll-to-bottom behavior on new messages
- Channel search/filter in the channel list
- Responsive behavior (mobile breakpoints)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MSG-06 | User sees unread message count badges per channel | Sidebar badge pattern (badgeKey + Socket.IO listener), getUnreadCount API, channel list unreadCount field, PATCH /api/channels/[id]/read for mark-as-read |
| MSG-07 | User can @Helena in a channel message to trigger a HelenaTask | Backend fully implemented in message-service.ts (hasHelenaMention + createHelenaTask with channelId). Frontend needs @mention picker with Helena option. postHelenaResponseToChannel already posts back to channel. |
| MSG-08 | User sees typing indicators when others are composing | Server-side typing:start/typing:stop events already implemented in socket/rooms.ts. Frontend needs to emit typing:start/stop and listen for typing events with debounce/timeout. |
</phase_requirements>

## Summary

Phase 32 is a **purely frontend phase**. All API routes, database models, Socket.IO room management, typing indicator relay, Helena @mention detection, and Helena response posting are already implemented in Phase 31. The task is to build a Slack-style messaging UI that consumes these existing APIs and real-time events.

The project has strong precedent patterns to follow. The activity feed (`activity-feed.tsx` + `activity-feed-composer.tsx`) provides the exact template for scroll containers, Socket.IO event handling, banner refetch, cursor pagination, and @Helena mention insertion. The sidebar badge system (`sidebar.tsx` lines 93-178) demonstrates the badgeKey + Socket.IO listener pattern for unread counts. The AkteSocketBridge shows the canonical pattern for joining/leaving Socket.IO rooms dynamically. The typing indicator server relay is already implemented in `socket/rooms.ts` (typing:start/stop events).

**Primary recommendation:** Build the messaging UI as a set of composable client components that mirror the activity feed architecture, reusing the established Glass UI, Socket.IO, and pagination patterns exactly. No new npm packages required.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (Next.js 14+) | 14.x | App framework | Already in project |
| Socket.IO Client | 4.x | Real-time messaging events | Already in project via socket-provider |
| Tailwind CSS | 3.x | Styling with Glass UI utility classes | Already in project |
| shadcn/ui | n/a | Badge, Tabs, Dialog, AlertDialog components | Already in project |
| lucide-react | n/a | Icons (MessageSquare, Bot, Send, etc.) | Already in project |
| motion/react | n/a | Sidebar animations, optional message transitions | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | n/a | Toast notifications for errors | Already in project |
| zod | n/a | Client-side form validation (channel creation) | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom scroll management | react-virtualized/tanstack-virtual | Overkill for 50-message pages with cursor pagination; add complexity |
| SWR/React Query for data fetching | Plain fetch + useState | Project already uses plain fetch pattern in activity feed; consistency wins |

**Installation:**
```bash
# No new packages needed -- zero new npm packages policy
```

## Architecture Patterns

### Recommended Component Structure
```
src/
├── app/(dashboard)/nachrichten/
│   └── page.tsx                    # Server component shell, fetches initial channels
├── components/messaging/
│   ├── messaging-layout.tsx        # Split layout: sidebar + message view
│   ├── channel-sidebar.tsx         # Left panel: channel list with sections
│   ├── channel-list-item.tsx       # Individual channel row with unread badge
│   ├── create-channel-dialog.tsx   # Modal for creating ALLGEMEIN channels
│   ├── message-view.tsx            # Right panel: messages + composer
│   ├── message-list.tsx            # Scrollable message container with pagination
│   ├── message-bubble.tsx          # Single message bubble (own vs other alignment)
│   ├── message-composer.tsx        # Textarea + @mention picker + Helena button
│   ├── mention-picker.tsx          # Inline autocomplete dropdown for @mentions
│   ├── typing-indicator.tsx        # "Anna tippt..." ephemeral display
│   └── messaging-socket-bridge.tsx # Invisible: joins/leaves channel rooms, emits typing
├── components/akten/
│   └── akte-detail-tabs.tsx        # Modified: add "Nachrichten" tab
```

### Pattern 1: Split Layout with Client-Side Channel Switching
**What:** The /nachrichten page renders a fixed split layout. Channel selection is client-side state -- clicking a channel in the sidebar sets the selectedChannelId, which triggers the message view to fetch that channel's messages. No URL changes per channel (all within single page).
**When to use:** Always for the main messaging page.
**Example:**
```typescript
// messaging-layout.tsx
"use client";

import { useState } from "react";
import { ChannelSidebar } from "./channel-sidebar";
import { MessageView } from "./message-view";
import type { ChannelListItem } from "@/lib/messaging/types";

interface MessagingLayoutProps {
  initialChannels: ChannelListItem[];
}

export function MessagingLayout({ initialChannels }: MessagingLayoutProps) {
  const [channels, setChannels] = useState(initialChannels);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    initialChannels[0]?.id ?? null
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-140px)]">
      <ChannelSidebar
        channels={channels}
        selectedId={selectedChannelId}
        onSelect={setSelectedChannelId}
        onChannelsChange={setChannels}
      />
      {selectedChannelId ? (
        <MessageView
          channelId={selectedChannelId}
          onUnreadChange={() => {/* refetch channels for badge update */}}
        />
      ) : (
        <div className="flex-1 glass-card rounded-2xl flex items-center justify-center">
          <p className="text-muted-foreground">Kanal auswaehlen</p>
        </div>
      )}
    </div>
  );
}
```

### Pattern 2: Banner Refetch for New Messages (not auto-insert)
**What:** When a `message:new` Socket.IO event arrives for the currently viewed channel, show a "Neue Nachrichten" banner at the top of the message list. Clicking the banner re-fetches from the API. This prevents optimistic insertion bugs and race conditions with cursor pagination.
**When to use:** For all new message handling in the message list.
**Example:**
```typescript
// Follow activity-feed.tsx pattern exactly
useEffect(() => {
  if (!socket) return;

  function handleNewMessage(data: MessageNewPayload) {
    if (data.channelId !== channelIdRef.current) return;
    // Don't auto-insert -- show banner instead
    setHasNewMessages(true);
  }

  socket.on("message:new", handleNewMessage);
  return () => { socket.off("message:new", handleNewMessage); };
}, [socket]);
```

### Pattern 3: Socket.IO Channel Room Join/Leave
**What:** When the user selects a channel, emit `join:channel` to join the Socket.IO room. When they switch channels or unmount, emit `leave:channel`. This mirrors the AkteSocketBridge pattern.
**When to use:** Whenever the selectedChannelId changes.
**Example:**
```typescript
// messaging-socket-bridge.tsx (or inline in message-view)
useEffect(() => {
  if (!socket || !isConnected || !channelId) return;

  socket.emit("join:channel", channelId);

  return () => {
    socket.emit("leave:channel", channelId);
  };
}, [socket, isConnected, channelId]);
```

### Pattern 4: Typing Indicator with Debounce and Auto-Timeout
**What:** On each keystroke in the composer, emit `typing:start`. Use a debounce timer (3s) that emits `typing:stop` when the user stops typing. On the receiving side, track typing users in a Map with auto-cleanup after 5s of no updates (in case `typing:stop` is missed).
**When to use:** For the typing indicator feature (MSG-08).
**Example:**
```typescript
// Emitter side (in composer)
const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

function handleTyping() {
  if (!socket || !channelId) return;
  socket.emit("typing:start", channelId);

  if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  typingTimeoutRef.current = setTimeout(() => {
    socket.emit("typing:stop", channelId);
  }, 3000);
}

// Receiver side (in typing-indicator)
const [typingUsers, setTypingUsers] = useState<Map<string, { name: string; timeout: NodeJS.Timeout }>>(new Map());

useEffect(() => {
  if (!socket) return;

  function handleStart(data: TypingPayload) {
    if (data.channelId !== channelId || data.userId === currentUserId) return;
    setTypingUsers(prev => {
      const next = new Map(prev);
      const existing = next.get(data.userId);
      if (existing) clearTimeout(existing.timeout);
      const timeout = setTimeout(() => {
        setTypingUsers(p => { const n = new Map(p); n.delete(data.userId); return n; });
      }, 5000);
      next.set(data.userId, { name: data.userName, timeout });
      return next;
    });
  }

  function handleStop(data: { channelId: string; userId: string }) {
    if (data.channelId !== channelId) return;
    setTypingUsers(prev => {
      const next = new Map(prev);
      const existing = next.get(data.userId);
      if (existing) clearTimeout(existing.timeout);
      next.delete(data.userId);
      return next;
    });
  }

  socket.on("typing:start", handleStart);
  socket.on("typing:stop", handleStop);
  return () => { socket.off("typing:start", handleStart); socket.off("typing:stop", handleStop); };
}, [socket, channelId, currentUserId]);
```

### Pattern 5: Sidebar Unread Badge (badgeKey pattern)
**What:** Add `badgeKey: "unreadMessages"` to the Nachrichten NavItem in sidebar.tsx. Add a `unreadMessagesCount` state, fetch aggregate unread count from GET /api/channels on mount, and listen for Socket.IO events to update. Follow the exact pattern of `pendingDrafts` and `unreadAlerts`.
**When to use:** For the global sidebar unread badge (MSG-06).
**Example:**
```typescript
// In sidebar.tsx -- add to navigation array
{ name: "Nachrichten", href: "/nachrichten", icon: MessageSquare, badgeKey: "unreadMessages" },

// Add state + fetch + socket listener following pendingDrafts pattern
const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

const fetchMessageCount = useCallback(async () => {
  try {
    const res = await fetch("/api/channels");
    if (res.ok) {
      const data = await res.json();
      const total = (data.channels as ChannelListItem[]).reduce(
        (sum, ch) => sum + ch.unreadCount, 0
      );
      setUnreadMessagesCount(total);
    }
  } catch { /* non-critical */ }
}, []);

// Socket.IO: re-fetch on message:new events (user room receives these)
useEffect(() => {
  if (!socket) return;
  function handleMessageNotification() { fetchMessageCount(); }
  socket.on("message:new", handleMessageNotification);
  return () => { socket.off("message:new", handleMessageNotification); };
}, [socket, fetchMessageCount]);

// Add to badgeCounts:
const badgeCounts = useMemo(() => ({
  pendingDrafts: pendingDraftsCount,
  unreadAlerts: unreadAlertsCount,
  unreadMessages: unreadMessagesCount,
}), [pendingDraftsCount, unreadAlertsCount, unreadMessagesCount]);
```

### Pattern 6: Mark-as-Read on Channel Focus
**What:** When a user selects a channel (or the message view receives focus), call PATCH /api/channels/[id]/read to update lastReadAt. This resets the unread count for that channel. Do this on initial load and on banner refetch.
**When to use:** Every time the user opens or re-focuses a channel.

### Pattern 7: Akte Channel Tab Integration
**What:** Add a "Nachrichten" tab to AkteDetailTabs. On tab activation, fetch `GET /api/akten/[id]/channel` (which lazy-creates the AKTE channel). Then render the same MessageView component used in /nachrichten, scoped to that channel.
**When to use:** For the Akte detail page integration.

### Anti-Patterns to Avoid
- **Auto-inserting messages from Socket.IO:** Use banner refetch pattern instead. Auto-insertion creates pagination cursor bugs and duplicate entries.
- **Polling for unread counts:** Use Socket.IO events to trigger refetch instead of periodic polling.
- **Storing channel selection in URL params:** Keep it in client state. URL-based channel routing adds complexity and fights with Next.js App Router server components.
- **Separate fetch libraries (SWR/React Query):** Project uses plain fetch + useState consistently. Adding SWR for just messaging creates inconsistency.
- **Custom virtualized list:** With 50-message pages and cursor pagination, the DOM node count stays manageable. Virtual scrolling adds complexity without clear benefit for a 5-person Kanzlei.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| @mention autocomplete | Custom tokenizer + position calculation | Trigger on "@" keypress, compute dropdown position from textarea selectionStart | The textarea approach is simpler than contentEditable; just need character-at-cursor detection |
| Unread tracking | Custom counter with client-side delta tracking | Server-side getUnreadCount + PATCH /api/channels/[id]/read | Server is the source of truth; client just displays |
| Typing indicator relay | Custom WebSocket room management | Socket.IO typing:start/typing:stop already in rooms.ts | Server relay already implemented |
| Message reactions | Custom reaction UI from scratch | Read reactions from API response, display as grouped emoji pills | API already returns grouped reactions with userIds |
| Time grouping | Complex date formatting library | Simple comparison: same author + within 5 minutes = group | No library needed for basic timestamp comparison |
| Channel creation form | Complex multi-step wizard | Simple Dialog with name + optional description fields | Only 2 fields needed for ALLGEMEIN channels |

**Key insight:** Phase 31 built the entire backend. Phase 32 is about rendering that data and connecting Socket.IO events to UI state. The complexity is in component structure and interaction design, not in data management.

## Common Pitfalls

### Pitfall 1: Stale Channel Room Subscriptions
**What goes wrong:** User switches channels but the Socket.IO room join/leave lifecycle doesn't fire properly, causing messages from old channels to appear or new channel messages to be missed.
**Why it happens:** Missing cleanup in useEffect, or channelId dependency not tracked.
**How to avoid:** Use the AkteSocketBridge pattern exactly: join on mount/change, leave on cleanup. Channel ID must be in the useEffect dependency array.
**Warning signs:** Messages appearing in wrong channel, or typing indicators from wrong channel.

### Pitfall 2: Scroll Position Jump on Banner Refetch
**What goes wrong:** After clicking "Neue Nachrichten" banner, the message list re-fetches and scrolls to top, losing the user's reading position.
**Why it happens:** Refetch replaces all messages, resetting scroll position.
**How to avoid:** On banner refetch, scroll to bottom (where new messages are) since that's what the user wants to see. Only preserve scroll position on "load more" (older messages at top).
**Warning signs:** User complaints about losing their place when clicking the new messages banner.

### Pitfall 3: Typing Indicator Memory Leak
**What goes wrong:** Typing users accumulate in the Map without cleanup, showing "ghost" typers who disconnected.
**Why it happens:** `typing:stop` event is missed (user closes tab, network drops).
**How to avoid:** Auto-cleanup timeout (5s) for each typing user. When the timeout fires without a new `typing:start`, remove the user from the Map.
**Warning signs:** Stale typing indicators that never disappear.

### Pitfall 4: Race Condition on Mark-as-Read
**What goes wrong:** User rapidly switches channels, causing mark-as-read API calls for wrong channels or double-counting.
**Why it happens:** Async PATCH /api/channels/[id]/read for previous channel completes after switching.
**How to avoid:** Use AbortController to cancel pending mark-as-read requests when channel switches. Or simply fire-and-forget (mark-as-read is idempotent and non-critical).
**Warning signs:** Unread badges flickering or showing wrong counts after rapid channel switching.

### Pitfall 5: Message List Ordering Bug
**What goes wrong:** Messages appear in wrong order after combining initial fetch (desc order for pagination) with new messages.
**Why it happens:** API returns messages in `createdAt desc` order (newest first), but chat UI displays oldest-first (bottom = newest).
**How to avoid:** Reverse the API response before rendering. The API returns `[newest, ..., oldest]` -- display as `[oldest, ..., newest]` with newest at bottom.
**Warning signs:** Messages displayed newest-at-top instead of chat-style newest-at-bottom.

### Pitfall 6: N+1 Queries in Sidebar Unread Count
**What goes wrong:** Fetching aggregate unread count calls getUnreadCount for each channel individually (already happens in GET /api/channels), which can be slow with many channels.
**Why it happens:** Current API does N queries (one per channel membership).
**How to avoid:** For a 5-person Kanzlei with <20 channels, this is acceptable. If performance becomes an issue, batch the unread count query. But don't pre-optimize.
**Warning signs:** Slow sidebar badge loading with many channels.

## Code Examples

### Example 1: Message Bubble Component
```typescript
// Source: Project conventions from activity-feed-entry.tsx + CONTEXT.md decisions

interface MessageBubbleProps {
  message: MessageListItem;
  isOwnMessage: boolean;
  showAuthor: boolean; // false when grouped with previous message from same author
  currentUserId: string;
}

export function MessageBubble({ message, isOwnMessage, showAuthor, currentUserId }: MessageBubbleProps) {
  // Soft-deleted messages
  if (message.deletedAt) {
    return (
      <div className="text-center text-xs text-muted-foreground italic py-1">
        Nachricht geloescht
      </div>
    );
  }

  // System messages (Helena)
  if (message.isSystem) {
    return (
      <div className="flex items-start gap-2 mx-auto max-w-[80%]">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="glass-card rounded-xl p-3 text-sm">
          {message.body}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col max-w-[70%]", isOwnMessage ? "ml-auto items-end" : "items-start")}>
      {showAuthor && (
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-xs font-medium text-foreground">{message.authorName}</span>
          <span className="text-xs text-muted-foreground">
            {formatTime(message.createdAt)}
            {message.editedAt && " (bearbeitet)"}
          </span>
        </div>
      )}

      {/* Reply-to quote */}
      {message.parent && (
        <div className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 rounded px-2 py-1 mb-1 border-l-2 border-violet-400">
          <span className="font-medium">{message.parent.authorName}:</span>{" "}
          {message.parent.body.slice(0, 80)}
        </div>
      )}

      <div className={cn(
        "glass-card rounded-xl px-3 py-2 text-sm",
        isOwnMessage
          ? "bg-[oklch(45%_0.2_260/0.15)]"
          : ""
      )}>
        {message.body}
      </div>

      {/* Reactions */}
      {message.reactions.length > 0 && (
        <div className="flex gap-1 mt-1">
          {message.reactions.map((r) => (
            <button
              key={r.emoji}
              className={cn(
                "text-xs px-1.5 py-0.5 rounded-full border",
                r.userIds.includes(currentUserId)
                  ? "bg-violet-100 dark:bg-violet-900/50 border-violet-300"
                  : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              )}
            >
              {r.emoji} {r.count}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Example 2: @Mention Picker Trigger Logic
```typescript
// Source: CONTEXT.md decision -- inline autocomplete on "@" keystroke

function useMentionPicker(text: string, cursorPosition: number) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    // Find the "@" before cursor
    const beforeCursor = text.slice(0, cursorPosition);
    const lastAtIndex = beforeCursor.lastIndexOf("@");

    if (lastAtIndex === -1) {
      setIsOpen(false);
      return;
    }

    // Check if @ is at start or preceded by whitespace
    if (lastAtIndex > 0 && !/\s/.test(beforeCursor[lastAtIndex - 1])) {
      setIsOpen(false);
      return;
    }

    // Extract query after @
    const afterAt = beforeCursor.slice(lastAtIndex + 1);

    // Close if there's a space after the query (mention completed)
    if (afterAt.includes(" ") && afterAt.length > 1) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
    setQuery(afterAt);
  }, [text, cursorPosition]);

  return { isOpen, query };
}
```

### Example 3: Initial Page Load (Server + Client Pattern)
```typescript
// Source: Project pattern from activity-feed + dokumente-tab

// page.tsx (server component)
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/rbac";
import { MessagingLayout } from "@/components/messaging/messaging-layout";
import type { ChannelListItem } from "@/lib/messaging/types";

export default async function NachrichtenPage() {
  // Server-side: fetch initial channel list for the user
  // (similar to how akten/[id]/page.tsx fetches akte data server-side)
  const session = await requireAuth();
  if (session.error) redirect("/login");

  // Fetch channels server-side (duplicate of API logic, but avoids client waterfall)
  // OR: just pass empty and let client fetch
  return <MessagingLayout initialChannels={[]} />;
  // Note: client-side fetch on mount is acceptable given the real-time nature
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full-page refresh for new messages | Socket.IO real-time events + banner refetch | v0.2 (activity feed) | Already established in project |
| URL-based chat routing (/nachrichten/[channelId]) | Client-side state channel switching | N/A (design decision) | Simpler UX, no full-page transitions |
| Polling for unread counts | Socket.IO event-driven badge updates | v0.2 (drafts/alerts badges) | Already established in project |

**Deprecated/outdated:**
- None relevant. The project's patterns are current and well-established.

## Open Questions

1. **Message:new Socket.IO event routing for sidebar badge**
   - What we know: `message:new` is emitted to `channel:{channelId}` room. The sidebar badge needs to know about messages across ALL channels the user is in.
   - What's unclear: The sidebar is always mounted, but the user is only joined to the channel room they're currently viewing. Messages in other channels won't reach the client via Socket.IO unless the user is in those rooms.
   - Recommendation: Two approaches: (a) On the server, after emitting to the channel room, also emit a lightweight `unread:update` event to each member's `user:{userId}` room with the new aggregate count. (b) On the client, periodically re-fetch GET /api/channels after `message:new` events. Option (b) is simpler and follows the existing pattern (sidebar badge fetches from API). A small API endpoint or the existing GET /api/channels can provide aggregate counts. For a 5-person Kanzlei, the overhead is negligible.

2. **Composer @mention picker -- textarea vs contentEditable**
   - What we know: Activity feed composer uses a plain textarea. The @mention picker needs to show a dropdown at the cursor position.
   - What's unclear: Getting cursor coordinates from a textarea requires `getComputedStyle` and mirror-div tricks. ContentEditable makes cursor positioning easier but adds complexity.
   - Recommendation: Use plain textarea (consistent with existing composer). For dropdown positioning, place it above the composer area (fixed position relative to composer wrapper) rather than trying to position at the exact cursor. This avoids the cursor-coordinate problem entirely and is the approach Slack uses on mobile.

3. **Akte tab channel data loading**
   - What we know: AkteDetailTabs receives `akte` as a prop from the server component. The messaging tab needs to lazy-load the channel via GET /api/akten/[id]/channel.
   - What's unclear: Should the channel ID be passed from the server component or fetched client-side?
   - Recommendation: Fetch client-side on tab activation. The lazy-creation pattern (GET /api/akten/[id]/channel creates if not exists) is already built for this exact use case. Server-side pre-fetching would add unnecessary complexity and slow down the Akte detail page load.

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/components/akten/activity-feed.tsx` -- banner refetch, Socket.IO, cursor pagination patterns
- Project codebase: `src/components/akten/activity-feed-composer.tsx` -- composer pattern with @Helena button
- Project codebase: `src/components/layout/sidebar.tsx` -- badge pattern (badgeKey, violet Badge, socket listener)
- Project codebase: `src/lib/socket/rooms.ts` -- channel room join/leave, typing:start/stop relay
- Project codebase: `src/lib/messaging/types.ts` -- MessageListItem, ChannelListItem, TypingPayload DTOs
- Project codebase: `src/lib/messaging/message-service.ts` -- sendMessage with @Helena detection + channelId
- Project codebase: `src/lib/messaging/channel-service.ts` -- getUnreadCount, createChannel
- Project codebase: `src/app/api/channels/route.ts` -- GET (with unreadCount), POST
- Project codebase: `src/app/api/channels/[id]/messages/route.ts` -- GET (cursor pagination), POST
- Project codebase: `src/app/api/channels/[id]/read/route.ts` -- PATCH (mark-as-read)
- Project codebase: `src/app/api/channels/[id]/reactions/route.ts` -- POST/DELETE
- Project codebase: `src/app/api/akten/[id]/channel/route.ts` -- GET (lazy-create AKTE channel)
- Project codebase: `src/lib/queue/processors/helena-task.processor.ts` -- postHelenaResponseToChannel
- Project codebase: `src/components/akten/akte-socket-bridge.tsx` -- room join/leave pattern
- Project codebase: `src/components/notifications/notification-provider.tsx` -- reconnect catch-up pattern

### Secondary (MEDIUM confidence)
- None needed. All patterns are verified from the project codebase itself.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Zero new packages, all existing project libraries
- Architecture: HIGH -- All patterns directly derived from existing activity feed, sidebar badge, and socket bridge implementations in the same codebase
- Pitfalls: HIGH -- Based on hands-on analysis of the actual API response shapes, Socket.IO room management, and established project patterns

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable -- no external dependencies to track)
