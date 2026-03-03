# Phase 40: Heldenkarte - Research

**Researched:** 2026-03-03
**Domain:** Gamification profile page (read-only view), badge system, quest history
**Confidence:** HIGH

## Summary

Phase 40 builds a "Heldenkarte" profile page -- a read-only character sheet displaying the user's gamification achievements. The page aggregates data from existing models (UserGameProfile, QuestCompletion, UserInventoryItem) and introduces a new lightweight badge system with a curated catalog of 5-8 achievement badges. No new Prisma models are needed; badges are stored as a JSON array on UserGameProfile (same pattern as trophies).

The implementation is straightforward: one new page route, one API endpoint (extending or paralleling the existing `/api/gamification/profile`), a badge catalog file, a badge-check service, and 3-4 new UI components. All data already exists in the database; this phase is primarily a presentation layer with a small badge evaluation backend.

**Primary recommendation:** Build a single `/api/gamification/heldenkarte` endpoint that returns all data (profile, equipped cosmetics, badges, quest history) in one request. Use the existing self-fetching absent-until-loaded pattern. Badge catalog follows the shop-items.ts pattern. No new npm packages needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Small curated set of 5-8 badges tied to milestone thresholds
- Examples: Fristenwaechter (50 Fristen erledigt), Aktenkoenig (100 Akten bearbeitet), Streak-Meister (30-Tage Streak), Bannbrecher (Boss besiegt -- already exists as trophy)
- Badges are permanently awarded when threshold is hit, stored with earn date -- never revoked even if count drops later
- Consistent with existing boss trophy pattern (trophies JSON on UserGameProfile)
- Badges are earned-only, never purchasable (explicitly stated in PROFIL-02)
- Badge definitions stored as a catalog (like shop-items.ts) -- evaluated via a badge-check service
- Hero header + scrollable sections (single scroll page, no tabs)
- Top: Large hero card (GlassCard) with AvatarFrame, class icon, level, title, XP bar, Runen balance, streak count, equipped cosmetics list
- Middle: Badge showcase grid -- earned badges with icons + earn dates, locked badges shown as muted silhouettes
- Bottom: Quest history table -- recent completed quests with date, name, XP/Runen earned
- Quest history: all-time completed quests, most recent first. Table columns: Datum, Quest-Name, Typ (Daily/Weekly/Special), XP, Runen. Paginated 20 per page, simple prev/next. No filtering.
- Strictly self-only (DSGVO from Phase 33) -- no public profile view
- Single API endpoint: extend existing `/api/gamification/profile` or create `/api/gamification/heldenkarte`

### Claude's Discretion
- Exact badge icon choices (Lucide icons)
- Badge card visual design within glass aesthetic
- Hero card exact layout proportions
- Quest history empty state design
- Whether to show "progress toward next badge" indicators

### Deferred Ideas (OUT OF SCOPE)
- Public/team-visible profile card -- would require DSGVO review, separate phase
- Badge progress indicators ("42/50 Fristen for Fristenwaechter") -- Claude's discretion for v1
- Badge notification toast when earned -- could be added later via Socket.IO event
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROFIL-01 | Profil-Seite als "Heldenkarte" (Avatar, Klasse, Level, Titel, aktive Kosmetik) | Hero card component using existing AvatarFrame, XpProgressBar, level/title from game-profile-service. Equipped cosmetics from UserInventoryItem where ausgeruestet=true. Single-page layout with GlassCard. |
| PROFIL-02 | Badge-Schaukasten (nur erspielbare Badges, nie kaufbar: Fristenwaechter, Bannbrecher etc.) | Badge catalog file (badge-catalog.ts) with threshold definitions. Badge-check service evaluates counts against Prisma models. Badges stored as JSON array on UserGameProfile (parallel to trophies). Grid display with earned/locked states. |
| PROFIL-03 | Quest-Historie (abgeschlossene Quests mit Datum und Belohnung) | QuestCompletion model already has all needed fields (completedAt, xpVerdient, runenVerdient) with Quest relation (name, typ). Paginated server-side query with cursor/offset. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 14+ | Page route `/heldenkarte` | Already used for all page routes |
| Prisma ORM | existing | Query UserGameProfile, QuestCompletion, UserInventoryItem | Single source of truth |
| Tailwind CSS + oklch | existing | Glass UI styling | Project design system |
| shadcn/ui | existing | GlassCard, Badge, Button components | Project component library |
| Lucide React | existing | Badge icons, class icons | Already imported throughout gamification |
| motion/react | existing | XpProgressBar animation | Already used in gamification components |
| date-fns | existing | Date formatting for earn dates and quest history | Already used across project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | -- | -- | All requirements met by existing stack |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON badges on UserGameProfile | Separate Badge/UserBadge models | Over-engineered for 5-8 static badges; JSON matches trophies pattern |
| Server-side pagination | Infinite scroll | User decision: paginated with prev/next, 20 per page |
| Separate badge + history endpoints | Single heldenkarte endpoint | Single request is simpler; data volume is small |

**Installation:**
```bash
# No new packages required
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/(dashboard)/heldenkarte/
│   └── page.tsx                       # Heldenkarte page (client component)
├── app/api/gamification/heldenkarte/
│   └── route.ts                       # GET endpoint: profile + badges + history
├── lib/gamification/
│   ├── badge-catalog.ts               # Badge definitions (like shop-items.ts)
│   └── badge-service.ts               # Badge evaluation + award logic
├── components/gamification/
│   ├── hero-card.tsx                   # Hero header: avatar, class, level, XP, cosmetics
│   ├── badge-showcase.tsx             # Badge grid: earned + locked badges
│   └── quest-history-table.tsx        # Paginated quest completion table
```

### Pattern 1: Badge Catalog (Static Definitions)
**What:** Define badge thresholds as a typed constant array, analogous to `SHOP_ITEM_CATALOG` in `shop-items.ts`.
**When to use:** For the curated set of 5-8 achievement badges.
**Example:**
```typescript
// src/lib/gamification/badge-catalog.ts
export interface BadgeDefinition {
  slug: string;
  name: string;
  beschreibung: string;
  icon: string;               // Lucide icon name
  /** Prisma model to count against */
  model: string;
  /** Prisma where clause to filter counts */
  where: Record<string, unknown>;
  /** Count threshold to earn badge */
  threshold: number;
  /** Special: "trophy" type checks trophies JSON instead of DB count */
  type?: "count" | "streak" | "trophy";
}

export const BADGE_CATALOG: BadgeDefinition[] = [
  {
    slug: "fristenwaechter",
    name: "Fristenwaechter",
    beschreibung: "50 Fristen fristgerecht erledigt",
    icon: "Clock",
    model: "KalenderEintrag",
    where: { typ: "FRIST", erpigtStatus: "ERLEDIGT" },
    threshold: 50,
    type: "count",
  },
  {
    slug: "aktenkoenig",
    name: "Aktenkoenig",
    beschreibung: "100 Akten bearbeitet",
    icon: "FolderOpen",
    model: "AktenActivity",
    where: {},
    threshold: 100,
    type: "count",
  },
  {
    slug: "streak-meister",
    name: "Streak-Meister",
    beschreibung: "30-Tage Streak erreicht",
    icon: "Flame",
    model: "_streak",
    where: {},
    threshold: 30,
    type: "streak",
  },
  {
    slug: "bannbrecher",
    name: "Bannbrecher",
    beschreibung: "Einen Boss besiegt",
    icon: "Swords",
    model: "_trophy",
    where: { type: "BOSS_VICTORY" },
    threshold: 1,
    type: "trophy",
  },
  // ... 4 more badges
];
```

### Pattern 2: Badge-Check Service
**What:** Evaluate badge thresholds against real DB data. Run on heldenkarte page load (lazy evaluation). Permanently store earned badges with date.
**When to use:** When rendering the badge showcase and when checking for newly earned badges.
**Example:**
```typescript
// src/lib/gamification/badge-service.ts
import { prisma } from "@/lib/db";
import { BADGE_CATALOG, type BadgeDefinition } from "./badge-catalog";
import type { BossTrophy } from "./types";

export interface EarnedBadge {
  slug: string;
  earnedAt: string; // ISO date
}

export async function evaluateBadges(userId: string): Promise<EarnedBadge[]> {
  // 1. Load existing badges from profile
  const profile = await prisma.userGameProfile.findUnique({
    where: { userId },
    select: { trophies: true, streakTage: true },
  });
  if (!profile) return [];

  // Parse existing badges from profile JSON (separate from trophies)
  // Could store as `badges` JSON field or extend trophies array
  const existingBadges = /* parse from profile */;

  const newBadges: EarnedBadge[] = [];

  for (const def of BADGE_CATALOG) {
    // Skip already earned
    if (existingBadges.some(b => b.slug === def.slug)) continue;

    const earned = await checkBadgeThreshold(def, userId, profile);
    if (earned) {
      newBadges.push({ slug: def.slug, earnedAt: new Date().toISOString() });
    }
  }

  // Persist newly earned badges atomically
  if (newBadges.length > 0) {
    await persistBadges(userId, [...existingBadges, ...newBadges]);
  }

  return [...existingBadges, ...newBadges];
}
```

### Pattern 3: Self-Fetching Absent-Until-Loaded Page
**What:** Client page component fetches `/api/gamification/heldenkarte` on mount, shows loading spinner, renders null on 404 (opt-out), renders full page on success.
**When to use:** For the heldenkarte page, matching QuestWidget and ShopPage patterns.
**Example:**
```typescript
// Follows exact same pattern as src/app/(dashboard)/shop/page.tsx
export default function HeldenkartePage() {
  const [data, setData] = useState<Heldenkarte | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/gamification/heldenkarte?page=${page}`);
    if (res.status === 404) { setLoaded(true); return; }
    if (!res.ok) { setLoaded(true); return; }
    setData(await res.json());
    setLoaded(true);
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);
  // ...
}
```

### Pattern 4: Server-Side Pagination for Quest History
**What:** Use offset-based pagination (skip/take) for quest completions, returning total count for prev/next controls.
**When to use:** For the quest history table (20 per page).
**Example:**
```typescript
const PAGE_SIZE = 20;
const skip = (page - 1) * PAGE_SIZE;

const [completions, totalCount] = await Promise.all([
  prisma.questCompletion.findMany({
    where: { userId },
    include: { quest: { select: { name: true, typ: true } } },
    orderBy: { completedAt: "desc" },
    skip,
    take: PAGE_SIZE,
  }),
  prisma.questCompletion.count({ where: { userId } }),
]);
```

### Anti-Patterns to Avoid
- **Loading all quest history at once:** Quest completions can grow large over months. Always paginate server-side.
- **Separate API calls for profile, badges, and history:** Bundle into one endpoint to avoid waterfalls. The data volume is small enough for a single response.
- **Evaluating badges on every quest completion:** Lazy evaluation on page load is sufficient. Badge checks involve multiple DB counts and should not be in the hot quest-completion path.
- **Storing badge definitions in the database:** With only 5-8 badges, a TypeScript catalog is simpler and faster. No need for CRUD UI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Avatar display with rarity ring | Custom ring CSS | `AvatarFrame` component | Already handles all 4 rarity tiers with oklch gradients |
| XP progress visualization | Custom progress bar | `XpProgressBar` component | Has animation, reduced motion support, XP label |
| Level/title calculation | Manual XP math | `getLevelForXp()` + `getLevelTitle()` from game-profile-service | Handles tiered progression correctly |
| Date formatting | Manual formatting | `date-fns` format() | Already used throughout project |
| Glass card containers | Custom div styling | `GlassCard` component | Consistent blur tier handling |
| Rarity labels/colors | Inline strings | `RARITY_LABELS` + `RARITY_COLORS` from types.ts | Single source of truth |

**Key insight:** This phase is primarily composition of existing components and services. Nearly all building blocks already exist -- the work is assembling them into a new page layout and adding the badge evaluation layer.

## Common Pitfalls

### Pitfall 1: Badge Storage Location
**What goes wrong:** Adding a new `badges` JSON field to UserGameProfile requires a Prisma migration, or confusion between "badges" and existing "trophies" field.
**Why it happens:** The trophies field already exists for boss victories. Adding a second JSON field seems redundant.
**How to avoid:** Store badges in the same `trophies` JSON array with a different `type` discriminator (e.g., `type: "BADGE"` vs `type: "BOSS_VICTORY"`). This avoids a schema migration and keeps all achievements in one place. Alternatively, add a separate `badges` JSON field -- either works, but reusing trophies is simpler.
**Warning signs:** Migration errors, confusion about which field to read.
**Recommendation:** Use a separate `badges` JSON field on UserGameProfile for clarity. The migration is trivial (add a single JSON column with default `[]`). This keeps badge concerns separate from boss trophies and avoids type-union complexity in the trophies array.

### Pitfall 2: N+1 Queries in Badge Evaluation
**What goes wrong:** Evaluating 5-8 badge thresholds sequentially with individual count queries creates 5-8 DB round-trips.
**Why it happens:** Each badge has a different model and where clause.
**How to avoid:** Run all count queries in parallel with `Promise.all()`. For a kanzlei-scale system (<50 users), this is more than fast enough.
**Warning signs:** Slow page loads on the heldenkarte page.

### Pitfall 3: Quest History Pagination State Mismatch
**What goes wrong:** Changing page triggers a full re-fetch including profile and badges, causing UI flicker.
**Why it happens:** Single endpoint returns everything; page change refetches all.
**How to avoid:** Two options: (a) separate the quest history into its own endpoint for pagination, or (b) cache profile/badge data client-side and only refetch on initial load, passing page param for just the history portion. Option (a) is cleaner: one initial fetch for profile + badges, separate paginated fetch for history.
**Recommendation:** Use two endpoints: `/api/gamification/heldenkarte` for profile + badges + first page of history, and pass `?page=N` for subsequent history pages where only the history portion changes.

### Pitfall 4: Bannbrecher Trophy Unification
**What goes wrong:** Bannbrecher badge and boss trophies are displayed in different formats, creating visual inconsistency.
**Why it happens:** Boss trophies are stored as `BossTrophy` objects with `{ type: "BOSS_VICTORY", bossName, date, bossfightId }`. The badge system uses a different structure.
**How to avoid:** The badge-check service should check the trophies array for `BOSS_VICTORY` entries when evaluating the Bannbrecher badge. The badge showcase renders all badges uniformly -- the Bannbrecher badge just happens to be earned via boss defeat rather than a count threshold.

### Pitfall 5: Missing gamificationOptIn Guard
**What goes wrong:** Page renders without checking opt-in status, showing empty/broken state.
**Why it happens:** Forgetting the standard auth + opt-in guard pattern used in all gamification endpoints.
**How to avoid:** Copy the exact auth + opt-in guard from `/api/gamification/shop/route.ts`. Return 404 for opted-out users. Page treats 404 as "render nothing."

## Code Examples

### Heldenkarte API Response Shape
```typescript
// GET /api/gamification/heldenkarte?page=1
interface HeldenkartResponse {
  profile: {
    klasse: string;           // SpielKlasse enum value
    level: number;
    levelTitle: string;
    xp: number;
    xpInLevel: number;
    xpNeeded: number;
    progress: number;         // 0-1 fraction
    runen: number;
    streakTage: number;
  };
  equippedCosmetics: {
    typ: string;              // ItemTyp
    name: string;
    rarity: string;           // ItemRarity
    metadata: Record<string, unknown>;
  }[];
  badges: {
    slug: string;
    name: string;
    beschreibung: string;
    icon: string;             // Lucide icon name
    earned: boolean;
    earnedAt: string | null;  // ISO date or null if not earned
  }[];
  questHistory: {
    items: {
      id: string;
      questName: string;
      questTyp: string;       // QuestTyp enum
      xpVerdient: number;
      runenVerdient: number;
      completedAt: string;    // ISO date
    }[];
    total: number;
    page: number;
    pageSize: number;
  };
}
```

### Hero Card Component Structure
```typescript
// src/components/gamification/hero-card.tsx
import { AvatarFrame } from "./avatar-frame";
import { XpProgressBar } from "./xp-progress-bar";
import { GlassCard } from "@/components/ui/glass-card";
import { Flame, Gem } from "lucide-react";

// Reuses existing components for avatar frame and XP bar.
// Displays: avatar with equipped frame rarity, class icon, level,
// title, XP bar, Runen balance, streak count, and equipped cosmetics list.
```

### Badge Showcase Component Structure
```typescript
// src/components/gamification/badge-showcase.tsx
// Grid of badge cards: earned badges show icon + name + earn date,
// locked badges show muted silhouette with "???" or lock icon.
// Uses GlassCard per badge. oklch glass aesthetic.
```

### Quest History Table Structure
```typescript
// src/components/gamification/quest-history-table.tsx
// Simple table with columns: Datum, Quest-Name, Typ, XP, Runen
// Typ shown as colored badge (Daily=blue, Weekly=green, Special=amber)
// Pagination: prev/next buttons with page/total indicator
// Empty state: icon + "Noch keine Quests abgeschlossen"
```

### Sidebar Navigation Entry
```typescript
// In src/components/layout/sidebar.tsx, add after Shop:
{ name: "Heldenkarte", href: "/heldenkarte", icon: IdCard },
// IdCard from lucide-react fits the "character card" / "profile card" metaphor
```

### Class Icon Mapping (for Hero Card)
```typescript
// Lucide icons for SpielKlasse display in hero card
const CLASS_ICONS: Record<string, LucideIcon> = {
  JURIST: Scale,           // Justice scales
  SCHREIBER: FileText,     // Document
  WAECHTER: Shield,        // Shield/guard
  QUARTIERMEISTER: Crown,  // Leader/admin
};

const CLASS_LABELS: Record<string, string> = {
  JURIST: "Jurist",
  SCHREIBER: "Schreiber",
  WAECHTER: "Waechter",
  QUARTIERMEISTER: "Quartiermeister",
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate models for each achievement type | JSON fields on UserGameProfile | Phase 35 (boss trophies) | Badges follow same JSON pattern -- no new model needed |
| Tabs for page sections | Single scroll page | Phase 40 user decision | Simpler implementation, no tab state management |
| Infinite scroll for lists | Paginated with prev/next | Phase 40 user decision | Explicit pagination with total count |

**Deprecated/outdated:**
- None -- this phase uses only established patterns from previous phases.

## Open Questions

1. **Badge storage: separate `badges` field vs. extended `trophies` field?**
   - What we know: Trophies already stores boss victories as JSON. Badges are conceptually different (earned via count thresholds, not boss defeats).
   - What's unclear: Whether mixing badge and trophy types in one JSON array creates confusion.
   - Recommendation: Add a separate `badges Json @default("[]")` field on UserGameProfile. Clean separation, trivial migration. The planner should decide, but this is the cleaner option.

2. **Badge evaluation trigger: lazy on page load only, or also periodically?**
   - What we know: CONTEXT.md says badge notification toast is deferred. Lazy evaluation on page load is the simplest.
   - What's unclear: If a user earns a badge but never visits the Heldenkarte, the badge exists but is not "awarded" until they visit.
   - Recommendation: Lazy evaluation on page load is fine for v1. Badges are display-only. A future phase could add background evaluation + notification.

3. **Exact badge catalog: which 5-8 badges?**
   - What we know: CONTEXT.md gives 4 examples (Fristenwaechter, Aktenkoenig, Streak-Meister, Bannbrecher). 4-5 more are needed.
   - What's unclear: The exact remaining badges.
   - Recommendation: The planner can define 4-5 more badges based on existing quest/activity patterns. Good candidates: "Quester" (100 quests completed), "Dauerbrenner" (7-day streak), "Runen-Sammler" (500 total Runen earned -- tracked via quest completions sum), "Teamkaempfer" (participated in 3 bossfights).

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- Direct inspection of all referenced files:
  - `prisma/schema.prisma` (lines 2274-2384) -- UserGameProfile, QuestCompletion, UserInventoryItem models
  - `src/lib/gamification/types.ts` -- Type definitions, level/XP constants, shop types
  - `src/lib/gamification/game-profile-service.ts` -- Level calculation, profile CRUD, trophy award
  - `src/lib/gamification/shop-items.ts` -- Catalog pattern (to replicate for badges)
  - `src/lib/gamification/shop-service.ts` -- Atomic transaction patterns
  - `src/app/api/gamification/profile/route.ts` -- Existing profile endpoint
  - `src/app/api/gamification/dashboard/route.ts` -- Combined data fetch pattern
  - `src/app/api/gamification/shop/route.ts` -- Auth + opt-in guard, combined GET pattern
  - `src/app/(dashboard)/shop/page.tsx` -- Self-fetching page pattern
  - `src/components/gamification/quest-widget.tsx` -- Absent-until-loaded pattern
  - `src/components/gamification/avatar-frame.tsx` -- Reusable avatar component
  - `src/components/gamification/xp-progress-bar.tsx` -- Reusable XP bar
  - `src/components/gamification/quest-section.tsx` -- Quest row rendering pattern
  - `src/components/layout/sidebar.tsx` -- Navigation entries

### Secondary (MEDIUM confidence)
- None needed -- all patterns derived from existing codebase.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new packages. All libraries already in use and verified in codebase.
- Architecture: HIGH -- All patterns (self-fetching page, JSON storage, catalog file, combined API endpoint) are directly replicated from Phase 35/39 implementations.
- Pitfalls: HIGH -- Identified from direct code inspection. Badge storage, pagination, and trophy unification are the main concerns, all with clear solutions.

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable -- no external library changes involved)
