# Phase 19: Schema Foundation - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Create the 5 Prisma models (HelenaTask, HelenaDraft, HelenaAlert, HelenaMemory, AktenActivity) that every subsequent Helena Agent phase depends on. Migration must succeed cleanly, Prisma Client must generate without errors, and the existing application must continue to work. No UI, no API endpoints, no business logic — pure data layer.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation decisions delegated to Claude with two guiding constraints:

**Performance priority:**
- Indexes on all foreign keys and frequently queried columns (status, type, akteId, createdAt)
- JSON fields for flexible data (agent trace steps[], memory content) — avoid over-normalization
- Composite indexes where downstream queries will filter on multiple columns (e.g., akteId + status)

**Law firm standards (Kanzlei-tauglich):**
- DSGVO compliance: ON DELETE CASCADE on all Akte/User relations — no orphaned data
- Strict Prisma enums for status flows and types — type safety over flexibility, migrations are acceptable for new types
- Audit-ready: createdAt/updatedAt timestamps on all models
- Professional naming: German domain terms in enums (ABGEBROCHEN, ENTWURF), English for technical fields

**Schema design decisions (Claude's discretion):**
- HelenaMemory: Structured JSON field with typed categories (summary, risks, nextSteps, openQuestions, relevantNorms) — queryable via Prisma JSON filtering, flexible enough for future categories
- AktenActivity: Event type enum covering all Akte-relevant events (DOKUMENT, FRIST, EMAIL, HELENA_DRAFT, HELENA_ALERT, NOTIZ, BETEILIGTE, STATUS_CHANGE) — the unified feed backbone
- HelenaTask steps[]: JSON array of typed step objects (thought, toolCall, toolResult, error) — complete agent trace for transparency
- HelenaDraft: Strict type + status enums as specified in requirements, feedback as nullable text field
- HelenaAlert: 6 alert types as Prisma enum, severity/priority as integer for flexible ordering

</decisions>

<specifics>
## Specific Ideas

- "Hochperformant" — Performance is a first-class concern. Index strategy matters from day one.
- "Kanzlei-tauglich" — Professional quality expected. DSGVO compliance, audit trails, no shortcuts.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-schema-foundation*
*Context gathered: 2026-02-27*
