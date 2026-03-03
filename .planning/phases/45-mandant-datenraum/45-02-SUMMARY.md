---
phase: 45-mandant-datenraum
plan: 02
subsystem: ui
tags: [portal, mandant, dashboard, timeline, glass-ui, next.js, server-components]

# Dependency graph
requires:
  - phase: 45-mandant-datenraum
    plan: 01
    provides: "Portal API endpoints, portal-access.ts, mandantSichtbar flag, naechsteSchritte field"
  - phase: 43-portal-schema-shell
    provides: "Portal layout with SessionProvider, PortalSidebar, PortalHeader"
provides:
  - "Portal dashboard page with Akte-Auswahl grid and single-Akte auto-redirect"
  - "Portal Akte detail page with two-column layout (Timeline + sidebar)"
  - "AkteUebersicht component showing Sachgebiet, Status, Gegner, Gericht"
  - "NaechsteSchritteCard with prominent accent-border styling"
  - "SachstandTimeline with cursor pagination and reverse-chronological display"
  - "NaechsteSchritteEditor for Anwalt/Sachbearbeiter/Admin on internal Akte detail page"
affects: [46-portal-dokumente, 47-portal-nachrichten]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Server-side Akte detail fetch in portal pages (no API call needed from server components)", "Two-column responsive layout (flex-col-reverse lg:flex-row) for portal detail pages", "Collapsible editor pattern for cross-role UI (NaechsteSchritteEditor)"]

key-files:
  created:
    - src/app/(portal)/dashboard/page.tsx
    - src/app/(portal)/akten/[id]/page.tsx
    - src/components/portal/akte-auswahl.tsx
    - src/components/portal/akte-uebersicht.tsx
    - src/components/portal/sachstand-timeline.tsx
    - src/components/portal/naechste-schritte-card.tsx
    - src/components/akten/naechste-schritte-editor.tsx
  modified:
    - src/app/(dashboard)/akten/[id]/page.tsx

key-decisions:
  - "Server component direct Prisma queries for portal pages (no redundant API fetch from server)"
  - "Back link to dashboard only visible for multi-Akte Mandanten"
  - "NaechsteSchritteCard uses accent border (border-primary/20) for visual prominence"
  - "SachstandTimeline client-side fetch for pagination, not RSC streaming"
  - "NaechsteSchritteEditor role-gated to ADMIN, ANWALT, SACHBEARBEITER (not SEKRETARIAT)"

patterns-established:
  - "Portal detail page pattern: auth check + requireMandantAkteAccess + direct Prisma select (no internal fields)"
  - "SACHGEBIET_LABELS and STATUS_COLORS/STATUS_LABELS maps for consistent German display across portal components"
  - "Collapsible section pattern with ChevronDown/ChevronRight toggle for internal editor components"

requirements-completed: [PORTAL-03, PORTAL-04, SACH-01, SACH-02, SACH-03]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 45 Plan 02: Mandant Portal UI Summary

**Portal dashboard with Akte-Auswahl grid, Akte detail page with Sachgebiet/Gegner/Gericht overview, mandant-visible timeline with cursor pagination, prominent naechste Schritte card, and Anwalt-side naechste Schritte editor**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T12:19:30Z
- **Completed:** 2026-03-03T12:23:59Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Portal dashboard with three paths: auto-redirect (1 Akte), grid selection (2+ Akten), friendly empty state (0 Akten)
- Portal Akte detail page with responsive two-column layout: timeline on left, overview + naechste Schritte on right
- SachstandTimeline fetches mandantSichtbar=true events with cursor pagination, German date formatting, type-specific icons
- NaechsteSchritteCard rendered as the most prominent element with accent border styling
- NaechsteSchritteEditor wired into internal Akte detail page, role-gated to Anwalt/Sachbearbeiter/Admin, with sonner toast feedback

## Task Commits

Each task was committed atomically:

1. **Task 1: Portal dashboard page with Akte-Auswahl** - `904ba43` (feat)
2. **Task 2: Portal Akte detail page with Overview, Timeline, Naechste Schritte + Anwalt editor** - `cd1417f` (feat)

## Files Created/Modified
- `src/app/(portal)/dashboard/page.tsx` - Portal dashboard with auth, auto-redirect for single Akte, empty state
- `src/app/(portal)/akten/[id]/page.tsx` - Portal Akte detail with two-column layout, Gegner/Gericht extraction
- `src/components/portal/akte-auswahl.tsx` - Responsive grid of glass-card styled Akte cards with badges
- `src/components/portal/akte-uebersicht.tsx` - Clean info grid showing Sachgebiet, Status, Gegner, Gericht
- `src/components/portal/sachstand-timeline.tsx` - Client component with cursor pagination, timeline dots, date formatting
- `src/components/portal/naechste-schritte-card.tsx` - Prominent accent-bordered card for Mandant next steps
- `src/components/akten/naechste-schritte-editor.tsx` - Collapsible textarea editor with PUT save and toast notifications
- `src/app/(dashboard)/akten/[id]/page.tsx` - Added NaechsteSchritteEditor import and role-gated rendering

## Decisions Made
- **Server component direct Prisma queries:** Portal pages use direct Prisma queries from server components instead of fetching their own API endpoints, since server components can safely call Prisma directly.
- **Multi-Akte back link logic:** Back link to /portal/dashboard is only shown when Mandant has multiple Akten, avoiding unnecessary navigation for single-Akte users.
- **NaechsteSchritteCard prominence:** Uses border-2 border-primary/20 with bg-primary/[0.03] to make it the most visually prominent card per CONTEXT.md guidance ("the #1 thing a Mandant wants to know is what happens next").
- **SEKRETARIAT excluded from NaechsteSchritteEditor:** Per plan, naechste Schritte is a substantive legal communication, so only ANWALT, SACHBEARBEITER, and ADMIN roles can edit it.
- **SachstandTimeline as client component:** Uses client-side fetch with cursor pagination for progressive loading, matching the existing feed pattern.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- 7 pre-existing TypeScript errors in falldaten-tab.tsx and helena/index.ts remain unrelated to portal changes (same as 45-01). All new portal files compile without errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Full Mandant portal flow operational: login -> dashboard -> Akte detail with timeline and next steps
- Portal components ready for document sharing UI (Phase 46)
- NaechsteSchritteEditor ready for use by Anwaelte to communicate with Mandanten
- `npx prisma db push` still needed when database service is started (from 45-01 schema changes)

## Self-Check: PASSED

All artifacts verified:
- 45-02-SUMMARY.md exists
- Commit 904ba43 (Task 1) exists
- Commit cd1417f (Task 2) exists
- All 7 created files exist (dashboard, akte detail, 4 portal components, 1 internal component)
- Internal Akte detail page includes NaechsteSchritteEditor
- No TypeScript errors in new portal files

---
*Phase: 45-mandant-datenraum*
*Completed: 2026-03-03*
