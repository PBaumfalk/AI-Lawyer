# Phase 41: Team-Dashboard + Reporting - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Admins see aggregated team health metrics on a dedicated dashboard page: quest fulfillment rate, backlog delta trend, and bossfight team damage. No per-person breakdowns (DSGVO). Admin can export a monthly report as PDF or CSV with Backlog-Delta, Billing-Delta, and Quest fulfillment rates.

</domain>

<decisions>
## Implementation Decisions

### Page Placement & Access
- New admin sub-page at `/admin/team-dashboard` (tab in existing admin navigation bar)
- ADMIN-only access (consistent with existing admin pages, uses existing layout.tsx RBAC check)
- Tab labeled "Team-Dashboard" in admin nav alongside Audit-Trail, System, etc.

### Trend Visualization
- Line chart for backlog delta historical view (weekly data points over time)
- 8 weeks of history (~2 months), enough to spot patterns without overwhelming
- Recharts library for chart rendering — most popular React chart lib, declarative, ~45KB
- Trend indicator with traffic light colors: fallend = emerald (good, backlog shrinking), steigend = rose (bad, growing), stabil = amber
- Trend direction shown as arrow icon + color-coded text next to the KPI number

### Metric Card Design
- Top row: 3 GlassKpiCards (quest fulfillment rate %, current backlog count, total bossfight damage)
- Below KPI row: GlassPanel sections with backlog trend chart and bossfight history
- Follows main dashboard layout pattern (responsive grid: 1 → 3 columns)

### Quest Fulfillment Rate
- Team average percentage across all opted-in users
- Formula: average of (completed quests / available quests) per opted-in user
- Display as "Team erfüllt X% der Kernquests" with animated GlassKpiCard counter

### Backlog Delta
- Weekly backlog count (open Wiedervorlagen) with trend direction
- Uses existing WeeklySnapshot model for historical baselines
- Line chart shows 8 weekly data points
- Current week delta shown as +/- number with color coding

### Bossfight Damage
- Latest/active bossfight damage prominent at top of bossfight section
- Below: list of past bossfights with date, boss name, total team damage, outcome (defeated/active)
- All damage shown as team aggregate (no per-person MVP callout — DSGVO)

### Monthly Report Export
- Export button in top-right corner of Team Dashboard page
- Dropdown with two options: "PDF" and "CSV"
- Time range: last calendar month (one-click, no date picker needed — e.g., "Export Februar 2026")
- PDF: table-based with Kanzlei-Briefkopf header, sections for Backlog-Delta, Billing-Delta, Quest-Erfüllungsquoten
- CSV: summary rows (same aggregated metrics as PDF), one row per metric per week
- Reuses existing pdf-lib patterns from invoice PDF generator
- Reuses existing CSV export pattern from audit-trail export

### Billing-Delta Definition
- Rechnungen delta: compare Rechnung count and total € billed this month vs. last month
- Data sourced from existing Rechnung model
- Shows billing productivity trend (e.g., "+12% vs. Vormonat")

### Claude's Discretion
- Exact Recharts configuration and styling to match glass UI
- Chart tooltip design and interaction
- GlassKpiCard color assignment for each metric
- Bossfight history list pagination (if many bossfights)
- PDF layout details (table widths, section spacing)
- Loading states for the dashboard page

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GlassKpiCard` (`src/components/ui/glass-kpi-card.tsx`): Animated number counter, 4 color variants — use for top KPI row
- `GlassCard` / `GlassPanel`: Glass containers for chart sections and bossfight history
- `pdf-lib` PDF generator (`src/lib/finance/invoice/pdf-generator.ts`): A4 layout, drawText/drawLine helpers, page breaks, Briefkopf — reuse for report PDF
- CSV export pattern (`src/app/api/admin/audit-trail/export/route.ts`): TextEncoder + Content-Disposition header
- `WeeklySnapshot` model: Stores weekly aggregate counts per model — source for backlog delta history
- `BossfightDamage` model: Per-user damage records with `_sum` groupBy pattern from boss-engine.ts
- `QuestCompletion` model: Per-user per-quest per-day completion records
- Admin layout (`src/app/(dashboard)/admin/layout.tsx`): ADMIN role check, sub-navigation tabs

### Established Patterns
- Dashboard: Server component with parallel Promise.all() data fetching
- KPI cards: Responsive grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- Prisma groupBy + `_sum` / `_count` for aggregation (used in boss-engine.ts)
- Admin pages: force-dynamic export, filter state from URL searchParams
- Export API routes: Return NextResponse with appropriate content-type and disposition headers

### Integration Points
- Admin layout navigation: Add "Team-Dashboard" tab to existing admin nav
- `/api/admin/team-dashboard/route.ts`: New API for aggregated team metrics
- `/api/admin/team-dashboard/export/route.ts`: New API for PDF/CSV generation
- Rechnung model: Query for billing delta (sum of nettoBetrag, count, grouped by month)
- KalenderEintrag model: Query for backlog count (typ=WIEDERVORLAGE, erledigt=false)
- Bossfight model: Query for historical bossfights with aggregated damage

</code_context>

<specifics>
## Specific Ideas

- No per-person breakdowns anywhere — DSGVO compliance is non-negotiable (decided in Phase 33)
- Traffic light colors for trends match existing risk color system (emerald/amber/rose)
- Export should feel professional — Briefkopf header on PDF like invoice exports
- "Team erfüllt X% der Kernquests" as the headline metric for quest fulfillment

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 41-team-dashboard-reporting*
*Context gathered: 2026-03-03*
