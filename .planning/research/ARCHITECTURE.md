# Architecture Research: v0.3 Feature Integration

**Domain:** Internes Messaging + SCAN-05 Neu-Urteil-Check + Falldatenblaetter — integration into existing AI-Lawyer architecture
**Researched:** 2026-02-28
**Confidence:** HIGH (codebase directly inspected; all integration points verified against existing schema, workers, Socket.IO, and scanner patterns)

---

## Executive Summary

Three features integrate into a mature 70+ model Prisma schema with established patterns for real-time (Socket.IO rooms + Redis adapter), background processing (BullMQ workers), alerts (HelenaAlert with dedup/escalation), and vector search (pgvector HNSW + hybrid RRF). The key architectural insight is that **all three features extend existing subsystems rather than creating new ones** -- Messaging extends Socket.IO rooms + AktenActivity, SCAN-05 extends the urteile-sync processor + scanner alert pipeline, and Falldatenblaetter extends the existing `falldaten` JSON field + `falldaten-schemas.ts` registry.

---

## Existing Architecture Inventory (Relevant Surfaces)

### Socket.IO Infrastructure
- **server.ts**: Custom HTTP server wrapping Next.js, Socket.IO attached at port 3000
- **Redis adapter**: `@socket.io/redis-adapter` for cross-process pub/sub (horizontal scaling ready)
- **Redis emitter**: `@socket.io/redis-emitter` singleton in worker process for server-less event emission
- **Auth middleware**: NextAuth v5 JWE token decode from cookies, populates `socket.data.{userId, role, kanzleiId}`
- **Room conventions**: `user:{userId}`, `role:{ROLE}`, `akte:{akteId}`, `mailbox:{kontoId}` (dynamic join/leave)
- **No kanzlei-wide room** exists yet -- only `role:*` rooms for broadcast

### BullMQ Worker Infrastructure
- **16 queues** defined in `src/lib/queue/queues.ts` with shared backoff strategy
- **Single worker process** (`src/worker.ts`) with all processors, graceful shutdown
- **Repeatable cron jobs**: frist-reminder (06:00), scanner (01:00), gesetze-sync (02:00), urteile-sync (03:00), ai-briefing (07:00), ai-proactive (every 4h)
- **Job scheduler pattern**: `upsertJobScheduler` for idempotent cron registration

### Alert System
- **HelenaAlert** model: 6 types (`FRIST_KRITISCH`, `AKTE_INAKTIV`, `BETEILIGTE_FEHLEN`, `DOKUMENT_FEHLT`, `WIDERSPRUCH`, `NEUES_URTEIL`), severity 1-10, 24h dedup, auto-resolve, 3/7-day escalation
- `NEUES_URTEIL` type already exists in the enum but **no scanner check implements it yet** (SCAN-05 was explicitly deferred)
- **createScannerAlert()**: Creates HelenaAlert + AktenActivity + Socket.IO badge push + optional notification

### Activity Feed
- **AktenActivity** model: 8 types (`DOKUMENT`, `FRIST`, `EMAIL`, `HELENA_DRAFT`, `HELENA_ALERT`, `NOTIZ`, `BETEILIGTE`, `STATUS_CHANGE`)
- Chronological feed per Akte, replaces tabbed UI
- Feed items created by both human actions and scanner/agent

### RAG / Vector Search
- **4 vector tables**: `document_chunks`, `law_chunks`, `urteil_chunks`, `muster_chunks` -- all with `vector(1024)` HNSW indexes
- **Embedding model**: `multilingual-e5-large-instruct` via Ollama, E5 instruction prefixes (`passage:` / `query:`)
- **Hybrid search**: BM25 (Meilisearch) + pgvector + RRF fusion + LLM reranking
- `hybridSearch()` already supports `crossAkte: true` mode with RBAC post-filtering

### Urteile Pipeline
- **RSS client**: 7 BMJ federal court feeds, title regex parser, 15s timeout
- **Ingestion**: PII-gated via inline NER, GUID cache in SystemSetting, idempotent DELETE+INSERT
- **Search**: `searchUrteilChunks()` -- pure pgvector cosine similarity, no BM25 hybrid (urteil content is short leitsaetze)

### Falldaten (Existing Foundation)
- **Akte.falldaten**: `Json?` column on Akte model -- already stores case-specific data
- **falldaten-schemas.ts**: Static TypeScript registry mapping Sachgebiet to FalldatenSchema (10 schemas: Arbeitsrecht through Verwaltungsrecht)
- **FalldatenForm component**: Dynamic form renderer consuming FalldatenSchema, saves via PATCH `/api/akten/{id}`
- **FalldatenFeld types**: text, textarea, number, date, select, boolean, currency -- with groups

---

## Feature 1: Internes Messaging

### Architecture Decision: Thin Messaging Layer on Existing Primitives

Build messaging as a thin persistence + delivery layer on top of existing Socket.IO infrastructure and Activity Feed patterns. NOT a full Slack clone -- scope to kanzlei-internal communication with case binding.

### New Prisma Models

```prisma
enum ChannelTyp {
  AKTE       // Bound to an Akte (case thread)
  ALLGEMEIN  // Kanzlei-wide topic channel
}

model Channel {
  id            String      @id @default(cuid())
  name          String      // Display name (e.g., "Orga", "News", or auto-generated from Akte)
  typ           ChannelTyp
  beschreibung  String?
  akteId        String?     // Non-null for AKTE channels (FK to Akte)
  akte          Akte?       @relation(fields: [akteId], references: [id], onDelete: Cascade)
  kanzleiId     String?
  kanzlei       Kanzlei?    @relation(fields: [kanzleiId], references: [id])
  erstelltVonId String
  erstelltVon   User        @relation("ChannelErsteller", fields: [erstelltVonId], references: [id])
  archiviert    Boolean     @default(false)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  nachrichten   ChannelNachricht[]
  mitglieder    ChannelMitglied[]

  @@unique([akteId])  // One channel per Akte
  @@index([typ])
  @@index([kanzleiId])
  @@map("channels")
}

model ChannelMitglied {
  id          String    @id @default(cuid())
  channelId   String
  channel     Channel   @relation(fields: [channelId], references: [id], onDelete: Cascade)
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  lastReadAt  DateTime  @default(now())  // For unread badge computation
  stumm       Boolean   @default(false)  // Mute notifications
  joinedAt    DateTime  @default(now())

  @@unique([channelId, userId])
  @@index([userId])
  @@map("channel_mitglieder")
}

model ChannelNachricht {
  id          String    @id @default(cuid())
  channelId   String
  channel     Channel   @relation(fields: [channelId], references: [id], onDelete: Cascade)
  senderId    String
  sender      User      @relation(fields: [senderId], references: [id])
  inhalt      String    @db.Text
  meta        Json?     // Attachments, mentions, etc.
  bearbeitet  Boolean   @default(false)
  geloescht   Boolean   @default(false)  // Soft delete
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  mentions    Mention[]

  @@index([channelId, createdAt])
  @@index([senderId])
  @@map("channel_nachrichten")
}

model Mention {
  id            String           @id @default(cuid())
  nachrichtId   String
  nachricht     ChannelNachricht @relation(fields: [nachrichtId], references: [id], onDelete: Cascade)
  userId        String
  user          User             @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("mentions")
}
```

### Why This Model Structure

1. **@@unique([akteId])** on Channel: One discussion channel per Akte. Auto-created on first message. Prevents channel sprawl. AKTE channels inherit Akte RBAC -- only users with Akte access can see messages.

2. **ChannelMitglied.lastReadAt**: Enables O(1) unread count computation per channel (`WHERE createdAt > lastReadAt`). No need for per-message read receipts (overkill for small kanzlei).

3. **Mention** as separate model (not just JSON): Enables indexed `WHERE userId = ?` queries for "all my mentions" view and notification delivery. Much faster than scanning JSON arrays.

4. **Soft delete** on messages: Legal compliance -- messages may need audit trail. `geloescht = true` hides from UI but preserves for DSGVO Auskunft.

### Socket.IO Integration

**New room convention:** `channel:{channelId}` -- dynamic join/leave, same pattern as `akte:{akteId}`.

```
// rooms.ts additions:
socket.on("join:channel", (channelId: string) => { ... });
socket.on("leave:channel", (channelId: string) => { ... });
```

**New events (server -> client):**
- `channel:message` -- new message in a channel the user has joined
- `channel:typing` -- typing indicator (ephemeral, no persistence)
- `channel:unread` -- unread count update for sidebar badge

**New events (client -> server):**
- `channel:send` -- send a message (validated + persisted server-side, NOT via REST)
- `channel:typing-start` / `channel:typing-stop` -- typing indicators
- `channel:mark-read` -- update lastReadAt

**Why Socket.IO for sending (not REST):** Messages are ephemeral-feeling UX. Socket.IO gives instant delivery without HTTP roundtrip overhead. The server-side handler validates auth, persists to DB, then broadcasts. This matches Slack/Discord patterns and the existing Socket.IO-first architecture.

**Alternative pattern -- REST + Socket.IO push:** Use POST `/api/channels/{id}/messages` for creation, Socket.IO only for push delivery. This is safer (HTTP gives explicit error responses, retry semantics) and should be the implementation choice. Socket.IO typing indicators remain ephemeral.

**Recommended:** REST for writes (POST message, PATCH edit, DELETE), Socket.IO for push delivery + ephemeral events (typing, presence). This matches the existing pattern where scanner/worker creates DB records and uses `getSocketEmitter()` to push.

### RBAC Rules

| Channel Type | Who Can See | Who Can Post | Who Can Create |
|---|---|---|---|
| AKTE | Users with Akte access (anwalt, sachbearbeiter, Dezernat members, admin override) | Same | Auto-created on first message to Akte |
| ALLGEMEIN | All active kanzlei users | All active kanzlei users | ADMIN, ANWALT |

AKTE channel RBAC piggybacks on existing `buildAkteAccessFilter()` from `src/lib/rbac.ts`. No new permission system needed.

### Relation to Activity Feed

AKTE channel messages are NOT duplicated into AktenActivity. The Activity Feed tracks case events (documents, deadlines, drafts). Messaging is conversation -- different purpose. The Akte detail page shows both: Activity Feed for case timeline, Channel for discussion.

**However**, @Helena mentions in AKTE channels SHOULD create a HelenaTask (same as @Helena in the activity feed composer). This reuses the existing `@-mention parsing -> BullMQ helena-task queue` pipeline.

### Data Flow

```
User types message in Akte channel
  -> POST /api/channels/{channelId}/messages (REST)
  -> Server: validate auth + RBAC, persist ChannelNachricht
  -> Server: parse @mentions, create Mention records
  -> Server: emit Socket.IO "channel:message" to room "channel:{channelId}"
  -> Server: for each @mentioned user NOT in room, emit "channel:unread" to "user:{userId}"
  -> Server: if @Helena mentioned, enqueue HelenaTask via BullMQ
  -> Client: receives "channel:message", appends to message list
  -> Client: sidebar badge updates via "channel:unread" event
```

### UI Components (New)

| Component | Location | Purpose |
|---|---|---|
| `ChannelSidebar` | Dashboard sidebar (new section) | List channels, unread badges, create channel |
| `ChannelView` | `/messaging/{channelId}` page | Message list, composer, typing indicators |
| `AkteChannelPanel` | Akte detail page (new panel/tab) | Inline channel view for case discussion |
| `MentionAutocomplete` | Within composer | @-mention user picker |

### API Routes (New)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/channels` | List channels for current user |
| POST | `/api/channels` | Create ALLGEMEIN channel |
| GET | `/api/channels/{id}/messages` | Paginated message history |
| POST | `/api/channels/{id}/messages` | Send message |
| PATCH | `/api/channels/{id}/messages/{msgId}` | Edit message |
| DELETE | `/api/channels/{id}/messages/{msgId}` | Soft-delete message |
| POST | `/api/channels/{id}/mark-read` | Update lastReadAt |

---

## Feature 2: SCAN-05 Neu-Urteil-Check

### Architecture Decision: Hook Into Existing Urteile Sync Pipeline

SCAN-05 runs as a **post-ingestion hook** inside the urteile-sync processor, NOT as a separate cron job. When new Urteile are ingested, each newly inserted Urteil is immediately matched against all open Akten. This avoids a second pass and ensures alerts are generated within minutes of RSS ingestion.

### Why Post-Ingestion Hook (Not Separate Scanner Check)

1. **Embedding already generated**: `ingestUrteilItem()` already generates an embedding for the Urteil content. Reusing this embedding for cross-Akte matching is free.
2. **Timing**: The nightly scanner runs at 01:00, urteile-sync at 03:00. A separate scanner check would need to run after 03:00, adding complexity. Hooking into ingestion processes Urteile as they arrive.
3. **Existing `NEUES_URTEIL` alert type**: Already in the `HelenaAlertTyp` enum. Just needs a check that creates it.
4. **Batch efficiency**: Process all newly ingested Urteile in one pass against the Akte summaries.

### Cross-Akte Matching Strategy

The challenge: match a new Urteil (short leitsatz, typically 50-200 words) against active Akten (which have documents, not compact summaries). Two approaches considered:

**Option A: Urteil embedding vs. document_chunks (existing)**
- Cosine similarity search of Urteil embedding against all document_chunks for OFFEN Akten
- Pro: Uses existing HNSW index
- Con: Matches document fragments, not case summaries. A Kuendigungsschutzklage case has hundreds of chunks about employment details -- a BAG Urteil about Kuendigungsfrist would match but with low specificity

**Option B: Urteil embedding vs. Akte summary embeddings (new)**
- Generate compact Akte summary embeddings from HelenaMemory content or Falldaten + kurzrubrum + Sachgebiet
- Pro: Matches case-level semantics, not document fragments. Much more precise.
- Con: Requires new embeddings table or column

**Recommended: Option B -- Akte-level summary embedding**

Add an `akteEmbedding` column to the Akte model (or a separate `AkteSummaryEmbedding` table). Generated from:
- `kurzrubrum` (always present)
- `sachgebiet` (always present)
- `wegen` (often present)
- HelenaMemory.content summary (when available)
- Top Falldaten fields (when filled)

This produces a 200-500 word Akte summary that captures case semantics. The embedding is regenerated whenever HelenaMemory refreshes (already has auto-refresh on agent runs).

### New Prisma Changes

```prisma
// Add to Akte model:
model Akte {
  // ... existing fields ...
  summaryEmbedding  Unsupported("vector(1024)")?  // Akte-level semantic summary
  summaryText       String?  @db.Text              // The text used to generate the embedding
  summaryUpdatedAt  DateTime?                       // Track staleness
}
```

Add HNSW index via migration:

```sql
CREATE INDEX akten_summary_embedding_idx ON akten
USING hnsw ("summaryEmbedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### SCAN-05 Processing Flow

```
Urteile Sync Processor (03:00 nightly cron)
  -> For each court feed:
     -> Fetch RSS items
     -> For each new item (not in GUID cache):
        -> ingestUrteilItem() -> "inserted" / "pii_rejected" / "error"
        -> IF "inserted":
           -> Add to newlyInserted[] array with embedding
  -> After all courts processed:
     -> IF newlyInserted.length > 0:
        -> scanNewUrteileForRelevance(newlyInserted)

scanNewUrteileForRelevance(urteile: UrteilWithEmbedding[]):
  -> Load all OFFEN Akten with summaryEmbedding IS NOT NULL
  -> For each Urteil:
     -> Cosine similarity against all Akte summaries (single SQL query)
     -> Filter: score >= 0.72 AND akte.sachgebiet matches urteil.rechtsgebiet (soft match)
     -> For each matching Akte:
        -> createScannerAlert({
             akteId, typ: "NEUES_URTEIL",
             titel: "Neues relevantes Urteil: {gericht} {aktenzeichen}",
             meta: { urteilChunkId, gericht, aktenzeichen, datum, score, sourceUrl }
           })
```

### Rechtsgebiet Soft Match

Not all Sachgebiet/Rechtsgebiet pairs map 1:1. A BGH Urteil (Rechtsgebiet: "Zivilrecht") could be relevant for Mietrecht, Familienrecht, or Handelsrecht Akten. The match rules:

| Urteil Rechtsgebiet | Matches Akte Sachgebiete |
|---|---|
| Arbeitsrecht | ARBEITSRECHT |
| Zivilrecht | MIETRECHT, FAMILIENRECHT, HANDELSRECHT, ERBRECHT, INKASSO, VERKEHRSRECHT |
| Verwaltungsrecht | VERWALTUNGSRECHT |
| Sozialrecht | SOZIALRECHT |
| Steuerrecht | (no direct Sachgebiet match -- low priority) |
| Verfassungsrecht | ALL (constitutional decisions can affect any area) |
| Patentrecht | HANDELSRECHT |

Use this as a **pre-filter before vector similarity** to reduce the search space and avoid false positives.

### Summary Embedding Refresh

When to regenerate Akte summary embeddings:
1. **HelenaMemory refresh** (auto-refresh after agent runs) -- trigger via event
2. **Falldaten PATCH** -- trigger via API route after save
3. **Akte creation** -- generate initial summary from kurzrubrum + sachgebiet + wegen
4. **Nightly batch** -- regenerate stale summaries (summaryUpdatedAt < 7 days ago) in scanner cron

### Integration with Existing Alert System

SCAN-05 alerts use the existing `createScannerAlert()` function. This automatically:
- Creates HelenaAlert with dedup (same urteil + same Akte within 24h)
- Creates AktenActivity entry for the Akte feed
- Emits Socket.IO badge count update
- Supports 3/7-day escalation

**Alert UI enhancement**: The Akte detail feed item for NEUES_URTEIL should render as a card showing Gericht, Aktenzeichen, Datum, Leitsatz excerpt, and a link to the full text on rechtsprechung-im-internet.de. This is a UI-only change in the activity feed renderer.

### Performance Considerations

- **Open Akten count**: Small kanzlei, ~50-500 active cases. Cross-Akte matching is cheap.
- **New Urteile per day**: 7 RSS feeds, ~5-20 new items per feed = ~35-140 items. After PII filter, ~80% pass = ~28-112 items.
- **Total cosine comparisons**: 112 urteile * 500 akten = 56,000. With pgvector HNSW index, this is milliseconds.
- **Embedding generation for Akte summaries**: One-time batch for existing Akten, then incremental. ~500 * 200ms = ~100s for initial batch -- acceptable as background job.

---

## Feature 3: Falldatenblaetter (Enhanced)

### Architecture Decision: Extend Existing Schema Registry Pattern

The existing `falldaten-schemas.ts` + `FalldatenForm` + `Akte.falldaten` JSON column is a solid foundation. The v0.3 enhancement adds:
1. **Database-backed templates** (not just TypeScript constants) for community workflow
2. **Helena auto-fill** from Akte data
3. **Helena template suggestion** from case patterns

### Current vs. Target Architecture

**Current:**
- `falldaten-schemas.ts`: Static TypeScript, 10 hardcoded schemas (one per Sachgebiet)
- `Akte.falldaten`: `Json?` column storing field values
- `FalldatenForm`: Renders schema + saves to Akte.falldaten

**Target:**
- **FalldatenTemplate** model: Database-persisted templates with JSON schema
- **Template lifecycle**: ENTWURF -> EINGEREICHT -> GENEHMIGT -> STANDARD
- **Seeded defaults**: Migrate existing TypeScript schemas to DB rows (same as `seedAmtlicheFormulare()` pattern)
- **Community workflow**: User creates template -> submits to Admin -> Admin approves -> becomes standard
- **Helena integration**: Auto-fill template fields from Akte data + suggest templates

### New Prisma Models

```prisma
enum FalldatenTemplateStatus {
  ENTWURF       // Created by user, private
  EINGEREICHT   // Submitted for admin review
  GENEHMIGT     // Approved by admin, visible to all
  STANDARD      // Default template for a Sachgebiet (seeded or admin-promoted)
  ABGELEHNT     // Rejected by admin
}

model FalldatenTemplate {
  id              String                   @id @default(cuid())
  name            String                   // Template name
  beschreibung    String?                  @db.Text
  sachgebiet      Sachgebiet?              // Optional -- STANDARD templates have this
  schema          Json                     // FalldatenSchema JSON (felder array)
  version         Int                      @default(1)

  status          FalldatenTemplateStatus  @default(ENTWURF)
  erstelltVonId   String
  erstelltVon     User                     @relation("FalldatenTemplateErsteller", fields: [erstelltVonId], references: [id])
  geprueftVonId   String?
  geprueftVon     User?                    @relation("FalldatenTemplatePruefer", fields: [geprueftVonId], references: [id])
  geprueftAt      DateTime?
  ablehnungsgrund String?                  @db.Text

  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @updatedAt

  // Instances using this template
  instanzen       FalldatenInstanz[]

  @@unique([sachgebiet, status], name: "unique_standard_per_sachgebiet")
  // Only one STANDARD template per Sachgebiet (partial unique -- enforced in app layer)
  @@index([status])
  @@index([sachgebiet])
  @@map("falldaten_templates")
}

model FalldatenInstanz {
  id            String             @id @default(cuid())
  akteId        String
  akte          Akte               @relation(fields: [akteId], references: [id], onDelete: Cascade)
  templateId    String
  template      FalldatenTemplate  @relation(fields: [templateId], references: [id])

  daten         Json               @default("{}")  // Field values
  ausgefuellt   Float              @default(0)     // Completion percentage (0.0-1.0)

  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt

  @@unique([akteId, templateId])  // One instance per template per Akte
  @@index([akteId])
  @@map("falldaten_instanzen")
}
```

### Why Separate FalldatenInstanz Instead of Using Akte.falldaten

The existing `Akte.falldaten` JSON column works for a single schema per Akte. But v0.3 requirements introduce:
- **Multiple templates per Akte**: A case might use both the Sachgebiet-standard template AND a custom "Mandantengespraech-Leitfaden" template
- **Template versioning**: When a template schema changes, instances track which template version they were created from
- **Completion tracking**: `ausgefuellt` enables dashboard views ("5 of 12 fields filled")
- **Community workflow**: Templates need their own lifecycle independent of Akte data

**Migration path**: Existing `Akte.falldaten` data is migrated to FalldatenInstanz records linked to the seeded STANDARD templates. The `Akte.falldaten` column is kept for backward compatibility but new code reads from FalldatenInstanz.

### Template Seeding

At worker startup (same pattern as `seedAmtlicheFormulare()`):

```typescript
async function seedFalldatenTemplates() {
  const guard = await getSetting("falldaten.templates_seeded");
  if (guard === "true") return;

  for (const [sachgebiet, schema] of Object.entries(falldatenSchemas)) {
    await prisma.falldatenTemplate.upsert({
      where: { sachgebiet_status: { sachgebiet, status: "STANDARD" } },
      create: {
        name: schema.label,
        beschreibung: schema.beschreibung,
        sachgebiet: sachgebiet as Sachgebiet,
        schema: schema as unknown as Prisma.InputJsonValue,
        status: "STANDARD",
        erstelltVonId: SYSTEM_USER_ID,
      },
      update: {},
    });
  }

  await updateSetting("falldaten.templates_seeded", "true");
}
```

### Community Template Workflow

```
User creates template (status: ENTWURF)
  -> User fills out schema definition (field names, types, groups)
  -> User tests by applying to an Akte
  -> User submits for review (status: EINGEREICHT)

Admin reviews (Admin panel: /admin/falldaten-templates)
  -> Sees all EINGEREICHT templates
  -> Can preview, edit, approve, reject
  -> Approve -> status: GENEHMIGT (visible to all users)
  -> Promote to STANDARD -> replaces current STANDARD for that Sachgebiet
  -> Reject -> status: ABGELEHNT with reason
```

### Helena Auto-Fill Integration

Helena already has access to Akte data through her tools (`read_akte`, `read_akte_detail`, `read_dokumente`, `read_dokumente_detail`). Auto-fill works by:

1. **New Helena tool: `fill_falldatenblatt`**
   - Input: `{ akteId, templateId }`
   - Reads current Akte data (Beteiligte, Dokumente, existing Falldaten, HelenaMemory)
   - Uses `generateObject()` (deterministic, same as Schriftsatz pipeline) with the template schema as Zod schema
   - Returns filled fields as JSON
   - Creates ENTWURF activity ("Helena hat Falldatenblatt vorausgefuellt")

2. **Triggering auto-fill:**
   - User clicks "Helena befuellen" button on the FalldatenInstanz form
   - Creates a HelenaTask with specific intent
   - Helena reads Akte context, generates structured data matching the template fields
   - Result stored as pending suggestion (same banner-refetch pattern as drafts)

### Helena Template Suggestion

When a new Akte is created (or Sachgebiet changes), Helena can suggest applicable templates:

1. **Rule-based first**: Always suggest the STANDARD template for the Akte's Sachgebiet
2. **Pattern-based second**: If the Akte's kurzrubrum/wegen matches patterns from GENEHMIGT templates used on similar Akten, suggest those too
3. **No LLM needed** for suggestion -- this is a Sachgebiet match + Prisma query

### API Routes (New)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/falldaten/templates` | List templates (filtered by status, sachgebiet) |
| POST | `/api/falldaten/templates` | Create template |
| GET | `/api/falldaten/templates/{id}` | Get template detail |
| PATCH | `/api/falldaten/templates/{id}` | Edit template |
| POST | `/api/falldaten/templates/{id}/submit` | Submit for review |
| POST | `/api/falldaten/templates/{id}/approve` | Admin: approve |
| POST | `/api/falldaten/templates/{id}/reject` | Admin: reject |
| GET | `/api/akten/{id}/falldaten` | List FalldatenInstanz for Akte |
| POST | `/api/akten/{id}/falldaten` | Create instance from template |
| PATCH | `/api/akten/{id}/falldaten/{instanzId}` | Update field values |
| POST | `/api/akten/{id}/falldaten/{instanzId}/helena-fill` | Trigger Helena auto-fill |

### UI Components (New/Modified)

| Component | Location | Purpose |
|---|---|---|
| `FalldatenTemplateBuilder` | `/admin/falldaten-templates/new` | Schema designer (drag-and-drop field editor) |
| `FalldatenTemplateReview` | `/admin/falldaten-templates/{id}` | Admin review UI |
| `FalldatenInstanzList` | Akte detail page | List of active templates for this Akte |
| `FalldatenInstanzForm` | Akte detail page (expanded) | Enhanced FalldatenForm with Helena-fill button and completion indicator |
| `TemplateSuggestionBanner` | Akte detail page | "Helena empfiehlt: Mandantengespraech-Leitfaden anwenden" |

---

## Cross-Feature Integration Points

### 1. @Helena in Channel Messages

When a user @mentions Helena in an AKTE channel message:
- Parse @Helena mention (reuse existing regex from activity feed composer)
- Create HelenaTask with `auftrag` = message content, `akteId` = channel's akteId
- Helena processes via existing agent pipeline
- Response posted back as a ChannelNachricht from the system user (Helena)

### 2. SCAN-05 Alert in Channel

When SCAN-05 creates a NEUES_URTEIL alert for an Akte:
- Also post a ChannelNachricht to the Akte's channel (if one exists)
- Content: "Neues relevantes Urteil gefunden: {gericht} {aktenzeichen} vom {datum}. Relevanz: {score}%. [Zum Urteil]({sourceUrl})"
- Sender: system user (Helena)
- This ensures the team discussing a case sees the alert in context

### 3. Helena Auto-Fill + Urteil Context

When Helena auto-fills a Falldatenblatt, she can use SCAN-05's matched Urteile as additional context. If a NEUES_URTEIL alert exists for the Akte, Helena includes relevant legal principles from the Urteil in her filling rationale.

### 4. Activity Feed Integration

| Event | AktenActivity Created? | Why |
|---|---|---|
| New AKTE channel message | NO | Channel is separate conversation view |
| @Helena in channel | YES (via HelenaTask) | Task result appears in feed |
| SCAN-05 alert | YES (via createScannerAlert) | Already integrated |
| Falldaten template applied | YES | Case event worth tracking |
| Helena auto-fill | YES (via HelenaTask) | Task result appears in feed |

---

## Component Boundary Map

```
                            +------------------+
                            |   Next.js App    |
                            |   (App Router)   |
                            +--------+---------+
                                     |
                    +----------------+----------------+
                    |                |                 |
             +------+------+  +-----+------+  +------+------+
             |  Messaging  |  | Falldaten  |  | SCAN-05     |
             |  API Routes |  | API Routes |  | (no routes) |
             +------+------+  +-----+------+  +------+------+
                    |                |                 |
                    v                v                 v
             +------+------+  +-----+------+  +------+------+
             |   Prisma    |  |   Prisma    |  |  Urteile    |
             |  Channel*   |  | Template*   |  |  Ingestion  |
             |  Nachricht* |  | Instanz*    |  |  + SCAN-05  |
             |  Mention*   |  |             |  |  hook       |
             +------+------+  +-----+------+  +------+------+
                    |                |                 |
                    v                v                 v
             +------+------+  +-----+------+  +------+------+
             | Socket.IO   |  |  Helena    |  | Scanner     |
             | Rooms +     |  |  Tools     |  | Alert       |
             | Emitter     |  |  (new:     |  | Pipeline    |
             | (existing)  |  |  fill_fdb) |  | (existing)  |
             +-------------+  +------------+  +-------------+

             * = new Prisma models
```

---

## Suggested Build Order

### Phase 1: Messaging Schema + API (No UI)
**Rationale:** Schema migration is the foundation. Messaging has the most new models (4). Running migration first unblocks all other work.

1. Add Prisma models (Channel, ChannelMitglied, ChannelNachricht, Mention)
2. Add User/Akte/Kanzlei relation updates
3. Run migration
4. Implement CRUD API routes
5. Add Socket.IO room `channel:{channelId}` + events
6. Test with direct API calls

### Phase 2: SCAN-05 (Backend Only)
**Rationale:** SCAN-05 has no UI beyond the existing alert system. It hooks into the existing urteile-sync processor. Building it second means the Akte summary embedding infrastructure is ready for Helena auto-fill in Phase 4.

1. Add `summaryEmbedding`, `summaryText`, `summaryUpdatedAt` to Akte model
2. Create HNSW index migration
3. Implement Akte summary text builder (kurzrubrum + wegen + sachgebiet + HelenaMemory)
4. Implement `generateAkteSummaryEmbedding()` function
5. Batch-generate embeddings for existing OFFEN Akten (BullMQ one-time job)
6. Hook `scanNewUrteileForRelevance()` into urteile-sync processor
7. Rechtsgebiet soft-match pre-filter
8. Test with real RSS data

### Phase 3: Falldatenblaetter Schema + Templates
**Rationale:** Depends on nothing from Phase 1 or 2. Could be parallel, but sequencing avoids migration conflicts.

1. Add FalldatenTemplate, FalldatenInstanz models
2. Run migration
3. Seed STANDARD templates from existing `falldaten-schemas.ts`
4. Migrate existing `Akte.falldaten` data to FalldatenInstanz records
5. Implement template CRUD API routes
6. Implement community workflow API (submit/approve/reject)

### Phase 4: Messaging UI
**Rationale:** Needs Phase 1 schema/API complete.

1. Channel sidebar section in dashboard
2. Channel list page
3. Channel message view with real-time updates
4. Akte detail: inline channel panel
5. @mention autocomplete
6. Unread badges

### Phase 5: Falldatenblaetter UI + Helena Integration
**Rationale:** Needs Phase 3 schema complete. Helena auto-fill depends on the FalldatenInstanz model.

1. Template builder UI (admin)
2. Template review UI (admin)
3. Akte detail: FalldatenInstanz list + form (enhanced)
4. Helena tool: `fill_falldatenblatt`
5. Helena template suggestion (rule-based)
6. Completion tracking + dashboard widget

### Phase 6: Cross-Feature Polish
**Rationale:** Integration points between features.

1. @Helena in channel messages -> HelenaTask
2. SCAN-05 alert -> Channel notification
3. NEUES_URTEIL activity feed card renderer
4. Summary embedding refresh triggers (HelenaMemory, Falldaten save)

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Building a Full Chat System
**What:** Adding threads, reactions, file uploads, message search, link previews, embeds
**Why bad:** Scope explosion. This is kanzlei-internal messaging for 5-15 users, not Slack.
**Instead:** Text messages, @mentions, soft delete. Add threads/reactions only if explicitly requested post-v0.3.

### Anti-Pattern 2: Separate Embedding Pipeline for SCAN-05
**What:** Creating a new BullMQ queue + worker for Akte summary embeddings
**Why bad:** Over-engineering. The existing urteile-sync processor already handles embedding. Summary generation is lightweight.
**Instead:** Inline embedding generation in the existing summary refresh flow. Batch initial generation as a one-time BullMQ job.

### Anti-Pattern 3: Dynamic Schema Builder Without Constraints
**What:** Letting users define arbitrary field types (nested objects, arrays, conditional fields, validation rules)
**Why bad:** Rendering complexity explodes. The existing FalldatenFeld types (text, textarea, number, date, select, boolean, currency) cover 95% of legal case data needs.
**Instead:** Keep the 7 existing field types. Add field ordering via `position: number` on FalldatenFeld. No nested fields.

### Anti-Pattern 4: Real-Time Collaborative Falldaten Editing
**What:** CRDT/OT-based concurrent editing of Falldaten fields
**Why bad:** Extreme complexity for minimal value. Legal case data is not collaboratively edited in real-time.
**Instead:** Last-write-wins with optimistic concurrency via `updatedAt` timestamp. Show "Zuletzt bearbeitet von {name} am {date}".

### Anti-Pattern 5: Storing Message History in Redis
**What:** Using Redis pub/sub for message persistence (not just delivery)
**Why bad:** Redis is volatile. Messages need DSGVO-compliant persistence with audit trail.
**Instead:** PostgreSQL for persistence, Redis only for Socket.IO pub/sub transport.

---

## Scalability Considerations

| Concern | Current Scale (5-15 users) | Future Scale (50+ users) |
|---|---|---|
| Message volume | ~100-500/day, no issues | Paginate API, add `createdAt` cursor pagination |
| Unread computation | COUNT WHERE createdAt > lastReadAt per channel | Cache in Redis sorted set if >100 channels |
| SCAN-05 matching | 50-500 Akten * 100 Urteile/day = trivial | Add Sachgebiet pre-filter to reduce search space (already planned) |
| Summary embeddings | 500 Akten, regenerate weekly = 100s total | Incremental only -- regenerate on HelenaMemory change |
| Template count | 10-50 templates | No scaling concern -- small, static data |

---

## Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Message persistence | PostgreSQL (Prisma) | DSGVO compliance, existing stack, audit trail |
| Message delivery | Socket.IO + Redis adapter | Already in place, proven, horizontal-scaling ready |
| Message creation | REST API + Socket.IO push | Existing pattern (scanner creates DB record, emits via Redis emitter) |
| SCAN-05 matching | pgvector cosine on Akte summaries | Reuses existing embedding infrastructure, no new dependencies |
| Template storage | PostgreSQL JSON column | Same pattern as existing falldaten, FalldatenSchema is already JSON-serializable |
| Helena auto-fill | generateObject() (Vercel AI SDK v4) | Same as Schriftsatz pipeline -- deterministic, schema-validated output |
| Template builder | React form with field type picker | No drag-and-drop library needed -- simple add/remove/reorder with state |

**Zero new npm packages.** All three features build on existing stack: Prisma, Socket.IO, pgvector, Vercel AI SDK v4, BullMQ.

---

## Sources

- Codebase inspection: `prisma/schema.prisma` (70+ models, all enums)
- Codebase inspection: `src/lib/socket/server.ts`, `rooms.ts`, `auth.ts`, `emitter.ts`
- Codebase inspection: `src/worker.ts`, `src/lib/queue/queues.ts` (16 queues, 6 cron jobs)
- Codebase inspection: `src/lib/scanner/service.ts` (createScannerAlert, dedup, escalation)
- Codebase inspection: `src/lib/urteile/ingestion.ts`, `rss-client.ts` (PII-gated ingestion)
- Codebase inspection: `src/lib/embedding/hybrid-search.ts` (RRF fusion, crossAkte mode)
- Codebase inspection: `src/lib/embedding/embedder.ts` (E5 multilingual, 1024-dim)
- Codebase inspection: `src/lib/falldaten-schemas.ts` (10 Sachgebiet schemas)
- Codebase inspection: `src/components/akten/falldaten-form.tsx` (dynamic form renderer)
- Codebase inspection: `src/lib/helena/tools/index.ts` (14 tools, role filter, cache)
- Confidence: HIGH -- all integration points verified against actual code, no external dependencies assumed
