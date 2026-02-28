# Feature Landscape

**Domain:** Kanzlei-Collaboration (Internal Messaging, Proactive Court Decision Monitoring, Structured Case Checklists)
**Researched:** 2026-02-28
**Confidence:** HIGH (features build on well-understood existing infrastructure)

---

## Feature Area 1: Internes Messaging (Slack-Style Channels + Case Threads)

### Table Stakes

Features users expect from an internal messaging system. Missing = feels incomplete or unusable.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Akten-Threads (Case Discussions) | Primary use case: team discusses a case in-context without leaving the Akte detail view | Med | AktenActivity feed (exists), Socket.IO rooms `akte:{id}` (exists) | Extends Activity Feed Composer -- messages appear chronologically alongside other events |
| Allgemeine Kanaele (General Channels) | Kanzlei-wide communication (Orga, News, ad-hoc) -- without this, users fall back to WhatsApp/Email | Med | New Prisma models (Channel, ChannelMessage, ChannelMember) | Admin-created + user-created channels; RBAC controls who can create |
| @Mentions with In-App Notifications | Users must be notified when addressed; without this, messages get missed | Med | Notification model (exists), Socket.IO `user:{id}` rooms (exists) | Parse @username or @roleName from message content, create Notification, push via Socket.IO |
| Real-Time Message Delivery | Messages must appear instantly for all channel/thread members | Low | Socket.IO (exists), Redis pub/sub emitter (exists) | Emit to `channel:{id}` or `akte:{id}` room on message creation |
| Unread Count / Badge | Users need to see at-a-glance what requires attention | Low | ChannelMember.lastReadAt tracking | Sidebar badge (like existing Alert-Center badge pattern) |
| Message Persistence | Messages must survive page refresh -- ephemeral is unacceptable for legal context | Low | PostgreSQL (exists) | Audit trail requirement for Kanzlei communication |
| Channel List / Sidebar Section | Entry point for messaging -- must be visible in navigation | Low | Sidebar component (exists, animated Glass design) | New sidebar section below existing nav items |

### Differentiators

Features that set this apart from "just another chat." Not expected, but valued.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| @Helena in Channels | Ask Helena questions in any channel -- she responds in-context (same ReAct agent) | Med | Helena @-mention parser (exists), HelenaTask queue (exists) | Extend at-mention-parser to work in channels, not just Akte Composer |
| Akte-Verknuepfung in Messages | Reference an Akte from a general channel message -- clickable link to case | Low | Akte model (exists) | Pattern: `#AZ-2026-0042` auto-linked, like GitHub issue references |
| Dokument-Verknuepfung in Messages | Attach/reference a DMS document in a message | Low | Dokument model (exists), MinIO (exists) | File picker from DMS, not local file upload |
| Threaded Replies in Channels | Reply to a specific message without cluttering main channel | Med | Parent-child message relation | Like Slack threads: reply in side-panel or inline collapse |
| Typing Indicators | Shows who is currently typing | Low | Socket.IO events (exists) | Ephemeral -- broadcast to room, no DB persistence |
| Message Editing / Deletion | Correct typos, remove accidental sends | Low | Soft-delete pattern, editedAt timestamp | Audit trail: store original in JSON history, show "(bearbeitet)" |
| Pinned Messages | Pin important messages to top of channel | Low | `pinned` boolean + `pinnedAt` on message | Useful for channel rules, important announcements |
| Message Search | Full-text search across all messages | Med | Meilisearch (exists) | Index messages like emails/documents are already indexed |

### Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| External/Client Messaging | DSGVO nightmare, mixes internal team comms with privileged client comms; scope creep into Mandantenportal | Keep internal-only; Mandantenportal is a separate future feature |
| File Upload (local files) | DMS is the single source of truth -- bypassing it creates untracked documents | Reference documents from DMS; add "Quick Upload to DMS + Reference" if needed |
| Voice/Video Calls | Massive complexity (WebRTC), far outside scope; teams already use phone/Teams | Link to external tools if needed |
| Message Reactions (Emoji) | Low value for a 5-person Kanzlei; adds UI complexity | Simple "Gelesen" indicator is sufficient |
| E2E Encryption | Self-hosted system behind VPN; E2E adds complexity without meaningful security gain for internal comms | TLS in transit, encrypted at rest in PostgreSQL is sufficient |
| Rich Text / WYSIWYG Editor | Overhead for quick messages; Markdown-like formatting is sufficient | Simple Markdown (bold, italic, code, links) via lightweight parser |
| Message Scheduling | Edge case; adds queue complexity for minimal value | Send immediately; use Kalender for time-sensitive reminders |

### Feature Dependencies (Messaging)

```
Channel Model + ChannelMessage Model --> Channel List UI --> Message Sending
                                                         --> Real-Time Delivery (Socket.IO)
                                                         --> @Mention Parsing --> Notification
Akte Activity Composer (exists) --> Akten-Thread Messages (reuse Composer, new message type)
                                --> Helena @-mention in threads (existing parser)
ChannelMember.lastReadAt --> Unread Count Badge
```

---

## Feature Area 2: SCAN-05 Neu-Urteil-Check (Cross-Akte Semantic Court Decision Matching)

### Table Stakes

Features users expect from proactive court decision monitoring. Missing = feature is non-functional.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Cross-Akte Semantic Matching | Core value: when a new Urteil is ingested via RSS, check if it is relevant to any open Akte | High | UrteilChunk embeddings (exists), Akte-level embeddings/keywords (needs creation), pgvector (exists) | Key challenge: what represents an "Akte" for semantic comparison? Must build Akte-level query vector from case summary/Sachgebiet/key terms |
| NEUES_URTEIL Alert Creation | When a match is found, create an alert in the existing Alert system | Low | HelenaAlert model with NEUES_URTEIL typ (exists), Alert-Center UI (exists) | Direct reuse of existing infrastructure -- alert.meta carries { urteilChunkId, aktenzeichen, score } |
| Relevance Threshold | Only alert on genuinely relevant matches, not noise | Med | Configurable via SystemSetting (exists) | Must tune cosine similarity threshold carefully; too low = alert fatigue, too high = missed relevant cases |
| Socket.IO Push for Alerts | Real-time notification when a new relevant Urteil is found | Low | Socket.IO emitter (exists), Alert push (exists) | Existing pattern: emit to `user:{userId}` room |
| Akte-Detail: Relevant Urteile Section | Show matched Urteile in the Akte detail view | Med | UrteilChunk model (exists), Akte relation needed | Link from alert.meta.urteilChunkId to display source, Gericht, AZ, Datum |

### Differentiators

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Helena Urteil-Briefing | Helena summarizes why the Urteil is relevant to the specific Akte (not just "score > threshold") | Med | Helena LLM (exists), HelenaMemory (exists) | One LLM call per match to generate a 2-3 sentence explanation; stored in alert.inhalt |
| Sachgebiet-Filtered Matching | Only match Urteile against Akten in the same Rechtsgebiet | Low | UrteilChunk.rechtsgebiet (exists), Akte.sachgebiet (exists) | Reduces false positives significantly; WHERE clause in matching query |
| Batch Matching on RSS Sync | Run matching immediately after urteile-sync cron completes (not a separate cron) | Low | urteile-sync processor (exists) | Chain: urteile-sync -> emit "new urteile inserted" IDs -> SCAN-05 processes those IDs |
| Manual Re-Check | User can trigger "Suche relevante Urteile" for a specific Akte on demand | Low | Helena tool search-urteile (exists) | Already exists as a Helena tool; just needs UI button in Akte-Detail |
| Deduplication | Do not alert twice for the same Urteil-Akte pair | Low | Unique constraint or check before insert | meta.urteilChunkId + akteId uniqueness check |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full-Text Keyword Matching (only) | BM25 alone misses semantic similarity -- a Kuendigungsschutz case should match a Kuendigungsschutzklage Urteil even without exact keyword overlap | Use pgvector cosine similarity (semantic); optionally combine with BM25 via RRF like existing hybrid search |
| Auto-Pin Urteile to Akte | LLM confidence is not high enough to auto-associate legal precedent without human review | Create NEUES_URTEIL alert; user reviews and manually pins via existing AkteNorm pattern or new UrteilVerknuepfung |
| Per-Document Matching | Matching every Urteil against every document chunk in every Akte is O(n*m) and computationally infeasible | Match against Akte-level representation (HelenaMemory summary + Sachgebiet + kurzrubrum + falldaten keywords) |
| Real-Time Matching on RSS Item Arrival | RSS sync processes 7 feeds sequentially; matching during sync would block the pipeline | Decouple: urteile-sync inserts, then SCAN-05 job runs matching batch on newly inserted IDs |

### Feature Dependencies (SCAN-05)

```
Urteile-Sync Processor (exists) --> Newly Ingested Urteil IDs
                                --> SCAN-05 Matching Job (new BullMQ queue or chained in scanner)
Akte-Level Embedding/Summary    --> Built from HelenaMemory.content (exists) + Akte.kurzrubrum + Akte.sachgebiet
                                --> pgvector cosine similarity query
Match Result (score > threshold) --> HelenaAlert(typ=NEUES_URTEIL) creation
                                 --> Socket.IO push notification
                                 --> Helena Briefing (optional LLM explanation)
```

---

## Feature Area 3: Falldatenblaetter (Dynamic Case Checklists with Community Workflow + Helena Integration)

### Table Stakes

Features users expect from structured case data collection. Missing = feature is incomplete.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Dynamic Form Rendering from Schema | Render a form (text, select, date, boolean, currency, textarea, number fields) from a JSON schema definition | Low | FalldatenSchema types (exists in `falldaten-schemas.ts`), Akte.falldaten JSON column (exists) | Already have 10 Sachgebiet schemas defined; form rendering is the main new work |
| Falldatenblatt per Akte (linked to Sachgebiet) | Each Akte shows its Sachgebiet-specific form; data saves to Akte.falldaten | Low | Akte.sachgebiet (exists), Akte.falldaten (exists), getFalldatenSchema() (exists) | Minimal new backend work -- form writes to existing JSON column |
| Grouped Field Rendering | Fields grouped visually by `gruppe` property (e.g., "Arbeitsverhaeltnis", "Kuendigung") | Low | FalldatenFeld.gruppe (exists in type) | Collapsible sections for better UX |
| Completeness Indicator | Show how many required fields are filled vs total (e.g., "12/18 ausgefuellt") | Low | FalldatenFeld.required (exists in type) | Simple computed value from schema + data |
| Multi-Type Field Support | text, textarea, number, date, select, boolean, currency -- all must render correctly | Med | FalldatenFeldTyp (exists) | Standard form components; currency needs Intl.NumberFormat |

### Table Stakes: Community Template Workflow

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| User Creates Custom Template | Any user can define a new Falldatenblatt schema for a case type not covered by the 10 built-in schemas | Med | New model: FalldatenTemplate with fields definition, status, creator | Schema builder UI: add/remove/reorder fields |
| Admin Review + Approval Workflow | Submitted templates go through Admin review before becoming available kanzlei-wide | Med | FalldatenTemplate.status (ENTWURF -> EINGEREICHT -> GENEHMIGT -> ABGELEHNT) | Admin sees pending templates in /admin section |
| Approved Template = Standard Option | Once approved, template appears in the Sachgebiet/Falltyp dropdown for new Akten | Low | Query approved templates + built-in schemas | Merge built-in + custom approved templates in UI picker |
| Template Versioning | When an approved template is updated, existing Akten keep their version; new Akten get the latest | Med | version field on template, Akte stores templateId + version | Critical: changing a template must not break existing filled-in data |

### Table Stakes: Helena Integration

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Helena Auto-Fill from Akte Data | Helena reads existing Akte data (Beteiligte, Dokumente OCR text, emails) and pre-fills Falldatenblatt fields | High | Helena ReAct agent (exists), read-akte-detail tool (exists), generateObject (AI SDK, exists) | Use generateObject with Falldaten schema as Zod schema; Helena maps extracted data to field keys |
| Helena Suggests Applicable Template | When a new Akte is created or Sachgebiet changes, Helena suggests which Falldatenblatt template fits | Med | Helena tools (exists), FalldatenTemplate query | Rule-based first (sachgebiet match), LLM for ambiguous cases |

### Differentiators

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Conditional Field Logic | Show/hide fields based on other field values (e.g., show "Kuendigungsfrist" only when "kuendigungsart" != "aufhebungsvertrag") | Med | Extended FalldatenFeld type with `showWhen` condition | Significant UX improvement; JSON-based condition: `{ field: "kuendigungsart", op: "neq", value: "aufhebungsvertrag" }` |
| Falldatenblatt PDF Export | Generate a PDF summary of the filled Falldatenblatt for the physical Akte | Med | PDF generation (pattern exists from Rechnungs-PDF) | Professional layout with Briefkopf; useful for Mandantengespraech preparation |
| Falldatenblatt in Activity Feed | When Helena auto-fills or user updates, show event in Activity Feed | Low | AktenActivity model (exists), AktenActivityTyp enum | Add new activity type or use NOTIZ type with meta |
| Template Sharing / Export | Export a template as JSON; import in another Kanzlei instance | Low | JSON serialization of schema | Useful for future multi-tenant scenarios |
| Helena Completeness Check | Helena proactively alerts when a Falldatenblatt is incomplete (e.g., "Fehlende Angaben: Kuendigungsdatum, Abfindungsangebot") | Med | Helena scanner check pattern (exists), FalldatenSchema (exists) | Add as SCAN-06 in nightly scanner; rule-based, no LLM |
| Field-Level Audit Trail | Track who changed which field and when | Med | JSON diff + AuditLog (exists) | Store diffs in audit_logs for each save; useful for compliance |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| WYSIWYG Template Builder | Drag-and-drop form builder is massive frontend effort for a 5-person Kanzlei | Simple structured form: "add field" button with type/label/options inputs |
| External Form Submission (Mandanten fill in) | Mixes internal Falldatenblatt with external portal; DSGVO scope explosion | Keep Falldatenblaetter internal; Mandantenportal is separate future feature |
| Auto-Submit to Court / beA | Falldatenblaetter are internal checklists, not court filings | Use Schriftsatz pipeline for court filings; Falldatenblatt informs the drafting |
| Complex Validation Rules (regex, cross-field) | Over-engineering for checklist-style data; "required" is sufficient | Use simple required/optional; let Helena flag inconsistencies via proactive scan |
| Nested Sub-Forms | Falldatenblaetter are flat-ish checklists by design; nesting adds complexity | Use `gruppe` for visual grouping; one level is enough |

### Feature Dependencies (Falldatenblaetter)

```
FalldatenSchema types (exist) --> Form Renderer Component (new)
                              --> Akte.falldaten JSON column (exists)
                              --> Save/Load via API route

FalldatenTemplate model (new) --> Template Builder UI (new, Admin)
                              --> Community Workflow (ENTWURF -> EINGEREICHT -> GENEHMIGT)
                              --> Template Picker (merge built-in + custom)

Helena auto-fill             --> read-akte-detail tool (exists)
                              --> generateObject with Falldaten Zod schema
                              --> Write to Akte.falldaten via new Helena tool

Helena template suggestion   --> Query FalldatenTemplate by sachgebiet
                              --> Suggest via HelenaSuggestion (exists)
```

---

## Cross-Feature Dependencies

```
Messaging --> @Helena in Channels --> HelenaTask queue (exists)
Messaging --> @Mentions --> Notification model (exists)
Messaging --> Activity Feed integration --> AktenActivityTyp needs NACHRICHT type

SCAN-05 --> HelenaAlert(NEUES_URTEIL) --> Alert-Center UI (exists)
SCAN-05 --> urteile-sync processor --> BullMQ chain (exists)
SCAN-05 --> Helena Memory for Akte-level representation (exists)

Falldatenblaetter --> Akte.falldaten column (exists)
Falldatenblaetter --> FalldatenSchema types (exists)
Falldatenblaetter --> Helena generateObject (AI SDK, exists)
Falldatenblaetter --> Helena Scanner for completeness check

Messaging + Falldatenblaetter --> "Helena hat das Falldatenblatt ausgefuellt" message in Akte thread
SCAN-05 + Messaging --> "Neues relevantes Urteil gefunden" notification in Akte thread
```

---

## MVP Recommendation

### Phase 1: Falldatenblaetter (lowest risk, highest immediate value)

Prioritize because:
1. Infrastructure is 80% built (schemas exist, falldaten column exists, forms are straightforward)
2. Immediate daily value for case intake and Mandantengespraech preparation
3. No real-time complexity; standard CRUD forms
4. Helena integration (auto-fill) is a natural extension of existing generateObject capability

Build:
- Form renderer component from FalldatenSchema
- Akte-Detail tab/section for Falldatenblatt
- Save/load from Akte.falldaten
- Completeness indicator
- Helena auto-fill tool (generateObject)

Defer:
- Community template workflow (Phase 2 or later -- built-in schemas cover 10 Sachgebiete already)
- Conditional field logic (nice-to-have, not critical for v0.3)
- PDF export (can be added later without schema changes)

### Phase 2: SCAN-05 Neu-Urteil-Check (high value, moderate risk)

Prioritize because:
1. HelenaAlertTyp.NEUES_URTEIL already exists in the enum
2. UrteilChunk embeddings and pgvector search already work
3. urteile-sync BullMQ cron is already running daily
4. Alert-Center + Socket.IO push already handle alert display
5. Main new work: Akte-level embedding/representation + matching query + threshold tuning

Build:
- Akte-level query vector (from HelenaMemory + kurzrubrum + sachgebiet)
- SCAN-05 matching processor (BullMQ job chained after urteile-sync)
- NEUES_URTEIL alert creation with meta payload
- Akte-Detail: show linked relevant Urteile

Defer:
- Helena briefing explanation (LLM-generated "why relevant") -- can run later as enhancement
- Manual re-check button (Helena search-urteile tool already exists for ad-hoc use)

### Phase 3: Internes Messaging (highest complexity, most new code)

Prioritize last because:
1. Most new schema (Channel, ChannelMessage, ChannelMember models)
2. New UI surface area (channel list, message view, composer)
3. Real-time complexity (message delivery, typing indicators, unread tracking)
4. Akten-Threads partially covered by existing Activity Feed Composer
5. Value is real but team currently uses WhatsApp/phone -- not a blocker

Build:
- Prisma models (Channel, ChannelMessage, ChannelMember)
- Akten-Threads in Activity Feed (extend existing Composer)
- General Channels UI (list, message view, composer)
- @Mention parsing + Notification creation
- Socket.IO real-time delivery
- Unread count badges

Defer:
- Message search via Meilisearch (can index later without schema changes)
- Threaded replies within channels (Akten-Threads cover the primary threaded use case)
- Pinned messages (low-value for small team)

---

## Complexity Summary

| Feature Area | New Models | New UI Surfaces | New BullMQ Queues | LLM Calls | Estimated Complexity |
|-------------|------------|-----------------|-------------------|-----------|---------------------|
| Falldatenblaetter (MVP) | 0 (uses existing Akte.falldaten) | 1 (form renderer) | 0 | 1 (auto-fill) | LOW-MED |
| Falldatenblaetter (Template Workflow) | 1 (FalldatenTemplate) | 2 (builder, admin review) | 0 | 1 (suggest) | MED |
| SCAN-05 | 0 (uses existing HelenaAlert) | 1 (Akte-Detail section) | 1 (scan-05 queue or scanner extension) | 0-1 (optional briefing) | MED |
| Messaging (Akten-Threads) | 0-1 (may extend AktenActivity) | 0 (extends existing Composer) | 0 | 0 | LOW |
| Messaging (General Channels) | 3 (Channel, ChannelMessage, ChannelMember) | 3 (sidebar, channel view, composer) | 0 | 0 | MED-HIGH |
| Messaging (Full: search, threads, edit) | 0 additional | 2 (thread panel, search) | 0 | 0 | MED |

---

## Sources

- Existing codebase analysis: `prisma/schema.prisma` (70+ models, HelenaAlert.NEUES_URTEIL, AktenActivity, Akte.falldaten)
- Existing code: `src/lib/falldaten-schemas.ts` (10 Sachgebiet schemas with 150+ fields total)
- Existing code: `src/lib/urteile/ingestion.ts` (pgvector search, PII-gated ingestion)
- Existing code: `src/worker.ts` (16 BullMQ queues, urteile-sync at 03:00 daily)
- Existing code: `src/lib/socket/emitter.ts` (Redis emitter with user/akte/role rooms)
- Existing code: `src/lib/scanner/types.ts` (CheckResult, ScannerConfig patterns)
- [Slack Architecture - System Design](https://systemdesign.one/slack-architecture/) -- channel/message DB patterns
- [Free Law Project - Semantic Search](https://free.law/2025/03/11/semantic-search/) -- domain-adapted legal semantic search
- [UK National Archives - Semantic Search for Case Law](https://www.nationalarchives.gov.uk/blogs/digital/prototyping-semantic-search-for-case-law/) -- prototype patterns
- [LegalServer - Dynamic Checklists](https://help.legalserver.org/article/1732-dynamic-checklists) -- legal checklist patterns
- [Lawmatics - Intake Form Templates](https://www.lawmatics.com/blog/intake-process-template) -- template workflow patterns
