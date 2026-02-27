# Phase 19: Schema Foundation - Research

**Researched:** 2026-02-27
**Domain:** Prisma schema design, PostgreSQL migration, data modeling for agent systems
**Confidence:** HIGH

## Summary

Phase 19 is a pure data-layer phase: add 5 new Prisma models (HelenaTask, HelenaDraft, HelenaAlert, HelenaMemory, AktenActivity) and their enums to the existing schema, generate a migration, and verify the application still starts. No business logic, no API endpoints, no UI changes.

The existing schema (1817 lines, 50+ models) already follows well-established conventions: cuid() IDs, createdAt/updatedAt timestamps, `@@map("snake_case_table")` for table naming, `@@index` on foreign keys and frequently queried columns, `onDelete: Cascade` for owned child entities. The 5 new models follow these exact patterns. Prisma 5.22 (already installed) supports all required features: native enums, JSON fields with PostgreSQL JSON filtering, composite indexes, and `onDelete: Cascade`.

**Primary recommendation:** Add all 5 models and their 4 new enums to `prisma/schema.prisma` following the existing project conventions exactly, then run `npx prisma migrate dev` to generate and apply the migration. Add reverse relation fields to User and Akte models. Verify with `npx prisma generate` and a test application start.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation decisions delegated to Claude with two guiding constraints:

**Performance priority:**
- Indexes on all foreign keys and frequently queried columns (status, type, akteId, createdAt)
- JSON fields for flexible data (agent trace steps[], memory content) -- avoid over-normalization
- Composite indexes where downstream queries will filter on multiple columns (e.g., akteId + status)

**Law firm standards (Kanzlei-tauglich):**
- DSGVO compliance: ON DELETE CASCADE on all Akte/User relations -- no orphaned data
- Strict Prisma enums for status flows and types -- type safety over flexibility, migrations are acceptable for new types
- Audit-ready: createdAt/updatedAt timestamps on all models
- Professional naming: German domain terms in enums (ABGEBROCHEN, ENTWURF), English for technical fields

**Schema design decisions (Claude's discretion):**
- HelenaMemory: Structured JSON field with typed categories (summary, risks, nextSteps, openQuestions, relevantNorms) -- queryable via Prisma JSON filtering, flexible enough for future categories
- AktenActivity: Event type enum covering all Akte-relevant events (DOKUMENT, FRIST, EMAIL, HELENA_DRAFT, HELENA_ALERT, NOTIZ, BETEILIGTE, STATUS_CHANGE) -- the unified feed backbone
- HelenaTask steps[]: JSON array of typed step objects (thought, toolCall, toolResult, error) -- complete agent trace for transparency
- HelenaDraft: Strict type + status enums as specified in requirements, feedback as nullable text field
- HelenaAlert: 6 alert types as Prisma enum, severity/priority as integer for flexible ordering

### Claude's Discretion
All schema design is at Claude's discretion within the above constraints. This includes exact field names, index strategy, and table mapping names.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TASK-02 | HelenaTask Prisma-Modell mit Status-Flow (PENDING -> RUNNING -> DONE / FAILED / WAITING_APPROVAL) | Covered by HelenaTask model with HelenaTaskStatus enum (6 values) and JSON steps[] field. Pattern matches existing Ticket model with status enum. |
| DRFT-01 | HelenaDraft Prisma-Modell (PENDING -> ACCEPTED / REJECTED / EDITED) mit Typ (DOKUMENT, FRIST, NOTIZ, ALERT) | Covered by HelenaDraft model with HelenaDraftStatus enum (4 values), HelenaDraftTyp enum (4 values), and nullable feedback text field. |
| ALRT-01 | HelenaAlert Prisma-Modell mit 6 Typen (FRIST_KRITISCH, AKTE_INAKTIV, BETEILIGTE_FEHLEN, DOKUMENT_FEHLT, WIDERSPRUCH, NEUES_URTEIL) | Covered by HelenaAlert model with HelenaAlertTyp enum (6 values), integer severity/priority, read status tracking. |
| MEM-01 | Per-Akte Helena-Kontext (Zusammenfassung, erkannte Risiken, naechste Schritte, offene Fragen, relevante Normen/Urteile) | Covered by HelenaMemory model with structured JSON content field, typed to hold all 5 categories. One row per Akte with upsert pattern. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | ^5.22.0 | ORM + migration tool | Already installed, used by all 50+ existing models. Native enum support, JSON field filtering, migration history. |
| @prisma/client | ^5.22.0 | Type-safe database client | Already installed, generates TypeScript types from schema. |
| PostgreSQL | 16 | Database | Already running in Docker. Supports native enums via Prisma, JSONB columns, and all required index types. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| prisma migrate dev | built-in | Generate migration SQL | During development to create the migration file |
| prisma migrate deploy | built-in | Apply migration | In production/CI to apply without interactive prompts |
| prisma generate | built-in | Regenerate client types | After schema changes to get new TypeScript types |

### Alternatives Considered
None -- Prisma is the project's sole ORM, zero new packages allowed per STATE.md decisions.

**Installation:**
```bash
# No new packages needed -- Prisma 5.22 already installed
npx prisma migrate dev --name add_helena_agent_models
npx prisma generate
```

## Architecture Patterns

### Recommended Schema Structure

The 5 new models and 4 new enums should be added to the existing `prisma/schema.prisma` file in dedicated sections:

```
prisma/schema.prisma
  // ─── Helena Agent Enums ─────────────────────────────────────────
  enum HelenaTaskStatus { ... }
  enum HelenaDraftTyp { ... }
  enum HelenaDraftStatus { ... }
  enum HelenaAlertTyp { ... }
  enum AktenActivityTyp { ... }

  // ─── Helena Agent Models ────────────────────────────────────────
  model HelenaTask { ... }
  model HelenaDraft { ... }
  model HelenaAlert { ... }
  model HelenaMemory { ... }
  model AktenActivity { ... }
```

Plus reverse relation fields added to existing `User` and `Akte` models.

### Pattern 1: Enum-Based Status Flow
**What:** Use Prisma `enum` for all status fields instead of raw strings. This gives compile-time type safety and database-level constraints.
**When to use:** Every status/type field in the new models.
**Example:**
```prisma
// Matches existing project pattern (DokumentStatus, OcrStatus, etc.)
enum HelenaTaskStatus {
  PENDING
  RUNNING
  DONE
  FAILED
  WAITING_APPROVAL
  ABGEBROCHEN
}

model HelenaTask {
  id     String           @id @default(cuid())
  status HelenaTaskStatus @default(PENDING)
  // ...
}
```
**Source:** Existing schema conventions -- DokumentStatus (line 177), AkteStatus (line 36), TicketStatus (line 164).

### Pattern 2: JSON Fields for Flexible Structured Data
**What:** Use Prisma `Json` type for data that has known structure but shouldn't be normalized into separate tables (trace logs, memory content).
**When to use:** HelenaTask.steps (agent trace), HelenaMemory.content (structured context), AktenActivity.meta (event-specific payload).
**Example:**
```prisma
model HelenaTask {
  // JSON array: [{ type: "thought"|"toolCall"|"toolResult"|"error", ... }]
  steps Json @default("[]")
}
```
**Source:** Existing schema pattern: AiConversation.messages (line 1463), Rechnung.positionen (line 1193), KalenderEintrag.fristHistorie (line 1113). Prisma 5.x supports `path` filtering on JSON with PostgreSQL.

### Pattern 3: Foreign Key with ON DELETE CASCADE
**What:** All new models referencing Akte must use `onDelete: Cascade` for DSGVO compliance (Art. 17 Right to Erasure).
**When to use:** Every akteId foreign key in the 5 new models.
**Example:**
```prisma
model HelenaTask {
  akteId String
  akte   Akte @relation(fields: [akteId], references: [id], onDelete: Cascade)
}
```
**Source:** Existing pattern used by Dokument (line 884), KalenderEintrag (line 1072 uses SetNull -- but that's optional FK), Zeiterfassung (line 1154). For Helena models, Akte is mandatory, so Cascade is correct.

### Pattern 4: Reverse Relations on User and Akte
**What:** Every new model with a User or Akte FK needs a corresponding reverse relation array on those parent models.
**When to use:** All 5 new models add reverse relations.
**Example:**
```prisma
// In User model, add:
helenaTasks     HelenaTask[]
helenaDrafts    HelenaDraft[]
helenaAlerts    HelenaAlert[]

// In Akte model, add:
helenaTasks     HelenaTask[]
helenaDrafts    HelenaDraft[]
helenaAlerts    HelenaAlert[]
helenaMemories  HelenaMemory[]
activities      AktenActivity[]
```
**Source:** Existing pattern: User model lines 370-410 have 20+ reverse relations. Akte model lines 709-730 have 15+ reverse relations.

### Pattern 5: Composite Indexes for Query Optimization
**What:** Add composite indexes for columns that will be queried together in downstream phases.
**When to use:** Status + akteId (task/draft/alert lists per case), userId + status (user's pending items), akteId + createdAt (activity feed ordering).
**Example:**
```prisma
model HelenaTask {
  @@index([akteId, status])
  @@index([userId, status])
  @@index([createdAt])
}
```
**Source:** Existing pattern: HelenaSuggestion has `@@index([userId, status, createdAt])` and `@@index([akteId, typ, createdAt])` (lines 1814-1815).

### Anti-Patterns to Avoid
- **Over-normalizing agent traces:** Do NOT create separate AgentStep models for the steps[] array. The data is write-once, read-together, and JSON is the correct storage. The existing AiConversation.messages field (line 1463) sets this precedent.
- **String-typed status/type fields:** Do NOT use `String` for status or type fields. The existing HelenaSuggestion model uses `String` for typ and status (lines 1800-1804) and this was explicitly called out by the user as something to fix with proper enums.
- **Optional akteId on mandatory relations:** HelenaTask, HelenaDraft, HelenaAlert, and HelenaMemory all MUST have a mandatory (non-optional) akteId. Only AktenActivity MAY have optional akteId if system-level events are needed, but per the CONTEXT.md constraint, all models should have mandatory Akte FK for DSGVO cascade.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Enum validation | Runtime string checks | Prisma native enums | Database-level constraint, TypeScript compile-time safety |
| Cascade deletion | Application-level delete loops | `onDelete: Cascade` on FK | Atomic, no orphans even on crash, PostgreSQL handles it |
| Migration SQL | Hand-written ALTER TABLE | `npx prisma migrate dev` | Tracks migration history, handles rollback detection |
| Type generation | Manual interface definitions | `npx prisma generate` | Auto-generates from schema, always in sync |
| JSON schema validation | Custom Zod validators at DB layer | Prisma JSON type + app-layer Zod types | DB stores raw JSON, app layer validates on read/write with TypeScript types |

**Key insight:** This phase is purely additive schema work. Prisma handles all the complexity of migration generation, type safety, and foreign key enforcement. The planner should NOT include any TypeScript validation code, API routes, or business logic tasks -- those belong in Phases 20-26.

## Common Pitfalls

### Pitfall 1: Forgetting Reverse Relations on Parent Models
**What goes wrong:** Adding a new model with `akteId` FK but not adding the reverse `HelenaTask[]` array on the `Akte` model. Prisma will refuse to generate.
**Why it happens:** The schema has 50+ models and it's easy to add the child model without updating the parent.
**How to avoid:** For every FK field on new models, immediately add the corresponding reverse relation array on the parent model (User, Akte).
**Warning signs:** `prisma generate` fails with "relation field missing" errors.

### Pitfall 2: Named Relations Required for Multiple FKs to Same Model
**What goes wrong:** If a model has both `userId` (creator) and `assignedToId` (assignee) pointing to User, Prisma requires explicit relation names.
**Why it happens:** Prisma can't disambiguate which User relation is which without names.
**How to avoid:** Use named relations: `@relation("HelenaTaskCreator")` and `@relation("HelenaTaskAssignee")` if multiple User FKs exist on the same model.
**Warning signs:** `prisma generate` fails with "ambiguous relation" errors.

### Pitfall 3: Forgetting @@map on New Models
**What goes wrong:** Table gets created with PascalCase name (e.g., `HelenaTask`) instead of snake_case (`helena_tasks`). Inconsistent with all other tables.
**Why it happens:** `@@map` is optional in Prisma but the project convention requires it.
**How to avoid:** Every new model MUST have `@@map("snake_case_plural")` matching the project convention.
**Warning signs:** Table names in PostgreSQL are inconsistent when inspecting with `\dt`.

### Pitfall 4: Missing Default Values for JSON Fields
**What goes wrong:** Inserting a row without providing the JSON field results in `null` instead of an empty array, breaking downstream code that expects `steps[]` to always be iterable.
**Why it happens:** Prisma JSON fields default to `null` unless a `@default` is specified.
**How to avoid:** Use `@default("[]")` for JSON array fields like `steps` and `@default("{}")` for JSON object fields like `content`.
**Warning signs:** NullPointerException or "cannot iterate null" errors in downstream phases.

### Pitfall 5: Migration Order with Enum Dependencies
**What goes wrong:** Migration fails if enum is referenced by a model but the enum CREATE TYPE comes after the CREATE TABLE in the generated SQL.
**Why it happens:** Prisma generates migrations in a specific order, but manual edits or schema reorganization can cause issues.
**How to avoid:** Place all new enums BEFORE the models that reference them in the schema file. Prisma's migration generator handles the SQL ordering, but the schema file ordering helps readability and avoids confusion.
**Warning signs:** Migration fails with "type does not exist" PostgreSQL error.

### Pitfall 6: Forgetting ON DELETE CASCADE for DSGVO
**What goes wrong:** Deleting an Akte leaves orphaned HelenaTask/HelenaDraft/etc. rows, violating DSGVO Art. 17.
**Why it happens:** The default Prisma behavior for required relations is to block deletion (RESTRICT), not cascade.
**How to avoid:** Every FK to Akte MUST have explicit `onDelete: Cascade`. Verify by checking the generated migration SQL.
**Warning signs:** `prisma migrate dev` succeeds but Akte deletion fails with foreign key constraint errors.

## Code Examples

Verified patterns from the existing project schema:

### Model with Enum Status, JSON Field, and Cascade FK
```prisma
// Source: Follows patterns from Dokument (line 882), HelenaSuggestion (line 1794), AiConversation (line 1456)
model HelenaTask {
  id          String           @id @default(cuid())
  akteId      String
  akte        Akte             @relation(fields: [akteId], references: [id], onDelete: Cascade)
  userId      String           // User who created/triggered the task
  user        User             @relation(fields: [userId], references: [id])

  auftrag     String           @db.Text  // Natural language task description
  status      HelenaTaskStatus @default(PENDING)
  modus       String           @default("BACKGROUND") // INLINE | BACKGROUND
  prioritaet  Int              @default(5)  // 1-10, higher = more urgent
  steps       Json             @default("[]") // Agent trace: [{type, content, timestamp}]
  ergebnis    String?          @db.Text  // Final result summary
  fehler      String?          @db.Text  // Error message if FAILED

  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  @@index([akteId, status])
  @@index([userId, status])
  @@index([status, createdAt])
  @@map("helena_tasks")
}
```

### HelenaMemory with Structured JSON and Unique Constraint
```prisma
// Source: Follows AkteNorm pattern (line 1037) for per-Akte unique and JSON pattern from AiConversation (line 1456)
model HelenaMemory {
  id        String   @id @default(cuid())
  akteId    String   @unique  // One memory per Akte (upsert pattern)
  akte      Akte     @relation(fields: [akteId], references: [id], onDelete: Cascade)

  content   Json     @default("{}") // { summary, risks, nextSteps, openQuestions, relevantNorms }
  version   Int      @default(1)    // Incremented on refresh

  lastRefreshedAt DateTime @default(now())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("helena_memories")
}
```

### AktenActivity with Event Type Enum
```prisma
// Source: Follows AuditLog pattern (line 1719) but typed for Akte feed
enum AktenActivityTyp {
  DOKUMENT
  FRIST
  EMAIL
  HELENA_DRAFT
  HELENA_ALERT
  NOTIZ
  BETEILIGTE
  STATUS_CHANGE
}

model AktenActivity {
  id        String           @id @default(cuid())
  akteId    String
  akte      Akte             @relation(fields: [akteId], references: [id], onDelete: Cascade)
  userId    String?          // null for system/Helena-generated events
  user      User?            @relation(fields: [userId], references: [id])

  typ       AktenActivityTyp
  titel     String
  inhalt    String?          @db.Text
  meta      Json?            // Event-specific payload (dokumentId, fristId, draftId, etc.)

  createdAt DateTime         @default(now())

  @@index([akteId, createdAt])
  @@index([akteId, typ])
  @@map("akten_activities")
}
```

### Complete Enum Definitions
```prisma
enum HelenaTaskStatus {
  PENDING
  RUNNING
  DONE
  FAILED
  WAITING_APPROVAL
  ABGEBROCHEN
}

enum HelenaDraftTyp {
  DOKUMENT
  FRIST
  NOTIZ
  ALERT
}

enum HelenaDraftStatus {
  PENDING
  ACCEPTED
  REJECTED
  EDITED
}

enum HelenaAlertTyp {
  FRIST_KRITISCH
  AKTE_INAKTIV
  BETEILIGTE_FEHLEN
  DOKUMENT_FEHLT
  WIDERSPRUCH
  NEUES_URTEIL
}

enum AktenActivityTyp {
  DOKUMENT
  FRIST
  EMAIL
  HELENA_DRAFT
  HELENA_ALERT
  NOTIZ
  BETEILIGTE
  STATUS_CHANGE
}
```

### Reverse Relations to Add to User Model
```prisma
// Add inside model User { ... } after existing helenaSuggestions relation:
helenaTasks         HelenaTask[]
helenaDrafts        HelenaDraft[]     @relation("HelenaDraftUser")
helenaDraftsReviewed HelenaDraft[]    @relation("HelenaDraftReviewer")
helenaAlerts        HelenaAlert[]
aktenActivities     AktenActivity[]
```

### Reverse Relations to Add to Akte Model
```prisma
// Add inside model Akte { ... } after existing helenaSuggestions relation:
helenaTasks     HelenaTask[]
helenaDrafts    HelenaDraft[]
helenaAlerts    HelenaAlert[]
helenaMemory    HelenaMemory?   // Note: singular, one-to-one via @unique on akteId
activities      AktenActivity[]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| String status fields (HelenaSuggestion.typ/status) | Native Prisma enums (all new models) | This phase | Type safety, DB-level constraints, no runtime validation needed |
| Separate trace tables for agent steps | JSON array field (steps[]) | Industry standard for agent traces (LangSmith, Langfuse all use JSON) | Simpler writes, no N+1 queries on trace reads |
| Nullable JSON fields | JSON with @default("[]"/"{}") | Prisma 5.x convention | Downstream code never sees null, reduces defensive coding |

**Deprecated/outdated:**
- HelenaSuggestion model (existing) uses `String` for typ and status. The new HelenaAlert/HelenaDraft models replace this pattern with proper enums. HelenaSuggestion itself is NOT modified in this phase but serves as a "how NOT to do it" reference.

## Open Questions

1. **HelenaMemory: One row per Akte vs. versioned rows?**
   - What we know: CONTEXT.md says "one memory per Akte" with structured JSON. The `@unique` on akteId enforces this.
   - What's unclear: Whether downstream MEM-03 (auto-refresh) wants to keep history of previous memory versions.
   - Recommendation: Use `@unique` on akteId with a `version` integer field. Upsert overwrites content and increments version. If version history is needed later, add a HelenaMemoryHistory model in Phase 25. This keeps Phase 19 simple.

2. **AktenActivity: Should userId be nullable?**
   - What we know: System-generated events (Helena creates a draft, scanner creates an alert) have no human user actor.
   - What's unclear: Whether a "Helena system user" row exists in the User table.
   - Recommendation: Make userId nullable (`String?`) since the existing schema already has this pattern (ChatNachricht.userId is nullable for AI messages, line 1445). Add a comment explaining null = Helena/system.

3. **HelenaDraft: Should it reference the HelenaTask that created it?**
   - What we know: Phase 20+ will have agents creating drafts as part of task execution.
   - What's unclear: Whether linking draft to task is needed for the approval workflow.
   - Recommendation: Add an optional `helenaTaskId` FK on HelenaDraft pointing to HelenaTask. This enables "show which task produced this draft" in the feed without requiring a separate lookup. Low cost, high value for traceability.

4. **HelenaAlert: Should it also link to HelenaDraft if scanner creates an alert that recommends action?**
   - What we know: ALRT-01 defines 6 alert types. Some may recommend creating a draft (e.g., FRIST_KRITISCH could suggest a Fristverlaengerungsantrag).
   - Recommendation: Add an optional `helenaDraftId` FK on HelenaAlert for this cross-reference. Can be populated in Phase 24 when scanner creates both alert + draft.

## Sources

### Primary (HIGH confidence)
- Existing Prisma schema (`prisma/schema.prisma`, 1817 lines) -- direct analysis of all 50+ models, conventions, and patterns
- `package.json` -- confirmed Prisma 5.22.0 version
- Existing migration history (4 migrations, consistent naming) -- confirms migration workflow
- CONTEXT.md and REQUIREMENTS.md -- phase-specific constraints and requirement IDs

### Secondary (MEDIUM confidence)
- Prisma 5.x documentation (from training data) -- JSON filtering, enum support, cascade behavior. These features are well-established and haven't changed significantly between Prisma 4 and 5.

### Tertiary (LOW confidence)
- None -- all findings are based on direct codebase analysis and well-established Prisma features.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Prisma 5.22 already installed, zero new dependencies, all features used extensively in existing schema
- Architecture: HIGH -- All patterns directly derived from 50+ existing models in the same schema file, no novel patterns needed
- Pitfalls: HIGH -- Based on direct observation of existing schema conventions and common Prisma migration issues

**Research date:** 2026-02-27
**Valid until:** 2026-06-27 (stable -- Prisma schema patterns rarely change, and the project pins its Prisma version)
