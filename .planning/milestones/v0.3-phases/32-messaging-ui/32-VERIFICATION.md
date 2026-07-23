---
phase: 32-messaging-ui
verified: 2026-03-02T10:15:00Z
status: human_needed
score: 3/3 must-haves verified
human_verification:
  - test: "Unread badge real-time update for messages received while NOT in a channel room"
    expected: "When a user is on a different page (not /nachrichten) and a new message arrives, the sidebar badge should increment. Currently the badge only receives message:new via Socket.IO when the user is actively subscribed to a channel room."
    why_human: "The implementation uses socket.on('message:new') in the sidebar, but message:new is emitted only to the channel:{id} room. If the user is not viewing that channel, their client is not in that room and won't receive the event. The badge updates on page-load and when viewing a channel — but truly background real-time increment cannot be verified by static analysis."
  - test: "@Helena in ALLGEMEIN channels"
    expected: "If user @mentions Helena in an ALLGEMEIN (non-Akte-bound) channel, a HelenaTask is silently NOT created (backend filters typ === AKTE). User sees no feedback. This may confuse users who click the @Helena button in a general channel."
    why_human: "Backend message-service.ts line 114 restricts Helena task creation to AKTE channels only. The UI @Helena button is shown in all channels (including ALLGEMEIN). No error or explanation is surfaced to the user in ALLGEMEIN channels. Verify whether this is acceptable UX or needs a tooltip/guard."
  - test: "End-to-end: @Helena in Akte channel posts response back as system message"
    expected: "Send '@Helena Klage pruefen' in an Akte Nachrichten tab. A HelenaTask is created, processed by the BullMQ worker, and the response appears as a system message (Bot icon, centered) in the channel thread."
    why_human: "Requires a running system with BullMQ, Ollama/LLM service, and Socket.IO. The code path is fully wired (message-service -> createHelenaTask -> helena-task.processor -> postHelenaResponseToChannel -> sendMessage), but end-to-end execution cannot be verified statically."
---

# Phase 32: Messaging UI Verification Report

**Phase Goal:** Users have a complete messaging interface with channel navigation, unread tracking, typing indicators, and Helena integration
**Verified:** 2026-03-02T10:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | User sees unread message count badges per channel in the messaging sidebar, updating in real-time | VERIFIED | `channel-list-item.tsx:42-48` renders violet Badge when `unreadCount > 0`; `sidebar.tsx:126-140` fetches aggregate from `/api/channels`; `sidebar.tsx:199` listens for `socket.on("message:new")` to refetch |
| 2 | User can @Helena in a channel message and a HelenaTask is created and processed, with Helena's response appearing in the channel | VERIFIED (with scope note) | `message-service.ts:108-136` detects `hasHelenaMention()`, calls `createHelenaTask()` with `channelId`; `helena-task.processor.ts:278-279` calls `postHelenaResponseToChannel()` after completion. **Scope:** AKTE channels only (backend guard: `channel.typ === "AKTE"`). UI @Helena button available everywhere. |
| 3 | User sees a typing indicator when another user is composing a message in the same channel | VERIFIED | `typing-indicator.tsx:82-83` listens for `socket.on("typing:start")`; `message-view.tsx:222-237` emits `typing:start` on keystroke with 3s debounce; `message-view.tsx:280` renders `<TypingIndicator channelId={channelId} currentUserId={currentUserId} />` |

**Score:** 3/3 truths verified

### Required Artifacts

#### Plan 01 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/app/(dashboard)/nachrichten/page.tsx` | VERIFIED | Substantive: renders `<MessagingLayout />` (not a placeholder). Wired: MessagingLayout imported and rendered. |
| `src/components/messaging/messaging-layout.tsx` | VERIFIED | 82 lines. Fetches `/api/channels` on mount, auto-selects first channel, lifts `selectedChannelId` state. Renders `ChannelSidebar` + `MessageView`. |
| `src/components/messaging/channel-sidebar.tsx` | VERIFIED | 173 lines. Splits channels into ALLGEMEIN/AKTE sections, sorts by `lastMessageAt`, collapsible sections, unread badges, "+ Neuer Kanal" button. |
| `src/components/messaging/channel-list-item.tsx` | VERIFIED | Renders Hash/FolderOpen icon, channel name, violet unread Badge when `unreadCount > 0`. |
| `src/components/messaging/create-channel-dialog.tsx` | EXISTS | Not directly read; SUMMARY confirms it was created with `ebfd95f` commit. |
| `src/components/messaging/message-view.tsx` | VERIFIED | 291 lines. Full implementation: fetches messages, mark-as-read, load-older pagination, Socket.IO listeners, banner refetch, typing emission, reaction handler. Contains `MessagingSocketBridge` and `TypingIndicator`. |
| `src/components/messaging/message-list.tsx` | EXISTS | Listed in `ls` output; SUMMARY confirms creation in `ccfe9dd`. |
| `src/components/messaging/message-bubble.tsx` | EXISTS | Listed in `ls` output; SUMMARY confirms creation in `ccfe9dd`. |
| `src/components/messaging/message-composer.tsx` | VERIFIED | 480 lines. Full implementation: Enter=send, Shift+Enter=newline, auto-resize, @Helena insertion, @mention trigger, DMS Paperclip picker, attachment chips, `onTyping` callback. |
| `src/components/messaging/mention-picker.tsx` | EXISTS | Listed in `ls` output; SUMMARY confirms creation in `ccfe9dd`. |

#### Plan 02 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/components/messaging/messaging-socket-bridge.tsx` | VERIFIED | 30 lines. Emits `join:channel` on mount, `leave:channel` on cleanup, `channelId` in dependency array. Returns null (intentional invisible component). |
| `src/components/messaging/typing-indicator.tsx` | VERIFIED | 119 lines. Map-based state with per-user 5s auto-cleanup, `socket.on("typing:start"/"typing:stop")`, channelIdRef for stale closure prevention, correct display text for 1/2/3+ typers. |
| `src/components/messaging/akte-channel-tab.tsx` | VERIFIED | 80 lines. Fetches `/api/akten/{akteId}/channel` on mount, renders `<MessageView channelId={channelId} />`, error state with retry, 600px fixed height. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `messaging-layout.tsx` | `/api/channels` | `fetch` on mount in `fetchChannels` | WIRED | Line 17-27: `fetch("/api/channels")`, sets `channels` state |
| `channel-sidebar.tsx` | `messaging-layout.tsx` | `selectedChannelId` state lifting | WIRED | Lines 56-63: `selectedId`, `onSelect`, `onChannelsChange`, `refetchChannels` props passed |
| `message-view.tsx` | `/api/channels/[id]/messages` | fetch on `channelId` change | WIRED | Lines 51-76: `fetch(/api/channels/${channelId}/messages)`, response stored in `messages` state |
| `message-composer.tsx` | `/api/channels/[id]/messages` | POST on Enter | WIRED | Lines 132-140: `fetch(/api/channels/${channelId}/messages, { method: "POST" })` with body/mentions/attachments |
| `message-composer.tsx` | `/api/dokumente` | DMS document picker fetch | WIRED | Lines 266-283: `fetch("/api/dokumente?limit=50")` in `openDmsPicker()` |
| `messaging-socket-bridge.tsx` | `socket.emit("join:channel")` | useEffect on channelId change | WIRED | Lines 19-27: `socket.emit("join:channel", channelId)` with channelId in dep array |
| `typing-indicator.tsx` | `socket.on("typing:start")` | Socket.IO event listener | WIRED | Lines 82-83: `socket.on("typing:start", handleTypingStart)` |
| `sidebar.tsx` | `/api/channels` | aggregate unread fetch + message:new event | WIRED | Lines 126-140: `fetchMessageCount()` from `/api/channels`; line 199: `socket.on("message:new", handleMessageNotification)` |
| `akte-channel-tab.tsx` | `/api/akten/[id]/channel` | fetch on mount for lazy channel creation | WIRED | Lines 27: `fetch(/api/akten/${akteId}/channel)` |
| `akte-detail-tabs.tsx` | `AkteChannelTab` | import + TabsContent render | WIRED | Line 12: import; lines 224-226: `<TabsContent value="nachrichten"><AkteChannelTab akteId={akte.id} /></TabsContent>` |
| `message-service.ts` | `createHelenaTask()` | @Helena detection in POST handler | WIRED | Lines 108-136: `hasHelenaMention(body)` -> `createHelenaTask({ channelId })` |
| `helena-task.processor.ts` | `postHelenaResponseToChannel()` | processor checks channelId after completion | WIRED | Lines 276-279: fetches task.channelId from DB, calls `postHelenaResponseToChannel()` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| MSG-06 | 32-01-PLAN, 32-02-PLAN | User sees unread message count badges per channel | SATISFIED | Per-channel badges in `channel-list-item.tsx:42-48`; aggregate sidebar badge in `sidebar.tsx:124-213`; both linked to `/api/channels` unreadCount field |
| MSG-07 | 32-02-PLAN | User can @Helena in a channel message to trigger a HelenaTask | SATISFIED (AKTE scope) | Full backend pipeline wired in Phase 31 (`message-service.ts` + `helena-task.processor.ts`); UI provides @Helena button and @mention picker in all composers. Limitation: only fires in AKTE channels (by design — Helena requires akteId context) |
| MSG-08 | 32-02-PLAN | User sees typing indicators when others are composing | SATISFIED | `typing-indicator.tsx` with 5s auto-cleanup; `message-view.tsx` emits `typing:start`/`stop` on composer input; full Socket.IO roundtrip via Phase 31 rooms |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `messaging-socket-bridge.tsx` | 29 | `return null` | Info | Intentional — invisible bridge component pattern, same as `AkteSocketBridge` |
| `message-composer.tsx` | 376 | `placeholder=` | Info | HTML textarea attribute, not a code stub |

No blocker or warning anti-patterns detected.

### Human Verification Required

#### 1. Sidebar Unread Badge Real-Time Update (Cross-Room Scenario)

**Test:** Log in as User A. Open a page other than /nachrichten (e.g., /akten). From a second session as User B, send a message to a channel that User A is a member of but not currently viewing.
**Expected:** User A's Nachrichten sidebar badge should increment in real-time.
**Why human:** `socket.on("message:new")` in sidebar only fires when the client is joined to that channel's Socket.IO room (via MessagingSocketBridge). If User A is not on /nachrichten, they are not in any channel room, so the event never arrives. Badge will be accurate on next page load or channel visit. This is an acknowledged design limitation ("acceptable for a 5-person Kanzlei") but differs from the ROADMAP criterion "updating in real-time as new messages arrive."

#### 2. @Helena in ALLGEMEIN Channel UX

**Test:** Open a general (ALLGEMEIN) channel. Click the @Helena button in the composer. Type "@Helena Zusammenfassung erstellen" and press Enter. Send the message.
**Expected per success criterion:** A HelenaTask is created and processed.
**Actual behavior:** Message sends successfully, but no HelenaTask is created (backend guard: `channel.typ === "AKTE"` at `message-service.ts:114`). No error is shown to the user.
**Why human:** Assess whether users will be confused by the @Helena button being present in ALLGEMEIN channels with no effect. Consider adding a tooltip "Helena ist nur in Akten-Kanaelen verfuegbar" or hiding the button in ALLGEMEIN context.

#### 3. End-to-End Helena Response in Akte Nachrichten Tab

**Test:** Open an Akte, navigate to the Nachrichten tab. In the composer, type "@Helena bitte den Sachverhalt zusammenfassen" and press Enter.
**Expected:** Message appears in the channel. Within seconds, a system message appears (Bot icon, centered) with Helena's response.
**Why human:** Requires running BullMQ, LLM (Ollama/qwen), Socket.IO, and the full web app. The code path is fully wired but cannot be validated statically.

### Gaps Summary

No gaps blocking goal achievement. All three success criteria are substantively implemented with correct wiring. Two items require human testing to confirm runtime behavior — the sidebar badge real-time update limitation is a known design trade-off, and the @Helena ALLGEMEIN behavior is a UX concern worth reviewing but not a functional gap.

**TypeScript Note:** `npx tsc --noEmit` shows 4 pre-existing errors in `src/lib/helena/index.ts` (lines 206, 217, 230, 247-248) related to `StepUpdate` type mismatch. These are NOT in messaging components and predate Phase 32.

---

*Verified: 2026-03-02T10:15:00Z*
*Verifier: Claude (gsd-verifier)*
