# Project Research Summary

**Project:** AI-Lawyer v0.3 -- Kanzlei-Collaboration
**Domain:** Legal Tech SaaS -- internal collaboration features for law firm case management
**Researched:** 2026-02-28
**Confidence:** HIGH

## Executive Summary

v0.3 adds three features to an established 117k LOC TypeScript legal case management system: **Internes Messaging** (Slack-style channels + Akte-bound discussion threads), **SCAN-05 Neu-Urteil-Check** (proactive cross-Akte semantic matching of newly ingested court decisions), and **Falldatenblaetter** (dynamic case data checklists with community template workflow and Helena AI auto-fill). The critical finding across all research tracks is that **zero new npm packages are required**. Every capability builds on existing infrastructure -- Socket.IO for real-time messaging, pgvector for cross-Akte semantic search, BullMQ for background processing, and the existing `FalldatenSchema` type system + `FalldatenForm` component for dynamic forms. This continues the v0.2 "zero new dependencies" precedent and is verified against 80+ installed packages.

The recommended approach is to build Falldatenblaetter first (80% of infrastructure already exists, lowest risk, highest immediate daily value for case intake), then SCAN-05 (hooks into the existing urteile-sync pipeline with no new UI beyond the existing alert system), and finally Messaging (highest new code surface, most new Prisma models, real-time complexity). All three features extend existing subsystems rather than creating new ones -- Messaging extends Socket.IO rooms + Activity Feed patterns, SCAN-05 extends the urteile-sync processor + scanner alert pipeline, and Falldatenblaetter extends the existing `falldaten` JSON column + schema registry.

The top risks are: (1) Socket.IO message delivery semantics -- the existing fire-and-forget pattern for notifications must NOT be used for persistent chat; messages must be persisted before broadcast (write-then-emit). (2) SCAN-05 alert fatigue -- naive semantic matching between court decisions and cases in the same legal area produces high false-positive rates, requiring Sachgebiet-aware thresholds and Akte-level summary embeddings instead of per-document matching. (3) Helena auto-fill hallucination -- the LLM will fabricate plausible but unverified field values for Falldatenblaetter, requiring source-grounded extraction with per-field confidence scores and an explicit ENTWURF review gate. (4) RBAC leakage in messaging -- Akte-confidential content must not leak into general channels (BRAO 43a Verschwiegenheitspflicht).

## Key Findings

### Recommended Stack

No changes to the existing stack. All v0.3 features build on the established technology: Next.js 14+ (App Router), TypeScript, Tailwind CSS + shadcn/ui, PostgreSQL 16 + Prisma ORM, pgvector (HNSW), Socket.IO + Redis adapter, BullMQ, Vercel AI SDK v4 with `generateObject`. No new Docker services (remains at 9). No new npm packages.

**Core technologies (all existing):**
- **Socket.IO + Redis adapter**: Real-time message delivery via `channel:{id}` rooms -- extends existing room conventions (`user:`, `role:`, `akte:`, `mailbox:`)
- **pgvector (HNSW)**: SCAN-05 cross-Akte semantic search using Akte summary embeddings vs. Urteil embeddings
- **BullMQ**: SCAN-05 processor as post-sync hook on urteile-sync completion
- **Vercel AI SDK v4 `generateObject()`**: Helena auto-fill for Falldatenblaetter -- same pattern as Schriftsatz pipeline
- **Zod**: Runtime validation of user-created FalldatenTemplate schemas from database JSON
- **TipTap (available but not used)**: Messaging uses plain textarea with regex @mention parsing (proven v0.2 pattern), not rich text editor

### Expected Features

**Must have (table stakes):**
- Akten-Threads: team discusses a case in-context within the Akte detail view
- General Channels: kanzlei-wide communication (Orga, News) to replace WhatsApp/email
- @Mentions with in-app notifications and Socket.IO push
- Real-time message delivery, unread count badges
- SCAN-05 cross-Akte semantic matching with NEUES_URTEIL alert creation
- Configurable relevance threshold via SystemSetting
- Dynamic Falldatenblatt form rendering from schema (7 field types)
- User-created custom templates with Admin approval workflow (ENTWURF -> EINGEREICHT -> GENEHMIGT)
- Helena auto-fill from Akte data via `generateObject()`

**Should have (differentiators):**
- @Helena in channels (reuse existing ReAct agent in messaging context)
- Akte-Verknuepfung in messages (#AZ-2026-0042 auto-linking)
- Helena Urteil-Briefing (LLM explanation of why a ruling is relevant)
- Typing indicators (ephemeral Socket.IO events)
- Message editing with edit history (audit trail)
- Completeness indicator for Falldatenblaetter
- Conditional field logic (show/hide based on other field values)

**Defer (v2+):**
- External/client messaging (Mandantenportal scope)
- File upload to channels (DMS is source of truth)
- Voice/video calls (WebRTC complexity)
- Message reactions (low value for 5-person kanzlei)
- E2E encryption (self-hosted behind VPN; TLS sufficient)
- Full-text message search via Meilisearch (index later without schema changes)
- Threaded replies within general channels (Akten-Threads cover primary threading)
- Falldatenblatt PDF export (can add later without schema changes)
- Complex validation rules (regex, cross-field) for templates
- WYSIWYG template builder (simple structured form is sufficient)

### Architecture Approach

All three features extend existing subsystems. Messaging adds 3-4 new Prisma models (Channel, ChannelMember/Mitglied, Message/Nachricht, optionally Mention) and extends Socket.IO with `channel:{id}` rooms following the established `akte:{id}` room lifecycle. SCAN-05 hooks into the existing urteile-sync processor as a post-completion job, using Akte-level summary embeddings (new column on Akte model) instead of per-document matching to avoid O(N*M) explosion. Falldatenblaetter migrates the existing static TypeScript schema registry to a database-backed FalldatenTemplate model with a community approval workflow, introducing a FalldatenInstanz join table for template-Akte binding with completion tracking.

**Major components:**
1. **Messaging Persistence Layer** -- Channel, ChannelMember, Message models with REST API for writes, Socket.IO for push delivery + ephemeral events (typing)
2. **SCAN-05 Post-Ingestion Processor** -- BullMQ job chained after urteile-sync, comparing new Urteil embeddings against Akte summary embeddings via pgvector cosine similarity
3. **Akte Summary Embedding** -- New `summaryEmbedding` vector column on Akte, generated from kurzrubrum + sachgebiet + wegen + HelenaMemory content, refreshed on document changes
4. **FalldatenTemplate + FalldatenInstanz** -- Database-backed template definitions with community workflow, replacing static TypeScript registry as the single schema source
5. **Helena Auto-Fill Tool** -- New `fill_falldatenblatt` Helena tool using `generateObject()` with dynamic Zod schema conversion from FalldatenTemplate

### Critical Pitfalls

1. **Socket.IO write-then-emit (Critical)** -- The existing fire-and-forget pattern for notifications MUST NOT be used for chat. Messages must be persisted to PostgreSQL BEFORE broadcast. Use REST for writes, Socket.IO only for push delivery. Add client-side optimistic rendering with reconciliation and reconnection catch-up.

2. **SCAN-05 N*M embedding explosion (Critical)** -- Naive per-document matching creates O(urteile * akten * chunks) queries. Prevention: use Akte-level summary embeddings (one vector per Akte), two-stage filtering (profile match then full search), and batch processing. Expected runtime with summary approach: 1-4 seconds for 5-20 new Urteile.

3. **Falldaten schema source confusion (Critical)** -- Two schema sources (TypeScript file + DB table) will cause maintenance chaos. Prevention: migrate static schemas to DB as STANDARD/seed templates, make DB the single source of truth, keep TypeScript file only as seed source.

4. **RBAC leakage in messaging (Critical)** -- Akte-confidential content in general channels violates BRAO 43a (Verschwiegenheitspflicht). Prevention: Akte-thread RBAC piggybacks on existing `buildAkteAccessFilter()`. General channels allow all users but prevent Akte-linking. Separate message storage per context.

5. **Helena auto-fill hallucination (Critical)** -- LLM fabricates plausible field values not found in source documents. Prevention: source-grounded extraction only, per-field confidence scores, ENTWURF review gate, diff view for auto-filled data, strict type validation.

## Implications for Roadmap

Based on combined research, six phases are recommended. The ordering follows dependency analysis, risk minimization, and the principle of building backend foundations before UI surfaces.

### Phase 1: Falldatenblaetter Schema + Templates (Backend)
**Rationale:** Lowest risk, highest immediate value. 80% of infrastructure already exists (FalldatenSchema types, FalldatenForm component, Akte.falldaten column). No real-time complexity. The Prisma migration for FalldatenTemplate + FalldatenInstanz has no dependencies on other features.
**Delivers:** Database-backed template system with community approval workflow, seed migration of 10 existing schemas, template CRUD API routes, submit/approve/reject workflow endpoints.
**Addresses:** Dynamic form rendering, user-created templates, Admin approval workflow, completeness tracking.
**Avoids:** Pitfall 3 (schema explosion) by establishing DB as single source of truth from the start. Pitfall 8 (RBAC mismatch) by reusing ADMIN role with self-approval check.

### Phase 2: Falldatenblaetter UI + Helena Integration
**Rationale:** Depends on Phase 1 schema. Delivers the user-facing value of case data collection. Helena auto-fill uses the same `generateObject()` pattern proven in v0.2 Schriftsatz pipeline.
**Delivers:** Template builder UI (admin), template review panel, enhanced FalldatenInstanz form in Akte detail, Helena `fill_falldatenblatt` tool, completeness indicator.
**Addresses:** Helena auto-fill, template suggestion, completeness indicator.
**Avoids:** Pitfall 5 (hallucination) via source-grounded extraction, per-field confidence, ENTWURF status, diff view. Pitfall 11 (JSONB size) by capping fields at 40 per template.

### Phase 3: SCAN-05 Neu-Urteil-Check (Full Backend)
**Rationale:** No new UI beyond existing alert system. HelenaAlertTyp.NEUES_URTEIL already exists in the enum. The main work is the Akte summary embedding column + HNSW index + post-sync processor. Building this after Falldatenblaetter means Falldaten content can contribute to Akte summaries.
**Delivers:** Akte summary embedding infrastructure (new column + HNSW index), batch generation for existing Akten, SCAN-05 processor hooked into urteile-sync, NEUES_URTEIL alert creation with meta payload, Sachgebiet-aware threshold filtering, deduplication.
**Addresses:** Cross-Akte semantic matching, proactive court decision alerts, configurable threshold, batch post-sync processing.
**Avoids:** Pitfall 2 (N*M explosion) via Akte-level summary embeddings. Pitfall 9 (alert fatigue) via Sachgebiet-aware thresholds and alert grouping. Pitfall 13 (stale profiles) via document-change hooks and 7-day staleness tolerance. Pitfall 15 (queue contention) via dedicated `scan-05` BullMQ queue.

### Phase 4: Messaging Schema + API (Backend)
**Rationale:** Most new Prisma models (3-4 models, 2 enums). Running the migration separately from Phases 1 and 3 avoids migration conflicts. Backend-first approach allows API testing before UI work.
**Delivers:** Channel, ChannelMember, Message Prisma models with migration, CRUD + pagination API routes, Socket.IO `channel:{id}` room integration, @mention parsing + notification creation, unread count computation.
**Addresses:** Channel/thread creation, message persistence, real-time delivery foundation, @mentions.
**Avoids:** Pitfall 1 (write-then-emit) by mandating REST for writes + Socket.IO for push. Pitfall 4 (RBAC leak) by separating Akte-thread RBAC from general channel access. Pitfall 14 (audit trail) via soft delete + edit history.

### Phase 5: Messaging UI
**Rationale:** Depends on Phase 4 API layer. This is the highest new-UI-surface phase -- channel sidebar, message thread view, composer, Akte thread panel, unread badges.
**Delivers:** `/dashboard/nachrichten` page with channel list + message view, Akte detail inline thread panel, message composer with @mention parsing, typing indicators, unread count badges in sidebar.
**Addresses:** Channel list UI, message sending/receiving, typing indicators, unread badges, Akte-bound discussion.
**Avoids:** Pitfall 6 (pagination) via cursor-based pagination from day one. Pitfall 7 (notification spam) via batch notification creation and client-side dedup. Pitfall 10 (room proliferation) by reusing `akte:*` rooms for threads.

### Phase 6: Cross-Feature Integration + Polish
**Rationale:** Integration points between the three features. These are enhancements that depend on all three features being functional.
**Delivers:** @Helena in channel messages (HelenaTask creation), SCAN-05 alert "Teilen" button for posting to Akte-thread, NEUES_URTEIL activity feed card renderer, summary embedding refresh triggers (on HelenaMemory change, Falldaten save, document upload).
**Addresses:** @Helena in channels, SCAN-05 + messaging integration, summary embedding freshness.
**Avoids:** Integration Pitfall 1 (Activity Feed confusion) by keeping chat and feed separate. Integration Pitfall 3 (redundant cross-posting) by using manual "Teilen" instead of auto-posting.

### Phase Ordering Rationale

- **Falldatenblaetter before SCAN-05:** Falldaten content enriches Akte summaries used for SCAN-05 matching. Building Falldatenblaetter first means the summary embedding generator can include Falldaten fields.
- **SCAN-05 before Messaging:** SCAN-05 is backend-only (no new UI) and can ship independently. Messaging requires the most new UI surface area and benefits from having both Falldatenblaetter and SCAN-05 alerts available for cross-feature integration.
- **Backend before UI within each feature:** Prisma migrations should not conflict. Running them sequentially (Phase 1, 3, 4) prevents merge conflicts in `schema.prisma`. API testing before UI reduces debug surface.
- **Cross-feature polish last:** Integration points between features should only be built after each feature works independently. This prevents coupling failures from cascading.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Falldatenblaetter UI + Helena):** The `dynamicZodFromFalldatenSchema()` runtime conversion and Helena auto-fill confidence scoring need design-time iteration. The template builder UI complexity depends on scope decisions (drag-and-drop vs. simple add/remove).
- **Phase 3 (SCAN-05):** Threshold tuning (default 0.72) is an estimate. The Sachgebiet soft-match mapping and two-stage filtering strategy need empirical validation with real RSS data. pgvector AVG aggregation on vector columns for centroid computation needs verification.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Falldatenblaetter Schema):** Standard Prisma model + CRUD API + seed migration. Well-documented, established patterns.
- **Phase 4 (Messaging Schema + API):** Standard Prisma model + REST API + Socket.IO room extension. All patterns verified against existing codebase.
- **Phase 5 (Messaging UI):** Standard React component work with existing shadcn/ui design system. Cursor pagination is well-documented.
- **Phase 6 (Cross-Feature):** Integration work following existing patterns (HelenaTask queue, createScannerAlert, activity feed renderer).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new packages verified against 80+ installed dependencies. All capabilities confirmed in existing codebase. Continues validated v0.2 precedent. |
| Features | HIGH | Feature landscape derived from codebase analysis + legal domain knowledge. Table stakes and anti-features clearly delineated. Complexity estimates grounded in existing LOC counts. |
| Architecture | HIGH | All integration points verified against actual source files (socket rooms, BullMQ queues, scanner pipeline, falldaten schemas). No assumptions about external services. |
| Pitfalls | HIGH (patterns), MEDIUM (thresholds) | Pitfall patterns verified against codebase. SCAN-05 threshold values (0.72 cosine similarity) and alert fatigue mitigation strategies are estimates needing empirical tuning. |

**Overall confidence:** HIGH

### Gaps to Address

- **SCAN-05 threshold calibration:** The 0.72 default cosine similarity threshold is an informed estimate based on `multilingual-e5-large-instruct` characteristics. Must be tuned with real Urteil-Akte pairs after initial deployment. Include a `SystemSetting` key for runtime adjustment.
- **Akte summary embedding quality:** The composition of kurzrubrum + sachgebiet + wegen + HelenaMemory content for Akte summaries is untested. Quality of cross-Akte matching depends heavily on summary text quality. Need to validate with representative cases.
- **pgvector AVG on vector columns:** The centroid computation approach (averaging top-N document chunk embeddings) for Akte profiles needs PostgreSQL verification. May need a custom SQL function.
- **FalldatenInstanz vs. Akte.falldaten migration:** The architecture research suggests a separate FalldatenInstanz model (supports multiple templates per Akte), while the stack research suggests continuing to use the existing Akte.falldaten column. This discrepancy must be resolved in Phase 1 planning. Recommendation: adopt FalldatenInstanz for forward-compatibility, migrate existing data.
- **Messaging write path:** REST for writes + Socket.IO for push delivery is the correct pattern. Architecture research initially considered Socket.IO for sending but correctly concluded REST is safer (explicit error responses, retry semantics). This must be enforced in implementation.
- **Helena chat context:** Helena initially will NOT read chat messages from Akte-threads. Adding a `read-akte-chat` tool is deferred to a follow-up. This is a known gap for v0.3.

## Sources

### Primary (HIGH confidence)
- Codebase analysis -- all integration points verified against actual source files:
  - `src/lib/socket/server.ts`, `rooms.ts`, `auth.ts`, `emitter.ts` (Socket.IO infrastructure)
  - `src/worker.ts`, `src/lib/queue/queues.ts` (16 BullMQ queues, 6 cron jobs)
  - `src/lib/scanner/service.ts` (createScannerAlert, dedup, escalation)
  - `src/lib/urteile/ingestion.ts`, `rss-client.ts` (PII-gated ingestion pipeline)
  - `src/lib/embedding/hybrid-search.ts`, `vector-store.ts` (pgvector + BM25 + RRF)
  - `src/lib/falldaten-schemas.ts` (10 Sachgebiet schemas, 150+ fields)
  - `src/components/akten/falldaten-form.tsx` (dynamic form renderer)
  - `src/lib/helena/tools/index.ts` (14 tools, role filter, cache)
  - `src/lib/helena/at-mention-parser.ts` (regex @mention parsing)
  - `prisma/schema.prisma` (70+ models, HelenaAlert with NEUES_URTEIL enum)
  - `package.json` (80+ packages, zero new additions needed)

### Secondary (MEDIUM confidence)
- [Slack Architecture - System Design](https://systemdesign.one/slack-architecture/) -- channel/message DB patterns
- [Free Law Project - Semantic Search](https://free.law/2025/03/11/semantic-search/) -- legal semantic search
- [UK National Archives - Semantic Search for Case Law](https://www.nationalarchives.gov.uk/blogs/digital/prototyping-semantic-search-for-case-law/) -- prototype patterns
- [Socket.IO with Next.js](https://socket.io/how-to/use-with-nextjs) -- integration guide
- [Scaling Socket.IO challenges](https://ably.com/topic/scaling-socketio) -- connection bottlenecks
- [pgvector scaling presentation](https://pgconf.in/files/presentations/2025/954.pdf) -- HNSW index limits
- [pgvector 0.8.0 improvements](https://aws.amazon.com/blogs/database/supercharging-vector-search-performance-and-relevance-with-pgvector-0-8-0-on-amazon-aurora-postgresql/) -- benchmarks
- [LLM hallucination in data extraction](https://www.cradl.ai/post/hallucination-free-llm-data-extraction) -- dual-model verification

### Tertiary (LOW confidence)
- SCAN-05 cosine similarity threshold (0.72 default) -- informed estimate, needs empirical calibration
- Sachgebiet soft-match mapping (Zivilrecht -> multiple Sachgebiete) -- domain knowledge, not validated with data

---
*Research completed: 2026-02-28*
*Ready for roadmap: yes*
