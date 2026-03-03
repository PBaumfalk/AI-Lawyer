---
phase: 46-dokument-freigabe-portal-dms
plan: 01
subsystem: api, ui
tags: [portal, mandant, dokument, freigabe, toggle, prisma, glass-ui, next.js]

# Dependency graph
requires:
  - phase: 45-mandant-datenraum
    plan: 01
    provides: "Portal API infrastructure, portal-access.ts, mandantSichtbar on AktenActivity, requireMandantAkteAccess"
  - phase: 43-portal-schema-shell
    provides: "Portal layout, sidebar, (portal) route group"
provides:
  - "mandantSichtbar Boolean field on Dokument model with composite index"
  - "PATCH /api/akten/[id]/dokumente/[dId]/mandant-sichtbar toggle endpoint"
  - "mandantSichtbar toggle UI in internal document list (dokumente-tab.tsx)"
  - "GET /api/portal/akten/[id]/dokumente returning only mandantSichtbar=true documents"
  - "Portal document list page with Glass card UI, file icons, size, date"
affects: [46-02-download, 47-portal-nachrichten]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Optimistic toggle with revert on error for mandantSichtbar", "Portal API mandantSichtbar=true filter pattern for data isolation", "Role-gated toggle button (ADMIN/ANWALT/SACHBEARBEITER only)"]

key-files:
  created:
    - src/app/api/akten/[id]/dokumente/[dId]/mandant-sichtbar/route.ts
    - src/app/api/portal/akten/[id]/dokumente/route.ts
    - src/app/(portal)/akten/[id]/dokumente/page.tsx
  modified:
    - prisma/schema.prisma
    - src/components/dokumente/dokumente-tab.tsx

key-decisions:
  - "mandantSichtbar defaults to false: Anwalt must explicitly opt in per document"
  - "AktenActivity created only on enable (not on disable) to avoid Mandant seeing revocations"
  - "Optimistic update with revert for toggle UX: immediate feedback, revert on server error"
  - "Portal API uses select (not include) to avoid exposing dateipfad to Mandant"
  - "Download button on portal page rendered as disabled placeholder for Plan 46-02 wiring"

patterns-established:
  - "mandantSichtbar toggle pattern: EyeOff/Eye icon, emerald when active, muted when inactive"
  - "Portal document API: MANDANT role check + requireMandantAkteAccess + mandantSichtbar=true filter"

requirements-completed: [DOC-01, DOC-02]

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 46 Plan 01: Dokument Freigabe + Portal Dokumente Summary

**Per-document mandantSichtbar toggle on Dokument model with internal Anwalt toggle UI, portal document list API (mandantSichtbar=true filter), and Glass-card portal document page**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-03T12:30:59Z
- **Completed:** 2026-03-03T12:36:06Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- mandantSichtbar Boolean field added to Dokument model with @@index([akteId, mandantSichtbar]) for efficient portal queries
- PATCH toggle endpoint creates mandantSichtbar AktenActivity when enabling (visible to Mandant timeline), no activity on disable
- Internal document list shows EyeOff/Eye toggle per document row with optimistic update and role gating
- Portal document API enforces MANDANT role + Akte access check, returns only mandantSichtbar=true documents without dateipfad
- Portal document list page with file type icons, formatted size (KB/MB), German date format, disabled download placeholder

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema + Toggle API + AktenActivity on toggle** - `baa110a` (feat)
2. **Task 2: Internal toggle UI + Portal document list API + Portal document list page** - `8f23c9e` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added mandantSichtbar Boolean @default(false) on Dokument + composite index
- `src/app/api/akten/[id]/dokumente/[dId]/mandant-sichtbar/route.ts` - PATCH toggle with RBAC, AktenActivity on enable, audit log
- `src/components/dokumente/dokumente-tab.tsx` - mandantSichtbar toggle button with optimistic update, role-gated visibility
- `src/app/api/portal/akten/[id]/dokumente/route.ts` - GET endpoint: MANDANT role check + Akte access + mandantSichtbar=true filter
- `src/app/(portal)/akten/[id]/dokumente/page.tsx` - Client component: document list with Glass card, file icons, empty state

## Decisions Made
- **mandantSichtbar defaults to false:** Anwalt must explicitly enable per document. This ensures no accidental data exposure.
- **No activity on revocation:** When toggling mandantSichtbar to false, no AktenActivity is created. Mandant should not see "document revoked" entries in their timeline.
- **Optimistic toggle with revert:** Toggle uses optimistic UI update for instant feedback. On server error, state is reverted with toast notification.
- **Select-only portal API:** Portal document API uses Prisma `select` (not `include`) to explicitly control which fields are returned. dateipfad (MinIO path) is never exposed to Mandant.
- **Disabled download placeholder:** Download button on portal page is rendered but disabled. Will be wired to presigned URL download in Plan 46-02.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Database not running locally so `npx prisma db push` could not be executed. Used `npx prisma generate` to verify schema validity and type generation instead. `db push` needed when database service starts.
- 7 pre-existing TypeScript errors in falldaten-tab.tsx and helena/index.ts remain unrelated to new changes. All new/modified files compile without errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- mandantSichtbar field ready on Dokument model, needs `npx prisma db push` when database is running
- Portal document list page has disabled download button ready for Plan 46-02 (download wiring)
- Portal API pattern established for document access with proper data isolation
- Toggle UI in internal document list ready for use by Anwaelte

## Self-Check: PASSED

All artifacts verified:
- 46-01-SUMMARY.md exists
- Commit baa110a (Task 1) exists
- Commit 8f23c9e (Task 2) exists
- All 3 created files exist (toggle API, portal API, portal page)
- mandantSichtbar field present in prisma/schema.prisma
- mandantSichtbar toggle present in dokumente-tab.tsx
- No TypeScript errors in new/modified files

---
*Phase: 46-dokument-freigabe-portal-dms*
*Completed: 2026-03-03*
