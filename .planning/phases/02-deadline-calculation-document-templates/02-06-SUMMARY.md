---
phase: 02-deadline-calculation-document-templates
plan: 06
subsystem: api, ui, database
tags: [vertretung, urlaub, deputy, vacation, onboarding, import-export, settings, notifications, prisma]

# Dependency graph
requires:
  - phase: 02-02
    provides: Frist-Reminder worker foundation, KalenderEintrag model
  - phase: 02-04
    provides: Briefkopf and OrdnerSchema models, enhanced DokumentVorlage
provides:
  - User model Vertretung/Urlaub fields (vertreterId, vertretungAktiv, vertretungVon/Bis)
  - UrlaubZeitraum model for vacation period management
  - Vertretung API (GET/PUT) for deputy assignment and activation
  - Urlaub API (GET/POST/DELETE) for vacation date CRUD
  - Frist-Reminder worker with Vertretung-aware notification routing
  - Settings Export/Import APIs (JSON backup/restore)
  - Vertretung/Urlaub settings tab component
  - OnboardingWizard component (6-step first-login setup)
  - Import/Export settings tab component
affects: [03-akte-workflow, 07-rollen-sicherheit]

# Tech tracking
tech-stack:
  added: []
  patterns: [vertretung-aware-notifications, settings-json-export-import, onboarding-wizard-pattern]

key-files:
  created:
    - src/app/api/users/[id]/vertretung/route.ts
    - src/app/api/users/[id]/urlaub/route.ts
    - src/app/api/einstellungen/export/route.ts
    - src/app/api/einstellungen/import/route.ts
    - src/workers/processors/frist-reminder.ts
    - src/components/einstellungen/vertretung-urlaub-tab.tsx
    - src/components/einstellungen/onboarding-wizard.tsx
    - src/components/einstellungen/import-export-tab.tsx
  modified:
    - prisma/schema.prisma
    - src/lib/audit.ts
    - src/lib/notifications/types.ts
    - src/components/notifications/notification-center.tsx
    - src/app/(dashboard)/einstellungen/page.tsx

key-decisions:
  - "Vertretung auto-deactivation in reminder worker prevents stale vacation states"
  - "Settings export excludes file references (Briefkopf dateipfad/logoUrl) -- files must be transferred separately"
  - "OnboardingWizard saves settings via import API for consistency (single upsert path)"
  - "Escalation chain for overdue Fristen: Verantwortlicher -> Vertreter -> Admin"

patterns-established:
  - "Vertretung-aware notifications: check user vacation status before routing reminders"
  - "Settings JSON export/import with version field and category-based upsert"
  - "Full-screen onboarding wizard overlay with step navigation and skip options"

requirements-completed: [REQ-FK-003, REQ-FK-005]

# Metrics
duration: 11min
completed: 2026-02-24
---

# Phase 2 Plan 6: Vertretung/Urlaub & Settings Summary

**Deputy vacation system with auto-routing Frist notifications to Vertreter, settings JSON export/import, and 6-step onboarding wizard for first admin login**

## Performance

- **Duration:** 11 min
- **Started:** 2026-02-24T10:45:49Z
- **Completed:** 2026-02-24T10:56:49Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- User model enhanced with Vertretung fields (vertreterId, vertretungAktiv, vertretungVon/Bis) and UrlaubZeitraum model
- Frist-Reminder worker routes notifications to Vertreter when user is on vacation with escalation chain
- Settings Export/Import as JSON with full round-trip support (SystemSettings, FristPresets, Briefkoepfe, OrdnerSchemata)
- Onboarding-Wizard guides new admins through 6 essential setup steps (skippable)
- Vertretung/Urlaub settings tab with active vacation display, deputy assignment, and vacation CRUD

## Task Commits

Each task was committed atomically:

1. **Task 1: Vertretung & Urlaub Schema + APIs + Reminder Worker Enhancement** - `35e131a` (feat)
2. **Task 2: Vertretung/Urlaub Settings Tab + Onboarding-Wizard + Import/Export Tab** - `e95272e` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added vertreterId, vertretungAktiv, vertretungVon/Bis to User; UrlaubZeitraum model; KalenderEintrag sachbearbeiter/quittiert relations
- `src/app/api/users/[id]/vertretung/route.ts` - GET/PUT API for Vertretung management with auth and audit
- `src/app/api/users/[id]/urlaub/route.ts` - GET/POST/DELETE API for vacation period CRUD with overlap validation
- `src/app/api/einstellungen/export/route.ts` - JSON export of all settings (ADMIN only)
- `src/app/api/einstellungen/import/route.ts` - JSON import with upsert logic and summary response (ADMIN only)
- `src/workers/processors/frist-reminder.ts` - Frist reminder worker with Vertretung-aware routing and auto-deactivation
- `src/lib/audit.ts` - Added VERTRETUNG_*, URLAUB_*, EINSTELLUNGEN_* audit actions
- `src/lib/notifications/types.ts` - Added frist:vorfrist and frist:ueberfaellig notification types
- `src/components/notifications/notification-center.tsx` - Added icons/colors for new notification types
- `src/components/einstellungen/vertretung-urlaub-tab.tsx` - Full Vertretung/Urlaub management UI
- `src/components/einstellungen/onboarding-wizard.tsx` - 6-step guided setup wizard
- `src/components/einstellungen/import-export-tab.tsx` - Settings export download and import with preview
- `src/app/(dashboard)/einstellungen/page.tsx` - Tab-based settings page with Vertretung, Import/Export, and OnboardingWizard

## Decisions Made
- Vertretung auto-deactivation runs at the start of each reminder worker cycle to prevent stale vacation states
- Settings export intentionally excludes Briefkopf file references (dateipfad, logoUrl) -- files must be uploaded separately per the plan spec
- OnboardingWizard uses the import API endpoint to save settings for a single consistent upsert path
- Frist escalation chain: Verantwortlicher -> Vertreter (if on vacation) -> Admin (always for overdue)
- Einstellungen page converted from server component to client component for tab interactivity

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed missing KalenderEintrag relation fields**
- **Found during:** Task 1 (Schema validation)
- **Issue:** External schema modifications added sachbearbeiterKalender and quittierteFristen relations on User without corresponding fields on KalenderEintrag
- **Fix:** Added sachbearbeiterId/sachbearbeiter and quittiertVonId/quittiertVon fields to KalenderEintrag model
- **Files modified:** prisma/schema.prisma
- **Verification:** prisma validate and prisma generate succeed
- **Committed in:** 35e131a (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added frist notification types to notification system**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** frist:vorfrist and frist:ueberfaellig types not in NotificationType union, causing type errors in worker and notification center
- **Fix:** Added new types to NotificationType, updated notification-center icon/color maps
- **Files modified:** src/lib/notifications/types.ts, src/components/notifications/notification-center.tsx
- **Verification:** npx tsc --noEmit passes
- **Committed in:** 35e131a (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both fixes necessary for schema validity and type safety. No scope creep.

## Issues Encountered
- Database not running locally (db push failed) -- non-blocking, schema validates and client generates successfully
- Pre-existing build failure in src/app/api/ordner-schemata/route.ts (exports non-route function) -- out of scope, not caused by this plan

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Vertretung/Urlaub system fully implemented, ready for integration with Akte workflows
- Settings export/import provides backup/restore capability for production deployments
- Onboarding wizard will activate on first admin login in fresh deployments

## Self-Check: PASSED

All 9 created files verified on disk. Both task commits (35e131a, e95272e) verified in git log.

---
*Phase: 02-deadline-calculation-document-templates*
*Completed: 2026-02-24*
