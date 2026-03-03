---
phase: 34-dashboard-widget-quest-deep-links
plan: 02
subsystem: ui, api
tags: [gamification, opt-in, settings, switch, deep-link, kalender, searchparams]

# Dependency graph
requires:
  - phase: 33-gamification-schema-quest-engine
    provides: gamificationOptIn field on User model, getOrCreateGameProfile service
provides:
  - GET/PATCH /api/gamification/opt-in endpoint for toggling gamification visibility
  - Gamification toggle switch in Einstellungen Allgemein tab
  - KalenderListe URL search params initialization for quest deep-links
affects: [34-dashboard-widget-quest-deep-links, 35-anti-missbrauch-runen-cap]

# Tech tracking
tech-stack:
  added: []
  patterns: [user preference PATCH endpoint with auto-profile creation]

key-files:
  created:
    - src/app/api/gamification/opt-in/route.ts
  modified:
    - src/app/(dashboard)/einstellungen/page.tsx
    - src/components/kalender/kalender-liste.tsx

key-decisions:
  - "Combined GET+PATCH in single opt-in route for fetch simplicity"
  - "Auto-create GameProfile on opt-in enable so widget works immediately"
  - "Only KalenderListe needs searchParams init -- Tickets already has server-side params"

patterns-established:
  - "User preference toggle: GET for initial state, PATCH for toggle, toast feedback"

requirements-completed: [GAME-07]

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 34 Plan 02: Opt-in Toggle + Deep-Link Target Summary

**Gamification opt-in toggle in Einstellungen with GET/PATCH API, KalenderListe URL param initialization for quest deep-links**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T12:59:50Z
- **Completed:** 2026-03-02T13:01:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- GET/PATCH /api/gamification/opt-in endpoint with auth, validation, and auto GameProfile creation
- Gamification toggle GlassCard in Einstellungen Allgemein tab with Switch component and toast feedback
- KalenderListe reads initial typFilter from URL ?typ= search params, enabling quest deep-links to pre-filter view

## Task Commits

Each task was committed atomically:

1. **Task 1: Create opt-in PATCH endpoint + settings toggle UI** - `84a88ce` (feat)
2. **Task 2: Wire KalenderListe to read initial filter from URL search params** - `e02003c` (feat)

## Files Created/Modified
- `src/app/api/gamification/opt-in/route.ts` - GET returns current opt-in boolean, PATCH toggles it with auto GameProfile creation
- `src/app/(dashboard)/einstellungen/page.tsx` - Added Gamification toggle GlassCard between Benutzer and Verwaltung sections
- `src/components/kalender/kalender-liste.tsx` - Added useSearchParams for initial typFilter from URL params

## Decisions Made
- Combined GET and PATCH handlers in single opt-in route file for fetch simplicity (no need for separate status endpoint)
- Auto-create GameProfile via getOrCreateGameProfile when toggling ON so the dashboard widget works immediately without extra steps
- Only KalenderListe needs searchParams initialization -- Tickets page already reads server-side searchParams, Rechnungen/Akten quest targets don't need filtering

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Opt-in toggle and deep-link wiring complete
- Phase 34 plans finished, ready for Phase 35 (Anti-Missbrauch + Runen-Cap)

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 34-dashboard-widget-quest-deep-links*
*Completed: 2026-03-02*
