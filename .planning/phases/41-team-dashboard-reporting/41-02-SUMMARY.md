---
phase: 41-team-dashboard-reporting
plan: 02
subsystem: api, ui, pdf
tags: [pdf-lib, csv-export, team-dashboard, admin, briefkopf, monthly-report]

requires:
  - phase: 41-01
    provides: Team Dashboard page, team-metrics.ts service, WeeklySnapshot Wiedervorlage entries
  - phase: 28-falldatenblaetter-schema-templates
    provides: pdf-lib dependency already in project

provides:
  - GET /api/admin/team-dashboard/export?format=pdf|csv endpoint for monthly report
  - PDF report with Kanzlei Briefkopf, Backlog-Delta table, Billing-Delta, Quest fulfillment rate
  - CSV report with semicolon delimiter for German Excel compatibility
  - ExportDropdown client component in Team Dashboard header

affects: []

tech-stack:
  added: []
  patterns: [pdf-lib monthly report with Briefkopf pattern, export dropdown with click-outside detection]

key-files:
  created:
    - src/app/api/admin/team-dashboard/export/route.ts
    - src/components/admin/team-dashboard/export-dropdown.tsx
  modified:
    - src/app/(dashboard)/admin/team-dashboard/page.tsx

key-decisions:
  - "Workday-based quest rate: total completions / (quests * users * workdays) for accurate monthly aggregate"
  - "PDF uses Briefkopf pattern from invoice pdf-generator with kanzlei address line"
  - "CSV semicolon delimiter for German Excel compatibility (matching audit-trail export pattern)"

patterns-established:
  - "Monthly report PDF: Briefkopf header, section-based layout, delta coloring (emerald/rose)"
  - "Export dropdown: click-outside useRef pattern, window.open for file download"

requirements-completed: [TEAM-04]

duration: 3min
completed: 2026-03-03
---

# Phase 41 Plan 02: Monthly Report Export Summary

**Monthly team report export (PDF with Kanzlei Briefkopf + CSV) covering Backlog-Delta, Billing-Delta, and Quest fulfillment rates for last calendar month**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T09:29:15Z
- **Completed:** 2026-03-03T09:32:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Export API route generating PDF and CSV monthly reports for ADMIN users
- PDF with Kanzlei Briefkopf header, 3 data sections (backlog-delta table, billing-delta, quest rate), and footer
- CSV with summary metrics row + weekly backlog breakdown, semicolon delimiter for German Excel
- ExportDropdown button wired into Team Dashboard page header with click-outside auto-close

## Task Commits

Each task was committed atomically:

1. **Task 1: Monthly report export API route (PDF + CSV)** - `e1f79a1` (feat)
2. **Task 2: Export dropdown button + wire into Team Dashboard page** - `e730b9a` (feat)

## Files Created/Modified
- `src/app/api/admin/team-dashboard/export/route.ts` - GET endpoint with ?format=pdf|csv, gathers backlog/billing/quest data, generates PDF (Briefkopf, tables) or CSV
- `src/components/admin/team-dashboard/export-dropdown.tsx` - Client dropdown with PDF/CSV download options, click-outside detection
- `src/app/(dashboard)/admin/team-dashboard/page.tsx` - Added ExportDropdown with month label in header

## Decisions Made
- Used workday-based formula for monthly quest rate: totalCompletions / (dailyQuests * optInUsers * workdays) -- gives accurate monthly engagement metric
- PDF follows Briefkopf layout pattern from invoice pdf-generator (A4, 20mm margins, kanzlei name + address)
- Delta coloring: rose for backlog increase, emerald for decrease (matching traffic light convention from Plan 01)
- Billing delta: green for increase (revenue up is positive), red for decrease

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 41 complete: Team Dashboard with KPIs, charts, and monthly export
- All TEAM requirements (TEAM-01 through TEAM-04) satisfied
- v0.4 milestone fully complete (all 20 plans executed)

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 41-team-dashboard-reporting*
*Completed: 2026-03-03*
