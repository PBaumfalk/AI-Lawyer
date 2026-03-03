---
phase: 50-portal-dokumente-navigation
plan: 01
subsystem: ui
tags: [next.js, layout, tabs, navigation, portal, usePathname]

# Dependency graph
requires:
  - phase: 46-portal-dokumente-upload
    provides: "Dokumente page at /portal/akten/[id]/dokumente"
  - phase: 47-portal-nachrichten
    provides: "Nachrichten page at /portal/akten/[id]/nachrichten"
provides:
  - "Tab navigation (Uebersicht | Dokumente | Nachrichten) on portal akte detail page"
  - "Shared layout.tsx with auth, title, back link for all akte sub-pages"
  - "PortalAkteTabs reusable client component"
affects: [portal-akte-detail, portal-dokumente, portal-nachrichten]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Shared layout.tsx for portal akte sub-pages with tab navigation"]

key-files:
  created:
    - src/app/(portal)/portal/akten/[id]/layout.tsx
    - src/components/portal/portal-akte-tabs.tsx
  modified:
    - src/app/(portal)/portal/akten/[id]/page.tsx

key-decisions:
  - "Defense-in-depth: page.tsx keeps MANDANT role check even though layout does it"
  - "Underline tab style with border-b-2 border-primary on active tab"
  - "Equal-width flex-1 tabs with icon + text centered"

patterns-established:
  - "Portal akte layout pattern: shared layout.tsx with auth + title + tabs wrapping sub-page children"
  - "Tab active detection: exact match for root, startsWith for sub-pages"

requirements-completed: [DOC-02, DOC-03, DOC-04]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 50 Plan 01: Portal Dokumente Navigation Summary

**Tab navigation with Uebersicht/Dokumente/Nachrichten tabs on portal akte detail, using shared layout.tsx with auth and title**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T21:41:12Z
- **Completed:** 2026-03-03T21:43:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created PortalAkteTabs client component with 3 tabs, active state detection via usePathname, and primary underline styling
- Created shared layout.tsx that handles auth, access check, title, back link, and tab bar for all akte sub-pages
- Refactored page.tsx to render only Uebersicht content (timeline + sidebar cards), removing duplicated title/auth/nav concerns

## Task Commits

Each task was committed atomically:

1. **Task 1: Create layout.tsx with shared title and PortalAkteTabs component** - `4c47154` (feat)
2. **Task 2: Refactor page.tsx to be Uebersicht tab content only** - `cd8168f` (refactor)

## Files Created/Modified
- `src/components/portal/portal-akte-tabs.tsx` - Client component with 3 tabs (Uebersicht, Dokumente, Nachrichten), icon + text labels, active state via usePathname
- `src/app/(portal)/portal/akten/[id]/layout.tsx` - Server component with auth gate, access check, title rendering, back link, tab bar, and children slot
- `src/app/(portal)/portal/akten/[id]/page.tsx` - Stripped to Uebersicht content only (timeline + AkteUebersicht + NaechsteSchritteCard)

## Decisions Made
- Defense-in-depth: page.tsx retains MANDANT role check as safety net even though layout.tsx is the primary auth gate
- Underline tab style (border-b-2 border-primary) chosen over background highlight for cleaner visual hierarchy
- Exact pathname match for Uebersicht tab, startsWith for Dokumente/Nachrichten tabs to handle nested routes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tab navigation is fully functional -- Dokumente and Nachrichten pages are now discoverable via UI
- All three tabs link to existing pages that are already implemented
- No further work needed for this phase

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 50-portal-dokumente-navigation*
*Completed: 2026-03-03*
