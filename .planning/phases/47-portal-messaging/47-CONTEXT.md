# Phase 47: Portal-Messaging - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Mandant und Anwalt koennen sicher und nachvollziehbar ueber das Portal kommunizieren. Sichere Nachrichten mit Dateianhang. Mandant sendet/empfaengt im Portal, Anwalt sendet/empfaengt im internen Dashboard.

</domain>

<decisions>
## Implementation Decisions

### Channel architecture
- New ChannelTyp.PORTAL added to enum
- Auto-created per Mandant+Akte pair (lazy creation on first message or on portal activation)
- Messages use existing Message model (reuse body, attachments, authorId, timestamps)
- PORTAL channels are isolated from AKTE and ALLGEMEIN channels — Mandant never sees internal messages

### Anwalt access points
- PORTAL channels appear in /nachrichten sidebar (new "Mandantenportal" section alongside ALLGEMEIN and AKTE)
- PORTAL channel also appears as tab/section in Akte-Detail page
- Anwalt sees full conversation history with the Mandant

### Mandant UI
- Simple chat-style interface in portal
- Text messages + file attachments (upload to MinIO)
- Newest messages at bottom, scroll to load history

### Claude's Discretion
- Real-time via Socket.IO vs polling for portal (trade-off: premium UX vs complexity)
- Whether to show read receipts (Anwalt sees if Mandant read)
- Attachment size limit in portal messaging
- How to handle multiple Mandanten per Akte messaging (separate PORTAL channels or shared?)
- Unread badge/count for portal messages in internal /nachrichten sidebar

</decisions>

<specifics>
## Specific Ideas

- Messaging should feel like a secure WhatsApp-style thread — simple, familiar, trustworthy
- Anwalt should be able to reply to portal messages without leaving the Akte context
- File attachments in messages should be downloadable by both sides

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Channel/Message/ChannelMember Prisma models — reuse fully, add PORTAL to ChannelTyp enum
- `src/lib/messaging/message-service.ts`: sendMessage(), getMessages() with cursor pagination — reuse
- Socket.IO: `message:new` event on `channel:{id}` room — reuse for real-time if chosen
- ChannelMember: lastReadAt for unread tracking — reuse
- Message.attachments: Json field with [{dokumentId, name}] — reuse pattern

### Established Patterns
- Channel lazy creation: AKTE channels auto-created when first Akte message sent — replicate for PORTAL
- Banner refetch: message:new triggers client refetch, not local insert — same for portal
- Cursor pagination: limit 50, max 100, ordered by createdAt desc — reuse

### Integration Points
- prisma/schema.prisma: Add PORTAL to ChannelTyp enum
- /nachrichten sidebar: Add "Mandantenportal" section filtering ChannelTyp.PORTAL
- Akte-Detail: Add portal messages tab/section
- Portal UI: New /portal/nachrichten or /portal/akten/[id]/nachrichten page

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 47-portal-messaging*
*Context gathered: 2026-03-03*
