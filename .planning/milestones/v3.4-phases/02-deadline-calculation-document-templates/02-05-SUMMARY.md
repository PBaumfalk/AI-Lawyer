---
phase: 02-deadline-calculation-document-templates
plan: 05
subsystem: ui
tags: [vorlagen, briefkopf, pdf-export, einstellungen, fristen-settings, ordner-schemata, benachrichtigungen, audit-trail, card-browser, wizard]

# Dependency graph
requires:
  - phase: 02-04
    provides: "Template engine, Briefkopf API, OrdnerSchema API, Freigabe workflow, Vorlagen CRUD"
  - phase: 02-03
    provides: "OnlyOffice integration, document versioning, PDF conversion API"
  - phase: 01-infrastructure-foundation
    provides: "Prisma schema, MinIO storage, auth, audit logging, settings import/export"
provides:
  - "Card-based Vorlagen browser with search, categories, favorites, Zuletzt verwendet"
  - "4-step document generation wizard (template -> Akte -> custom fields -> preview)"
  - "Placeholder sidebar with copy-to-clipboard organized by group"
  - "Briefkopf structured form editor with logo upload and live preview"
  - "PDF export dialog with Briefkopf selection, PDF/A format, and watermark"
  - "Kanzlei-Einstellungen with 5 new admin tabs (Fristen, Vorlagen, Briefkoepfe, Ordner-Schemata, Benachrichtigungen)"
  - "All settings tabs with auto-save, audit-trail logging, and reset-to-default"
affects: [02-06-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Card-based template browser pattern with localStorage for recent items"
    - "4-step wizard pattern for multi-stage document generation"
    - "Placeholder sidebar pattern: grouped, searchable, click-to-copy with toast"
    - "Settings tab pattern: auto-save via import API, reset-to-default with confirmation dialog"
    - "All settings changes logged in Audit-Trail via /api/einstellungen/import endpoint"

key-files:
  created:
    - "src/app/(dashboard)/vorlagen/page.tsx"
    - "src/components/vorlagen/vorlagen-uebersicht.tsx"
    - "src/components/vorlagen/vorlagen-wizard.tsx"
    - "src/components/vorlagen/platzhalter-sidebar.tsx"
    - "src/components/briefkopf/briefkopf-editor.tsx"
    - "src/components/briefkopf/pdf-export-dialog.tsx"
    - "src/components/einstellungen/fristen-tab.tsx"
    - "src/components/einstellungen/vorlagen-tab.tsx"
    - "src/components/einstellungen/briefkopf-tab.tsx"
    - "src/components/einstellungen/ordner-schemata-tab.tsx"
    - "src/components/einstellungen/benachrichtigungen-tab.tsx"
  modified:
    - "src/app/(dashboard)/einstellungen/page.tsx"
    - "src/lib/audit.ts"

key-decisions:
  - "LocalStorage for Zuletzt verwendet tracking (no server-side persistence needed)"
  - "Settings auto-save via /api/einstellungen/import endpoint (reuses existing infrastructure)"
  - "Benachrichtigungen as admin-only stub with Phase 3 email notice"
  - "Briefkopf OnlyOffice mode as informational placeholder (save in form mode first)"

patterns-established:
  - "Settings tab pattern: glass card sections, auto-save on change, reset-to-default button at bottom"
  - "Wizard dialog pattern: right-side panel, step indicator bar, next/back navigation"

requirements-completed: [REQ-DV-001, REQ-DV-002, REQ-DV-003, REQ-DV-009]

# Metrics
duration: 9min
completed: 2026-02-24
---

# Phase 2 Plan 5: Vorlagen UI + Kanzlei-Einstellungen Summary

**Card-based template browser with 4-step generation wizard, Briefkopf editor with live preview, PDF export dialog, and 5 admin settings tabs with auto-save and audit-trail**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-24T11:07:59Z
- **Completed:** 2026-02-24T11:17:22Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Vorlagen page at /vorlagen with card-based overview showing search, category filter pills, favorites (heart toggle), and Zuletzt verwendet (localStorage)
- 4-step document generation wizard: select template -> select Akte -> fill custom fields -> preview with filename/Briefkopf/OnlyOffice toggle
- Placeholder sidebar listing all available placeholders grouped by Akte/Mandant/Gegner/etc with click-to-copy and toast
- Briefkopf editor with structured form (all fields), logo drag-and-drop, live preview, and OnlyOffice mode toggle
- PDF export dialog with Briefkopf selection, PDF/A checkbox, and watermark text input
- 5 new Kanzlei-Einstellungen tabs: Fristen (Vorfristen/Bundesland/Presets/Eskalation/Arbeitszeiten), Vorlagen (Freigabe management), Briefkoepfe (CRUD with BriefkopfEditor), Ordner-Schemata (folder management with reordering), Benachrichtigungen (admin-only stub)
- All settings auto-save on change, all saves logged via Audit-Trail, each tab has reset-to-default with confirmation dialog

## Task Commits

Each task was committed atomically:

1. **Task 1: Vorlagen UI + Briefkopf Editor + PDF Export** - `b3c71f2` (feat)
2. **Task 2: Kanzlei-Einstellungen Tabs** - `bdfcaa1` (feat)

## Files Created/Modified
- `src/app/(dashboard)/vorlagen/page.tsx` - Vorlagen page route at /vorlagen
- `src/components/vorlagen/vorlagen-uebersicht.tsx` - Card-based template browser with search, categories, favorites, Zuletzt verwendet
- `src/components/vorlagen/vorlagen-wizard.tsx` - 4-step document generation wizard
- `src/components/vorlagen/platzhalter-sidebar.tsx` - Placeholder sidebar with grouped copy-to-clipboard
- `src/components/briefkopf/briefkopf-editor.tsx` - Briefkopf editor with structured form and live preview
- `src/components/briefkopf/pdf-export-dialog.tsx` - PDF export dialog with Briefkopf/PDF-A/watermark
- `src/components/einstellungen/fristen-tab.tsx` - Fristen settings (Vorfristen, Bundesland, presets, escalation)
- `src/components/einstellungen/vorlagen-tab.tsx` - Vorlagen settings with Freigabe management
- `src/components/einstellungen/briefkopf-tab.tsx` - Briefkopf settings with CRUD
- `src/components/einstellungen/ordner-schemata-tab.tsx` - Ordner-Schemata settings with folder reordering
- `src/components/einstellungen/benachrichtigungen-tab.tsx` - Benachrichtigungen stub (admin-only)
- `src/app/(dashboard)/einstellungen/page.tsx` - Updated with 5 new admin tabs
- `src/lib/audit.ts` - Added EINSTELLUNG_GEAENDERT and EINSTELLUNG_ZURUECKGESETZT audit types

## Decisions Made
- Used localStorage for "Zuletzt verwendet" template tracking instead of server-side persistence -- lightweight, user-specific, no API needed
- Settings auto-save via existing /api/einstellungen/import endpoint -- reuses audit logging already built in Phase 1
- Benachrichtigungen tab is admin-only stub per locked decision, with email feature deferred to Phase 3
- Briefkopf OnlyOffice mode shows informational placeholder -- users save in form mode first, then can open DOCX in OnlyOffice

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Lucide icon title prop TypeScript error**
- **Found during:** Task 1 (Vorlagen overview component)
- **Issue:** Lucide icons do not accept `title` prop directly in current version
- **Fix:** Wrapped icon in `<span title="...">` element
- **Files modified:** src/components/vorlagen/vorlagen-uebersicht.tsx
- **Verification:** tsc --noEmit passes cleanly
- **Committed in:** b3c71f2 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor TypeScript compatibility fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Vorlagen UI components complete and ready for use
- Kanzlei-Einstellungen has all required admin tabs
- Phase 2 Plan 6 (already completed) provides the remaining backend integration
- Phase 2 is now complete with all 6 plans delivered

## Self-Check: PASSED

All 13 files verified present on disk. Both task commits (b3c71f2, bdfcaa1) verified in git log.

---
*Phase: 02-deadline-calculation-document-templates*
*Completed: 2026-02-24*
