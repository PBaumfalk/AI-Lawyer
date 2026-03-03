# Phase 41: Team-Dashboard + Reporting - Research

**Researched:** 2026-03-03
**Domain:** Admin analytics dashboard with chart visualization and PDF/CSV export
**Confidence:** HIGH

## Summary

Phase 41 adds a dedicated admin-only Team-Dashboard page at `/admin/team-dashboard` that displays three aggregated KPI metrics (quest fulfillment rate, backlog delta, bossfight team damage) and provides monthly report export in PDF and CSV formats. The implementation sits entirely within the existing admin sub-navigation and leverages established patterns: server component with `Promise.all()` parallel data fetching, `GlassKpiCard` for KPI display, `pdf-lib` for PDF generation, and `TextEncoder` CSV export with `Content-Disposition` headers.

The only new npm dependency is **Recharts** (~45KB gzipped) for the backlog delta line chart. All data queries use existing Prisma models (`QuestCompletion`, `WeeklySnapshot`, `BossfightDamage`, `Rechnung`, `KalenderEintrag`). A critical finding is that the `WeeklySnapshot` service currently only snapshots Tickets and KalenderEintrag (Fristen) -- it does NOT snapshot WIEDERVORLAGE counts, so the weekly snapshot creator must be extended to also capture open Wiedervorlagen for the backlog delta history chart.

**Primary recommendation:** Build as a server-rendered admin page with a single API route for data aggregation and a separate export API route, using Recharts for the trend chart and existing pdf-lib + CSV patterns for export.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- New admin sub-page at `/admin/team-dashboard` (tab in existing admin navigation bar)
- ADMIN-only access (consistent with existing admin pages, uses existing layout.tsx RBAC check)
- Tab labeled "Team-Dashboard" in admin nav alongside Audit-Trail, System, etc.
- Line chart for backlog delta historical view (weekly data points over time)
- 8 weeks of history (~2 months), enough to spot patterns without overwhelming
- Recharts library for chart rendering
- Trend indicator with traffic light colors: fallend = emerald (good, backlog shrinking), steigend = rose (bad, growing), stabil = amber
- Trend direction shown as arrow icon + color-coded text next to the KPI number
- Top row: 3 GlassKpiCards (quest fulfillment rate %, current backlog count, total bossfight damage)
- Below KPI row: GlassPanel sections with backlog trend chart and bossfight history
- Follows main dashboard layout pattern (responsive grid: 1 -> 3 columns)
- Quest fulfillment formula: average of (completed quests / available quests) per opted-in user
- Display as "Team erfullt X% der Kernquests" with animated GlassKpiCard counter
- Backlog delta uses existing WeeklySnapshot model for historical baselines
- Current week delta shown as +/- number with color coding
- Latest/active bossfight damage prominent at top of bossfight section
- Below: list of past bossfights with date, boss name, total team damage, outcome (defeated/active)
- All damage shown as team aggregate (no per-person MVP callout -- DSGVO)
- Export button in top-right corner of Team Dashboard page
- Dropdown with two options: "PDF" and "CSV"
- Time range: last calendar month (one-click, no date picker -- e.g., "Export Februar 2026")
- PDF: table-based with Kanzlei-Briefkopf header, sections for Backlog-Delta, Billing-Delta, Quest-Erfullungsquoten
- CSV: summary rows (same aggregated metrics as PDF), one row per metric per week
- Reuses existing pdf-lib patterns from invoice PDF generator
- Reuses existing CSV export pattern from audit-trail export
- Billing-Delta: compare Rechnung count and total billed this month vs. last month (via Rechnung model)
- No per-person breakdowns anywhere -- DSGVO compliance non-negotiable

### Claude's Discretion
- Exact Recharts configuration and styling to match glass UI
- Chart tooltip design and interaction
- GlassKpiCard color assignment for each metric
- Bossfight history list pagination (if many bossfights)
- PDF layout details (table widths, section spacing)
- Loading states for the dashboard page

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEAM-01 | Erfullungsquote Kernquests als Team-Aggregat (kein per-Person Breakdown) | QuestCompletion model with userId + questId + completedDate provides per-user completions; Quest model filtered by `typ: DAILY` and `aktiv: true` gives available quest count; UserGameProfile (gamificationOptIn users) scopes the denominator; `groupBy userId` then JS average computes team rate |
| TEAM-02 | Backlog-Delta pro Woche (Trend-Anzeige: steigend/fallend/stabil) | WeeklySnapshot model stores weekly counts per model; needs extension to snapshot WIEDERVORLAGE counts; 8 weeks of history queried via `weekStart` ordered DESC; delta = current count minus previous week count; trend direction derived from last 2 data points |
| TEAM-03 | Bossfight-Gesamtschaden als Team-Aggregat | BossfightDamage.aggregate with `_sum: { amount: true }` grouped by bossfightId provides team totals; Bossfight model has name, status, spawnHp, defeatedAt for history display; existing boss-engine.ts pattern shows exact aggregate query |
| TEAM-04 | Monatsreporting (Backlog-Delta, Billing-Delta, Quest-Erfullungsquoten als PDF/CSV) | pdf-lib 1.17.1 with invoice pdf-generator.ts pattern (A4, Briefkopf, drawText/drawLine helpers); CSV via TextEncoder + Content-Disposition from audit-trail export; Rechnung model has betragNetto + rechnungsdatum for billing delta; Kanzlei model has Briefkopf fields |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | ^2.15 | React chart library (LineChart, Tooltip, ResponsiveContainer) | Most popular React charting lib, declarative API, ~45KB gzipped, composable components |
| pdf-lib | ^1.17.1 | Server-side PDF generation | Already installed, used by invoice PDF generator -- zero new dependency |
| date-fns | ^4.1.0 | Date manipulation (startOfWeek, subWeeks, startOfMonth, etc.) | Already installed, used throughout project |
| Next.js 14 App Router | existing | Server components, API routes | Project standard |
| Prisma | existing | Database queries (aggregate, groupBy, count) | Project ORM |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | existing | Icons (TrendingUp, TrendingDown, Minus, Download, FileText, FileSpreadsheet) | Trend arrows, export button icons |
| motion/react | existing | GlassKpiCard animated number counter | Already used by GlassKpiCard |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Victory | Recharts has more React-idiomatic API, larger community; Victory is heavier |
| Recharts | Chart.js + react-chartjs-2 | Chart.js needs canvas, less composable; Recharts is SVG-based, works better with SSR |
| Recharts | shadcn/ui charts | shadcn charts are Recharts wrappers -- using Recharts directly avoids the abstraction |

**Installation:**
```bash
npm install recharts
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/(dashboard)/admin/
│   ├── layout.tsx                           # Add "Team-Dashboard" to adminNavigation array
│   └── team-dashboard/
│       └── page.tsx                         # Server component: parallel data fetch + render
├── app/api/admin/team-dashboard/
│   ├── route.ts                             # GET: aggregated team metrics JSON
│   └── export/
│       └── route.ts                         # GET: PDF or CSV export (?format=pdf|csv)
├── components/admin/
│   └── team-dashboard/
│       ├── backlog-trend-chart.tsx           # Client component: Recharts LineChart
│       ├── bossfight-history.tsx             # Client component: list of past bossfights
│       └── export-dropdown.tsx              # Client component: PDF/CSV export button
└── lib/gamification/
    └── weekly-snapshot.ts                   # EXTEND: add WIEDERVORLAGE snapshot
```

### Pattern 1: Server Component with Parallel Data Fetching
**What:** Admin page as async server component fetching all metrics via Promise.all()
**When to use:** Dashboard pages where data is read-only and can be fetched in parallel
**Example:**
```typescript
// Source: existing pattern from src/app/(dashboard)/dashboard/page.tsx
export default async function TeamDashboardPage() {
  const session = await auth();
  const kanzleiId = (session?.user as any)?.kanzleiId;

  const [questRate, backlogData, bossfightData] = await Promise.all([
    getTeamQuestFulfillmentRate(kanzleiId),
    getBacklogDeltaHistory(kanzleiId, 8), // 8 weeks
    getBossfightHistory(kanzleiId),
  ]);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassKpiCard title="Team erfullt X% der Kernquests" value={questRate} ... />
        ...
      </div>
      {/* Chart section */}
      <GlassPanel elevation="panel">
        <BacklogTrendChart data={backlogData} />
      </GlassPanel>
    </div>
  );
}
```

### Pattern 2: Prisma Aggregate Queries for Team Metrics
**What:** Use Prisma `aggregate`, `groupBy`, and `count` to compute metrics without loading individual records
**When to use:** All team KPI calculations -- never fetch individual user data to the client
**Example:**
```typescript
// Source: existing pattern from src/lib/gamification/boss-engine.ts
// Bossfight total team damage
const damage = await prisma.bossfightDamage.aggregate({
  where: { bossfightId },
  _sum: { amount: true },
});
const totalDamage = damage._sum?.amount ?? 0;

// Billing delta: this month vs last month
const thisMonth = await prisma.rechnung.aggregate({
  where: {
    akte: { kanzleiId },
    rechnungsdatum: { gte: monthStart, lt: monthEnd },
    status: { not: "STORNIERT" },
  },
  _sum: { betragNetto: true },
  _count: { id: true },
});
```

### Pattern 3: Admin Layout Navigation Extension
**What:** Add new tab to existing `adminNavigation` array in admin layout.tsx
**When to use:** Adding new admin sub-pages
**Example:**
```typescript
// Source: src/app/(dashboard)/admin/layout.tsx line 8-19
const adminNavigation = [
  { name: "Job-Monitor", href: "/admin/jobs" },
  // ... existing tabs ...
  { name: "Team-Dashboard", href: "/admin/team-dashboard" }, // NEW
];
```

### Pattern 4: Recharts Line Chart with Glass UI Styling
**What:** Client component wrapper for Recharts LineChart with custom oklch colors
**When to use:** The backlog trend chart
**Example:**
```typescript
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface BacklogTrendChartProps {
  data: Array<{ week: string; count: number }>;
}

export function BacklogTrendChart({ data }: BacklogTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke="hsl(var(--brand-600))"
          strokeWidth={2}
          dot={{ fill: "hsl(var(--brand-600))", r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Pattern 5: PDF Export with Briefkopf (Reuse Invoice Pattern)
**What:** Server-side PDF generation using pdf-lib with Kanzlei letterhead
**When to use:** Monthly report PDF export
**Example:**
```typescript
// Source: reuse pattern from src/lib/finance/invoice/pdf-generator.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Constants from invoice generator
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN_LEFT = 56.69;
const MARGIN_RIGHT = 56.69;

// Kanzlei header + report title + metric sections + footer
```

### Pattern 6: CSV Export (Reuse Audit-Trail Pattern)
**What:** Generate CSV with semicolon delimiter and German locale, return as download
**When to use:** Monthly report CSV export
**Example:**
```typescript
// Source: src/app/api/admin/audit-trail/export/route.ts
const header = "Woche;Backlog-Offen;Backlog-Delta;Billing-Netto;Billing-Delta;Quest-Rate";
const rows = weeklyData.map(row => `${row.week};${row.count};...`);
const csv = [header, ...rows].join("\n");
const encoder = new TextEncoder();
const bytes = encoder.encode(csv);

return new NextResponse(bytes, {
  headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="team-report-${monat}.csv"`,
  },
});
```

### Anti-Patterns to Avoid
- **Fetching individual user data for team metrics:** Never SELECT userId or per-user breakdowns in the API response. Use Prisma aggregate/count and compute averages server-side. The API should only return team-level numbers.
- **Client-side data aggregation:** Do NOT fetch raw QuestCompletion rows to the client and compute rates in JS. All aggregation must happen in Prisma queries or server-side functions.
- **Using Recharts SSR rendering:** Recharts uses SVG and requires the DOM. Always wrap in a `"use client"` component. The parent page can be a server component that passes data as props.
- **Hardcoding week dates:** Use `date-fns` `startOfWeek` + `subWeeks` for consistent ISO week calculations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Line chart rendering | Custom SVG path generation | Recharts `LineChart` + `Line` | Axes, tooltips, responsiveness, accessibility are complex |
| Week start calculation | Manual date math (`getDay()` etc.) | `date-fns startOfWeek({ weekStartsOn: 1 })` | Already used in weekly-snapshot.ts, handles DST correctly |
| PDF page layout | Raw pdf-lib calls from scratch | Copy helpers from invoice pdf-generator.ts | drawText, drawLine, checkPageBreak, formatCurrency already work |
| CSV generation | Streaming/library | `TextEncoder` + `join("\n")` | Existing pattern, data is small (<100 rows) |
| Trend direction logic | Complex moving average | Simple comparison of last 2 weeks | Kanzlei scale (~5 users, ~50 WV max) doesn't need statistical smoothing |

**Key insight:** This phase requires zero algorithmic innovation. Every data query pattern (aggregate, groupBy, count) and every export pattern (pdf-lib, CSV) already exists in the codebase. The only new thing is wiring Recharts for the chart.

## Common Pitfalls

### Pitfall 1: WeeklySnapshot Missing WIEDERVORLAGE Data
**What goes wrong:** The backlog delta chart shows empty/zero because WeeklySnapshot only stores Ticket and KalenderEintrag (Frist) counts, not WIEDERVORLAGE counts.
**Why it happens:** The weekly-snapshot.ts was built for Phase 37 quest delta evaluation, which focused on Tickets and Fristen.
**How to avoid:** Extend `createWeeklySnapshots()` to also snapshot KalenderEintrag with `typ: "WIEDERVORLAGE"` and `erledigt: false`. Use a distinct model key like `"KalenderEintrag:WIEDERVORLAGE"` or `"Wiedervorlage"` to distinguish from the existing Frist snapshot.
**Warning signs:** Chart shows all zeros despite known open Wiedervorlagen.

### Pitfall 2: Recharts Bundle Size in Server Components
**What goes wrong:** Import of Recharts in a server component causes build errors or massive bundle.
**Why it happens:** Recharts depends on DOM APIs (SVG rendering), cannot run server-side.
**How to avoid:** Chart component MUST be a `"use client"` component. Parent page passes pre-computed data as serializable props (plain objects/arrays, no Dates).
**Warning signs:** Build error mentioning `window is not defined` or `document is not defined`.

### Pitfall 3: Quest Fulfillment Rate Denominator
**What goes wrong:** Rate shows 0% or 100% because denominator counts wrong quests or wrong users.
**Why it happens:** Must count only opted-in users AND only active daily quests matching each user's class.
**How to avoid:** Formula: for each opted-in user, count their available quests (active DAILY quests where `klasse IS NULL OR klasse = user.klasse`), count their completions today, compute ratio. Then average across all opted-in users.
**Warning signs:** Rate doesn't match manual calculation.

### Pitfall 4: Rechnung Scoping for Billing Delta
**What goes wrong:** Billing delta includes Rechnungen from other Kanzleien (in multi-tenant scenarios).
**Why it happens:** Rechnung doesn't have a direct kanzleiId -- it relates to Akte, which relates to Kanzlei.
**How to avoid:** Always filter via `{ akte: { kanzleiId } }` in the Prisma where clause. Exclude STORNIERT status invoices.
**Warning signs:** Billing numbers seem too high or include test data from other tenants.

### Pitfall 5: PDF Font Encoding for German Characters
**What goes wrong:** Umlauts (a, o, u) appear as garbled text in PDF.
**Why it happens:** pdf-lib's `StandardFonts.Helvetica` only supports WinAnsi encoding. German characters like a, o, u ARE supported in WinAnsi, but some edge cases with extended Unicode are not.
**How to avoid:** Use plain German text (Umlauts work fine in WinAnsi). The existing invoice generator already handles this correctly. If needed, replace special characters: `ss` -> `ss` etc.
**Warning signs:** Garbled characters in generated PDF.

### Pitfall 6: Empty State for New Installations
**What goes wrong:** Dashboard crashes or shows NaN when there are no WeeklySnapshots, no QuestCompletions, or no Bossfights yet.
**Why it happens:** Division by zero in rate calculation, or array methods on empty results.
**How to avoid:** Default to 0% for quest rate when no opted-in users exist. Show "Keine Daten verfugbar" for chart when fewer than 2 data points. Default to 0 for bossfight damage when no bossfights exist.
**Warning signs:** NaN displayed in KPI cards or chart rendering error.

## Code Examples

### Quest Fulfillment Rate Calculation
```typescript
// Server-side only -- never expose per-user data
async function getTeamQuestFulfillmentRate(kanzleiId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get opted-in users with their class
  const optedInUsers = await prisma.user.findMany({
    where: { kanzleiId, gamificationOptIn: true, aktiv: true },
    select: { id: true, gameProfile: { select: { klasse: true } } },
  });

  if (optedInUsers.length === 0) return 0;

  // Get all active daily quests
  const dailyQuests = await prisma.quest.findMany({
    where: { typ: "DAILY", aktiv: true },
    select: { id: true, klasse: true },
  });

  // Get today's completions grouped by user
  const completions = await prisma.questCompletion.findMany({
    where: {
      completedDate: today,
      quest: { typ: "DAILY" },
      userId: { in: optedInUsers.map(u => u.id) },
    },
    select: { userId: true, questId: true },
  });

  const completionsByUser = new Map<string, Set<string>>();
  for (const c of completions) {
    if (!completionsByUser.has(c.userId)) completionsByUser.set(c.userId, new Set());
    completionsByUser.get(c.userId)!.add(c.questId);
  }

  // Compute per-user rate, then average
  let totalRate = 0;
  for (const user of optedInUsers) {
    const userClass = user.gameProfile?.klasse;
    const available = dailyQuests.filter(q => q.klasse === null || q.klasse === userClass);
    if (available.length === 0) continue;
    const completed = completionsByUser.get(user.id)?.size ?? 0;
    totalRate += completed / available.length;
  }

  return Math.round((totalRate / optedInUsers.length) * 100);
}
```

### Backlog Delta History (8 Weeks)
```typescript
import { startOfWeek, subWeeks, format } from "date-fns";
import { de } from "date-fns/locale";

async function getBacklogDeltaHistory(kanzleiId: string, weeks: number) {
  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });

  // Get current open WV count (live)
  const currentCount = await prisma.kalenderEintrag.count({
    where: {
      typ: "WIEDERVORLAGE",
      erledigt: false,
      akte: { kanzleiId },
    },
  });

  // Get historical snapshots
  const oldestWeek = subWeeks(currentWeekStart, weeks - 1);
  const snapshots = await prisma.weeklySnapshot.findMany({
    where: {
      model: "Wiedervorlage", // Key used in extended weekly-snapshot.ts
      weekStart: { gte: oldestWeek },
      userId: null, // Global count (not per-user)
    },
    orderBy: { weekStart: "asc" },
  });

  // Build data points array
  const dataPoints = snapshots.map(s => ({
    week: format(s.weekStart, "dd.MM.", { locale: de }),
    count: s.count,
  }));

  // Add current week as live data point
  dataPoints.push({
    week: format(currentWeekStart, "dd.MM.", { locale: de }),
    count: currentCount,
  });

  // Compute trend from last 2 points
  const len = dataPoints.length;
  let trend: "steigend" | "fallend" | "stabil" = "stabil";
  if (len >= 2) {
    const diff = dataPoints[len - 1].count - dataPoints[len - 2].count;
    if (diff > 0) trend = "steigend";
    else if (diff < 0) trend = "fallend";
  }

  return { dataPoints, currentCount, trend };
}
```

### Bossfight History Aggregation
```typescript
async function getBossfightHistory(kanzleiId: string) {
  const bossfights = await prisma.bossfight.findMany({
    where: { kanzleiId },
    orderBy: { spawnedAt: "desc" },
    take: 10, // Paginate if needed
    select: {
      id: true,
      name: true,
      spawnHp: true,
      currentHp: true,
      status: true,
      spawnedAt: true,
      defeatedAt: true,
    },
  });

  // Aggregate total damage per bossfight (team total, no per-user)
  const damagePromises = bossfights.map(b =>
    prisma.bossfightDamage.aggregate({
      where: { bossfightId: b.id },
      _sum: { amount: true },
    })
  );
  const damages = await Promise.all(damagePromises);

  return bossfights.map((b, i) => ({
    ...b,
    totalDamage: damages[i]._sum?.amount ?? 0,
    spawnedAt: b.spawnedAt.toISOString(),
    defeatedAt: b.defeatedAt?.toISOString() ?? null,
  }));
}
```

### WeeklySnapshot Extension for WIEDERVORLAGE
```typescript
// Addition to src/lib/gamification/weekly-snapshot.ts createWeeklySnapshots()

// Snapshot open Wiedervorlagen GLOBALLY per kanzlei (for team dashboard backlog delta)
// Unlike user-scoped Ticket/Frist snapshots, this is a kanzlei-wide count (userId: null)
const kanzleien = await prisma.kanzlei.findMany({ select: { id: true } });

for (const k of kanzleien) {
  const wvCount = await prisma.kalenderEintrag.count({
    where: {
      typ: "WIEDERVORLAGE",
      erledigt: false,
      akte: { kanzleiId: k.id },
    },
  });

  await prisma.weeklySnapshot.upsert({
    where: {
      model_weekStart_userId: {
        model: "Wiedervorlage",
        weekStart,
        userId: "", // Global count -- empty string for compound unique (userId nullable)
      },
    },
    create: {
      model: "Wiedervorlage",
      weekStart,
      userId: null,
      count: wvCount,
    },
    update: { count: wvCount },
  });
}
```

Note: The `WeeklySnapshot` model has `userId String?` (nullable). The compound unique is `@@unique([model, weekStart, userId])`. For global (non-per-user) snapshots, pass `userId: null`. The upsert where clause needs care because Prisma's compound unique with nullable fields requires special handling -- use `{ model, weekStart, userId: null }` syntax or a raw query for the unique lookup.

### Billing Delta Calculation
```typescript
async function getBillingDelta(kanzleiId: string) {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [thisMonth, lastMonth] = await Promise.all([
    prisma.rechnung.aggregate({
      where: {
        akte: { kanzleiId },
        rechnungsdatum: { gte: thisMonthStart },
        status: { not: "STORNIERT" },
      },
      _sum: { betragNetto: true },
      _count: { id: true },
    }),
    prisma.rechnung.aggregate({
      where: {
        akte: { kanzleiId },
        rechnungsdatum: { gte: lastMonthStart, lte: lastMonthEnd },
        status: { not: "STORNIERT" },
      },
      _sum: { betragNetto: true },
      _count: { id: true },
    }),
  ]);

  const thisTotal = Number(thisMonth._sum?.betragNetto ?? 0);
  const lastTotal = Number(lastMonth._sum?.betragNetto ?? 0);
  const deltaPercent = lastTotal > 0
    ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100)
    : thisTotal > 0 ? 100 : 0;

  return {
    thisMonthCount: thisMonth._count?.id ?? 0,
    thisMonthTotal: thisTotal,
    lastMonthCount: lastMonth._count?.id ?? 0,
    lastMonthTotal: lastTotal,
    deltaPercent,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chart.js canvas-based charts | Recharts SVG-based composable charts | ~2022 onwards | Better React integration, SSR-friendlier, smaller bundle for simple charts |
| Custom date math | date-fns v4 with locale support | date-fns v4 (2024) | Tree-shakeable, immutable, handles DST correctly |
| Client-side PDF (jsPDF) | Server-side pdf-lib | Already in project | No browser dependency, faster, smaller client bundle |

**Deprecated/outdated:**
- `recharts@1.x`: Use `recharts@2.x` (current stable). v2 has better TypeScript support and smaller bundle.
- Charting via `<canvas>`: SVG-based Recharts is preferred for accessibility and React integration.

## Open Questions

1. **WeeklySnapshot compound unique with NULL userId**
   - What we know: The `@@unique([model, weekStart, userId])` constraint has `userId String?` (nullable). Prisma's behavior with `null` in compound uniques can be tricky -- PostgreSQL treats `NULL != NULL` so the unique constraint may not prevent duplicates with null userId.
   - What's unclear: Whether `upsert` with `userId: null` in the where clause works correctly with Prisma's compound unique lookup.
   - Recommendation: Test this during implementation. If upsert fails, use a findFirst + create/update pattern, or store an empty string sentinel value for "global" snapshots instead of null. Alternatively, skip the compound unique and use a separate `findFirst` + conditional create.

2. **Recharts Dark Mode Styling**
   - What we know: The project uses oklch glass UI with dark mode. Recharts accepts custom colors as props.
   - What's unclear: Whether CSS custom properties (`hsl(var(--border))`) work directly in Recharts SVG props.
   - Recommendation: Test CSS variable usage. If they don't resolve in SVG context, use a client-side hook to resolve CSS variables to actual color values, or hardcode oklch-matched hex values for chart elements.

3. **Export Time Range for First Month**
   - What we know: Export is "last calendar month". If the system is brand new, there may be no data for the previous month.
   - What's unclear: How to handle the "first month" case gracefully.
   - Recommendation: Return an empty PDF/CSV with a "Keine Daten fur diesen Zeitraum" message rather than an error.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `src/app/(dashboard)/dashboard/page.tsx` -- server component parallel data fetching pattern
- Existing codebase analysis: `src/lib/finance/invoice/pdf-generator.ts` -- pdf-lib A4 layout with Briefkopf
- Existing codebase analysis: `src/app/api/admin/audit-trail/export/route.ts` -- CSV + PDF export API pattern
- Existing codebase analysis: `src/lib/gamification/boss-engine.ts` -- `BossfightDamage.aggregate` with `_sum`
- Existing codebase analysis: `src/lib/gamification/weekly-snapshot.ts` -- WeeklySnapshot creation pattern
- Existing codebase analysis: `src/app/(dashboard)/admin/layout.tsx` -- admin navigation and RBAC check
- Existing codebase analysis: `src/components/ui/glass-kpi-card.tsx` -- animated KPI card component
- Prisma schema: `WeeklySnapshot`, `QuestCompletion`, `BossfightDamage`, `Bossfight`, `Rechnung`, `Kanzlei` models

### Secondary (MEDIUM confidence)
- Recharts documentation: composable chart API, ResponsiveContainer, LineChart configuration -- verified via package ecosystem knowledge

### Tertiary (LOW confidence)
- Recharts CSS variable support in SVG props -- needs runtime testing during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries except Recharts already in project; Recharts is well-established
- Architecture: HIGH - all patterns directly observed in existing codebase
- Pitfalls: HIGH - identified from concrete gaps (missing WV snapshot, null userId unique constraint)

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable domain, no external API dependencies)
