# Technology Stack

**Project:** AI-Lawyer v0.3 -- Kanzlei-Collaboration
**Researched:** 2026-02-28
**Mode:** Subsequent milestone -- stack additions for Internes Messaging, SCAN-05, Falldatenblaetter

## Executive Summary

v0.3 adds three features to an existing 117k LOC TypeScript codebase. The critical finding: **zero new npm packages are needed**. All three features build entirely on existing infrastructure -- Socket.IO for real-time messaging, pgvector for cross-Akte semantic search, and the existing `falldaten-schemas.ts` + `FalldatenForm` system for dynamic case data forms. The work is Prisma models, API routes, UI components, BullMQ processors, and Socket.IO room extensions.

This mirrors the v0.2 precedent ("Zero new npm packages") and is justified because every capability was verified against the installed dependency set.

---

## Recommended Stack

### Core Framework

No changes. Existing stack handles all v0.3 requirements.

| Technology | Version | v0.3 Role | Why Sufficient |
|---|---|---|---|
| Next.js 14+ (App Router) | ^14.2.21 | API routes for messaging + templates, pages for channel UI | Existing pattern from 26+ dashboard pages |
| TypeScript | ^5.7.2 | Type safety for new models, schemas | Already in use |
| Tailwind CSS + shadcn/ui | ^3.4.17 | Messaging UI components | Glass UI design system already established |

### Database

No changes. All new data fits PostgreSQL + Prisma.

| Technology | Version | v0.3 Role | Why Sufficient |
|---|---|---|---|
| PostgreSQL 16 | existing | Channel, Message, FalldatenTemplate tables | Relational data with JSON columns -- perfect fit |
| Prisma ORM | ^5.22.0 | New models (Channel, ChannelMember, Message, FalldatenTemplate) | 70+ models already managed. Same migration pattern. |
| pgvector (HNSW) | 0.2.1 | SCAN-05: search document_chunks using urteil embedding | Existing index, existing query patterns in `vector-store.ts` |

### Infrastructure

No changes. No new Docker services.

| Technology | Version | v0.3 Role | Why Sufficient |
|---|---|---|---|
| Socket.IO + Redis Adapter | 4.8.3 + 8.3.0 | Real-time message delivery, typing indicators | Room system already supports `user:`, `akte:`, `role:` patterns. Add `channel:{id}` room. |
| Socket.IO Redis Emitter | 5.1.0 | Worker-to-browser message push for SCAN-05 alerts | Already used for OCR/embedding/alert notifications from worker |
| BullMQ | ^5.70.1 | SCAN-05 processor (post-sync hook) | 16 workers already registered. Same pattern. |
| Redis 7 | existing | Socket.IO adapter, BullMQ backend, pub/sub | No changes needed |

### Supporting Libraries

No new libraries. Existing ones cover all needs:

| Library | Version | v0.3 Role | Why Sufficient |
|---|---|---|---|
| TipTap (StarterKit + extensions) | 3.20.0 | Message composer rich text | Already used in email compose editor (`ComposeEditor`). Reuse pattern. |
| Vercel AI SDK v4 | ^4.3.19 | Helena auto-fill for Falldatenblaetter via `generateObject` | Same pattern as Schriftsatz pipeline |
| Zod | ^3.23.8 | Runtime validation for user-created FalldatenTemplate schemas | Already validating AI outputs, form inputs |
| date-fns | ^4.1.0 | Message timestamps, "2 min ago" formatting | Already used throughout UI |
| Lucide React | ^0.468.0 | Icons for messaging UI (MessageSquare, Hash, AtSign, etc.) | Already installed, 100+ icons in use |
| Sonner | ^1.7.1 | Toast notifications for new messages, mentions | Already installed, used for all toasts |

---

## Feature-Specific Stack Decisions

### 1. Internes Messaging

#### Data Layer: Prisma models only

New models (no changes to existing models):

```prisma
enum ChannelTyp {
  AKTE_THREAD    // Bound to a specific Akte
  KANZLEI        // General Kanzlei-wide channel
}

model Channel {
  id          String      @id @default(cuid())
  name        String
  typ         ChannelTyp
  akteId      String?     // non-null for AKTE_THREAD
  akte        Akte?       @relation(fields: [akteId], references: [id], onDelete: Cascade)
  createdById String
  createdBy   User        @relation(fields: [createdById], references: [id])
  archived    Boolean     @default(false)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  members     ChannelMember[]
  messages    Message[]

  @@unique([akteId]) // One thread per Akte (for AKTE_THREAD)
  @@index([typ])
  @@map("channels")
}

model ChannelMember {
  id          String    @id @default(cuid())
  channelId   String
  channel     Channel   @relation(fields: [channelId], references: [id], onDelete: Cascade)
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  lastReadAt  DateTime  @default(now())
  joinedAt    DateTime  @default(now())

  @@unique([channelId, userId])
  @@index([userId])
  @@map("channel_members")
}

model Message {
  id          String    @id @default(cuid())
  channelId   String
  channel     Channel   @relation(fields: [channelId], references: [id], onDelete: Cascade)
  authorId    String
  author      User      @relation(fields: [authorId], references: [id])
  content     String    @db.Text
  replyToId   String?
  replyTo     Message?  @relation("MessageReplies", fields: [replyToId], references: [id])
  replies     Message[] @relation("MessageReplies")
  mentions    Json?     // Array of mentioned userId strings
  editedAt    DateTime?
  deletedAt   DateTime? // Soft delete
  createdAt   DateTime  @default(now())

  @@index([channelId, createdAt])
  @@index([authorId])
  @@map("messages")
}
```

**Confidence:** HIGH -- follows exact same patterns as `AktenActivity`, `Notification`, `ChatNachricht` models.

**Design decision: `@@unique([akteId])` on Channel for AKTE_THREAD type.** Each Akte gets exactly one discussion thread (auto-created on first message). This prevents thread sprawl and matches the Akte-centric UX. General KANZLEI channels have `akteId = null` and no uniqueness constraint on name (users can create freely).

#### Real-time Layer: Socket.IO rooms

Existing rooms:
```
user:{userId}     -- personal notifications (auto-joined)
role:{ROLE}        -- role-based broadcasts (auto-joined)
akte:{akteId}      -- case-specific updates (dynamic join/leave)
mailbox:{kontoId}  -- email real-time updates (dynamic join/leave)
```

New room:
```
channel:{channelId} -- messaging channel (dynamic join/leave)
```

Socket.IO events to add:

| Event | Direction | Room Target | Payload |
|---|---|---|---|
| `message:new` | server -> client | `channel:{id}` | `{ id, channelId, authorId, authorName, content, replyToId, createdAt }` |
| `message:update` | server -> client | `channel:{id}` | `{ id, content, editedAt }` |
| `message:delete` | server -> client | `channel:{id}` | `{ id }` |
| `typing:start` | client -> server -> client | `channel:{id}` | `{ userId, userName }` |
| `typing:stop` | client -> server -> client | `channel:{id}` | `{ userId }` |
| `channel:unread` | server -> client | `user:{userId}` | `{ channelId, unreadCount }` |
| `join:channel` | client -> server | - | `channelId` |
| `leave:channel` | client -> server | - | `channelId` |

**Confidence:** HIGH -- `rooms.ts` already has `join:akte` / `leave:akte`. Add `join:channel` / `leave:channel` identically.

#### Message Composer: Plain textarea (not TipTap)

Use the `ActivityFeedComposer` pattern: `<textarea>` with Enter-to-send, Shift+Enter-for-newline, @-mention button. TipTap is available but overkill for internal messaging -- plain text with @mentions is faster to implement and matches Slack/Teams UX where rich formatting is secondary.

**@User mentions: Extend existing regex pattern.** The existing `at-mention-parser.ts` uses `/@helena\s+([\s\S]+)/i`. Add a parallel `parseUserMentions(text): string[]` function that matches `@{name}` patterns against the user list. Store mentioned userIds in `Message.mentions` JSON field. Trigger notification for each mentioned user via existing `createNotification()`.

**Confidence:** HIGH -- proven pattern from v0.2 ActivityFeedComposer.

#### Unread Count: Database query + Socket.IO push

```sql
-- Unread count per channel for a user
SELECT c.id, COUNT(m.id)
FROM channels c
JOIN channel_members cm ON cm."channelId" = c.id AND cm."userId" = $1
LEFT JOIN messages m ON m."channelId" = c.id
  AND m."createdAt" > cm."lastReadAt"
  AND m."deletedAt" IS NULL
  AND m."authorId" != $1
GROUP BY c.id
```

Push updated count to `user:{userId}` room after each new message. Client receives via `channel:unread` event.

---

### 2. SCAN-05 Neu-Urteil-Check

#### Processing: BullMQ post-processor hook on urteile-sync

SCAN-05 runs automatically after the daily urteile-sync job inserts new urteil_chunks. It inverts the existing search pattern: instead of searching urteil_chunks by query embedding (what `searchUrteilChunks()` does), it searches document_chunks using the urteil's embedding as the query vector.

**Pipeline:**

```
urteile-sync processor (existing, runs daily at 03:00)
  -> inserts N new urteil_chunks with embeddings
  -> on completion: emit scan-05 job with { urteilIds: [...newly inserted] }

scan-05 processor (NEW)
  -> for each new urteil:
     -> load urteil embedding from urteil_chunks
     -> run pgvector search against ALL document_chunks (all open Akten)
     -> filter results by cosine similarity threshold (default 0.72)
     -> group results by akteId
     -> for each relevant Akte:
        -> create HelenaAlert(typ: NEUES_URTEIL, meta: { urteilId, aktenzeichen, gericht, datum, score })
        -> create Notification for Akte Verantwortlicher
        -> create AktenActivity(typ: HELENA_ALERT)
```

**Key SQL query (new function: `searchDocumentChunksByUrteilEmbedding`):**

```sql
SELECT
  dc.id,
  dc."dokumentId",
  d.name AS dokument_name,
  d."akteId",
  a.aktenzeichen AS akte_aktenzeichen,
  a."anwaltId",
  1 - (dc.embedding <=> $1::vector) AS score
FROM document_chunks dc
JOIN dokumente d ON d.id = dc."dokumentId"
JOIN akten a ON a.id = d."akteId"
WHERE a.status = 'OFFEN'
  AND dc."chunkType" != 'PARENT'
  AND dc.embedding IS NOT NULL
  AND 1 - (dc.embedding <=> $1::vector) > $2  -- threshold
ORDER BY dc.embedding <=> $1::vector ASC
LIMIT 50
```

**Confidence:** HIGH -- all infrastructure exists. This is a new processor function using existing query patterns from `hybrid-search.ts` and `vector-store.ts`.

#### Alert deduplication

The existing scanner already has deduplication in `resolveStaleAlerts()`. SCAN-05 uses the same pattern: before creating an alert, check if a `HelenaAlert` with `typ: NEUES_URTEIL` and matching `meta.urteilId + akteId` already exists. Skip if found.

#### Threshold tuning

Use `SystemSetting` key `scanner.urteil_relevance_threshold` (default: 0.72). Configurable via admin settings UI (same pattern as `scanner.frist_threshold_hours`, `scanner.inaktiv_threshold_days`).

**Why 0.72 default:** Legal document embeddings with `multilingual-e5-large-instruct` show cosine similarity ~0.6-0.7 for loosely related topics, ~0.75-0.85 for directly relevant content. 0.72 balances recall (catching relevant decisions) against noise (irrelevant alerts). This should be calibrated after initial deployment.

#### Performance consideration

For N new urteile x M open Akten, the naive per-Akte approach (N x M queries) is expensive. The recommended approach: one global query per urteil (search ALL document_chunks, filter by status='OFFEN'). With HNSW index, each query is O(log n) regardless of table size. Expected runtime: ~200ms per urteil (50 results per query). With 5-20 new urteile per day, total SCAN-05 runtime: 1-4 seconds.

---

### 3. Falldatenblaetter

#### Existing Foundation

The Falldaten system is already built and working:

| Component | Location | Status |
|---|---|---|
| `FalldatenSchema` type | `src/lib/falldaten-schemas.ts` | 7 field types, grouping, options |
| `FalldatenForm` component | `src/components/akten/falldaten-form.tsx` | Dynamic renderer for any schema |
| `Akte.falldaten` JSON column | `prisma/schema.prisma` | Per-Akte case data storage |
| `falldatenSchemas` registry | `src/lib/falldaten-schemas.ts` | 10 hardcoded schemas (Arbeitsrecht, Familienrecht, etc.) |
| Sachgebiet enum | `prisma/schema.prisma` | 10 legal areas |

#### What Changes for v0.3

**1. Move schemas from code to DB:**

New `FalldatenTemplate` model replaces the hardcoded `falldatenSchemas` record:

```prisma
enum FalldatenTemplateStatus {
  ENTWURF       // User draft (only visible to creator)
  EINGEREICHT   // Submitted for admin review
  GENEHMIGT     // Admin approved (visible to all)
  ABGELEHNT     // Admin rejected (with reason)
}

model FalldatenTemplate {
  id            String                   @id @default(cuid())
  sachgebiet    String                   // Free-text, not bound to Sachgebiet enum
  label         String
  beschreibung  String?
  schema        Json                     // FalldatenSchema JSON (validated by Zod)
  status        FalldatenTemplateStatus  @default(ENTWURF)
  isDefault     Boolean                  @default(false) // Pre-seeded system templates
  createdById   String
  createdBy     User                     @relation(fields: [createdById], references: [id])
  reviewedById  String?
  reviewedBy    User?                    @relation("TemplateReviewer", fields: [reviewedById], references: [id])
  reviewNote    String?                  // Admin feedback on rejection
  createdAt     DateTime                 @default(now())
  updatedAt     DateTime                 @updatedAt

  @@index([sachgebiet, status])
  @@index([status])
  @@map("falldaten_templates")
}
```

**Seed migration:** Copy 10 existing hardcoded schemas from `falldatenSchemas` into `FalldatenTemplate` rows with `status: GENEHMIGT` and `isDefault: true`. The hardcoded file remains as fallback.

**2. Community workflow:**

| Action | Who | From Status | To Status |
|---|---|---|---|
| Create template | Any user | - | ENTWURF |
| Edit template | Creator | ENTWURF | ENTWURF |
| Submit for review | Creator | ENTWURF | EINGEREICHT |
| Approve | ADMIN | EINGEREICHT | GENEHMIGT |
| Reject (with note) | ADMIN | EINGEREICHT | ABGELEHNT |
| Resubmit | Creator | ABGELEHNT | EINGEREICHT |

**3. Schema validation with Zod:**

When loading user-created templates from DB, validate JSON structure before rendering:

```typescript
const FalldatenSchemaValidator = z.object({
  sachgebiet: z.string(),
  label: z.string(),
  beschreibung: z.string(),
  felder: z.array(z.object({
    key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/), // Safe JS key
    label: z.string(),
    typ: z.enum(["text", "textarea", "number", "date", "select", "boolean", "currency"]),
    placeholder: z.string().optional(),
    optionen: z.array(z.object({
      value: z.string(),
      label: z.string(),
    })).optional(),
    required: z.boolean().optional(),
    gruppe: z.string().optional(),
  })),
});
```

**4. Helena auto-fill:**

Use `generateObject()` (Vercel AI SDK v4) with Akte context to extract structured data:

```typescript
const filledData = await generateObject({
  model: getModel(),
  schema: dynamicZodFromFalldatenSchema(template.schema),
  system: "Extract case data from the provided documents and party information.",
  prompt: buildAutoFillPrompt(akteContext, template.schema),
});
```

The `dynamicZodFromFalldatenSchema()` function converts a `FalldatenSchema` into a Zod schema at runtime. Each field type maps directly:

| FalldatenFeldTyp | Zod Type |
|---|---|
| text | `z.string().optional()` |
| textarea | `z.string().optional()` |
| number | `z.number().optional()` |
| date | `z.string().optional()` |
| select | `z.enum([...optionen.values]).optional()` |
| boolean | `z.boolean().optional()` |
| currency | `z.number().optional()` |

Returns partial fill -- all fields optional. User reviews and confirms in existing `FalldatenForm`.

**5. Helena template suggestion:**

When Helena's background scanner detects a case pattern (e.g., new Arbeitsrecht Akte with Kuendigung-related documents but no Falldatenblatt filled), create a `HelenaAlert` suggesting the user fill the appropriate template. This uses the existing alert system -- no new infrastructure.

**Confidence:** HIGH -- the entire type system, form renderer, and JSON storage already exist. The change is storage location (code -> DB) and access control.

---

## Prisma Schema Changes Summary

### New Models

| Model | Fields (approx.) | Purpose |
|---|---|---|
| `Channel` | ~10 | Messaging channels (Akte threads + Kanzlei-wide) |
| `ChannelMember` | ~5 | Channel membership with lastReadAt |
| `Message` | ~10 | Chat messages with replies, mentions, soft delete |
| `FalldatenTemplate` | ~12 | DB-stored case data schemas with approval workflow |

### New Enums

| Enum | Values |
|---|---|
| `ChannelTyp` | AKTE_THREAD, KANZLEI |
| `FalldatenTemplateStatus` | ENTWURF, EINGEREICHT, GENEHMIGT, ABGELEHNT |

### Extended Enums

| Enum | New Value | Purpose |
|---|---|---|
| `AktenActivityTyp` | `NACHRICHT` | Message posted in Akte thread appears in activity feed |

### No Changes to Existing Models

`HelenaAlertTyp.NEUES_URTEIL` already exists. No changes to User, Akte, HelenaAlert, or any other existing model.

---

## API Routes Summary

### Messaging

```
POST   /api/channels                         -- Create channel (KANZLEI only; AKTE_THREAD auto-created)
GET    /api/channels                         -- List user's channels with unread counts
GET    /api/channels/[id]                    -- Channel detail with members
GET    /api/channels/[id]/messages           -- Paginated messages (cursor-based)
POST   /api/channels/[id]/messages           -- Send message (+ @mention notification + Socket.IO)
PATCH  /api/channels/[id]/messages/[msgId]   -- Edit message (author only)
DELETE /api/channels/[id]/messages/[msgId]   -- Soft-delete message (author or ADMIN)
POST   /api/channels/[id]/read              -- Mark channel as read (update lastReadAt)
GET    /api/channels/unread                  -- All unread counts for sidebar badge
```

### Falldatenblaetter

```
GET    /api/falldaten-templates              -- List templates (filter: status, sachgebiet)
POST   /api/falldaten-templates              -- Create template (any user)
GET    /api/falldaten-templates/[id]         -- Template detail
PATCH  /api/falldaten-templates/[id]         -- Update template (creator, ENTWURF only)
POST   /api/falldaten-templates/[id]/submit  -- Submit for review (creator)
POST   /api/falldaten-templates/[id]/approve -- Approve (ADMIN only)
POST   /api/falldaten-templates/[id]/reject  -- Reject with note (ADMIN only)
POST   /api/akten/[id]/falldaten/auto-fill   -- Helena auto-fill (triggers generateObject)
```

### SCAN-05

No new API routes. Runs in existing worker, creates alerts via existing `HelenaAlert` + `Notification` system.

---

## Worker Changes Summary

### SCAN-05 processor

```typescript
// In worker.ts -- add post-sync hook on urteile-sync completion:
urteileSyncWorker.on("completed", async (job) => {
  // ... existing logging ...
  if (job.returnvalue?.inserted > 0) {
    await scan05Queue.add("scan-05", {
      insertedCount: job.returnvalue.inserted,
    });
  }
});

// New scan-05 worker (concurrency: 1, same pattern as scanner)
const scan05Worker = new Worker("scan-05", async () => {
  return processScan05();
}, {
  connection,
  concurrency: 1,
  settings: {
    backoffStrategy: (attemptsMade: number) => calculateBackoff(attemptsMade),
  },
});
```

### No other worker changes

Messaging is synchronous (API route -> Prisma -> Socket.IO emit). No BullMQ jobs needed for message delivery.

---

## Socket.IO Room Changes

```typescript
// In rooms.ts -- add channel room management:
socket.on("join:channel", (channelId: string) => {
  if (!channelId || typeof channelId !== "string") return;
  socket.join(`channel:${channelId}`);
  log.debug({ userId, channelId }, "Joined channel room");
});

socket.on("leave:channel", (channelId: string) => {
  if (!channelId || typeof channelId !== "string") return;
  socket.leave(`channel:${channelId}`);
  log.debug({ userId, channelId }, "Left channel room");
});
```

---

## UI Component Inventory

### Messaging (new page: `/dashboard/nachrichten`)

```
src/components/messaging/channel-sidebar.tsx     -- Channel list with unread badges
src/components/messaging/channel-view.tsx         -- Message thread view (scrollable)
src/components/messaging/message-item.tsx          -- Single message bubble
src/components/messaging/message-composer.tsx      -- Textarea with Enter-to-send, @mention
src/components/messaging/typing-indicator.tsx      -- "User tippt..." indicator
src/app/(dashboard)/nachrichten/page.tsx           -- Main messaging page
src/app/(dashboard)/nachrichten/layout.tsx         -- Split layout (sidebar + thread)
```

### Messaging in Akte Detail (embedded)

```
src/components/akten/akte-thread.tsx              -- Akte discussion thread (uses Channel with typ=AKTE_THREAD)
```

This component embeds in the existing Akte detail page as a new feed type alongside the existing activity feed. The AKTE_THREAD channel is auto-created on first message.

### Falldatenblaetter (extend existing)

```
src/components/falldaten/template-editor.tsx       -- Visual schema builder (add/remove/reorder fields)
src/components/falldaten/template-list.tsx          -- Template management page
src/components/falldaten/template-review.tsx        -- Admin review panel (approve/reject)
src/components/falldaten/auto-fill-button.tsx       -- Helena auto-fill trigger button
src/app/(dashboard)/admin/falldaten-templates/page.tsx  -- Admin template management
```

### SCAN-05 (zero new components)

The existing `AlertCenter`, `AkteAlertsSection`, and notification system already handle `NEUES_URTEIL` alerts. The only addition is populating the `meta` JSON field with urteil details (Aktenzeichen, Gericht, Datum, relevance score) so the existing alert UI can display them.

---

## Alternatives Considered

| Category | Decision | Alternative | Why Not |
|---|---|---|---|
| Real-time messaging | Socket.IO (existing) | Server-Sent Events | Socket.IO already handles bidirectional comms, rooms, auth. SSE is one-way only. |
| Real-time messaging | Socket.IO (existing) | Pusher / Ably / Stream Chat | Contradicts self-hosted-first constraint. Socket.IO + Redis adapter already provides horizontal scaling. |
| Message storage | PostgreSQL (Prisma) | Redis Streams | Messages need persistence, relations (replies, mentions, channels), RBAC, soft-delete. Postgres is the right choice. |
| Message composer | Plain textarea | TipTap with Mention extension | @tiptap/extension-mention is NOT installed. Regex-based @mention parsing on submit is proven (v0.2 pattern). TipTap adds autocomplete dropdown complexity for limited value in internal messaging. |
| @Mention autocomplete | Regex on submit | TipTap Mention extension | Would require installing `@tiptap/extension-mention` + `@tiptap/suggestion`. Regex parsing is 10 LOC vs new dependency + suggestion popup component. Can upgrade later. |
| Client state management | React Context + useState | Zustand / Jotai / React Query | No global state library exists in the codebase. Adding one for messaging creates two state management patterns. Context + local state is the established approach. |
| Falldaten schemas | DB-stored JSON + Zod | JSON Schema draft-07 + ajv | FalldatenSchema type is simpler than JSON Schema. Zod validates at runtime without heavyweight JSON Schema specification. |
| Falldaten form builder | Custom field editor | React JSON Schema Form | Would require `@rjsf/core` + UI adapter. The existing `FalldatenForm` is 237 LOC and renders all 7 field types. A template editor is an extension of this, not a new form framework. |
| SCAN-05 trigger | Post-sync hook (event-driven) | Separate daily cron | Running immediately after new urteile arrive is more timely. Separate cron would create a 24h delay between ingestion and alerting. |
| SCAN-05 search | Global document_chunks query per urteil | Per-Akte iteration | One pgvector query per urteil (LIMIT 50, threshold filter) is O(log n). Per-Akte iteration would be O(m * log n). Global + group-by is faster and simpler. |
| Helena auto-fill | generateObject with dynamic Zod schema | Free-form text extraction + regex parsing | Structured output via generateObject guarantees type-safe results that map directly to FalldatenSchema fields. Regex parsing is fragile for varied legal documents. |

---

## What NOT to Add

| Package/Technology | Why NOT | Use Instead |
|---|---|---|
| `@tiptap/extension-mention` | Not installed. Regex @mention parsing is proven, simpler, and matches v0.2 pattern. | `parseUserMentions()` regex function |
| `pusher` / `ably` / `stream-chat` | Cloud services, violates self-hosted constraint | Socket.IO + Redis adapter (existing) |
| `@tanstack/react-query` | Not in codebase. Adding a query library creates two data-fetching patterns. | `fetch()` + `useEffect` + `router.refresh()` (existing pattern) |
| `ajv` / JSON Schema validators | Overkill. FalldatenSchema is a simple type, not JSON Schema draft-07. | Zod runtime validation (existing) |
| `slate` / `lexical` / `quill` | TipTap already installed. No reason for competing editor. | TipTap if rich text needed; plain textarea for messaging |
| `zustand` / `jotai` | No global state management exists. Adding one mid-project is disruptive. | React Context + useState (existing pattern) |
| `socket.io-msgpack-parser` | Binary encoding optimization for high-throughput. A Kanzlei has <20 concurrent users. | Default JSON parser (existing) |
| Any new Docker service | 9 services is already complex. All features run on existing infrastructure. | PostgreSQL, Redis, existing services |

---

## Installation

```bash
# No new packages to install.
# After Prisma schema changes:
npx prisma migrate dev --name v03-messaging-falldaten-templates
npx prisma generate

# Seed existing Falldaten schemas into FalldatenTemplate table:
npx prisma db seed
# (Add seed logic in prisma/seed.ts to import from falldaten-schemas.ts)
```

---

## Confidence Assessment

| Area | Confidence | Reason |
|---|---|---|
| Messaging stack | HIGH | Socket.IO rooms, Prisma models, textarea composer -- all validated patterns from v0.2 |
| SCAN-05 stack | HIGH | pgvector search, BullMQ processor, HelenaAlert (NEUES_URTEIL already in enum) -- all existing infrastructure |
| Falldatenblaetter stack | HIGH | FalldatenSchema type system + FalldatenForm component already exist. Change is storage (code -> DB) + access control. |
| Zero new packages | HIGH | Verified every capability against 80+ installed dependencies in package.json |

---

## Sources

- Codebase analysis (all HIGH confidence):
  - `src/lib/socket/server.ts` -- Socket.IO setup with Redis adapter
  - `src/lib/socket/rooms.ts` -- Room management patterns (user, role, akte, mailbox)
  - `src/lib/socket/emitter.ts` -- Redis emitter for worker-to-browser push
  - `src/components/socket-provider.tsx` -- Client Socket.IO connection
  - `src/lib/embedding/vector-store.ts` -- pgvector search with cross-Akte support
  - `src/lib/embedding/hybrid-search.ts` -- Hybrid BM25 + pgvector with RRF
  - `src/lib/embedding/embedder.ts` -- Ollama embedding generation
  - `src/lib/urteile/ingestion.ts` -- Urteil ingestion with embedding + PII gate
  - `src/lib/queue/processors/urteile-sync.processor.ts` -- Daily RSS sync
  - `src/workers/processors/scanner.ts` -- Background scanner pattern
  - `src/lib/helena/tools/_write/create-alert.ts` -- Alert creation with NEUES_URTEIL type
  - `src/lib/notifications/service.ts` -- Notification creation + Socket.IO push
  - `src/lib/falldaten-schemas.ts` -- Complete schema type system (10 schemas, 7 field types)
  - `src/components/akten/falldaten-form.tsx` -- Dynamic form renderer
  - `src/components/akten/activity-feed-composer.tsx` -- Textarea composer with @Helena
  - `src/lib/helena/at-mention-parser.ts` -- Regex @mention parsing
  - `src/worker.ts` -- 16 BullMQ workers, startup, graceful shutdown
  - `prisma/schema.prisma` -- 70+ models, HelenaAlert with NEUES_URTEIL enum
  - `package.json` -- Full dependency list (80+ packages)
- v0.2 precedent: "Zero new npm packages" decision validated successful

---

*Stack research for: AI-Lawyer v0.3 -- Kanzlei-Collaboration (Internes Messaging, SCAN-05, Falldatenblaetter)*
*Researched: 2026-02-28*
