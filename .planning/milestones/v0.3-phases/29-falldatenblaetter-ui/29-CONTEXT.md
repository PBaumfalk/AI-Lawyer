# Phase 29: Falldatenblaetter UI - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can view, fill out, and track completeness of Falldatenblaetter directly within an Akte detail view. Phase 28 delivered the template system (CRUD, approval workflow, seed migration). This phase renders templates as interactive forms inside Akte, with completeness tracking.

Requirements: FD-01 (view and fill out), FD-02 (completeness percentage).

</domain>

<decisions>
## Implementation Decisions

### Placement in Akte
- New "Falldaten" tab in akte-detail-tabs.tsx, alongside Feed, Dokumente, Kalender, Finanzen
- Tab is always visible, even when no template is assigned yet (shows empty state with action to assign)
- Completeness shown as badge in tab trigger (like Dokumente count pattern): "Falldaten (75%)"
- Additionally: progress bar inside the form header showing "X von Y Pflichtfelder"
- Completeness only visible within the Falldaten tab (not in Akte header or Akten-Liste)

### Template Assignment
- Auto-assign STANDARD template by Sachgebiet when user first opens the Falldaten tab
- If multiple GENEHMIGT templates exist for the Sachgebiet: auto-assign STANDARD first, "Template wechseln" button shows alternatives
- Template assignment only happens in the Falldaten tab, not during Akte creation (Akte-Erstellen flow unchanged)
- On template switch: warning dialog, existing data preserved in JSON (fields that don't exist in new template stay in storage but aren't rendered)

### Completeness Calculation
- Only required fields (required=true) count toward completeness percentage
- Display format: "75% (6/8 Pflichtfelder)" — both percent and absolute count
- Empty required fields get a subtle visual highlight (colored border) — not aggressive, but visible
- No filter/sort by empty fields — fields render in template-defined group order

### Form Behavior
- Manual save with explicit Speichern button + dirty-state "Ungespeichert" badge (matches existing FalldatenForm pattern)
- Type-level validation only (number fields accept only numbers, date fields only dates) — no required-field blocking on save
- Soft warning on save if required fields are empty (toast or inline hint, not blocking)
- Unsaved changes guard: warning dialog on tab-switch/navigation when dirty state exists
- Multiselect field type rendered as checkbox group (new renderer needed — existing FalldatenForm handles 7 of 8 types)

### Claude's Discretion
- Exact glass UI styling for the form groups (follow existing FalldatenForm pattern with backdrop-blur cards)
- Loading skeleton design for tab content
- Empty state illustration/messaging when no template assigned
- Exact unsaved-changes dialog wording and styling
- Progress bar color scheme for completeness (likely emerald gradient)

</decisions>

<specifics>
## Specific Ideas

- Existing FalldatenForm component (`src/components/akten/falldaten-form.tsx`) is a strong starting point — has group rendering, 7 field type renderers, save logic, dirty state
- Form currently saves via PATCH /api/akten/[id] with `falldaten` JSON payload — keep this pattern
- Template auto-assignment should set `falldatenTemplateId` on the Akte record via the same PATCH endpoint
- Tab badge should update reactively as user fills in fields (client-side calculation, not API)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FalldatenForm` component (src/components/akten/falldaten-form.tsx): Full form with group rendering, 7 field renderers (text, textarea, number, currency, date, select, boolean), save via PATCH, dirty state badge
- `FalldatenFeldInput` subcomponent: Individual field renderer — needs multiselect addition
- `akte-detail-tabs.tsx`: Tab container with TabsList/TabsTrigger/TabsContent pattern
- `FalldatenTemplate` Prisma model: schema (Json), sachgebiet, status fields
- `falldaten-schemas.ts`: Static TypeScript schemas (legacy, but type definitions still useful)
- `validation.ts`: Zod schemas for template validation including all 8 field types

### Established Patterns
- Tab content loaded as client components within TabsContent
- PATCH /api/akten/[id] handles falldaten JSON updates + audit logging
- Glass UI cards: `bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20`
- Badge component for status indicators (from shadcn/ui)
- Toast notifications via sonner for save feedback
- AkteData interface in akte-detail-tabs.tsx includes `falldaten: Record<string, any> | null`

### Integration Points
- `akte-detail-tabs.tsx` line 94: Add new TabsTrigger + TabsContent for Falldaten
- `AkteData` interface: Already has `falldaten` field, needs `falldatenTemplateId` added
- API route GET /api/akten/[id]: May need to include resolved template schema in response
- API route GET /api/falldaten-templates: Can fetch available templates for Sachgebiet
- Akte Prisma model: Has `falldatenTemplateId` FK ready (from Phase 28)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-falldatenblaetter-ui*
*Context gathered: 2026-02-28*
