---
phase: 07-rollen-sicherheit-compliance-observability
plan: 02
subsystem: compliance, observability
tags: [audit-trail, dsgvo, anonymization, health-checks, pdf-lib, timeline, email-alerts]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation
    provides: Health endpoint, admin layout, email sending
  - phase: 02-deadline-calculation-document-templates
    provides: pdf-lib PDF generation patterns
provides:
  - System-wide audit trail with timeline UI, filtering, and CSV/PDF export
  - AKTION_LABELS mapping for all 50+ audit event types
  - DSGVO anonymization library with 10-year retention enforcement
  - Auskunftsrecht (Art. 15 DSGVO) PDF export
  - Extended health checks (8 services including Ollama and Stirling-PDF)
  - Auth-gated health endpoint (public basic / admin detailed)
  - Email alerts on service failure with 60-minute cooldown
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [cursor-pagination-with-filtering, dsgvo-anonymization-transaction, auth-gated-endpoint, health-alert-cooldown]

key-files:
  created:
    - src/app/api/admin/audit-trail/route.ts
    - src/app/api/admin/audit-trail/export/route.ts
    - src/app/(dashboard)/admin/audit-trail/page.tsx
    - src/components/audit/audit-timeline.tsx
    - src/components/audit/audit-export-dialog.tsx
    - src/components/audit/audit-dashboard-widget.tsx
    - src/lib/dsgvo/anonymize.ts
    - src/lib/dsgvo/auskunft.ts
    - src/app/api/dsgvo/anonymize/route.ts
    - src/app/api/dsgvo/auskunft/route.ts
    - src/app/(dashboard)/admin/dsgvo/page.tsx
    - src/lib/health/checks.ts
    - src/lib/health/alerts.ts
  modified:
    - src/lib/audit.ts
    - src/lib/auth.ts
    - src/app/api/health/route.ts
    - src/app/(dashboard)/admin/system/page.tsx
    - src/app/(dashboard)/admin/layout.tsx

key-decisions:
  - "AKTION_LABELS as exported Record in audit.ts for reuse across timeline UI and export"
  - "SECURITY_ACTIONS set for highlighting login failures and access denials in timeline"
  - "Prisma.AnyNull for filtering non-null JSON details in audit log queries"
  - "AktenKontoBuchung model name for Aktenkonto entries in Auskunft PDF"
  - "Auth-gated health: public returns basic status object, admin gets full service details"
  - "In-memory cooldown Map for health alerts (60 min per service)"
  - "Fire-and-forget health alert checks on every health endpoint call"

patterns-established:
  - "DSGVO anonymization: Prisma transaction with never-delete semantics, field-by-field replacement"
  - "Audit timeline: date-grouped activity stream with user avatars and security markers"
  - "Health alert cooldown: in-memory Map with per-service timestamp tracking"
  - "Auth-gated API: same endpoint returns different detail levels based on session role"

requirements-completed: [REQ-RS-004, REQ-RS-005, REQ-RS-006]

# Metrics
duration: 10min
completed: 2026-02-25
---

# Phase 7 Plan 2: Audit-Trail + DSGVO + Health Summary

**System-wide audit trail timeline with filtering/export, DSGVO anonymization with 10-year retention, Auskunftsrecht PDF, and 8-service health monitoring with email alerts**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-25T07:57:22Z
- **Completed:** 2026-02-25T08:07:22Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments

- System-wide audit trail page at /admin/audit-trail with cursor pagination, 6-filter bar (user, akte, action, date range, text search), date-grouped timeline with user avatars, Vorher/Nachher diffs, and security markers
- DSGVO compliance: anonymization with Prisma transaction (never deletes), 10-year retention check, dry-run preview, admin override, and Art. 15 Auskunftsrecht PDF export
- Extended health checks covering 8 Docker services (PostgreSQL, Redis, MinIO, Meilisearch, OnlyOffice, Worker, Ollama, Stirling-PDF) with auth-gated detail levels and email alerts on failure

## Task Commits

Each task was committed atomically:

1. **Task 1: System-wide Audit-Trail timeline + per-Akte enhancement + dashboard widget + export** - `faff785` (feat)
2. **Task 2: DSGVO compliance + extended health checks + email alerts** - `21bc11e` (feat)

## Files Created/Modified

- `src/lib/audit.ts` - Extended with 50+ AKTION_LABELS, SECURITY_ACTIONS set, new event types (AKTE_GEOEFFNET, LOGIN_FEHLGESCHLAGEN, DSGVO_*), ipAdresse param
- `src/app/api/admin/audit-trail/route.ts` - System-wide audit trail API with cursor pagination and 6 filter params
- `src/app/api/admin/audit-trail/export/route.ts` - CSV and PDF export endpoint (max 10k entries) using pdf-lib
- `src/components/audit/audit-timeline.tsx` - Reusable timeline component with date grouping, avatars, diffs, security badges, compact mode
- `src/components/audit/audit-export-dialog.tsx` - Export dialog with format selection and date range
- `src/components/audit/audit-dashboard-widget.tsx` - Compact widget showing last 5 events for admin system page
- `src/app/(dashboard)/admin/audit-trail/page.tsx` - Full audit trail admin page with filters stored in URL
- `src/lib/auth.ts` - Failed login logging in NextAuth authorize callback
- `src/app/(dashboard)/admin/layout.tsx` - Added Audit-Trail and DSGVO nav links
- `src/app/(dashboard)/admin/system/page.tsx` - Added Ollama/Stirling-PDF service config and audit widget
- `src/lib/dsgvo/anonymize.ts` - Anonymization library with Prisma transaction, field-by-field PII replacement, retention enforcement
- `src/lib/dsgvo/auskunft.ts` - Auskunftsrecht PDF with Kontaktdaten, Akten, Dokumente, Kalender, Buchungen sections
- `src/app/api/dsgvo/anonymize/route.ts` - POST endpoint with dry-run and force-override support
- `src/app/api/dsgvo/auskunft/route.ts` - GET endpoint generating PDF download
- `src/app/(dashboard)/admin/dsgvo/page.tsx` - DSGVO admin page with Auskunft search, anonymization workflow, and history
- `src/lib/health/checks.ts` - Ollama and Stirling-PDF health check functions
- `src/lib/health/alerts.ts` - Email alert system with 60-minute per-service cooldown
- `src/app/api/health/route.ts` - Extended with 8 services, auth-gated response levels, alert triggering

## Decisions Made

- Used AKTION_LABELS as an exported Record<string, string> in audit.ts so both the timeline UI and PDF export can share the same label mapping
- SECURITY_ACTIONS as a Set for O(1) lookup when highlighting security events in the timeline
- Auth-gated health endpoint: unauthenticated requests get basic `{ status }` (Docker healthcheck compatible), admin gets full service detail
- In-memory Map for health alert cooldown (60 min per service) -- simple, no Redis dependency for alerts
- Fire-and-forget alert check on every health endpoint call (non-blocking, errors caught)
- `Prisma.AnyNull` for filtering non-null JSON fields (not `null` which is a TS type mismatch with Prisma's JSON filter)
- DSGVO anonymization replaces PII with placeholder text (never deletes records) per BRAO/GoBD requirements

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Prisma JSON null filter type**
- **Found during:** Task 2 (anonymize.ts)
- **Issue:** `details: { not: null }` causes TS2322 because Prisma's JSON filter expects `InputJsonValue | JsonNullValueFilter`, not `null`
- **Fix:** Used `Prisma.AnyNull` from `@prisma/client`
- **Files modified:** src/lib/dsgvo/anonymize.ts
- **Committed in:** 21bc11e

**2. [Rule 1 - Bug] Fixed Aktenkonto model name**
- **Found during:** Task 2 (auskunft.ts)
- **Issue:** Used `prisma.aktenkontoEintrag` but Prisma model is `AktenKontoBuchung` with fields `verwendungszweck` and `buchungstyp`
- **Fix:** Updated to `prisma.aktenKontoBuchung` with correct field names
- **Files modified:** src/lib/dsgvo/auskunft.ts
- **Committed in:** 21bc11e

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered

None - plan executed with minor model name corrections during implementation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 7 plans complete (07-01 RBAC + 07-02 Compliance/Observability)
- Admin has full compliance toolkit: RBAC, audit trail, DSGVO, health monitoring
- Ready for production hardening and deployment

## Self-Check: PASSED

All 18 created/modified files verified present on disk. Both task commits (faff785, 21bc11e) verified in git log.

---
*Phase: 07-rollen-sicherheit-compliance-observability*
*Completed: 2026-02-25*
