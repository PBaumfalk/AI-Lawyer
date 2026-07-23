---
phase: 29-falldatenblaetter-ui
plan: "01"
subsystem: ui
tags: [react, forms, multiselect, falldaten, zod, completeness]

requires:
  - phase: 28-falldatenblaetter-schema-templates
    provides: FalldatenTemplate model, FalldatenFeldTypDB type with 8 field types, validation schemas
provides:
  - PATCH /api/akten/[id] accepts falldatenTemplateId for template assignment
  - FalldatenForm with multiselect renderer and required-field amber highlighting
  - Completeness calculation with onCompletenessChange callback for parent integration
  - onDirtyChange callback for unsaved changes guard
  - TemplateSchema/TemplateField interfaces matching DB template shape
  - AkteData interface with falldatenTemplateId field
affects: [29-02-PLAN, falldaten-tab-integration]

tech-stack:
  added: []
  patterns: [TemplateField/TemplateSchema local interfaces for DB shape, completeness calculation via useMemo]

key-files:
  created: []
  modified:
    - src/app/api/akten/[id]/route.ts
    - src/components/akten/falldaten-form.tsx
    - src/components/akten/akte-detail-tabs.tsx

key-decisions:
  - "Used local TemplateField/TemplateSchema interfaces instead of importing from validation.ts to keep form decoupled from Zod schemas"
  - "Completeness tracks only required fields, returns 100% when no required fields exist"
  - "Multiselect and textarea both render full-width (md:col-span-2) for better UX"

patterns-established:
  - "onCompletenessChange callback pattern: form reports {percent, filled, total} to parent via useEffect"
  - "Required field highlighting: amber border (border-amber-300/700) on empty required fields"

requirements-completed: [FD-01]

duration: 2min
completed: 2026-02-28
---

# Phase 29 Plan 01: API + Form Enhancements Summary

**Extended PATCH API with falldatenTemplateId, added multiselect checkbox renderer and required-field amber highlighting with completeness tracking to FalldatenForm**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T20:47:34Z
- **Completed:** 2026-02-28T20:49:35Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- PATCH /api/akten/[id] now accepts falldatenTemplateId for template assignment to Akte
- FalldatenForm upgraded from legacy 7-type FalldatenSchema to DB-aware 8-type TemplateSchema (includes multiselect)
- Multiselect fields render as checkbox groups with correct array value state management
- Empty required fields display subtle amber border highlighting
- Completeness progress bar shows "X/Y Pflichtfelder" with emerald fill bar
- Soft warning toast on save when required fields remain empty
- onCompletenessChange and onDirtyChange callbacks ready for parent tab integration (Plan 29-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend PATCH API + AkteData interface for template assignment** - `03d1d7d` (feat)
2. **Task 2: Add multiselect renderer and required field highlighting to FalldatenForm** - `d85d176` (feat)

## Files Created/Modified
- `src/app/api/akten/[id]/route.ts` - Added falldatenTemplateId to updateAkteSchema Zod object
- `src/components/akten/falldaten-form.tsx` - Complete upgrade: TemplateSchema types, multiselect renderer, completeness tracking, amber highlighting, progress bar, callbacks
- `src/components/akten/akte-detail-tabs.tsx` - Added falldatenTemplateId to AkteData interface

## Decisions Made
- Used local TemplateField/TemplateSchema interfaces instead of importing from validation.ts -- keeps form component decoupled from Zod validation schemas while still using the FalldatenFeldTypDB type for the field type union
- Completeness calculation only tracks required fields; returns 100% when no required fields exist (prevents divide-by-zero and false warnings)
- Multiselect and textarea both render full-width (md:col-span-2) for better layout when options lists are long

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- FalldatenForm is ready for integration into the Akte detail Falldaten tab (Plan 29-02)
- onCompletenessChange callback is wired and ready for parent tab container to display completeness
- onDirtyChange callback ready for unsaved changes guard
- AkteData interface and PATCH API both support falldatenTemplateId for template selection

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 29-falldatenblaetter-ui*
*Completed: 2026-02-28*
