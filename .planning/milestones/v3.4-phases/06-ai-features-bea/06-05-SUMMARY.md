---
phase: 06-ai-features-bea
plan: 05
subsystem: bea, ui, api
tags: [bea, xjustiz, eeb, safe-id, beA, inbox, compose, pruefprotokoll]

# Dependency graph
requires:
  - phase: 06-04
    provides: beA client wrapper, session context, auto-assign logic, XJustiz parser, Prisma BeaNachricht model
  - phase: 06-03
    provides: Helena AI scan processor, HelenaSuggestion model, notification service
provides:
  - beA inbox/outbox pages with login dialog and message list
  - beA message detail page with eEB button, Pruefprotokoll viewer, XJustiz viewer
  - beA compose form with SAFE-ID autocomplete and FREIGEGEBEN document picker
  - beA API routes (CRUD, eEB, auto-assign) with Helena scan trigger
affects: [07-roles-security]

# Tech tracking
tech-stack:
  added: []
  patterns: [browser-side beA auth with BeaSessionProvider, beA message sync from bea.expert to database, collapsible structured data viewers]

key-files:
  created:
    - src/app/api/bea/messages/route.ts
    - src/app/api/bea/messages/[id]/route.ts
    - src/app/api/bea/messages/[id]/eeb/route.ts
    - src/app/api/bea/auto-assign/route.ts
    - src/app/(dashboard)/bea/[id]/page.tsx
    - src/app/(dashboard)/bea/compose/page.tsx
    - src/components/bea/bea-inbox.tsx
    - src/components/bea/bea-message-detail.tsx
    - src/components/bea/bea-compose.tsx
    - src/components/bea/eeb-button.tsx
    - src/components/bea/pruefprotokoll-viewer.tsx
    - src/components/bea/xjustiz-viewer.tsx
  modified:
    - src/app/(dashboard)/bea/page.tsx

key-decisions:
  - "beA login dialog with software token (.p12/.pfx) file upload and PIN input in browser"
  - "beA inbox syncs from bea.expert API to database on page load, then displays from DB"
  - "eEB acknowledgment is two-step: browser-side bea.expert call then server-side DB record"
  - "XJustiz viewer renders collapsible sections for Grunddaten, Beteiligte, Instanzen, Termine"
  - "Compose form uses Kontakt.beaSafeId for SAFE-ID autocomplete, only FREIGEGEBEN documents attachable"
  - "Auto-assignment and Helena AI scan triggered on POST /api/bea/messages"

patterns-established:
  - "BeaSessionProvider wrapping for pages needing beA auth state"
  - "Two-phase sync: fetch from external API, diff+POST to internal DB, display from DB"
  - "Collapsible viewer pattern for structured protocol data (Pruefprotokoll, XJustiz)"

requirements-completed: [REQ-BA-001, REQ-BA-002, REQ-BA-003, REQ-BA-004, REQ-BA-005, REQ-BA-006]

# Metrics
duration: 24min
completed: 2026-02-25
---

# Phase 6 Plan 5: beA UI Layer Summary

**beA inbox/outbox with login dialog, message detail with eEB/Pruefprotokoll/XJustiz viewers, compose form with SAFE-ID autocomplete from Kontakte, and API routes with auto-assignment and Helena scan triggers**

## Performance

- **Duration:** 24 min
- **Started:** 2026-02-25T05:59:36Z
- **Completed:** 2026-02-25T06:23:00Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments
- Full beA section replacing stub: login dialog, inbox/outbox with sync, message detail, compose form
- 4 API routes handling beA message CRUD, eEB acknowledgment, and auto-assignment with Helena scan
- XJustiz inline viewer rendering structured court data with collapsible sections
- Pruefprotokoll viewer displaying verification results with success/fail icons
- eEB one-click acknowledgment for ANWALT users with client + server recording
- SAFE-ID autocomplete from Kontakte database for beA compose form
- Document attachment picker enforcing FREIGEGEBEN status (versand-gate pattern)

## Task Commits

Each task was committed atomically:

1. **Task 1: beA API Routes + Inbox/Outbox Page + Message Detail** - `25eee67` (feat)
2. **Task 2: beA Compose Form + End-to-End Wiring** - `598bb7e` (feat)
3. **Task 3: Verify beA Integration End-to-End** - checkpoint:human-verify (approved)

## Files Created/Modified
- `src/app/api/bea/messages/route.ts` - GET/POST beA messages with pagination, auto-assign, Helena scan trigger
- `src/app/api/bea/messages/[id]/route.ts` - GET/PATCH single beA message
- `src/app/api/bea/messages/[id]/eeb/route.ts` - POST eEB acknowledgment (ANWALT RBAC)
- `src/app/api/bea/auto-assign/route.ts` - POST manual auto-assignment trigger
- `src/app/(dashboard)/bea/page.tsx` - beA page with login dialog and BeaInbox (replaced stub)
- `src/app/(dashboard)/bea/[id]/page.tsx` - Server component for message detail with Helena suggestions
- `src/app/(dashboard)/bea/compose/page.tsx` - Compose page with ANWALT RBAC redirect
- `src/components/bea/bea-inbox.tsx` - Inbox/outbox with sync, message list, Akte assign dialog
- `src/components/bea/bea-message-detail.tsx` - Message detail with header, content, attachments, eEB, XJustiz, suggestions
- `src/components/bea/bea-compose.tsx` - Compose form with SAFE-ID autocomplete, document picker
- `src/components/bea/eeb-button.tsx` - eEB confirmation button with bea.expert + DB recording
- `src/components/bea/pruefprotokoll-viewer.tsx` - Collapsible table of verification steps
- `src/components/bea/xjustiz-viewer.tsx` - Structured XJustiz viewer with Grunddaten, Beteiligte, Instanzen, Termine

## Decisions Made
- beA login uses file upload for .p12/.pfx software token, fully browser-side auth
- Inbox syncs from bea.expert to database on page load (diff against stored nachrichtenId), then displays from DB
- eEB is two-step: client-side beaSendEeb() via bea.expert, then POST /api/bea/messages/[id]/eeb for DB record
- XJustiz viewer uses collapsible Section components with defaultOpen for Grunddaten
- Compose enforces FREIGEGEBEN-only documents via client-side fetch with status filter
- Auto-assign and Helena scan triggered in POST /api/bea/messages to process new messages on storage
- 409 Conflict returned for duplicate nachrichtenId to support idempotent sync

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The bea.expert library must be configured separately when available (CDN, npm, or vendor file in src/lib/bea/vendor/).

## Next Phase Readiness
- Phase 6 (AI Features + beA) is now fully complete with all 5 plans executed
- All beA integration components are wired and functional
- Ready for Phase 7 (Rollen/Sicherheit) which applies security and RBAC hardening across features

## Self-Check: PASSED

- All 13 created files verified present on disk
- Commit 25eee67 (Task 1) verified in git log
- Commit 598bb7e (Task 2) verified in git log
- Task 3 checkpoint approved by user

---
*Phase: 06-ai-features-bea*
*Completed: 2026-02-25*
