# Domain Pitfalls: v0.3 Kanzlei-Collaboration

**Domain:** Adding real-time messaging, cross-Akte semantic search (SCAN-05), and dynamic form schemas (Falldatenblaetter) to existing Next.js + Prisma + Socket.IO + pgvector legal tech app
**Researched:** 2026-02-28
**Overall confidence:** HIGH (based on codebase analysis + verified patterns)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or major architectural problems.

---

### Pitfall 1: Socket.IO Event Namespace Collision Between Messaging and Existing Event System

**What goes wrong:** The existing Socket.IO setup uses fire-and-forget event emission for notifications (OCR complete, alert badges, Helena task progress). Adding persistent chat messaging on the same Socket.IO instance creates confusion between ephemeral events and persistent messages. Developers treat chat messages like events -- emit and forget -- without persisting to DB first, leading to message loss on disconnect/reconnect.

**Why it happens:** The current codebase pattern in `src/worker.ts` and `src/lib/scanner/service.ts` emits Socket.IO events as side effects after DB writes (`getSocketEmitter().to(...).emit(...)`). This is correct for notifications (the DB is source of truth, Socket.IO is delivery). But chat messaging requires the opposite: the message MUST be persisted before it is broadcast. Developers who follow the existing "emit then move on" pattern will lose messages when clients disconnect during transmission.

**Consequences:**
- Messages lost during network interruptions (at-most-once delivery is Socket.IO's default)
- Message ordering violations when rapid messages race between DB insert and Socket.IO broadcast
- Reconnected clients see gaps in conversation history
- Audit trail gaps (DSGVO requires complete records of internal communications)

**Prevention:**
1. **Write-then-emit pattern:** Always `await prisma.message.create(...)` BEFORE `io.to(room).emit("message:new", message)`. Never emit without successful persistence.
2. **Separate namespaces:** Use a Socket.IO namespace `/messaging` for chat events, keeping the default `/` namespace for existing event types. This prevents handler conflicts and allows independent middleware.
3. **Client-side optimistic rendering with reconciliation:** Show message instantly in UI with a `pending` state, then reconcile with the server-confirmed version (including the DB-generated `id` and `createdAt`). If the server-ack fails, mark as `failed` with retry.
4. **Reconnection catch-up:** On Socket.IO reconnect, fetch messages since `lastMessageTimestamp` from the REST API, similar to the pattern in `notification-provider.tsx` lines 71-95.

**Detection:** Messages appearing in one user's view but not another's. `message:new` events arriving before DB confirms insert. Gaps in message timeline after page refresh.

**Phase:** Must be addressed in the Messaging schema/architecture phase (Phase 1 of Messaging).

**Confidence:** HIGH -- verified against existing codebase patterns in `socket-provider.tsx`, `akte-socket-bridge.tsx`, `notification-provider.tsx`, and `scanner/service.ts`.

---

### Pitfall 2: Cross-Akte Semantic Search (SCAN-05) N*M Embedding Comparison Explosion

**What goes wrong:** SCAN-05 needs to compare each newly ingested Urteil against ALL active Akten to find relevance. The naive approach -- for each new Urteil, run a vector similarity query against `document_chunks` for every open Akte -- creates O(N_urteile * M_akten) embedding comparisons per cron run. With 200+ active Akten and 10-50 new Urteile per daily RSS sync, this becomes 2,000-10,000 expensive pgvector queries per run, each doing HNSW traversal.

**Why it happens:** The existing `searchUrteilChunks()` in `src/lib/urteile/ingestion.ts` searches urteil_chunks globally without Akte context. The existing `hybridSearch()` in `src/lib/embedding/hybrid-search.ts` searches document_chunks per-Akte. SCAN-05 needs the reverse: compare each new Urteil embedding against each Akte's document corpus. There is no existing function that does "given an embedding, find which Akten are semantically relevant."

**Consequences:**
- Scanner cron exceeds BullMQ lockDuration (currently 120s for helena-agent queue), causing duplicate jobs
- Ollama embedding generation backlog (each comparison needs the Urteil text embedded, though the embedding already exists from ingestion)
- PostgreSQL connection pool exhaustion from parallel raw SQL queries
- Scanner blocks other BullMQ jobs (frist-check, inaktiv-check, anomalie-check) if they share worker concurrency

**Prevention:**
1. **Akte fingerprint approach:** For each active Akte, pre-compute a "case profile embedding" -- a weighted average of the Akte's top-5 document chunk embeddings + the Sachgebiet + kurzrubrum. Store this in a new `akte_profile_embeddings` table. Then SCAN-05 only compares each new Urteil against ~200 profile vectors instead of millions of document chunks.
2. **Two-stage filtering:** First stage: compare new Urteil embedding against Akte profiles (fast, ~200 comparisons). Second stage: only for Akten that score above threshold (e.g., cosine > 0.6), run full hybrid search against that Akte's document_chunks for confirmation.
3. **Batch processing:** Process all new Urteile from a single RSS sync as a batch. Pre-load Akte profiles into memory, compute cosine similarities in-process (Node.js) instead of pgvector SQL for the first stage.
4. **Incremental processing:** Track `lastScanTimestamp` in SystemSetting. Only check Urteile ingested after that timestamp against Akten that have been active (status=OFFEN) and have documents.

**Detection:** Scanner run duration exceeding 60s. BullMQ stalled jobs on the scanner queue. Database CPU spikes during scanner cron window.

**Phase:** Must be the core architecture decision for SCAN-05 (Phase 1 of SCAN-05). The Akte profile approach determines the schema.

**Confidence:** HIGH -- measured against existing `hybridSearch()` query patterns and `searchUrteilChunks()` in the codebase.

---

### Pitfall 3: Falldatenblaetter Schema Explosion -- Confusing Akte.falldaten (Sachgebiet-fixed) with Template-driven Dynamic Forms

**What goes wrong:** The existing `Akte.falldaten` field (JSON) is driven by hardcoded TypeScript schemas in `src/lib/falldaten-schemas.ts` -- one schema per Sachgebiet, immutable at runtime. The v0.3 Falldatenblaetter feature adds user-created templates with community approval workflow, meaning schemas are now dynamic and stored in the database. Developers mix up the two systems: editing the TypeScript schemas thinking they are also updating user templates, or building the template system on top of the existing `falldaten` JSON field, creating an incoherent dual-schema problem.

**Why it happens:** The existing `FalldatenSchema` type and `falldatenSchemas` registry in `src/lib/falldaten-schemas.ts` are cleanly designed but fundamentally static. The `FalldatenForm` component in `src/components/akten/falldaten-form.tsx` renders these static schemas. Adding user-created templates requires a parallel system: templates stored in DB, versioned, approval-gated, with dynamic field definitions. If these two systems aren't clearly separated, the codebase becomes unmaintainable.

**Consequences:**
- Two different places to look for form definitions (TypeScript file vs DB table)
- Helena auto-fill breaks because it doesn't know which schema source to use
- Template approval changes don't take effect because the code still reads from the TypeScript file
- Prisma schema becomes inconsistent: `Akte.falldaten` stores data for both old and new systems with different validation rules

**Prevention:**
1. **Migrate static schemas to DB:** Convert the 10 existing `falldatenSchemas` from `src/lib/falldaten-schemas.ts` into seed data for a new `FalldatenTemplate` model. Mark them as `isSystem: true` (non-deletable, non-editable by users). Keep the TypeScript file as a compile-time reference/seed source only.
2. **Single schema source:** All form rendering reads from the `FalldatenTemplate` table, never from the TypeScript const. The `FalldatenForm` component takes a `templateId` and fetches the schema from DB.
3. **Clear model separation:**
   - `FalldatenTemplate` -- the form definition (fields, groups, validation rules, approval status)
   - `Falldatenblatt` -- a filled-out instance of a template, linked to an Akte
   - `Akte.falldaten` -- deprecated for new templates, migrated to `Falldatenblatt` entries
4. **Versioning:** Templates must be versioned. When a template is updated, existing filled-out Falldatenblaetter keep their original schema version.

**Detection:** `FalldatenForm` still importing from `falldaten-schemas.ts` after the feature ships. Helena tools referencing `getFalldatenSchema()` instead of querying the template table.

**Phase:** Must be resolved in Phase 1 of Falldatenblaetter (data model design). Migration from static to DB-driven is the prerequisite.

**Confidence:** HIGH -- directly verified against `src/lib/falldaten-schemas.ts` (410 lines, 10 Sachgebiet schemas) and `src/components/akten/falldaten-form.tsx`.

---

### Pitfall 4: Chat Message RBAC Leaking Akten-Confidential Content into General Channels

**What goes wrong:** The existing RBAC system controls Akte access via `anwaltId`, `sachbearbeiterId`, Dezernat membership, and AdminOverride. Messaging introduces two contexts: Akte-threads (scoped to one case) and general Kanaele (kanzlei-wide). If a user @mentions an Akte or pastes case details into a general Kanal, confidential information leaks to users who don't have access to that Akte. Similarly, if search indexes chat messages without Akte-scoping, users find confidential content via Meilisearch.

**Why it happens:** General channels have no Akte-scoping. The temptation is to allow free-text messaging everywhere, but in a law firm, case confidentiality is a legal obligation (BRAO 43a, professional secrecy). A SACHBEARBEITER assigned only to Arbeitsrecht cases must not see chat content about Strafrecht cases in general channels.

**Consequences:**
- BRAO 43a / BRAO 2 violation (Verschwiegenheitspflicht / duty of confidentiality)
- DSGVO breach if personal data from case documents leaks into unscoped channels
- Audit trail becomes useless if Akte-confidential content is scattered across general channels
- Malpractice liability exposure

**Prevention:**
1. **Akte-threads enforce existing RBAC:** Akte-thread membership is derived from Akte access (same logic as `akte-zugriff-check.ts`). No separate membership management needed.
2. **General channels: content policy, not access restriction:** Allow all authenticated users in general channels, but implement a content policy layer:
   - Prevent Akte-linking (@Akte) in general channels
   - Warn when pasting text that looks like case content (heuristic: contains Aktenzeichen pattern)
   - Do NOT index general channel messages in Meilisearch with Akte context
3. **Separate message storage:** Akte-thread messages stored with `akteId` FK (inherits Akte RBAC for queries). General channel messages stored with `kanalId` FK (no Akte association).
4. **Search isolation:** Akte-thread messages only searchable within Akte context. General channel messages searchable by all channel members but never mixed into Akte search results.

**Detection:** A user seeing Akte-thread content they shouldn't have access to. Chat messages appearing in Meilisearch results for unrelated Akten.

**Phase:** Must be addressed in Messaging data model phase. RBAC integration is architectural, not a bolt-on.

**Confidence:** HIGH -- verified against existing RBAC patterns in `src/lib/rbac/` and Akte access check logic.

---

### Pitfall 5: Helena Auto-Fill for Dynamic Forms Hallucinating Field Values

**What goes wrong:** Helena is asked to auto-fill Falldatenblaetter from Akte documents (OCR text, emails, existing falldaten). The LLM fills in fields with plausible but fabricated values. For a Verkehrsrecht case, Helena might hallucinate a "Reparaturkosten: 4.500 EUR" that sounds reasonable but doesn't appear in any source document. In legal practice, an incorrect value in a Falldatenblatt propagates into Schriftsaetze and filings.

**Why it happens:** The existing Helena agent uses `generateObject()` with Zod schemas for structured extraction (Schriftsatz pipeline). This works when the schema is fixed and the context is rich. But Falldatenblaetter have many optional fields, and the LLM has pressure to fill them all. Fields like `haftungsquote` (liability share %) or `streitwert` (amount in dispute) require precise values that may not exist in the Akte documents yet.

**Consequences:**
- Incorrect case data entered silently (no hallucination flag)
- Schriftsaetze generated from hallucinated falldaten
- Lawyer relies on "Helena filled this" without verification
- Professional liability (Berufshaftpflicht) exposure

**Prevention:**
1. **Per-field confidence scores:** Helena returns `{ value, confidence: "high"|"medium"|"low", source: "dokumentId:chunkId" | null }` for each field. Only `high` confidence fields (with verified source reference) are auto-filled. `medium` and `low` are shown as suggestions with source quotes.
2. **Source-grounded extraction only:** Use the existing RAG pipeline to retrieve relevant chunks first, then extract field values ONLY from retrieved text. If a field value cannot be found in any chunk, return `null` instead of guessing. This mirrors the dual-model verification pattern.
3. **ENTWURF pattern for auto-fill:** Helena-filled Falldatenblaetter get an explicit `HELENA_ENTWURF` status. The user must review and confirm before the data is treated as authoritative. This extends the existing BRAK 2025 compliance pattern.
4. **Field-type validation:** Currency fields must match `\d+[.,]\d{2}` pattern. Date fields must parse as valid dates. Percentage fields must be 0-100. Reject values that fail type validation regardless of LLM confidence.
5. **Diff view for auto-fill:** Show what Helena changed vs. what was already filled, with source citations for each change. Never silently overwrite user-entered data.

**Detection:** Falldatenblatt fields with values that don't appear in any Akte document. Helena-filled fields without source references. User complaints about incorrect auto-filled values.

**Phase:** Must be addressed in Falldatenblaetter Helena integration phase (not the template/schema phase).

**Confidence:** HIGH -- verified against existing Helena patterns (`generateObject`, `SchriftsatzRetrievalLog`, ENTWURF gate in Prisma `$extends`).

---

## Moderate Pitfalls

Mistakes that cause significant rework or degraded UX, but not architectural rewrites.

---

### Pitfall 6: Message Pagination and Infinite Scroll Performance Degradation

**What goes wrong:** Chat threads accumulate thousands of messages over months. Loading the full history on each visit or implementing naive offset-based pagination causes slow queries and janky scrolling. The existing `AktenActivity` feed uses simple `createdAt` ordering which works for ~100 entries per Akte, but chat messages in an active Akte-thread will reach 1,000+ within weeks.

**Why it happens:** Offset-based pagination (`OFFSET 500 LIMIT 50`) requires PostgreSQL to scan and skip 500 rows. With an active conversation, the offset grows linearly. The existing feed pattern in `src/components/akten/activity-feed.tsx` fetches all activities and renders them, which won't scale for messaging.

**Prevention:**
1. **Cursor-based pagination:** Use `WHERE createdAt < :cursor ORDER BY createdAt DESC LIMIT 50` with an index on `(kanalId, createdAt)` or `(akteId, createdAt)`. Return the cursor (last message's `createdAt` + `id` for tie-breaking) for the next page.
2. **Load latest first, scroll up for history:** Chat UI loads the most recent 50 messages first. User scrolls up to load older messages (reverse infinite scroll). This matches user expectations from Slack/Teams.
3. **Separate message table, not AktenActivity:** Do NOT store chat messages as `AktenActivity` entries. Messages have different access patterns (pagination, search, reactions, edits) than activity feed entries. Keep `AktenActivity` for its existing purpose (document events, alerts, drafts).

**Phase:** Messaging UI phase. Must decide pagination strategy before building the chat component.

**Confidence:** HIGH -- verified against existing activity feed patterns and PostgreSQL pagination best practices.

---

### Pitfall 7: @Mention Notification Spam and Duplicate Alert Delivery

**What goes wrong:** A user @mentions someone in a chat message. The system creates a Notification (existing `notifications` table), emits a Socket.IO event, and potentially creates a HelenaAlert. If the mentioned user is also in the Socket.IO room for that Akte, they receive BOTH the real-time message event AND the notification event, creating duplicates. If multiple users are @mentioned in one message, the notification creation loop can fail partway through, leaving some users notified and others not.

**Why it happens:** The existing system has two notification paths: `Notification` model (persistent, fetched on load) and Socket.IO events (ephemeral, shown as toasts). The `NotificationProvider` in `src/components/notifications/notification-provider.tsx` handles both. Adding @mentions creates a third path (in-message highlight). Without deduplication, all three fire independently.

**Prevention:**
1. **Single notification path per @mention:** An @mention creates exactly one `Notification` record and one Socket.IO emit. The chat message itself is NOT a notification -- it appears in the chat view. The notification says "X mentioned you in [channel/Akte]" with a link, not the full message.
2. **Batch notification creation:** Parse all @mentions from a message, create all `Notification` records in a single `prisma.notification.createMany()` call (atomic), then emit Socket.IO events. If createMany fails, no notifications are sent (consistent state).
3. **Client-side deduplication:** The `NotificationProvider` already has dedup logic (line 82-86, checking `existingIds`). Extend this to also check if the user is currently viewing the relevant chat thread -- if so, suppress the toast notification (they already see the message).
4. **Rate limiting:** If a user @mentions someone 10 times in 5 minutes, collapse into a single notification: "X mentioned you 10 times in [channel]." Use the existing 24h deduplication pattern from `scanner/service.ts` but with a shorter window (5 minutes for @mentions).

**Phase:** Messaging @mentions implementation phase.

**Confidence:** HIGH -- verified against `NotificationProvider` and `createScannerAlert` deduplication pattern.

---

### Pitfall 8: Template Approval Workflow Creating Permission Creep via RBAC Mismatch

**What goes wrong:** The Falldatenblaetter community workflow is: User creates template -> submits to Admin -> Admin approves -> becomes standard. But the existing RBAC only has 4 roles (ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT). There is no "template reviewer" role. If any ADMIN can approve templates, and the firm has 2 admins, the approval process has no separation of duties. Worse, if the template approval endpoint only checks `role === "ADMIN"`, a compromised admin session can approve malicious templates.

**Why it happens:** The existing RBAC is role-based, not permission-based. Adding a new workflow (template approval) that doesn't map cleanly to existing roles forces either role overloading (ADMIN does everything) or role explosion (adding TEMPLATE_REVIEWER role).

**Prevention:**
1. **Reuse ADMIN role, add audit:** Keep the existing 4 roles. Only ADMIN can approve templates. This is acceptable for a small law firm (1-5 lawyers). Log all approval actions in the audit trail with `logAuditEvent("TEMPLATE_APPROVED", ...)`.
2. **Template status workflow:** `ENTWURF -> EINGEREICHT -> GENEHMIGT -> ARCHIVIERT`. Only ADMIN can transition `EINGEREICHT -> GENEHMIGT`. Template creator cannot approve their own template (self-approval check).
3. **Do NOT add new roles:** Adding a TEMPLATE_REVIEWER role to the existing `UserRole` enum requires a Prisma migration, changes to every RBAC check, and complicates the auth middleware. The cost far exceeds the benefit for a feature used by 5-10 users.
4. **Escape hatch:** ANWALT role can submit templates. SACHBEARBEITER can also submit (they often create checklists). SEKRETARIAT can view and use approved templates but cannot submit new ones.

**Phase:** Falldatenblaetter approval workflow phase.

**Confidence:** HIGH -- verified against existing RBAC in `UserRole` enum and Dezernat model.

---

### Pitfall 9: SCAN-05 Alert Fatigue from Low-Relevance Urteil Matches

**What goes wrong:** SCAN-05 finds that a new Bundesarbeitsgericht ruling about "Kuendigungsschutz" has cosine similarity > 0.5 with 30 active Arbeitsrecht Akten. It creates 30 alerts, most of which are generic matches (any employment law case will match any employment law ruling). The responsible Anwalt gets 30 nearly identical alerts, learns to ignore them, and misses the one that actually matters.

**Why it happens:** Semantic similarity between legal texts in the same Rechtsgebiet is inherently high. A ruling about Kuendigungsschutz will match every Arbeitsrecht case that has a Kuendigungsschutzklage in its documents. Without domain-specific relevance filtering, the false positive rate is unacceptable.

**Prevention:**
1. **Sachgebiet-aware threshold:** Higher similarity threshold for same-Sachgebiet matches (e.g., 0.75 for Arbeitsrecht Urteil vs Arbeitsrecht Akte) and lower for cross-Sachgebiet (e.g., 0.6 for a Sozialrecht ruling affecting an Arbeitsrecht case).
2. **Specificity scoring:** After vector similarity, run a lightweight LLM check (not full ReAct, just a single generateObject call): "Does this ruling specifically affect the legal position in this case? Return YES/NO with one-sentence explanation." Only create alerts for YES results.
3. **Alert grouping:** If the same Urteil matches multiple Akten of the same Anwalt, create ONE grouped alert: "Neues BAG-Urteil zu Kuendigungsschutz betrifft moeglicherweise 5 Ihrer Akten: [list]." Use the existing HelenaAlert `meta` JSON field for the Akte list.
4. **Configurable per-Akte opt-in:** Not every Akte needs Urteil monitoring. Add a toggle `urteilMonitoringAktiv` on Akte (default: true for OFFEN, false for RUHEND/ARCHIVIERT). Users can disable for inactive or settled cases.
5. **Maximum alerts per Urteil:** Cap at 5 alerts per new Urteil per cron run. If 30 Akten match, pick the top 5 by similarity score.

**Detection:** More than 10 NEUES_URTEIL alerts per scanner run. Alert read rate below 50% for NEUES_URTEIL type.

**Phase:** SCAN-05 alert tuning phase. Build the matching first, then tune thresholds.

**Confidence:** MEDIUM -- threshold values are estimates, need empirical tuning with real data.

---

### Pitfall 10: Socket.IO Room Proliferation for Messaging Channels

**What goes wrong:** Each messaging channel and each Akte-thread gets its own Socket.IO room (`channel:{channelId}`, `akte-chat:{akteId}`). The existing room pattern in `src/lib/socket/rooms.ts` already has `user:*`, `role:*`, `akte:*`, and `mailbox:*` rooms. Adding messaging rooms doubles the room count per connected user. With 10 users, each in 5 channels and viewing 3 Akten, that's 10 * (1 user room + 1 role room + 5 channel rooms + 3 akte-chat rooms) = 100 rooms. Socket.IO handles this fine, but the join/leave lifecycle becomes complex.

**Why it happens:** The existing `akte:*` rooms are for document/OCR events, not chat. Adding Akte-thread messaging on the same room means chat messages arrive alongside OCR-complete events and Helena alerts. If you create separate rooms (`akte-chat:*`), users must join/leave both `akte:*` and `akte-chat:*` when navigating to/from an Akte detail page.

**Prevention:**
1. **Reuse existing `akte:*` rooms for Akte-threads:** The `akte:{akteId}` room already has the right lifecycle (join on Akte detail mount, leave on unmount, per `AkteSocketBridge`). Add chat message events to this room with a distinct event name (`message:new` vs `document:ocr-complete`). The client-side handler can filter by event type.
2. **Add `channel:*` rooms for general channels:** New room type following the existing pattern. Join on channel view mount, leave on unmount. Auto-join the "Allgemein" channel on connect (similar to auto-joining `user:*` and `role:*` rooms).
3. **Typing indicators: debounce aggressively:** "User is typing" events in chat rooms can flood with 200ms intervals. Debounce to 3-second intervals. Use volatile events (`socket.volatile.emit(...)`) for typing indicators so they are not buffered during disconnects.
4. **Presence tracking:** Do NOT implement a custom presence system. Use Socket.IO's built-in room membership to determine who is online. Query `io.in("channel:123").fetchSockets()` for online member list.

**Phase:** Messaging Socket.IO integration phase.

**Confidence:** HIGH -- verified against `src/lib/socket/rooms.ts` and `src/components/akten/akte-socket-bridge.tsx`.

---

## Minor Pitfalls

Mistakes that cause minor issues or technical debt, but are easily correctable.

---

### Pitfall 11: Falldatenblaetter JSONB Field Size Limits with Helena Template Suggestions

**What goes wrong:** Helena suggests new Falldatenblatt templates based on case patterns. If the template definition (field definitions array) is stored as JSONB, very detailed templates with 50+ fields, help text, validation rules, and option lists can exceed practical JSONB processing performance. PostgreSQL can handle up to 255 MB in a JSONB column, but indexing and partial updates on deeply nested JSON degrade.

**Prevention:**
1. **Keep template schemas lean:** Cap at 40 fields per template. Most existing schemas have 15-25 fields.
2. **Store field definitions as a flat array, not deeply nested:** The existing `FalldatenFeld` interface is already flat (key, label, typ, optionen). Maintain this simplicity.
3. **Helena suggestions as separate proposals:** Helena-suggested templates go into a `TemplateVorschlag` table with status `VORGESCHLAGEN`, not directly into the template table. Admin reviews and promotes.

**Phase:** Falldatenblaetter template model design.

**Confidence:** HIGH.

---

### Pitfall 12: Message Search Indexing Conflict with Existing Meilisearch Indices

**What goes wrong:** Adding chat messages to Meilisearch creates a new index alongside the existing `dokumente` index. If the index name collides or the search API returns mixed results (documents and messages), the command palette (Cmd+K) shows confusing results.

**Prevention:**
1. **Separate Meilisearch index:** `messages` index with fields `content`, `senderName`, `channelName`, `akteAktenzeichen`, `createdAt`. Completely separate from the `dokumente` index.
2. **Search API routing:** The existing `searchDokumente()` in `src/lib/meilisearch.ts` must NOT be modified. Add a new `searchMessages()` function. The Cmd+K palette queries both indices and groups results by type.
3. **RBAC filtering at query time:** Messages in Akte-threads must be filtered by the user's Akte access. General channel messages are visible to all. Apply the same post-filter pattern used in `hybridSearch()` lines 219-226 for cross-Akte BM25 results.

**Phase:** Messaging search integration (late phase, after core messaging works).

**Confidence:** MEDIUM -- depends on Meilisearch multi-index search support.

---

### Pitfall 13: Akte Profile Embedding Staleness for SCAN-05

**What goes wrong:** The Akte profile embedding (used for efficient SCAN-05 matching per Pitfall 2 prevention) becomes stale as new documents are added to the Akte. A new expert opinion is uploaded, changing the case's semantic profile, but the profile embedding still reflects the old documents. New Urteile that match the updated case are missed.

**Prevention:**
1. **Recompute on document change:** Hook into the existing embedding processor (`src/lib/queue/processors/embedding.processor.ts`). After embedding a new document's chunks, trigger a profile recomputation for that Akte.
2. **Lightweight recomputation:** The profile is the centroid (average) of the top-N chunk embeddings. This can be computed with a single SQL query (no Ollama call needed): `SELECT AVG(embedding) FROM document_chunks WHERE akteId = ... AND chunkType = 'CHILD' ORDER BY createdAt DESC LIMIT 20`.
3. **Staleness tolerance:** Profile embeddings that are < 7 days old are "fresh enough." Only recompute if the Akte has had new documents since the last profile computation.

**Phase:** SCAN-05 implementation phase.

**Confidence:** MEDIUM -- pgvector AVG aggregation on vector columns needs verification.

---

### Pitfall 14: Message Edit/Delete Breaking Audit Trail Requirements

**What goes wrong:** Users want to edit and delete chat messages (standard messaging feature). But in a law firm, the audit trail must be complete. If a message is hard-deleted, it disappears from the audit log. If it's edited without history, the original content is lost.

**Prevention:**
1. **Soft delete only:** Messages are never hard-deleted. Add a `deletedAt` timestamp. Deleted messages show as "Nachricht geloescht" in the UI. Original content preserved in DB for audit.
2. **Edit history:** Store edit history as a JSONB array on the message: `editHistory: [{ content, editedAt }]`. The current `content` field always has the latest version.
3. **Time-limited edits:** Allow edits only within 15 minutes of sending. After that, the message is immutable. This prevents retroactive content manipulation.
4. **Audit log integration:** Log message creation, edits, and deletions via the existing `logAuditEvent()` function with `NACHRICHT_ERSTELLT`, `NACHRICHT_BEARBEITET`, `NACHRICHT_GELOESCHT` event types.

**Phase:** Messaging feature implementation.

**Confidence:** HIGH -- standard pattern for legal/compliance messaging.

---

### Pitfall 15: BullMQ Queue Contention Between Scanner, Messaging, and Helena Tasks

**What goes wrong:** SCAN-05 processing runs on the scanner BullMQ queue. Helena tasks run on the `helena-agent` queue. If both queues share the same worker process with limited concurrency, a long SCAN-05 run (checking 200 Akten) blocks Helena task processing. Adding message notification jobs (for offline users) to a third queue further increases contention.

**Prevention:**
1. **Dedicated queue for SCAN-05:** Create a `scan-05` queue separate from the existing `scanner` queue (which handles frist-check, inaktiv-check, anomalie-check). The scan-05 job is computationally heavy and should not block lightweight checks.
2. **No queue for messaging notifications:** Chat notifications should be sent synchronously during message persistence (same transaction). Using BullMQ for chat notifications adds latency. Only use BullMQ for offline notification delivery (email, push) if those channels are added later.
3. **Worker concurrency tuning:** The existing `WORKER_CONCURRENCY` env var (default: 5) in `src/worker.ts` line 42 applies to individual queues. Each queue gets its own Worker instance. Ensure SCAN-05 gets `concurrency: 1` (it processes batches internally).

**Phase:** SCAN-05 infrastructure phase.

**Confidence:** HIGH -- verified against `src/worker.ts` worker registration pattern.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Messaging: Data Model | Pitfall 1 (write-then-emit), Pitfall 4 (RBAC leak) | Design message table with akteId FK for threads, kanalId FK for channels. Never store chat in AktenActivity. |
| Messaging: Socket.IO Integration | Pitfall 10 (room proliferation) | Reuse existing `akte:*` rooms, add `channel:*` rooms. Separate namespace optional but recommended. |
| Messaging: @Mentions | Pitfall 7 (notification spam) | Batch notification creation, client-side dedup, rate-limit repeat @mentions. |
| Messaging: UI | Pitfall 6 (pagination) | Cursor-based pagination from day one. Never offset-based. |
| Messaging: Audit | Pitfall 14 (edit/delete audit) | Soft delete, edit history JSONB, time-limited edits. |
| SCAN-05: Architecture | Pitfall 2 (N*M explosion) | Akte profile embeddings + two-stage filtering. |
| SCAN-05: Alert Delivery | Pitfall 9 (alert fatigue) | Sachgebiet-aware thresholds, LLM specificity check, alert grouping, per-Akte opt-in. |
| SCAN-05: Infrastructure | Pitfall 15 (queue contention) | Dedicated BullMQ queue, concurrency: 1. |
| SCAN-05: Freshness | Pitfall 13 (stale profiles) | Recompute on document upload, 7-day staleness tolerance. |
| Falldatenblaetter: Data Model | Pitfall 3 (schema explosion) | Migrate static schemas to DB, single source of truth. |
| Falldatenblaetter: Approval Workflow | Pitfall 8 (permission creep) | Reuse ADMIN role, self-approval check, audit trail. |
| Falldatenblaetter: Helena Auto-Fill | Pitfall 5 (hallucination) | Per-field confidence, source-grounded extraction, ENTWURF status, diff view. |
| Falldatenblaetter: Template Storage | Pitfall 11 (JSONB size) | Cap fields per template, flat schema structure. |
| Cross-Feature: Search | Pitfall 12 (index collision) | Separate Meilisearch indices, search API routing, RBAC filtering. |

---

## Integration Pitfalls (Cross-Feature)

### Integration 1: Messaging + Activity Feed Confusion

**Risk:** Users expect chat messages to appear in the Akte activity feed. But AktenActivity entries are system events (document uploaded, frist created, Helena alert). Mixing user chat messages into the feed makes the feed noisy and breaks the existing "Helena vs Human Attribution" pattern.

**Prevention:** Keep chat and activity feed separate. The activity feed shows a "3 neue Nachrichten in Akte-Thread" summary entry when new messages are posted, linking to the chat view. Individual messages do NOT create AktenActivity entries.

### Integration 2: Helena Agent Accessing Chat Context

**Risk:** Helena's existing per-Akte memory (`HelenaMemory.content` JSON) doesn't include chat history. If users discuss case strategy in the Akte-thread and then ask Helena to draft a Schriftsatz, Helena has no context from the discussion.

**Prevention:** Phase this as a follow-up. Initially, Helena does NOT read chat messages. Later, add a `read-akte-chat` tool that retrieves recent messages from the Akte-thread (with explicit user consent per DSGVO). This matches the existing tool-calling pattern (14 tools, adding a 15th).

### Integration 3: SCAN-05 Alerts in Chat

**Risk:** SCAN-05 creates a `HelenaAlert` with `typ: NEUES_URTEIL`. If messaging is active, users expect the alert to also appear as a message in the Akte-thread. But the alert system and messaging system are independent -- creating both an alert AND a chat message for the same event is redundant.

**Prevention:** SCAN-05 alerts remain in the alert system (HelenaAlert + AlertCenter). A "Teilen" button on the alert lets users manually post it to the Akte-thread as a message. No automatic cross-posting.

---

## Sources

- Codebase analysis: `src/lib/socket/rooms.ts`, `src/components/socket-provider.tsx`, `src/components/akten/akte-socket-bridge.tsx`, `src/components/notifications/notification-provider.tsx`
- Codebase analysis: `src/lib/embedding/hybrid-search.ts`, `src/lib/embedding/vector-store.ts`, `src/lib/urteile/ingestion.ts`
- Codebase analysis: `src/lib/falldaten-schemas.ts`, `src/components/akten/falldaten-form.tsx`, `prisma/schema.prisma`
- Codebase analysis: `src/lib/scanner/service.ts`, `src/lib/scanner/types.ts`, `src/worker.ts`
- [Socket.IO with Next.js](https://socket.io/how-to/use-with-nextjs) -- official integration guide
- [Socket.IO FAQ on message ordering](https://socket.io/docs/v4/faq/) -- delivery guarantees
- [Scaling Socket.IO challenges](https://ably.com/topic/scaling-socketio) -- sticky sessions, connection bottlenecks
- [Prisma JSON fields documentation](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields) -- JSONB querying limitations
- [EAV vs JSONB in PostgreSQL](https://www.razsamuel.com/postgresql-jsonb-vs-eav-dynamic-data/) -- dynamic form storage comparison
- [Entity-Attribute-Value anti-pattern](https://www.cybertec-postgresql.com/en/entity-attribute-value-eav-design-in-postgresql-dont-do-it/) -- why EAV fails
- [pgvector scaling presentation](https://pgconf.in/files/presentations/2025/954.pdf) -- HNSW index limits
- [pgvector 0.8.0 improvements](https://aws.amazon.com/blogs/database/supercharging-vector-search-performance-and-relevance-with-pgvector-0-8-0-on-amazon-aurora-postgresql/) -- performance benchmarks
- [LLM hallucination in data extraction](https://www.cradl.ai/post/hallucination-free-llm-data-extraction) -- dual-model verification pattern
- [Reducing LLM hallucinations in PDF extraction](https://dev.to/parthex/reducing-hallucinations-when-extracting-data-from-pdf-using-llms-4nl5) -- confidence scoring
- [RBAC best practices 2025](https://www.osohq.com/learn/rbac-best-practices) -- avoiding role explosion
- [RBAC privilege escalation prevention](https://hoop.dev/blog/understanding-privilege-escalation-in-rbac-and-how-to-prevent-it/) -- separation of duties
