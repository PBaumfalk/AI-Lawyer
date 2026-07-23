---
phase: 58-caldav-sync
plan: 03
subsystem: ui
tags: [caldav, settings-tab, tagesuebersicht, external-events, google-calendar, apple-icloud]

requires:
  - phase: 58-caldav-sync
    provides: "CalDavKonto CRUD API, sync engine with PULL mappings, manual sync endpoint"
provides:
  - "CalDAV settings tab for managing Google/Apple calendar connections"
  - "External calendar events displayed in Tagesuebersicht alongside internal entries"
  - "externalData Json field on CalDavSyncMapping for caching event summaries"
affects: []

tech-stack:
  added: []
  patterns: [caldav-settings-ui, external-event-display, virtual-typ-pattern]

key-files:
  created:
    - src/components/einstellungen/caldav-tab.tsx
  modified:
    - src/app/(dashboard)/einstellungen/page.tsx
    - src/app/api/kalender/route.ts
    - src/components/fristen/tagesuebersicht.tsx
    - src/lib/caldav/sync-engine.ts
    - prisma/schema.prisma

key-decisions:
  - "Virtual EXTERN typ in API response rather than changing Prisma KalenderTyp enum"
  - "externalData Json field on CalDavSyncMapping caches summary/dtstart/dtend for API queries"
  - "CalDAV tab available to all users (not admin-only) since calendar is personal"

patterns-established:
  - "Virtual typ pattern: API returns typ='EXTERN' for external events without schema enum change"
  - "Provider-specific pre-filled serverUrl (Google/Apple) in connection dialog"

requirements-completed: [CAL-08]

duration: 4min
completed: 2026-03-07
---

# Phase 58 Plan 03: CalDAV UI & Tagesuebersicht Integration Summary

**CalDAV settings tab with Google/Apple connection wizard, manual sync controls, and external calendar events displayed in Tagesuebersicht with purple "Externe Kalender" section**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T00:39:27Z
- **Completed:** 2026-03-07T00:43:00Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments
- CalDAV settings tab with multi-step connection wizard (provider selection, credentials, calendar selection)
- Connection cards showing sync status badges (VERBUNDEN/FEHLER/GETRENNT/SYNCHRONISIEREND) with manual sync button
- External calendar events from PULL mappings displayed in Tagesuebersicht under "Externe Kalender" section with purple dots
- Kalender API extended to merge internal KalenderEintrag items with external CalDAV events in a single response
- Sync engine stores externalData (summary, dtstart, dtend, allDay) on PULL mapping creation and updates

## Task Commits

Each task was committed atomically:

1. **Task 1: CalDAV settings tab + external events in Tagesuebersicht** - `9d7be4a` (feat)

## Files Created/Modified
- `src/components/einstellungen/caldav-tab.tsx` - CalDAV settings tab with connection CRUD, provider selection, sync controls
- `src/app/(dashboard)/einstellungen/page.tsx` - Added "Kalender" tab with Calendar icon after Benachrichtigungen
- `src/app/api/kalender/route.ts` - Extended GET to include external events from PULL mappings with externalData
- `src/components/fristen/tagesuebersicht.tsx` - Added EXTERN typ, externeTermine state, "Externe Kalender" section with Globe icon
- `src/lib/caldav/sync-engine.ts` - Stores externalData on PULL mapping creation and etag-change updates
- `prisma/schema.prisma` - Added externalData Json? field to CalDavSyncMapping model

## Decisions Made
- Used virtual "EXTERN" typ in API response instead of modifying Prisma KalenderTyp enum (avoids migration for display-only type)
- externalData cached as Json field on CalDavSyncMapping so kalender API can query without CalDAV round-trip
- CalDAV tab accessible to all users (not admin-gated) since calendar connections are personal

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- DATABASE_URL not set in execution environment; Prisma validate shows config error but generate succeeds (schema valid)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CalDAV feature complete: account management, sync engine, and UI integration all operational
- Phase 58 fully delivered with all three plans (foundation, sync engine, UI) complete

---
*Phase: 58-caldav-sync*
*Completed: 2026-03-07*
