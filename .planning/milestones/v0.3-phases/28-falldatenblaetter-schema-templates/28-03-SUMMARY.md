---
phase: 28-falldatenblaetter-schema-templates
plan: "03"
subsystem: ui
tags: [next-app-router, react, falldaten, templates, template-builder, admin-review, glass-ui, sonner]

# Dependency graph
requires:
  - phase: 28-02
    provides: REST API routes for template CRUD, workflow transitions, and notifications
  - phase: 28-01
    provides: FalldatenTemplate Prisma model, Zod validation schemas, FalldatenFeldTypDB type
provides:
  - User template list page with status badges and ownership-aware actions
  - Gruppen-first template builder with all 8 field types
  - Template edit page with pre-population from existing schema
  - Admin review queue with EINGEREICHT table and decision history
  - Admin template detail page with full schema preview and approve/reject actions
  - Admin nav wiring for Falldaten-Templates
affects: [29 Akte-detail form rendering, future template-based Akte creation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared TemplateBuilder component reused by new/edit pages with props-based mode switching"
    - "Auto-slugify field keys from German labels with umlaut transliteration (ae/oe/ue/ss)"
    - "BuilderGroup/BuilderField state model with inline field editor sub-component"
    - "Status badge styles as Record<Status, className> for consistent badge rendering"

key-files:
  created:
    - src/components/falldaten-templates/template-builder.tsx
    - src/app/(dashboard)/falldaten-templates/page.tsx
    - src/app/(dashboard)/falldaten-templates/neu/page.tsx
    - src/app/(dashboard)/falldaten-templates/[id]/bearbeiten/page.tsx
    - src/app/(dashboard)/admin/falldaten-templates/page.tsx
    - src/app/(dashboard)/admin/falldaten-templates/[id]/page.tsx
  modified:
    - src/app/(dashboard)/admin/layout.tsx

key-decisions:
  - "Extracted shared TemplateBuilder component to avoid code duplication between new/edit pages -- props control mode (create vs edit), labels, and save behavior"
  - "Used inline field editor (not modal) for adding/editing fields within groups -- more discoverable UX for complex form builder"

patterns-established:
  - "Gruppen-first builder: user creates groups, then adds fields within groups -- matches CONTEXT.md decision"
  - "fieldsToGroups() reconstruction: converts flat felder array (with gruppe property) back to BuilderGroup[] for edit page pre-population"

requirements-completed: [FD-03, FD-04, FD-05, FD-06]

# Metrics
duration: 6min
completed: 2026-02-28
---

# Phase 28 Plan 03: Template UI Summary

**Gruppen-first template builder with 8 field types, user template list with status badges, and admin review queue with approve/reject workflow**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-28T17:27:35Z
- **Completed:** 2026-02-28T17:33:47Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Complete user-facing template management: list, create, edit, submit for review
- Gruppen-first template builder supporting all 8 field types with inline field editor, auto-slugified keys, and options management
- Admin review workflow: queue of EINGEREICHT templates, full schema preview, approve/reject with reason
- Admin nav wired with "Falldaten" item between Muster and Dezernate
- Shared TemplateBuilder component eliminates duplication between new/edit pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Create user template list + admin nav + admin review queue** - `acefc32` (feat)
2. **Task 2: Create Gruppen-first template builder + edit page + admin detail/review page** - `cff6a23` (feat)

## Files Created/Modified
- `src/components/falldaten-templates/template-builder.tsx` - Shared builder with groups, fields, inline editor, options, auto-slugify
- `src/app/(dashboard)/falldaten-templates/page.tsx` - User template list with status badges and ownership-aware actions
- `src/app/(dashboard)/falldaten-templates/neu/page.tsx` - New template page using shared builder
- `src/app/(dashboard)/falldaten-templates/[id]/bearbeiten/page.tsx` - Edit page with schema pre-population via fieldsToGroups()
- `src/app/(dashboard)/admin/falldaten-templates/page.tsx` - Admin review queue with pending table and decision history
- `src/app/(dashboard)/admin/falldaten-templates/[id]/page.tsx` - Admin detail with schema preview and approve/reject actions
- `src/app/(dashboard)/admin/layout.tsx` - Added "Falldaten" nav item

## Decisions Made
- Extracted TemplateBuilder as shared component in `src/components/falldaten-templates/` rather than duplicating form logic -- props-based mode switching (saveLabel, onSave/onSaveAndSubmit, initialMetadata/Groups) keeps both pages DRY
- Used inline field editor (within group card) instead of modal dialogs for field editing -- simpler UX for the Gruppen-first builder approach

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in `src/lib/helena/index.ts` remain (unrelated to this work, documented in 28-01-SUMMARY.md)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All Phase 28 deliverables complete: DB model, seed, API routes, and UI
- Template creation and approval workflow fully functional end-to-end
- Ready for Phase 29: Akte-detail form rendering using templates from DB

## Self-Check: PASSED

All 7 files verified present. Both task commits (acefc32, cff6a23) verified in git log.

---
*Phase: 28-falldatenblaetter-schema-templates*
*Completed: 2026-02-28*
