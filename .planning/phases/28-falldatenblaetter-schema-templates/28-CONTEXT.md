# Phase 28: Falldatenblaetter Schema + Templates - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Database-backed template system for structured case data collection. Users create custom Falldatenblatt templates with configurable fields, submit them to Admin for approval, and approved templates become available as Standardfaelle. The 10 existing TypeScript schemas are migrated to DB as seed templates (single source of truth). This phase covers the data model, API routes, and approval workflow — NOT the Akte-detail form rendering (Phase 29).

</domain>

<decisions>
## Implementation Decisions

### Template Builder
- Gruppen-first approach: User first creates groups (e.g. "Unfallhergang", "Versicherung"), then adds fields within each group
- Simple form-based builder — no drag & drop required
- Field types: The 7 existing types (text, textarea, number, date, select, boolean, currency) + Mehrfachauswahl (multi-select checkboxes) = 8 total, matching the FD-03 requirement
- Each field: Label, Typ (dropdown), Gruppe (select from created groups), Pflichtfeld-Toggle, Placeholder (optional), Optionen (for select/multiselect)
- Field ordering within groups: fixed by creation order (simplest approach)

### Approval Workflow
- Status lifecycle: ENTWURF → EINGEREICHT → GENEHMIGT / ABGELEHNT
- Admin can provide feedback text when rejecting
- Rejected templates can be edited and resubmitted (back to EINGEREICHT)
- Self-approval check: Admin cannot approve their own templates (4-Augen-Prinzip if multiple Admins exist, otherwise Admin can approve own)
- Standard templates (seed) are created with status STANDARD (immutable, not editable by users)

### Template-Akte Binding
- Auto-match by Sachgebiet for standard templates (like existing behavior)
- Additionally: any GENEHMIGT template can be manually assigned to any Akte regardless of Sachgebiet
- One primary Falldatenblatt per Akte (keeps existing Akte.falldaten pattern simple)
- Future: FalldatenInstanz model for multiple templates per Akte (not v0.3 scope)

### Seed Migration
- 10 existing TypeScript schemas migrated to FalldatenTemplate records with status STANDARD
- Seed runs at migration time (idempotent, like existing seedAmtlicheFormulare pattern)
- Existing Akte.falldaten JSON data remains intact — field keys match between old TS schemas and new DB templates
- TypeScript file becomes seed-only source (DB is runtime source of truth)

### Claude's Discretion
- Prisma model structure for FalldatenTemplate (fields, indexes, relations)
- API route design (REST endpoints for CRUD + workflow transitions)
- Template versioning strategy (if needed)
- Admin UI layout for template review queue
- Notification mechanism when template is approved/rejected

</decisions>

<specifics>
## Specific Ideas

- User said: "Benutzer koennen Standardfaelle anlegen mit besonderen Fallfeldern, also so Checklisten, die man auch im Mandantengespraech benutzen kann"
- Community workflow: Any user can create, Admin gate-keeps quality
- "Auch Helena" — Helena integration deferred to Phase 29 (auto-fill + template suggestion)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FalldatenSchema` + `FalldatenFeld` types (src/lib/falldaten-schemas.ts): Exact shape for DB template schema JSON column
- `FalldatenForm` component (src/components/akten/falldaten-form.tsx): 236 LOC, fully working renderer with grouping — reusable in Phase 29
- `falldatenSchemas` registry: 10 schemas as seed data source
- `getFalldatenSchema()`: Replace with DB lookup in Phase 29
- `Sachgebiet` enum: 11 values (10 + SONSTIGES), auto-match key

### Established Patterns
- `Akte.falldaten` Json? column: Existing data storage, field keys stable
- PATCH `/api/akten/[id]` for saving falldaten data
- Glass UI components (backdrop-blur, rounded-xl, border-white/20)
- RBAC: ADMIN role for approval, all roles for creation
- Seed pattern: `seedAmtlicheFormulare()` at worker startup (idempotent via SystemSetting guard)

### Integration Points
- Prisma schema: New FalldatenTemplate model alongside existing Akte model
- Admin pages: `/dashboard/admin/` for template review queue
- Akte detail: Template selection when Sachgebiet has no standard template or user wants custom
- API routes: `/api/falldaten-templates/` for CRUD + workflow

</code_context>

<deferred>
## Deferred Ideas

- Helena auto-fill for Falldatenblaetter — Phase 29
- Helena template suggestion based on case patterns — Phase 29
- Conditional field logic (show/hide based on other fields) — Future
- Falldatenblatt PDF export — Future
- Multiple Falldatenblaetter per Akte (FalldatenInstanz model) — Future
- WYSIWYG drag-and-drop template builder — Out of scope

</deferred>

---

*Phase: 28-falldatenblaetter-schema-templates*
*Context gathered: 2026-02-28*
