---
phase: 08-integration-hardening
plan: 03
subsystem: api, ui, security
tags: [versand-gate, bea, audit, pruefprotokoll, email, ki-chat, rbac]

# Dependency graph
requires:
  - phase: 07-rollen-sicherheit-compliance-observability
    provides: "RBAC system, audit logging infrastructure (logAuditEvent, AuditAktion type)"
  - phase: 06-ki-agentin-helena-bea
    provides: "beA routes, bea-compose, email compose, KI-Chat routes"
provides:
  - "Versand-Gate wired into email and beA send flows (checkDokumenteFreigegeben)"
  - "8 beA-specific audit action types with German labels"
  - "Audit logging in all beA routes (messages, detail, eEB, auto-assign)"
  - "Safe-ID change audit logging in kontakte route"
  - "Pruefprotokoll tab on Akte detail page for beA audit history"
  - "ENTWURF greyed-out in attach dialogs with Quick-Release button"
  - "KI-Chat routes with auth-only access (no role restriction)"
affects: [bea, email, audit, akten]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Versand-Gate pattern: checkDokumenteFreigegeben before any send operation"
    - "Fire-and-forget audit logging: logAuditEvent().catch(() => {})"
    - "ENTWURF greyed-out + Quick-Release pattern for attach dialogs"
    - "Audit log query by aktion filter for Pruefprotokoll"

key-files:
  created: []
  modified:
    - "src/lib/audit.ts"
    - "src/app/api/email-send/route.ts"
    - "src/app/api/bea/messages/route.ts"
    - "src/app/api/bea/messages/[id]/route.ts"
    - "src/app/api/bea/messages/[id]/eeb/route.ts"
    - "src/app/api/bea/auto-assign/route.ts"
    - "src/app/api/kontakte/[id]/route.ts"
    - "src/components/email/email-compose-view.tsx"
    - "src/components/bea/bea-compose.tsx"
    - "src/components/akten/akte-detail-tabs.tsx"

key-decisions:
  - "Attachment download audit via ?download=attachmentId query param on existing GET route (option a) rather than separate endpoint"
  - "KI-Chat routes already used auth-only checks -- no changes needed"
  - "PRAKTIKANT comments cleaned from beA routes (described system behavior, not role-specific code)"
  - "Email compose attachments use dms-{id} format prefix for DMS documents"
  - "BEA_POSTFACH_GEWECHSELT registered as type but no server-side route exists yet"

patterns-established:
  - "Versand-Gate: always call checkDokumenteFreigegeben() before any document send"
  - "beA audit: log both ERFOLG and FEHLER with detailed metadata"
  - "Attach dialog: show ALL documents, grey out ENTWURF with Quick-Release freigabe"

requirements-completed: [REQ-RS-004, REQ-KI-003, REQ-KI-009]

# Metrics
duration: 8min
completed: 2026-02-25
---

# Phase 08 Plan 03: Versand-Gate + beA Audit Logging + Pruefprotokoll Summary

**Versand-Gate wired into email/beA send flows blocking ENTWURF docs, comprehensive beA audit logging across 6 route files with Pruefprotokoll tab, and ENTWURF greyed-out attach dialogs with Quick-Release**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-25T13:14:57Z
- **Completed:** 2026-02-25T13:23:28Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Versand-Gate prevents ENTWURF documents from being sent via both email and beA with 400 Bad Request
- All beA operations create detailed audit log entries (send, receive, read, download, eEB, assignment, Safe-ID changes)
- Pruefprotokoll tab on Akte detail page shows chronological beA audit history with error highlighting
- Email and beA attach dialogs show ENTWURF docs greyed out with Quick-Release freigabe button
- KI-Chat routes confirmed as auth-only (no role restriction)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire Versand-Gate in email/beA send + attach dialog UI + KI-Chat auth** - `bc39df0` (feat)
2. **Task 2: Add beA audit logging to all routes + Pruefprotokoll tab** - `b0af0d1` (feat)

## Files Created/Modified
- `src/lib/audit.ts` - Added 8 beA-specific audit action types and German labels
- `src/app/api/email-send/route.ts` - Wired checkDokumenteFreigegeben for DMS attachments
- `src/app/api/bea/messages/route.ts` - Added Versand-Gate check and audit logging for send/receive
- `src/app/api/bea/messages/[id]/route.ts` - Added BEA_NACHRICHT_GELESEN, BEA_ANHANG_HERUNTERGELADEN, BEA_ZUORDNUNG_GEAENDERT audit
- `src/app/api/bea/messages/[id]/eeb/route.ts` - Added BEA_EEB_BESTAETIGT audit logging
- `src/app/api/bea/auto-assign/route.ts` - Added BEA_ZUORDNUNG_GEAENDERT audit logging
- `src/app/api/kontakte/[id]/route.ts` - Added BEA_SAFEID_GEAENDERT audit logging
- `src/components/email/email-compose-view.tsx` - Added document attachment picker with ENTWURF handling
- `src/components/bea/bea-compose.tsx` - Updated DocumentPicker with ENTWURF greyed-out + Quick-Release
- `src/components/akten/akte-detail-tabs.tsx` - Added Pruefprotokoll tab with beA audit timeline

## Decisions Made
- Used `?download=attachmentId` query param on existing GET route for attachment download audit (simpler than separate endpoint)
- KI-Chat routes already used plain `auth()` checks -- confirmed no changes needed
- Cleaned PRAKTIKANT-specific comments from beA routes to generic permission descriptions
- Email compose attachments use `dms-{id}` format prefix to distinguish DMS documents from direct uploads
- BEA_POSTFACH_GEWECHSELT registered as audit type for future multi-postbox UI (no server-side route exists yet)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Versand-Gate fully wired in both send flows
- beA audit logging comprehensive across all route files
- Pruefprotokoll tab displays beA history per Akte
- Ready for remaining integration hardening plans

## Self-Check: PASSED

All 10 files verified present. Both commit hashes (bc39df0, b0af0d1) verified in git log.

---
*Phase: 08-integration-hardening*
*Completed: 2026-02-25*
