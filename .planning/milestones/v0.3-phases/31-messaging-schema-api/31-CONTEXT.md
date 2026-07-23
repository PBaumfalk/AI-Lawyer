# Phase 31: Messaging Schema + API - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend for persistent Kanzlei-wide channels and Akte-bound discussion threads with real-time message delivery via Socket.IO and @mention notifications. Two channel types (ALLGEMEIN + AKTE), no DMs. Phase 32 handles all UI.

</domain>

<decisions>
## Implementation Decisions

### Channel Model
- Two channel types: ALLGEMEIN (Kanzlei-wide topics) and AKTE (bound to an Akte, inherits RBAC)
- No DIREKT/DM channels in this milestone
- Any authenticated user can create ALLGEMEIN channels; creator + ADMIN can archive/delete
- AKTE channels are lazily created on first access (no migration for existing Akten)
- AKTE channels are separate Channel records, NOT embedded in AktenActivity feed — clean separation between event log and team discussion
- Seed channels (#allgemein, #organisation) auto-join all users on creation

### Membership
- Explicit ChannelMember rows for both ALLGEMEIN and AKTE channels — consistent model
- ALLGEMEIN: explicit join/leave, users browse available channels and join
- AKTE: ChannelMember rows created/synced based on Akte RBAC (anwaltId, sachbearbeiterId, Dezernat members), access still gated by requireAkteAccess()
- ChannelMember stores lastReadAt for unread tracking

### Message Capabilities
- Plain text body + optional file attachments (JSON array of dokumentId references)
- Flat chronological display with optional parentId for reply-to (quoted parent inline, not sub-threads)
- Simple emoji reactions (MessageReaction table, one reaction per emoji per user)
- Author can edit own messages (editedAt timestamp, "(bearbeitet)" label)
- Author + ADMIN can soft delete messages (deletedAt set, body cleared, shows "Nachricht geloescht")

### @Mentions + Notifications
- @user + @alle supported (no @role or @dezernat)
- Client sends structured mentions array (userIds) alongside body text — no server-side name parsing
- @alle: client sends "__alle__" sentinel, server expands to all channel member IDs
- Only @mentions trigger push notifications via createNotification() — regular messages only increment unread badges
- New NotificationType: "message:mention"
- @Helena works in AKTE channels: parseHelenaMention(body) creates HelenaTask, Helena response posts back as Message in the same channel

### Read Tracking
- Per-channel lastReadAt on ChannelMember — updated when user opens channel
- Unread count = messages after lastReadAt (excluding own messages, excluding soft-deleted)
- PATCH /api/channels/{id}/read to mark as read

### Real-Time / Socket.IO
- New room: channel:{channelId} with join:channel / leave:channel events
- Server emits: message:new, message:edited, message:deleted to channel room
- Typing indicators: ephemeral Socket.IO events (typing:start / typing:stop), no DB persistence, 5s auto-timeout
- Uses existing Redis adapter + emitter pattern for worker processes

### Claude's Discretion
- Exact Prisma schema field names and index strategy
- API route structure (nested vs flat)
- Socket.IO event payload shapes
- Channel slug generation approach
- Seed channel names and configuration
- Error handling and validation details

</decisions>

<specifics>
## Specific Ideas

- AKTE channel lazy creation: GET /api/akten/{id}/channel creates on first access, auto-populates ChannelMember from Akte RBAC
- Banner refetch pattern (existing) should be used for new message display — Socket.IO triggers refetch, not direct DOM insertion
- @Helena in channels reuses existing parseHelenaMention() + createHelenaTask() flow, extended with channelId context

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/socket/server.ts`: setupSocketIO() — add channel room handlers alongside existing akte/mailbox rooms
- `src/lib/socket/rooms.ts`: Room join/leave pattern — extend with channel:{channelId}
- `src/lib/socket/emitter.ts`: getSocketEmitter() singleton — use from API routes for message:new events
- `src/lib/notifications/service.ts`: createNotification() — call for @mention notifications with new "message:mention" type
- `src/lib/notifications/types.ts`: NotificationType union — add "message:mention"
- `src/lib/rbac.ts`: requireAkteAccess() + buildAkteAccessFilter() — gate AKTE channel access
- `src/lib/helena/at-mention-parser.ts`: parseHelenaMention() — reuse for @Helena detection in channel messages
- `src/lib/helena/draft-activity.ts`: createDraftActivity() pattern — fire-and-forget helper with socket emit
- `src/components/socket-provider.tsx`: useSocket() hook — no changes needed

### Established Patterns
- ID strategy: String @id @default(cuid()) universally
- Table naming: @@map("snake_case_plural")
- JSON payloads: Json? for type-specific metadata (attachments, mentions)
- Cascade: onDelete: Cascade for child records dying with parent
- Composite indexes on most-queried combinations
- NotificationType as TypeScript union (not Prisma enum)
- Banner refetch pattern: Socket.IO triggers UI banner, click re-fetches from API

### Integration Points
- prisma/schema.prisma: Add Channel, ChannelMember, Message, MessageReaction models
- src/lib/socket/rooms.ts: Add join:channel / leave:channel handlers
- src/lib/notifications/types.ts: Add "message:mention" to union
- src/app/api/channels/: New route group for channel CRUD + message CRUD
- src/app/api/akten/[id]/channel/: Lazy AKTE channel creation endpoint
- src/worker.ts or helena-task.processor.ts: Helena response → channel message posting

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-messaging-schema-api*
*Context gathered: 2026-03-02*
