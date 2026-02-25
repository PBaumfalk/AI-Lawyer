---
phase: 02-deadline-calculation-document-templates
plan: 03
subsystem: document-editing
tags: [onlyoffice, co-editing, versioning, track-changes, pdf-conversion, document-workflow, schreibschutz]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation
    provides: "Prisma schema, MinIO storage, auth, audit logging"
provides:
  - "Stable OnlyOffice co-editing with version-based document key"
  - "DokumentVersion model for version history tracking"
  - "Callback handler with version increment on save, forcesave without increment"
  - "DOCX-to-PDF conversion endpoint via OnlyOffice Conversion API"
  - "Dokument-Status-Workflow (ENTWURF -> ZUR_PRUEFUNG -> FREIGEGEBEN -> VERSENDET)"
  - "Schreibschutz enforcement after Freigabe (view-only in OnlyOffice)"
  - "Version history API with named snapshots and non-destructive restore"
  - "Enhanced OnlyOffice editor React component with full toolbar"
affects: [02-04-PLAN, 02-05-PLAN, 02-06-PLAN]

# Tech tracking
tech-stack:
  added: ["@radix-ui/react-popover (dependency fix)"]
  patterns:
    - "Version-based document key for OnlyOffice co-editing: {dokumentId}_v{version}"
    - "Callback status 2 = save + version increment, status 6 = forcesave only"
    - "Status workflow with RBAC: Freigabe restricted to ANWALT/ADMIN"
    - "Schreibschutz: READ_ONLY_STATUSES set enforces view mode in buildEditorConfig"

key-files:
  created:
    - "src/app/api/onlyoffice/convert/route.ts"
    - "src/app/api/dokumente/[id]/versionen/route.ts"
    - "src/app/api/dokumente/[id]/versionen/[versionId]/restore/route.ts"
    - "src/app/api/dokumente/[id]/status/route.ts"
    - "src/components/dokumente/onlyoffice-editor.tsx"
  modified:
    - "prisma/schema.prisma"
    - "src/lib/onlyoffice.ts"
    - "src/app/api/onlyoffice/callback/route.ts"
    - "src/app/api/onlyoffice/config/[dokumentId]/route.ts"

key-decisions:
  - "Keep existing ZUR_PRUEFUNG enum value instead of renaming to IN_PRUEFUNG for backward compatibility"
  - "Version snapshots stored at {dateipfad}_v{version} path pattern in MinIO"
  - "Restore creates pre-restore snapshot automatically for safety"
  - "OnlyOffice event handlers typed as (event: object) per library v2.1.1 types"

patterns-established:
  - "Document key stability: generateDocumentKey(id, version) for all OnlyOffice integrations"
  - "Status workflow RBAC: RESTRICTED_TRANSITIONS set pattern for role-gated operations"
  - "Non-destructive versioning: restore always creates new version, old preserved"
  - "Editor component pattern: DocumentEditor with events as props, config from API"

requirements-completed: [REQ-DV-010, REQ-DV-011]

# Metrics
duration: 6min
completed: 2026-02-24
---

# Phase 02 Plan 03: OnlyOffice Integration Rebuild Summary

**Stable co-editing via version-based document keys, DOCX-to-PDF conversion, version history with restore, and Dokument-Status-Workflow with Schreibschutz enforcement**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-24T10:33:29Z
- **Completed:** 2026-02-24T10:39:30Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Replaced Date.now() document key with stable `{dokumentId}_v{version}` format enabling true co-editing
- Differentiated callback status 2 (save + version increment) from status 6 (forcesave, no increment)
- Built complete Dokument-Status-Workflow with RBAC (Freigabe only by ANWALT/ADMIN)
- Added DOCX-to-PDF conversion endpoint via OnlyOffice Conversion API with polling
- Implemented version history with named snapshots and non-destructive restore
- Created full-featured OnlyOffice editor component with Track Changes, Comments, version panel, PDF export, status transitions, and Schreibschutz banner

## Task Commits

Each task was committed atomically:

1. **Task 1: Stable Document Key + Enhanced Callback + Versioning Schema + Status Workflow** - `f6943af` (feat)
2. **Task 2: Conversion API + Enhanced Editor Component + Version History** - `c4e3c4a` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `prisma/schema.prisma` - Added DokumentVersion model with unique constraint on [dokumentId, version]
- `src/lib/onlyoffice.ts` - Added generateDocumentKey(), enhanced buildEditorConfig with version, dokumentStatus, Track Changes, Schreibschutz
- `src/app/api/onlyoffice/callback/route.ts` - Rebuilt with status 2 (save + version snapshot + increment) vs status 6 (forcesave only)
- `src/app/api/onlyoffice/config/[dokumentId]/route.ts` - Enhanced with version-based key and Schreibschutz enforcement
- `src/app/api/onlyoffice/convert/route.ts` - DOCX-to-PDF conversion via OnlyOffice Conversion API with async polling
- `src/app/api/dokumente/[id]/status/route.ts` - PATCH endpoint for status transitions with RBAC and audit logging
- `src/app/api/dokumente/[id]/versionen/route.ts` - GET (list versions) + POST (create named snapshot)
- `src/app/api/dokumente/[id]/versionen/[versionId]/restore/route.ts` - POST (non-destructive restore)
- `src/components/dokumente/onlyoffice-editor.tsx` - Full editor component with version panel, status bar, PDF export, Schreibschutz

## Decisions Made

- **Kept ZUR_PRUEFUNG instead of IN_PRUEFUNG:** The existing schema uses `ZUR_PRUEFUNG` in the DokumentStatus enum. Renaming would break existing code and data. The plan's `IN_PRUEFUNG` reference was treated as a naming suggestion; the actual behavior matches the plan's intent.
- **Version snapshot storage path:** Version files stored at `{dateipfad}_v{version}` to keep them adjacent to the current file in MinIO.
- **Pre-restore safety snapshot:** When restoring a version, the current state is automatically snapshotted first, preventing accidental data loss.
- **OnlyOffice event handler types:** Used `(event: object)` signature to match `@onlyoffice/document-editor-react` v2.1.1 type definitions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing @radix-ui/react-popover dependency**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Pre-existing missing dependency in src/components/ui/popover.tsx blocking tsc --noEmit
- **Fix:** `npm install @radix-ui/react-popover`
- **Files modified:** package.json, package-lock.json
- **Verification:** npx tsc --noEmit passes cleanly
- **Committed in:** Not committed separately (package files not staged with task commits)

**2. [Rule 1 - Bug] Fixed OnlyOffice event handler type mismatch**
- **Found during:** Task 2 (TypeScript compilation of editor component)
- **Issue:** Event handlers typed as `(event: { data: unknown })` but library expects `(event: object)`
- **Fix:** Changed handler signatures to match library types
- **Files modified:** src/components/dokumente/onlyoffice-editor.tsx
- **Verification:** npx tsc --noEmit passes cleanly
- **Committed in:** c4e3c4a (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for build correctness. No scope creep.

## Issues Encountered

- `npx prisma db push` failed due to database not running locally. Schema validates correctly; migration will apply when Docker services start.
- `npx next build` fails at "Collecting page data" due to pre-existing missing worker.js module from Phase 1 infrastructure. Not related to this plan's changes. TypeScript compilation (`tsc --noEmit`) passes cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- OnlyOffice integration is ready for template system (Plan 02-04)
- PDF conversion endpoint available for Briefkopf application and document export
- Version history and status workflow ready for integration with document management UI
- Schreibschutz enforcement active for approved documents

## Self-Check: PASSED

All 9 files verified present. Both task commits (f6943af, c4e3c4a) verified in git log.

---
*Phase: 02-deadline-calculation-document-templates*
*Completed: 2026-02-24*
