---
phase: 58-caldav-sync
plan: 01
subsystem: api
tags: [caldav, tsdav, icalendar, encryption, prisma, google-calendar, apple-icloud]

requires:
  - phase: 46-email
    provides: "EmailKonto encryption pattern (AES-256-GCM) and EmailAuthTyp enum"
provides:
  - "CalDavKonto and CalDavSyncMapping Prisma models"
  - "tsdav client wrapper for Google and Apple CalDAV"
  - "CalDAV credential encryption with domain-separated salt"
  - "CRUD API endpoints for CalDAV account management"
affects: [58-02-PLAN, 58-03-PLAN]

tech-stack:
  added: [tsdav]
  patterns: [caldav-client-wrapper, icalendar-builder-parser]

key-files:
  created:
    - src/lib/caldav/types.ts
    - src/lib/caldav/crypto.ts
    - src/lib/caldav/client.ts
    - src/app/api/caldav-konten/route.ts
    - src/app/api/caldav-konten/[id]/route.ts
  modified:
    - prisma/schema.prisma

key-decisions:
  - "Reused EmailAuthTyp enum for CalDavKonto (PASSWORT for Apple, OAUTH2 for Google)"
  - "Domain-separated salt (ai-lawyer-caldav-cred-v1) with same EMAIL_ENCRYPTION_KEY master key"
  - "tsdav DAVClient class for Google OAuth, createDAVClient factory not used"

patterns-established:
  - "CalDAV client wrapper: createCalDavClient + fetchCalendars/Events/createEvent/updateEvent/deleteEvent"
  - "iCalendar VEVENT builder and parser for CalDAV <-> internal event conversion"

requirements-completed: [CAL-01, CAL-02, CAL-06]

duration: 4min
completed: 2026-03-07
---

# Phase 58 Plan 01: CalDAV Konto & Client Foundation Summary

**CalDavKonto Prisma model with AES-256-GCM encrypted credentials, tsdav client wrapper for Google/Apple CalDAV, and CRUD API endpoints with connection validation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T00:25:08Z
- **Completed:** 2026-03-07T00:30:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- CalDavKonto and CalDavSyncMapping Prisma models with encrypted credential storage
- tsdav client wrapper supporting Google Calendar (OAuth2) and Apple iCloud Calendar (app-specific password)
- iCalendar VEVENT builder and parser for bidirectional event conversion
- CRUD API endpoints (GET/POST/DELETE/PATCH) with connection validation on create

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma model + CalDAV types + crypto module** - `9b8a480` (feat)
2. **Task 2: tsdav client wrapper + CRUD API endpoints** - `7828ad8` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added CalDavProvider/CalDavSyncStatus enums, CalDavKonto and CalDavSyncMapping models, User/KalenderEintrag relations
- `src/lib/caldav/types.ts` - CalDavProvider, CalDavKontoInput, CalDavSyncState, CalDavEvent, CalDavCalendarInfo types
- `src/lib/caldav/crypto.ts` - AES-256-GCM encryption with domain-separated salt for CalDAV credentials
- `src/lib/caldav/client.ts` - tsdav wrapper: createCalDavClient, fetchCalendars, fetchEvents, createEvent, updateEvent, deleteEvent
- `src/app/api/caldav-konten/route.ts` - GET (list) and POST (create with validation) endpoints
- `src/app/api/caldav-konten/[id]/route.ts` - GET (detail), PATCH (update), DELETE endpoints

## Decisions Made
- Reused EmailAuthTyp enum (PASSWORT/OAUTH2) for CalDavKonto instead of creating a new enum
- Used domain-separated salt (ai-lawyer-caldav-cred-v1) with the same EMAIL_ENCRYPTION_KEY master key for crypto isolation
- Used tsdav DAVClient class directly with OAuth/Basic auth methods for provider-specific authentication

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- DATABASE_URL not set in execution environment, used dummy URL for Prisma validate/generate (schema valid, client generated)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CalDavKonto model and client library ready for sync engine (Plan 02)
- API endpoints ready for settings UI integration (Plan 03)
- tsdav connection validation ensures only valid accounts are stored

---
*Phase: 58-caldav-sync*
*Completed: 2026-03-07*
