# Phase 34: Dashboard Widget + Quest Deep-Links - Research

**Researched:** 2026-03-02
**Domain:** Next.js Dashboard UI (GlassCard widget, client-side data fetching, deep-link routing)
**Confidence:** HIGH

## Summary

Phase 34 builds a client-side Quest Widget component embedded in the server-rendered dashboard page, plus a convention-based deep-link system that maps quest conditions to filtered page URLs. The implementation sits entirely within the existing stack (Next.js 14 App Router, motion/react, Tailwind, GlassCard, Prisma) and requires zero new npm packages.

The core technical challenge is bridging the server-component dashboard page with a client-component widget that fetches gamification data conditionally (only when `gamificationOptIn` is true). The existing `Tagesuebersicht` component provides the exact pattern: a `"use client"` component that self-fetches via API calls and renders inside the server-component page. The deep-link mapping is a pure function that translates `QuestCondition` DSL fields (`model`, `where`, `period`) into Next.js route paths + query parameters.

**Primary recommendation:** Build a `QuestWidget` client component that fetches a new `/api/gamification/dashboard` endpoint (combining profile + today's quests with progress), renders inside a `GlassCard`, and uses a `buildQuestDeepLink(condition)` utility function for click navigation. Add a PATCH endpoint for gamificationOptIn toggle on the settings page.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Compact summary card style inside a single GlassCard
- Header row: level title + XP progress bar + inline badges for streak and Runen
- Body: today's quests as a checklist, each item showing title + progress fraction + XP/Runen reward
- Completed quests get a checkmark visual indicator
- Full info per quest: "5 Fristen erledigen -- 3/5 . 50 XP"
- Completed quests show checkmark + earned rewards
- Inline badges in the card header row alongside the level title (pill-shaped badges)
- Convention-based URL mapping from quest condition: model=KalenderEintrag -> /kalender, model=Ticket -> /tickets, model=Rechnung -> /finanzen/rechnungen, model=AktenActivity -> /akten
- Query parameters derived from condition.where and condition.period (e.g. ?typ=FRIST&datum=heute)
- Same-tab navigation via Next.js router (consistent with sidebar links)
- Widget does NOT render at all when gamificationOptIn is false -- no placeholder, no empty space
- Dashboard layout shifts naturally (no reserved space)
- Positioned below KPI cards grid, above Tagesuebersicht panel
- Dashboard order: Welcome -> KPI cards -> Quest Widget -> Tagesuebersicht -> 2-col grid
- Graceful degradation: widget silently disappears on API error, rest of dashboard renders normally
- Console error logged for debugging

### Claude's Discretion
- XP progress bar visual design (style, gradient, thickness)
- Streak/Runen badge visual design
- Loading skeleton vs. absent-until-loaded approach
- Widget width (full vs. half)
- Collapsible toggle (yes/no, persistence)
- Empty state design (celebratory vs. stats-only)
- Completed quest clickability
- Opt-in toggle in settings (add if missing)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GAME-07 | Gamification ist opt-in sichtbar (Dashboard-Widget, kein Zwang, keine Push-Notifications) | gamificationOptIn field exists on User model; widget conditionally renders based on API check; PATCH endpoint needed for toggle; settings page needs toggle UI |
| GAME-08 | Dashboard-Widget zeigt heutige Quests, XP-Bar, Level, Runen und Streak | New combined API endpoint returns profile + quest progress; QuestWidget client component renders all data in GlassCard; XP progress bar is a new styled div (no library needed) |
| QUEST-08 | Quest-Deep-Link: Klick auf Quest oeffnet direkt die gefilterte Ansicht (z.B. heutige Fristen) | buildQuestDeepLink() utility maps QuestCondition.model to route path and condition.where to query params; uses Next.js router.push() for same-tab navigation |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14+ (App Router) | Server/client component split | Already in use; dashboard page is server component |
| motion/react | ^12.34.3 | XP bar animation, number counters | Already used in GlassKpiCard; animate() for smooth XP bar transitions |
| Tailwind CSS | 3.x | Styling, oklch glass design system | Project standard; all glass-* classes defined in globals.css |
| Prisma | Existing | Database queries for quest progress | Quest, QuestCompletion, UserGameProfile models already defined |
| date-fns | ^4.1.0 | Date range calculations | Already used in quest-evaluator for startOfDay/endOfDay |
| lucide-react | ^0.468.0 | Icons (Flame, Star, Gem, CheckCircle2, ChevronRight) | Project standard icon library |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | existing | Toast notifications | Error feedback on API failures |
| @radix-ui/react-switch | existing | Toggle switch | gamificationOptIn toggle in settings page |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom CSS progress bar | shadcn/ui Progress | shadcn/ui Progress exists but is NOT installed in this project; custom CSS bar with oklch gradient is trivial and matches glass aesthetic better |
| SWR/React Query | Plain fetch + useState | Project uses plain fetch everywhere (Tagesuebersicht, KalenderListe); no data-fetching library installed; stay consistent |

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── gamification/
│       ├── quest-widget.tsx          # Main client component
│       ├── xp-progress-bar.tsx       # Reusable XP bar with animation
│       └── quest-deep-link.ts        # buildQuestDeepLink() utility
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Insert <QuestWidget /> between KPI and Tagesuebersicht
│   │   └── einstellungen/
│   │       └── page.tsx              # Add gamification toggle to Allgemein tab
│   └── api/
│       └── gamification/
│           ├── dashboard/
│           │   └── route.ts          # GET: combined profile + today's quest progress
│           └── opt-in/
│               └── route.ts          # PATCH: toggle gamificationOptIn
└── lib/
    └── gamification/
        ├── quest-evaluator.ts        # Existing -- evaluateQuestCondition() reused
        └── game-profile-service.ts   # Existing -- level/title/progress functions reused
```

### Pattern 1: Conditional Client Widget in Server Page
**What:** A `"use client"` component renders in a server page, self-fetching data via API
**When to use:** When a section of a server-rendered page needs interactivity and conditional rendering
**Example:**
```typescript
// dashboard/page.tsx (server component)
import { QuestWidget } from "@/components/gamification/quest-widget";

export default async function DashboardPage() {
  const session = await auth();
  // ... existing KPI queries ...

  return (
    <div className="space-y-6">
      {/* Welcome */}
      {/* Stats Grid (KPI cards) */}

      {/* Quest Widget -- client component, self-fetches, hides if opt-out */}
      <QuestWidget />

      {/* Tagesuebersicht */}
      <GlassPanel elevation="panel">
        <Tagesuebersicht />
      </GlassPanel>

      {/* Content Grid */}
    </div>
  );
}
```

```typescript
// components/gamification/quest-widget.tsx (client component)
"use client";

import { useState, useEffect } from "react";

export function QuestWidget() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/gamification/dashboard")
      .then(r => {
        if (r.status === 404) return null; // opt-out: don't render
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then(setData)
      .catch(() => {
        setError(true);
        console.error("QuestWidget: failed to load gamification data");
      });
  }, []);

  // Graceful degradation: render nothing on error or opt-out
  if (error || data === null) return null;

  return <GlassCard>...</GlassCard>;
}
```

### Pattern 2: Convention-Based Deep-Link Mapping
**What:** A pure function maps QuestCondition DSL to application route + query params
**When to use:** When quest conditions need to resolve to navigable filtered views
**Example:**
```typescript
// components/gamification/quest-deep-link.ts
import type { QuestCondition } from "@/lib/gamification/types";

const MODEL_TO_PATH: Record<string, string> = {
  KalenderEintrag: "/kalender",
  Ticket: "/tickets",
  Rechnung: "/finanzen/rechnungen",
  AktenActivity: "/akten",
};

export function buildQuestDeepLink(condition: QuestCondition): string {
  const basePath = MODEL_TO_PATH[condition.model] ?? "/dashboard";
  const params = new URLSearchParams();

  // Map condition.where to URL-friendly query params
  if (condition.where.typ) {
    params.set("typ", String(condition.where.typ));
  }
  if (condition.where.status) {
    params.set("status", String(condition.where.status));
  }
  if (condition.where.erledigt === true) {
    params.set("erledigt", "true");
  }

  // Map period to date filter
  if (condition.period === "today") {
    params.set("datum", "heute");
  }

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
```

### Pattern 3: Combined API Endpoint
**What:** Single endpoint returns profile data + today's quest progress in one response
**When to use:** When a widget needs multiple related data sources
**Example:**
```typescript
// API response shape for GET /api/gamification/dashboard
interface GamificationDashboardResponse {
  profile: {
    level: number;
    levelTitle: string;
    xp: number;
    xpForCurrentLevel: number;
    xpForNextLevel: number;
    progress: number; // 0-1
    runen: number;
    streakTage: number;
  };
  quests: Array<{
    id: string;
    name: string;
    beschreibung: string;
    bedingung: QuestCondition;
    xpBelohnung: number;
    runenBelohnung: number;
    current: number;     // from evaluateQuestCondition
    target: number;      // from condition.count
    completed: boolean;  // current >= target
    awarded: boolean;    // QuestCompletion exists for today
  }>;
}
```

### Anti-Patterns to Avoid
- **Server-side gamification check in dashboard page:** Do NOT add `gamificationOptIn` check to the server component page. This would couple the server render to a user preference that changes independently. Let the client widget handle its own visibility.
- **Multiple sequential API calls from widget:** Do NOT have the widget call `/api/gamification/profile` then `/api/gamification/quests` separately. Combine into one endpoint to avoid waterfall.
- **Dynamic Prisma model access:** The quest evaluator already avoids `prisma[condition.model]` with an explicit switch. Deep-link mapping must similarly use a static lookup table.
- **Storing deep-link URLs in the database:** Deep links should be computed at render time from the QuestCondition DSL, not stored separately. If route structure changes, links update automatically.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XP progress calculation | Custom level math | Existing `getLevelForXp()`, `getRequiredXp()`, `getLevelTitle()` from game-profile-service.ts | Already tested, handles tier boundaries correctly |
| Quest evaluation | Custom counting logic | Existing `evaluateQuestCondition()` from quest-evaluator.ts | Handles all 4 models, user scoping, date ranges |
| Date range calculation | Manual date math | `startOfDay`/`endOfDay` from date-fns | DST-safe, timezone-aware |
| Toggle switch UI | Custom checkbox styling | Existing `<Switch />` from `@radix-ui/react-switch` | Already styled with brand-600 checked state |
| Animated numbers | Custom JS counter | `animate()` from motion/react | Same pattern as GlassKpiCard |
| Skeleton loading | Custom shimmer | Existing `glass-shimmer` CSS class | Defined in globals.css, used by GlassKpiCard skeleton |

**Key insight:** The entire gamification backend from Phase 33 is designed for this widget. The `evaluateQuestCondition()` function returns `{ current, target, completed }` -- exactly what the quest item display needs. The `game-profile-service.ts` pure functions compute level, title, and progress. The widget is essentially a UI rendering layer over already-built services.

## Common Pitfalls

### Pitfall 1: Widget Flicker on Initial Load
**What goes wrong:** Widget renders empty, then shows skeleton, then shows content -- three visual states create a jarring flash.
**Why it happens:** React renders null first, then sets loading state, then fetches data.
**How to avoid:** Use "absent-until-loaded" pattern: return `null` until the first fetch completes. The dashboard layout will shift once when the widget appears, which is acceptable since `space-y-6` handles the gap naturally.
**Warning signs:** Users see a blank gap that fills in after a delay.

### Pitfall 2: Deep-Link Query Params Ignored by Target Page
**What goes wrong:** Clicking "Erledige 3 Fristen" navigates to `/kalender?typ=FRIST` but the Kalender page ignores query params.
**Why it happens:** The `KalenderListe` component uses internal `useState` for filters, not URL search params. Same for `InvoiceList`.
**How to avoid:** For Plan 34-02, either: (a) make target pages read initial filter state from `useSearchParams()` on mount, or (b) accept that deep links navigate to the correct page without pre-filtering (simpler, still useful). The Tickets page already reads `searchParams` from the URL -- only Kalender and Rechnungen need adaptation.
**Warning signs:** Filter state resets to defaults despite query params in URL.

### Pitfall 3: Race Condition Between Quest Check and Widget Fetch
**What goes wrong:** User completes a Frist, then immediately views dashboard. The BullMQ quest check hasn't processed yet, so the widget shows stale progress.
**Why it happens:** `enqueueQuestCheck()` is fire-and-forget; the queue job may not have run yet.
**How to avoid:** The dashboard API endpoint should call `evaluateQuestCondition()` directly (real-time count), not rely on cached QuestCompletion records. For the "awarded" flag, check QuestCompletion. This gives accurate current counts with correct completion status.
**Warning signs:** Progress doesn't update immediately after completing an action.

### Pitfall 4: XP Progress Bar Edge Cases
**What goes wrong:** Progress bar shows 100% when XP exactly equals the next level threshold, or goes beyond 100%.
**Why it happens:** The existing `/api/gamification/profile` already clamps progress to `Math.min(xpInLevel / xpNeeded, 1)`, but the bar rendering might not handle `progress === 1` gracefully.
**How to avoid:** Use `Math.min(progress, 1)` in the CSS width calculation. When progress is 1.0 (just leveled up), show "Level Up!" state briefly.
**Warning signs:** Bar overflows its container or shows odd rounding.

### Pitfall 5: Settings Toggle Without Immediate Dashboard Effect
**What goes wrong:** User toggles gamification ON in settings, navigates to dashboard, but widget doesn't appear (stale data).
**Why it happens:** The dashboard page is server-rendered; the client widget caches its initial fetch result.
**How to avoid:** The widget fetches fresh on every page navigation (no caching in the client component). Since dashboard is visited via Next.js Link navigation, each visit triggers a fresh `useEffect`. No stale cache issue in practice.
**Warning signs:** Toggle on/off doesn't reflect until hard refresh.

## Code Examples

Verified patterns from the existing codebase:

### XP Progress Bar (Glass Aesthetic)
```typescript
// components/gamification/xp-progress-bar.tsx
"use client";

import { useEffect, useState } from "react";
import { motion, animate, useMotionValue } from "motion/react";

interface XpProgressBarProps {
  progress: number; // 0-1
  xpCurrent: number;
  xpNeeded: number;
}

export function XpProgressBar({ progress, xpCurrent, xpNeeded }: XpProgressBarProps) {
  const width = useMotionValue(0);
  const [displayWidth, setDisplayWidth] = useState(0);

  useEffect(() => {
    const controls = animate(width, Math.min(progress, 1) * 100, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayWidth(latest),
    });
    return controls.stop;
  }, [progress, width]);

  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-2 rounded-full bg-white/10 dark:bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
          style={{ width: `${displayWidth}%` }}
        />
      </div>
      <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
        {xpCurrent}/{xpNeeded} XP
      </span>
    </div>
  );
}
```

### Streak Badge (Pill Style, Inline)
```typescript
// Inside quest-widget.tsx header row
<div className="flex items-center gap-2">
  <span className="text-sm font-semibold text-foreground">
    {data.profile.levelTitle}
  </span>
  <span className="text-xs text-foreground/70">Lv. {data.profile.level}</span>

  {/* Streak badge */}
  {data.profile.streakTage > 0 && (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
      <Flame className="w-3 h-3" />
      {data.profile.streakTage}
    </span>
  )}

  {/* Runen badge */}
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-500/15 text-violet-600 dark:text-violet-400">
    <Gem className="w-3 h-3" />
    {data.profile.runen}
  </span>
</div>
```

### Quest Item Row
```typescript
// Inside quest-widget.tsx body
{data.quests.map((quest) => (
  <button
    key={quest.id}
    onClick={() => router.push(buildQuestDeepLink(quest.bedingung))}
    className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left hover:bg-white/30 dark:hover:bg-white/[0.05] transition-colors group"
  >
    {/* Completion indicator */}
    {quest.awarded ? (
      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
    ) : (
      <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
    )}

    {/* Quest info */}
    <div className="flex-1 min-w-0">
      <span className={cn(
        "text-sm",
        quest.awarded ? "text-muted-foreground line-through" : "text-foreground"
      )}>
        {quest.beschreibung}
      </span>
      <span className="text-xs text-muted-foreground ml-2">
        {quest.current}/{quest.target}
      </span>
    </div>

    {/* Reward */}
    <span className="text-xs text-muted-foreground whitespace-nowrap">
      {quest.xpBelohnung} XP
      {quest.runenBelohnung > 0 && ` + ${quest.runenBelohnung} R`}
    </span>

    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
  </button>
))}
```

### Combined Dashboard API Endpoint
```typescript
// app/api/gamification/dashboard/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfDay } from "date-fns";
import { evaluateQuestCondition } from "@/lib/gamification/quest-evaluator";
import {
  getOrCreateGameProfile,
  getLevelForXp,
  getLevelTitle,
  getRequiredXp,
} from "@/lib/gamification/game-profile-service";
import type { QuestCondition } from "@/lib/gamification/types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { gamificationOptIn: true, role: true },
  });

  if (!user?.gamificationOptIn) {
    return NextResponse.json({ error: "Nicht aktiviert" }, { status: 404 });
  }

  const profile = await getOrCreateGameProfile(session.user.id, user.role);
  const level = getLevelForXp(profile.xp);
  const xpForCurrent = getRequiredXp(level);
  const xpForNext = getRequiredXp(level + 1);
  const xpInLevel = profile.xp - xpForCurrent;
  const xpNeeded = xpForNext - xpForCurrent;
  const progress = xpNeeded > 0 ? Math.min(xpInLevel / xpNeeded, 1) : 1;

  // Load active daily quests
  const quests = await prisma.quest.findMany({
    where: { typ: "DAILY", aktiv: true },
    orderBy: { sortierung: "asc" },
  });

  const today = startOfDay(new Date());

  // Evaluate each quest + check completion
  const questResults = await Promise.all(
    quests.map(async (quest) => {
      const condition = quest.bedingung as unknown as QuestCondition;
      const result = await evaluateQuestCondition(condition, session.user!.id);
      const completion = await prisma.questCompletion.findFirst({
        where: { userId: session.user!.id, questId: quest.id, completedAt: { gte: today } },
      });

      return {
        id: quest.id,
        name: quest.name,
        beschreibung: quest.beschreibung,
        bedingung: condition,
        xpBelohnung: quest.xpBelohnung,
        runenBelohnung: quest.runenBelohnung,
        current: result.current,
        target: result.target,
        completed: result.completed,
        awarded: !!completion,
      };
    }),
  );

  return NextResponse.json({
    profile: {
      level,
      levelTitle: getLevelTitle(level),
      xp: profile.xp,
      xpInLevel,
      xpNeeded,
      progress: Math.round(progress * 100) / 100,
      runen: profile.runen,
      streakTage: profile.streakTage,
    },
    quests: questResults,
  });
}
```

### Opt-In Toggle Endpoint
```typescript
// app/api/gamification/opt-in/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { optIn } = await request.json();
  if (typeof optIn !== "boolean") {
    return NextResponse.json({ error: "Ungueltig" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { gamificationOptIn: optIn },
  });

  return NextResponse.json({ gamificationOptIn: optIn });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate client fetch per data source | Single combined API endpoint | Project convention | One round-trip for profile + quest progress |
| shadcn/ui Progress component | Custom CSS + motion/react animated bar | Project has no Progress installed | Matches glass aesthetic, zero dependency |
| URL-state management (nuqs/next-usequerystate) | Plain URLSearchParams + router.push() | Project convention | No new dependency; consistent with existing patterns |
| React Query / SWR for caching | Plain fetch + useState | Project convention since v0.1 | All dashboard widgets use this pattern |

**Deprecated/outdated:**
- None -- all technologies in use are current versions

## Open Questions

1. **Kalender page filter initialization from URL params**
   - What we know: `KalenderListe` uses internal `useState` for `typFilter`, does NOT read from URL search params. `InvoiceList` likely same pattern.
   - What's unclear: Whether we should modify these target pages to accept initial filter state from URL, or accept navigation-only deep links (user lands on correct page but must apply filter manually).
   - Recommendation: For Plan 34-02, add `useSearchParams()` initialization to `KalenderListe` for `typ` param. This is a small change (3-5 lines) that makes deep links genuinely useful. The `TicketsPage` already supports this pattern via server-side `searchParams` prop. Rechnungen can navigate without filtering since the quest is "create invoices" (no meaningful filter).

2. **Widget width decision**
   - What we know: KPI cards use a 4-column grid. Tagesuebersicht spans full width.
   - What's unclear: Whether quest widget should be full-width (consistent with Tagesuebersicht) or half-width (leaves space for future Team Dashboard widget).
   - Recommendation: Full-width. The widget contains a horizontal layout (header row + quest list) that benefits from width. Future Team Dashboard widget goes in a separate phase and can restructure layout then.

## Sources

### Primary (HIGH confidence)
- `src/app/(dashboard)/dashboard/page.tsx` -- current dashboard layout, server component structure
- `src/components/fristen/tagesuebersicht.tsx` -- client widget pattern (self-fetching, loading states)
- `src/components/ui/glass-card.tsx` -- GlassCard API (variant prop)
- `src/components/ui/glass-kpi-card.tsx` -- motion/react animate pattern, skeleton loading
- `src/app/api/gamification/profile/route.ts` -- existing profile endpoint, opt-in check pattern
- `src/lib/gamification/quest-evaluator.ts` -- evaluateQuestCondition() returns {current, target, completed}
- `src/lib/gamification/game-profile-service.ts` -- getLevelForXp, getLevelTitle, getRequiredXp pure functions
- `src/lib/gamification/seed-quests.ts` -- 5 daily quests with exact QuestCondition shapes
- `src/lib/gamification/types.ts` -- QuestCondition interface, QuestModel type
- `src/app/(dashboard)/tickets/page.tsx` -- searchParams-based filtering (already works for deep links)
- `src/components/kalender/kalender-liste.tsx` -- internal state filtering (needs adaptation for deep links)
- `src/app/(dashboard)/einstellungen/page.tsx` -- settings page structure, Allgemein tab
- `src/components/ui/switch.tsx` -- Radix Switch component, brand-600 styling
- `src/app/globals.css` -- glass-card, glass-shimmer, oklch color tokens
- `prisma/schema.prisma` -- UserGameProfile, Quest, QuestCompletion models; gamificationOptIn on User

### Secondary (MEDIUM confidence)
- `src/app/api/user/theme/route.ts` -- PATCH endpoint pattern for user preferences

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - everything already installed, zero new packages
- Architecture: HIGH - pattern directly matches existing Tagesuebersicht widget pattern
- Pitfalls: HIGH - investigated actual code to identify real issues (KalenderListe filter state, race condition with BullMQ)
- Deep-link mapping: HIGH - QuestCondition DSL fields map cleanly to existing route structure
- Code examples: HIGH - derived from actual codebase patterns with verified API shapes

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable -- no external dependencies, all internal code)
