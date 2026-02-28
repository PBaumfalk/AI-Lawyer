# Phase 29: Falldatenblaetter UI - Research

**Researched:** 2026-02-28
**Domain:** React form rendering, tab integration, completeness tracking
**Confidence:** HIGH (all integration points verified against live codebase)

## Summary

Phase 29 renders Falldatenblatt templates (created in Phase 28) as interactive forms inside the Akte detail view. The existing `FalldatenForm` component (`src/components/akten/falldaten-form.tsx`, 236 LOC) already handles 7 of 8 field types, grouped rendering, save-via-PATCH, and dirty-state tracking. It needs to be extended with: (1) a `multiselect` renderer, (2) completeness calculation, (3) template auto-assignment logic, (4) integration into `akte-detail-tabs.tsx` as a new "Falldaten" tab.

The API layer is nearly complete. The PATCH `/api/akten/[id]` already accepts `falldaten` JSON but does NOT yet accept `falldatenTemplateId` -- that must be added to the Zod schema. The GET `/api/falldaten-templates` supports `?sachgebiet=X&status=STANDARD` filtering, which is exactly what the auto-assignment logic needs. The Prisma `Akte` model already has the `falldatenTemplateId` FK in place from Phase 28.

**Primary recommendation:** Extend the existing `FalldatenForm` rather than rebuilding. Add a wrapper `FalldatenTab` component that manages template resolution and assignment, then embed the form inside it. The completeness calculation should be client-side (count filled required fields from current form state), updated reactively on every field change.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- New "Falldaten" tab in akte-detail-tabs.tsx, alongside Feed, Dokumente, Kalender, Finanzen
- Tab is always visible, even when no template is assigned yet (shows empty state with action to assign)
- Completeness shown as badge in tab trigger: "Falldaten (75%)"
- Additionally: progress bar inside the form header showing "X von Y Pflichtfelder"
- Completeness only visible within the Falldaten tab (not in Akte header or Akten-Liste)
- Auto-assign STANDARD template by Sachgebiet when user first opens the Falldaten tab
- If multiple GENEHMIGT templates exist for the Sachgebiet: auto-assign STANDARD first, "Template wechseln" button shows alternatives
- Template assignment only happens in the Falldaten tab, not during Akte creation
- On template switch: warning dialog, existing data preserved in JSON (non-matching fields stay in storage but aren't rendered)
- Only required fields count toward completeness percentage
- Display format: "75% (6/8 Pflichtfelder)"
- Empty required fields get a subtle visual highlight (colored border)
- No filter/sort by empty fields -- fields render in template-defined group order
- Manual save with explicit Speichern button + dirty-state "Ungespeichert" badge
- Type-level validation only (number/date), no required-field blocking on save
- Soft warning on save if required fields are empty (toast or inline hint, not blocking)
- Unsaved changes guard: warning dialog on tab-switch/navigation when dirty state exists
- Multiselect field type rendered as checkbox group (new renderer)
- Form saves via PATCH /api/akten/[id] with `falldaten` JSON payload (keep existing pattern)
- Template auto-assignment sets `falldatenTemplateId` on Akte via PATCH endpoint
- Tab badge updates reactively as user fills in fields (client-side calculation, not API)

### Claude's Discretion
- Exact glass UI styling for form groups (follow existing FalldatenForm pattern with backdrop-blur cards)
- Loading skeleton design for tab content
- Empty state illustration/messaging when no template assigned
- Exact unsaved-changes dialog wording and styling
- Progress bar color scheme for completeness (likely emerald gradient)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FD-01 | User can view and fill out a Falldatenblatt for an Akte based on its Sachgebiet | Existing FalldatenForm handles 7/8 field types + groups + save. Needs multiselect renderer, template resolution from DB instead of static schemas, template auto-assignment. AkteData interface needs `falldatenTemplateId` added. |
| FD-02 | User can see completeness percentage for each Falldatenblatt on an Akte | Client-side calculation: count filled required fields / total required fields. Display in tab trigger badge + progress bar in form header. Reactive update on field change via React state. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (useState/useCallback/useMemo) | 18+ | Form state, completeness calc, dirty tracking | Already used in FalldatenForm |
| Next.js App Router | 14+ | Server component data loading, client component tabs | Project standard |
| Zod | 3.x | Extend updateAkteSchema to accept falldatenTemplateId | Already used in PATCH endpoint |
| sonner (toast) | 1.7+ | Save feedback, soft warnings on empty required fields | Already used across Akte components |
| shadcn/ui AlertDialog | @radix-ui/react-alert-dialog | Template switch warning, unsaved changes dialog | Already installed and used in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | existing | Icons (FileSpreadsheet, Save, Loader2, AlertTriangle, CheckCircle2) | Form header, save button, completeness indicators |
| @/components/ui/badge | existing | Tab trigger completeness badge, "Ungespeichert" badge | Tab trigger + form header |
| @/components/ui/glass-card | existing | Group container styling | Wrap each field group |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side completeness | Server-side completeness via API | Adds latency per keystroke; client-side is simpler and reactive |
| Custom checkbox group | @radix-ui/react-checkbox | Already have native checkbox in FalldatenFeldInput; checkbox group is simple enough without Radix |
| react-hook-form | Manual useState form | Existing form uses useState pattern; switching to RHF would be inconsistent with codebase |

**Installation:**
```bash
# No new packages needed -- zero new npm packages rule (v0.2 decision, continues into v0.3)
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/akten/
│   ├── falldaten-tab.tsx         # NEW: Tab wrapper (template resolution, assignment, completeness)
│   ├── falldaten-form.tsx        # MODIFIED: Add multiselect renderer, completeness props, required highlight
│   └── akte-detail-tabs.tsx      # MODIFIED: Add Falldaten TabsTrigger + TabsContent
├── app/api/akten/[id]/
│   └── route.ts                  # MODIFIED: Add falldatenTemplateId to updateAkteSchema
└── lib/falldaten/
    └── validation.ts             # EXISTING: Has multiselect type already defined
```

### Pattern 1: Tab Wrapper Component (FalldatenTab)
**What:** A container component that handles template resolution, auto-assignment, and renders the form.
**When to use:** When tab content requires data fetching and state management beyond what the parent tab container provides.
**Example:**
```typescript
// src/components/akten/falldaten-tab.tsx
interface FalldatenTabProps {
  akteId: string;
  sachgebiet: string;
  initialFalldaten: Record<string, any> | null;
  falldatenTemplateId: string | null;
}

export function FalldatenTab({ akteId, sachgebiet, initialFalldaten, falldatenTemplateId }: FalldatenTabProps) {
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: fetch template by ID or auto-assign STANDARD for sachgebiet
  useEffect(() => {
    if (falldatenTemplateId) {
      fetchTemplate(falldatenTemplateId);
    } else {
      autoAssignTemplate(sachgebiet);
    }
  }, []);

  // Auto-assign: GET /api/falldaten-templates?sachgebiet=X&status=STANDARD
  // Then PATCH /api/akten/[id] with { falldatenTemplateId }
}
```

### Pattern 2: Client-Side Completeness Calculation
**What:** Compute completeness from form state using useMemo, not API calls.
**When to use:** Completeness must update reactively per keystroke.
**Example:**
```typescript
const completeness = useMemo(() => {
  if (!template?.schema?.felder) return { percent: 0, filled: 0, total: 0 };
  const requiredFields = template.schema.felder.filter((f: any) => f.required);
  const total = requiredFields.length;
  if (total === 0) return { percent: 100, filled: 0, total: 0 };
  const filled = requiredFields.filter((f: any) => {
    const val = data[f.key];
    if (val === null || val === undefined || val === "") return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  }).length;
  return { percent: Math.round((filled / total) * 100), filled, total };
}, [data, template]);
```

### Pattern 3: Unsaved Changes Guard
**What:** Prevent data loss when navigating away from dirty form.
**When to use:** Tab-switch and browser navigation with unsaved form state.
**Example:**
```typescript
// Browser beforeunload for hard navigation
useEffect(() => {
  const handler = (e: BeforeUnloadEvent) => {
    if (dirty) { e.preventDefault(); }
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}, [dirty]);

// For tab-switch within Akte, use controlled Tabs + AlertDialog:
// Tabs must switch from defaultValue to controlled value/onValueChange
// onValueChange checks dirty state, shows AlertDialog if dirty
```

### Pattern 4: Template Switch with Data Preservation
**What:** When switching templates, existing falldaten JSON is preserved. Fields not in the new template stay in storage but aren't rendered.
**When to use:** User clicks "Template wechseln" and selects a different template.
**Example:**
```typescript
// On template switch:
// 1. Show AlertDialog warning
// 2. Update falldatenTemplateId via PATCH
// 3. Set new template in state
// 4. Do NOT clear data -- form only renders fields present in new template schema
// 5. Fields from old template that aren't in new template remain in data JSON
```

### Anti-Patterns to Avoid
- **Server-side completeness recalc on every save:** Adds unnecessary API complexity. Completeness is purely a display concern derived from client state.
- **Fetching template on every render:** Cache the template in component state after first fetch. Only re-fetch on explicit template switch.
- **Blocking save on empty required fields:** Decision says soft warning only (toast), NOT a blocking validation gate.
- **Resetting falldaten on template switch:** User explicitly decided to preserve data in JSON.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Alert dialog for unsaved changes | Custom modal div | shadcn/ui AlertDialog (already installed) | Handles focus trap, ESC close, portal, animation |
| Form field type validation | Manual regex/parse | HTML5 input type attributes (`type="number"`, `type="date"`) | Browser-native validation per user decision (type-level only) |
| Progress bar | Custom div width animation | Simple div with dynamic width style + Tailwind | No shadcn/ui Progress component exists; a styled div is fine |
| Checkbox group for multiselect | Custom state management | Array state with standard checkboxes | Simple pattern, no library needed |

**Key insight:** This phase is mostly composition of existing pieces (FalldatenForm + template API + tab integration). The complexity is in state coordination, not UI primitives.

## Common Pitfalls

### Pitfall 1: Type Mismatch Between Old and New Schema Types
**What goes wrong:** `FalldatenForm` imports `FalldatenFeld` from `falldaten-schemas.ts` which has `FalldatenFeldTyp` (7 types, no `multiselect`). But DB templates use `FalldatenFeldTypDB` from `validation.ts` (8 types, includes `multiselect`).
**Why it happens:** Phase 28 introduced `multiselect` in the DB validation schema but the legacy static schema types were not updated.
**How to avoid:** The `FalldatenForm` and `FalldatenFeldInput` components must accept the DB schema type (`FalldatenFeldTypDB` or equivalent) instead of the old `FalldatenFeldTyp`. Either update the import or create a unified type.
**Warning signs:** TypeScript errors on template fields with `typ: "multiselect"`.

### Pitfall 2: PATCH Endpoint Missing falldatenTemplateId
**What goes wrong:** Auto-assignment tries to PATCH `{ falldatenTemplateId: "xxx" }` but the Zod schema in `/api/akten/[id]/route.ts` doesn't include it, returning 400.
**Why it happens:** Phase 28 added the Prisma field but didn't update the PATCH Zod schema.
**How to avoid:** Add `falldatenTemplateId: z.string().nullable().optional()` to `updateAkteSchema` in the route file.
**Warning signs:** 400 error on template auto-assignment.

### Pitfall 3: Tab-Switch Dirty Guard Requires Controlled Tabs
**What goes wrong:** `akte-detail-tabs.tsx` uses `<Tabs defaultValue="feed">` (uncontrolled). To intercept tab changes and show a warning dialog, tabs must be controlled (`value` + `onValueChange`).
**Why it happens:** Current tab implementation is uncontrolled -- clicking a tab immediately switches.
**How to avoid:** Convert to controlled mode: `const [activeTab, setActiveTab] = useState("feed")` and use `<Tabs value={activeTab} onValueChange={handleTabChange}>`. The custom Tabs component already supports `value` + `onValueChange` props.
**Warning signs:** Tab switches without unsaved-changes warning even when form is dirty.

### Pitfall 4: AkteData Interface Missing Fields
**What goes wrong:** The `AkteData` interface in `akte-detail-tabs.tsx` has `falldaten: Record<string, any> | null` but no `falldatenTemplateId` or `sachgebiet` (sachgebiet IS there -- verified). The `FalldatenTab` needs both.
**Why it happens:** AkteData was defined before Phase 28 added the template FK.
**How to avoid:** Add `falldatenTemplateId: string | null` to `AkteData`. Verify `sachgebiet` is already present (confirmed: line 18 of akte-detail-tabs.tsx).
**Warning signs:** TypeScript errors when passing akte data to FalldatenTab.

### Pitfall 5: SONSTIGES Sachgebiet Has No Template
**What goes wrong:** Akten with `sachgebiet: "SONSTIGES"` have no seed template. Auto-assignment finds nothing, user sees empty state indefinitely.
**Why it happens:** The seed only creates templates for the 10 named Sachgebiete, not SONSTIGES.
**How to avoid:** Handle the "no template found" case gracefully in the empty state. Show a message like "Fuer dieses Sachgebiet ist kein Standardtemplate verfuegbar" with option to manually select from available templates.
**Warning signs:** Empty state with no path forward for SONSTIGES Akten.

### Pitfall 6: Akte Detail Page Doesn't Fetch falldatenTemplateId
**What goes wrong:** The server component `akten/[id]/page.tsx` fetches the Akte but doesn't include `falldatenTemplateId` in the serialized data. Tab has no way to know if template is already assigned.
**Why it happens:** The Prisma include doesn't select `falldatenTemplateId` explicitly (it's a scalar, so it IS included by default in `findUnique`), but the `AkteData` TypeScript interface doesn't type it.
**How to avoid:** Prisma `findUnique` returns all scalar fields by default, so `falldatenTemplateId` IS in the JSON. Just update the `AkteData` interface to include it.
**Warning signs:** TypeScript errors, but runtime data is actually present.

## Code Examples

### Multiselect Field Renderer (Checkbox Group)
```typescript
// Source: Verified pattern from existing FalldatenFeldInput in falldaten-form.tsx
{feld.typ === "multiselect" && feld.optionen && (
  <div className="space-y-2">
    {feld.optionen.map((opt) => (
      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={Array.isArray(value) && value.includes(opt.value)}
          onChange={(e) => {
            const current = Array.isArray(value) ? value : [];
            onChange(
              e.target.checked
                ? [...current, opt.value]
                : current.filter((v: string) => v !== opt.value)
            );
          }}
          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
        />
        <span className="text-sm text-muted-foreground">{opt.label}</span>
      </label>
    ))}
  </div>
)}
```

### Template Auto-Assignment Flow
```typescript
// Source: Verified against GET /api/falldaten-templates API (route.ts lines 25-109)
async function autoAssignTemplate(akteId: string, sachgebiet: string) {
  // 1. Fetch STANDARD template for this Sachgebiet
  const res = await fetch(
    `/api/falldaten-templates?sachgebiet=${sachgebiet}&status=STANDARD`
  );
  const { templates } = await res.json();

  if (templates.length === 0) {
    // No template available -- show empty state
    return null;
  }

  const template = templates[0];

  // 2. Assign template to Akte via PATCH
  await fetch(`/api/akten/${akteId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ falldatenTemplateId: template.id }),
  });

  return template;
}
```

### Completeness Badge in Tab Trigger
```typescript
// Source: Pattern from akte-detail-tabs.tsx line 97-99 (Dokumente count badge)
<TabsTrigger value="falldaten">
  Falldaten {completeness.total > 0 ? `(${completeness.percent}%)` : ""}
</TabsTrigger>
```

### Required Field Highlight
```typescript
// Source: Derived from existing FalldatenFeldInput styling patterns
const isRequiredEmpty = feld.required && (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0));

<Input
  className={cn(
    "h-9 text-sm",
    isRequiredEmpty && "border-amber-300 dark:border-amber-700"
  )}
/>
```

### Extend PATCH Zod Schema
```typescript
// Source: Verified against src/app/api/akten/[id]/route.ts lines 7-21
const updateAkteSchema = z.object({
  // ... existing fields ...
  falldaten: z.record(z.any()).nullable().optional(),
  falldatenTemplateId: z.string().nullable().optional(), // NEW
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static TS schemas in falldaten-schemas.ts | DB-backed FalldatenTemplate model with JSON schema | Phase 28 (2026-02-28) | Form must read schema from template, not static registry |
| 7 field types (no multiselect) | 8 field types (includes multiselect) | Phase 28 | FalldatenFeldInput needs multiselect renderer |
| No template assignment on Akte | Akte.falldatenTemplateId FK exists | Phase 28 migration | Must manage assignment lifecycle |

**Deprecated/outdated:**
- `falldaten-schemas.ts` static registry: Still in codebase but templates now come from DB. The static file can remain for backward compatibility but the form should read from the template's `schema` JSON, not from `getFalldatenSchema()`.
- `FalldatenFeldTyp` type (7 types): Superseded by `FalldatenFeldTypDB` (8 types including multiselect).

## Open Questions

1. **Template switch: fetch all alternatives or just GENEHMIGT?**
   - What we know: CONTEXT says "show alternatives" via Template wechseln button. GET API supports `?sachgebiet=X` and `?status=GENEHMIGT`.
   - What's unclear: Should we show both STANDARD and GENEHMIGT alternatives, or only GENEHMIGT (since STANDARD is already auto-assigned)?
   - Recommendation: Fetch both STANDARD and GENEHMIGT for the Sachgebiet, exclude the currently-assigned template from the list. This gives users access to all approved options.

2. **Completeness percentage lifting to tab trigger**
   - What we know: Tab badge must show percentage, but form state lives inside FalldatenTab (child of TabsContent). TabsTrigger is a sibling, not a descendant.
   - What's unclear: How to lift completeness state.
   - Recommendation: Lift completeness state to `akte-detail-tabs.tsx` via a callback prop or shared state in the tab container. The FalldatenTab calls `onCompletenessChange(percent)` which updates state in the parent, rendered in the TabsTrigger.

3. **What happens when Akte sachgebiet changes after template is assigned?**
   - What we know: Users can change Akte sachgebiet. This could orphan the template assignment.
   - What's unclear: Should template be reassigned automatically?
   - Recommendation: Out of scope for this phase. Template stays assigned even if sachgebiet changes. User can manually switch templates via "Template wechseln".

## Sources

### Primary (HIGH confidence)
- Live codebase analysis: `src/components/akten/falldaten-form.tsx` (236 LOC) -- full form implementation verified
- Live codebase analysis: `src/components/akten/akte-detail-tabs.tsx` (152 LOC) -- tab structure verified
- Live codebase analysis: `src/app/api/akten/[id]/route.ts` (210 LOC) -- PATCH schema verified, falldatenTemplateId missing
- Live codebase analysis: `src/app/api/falldaten-templates/route.ts` (172 LOC) -- GET with sachgebiet+status filter verified
- Live codebase analysis: `prisma/schema.prisma` -- Akte.falldatenTemplateId FK and FalldatenTemplate model verified
- Live codebase analysis: `src/lib/falldaten/validation.ts` (58 LOC) -- 8 field types including multiselect verified
- Live codebase analysis: `src/components/ui/tabs.tsx` -- custom Tabs supports controlled mode (value + onValueChange)
- Live codebase analysis: `src/components/ui/alert-dialog.tsx` -- Radix AlertDialog available
- Live codebase analysis: `src/components/ui/glass-card.tsx` -- GlassCard component with default/elevated variants

### Secondary (MEDIUM confidence)
- Phase 28 research (`28-RESEARCH.md`) -- scope boundaries and data model decisions

### Tertiary (LOW confidence)
- None -- all findings verified against live codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use across the project
- Architecture: HIGH -- extending existing components with well-understood patterns
- Pitfalls: HIGH -- all integration gaps verified by reading source code

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable -- internal codebase, no external dependency changes expected)
