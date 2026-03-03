---
phase: 41-team-dashboard-reporting
plan: 01
subsystem: ui, api, gamification
tags: [recharts, prisma, glass-ui, team-dashboard, kpi, admin]

requires:
  - phase: 35-bossfight
    provides: Bossfight and BossfightDamage models, boss-engine queries
  - phase: 37-quest-weekly-snapshot
    provides: WeeklySnapshot model, weekly-snapshot.ts cron job
  - phase: 33-gamification-schema
    provides: Quest, QuestCompletion, UserGameProfile models, gamificationOptIn field

provides:
  - Team Dashboard admin page at /admin/team-dashboard with 3 KPI cards
  - Recharts backlog trend line chart (8-week history)
  - Bossfight history component with team damage aggregates
  - team-metrics.ts shared service for aggregated team KPIs
  - WeeklySnapshot "Wiedervorlage" model entries for backlog delta tracking
  - GET /api/admin/team-dashboard API endpoint

affects: [41-02-PLAN (export), admin-navigation]

tech-stack:
  added: [recharts]
  patterns: [shared service pattern (team-metrics.ts used by both page and API route)]

key-files:
  created:
    - src/lib/gamification/team-metrics.ts
    - src/app/api/admin/team-dashboard/route.ts
    - src/app/(dashboard)/admin/team-dashboard/page.tsx
    - src/components/admin/team-dashboard/backlog-trend-chart.tsx
    - src/components/admin/team-dashboard/bossfight-history.tsx
  modified:
    - src/lib/gamification/weekly-snapshot.ts
    - src/app/(dashboard)/admin/layout.tsx

key-decisions:
  - "Shared team-metrics.ts service called by both server page and API route (avoids self-fetch pattern)"
  - "Recharts LineChart for backlog trend visualization with custom glass-style tooltip"
  - "Traffic light trend colors: emerald=fallend, rose=steigend, amber=stabil (matching risk color system)"
  - "WeeklySnapshot uses findFirst+create/update pattern for nullable userId (PostgreSQL NULL != NULL)"

patterns-established:
  - "Admin dashboard pattern: server component page calling shared service, client chart components"
  - "Team-aggregate-only queries: no per-user data leaves service layer (DSGVO compliance)"

requirements-completed: [TEAM-01, TEAM-02, TEAM-03]

duration: 4min
completed: 2026-03-03
---

# Phase 41 Plan 01: Team Dashboard Summary

**Admin Team Dashboard with quest fulfillment rate, backlog delta trend chart (Recharts), and bossfight team damage history -- all team-aggregated for DSGVO compliance**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T09:21:52Z
- **Completed:** 2026-03-03T09:26:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Team Dashboard admin page with 3 GlassKpiCards showing quest fulfillment %, backlog count with trend, bossfight damage
- Recharts line chart visualizing 8 weeks of Wiedervorlage backlog delta history
- Bossfight history list with team damage aggregates and status badges
- WeeklySnapshot extended to capture kanzlei-wide Wiedervorlage counts for trend tracking
- Shared team-metrics.ts service with parallel query execution via Promise.all

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend WeeklySnapshot for WIEDERVORLAGE + Team Dashboard API route** - `966cc4c` (feat)
2. **Task 2: Team Dashboard page + Recharts chart + Bossfight history + Admin nav entry** - `d66710d` (feat)

## Files Created/Modified
- `src/lib/gamification/team-metrics.ts` - Shared service with quest fulfillment rate, backlog delta, bossfight history queries
- `src/app/api/admin/team-dashboard/route.ts` - ADMIN-only GET endpoint returning aggregated team metrics JSON
- `src/app/(dashboard)/admin/team-dashboard/page.tsx` - Server component page with KPI cards, chart, and history sections
- `src/components/admin/team-dashboard/backlog-trend-chart.tsx` - Recharts LineChart for backlog trend visualization
- `src/components/admin/team-dashboard/bossfight-history.tsx` - Bossfight history list with team damage and status badges
- `src/lib/gamification/weekly-snapshot.ts` - Extended with Wiedervorlage snapshot per kanzlei
- `src/app/(dashboard)/admin/layout.tsx` - Added "Team-Dashboard" nav entry

## Decisions Made
- Used shared team-metrics.ts service (called directly by server component page and API route) instead of self-fetch pattern
- Recharts installed as new dependency for line chart visualization
- Traffic light trend colors follow existing risk color system (emerald=fallend, rose=steigend, amber=stabil)
- WeeklySnapshot uses findFirst+create/update for nullable userId compound unique (PostgreSQL NULL != NULL edge case)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Team Dashboard page ready for Plan 02 (export button placeholder in place)
- Recharts available for any future chart needs
- team-metrics.ts service can be extended with additional team KPIs

---
*Phase: 41-team-dashboard-reporting*
*Completed: 2026-03-03*
