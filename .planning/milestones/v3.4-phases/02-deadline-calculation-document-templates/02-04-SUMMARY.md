---
phase: 02-deadline-calculation-document-templates
plan: 04
subsystem: document-templates
tags: [vorlagen, briefkopf, ordner-schemata, docxtemplater, template-engine, freigabe, versioning, document-generation]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation
    provides: "Prisma schema, MinIO storage, auth, audit logging"
  - phase: 02-03
    provides: "OnlyOffice integration, document versioning, status workflow, PDF conversion"
provides:
  - "Enhanced DokumentVorlage model with versioning, tags, Freigabe, customFelder, favorites"
  - "VorlageVersion model for template version history"
  - "Briefkopf model and CRUD API with default selection and logo/DOCX upload"
  - "OrdnerSchema model and CRUD API with Sachgebiet-based defaults"
  - "Template engine with conditional sections, loops, custom fields via docxtemplater"
  - "Briefkopf DOCX header/footer merge library"
  - "10-step document generation endpoint (template fill + Briefkopf + MinIO upload)"
  - "Freigabe workflow API: approve/revoke restricted to ADMIN/ANWALT"
  - "Vorlagen CRUD with versioning, tags, favorites, custom field definitions"
affects: [02-05-PLAN, 02-06-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PizZip filter() API for iterating DOCX ZIP entries (not forEach)"
    - "Full-template approach for Briefkopf: copy header/footer XML + media + rels from Briefkopf DOCX"
    - "Favorites via String[] favoritenVon field with userId-based toggle"
    - "Version snapshot on template update: VorlageVersion created before overwriting"
    - "Freigabe RBAC: FREIGABE_ROLES Set pattern for role-gated operations"

key-files:
  created:
    - "src/lib/briefkopf.ts"
    - "src/app/api/vorlagen/[id]/generieren/route.ts"
    - "src/app/api/vorlagen/[id]/freigabe/route.ts"
    - "src/app/api/briefkopf/route.ts"
    - "src/app/api/briefkopf/[id]/route.ts"
    - "src/app/api/ordner-schemata/route.ts"
  modified:
    - "prisma/schema.prisma"
    - "src/lib/vorlagen.ts"
    - "src/app/api/vorlagen/route.ts"
    - "src/app/api/vorlagen/[id]/route.ts"

key-decisions:
  - "Full-template Briefkopf approach: copy header/footer XML parts rather than injecting content into Briefkopf body"
  - "PizZip filter() instead of forEach() for DOCX ZIP entry iteration (forEach does not exist on PizZip)"
  - "fillDocxTemplate signature expanded to accept Record<string, unknown> for mixed data types (arrays for loops)"
  - "convertBufferToPdf simplified to accept download URL directly (no docxBuffer param needed)"
  - "OrdnerSchema defaults per Sachgebiet with fallback to general default"
  - "Auto-generated filename pattern: {Aktenzeichen}_{Kategorie}_{Mandant}_{Datum}.docx"

patterns-established:
  - "Template versioning: VorlageVersion snapshot created before each file update"
  - "Freigabe workflow: separate /freigabe endpoint with RBAC (ADMIN/ANWALT)"
  - "Favorites: String[] field with userId toggle via PATCH action"
  - "OrdnerSchema: per-Sachgebiet defaults with global fallback"
  - "Generation endpoint: load template + resolve placeholders + fill + briefkopf + upload + create Dokument"

requirements-completed: [REQ-DV-001, REQ-DV-002, REQ-DV-003, REQ-DV-008, REQ-DV-009]

# Metrics
duration: 8min
completed: 2026-02-24
---

# Phase 02 Plan 04: Vorlagen-System Backend Summary

**Template engine with conditionals/loops, Briefkopf DOCX merge, 10-step document generation, Freigabe workflow (ADMIN/ANWALT), and OrdnerSchema CRUD with Sachgebiet defaults**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-24T10:45:37Z
- **Completed:** 2026-02-24T10:53:37Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Enhanced DokumentVorlage schema with versioning, tags, Freigabe, custom fields, and favorites
- Built Briefkopf DOCX header/footer merge library using PizZip XML manipulation
- Created 10-step document generation endpoint that fills templates with case data and applies letterhead
- Implemented Freigabe workflow API with RBAC (only ADMIN/ANWALT can approve)
- Built Briefkopf CRUD API with logo upload, DOCX template upload, and default selection
- Built OrdnerSchema CRUD API with Sachgebiet-based defaults and global fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema + Enhanced Vorlagen Library + Briefkopf Library** - `fe01f23` (feat)
2. **Task 2: Vorlagen CRUD + Freigabe + Generation + Briefkopf + Ordner-Schemata APIs** - `9258e1e` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `prisma/schema.prisma` - Added VorlageVersion, Briefkopf, OrdnerSchema models; enhanced DokumentVorlage with versioning/tags/Freigabe/customFelder/favorites
- `src/lib/vorlagen.ts` - Enhanced fillDocxTemplate with conditional sections, loops, custom field merging; added toNestedData helper
- `src/lib/briefkopf.ts` - New: Briefkopf DOCX header/footer merge via PizZip; PDF conversion via OnlyOffice Conversion API
- `src/app/api/vorlagen/route.ts` - Enhanced GET with tags/freigegeben/favorites filtering; POST with tags/customFelder
- `src/app/api/vorlagen/[id]/route.ts` - Enhanced GET with versions; PUT with file versioning; PATCH with favorite toggle; DELETE with version cleanup
- `src/app/api/vorlagen/[id]/generieren/route.ts` - New: 10-step document generation from template with case data and Briefkopf
- `src/app/api/vorlagen/[id]/freigabe/route.ts` - New: POST approve / DELETE revoke with ADMIN/ANWALT RBAC
- `src/app/api/briefkopf/route.ts` - New: GET list / POST create with logo+DOCX upload
- `src/app/api/briefkopf/[id]/route.ts` - New: GET/PUT/PATCH(setDefault)/DELETE for individual Briefkopf
- `src/app/api/ordner-schemata/route.ts` - New: GET/POST/PUT/DELETE with Sachgebiet filtering and default per sachgebiet

## Decisions Made

- **Full-template Briefkopf approach:** Rather than injecting content into a Briefkopf body template, we copy header/footer XML parts + media + relationships from the Briefkopf DOCX into the target document. This preserves the target document's body content while applying the letterhead.
- **PizZip filter() API:** PizZip does not expose forEach on folder results. Used filter() with full path regex matching instead.
- **fillDocxTemplate expanded signature:** Changed data parameter from `Record<string, string>` to `Record<string, unknown>` to support arrays (for docxtemplater loops) and other types alongside string values.
- **OrdnerSchema per-Sachgebiet defaults:** Each Sachgebiet can have its own default folder schema, with fallback to a general default if no specific one exists.
- **Auto filename generation:** Pattern `{Aktenzeichen}_{Kategorie}_{Mandant}_{Datum}.docx` with sanitization, overridable via `dateiname` parameter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed PizZip forEach usage**
- **Found during:** Task 1 (Briefkopf library)
- **Issue:** PizZip does not expose forEach() method on folder results. TypeScript compilation failed.
- **Fix:** Used PizZip.filter() with full-path regex matching and typed callback parameters
- **Files modified:** src/lib/briefkopf.ts
- **Verification:** npx tsc --noEmit passes cleanly
- **Committed in:** fe01f23 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix necessary for PizZip API compatibility. No scope creep.

## Issues Encountered

- `npx prisma db push` failed due to database not running locally. Schema validates correctly; migration will apply when Docker services start.
- Pre-existing TypeScript errors in `src/app/api/fristen/fristenzettel/route.ts` (Uint8Array type incompatibility). Not related to this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All backend APIs for the Vorlagen-System are ready for the UI layer (Plan 02-05)
- Briefkopf CRUD API ready for settings UI integration
- OrdnerSchema API ready for Akte creation integration
- Template generation endpoint ready for wizard/dialog UI
- Freigabe workflow ready for status badge and approval buttons in UI

## Self-Check: PASSED

All 10 files verified present. Both task commits (fe01f23, 9258e1e) verified in git log.

---
*Phase: 02-deadline-calculation-document-templates*
*Completed: 2026-02-24*
