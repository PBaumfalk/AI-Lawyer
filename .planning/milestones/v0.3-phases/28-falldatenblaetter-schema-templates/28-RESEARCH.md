# Phase 28: Falldatenblaetter Schema + Templates -- Research

**Researched:** 2026-02-28
**Objective:** What do I need to know to PLAN this phase well?
**Confidence:** HIGH (all integration points verified against live codebase)

---

## 1. Phase Scope and Requirements

Phase 28 covers the **backend data model, API routes, seed migration, and admin approval workflow** for database-backed Falldatenblatt templates. It does NOT cover the Akte-detail form rendering (Phase 29).

### Requirements to Address

| ID | Requirement | Key Deliverable |
|----|-------------|-----------------|
| FD-03 | User can create a custom template with 7+ field types | FalldatenTemplate model + builder UI + POST API |
| FD-04 | User can submit template to Admin for review | Status transition ENTWURF -> EINGEREICHT + API |
| FD-05 | Admin can approve or reject submitted templates | Admin review UI + approve/reject API endpoints |
| FD-06 | Approved templates appear as available Standardfaelle | GET API filtering by GENEHMIGT/STANDARD status |
| FD-07 | 10 existing TS schemas migrated as seed templates | Seed function at worker startup (idempotent) |

### Success Criteria (from ROADMAP.md)

1. User can create a custom Falldatenblatt template with all 7 field types (Text, Datum, Dropdown, Checkbox, Zahl, Textbereich, Mehrfachauswahl)
2. User can submit a custom template for Admin review and sees it in EINGEREICHT status
3. Admin can approve or reject submitted templates with the result visible to the submitting user
4. Approved templates appear as available Standardfaelle for all users when creating or editing Falldatenblaetter
5. The 10 existing Sachgebiet schemas from TypeScript are present as seed templates in the database (single source of truth)

### Explicit Scope Boundaries (from 28-CONTEXT.md)

**In scope:** Data model, API routes, approval workflow, seed migration, template builder UI (form-based, no drag-and-drop), admin review queue.
**Out of scope:** Akte-detail form rendering (Phase 29), Helena auto-fill (Phase 29), conditional field logic (Future), PDF export (Future), multiple Falldatenblaetter per Akte via FalldatenInstanz (Future), drag-and-drop builder.

---

## 2. Existing Code Inventory

### 2.1 Static Schema Registry

**File:** `/Users/patrickbaumfalk/Projekte/AI-Lawyer/src/lib/falldaten-schemas.ts` (410 LOC)

Core types that define the contract for the new DB model:

```typescript
export type FalldatenFeldTyp =
  | "text" | "textarea" | "number" | "date" | "select" | "boolean" | "currency";

export interface FalldatenFeld {
  key: string;
  label: string;
  typ: FalldatenFeldTyp;
  placeholder?: string;
  optionen?: { value: string; label: string }[];
  required?: boolean;
  gruppe?: string;
}

export interface FalldatenSchema {
  sachgebiet: string;
  label: string;
  beschreibung: string;
  felder: FalldatenFeld[];
}
```

**10 schemas defined:** ARBEITSRECHT (23 fields, 5 groups), FAMILIENRECHT (18 fields, 6 groups), VERKEHRSRECHT (22 fields, 6 groups), MIETRECHT (17 fields, 4 groups), STRAFRECHT (16 fields, 5 groups), ERBRECHT (11 fields, 3 groups), SOZIALRECHT (10 fields, 3 groups), INKASSO (12 fields, 4 groups), HANDELSRECHT (7 fields, 3 groups), VERWALTUNGSRECHT (5 fields, 2 groups).

**Key observation:** The existing field types include `currency` (7 types total). The 28-CONTEXT.md specifies 8 types: the existing 7 + `Mehrfachauswahl` (multi-select checkboxes). The DB model must support both `select` (single) and `multiselect` (multiple) field types.

### 2.2 Form Renderer

**File:** `/Users/patrickbaumfalk/Projekte/AI-Lawyer/src/components/akten/falldaten-form.tsx` (236 LOC)

Fully working renderer that:
- Takes a `FalldatenSchema` and renders grouped fields
- Handles all 7 existing field types (text, textarea, number, currency, date, select, boolean)
- Saves via PATCH `/api/akten/{akteId}` to `Akte.falldaten` JSON column
- Uses Glass UI styling (`bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20`)

**Phase 28 impact:** This component is NOT modified in Phase 28 (that is Phase 29). But the DB template schema JSON must be compatible with `FalldatenSchema` type so Phase 29 can reuse this renderer with minimal changes.

### 2.3 Akte Model (Prisma)

**File:** `/Users/patrickbaumfalk/Projekte/AI-Lawyer/prisma/schema.prisma` (lines 692-750)

```prisma
model Akte {
  sachgebiet       Sachgebiet  @default(SONSTIGES)
  falldaten        Json?       // Custom case data (JSON Schema based, per Sachgebiet)
  // ... 40+ other fields and relations
}
```

**Sachgebiet enum:** 11 values (ARBEITSRECHT through VERWALTUNGSRECHT + SONSTIGES). The 10 seed templates map to the 10 non-SONSTIGES values.

**Key decision from CONTEXT:** One primary Falldatenblatt per Akte for v0.3 (keeps existing `Akte.falldaten` pattern simple). FalldatenInstanz model deferred to future. This means Phase 28 can add a `falldatenTemplateId` FK to Akte without the full FalldatenInstanz intermediate table.

### 2.4 OrdnerSchema (Existing Template Pattern)

**File:** `/Users/patrickbaumfalk/Projekte/AI-Lawyer/prisma/schema.prisma` (lines 883-893)

```prisma
model OrdnerSchema {
  id            String      @id @default(cuid())
  name          String
  sachgebiet    Sachgebiet?
  ordner        String[]
  istStandard   Boolean     @default(false)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  @@map("ordner_schemata")
}
```

This is an analogous pattern: a DB-backed template with Sachgebiet binding and `istStandard` flag. FalldatenTemplate follows the same pattern but with richer lifecycle (approval workflow).

### 2.5 Seed Pattern

**File:** `/Users/patrickbaumfalk/Projekte/AI-Lawyer/src/lib/muster/seed-amtliche.ts` (603 LOC)

Established pattern:
1. Version key in SystemSetting (e.g., `muster.amtliche_seed_version`)
2. Idempotency guard: if version matches, skip
3. Find first ADMIN user for `erstelltVonId`
4. Create DB records in a loop
5. Write version key on completion
6. Called from `src/worker.ts` at startup (line 6: `import { seedAmtlicheFormulare }`)

The Falldaten seed function follows this exact pattern with key `falldaten.templates_seed_version`.

### 2.6 Admin Infrastructure

**Layout:** `/Users/patrickbaumfalk/Projekte/AI-Lawyer/src/app/(dashboard)/admin/layout.tsx`

Navigation items: Job-Monitor, System, Pipeline, Muster, Dezernate, Rollen, Audit-Trail, DSGVO, Einstellungen.
A new "Falldaten-Templates" item must be added.

**Auth pattern:** `session?.user?.role !== "ADMIN"` check in layout + per-route checks in API handlers.

**Example admin API:** `/Users/patrickbaumfalk/Projekte/AI-Lawyer/src/app/api/admin/muster/route.ts` shows the standard pattern: auth check, prisma query, NextResponse.json.

### 2.7 Notification System

**Notification model:** Persisted notifications with `type`, `title`, `message`, `data` JSON payload, `read`/`dismissed` flags. Socket.IO push via `socketEmitter.to('user:{userId}').emit('notification', {...})`.

**Relevance to Phase 28:** When Admin approves/rejects a template, the submitting user should receive a Notification. This follows the existing pattern exactly.

### 2.8 RBAC System

All roles can create templates (FD-03). Only ADMIN can approve/reject (FD-05). The pattern from `requirePermission()` and `requireAkteAccess()` in `/Users/patrickbaumfalk/Projekte/AI-Lawyer/src/lib/rbac/` applies.

---

## 3. Data Model Design

### 3.1 New Enum: FalldatenTemplateStatus

```prisma
enum FalldatenTemplateStatus {
  ENTWURF       // Created by user, only visible to creator
  EINGEREICHT   // Submitted for admin review
  GENEHMIGT     // Approved by admin, visible to all users
  ABGELEHNT     // Rejected by admin (can be edited and resubmitted)
  STANDARD      // System-seeded, immutable (10 Sachgebiet defaults)
}
```

Lifecycle: `ENTWURF -> EINGEREICHT -> GENEHMIGT / ABGELEHNT`
Rejected templates: `ABGELEHNT -> (edit) -> EINGEREICHT` (resubmission)
Seed templates: created directly as `STANDARD` (no lifecycle transitions)

### 3.2 New Model: FalldatenTemplate

```prisma
model FalldatenTemplate {
  id              String                   @id @default(cuid())
  name            String
  beschreibung    String?                  @db.Text
  sachgebiet      Sachgebiet?              // Set for STANDARD templates; optional for custom
  schema          Json                     // Stores { felder: FalldatenFeld[] } structure
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

  @@index([status])
  @@index([sachgebiet])
  @@index([erstelltVonId])
  @@map("falldaten_templates")
}
```

**Schema JSON structure:** The `schema` column stores the full template definition as JSON, compatible with the existing `FalldatenSchema` type:
```json
{
  "felder": [
    { "key": "arbeitgeber", "label": "Arbeitgeber", "typ": "text", "gruppe": "Arbeitsverhaltnis", "required": true, "placeholder": null, "optionen": null },
    { "key": "kuendigungsart", "label": "Kuendigungsart", "typ": "select", "gruppe": "Kuendigung", "optionen": [{"value": "ordentlich", "label": "Ordentliche Kuendigung"}] }
  ]
}
```

### 3.3 Field Types for the Schema

The 8 field types (per 28-CONTEXT.md):

| Type | DB Key | Renderer | Notes |
|------|--------|----------|-------|
| Text | `text` | Input | Existing |
| Textbereich | `textarea` | Textarea | Existing |
| Zahl | `number` | Input type=number | Existing |
| Waehrung | `currency` | Input type=number + Euro suffix | Existing |
| Datum | `date` | Input type=date | Existing |
| Dropdown | `select` | Select element | Existing, single value |
| Checkbox | `boolean` | Checkbox input | Existing |
| Mehrfachauswahl | `multiselect` | Checkbox group | NEW -- array of selected values |

The `multiselect` type needs `optionen` (like `select`) but stores an array of selected values instead of a single string.

### 3.4 Unique Standard Constraint

The research ARCHITECTURE.md proposed `@@unique([sachgebiet, status])` but this is problematic because Prisma does not support partial unique constraints. Multiple GENEHMIGT templates can share the same Sachgebiet (by design). Only STANDARD templates should be unique per Sachgebiet.

**Solution:** Enforce uniqueness at the application layer, not the database. When seeding, use `findFirst` + `create` with a check. The seed function ensures exactly one STANDARD template per Sachgebiet.

### 3.5 Akte-Template Binding (Simplified for v0.3)

The 28-CONTEXT.md specifies: "One primary Falldatenblatt per Akte (keeps existing Akte.falldaten pattern simple)." and "FalldatenInstanz model for multiple templates per Akte (not v0.3 scope)."

This means we do NOT need a FalldatenInstanz model. Instead, add an optional FK to Akte:

```prisma
model Akte {
  // ... existing fields ...
  falldatenTemplateId  String?
  falldatenTemplate    FalldatenTemplate?  @relation(fields: [falldatenTemplateId], references: [id])
}
```

This links an Akte to a specific template. The `Akte.falldaten` JSON column continues to store the actual field values. The template defines the schema; the falldaten stores the data.

**Auto-match behavior:** When an Akte has no explicit `falldatenTemplateId`, the system looks up the STANDARD template matching `akte.sachgebiet`. This is the backward-compatible behavior equivalent to the current `getFalldatenSchema()`.

---

## 4. API Route Design

### 4.1 Template CRUD Routes

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/falldaten-templates` | All authenticated | List templates (filterable by status, sachgebiet) |
| POST | `/api/falldaten-templates` | All authenticated | Create new template (status: ENTWURF) |
| GET | `/api/falldaten-templates/[id]` | All authenticated | Get template detail |
| PATCH | `/api/falldaten-templates/[id]` | Creator only | Edit template (only ENTWURF/ABGELEHNT) |
| DELETE | `/api/falldaten-templates/[id]` | Creator only | Delete template (only ENTWURF) |

### 4.2 Workflow Transition Routes

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/falldaten-templates/[id]/einreichen` | Creator only | Submit for review (ENTWURF -> EINGEREICHT) |
| POST | `/api/falldaten-templates/[id]/genehmigen` | ADMIN only | Approve (EINGEREICHT -> GENEHMIGT) |
| POST | `/api/falldaten-templates/[id]/ablehnen` | ADMIN only | Reject with reason (EINGEREICHT -> ABGELEHNT) |

### 4.3 Validation (Zod Schemas)

Template creation/edit needs a Zod schema that validates the `schema` JSON structure:

```typescript
const falldatenFeldSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label: z.string().min(1).max(128),
  typ: z.enum(["text", "textarea", "number", "date", "select", "boolean", "currency", "multiselect"]),
  placeholder: z.string().max(256).optional().nullable(),
  optionen: z.array(z.object({
    value: z.string().min(1),
    label: z.string().min(1),
  })).optional().nullable(),
  required: z.boolean().optional(),
  gruppe: z.string().max(64).optional().nullable(),
});

const templateSchemaSchema = z.object({
  felder: z.array(falldatenFeldSchema).min(1).max(100),
});
```

**Validation rules:**
- `optionen` required when `typ` is `select` or `multiselect`
- `key` must be unique within the template
- At least one field required
- Max 100 fields per template (prevent abuse)

### 4.4 Query Patterns

**List templates (user view):**
```sql
WHERE status IN ('GENEHMIGT', 'STANDARD')
   OR (status = 'ENTWURF' AND erstelltVonId = :userId)
   OR (status = 'ABGELEHNT' AND erstelltVonId = :userId)
   OR (status = 'EINGEREICHT' AND erstelltVonId = :userId)
```
Users see: all public templates + their own private/rejected/submitted ones.

**Admin review queue:**
```sql
WHERE status = 'EINGEREICHT' ORDER BY createdAt ASC
```

**Available templates for Akte:**
```sql
WHERE status IN ('GENEHMIGT', 'STANDARD')
```

---

## 5. Seed Migration Strategy

### 5.1 Seed Function

File: `src/lib/falldaten/seed-templates.ts` (new file)

Pattern mirrors `seedAmtlicheFormulare()`:

```typescript
const SEED_VERSION = "v0.3";
const SEED_SETTING_KEY = "falldaten.templates_seed_version";

export async function seedFalldatenTemplates(): Promise<void> {
  const currentVersion = await getSetting(SEED_SETTING_KEY);
  if (currentVersion === SEED_VERSION) return;

  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!adminUser) throw new Error("No ADMIN user found");

  for (const [sachgebiet, schema] of Object.entries(falldatenSchemas)) {
    const existing = await prisma.falldatenTemplate.findFirst({
      where: { sachgebiet: sachgebiet as Sachgebiet, status: "STANDARD" },
    });
    if (existing) continue;

    await prisma.falldatenTemplate.create({
      data: {
        name: schema.label,
        beschreibung: schema.beschreibung,
        sachgebiet: sachgebiet as Sachgebiet,
        schema: { felder: schema.felder },
        status: "STANDARD",
        erstelltVonId: adminUser.id,
      },
    });
  }

  await updateSetting(SEED_SETTING_KEY, SEED_VERSION);
}
```

### 5.2 Worker Registration

Add to `src/worker.ts` startup sequence (after `seedAmtlicheFormulare()`):
```typescript
import { seedFalldatenTemplates } from "@/lib/falldaten/seed-templates";
// ... in startup:
await seedFalldatenTemplates();
```

### 5.3 Data Integrity

The 10 seed templates use the exact same `felder` array from `falldatenSchemas`. Field keys (e.g., `arbeitgeber`, `kuendigungsart`) remain stable. Existing `Akte.falldaten` JSON data continues to work because keys match.

The TypeScript file `src/lib/falldaten-schemas.ts` remains as the seed data source but is no longer the runtime source of truth. Runtime code reads from the `FalldatenTemplate` table.

---

## 6. UI Components (Phase 28 Scope)

### 6.1 Template Builder Page

**Route:** `/dashboard/admin/falldaten-templates/neu` (also accessible to non-admin users for creating their own)

Actually per the CONTEXT: "Any user can create, Admin gate-keeps quality." So the builder is not admin-only. Better route: `/dashboard/falldaten-templates/neu` for all users, `/dashboard/admin/falldaten-templates` for the admin review queue.

**Builder UI (Gruppen-first approach from CONTEXT):**
1. Template metadata: Name, Beschreibung, optional Sachgebiet
2. Group management: Add/rename/remove groups (simple list)
3. Field management per group: Add field with Label, Typ (dropdown), Pflichtfeld toggle, Placeholder, Optionen (for select/multiselect)
4. Field ordering: Fixed by creation order (no drag-and-drop)
5. Preview panel: Renders the template as it will appear using the Glass UI pattern from FalldatenForm

### 6.2 Admin Review Queue

**Route:** `/dashboard/admin/falldaten-templates`

Navigation: Add "Falldaten" to admin layout nav (9th item -> 10th item).

**UI:** Table of EINGEREICHT templates with columns: Name, Ersteller, Sachgebiet, Anzahl Felder, Eingereicht am, Actions (Genehmigen / Ablehnen).

**Detail view:** `/dashboard/admin/falldaten-templates/[id]` -- read-only preview of the template schema + approve/reject buttons. Rejection requires a text reason.

### 6.3 User Template List

**Route:** `/dashboard/falldaten-templates`

Shows the user their own templates (all statuses) plus all GENEHMIGT/STANDARD templates. Status badges with color coding:
- ENTWURF: slate/gray
- EINGEREICHT: amber (pending)
- GENEHMIGT: emerald (approved)
- ABGELEHNT: rose (rejected, shows reason)
- STANDARD: blue (system default)

---

## 7. Key Design Decisions (from 28-CONTEXT.md)

| Decision | Rationale |
|----------|-----------|
| Gruppen-first template builder | Simpler mental model: user organizes by groups first, then adds fields |
| No drag-and-drop | Simple form-based approach sufficient for v0.3 |
| Field ordering by creation order | Simplest implementation; reordering deferred |
| ENTWURF -> EINGEREICHT -> GENEHMIGT/ABGELEHNT lifecycle | Community quality gate with admin oversight |
| Rejected templates editable and resubmittable | Encourages iteration rather than starting over |
| STANDARD status for seed templates (immutable) | Prevents accidental modification of system defaults |
| Self-approval: Admin can approve own if sole Admin | Practical for small kanzlei (often 1 admin) |
| One primary Falldatenblatt per Akte (v0.3) | Keeps `Akte.falldaten` pattern simple; defer FalldatenInstanz |
| Auto-match by Sachgebiet for STANDARD templates | Backward-compatible with existing behavior |
| Any GENEHMIGT template manually assignable to any Akte | Flexibility beyond Sachgebiet auto-matching |
| 8 field types (7 existing + multiselect) | Matches FD-03 requirement exactly |

---

## 8. Risks and Mitigations

### Risk 1: Schema JSON Drift Between TypeScript Type and DB

**Problem:** The `FalldatenFeld` TypeScript interface evolves separately from the JSON stored in `FalldatenTemplate.schema`. Adding a field to the TS type does not retroactively update DB records.

**Mitigation:** The `schema` JSON column is validated at write time (Zod schema in API route). The renderer (Phase 29) handles missing optional properties gracefully. Version field on FalldatenTemplate supports future schema evolution.

### Risk 2: Unique STANDARD Per Sachgebiet Not Enforceable at DB Level

**Problem:** Prisma does not support partial unique indexes (unique only when status = STANDARD).

**Mitigation:** Application-layer enforcement in the seed function (check before create) and in the admin approval flow (prevent promoting a second template to STANDARD for the same Sachgebiet). Add a comment to the model explaining this constraint.

### Risk 3: Large Schema JSON Payloads

**Problem:** A template with 100 fields and many select options could produce a large JSON blob.

**Mitigation:** Zod validation caps at 100 fields and 50 options per select/multiselect field. The JSON column uses PostgreSQL's native JSON type which handles this efficiently.

### Risk 4: Notification Delivery for Approval Results

**Problem:** User submits a template and does not know when it is approved/rejected unless they check manually.

**Mitigation:** Use the existing Notification model + Socket.IO push. When admin approves/rejects, create a Notification for the `erstelltVonId` user with type `template:approved` or `template:rejected`.

---

## 9. Cross-Phase Dependencies

### Phase 29 (Falldatenblaetter UI) Depends On

Phase 28 must produce:
- `FalldatenTemplate` model with seeded STANDARD templates
- API route to GET template by ID (including schema JSON)
- API route to list available templates for an Akte (by Sachgebiet or all GENEHMIGT)
- Optional `falldatenTemplateId` FK on Akte model (or at minimum, the lookup pattern)

Phase 29 then builds:
- Modified `FalldatenForm` that reads schema from DB template instead of TS registry
- Completeness percentage calculation (FD-01, FD-02)
- Template selection UI in Akte detail

### Migration Path for Existing Code

After Phase 28, `getFalldatenSchema()` still works (TS file unchanged). Phase 29 replaces its callers with DB lookups. No breaking changes in Phase 28.

---

## 10. Estimated Complexity

| Component | Effort | Notes |
|-----------|--------|-------|
| Prisma schema (enum + model + Akte FK) | Low | ~30 lines of Prisma schema |
| Migration + seed function | Low | Pattern established, ~100 LOC |
| Zod validation schemas | Low | ~40 LOC, straightforward |
| Template CRUD API routes | Medium | 5 route files, ~300 LOC total |
| Workflow API routes (einreichen/genehmigen/ablehnen) | Medium | 3 route files, ~200 LOC total |
| Template builder UI (form-based, Gruppen-first) | Medium-High | Most complex new UI in this phase, ~400 LOC |
| Admin review queue UI | Medium | Table + detail view, ~250 LOC |
| User template list UI | Low | Reuses existing patterns, ~150 LOC |
| Notification on approve/reject | Low | 2 Notification.create calls, ~20 LOC |
| Worker startup seed call | Trivial | 1 import + 1 function call |

**Total estimated:** ~1,500 LOC across 3-4 plans.

---

## 11. File Inventory (Files to Create/Modify)

### New Files

| File | Purpose |
|------|---------|
| `src/lib/falldaten/seed-templates.ts` | Seed function for 10 STANDARD templates |
| `src/app/api/falldaten-templates/route.ts` | GET (list) + POST (create) |
| `src/app/api/falldaten-templates/[id]/route.ts` | GET (detail) + PATCH (edit) + DELETE |
| `src/app/api/falldaten-templates/[id]/einreichen/route.ts` | POST submit for review |
| `src/app/api/falldaten-templates/[id]/genehmigen/route.ts` | POST approve (admin) |
| `src/app/api/falldaten-templates/[id]/ablehnen/route.ts` | POST reject (admin) |
| `src/app/(dashboard)/falldaten-templates/page.tsx` | User template list |
| `src/app/(dashboard)/falldaten-templates/neu/page.tsx` | Template builder |
| `src/app/(dashboard)/admin/falldaten-templates/page.tsx` | Admin review queue |
| `src/app/(dashboard)/admin/falldaten-templates/[id]/page.tsx` | Admin template detail/review |
| `src/lib/falldaten/validation.ts` | Shared Zod schemas for template validation |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `FalldatenTemplateStatus` enum + `FalldatenTemplate` model + optional FK on Akte |
| `src/worker.ts` | Import and call `seedFalldatenTemplates()` at startup |
| `src/app/(dashboard)/admin/layout.tsx` | Add "Falldaten" nav item |

### Unchanged (Deferred to Phase 29)

| File | Why Unchanged |
|------|---------------|
| `src/lib/falldaten-schemas.ts` | Remains as seed data source; runtime usage replaced in Phase 29 |
| `src/components/akten/falldaten-form.tsx` | Form rendering changes in Phase 29 |
| `src/app/api/akten/[id]/route.ts` | Template assignment to Akte is Phase 29 |

---

## 12. Implementation Sequence Recommendation

**Plan 1 -- Schema + Seed:** Prisma schema (enum, model, Akte FK), migration, seed function, worker integration. Produces the data foundation.

**Plan 2 -- API Routes + Validation:** All 8 API route files + Zod validation. Template CRUD + workflow transitions. Produces the functional backend.

**Plan 3 -- Template Builder + Admin UI:** User-facing template builder page (Gruppen-first form), admin review queue, admin detail view, user template list. Notification on approve/reject. Produces the user-facing deliverables that prove the success criteria.

---

*Phase: 28-falldatenblaetter-schema-templates*
*Research completed: 2026-02-28*
