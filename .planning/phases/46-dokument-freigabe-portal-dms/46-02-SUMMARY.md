---
phase: 46-dokument-freigabe-portal-dms
plan: 02
subsystem: api, ui
tags: [portal, mandant, dokument, download, upload, presigned-url, minio, notification, glass-ui]

# Dependency graph
requires:
  - phase: 46-dokument-freigabe-portal-dms
    plan: 01
    provides: "mandantSichtbar field on Dokument, portal document list API, portal document list page with disabled download placeholder"
  - phase: 45-mandant-datenraum
    provides: "Portal API infrastructure, requireMandantAkteAccess, requireAuth for MANDANT role"
provides:
  - "GET /api/portal/akten/[id]/dokumente/[dId]/download returning presigned MinIO URL for mandantSichtbar documents"
  - "POST /api/portal/akten/[id]/dokumente/upload creating document in Mandant Ordner with erstelltDurch=mandant"
  - "Anwalt notification on Mandant upload via createNotification + Socket.IO"
  - "Portal document page with working download buttons + drag-and-drop upload area"
  - "Document grouping by ordner with Von mir hochgeladen badge"
affects: [47-portal-nachrichten]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Presigned URL download pattern for portal (fetch API then window.open)", "Mandant upload pipeline: simplified no-OCR no-RAG path with erstelltDurch=mandant", "Drag-and-drop file upload with Glass card styling and toast feedback", "Document grouping by ordner with folder headers"]

key-files:
  created:
    - src/app/api/portal/akten/[id]/dokumente/[dId]/download/route.ts
    - src/app/api/portal/akten/[id]/dokumente/upload/route.ts
  modified:
    - src/app/(portal)/akten/[id]/dokumente/page.tsx
    - src/lib/notifications/types.ts
    - src/lib/audit.ts
    - src/components/notifications/notification-center.tsx

key-decisions:
  - "createdById uses Akte anwaltId fallback since Mandant is not an internal User with Dokument FK"
  - "50MB portal upload limit vs 100MB internal limit for portal security"
  - "Mandant uploads skip OCR/RAG/preview/Wiedervorlage for simplified pipeline"
  - "Documents grouped by ordner with Mandant folder first when multiple groups exist"

patterns-established:
  - "Portal download pattern: fetch presigned URL then window.open for browser download"
  - "Portal upload pattern: drag-and-drop + click with FormData POST, toast feedback, refetch"
  - "erstelltDurch=mandant + mandantSichtbar=true for Mandant-uploaded documents"

requirements-completed: [DOC-03, DOC-04, DOC-05]

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 46 Plan 02: Portal Download + Upload Summary

**Presigned MinIO download for mandantSichtbar documents, Mandant file upload to dedicated Ordner with Anwalt notification, and drag-and-drop upload UI with ordner grouping**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T12:39:32Z
- **Completed:** 2026-03-03T12:42:51Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Download API returns presigned MinIO URL (1hr expiry) for mandantSichtbar=true documents only, never exposing dateipfad
- Upload API creates documents in "Mandant" Ordner with erstelltDurch="mandant", ocrStatus=NICHT_NOETIG, mandantSichtbar=true
- Anwalt receives real-time notification via createNotification + Socket.IO on Mandant upload
- Portal dokumente page has functional download buttons with loading spinner and drag-and-drop upload zone
- Documents grouped by ordner with folder headers and "Von mir hochgeladen" badge on Mandant uploads
- AktenActivity created on upload with mandantSichtbar=true for Mandant timeline visibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Download API + Upload API with Mandant Ordner + Anwalt notification** - `f088a55` (feat)
2. **Task 2: Wire download + upload UI in portal dokumente page** - `c79ce62` (feat)

## Files Created/Modified
- `src/app/api/portal/akten/[id]/dokumente/[dId]/download/route.ts` - GET endpoint returning presigned URL for mandantSichtbar documents
- `src/app/api/portal/akten/[id]/dokumente/upload/route.ts` - POST endpoint for Mandant file upload with notification + audit + activity
- `src/app/(portal)/akten/[id]/dokumente/page.tsx` - Full rewrite: download buttons, drag-and-drop upload, ordner grouping, badges
- `src/lib/notifications/types.ts` - Added document:mandant-upload NotificationType
- `src/lib/audit.ts` - Added MANDANT_UPLOAD AuditAktion + label
- `src/components/notifications/notification-center.tsx` - Added Upload icon + emerald color for document:mandant-upload

## Decisions Made
- **createdById uses Akte anwaltId:** Mandant is not an internal User (different auth model), so Dokument FK uses Akte's anwaltId as fallback. erstelltDurch="mandant" distinguishes origin.
- **50MB portal upload limit:** Lower than internal 100MB for portal security. Validated both client-side (toast) and server-side (413 response).
- **Simplified upload pipeline:** No OCR, no RAG, no preview generation, no Wiedervorlage. Mandant uploads are straightforward file storage.
- **Ordner grouping with Mandant first:** When multiple ordner values exist, Mandant folder shows first for easy identification of own uploads.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added document:mandant-upload to notification-center type maps**
- **Found during:** Task 1 (after adding NotificationType)
- **Issue:** notification-center.tsx uses Record<NotificationType, ...> which requires all types to be present. Adding the new type broke compilation.
- **Fix:** Added Upload icon + emerald color for document:mandant-upload in typeIcons and typeColors maps
- **Files modified:** src/components/notifications/notification-center.tsx
- **Verification:** TypeScript compilation passes (only pre-existing errors remain)
- **Committed in:** f088a55 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required to maintain type safety. No scope creep.

## Issues Encountered
- Portal page path in plan (`src/app/(portal)/portal/akten/...`) differs from actual filesystem (`src/app/(portal)/akten/...`). Used actual filesystem path.
- 7 pre-existing TypeScript errors in falldaten-tab.tsx and helena/index.ts remain unrelated to changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Portal document download + upload fully wired and functional
- Phase 46 complete: all DOC requirements (DOC-01 through DOC-05) implemented
- Ready for Phase 47 (Portal Nachrichten) which builds on portal infrastructure

## Self-Check: PASSED

All artifacts verified:
- 46-02-SUMMARY.md exists
- Commit f088a55 (Task 1) exists
- Commit c79ce62 (Task 2) exists
- download/route.ts created
- upload/route.ts created
- Portal dokumente page updated with download + upload functionality

---
*Phase: 46-dokument-freigabe-portal-dms*
*Completed: 2026-03-03*
