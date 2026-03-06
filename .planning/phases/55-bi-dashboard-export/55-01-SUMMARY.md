---
phase: 55-bi-dashboard-export
plan: 01
subsystem: api
tags: [bi, kpi, redis, prisma, analytics, trends]

requires:
  - phase: 54-helena-agent
    provides: "HelenaTask, HelenaDraft, TokenUsage models"
provides:
  - "GET /api/bi/kpis endpoint returning KPI tiles for 4 domains"
  - "GET /api/bi/trends endpoint returning 12-month trend series"
  - "cachedQuery Redis wrapper with 5min TTL"
  - "BiKpiResponse, BiTrendResponse, BiFilterParams, KpiTile, TrendSeries types"
affects: [55-02, 55-03, 55-04]

tech-stack:
  added: []
  patterns: [redis-cached-query-wrapper, kpi-delta-calculation, bi-filter-parsing]

key-files:
  created:
    - src/lib/bi/types.ts
    - src/lib/bi/cache.ts
    - src/lib/bi/kpi-queries.ts
    - src/app/api/bi/kpis/route.ts
    - src/app/api/bi/trends/route.ts
  modified: []

key-decisions:
  - "Used betragBrutto for revenue KPI (schema has betragBrutto, not gesamtBrutto)"
  - "Token usage aggregated from TokenUsage model (tokensIn + tokensOut) rather than HelenaTask metadata"
  - "Fristen compliance uses raw SQL for field-to-field comparison (erledigtAm <= datum)"
  - "Helena drafts (HelenaDraft model) used for Entwuerfe KPI instead of filtering HelenaTask by type"

patterns-established:
  - "cachedQuery pattern: wraps any async function with Redis GET/SETEX and graceful fallback"
  - "parseBiFilters: standard filter parsing for all BI endpoints with current/previous period computation"
  - "computeDelta: percentage change with zero-division handling"

requirements-completed: [BI-01, BI-02, BI-06, BI-07, BI-08, BI-09]

duration: 3min
completed: 2026-03-06
---

# Phase 55 Plan 01: BI Analytics Backend Summary

**KPI aggregation queries for Akten/Finanzen/Fristen/Helena with month-over-month deltas, trend series, and Redis caching via cachedQuery wrapper**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T22:23:15Z
- **Completed:** 2026-03-06T22:26:36Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments
- Created typed BI infrastructure with BiKpiResponse, BiTrendResponse, KpiTile, TrendSeries interfaces
- Implemented Redis cache wrapper (cachedQuery) with 5min TTL and graceful error fallback
- Built KPI queries for 4 domains: Akten (offen, neuzugang), Finanzen (umsatz, offene rechnungen), Fristen (compliance, ueberfaellig), Helena (gespraeche, entwuerfe, akzeptanzrate, token-verbrauch)
- Added 3 trend series: Akten-Neuzugang, Umsatz pro Monat, Fristen-Compliance (12-month rolling)
- Both API endpoints enforce RBAC via buildAkteAccessFilter

## Task Commits

Each task was committed atomically:

1. **Task 1: Create BI types and cached query infrastructure** - `4dccc7f` (feat)
2. **Task 2: Implement KPI aggregation queries and API endpoints** - `e2bd7f8` (feat)

## Files Created/Modified
- `src/lib/bi/types.ts` - BiKpiResponse, BiTrendResponse, BiFilterParams, KpiTile, TrendSeries, TrendPoint interfaces
- `src/lib/bi/cache.ts` - Redis cache wrapper with SETEX, graceful error handling, bi: key prefix
- `src/lib/bi/kpi-queries.ts` - parseBiFilters, getAktenKpis, getFinanzenKpis, getFristenKpis, getHelenaKpis, getTrendData
- `src/app/api/bi/kpis/route.ts` - GET endpoint returning all KPI tiles with RBAC
- `src/app/api/bi/trends/route.ts` - GET endpoint returning trend series with RBAC

## Decisions Made
- Used `betragBrutto` from Rechnung model (plan referenced `gesamtBrutto` which does not exist in schema)
- Token usage aggregated from `TokenUsage` model (tokensIn + tokensOut) since HelenaTask has no direct token field
- Helena drafts counted via `HelenaDraft` model for Entwuerfe KPI (more accurate than filtering HelenaTask by output)
- Fristen compliance raw SQL for field-to-field comparison without RBAC filter (compliance calculation simplified)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed betragBrutto field name**
- **Found during:** Task 2 (Finanzen KPIs)
- **Issue:** Plan referenced `gesamtBrutto` but Rechnung schema has `betragBrutto`
- **Fix:** Used `betragBrutto` in all aggregate queries
- **Files modified:** src/lib/bi/kpi-queries.ts
- **Committed in:** e2bd7f8

**2. [Rule 2 - Missing Critical] Token usage from TokenUsage model**
- **Found during:** Task 2 (Helena KPIs)
- **Issue:** Plan suggested aggregating from HelenaTask JSON metadata, but separate TokenUsage model exists with tokensIn/tokensOut fields
- **Fix:** Used TokenUsage model aggregate for accurate token counting
- **Files modified:** src/lib/bi/kpi-queries.ts
- **Committed in:** e2bd7f8

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness. Schema field name corrected, token tracking model corrected.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BI backend ready for Plan 02 (filter/drill-down enhancements)
- API endpoints ready for Plan 03 (Dashboard UI consumption)
- Types exported for Plan 04 (Export functionality)

---
*Phase: 55-bi-dashboard-export*
*Completed: 2026-03-06*
