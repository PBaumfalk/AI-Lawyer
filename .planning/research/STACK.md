# Stack Research

**Domain:** Gamification engine + UX Quick Wins for existing Kanzleisoftware
**Researched:** 2026-03-02
**Confidence:** HIGH

## Executive Summary

v0.4 adds a gamification layer (Quests, XP, Levels, Bossfight, Item Shop, Team Dashboard) and UX quick wins (clickable KPIs, empty states, OCR recovery) to a 125k LOC TypeScript codebase. Unlike v0.2 and v0.3 which were "zero new packages" milestones, v0.4 requires **two small additions**: `canvas-confetti` for quest/bossfight celebration effects and the shadcn/ui `Progress` component (backed by `@radix-ui/react-progress`) for XP bars and bossfight HP bars. Everything else -- quest engine, XP calculation, streak logic, condition evaluation, cron-based daily reset, real-time updates -- builds on existing infrastructure (Prisma, BullMQ, Socket.IO, Motion/React).

The gamification engine is pure server-side business logic (Prisma queries + BullMQ cron + condition evaluator) with a thin UI layer. No game engine, no external gamification SaaS, no complex state machine library. The "quest condition" system uses a JSON DSL evaluated against Prisma aggregation queries -- the same pattern already used for `HelenaAlert.meta` and `FalldatenTemplate.schema`.

---

## Recommended Stack

### Core Technologies

No changes. Existing stack handles all v0.4 requirements.

| Technology | Version | v0.4 Role | Why Sufficient |
|---|---|---|---|
| Next.js 14+ (App Router) | ^14.2.21 | API routes for quest completion, game profile, item shop; pages for dashboard widgets, team view, profile "hero card" | 26+ dashboard pages already built with same pattern |
| TypeScript | ^5.7.2 | Type-safe quest condition DSL, game profile types, reward calculation | Already in use, strong typing prevents XP calculation bugs |
| Tailwind CSS + shadcn/ui | ^3.4.17 | Glass UI for gamification dashboard widgets, quest cards, bossfight banner | oklch design tokens, glass-card, glass-panel already established |
| PostgreSQL 16 | existing | UserGameProfile, Quest, QuestCompletion, Bossfight, InventarItem tables | Relational data with JSON columns for quest conditions. Aggregation queries for condition evaluation. |
| Prisma ORM | ^5.22.0 | New models (~7 tables), aggregation queries for quest condition checks | 80+ models managed. Same migration pattern. `$queryRaw` available for complex aggregations. |
| BullMQ | ^5.70.1 | Daily quest reset cron (midnight), streak calculation cron, bossfight HP sync cron | 16+ workers and 8 cron jobs already registered. `upsertJobScheduler` pattern established. |
| Socket.IO + Redis | 4.8.3 + 5.9.3 | Real-time quest completion toast, bossfight damage broadcast, XP gain animation trigger | Room system (`user:`, `role:`) already handles per-user and broadcast notifications |
| Redis 7 | existing | BullMQ backend, Socket.IO adapter. Daily Runen cap tracking (per-user counter with TTL). | No changes needed. Redis INCR + EXPIRE for Runen-Deckel is trivial. |
| Motion/React | ^12.34.3 | XP bar animations, level-up effects, bossfight damage numbers, quest completion transitions | Already used for GlassKpiCard count-up, sidebar animations, modal transitions |

### New Dependencies (2 packages)

| Library | Version | Purpose | Why Needed |
|---|---|---|---|
| `canvas-confetti` | ^1.9.4 | Quest completion celebration, bossfight phase transition, level-up effect | 6.3 kB gzipped, zero dependencies, performant canvas-based particles. The only visual celebration library needed. Motion/React handles transitions but not particle effects. |
| `@radix-ui/react-progress` | ^1.1.0 | XP progress bar, bossfight HP bar, quest completion progress | shadcn/ui Progress component. `@radix-ui/react-avatar` and `@radix-ui/react-tooltip` already in package.json, so Radix is an established dependency. Accessible (aria-valuenow/max). |

### Existing Libraries Reused

| Library | Version | v0.4 Role | How Used |
|---|---|---|---|
| Motion/React | ^12.34.3 | XP bar spring animation, level-up scale pulse, quest card stagger animation, bossfight damage number fly-up | Already used in GlassKpiCard (count-up), sidebar (spring physics), modals. Extend with `AnimatePresence` for quest completion. |
| Zod | ^3.23.8 | Validate quest condition JSON schema, game profile mutations, item shop transactions | Same pattern as FalldatenTemplate.schema validation |
| date-fns | ^4.1.0 | Streak day calculation (`differenceInCalendarDays`, `startOfDay`), quest reset timing, "3 Tage Streak" formatting | Already used for Fristen, timestamps throughout UI |
| Lucide React | ^0.468.0 | Quest icons (Sword, Shield, Scroll, Coins, Trophy, Flame, Star, Target), class icons, item rarity indicators | 100+ icons already in use. Lucide has all fantasy/achievement iconography needed. |
| Sonner | ^1.7.1 | "+80 XP" toast on quest completion, "Level Up!" toast, "Runen erhalten" toast | Already used for all notification toasts |
| TipTap | ^3.20.0 | NOT used for gamification. Mentioned only to confirm no new editor dependency needed. | -- |

### Development Tools

No new dev tools needed.

| Tool | v0.4 Role | Notes |
|---|---|---|
| Prisma Studio | Inspect game profiles, quest completions, bossfight state during development | Already available via `npm run db:studio` |
| Bull Board | Monitor quest-reset and streak-calculation cron jobs | Already mounted at `/admin/queues` |
| Vitest | Unit tests for XP/Level calculation, streak logic, condition evaluator | Already in devDependencies. These are critical business logic functions (like RVG/Fristen) that warrant testing. |

---

## Installation

```bash
# New runtime dependencies (2 packages)
npm install canvas-confetti @radix-ui/react-progress

# TypeScript types for canvas-confetti (types NOT bundled in the package)
npm install -D @types/canvas-confetti

# Add shadcn/ui Progress component (creates src/components/ui/progress.tsx)
npx shadcn@latest add progress

# After Prisma schema changes:
npx prisma migrate dev --name v04-gamification-profiles-quests
npx prisma generate
```

---

## Feature-Specific Stack Decisions

### 1. Quest Engine (Server-Side Logic, No External Library)

The quest engine is a custom evaluator, not a library. It processes a JSON condition DSL stored in `Quest.bedingung` against real Prisma queries. No npm gamification library exists that matches this domain (legal Kanzlei workflows).

**Quest Condition DSL (JSON stored in `Quest.bedingung`):**

```typescript
// Type definition for quest conditions
type QuestBedingung = {
  typ: 'COUNT' | 'ALL' | 'THRESHOLD' | 'COMPOSITE';
  entity: 'frist' | 'wiedervorlage' | 'rechnung' | 'akte' | 'zeiterfassung' | 'email' | 'dokument';
  filter: Record<string, unknown>;  // Prisma where clause fragment
  operator: 'gte' | 'eq' | 'lte';
  value: number;
  qualifier?: 'WITH_VERMERK' | 'WITH_NEXT_STEP' | 'DOCUMENTED';  // Anti-abuse qualifiers
  subConditions?: QuestBedingung[];  // For COMPOSITE type
};

// Example: "Alle heutigen Fristen geprueft + Vermerk"
const siegelDesTages: QuestBedingung = {
  typ: 'ALL',
  entity: 'frist',
  filter: { ende: { gte: startOfToday, lte: endOfToday }, status: 'ERLEDIGT' },
  operator: 'eq',
  value: 0,  // 0 remaining = all done
  qualifier: 'WITH_VERMERK',
};
```

**Condition Evaluator (pure function, ~150 LOC):**

```typescript
async function evaluateQuestCondition(
  bedingung: QuestBedingung,
  userId: string,
  today: Date
): Promise<{ fulfilled: boolean; current: number; target: number }> {
  // Map entity to Prisma model + apply filter + count/aggregate
  // Return progress for UI display
}
```

**Why custom, not a library:** Gamification libraries (e.g., `gamify`, `node-gamification`) are either abandoned, too generic (badge systems without domain logic), or SaaS-dependent (Bunchball, Badgeville). The quest conditions here are tightly coupled to Prisma models (Frist, Wiedervorlage, Rechnung, Akte). A 150-LOC evaluator is simpler and more maintainable than adapting a generic framework.

**Confidence:** HIGH -- same pattern as the rule-based complexity classifier in v0.2 (pure TypeScript function, no external dependency).

### 2. XP / Level / Streak Calculation (Pure Functions)

```typescript
// Level thresholds -- exponential curve
function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

function calculateLevel(totalXp: number): { level: number; xpInLevel: number; xpToNext: number } {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level + 1)) {
    remaining -= xpForLevel(level + 1);
    level++;
  }
  return {
    level,
    xpInLevel: remaining,
    xpToNext: xpForLevel(level + 1),
  };
}

// Streak bonus multiplier
function streakMultiplier(streakTage: number): number {
  if (streakTage >= 7) return 1.25;  // +25% Runen
  if (streakTage >= 3) return 1.10;  // +10% Runen
  return 1.0;
}
```

These are pure functions with zero dependencies. Test with Vitest (same as RVG calculation tests).

**Confidence:** HIGH -- math functions, fully deterministic.

### 3. Bossfight Real-Time Updates

Bossfight HP changes use the existing Socket.IO broadcast pattern:

```typescript
// After qualified Wiedervorlage completion:
await prisma.bossfight.update({
  where: { id: activeBossfight.id },
  data: { aktuelleHp: { decrement: 1 }, phase: calculatePhase(newHp, maxHp) },
});

// Broadcast to all users (role:* rooms)
emitter.to('role:ADMIN').to('role:ANWALT').to('role:SACHBEARBEITER').to('role:SEKRETARIAT')
  .emit('bossfight:damage', {
    bossfightId: activeBossfight.id,
    damage: 1,
    newHp: newHp,
    phase: calculatePhase(newHp, maxHp),
    userId,
    userName,
  });
```

No new infrastructure. The existing `@socket.io/redis-emitter` handles worker-to-browser broadcast.

**Confidence:** HIGH -- identical pattern to `alert:new` and `message:new` broadcasts.

### 4. BullMQ Cron Jobs (Quest Reset + Streak)

Two new cron jobs using the established `upsertJobScheduler` pattern:

```typescript
// Daily at 00:05 -- reset daily quest progress, calculate streaks
await gamificationQueue.upsertJobScheduler(
  'quest-daily-reset',
  { pattern: '5 0 * * *', tz: 'Europe/Berlin' },
  { name: 'quest-daily-reset' }
);

// Weekly on Monday 00:10 -- reset weekly quests, calculate weekly rewards
await gamificationQueue.upsertJobScheduler(
  'quest-weekly-reset',
  { pattern: '10 0 * * 1', tz: 'Europe/Berlin' },
  { name: 'quest-weekly-reset' }
);
```

The processor checks each user's quest completions from the previous day/week, updates streaks, and recalculates bossfight HP from actual Wiedervorlage counts.

**Confidence:** HIGH -- 8 cron jobs already running with this exact pattern.

### 5. Runen-Deckel (Anti-Abuse via Redis)

Daily Runen cap (max 40 from Wiedervorlagen) uses Redis INCR with midnight TTL:

```typescript
async function canEarnRunen(userId: string, amount: number): Promise<number> {
  const key = `runen:daily:${userId}`;
  const current = await redis.get(key);
  const earned = current ? parseInt(current) : 0;
  const remaining = Math.max(0, 40 - earned);
  const actual = Math.min(amount, remaining);
  if (actual > 0) {
    await redis.incrby(key, actual);
    await redis.expireat(key, endOfDay());
  }
  return actual;
}
```

No new dependency. ioredis (^5.9.3) already provides INCR, GET, EXPIREAT.

**Confidence:** HIGH -- standard Redis counter pattern.

### 6. Celebration Effects (canvas-confetti)

```typescript
import confetti from 'canvas-confetti';

// Quest completion -- quick burst
export function celebrateQuestComplete() {
  confetti({
    particleCount: 60,
    spread: 55,
    origin: { y: 0.7 },
    colors: ['#10b981', '#f59e0b', '#6366f1'],  // emerald, amber, indigo
  });
}

// Level up -- full screen
export function celebrateLevelUp() {
  const duration = 2000;
  const end = Date.now() + duration;
  (function frame() {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

// Bossfight defeat -- explosion
export function celebrateBossfightDefeat() {
  confetti({
    particleCount: 200,
    spread: 160,
    startVelocity: 45,
    origin: { y: 0.5 },
  });
}
```

canvas-confetti is 6.3 kB gzipped, zero dependencies, uses a single `<canvas>` overlay. It self-cleans after animation completes. Works with `prefers-reduced-motion` (skip the call when `useReducedMotion()` returns true, already used in `GlassKpiCard`).

**Confidence:** HIGH -- canvas-confetti is the de facto standard for web celebration effects (295 dependents, 6.8k GitHub stars, actively maintained, last publish 4 months ago).

### 7. Progress Bars (shadcn/ui Progress)

XP bar, bossfight HP bar, and quest progress indicators all need a styled, accessible progress bar. The shadcn/ui Progress component wraps `@radix-ui/react-progress` and integrates with the existing Tailwind + glass design system.

```tsx
// XP Progress Bar with animated fill
import { Progress } from '@/components/ui/progress';

function XpBar({ xpInLevel, xpToNext }: { xpInLevel: number; xpToNext: number }) {
  const percentage = Math.round((xpInLevel / xpToNext) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{xpInLevel} XP</span>
        <span>{xpToNext} XP</span>
      </div>
      <Progress value={percentage} className="h-2 bg-muted/50" />
    </div>
  );
}

// Bossfight HP Bar with color phases
function BossfightHpBar({ hp, maxHp, phase }: { hp: number; maxHp: number; phase: number }) {
  const percentage = Math.round((hp / maxHp) * 100);
  const phaseColor = phase >= 3 ? 'bg-rose-500' : phase >= 2 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <Progress
      value={percentage}
      className="h-3"
      indicatorClassName={phaseColor}
    />
  );
}
```

The shadcn/ui Progress component produces `src/components/ui/progress.tsx` which integrates with existing `glass-card`, `glass-panel` wrappers. The animated fill uses CSS transitions (or Motion/React `animate` for spring physics on the width).

**Confidence:** HIGH -- `@radix-ui/react-progress` is part of the Radix ecosystem already in the project (6 Radix packages installed). shadcn/ui Progress is one of the most commonly added components.

### 8. Empty States Pattern (Reusable Component)

No new dependency. Build a reusable `EmptyState` component using existing Lucide icons and Tailwind:

```tsx
interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actions?: Array<{
    label: string;
    onClick?: () => void;
    href?: string;
    variant?: 'default' | 'outline';
  }>;
}

function EmptyState({ icon: Icon, title, description, actions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      {actions && (
        <div className="flex gap-2">
          {actions.map((action) => (
            <Button key={action.label} variant={action.variant || 'outline'} size="sm" ...>
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
```

The `email-empty-state.tsx` already exists as a pattern. This generalizes it.

**Confidence:** HIGH -- pure UI component using existing Tailwind + shadcn/ui Button.

### 9. Clickable KPI Cards (Extend Existing Component)

The existing `GlassKpiCard` component needs an `onClick` or `href` prop. This is a ~10 LOC change to the existing component:

```tsx
interface GlassKpiCardProps {
  // ... existing props
  onClick?: () => void;  // NEW
  href?: string;         // NEW
}

// Wrap in <button> or Next.js <Link> when onClick/href is provided
```

No new dependency. Extend existing `src/components/ui/glass-kpi-card.tsx`.

**Confidence:** HIGH -- trivial component extension.

### 10. OCR Recovery Flow (Existing Infrastructure)

The OCR recovery flow uses existing infrastructure:

| Recovery Option | Technology | Already Available |
|---|---|---|
| Retry OCR | BullMQ queue re-add to `ocr` queue | YES -- same as existing retry icon |
| Vision Analysis | Vercel AI SDK v4 `generateText()` with image attachment | YES -- AI SDK supports image inputs. Use GPT-4o or Claude for image-to-text. |
| Manual Input | Plain textarea form, save to `Dokument.ocrText` | YES -- Prisma update |

No new dependencies. The Vision Analysis path uses the existing multi-provider AI SDK setup with an image URL (presigned MinIO URL) passed as a user message attachment.

**Confidence:** HIGH for retry and manual. MEDIUM for Vision Analysis -- the AI SDK image input pattern needs testing with the MinIO presigned URL workflow, but the capability exists in AI SDK v4.

---

## Prisma Schema Changes Summary

### New Models

| Model | Fields (approx.) | Purpose |
|---|---|---|
| `UserGameProfile` | ~10 | XP, level, Runen, streak, class per user |
| `Quest` | ~10 | Quest definition with JSON condition, rewards, class filter |
| `QuestCompletion` | ~7 | Track which user completed which quest when, audit flag |
| `Bossfight` | ~8 | Active team challenge, HP tracking, phase progression |
| `BossfightDamage` | ~5 | Per-user damage log for team dashboard attribution |
| `ShopItem` | ~8 | Item definitions (cosmetic, comfort, trophy) with rarity/price |
| `InventarItem` | ~5 | User's purchased/earned items |

### New Enums

| Enum | Values |
|---|---|
| `Klasse` | JURIST, SCHREIBER, WAECHTER, QUARTIERMEISTER |
| `QuestTyp` | DAILY, WEEKLY, SPECIAL, BOSSFIGHT |
| `ItemTyp` | RELIKT (cosmetic), ARTEFAKT (comfort perk), TROPHAEE (prestige) |
| `ItemRarität` | COMMON, RARE, EPIC, LEGENDARY |

### Relation to Existing Models

`UserGameProfile.userId` references `User.id` (one-to-one). No changes to existing models. The quest condition evaluator reads existing tables (Frist, Wiedervorlage, Rechnung, Akte, Zeiterfassung) via Prisma queries -- it does not modify them.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|---|---|---|
| Custom quest evaluator (~150 LOC) | `gamification-engine` npm packages | Never for this project. No package understands legal workflow entities (Frist, Wiedervorlage, Rechnung). Custom evaluator is tightly coupled to Prisma schema. |
| `canvas-confetti` (6.3 kB) | `react-confetti` / `@tsparticles/confetti` | `react-confetti` renders confetti filling the entire viewport (not targeted bursts). `@tsparticles` is 50+ kB for a particle engine we use once. canvas-confetti is the right size. |
| `canvas-confetti` (6.3 kB) | Lottie animations (lottie-react) | Lottie requires designing/sourcing JSON animation files. canvas-confetti is code-configured, no asset pipeline. For 3 celebration types, confetti is simpler. |
| `canvas-confetti` (6.3 kB) | CSS-only animations | CSS cannot produce realistic particle physics (random spread, gravity, rotation). canvas-confetti does this in 6 kB. |
| `@radix-ui/react-progress` (via shadcn/ui) | Custom SVG circular progress | Circular looks nice but XP bars and HP bars are traditionally linear. Linear progress is more readable at a glance. shadcn/ui gives us accessible, styled, zero-effort. |
| `@radix-ui/react-progress` (via shadcn/ui) | HTML `<progress>` element | Unstylable in Safari/Firefox. Radix gives full CSS control + aria attributes. |
| Redis INCR for Runen-Deckel | Prisma daily aggregate query | Redis INCR is O(1) vs Prisma COUNT which requires a DB round-trip with date filter. For a high-frequency check (every quest completion), Redis wins. |
| BullMQ cron for daily reset | `node-cron` / `cron` npm | BullMQ already runs 8 cron jobs. Adding a separate cron library creates two scheduling systems. Use the established pattern. |
| JSON DSL for quest conditions | Hardcoded TypeScript functions per quest | JSON DSL is stored in DB, enabling admin-created quests (Phase 2+) without code deploys. TypeScript functions would require redeployment for every new quest. |
| Motion/React for UI animations | GSAP / react-spring / anime.js | Motion/React is already installed and used throughout. No reason to add a second animation library. |
| Socket.IO broadcast for bossfight | HTTP polling | Real-time damage display is the "wow factor" of the bossfight. Polling every 5s would miss the moment. Socket.IO is already connected on every client. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|---|---|---|
| `gamify` / `node-gamification` / any gamification npm | Abandoned or too generic. None understand Prisma or legal domain entities. | Custom quest evaluator (~150 LOC) + Prisma queries |
| `@tsparticles/engine` | 50+ kB for a full particle system. We need confetti bursts, not a particle engine. | `canvas-confetti` (6.3 kB) |
| `lottie-react` / `@lottiefiles/react` | Requires JSON animation assets. No asset pipeline exists. canvas-confetti is code-only. | `canvas-confetti` for celebrations, Motion/React for transitions |
| `react-spring` / `gsap` / `anime.js` | Motion/React v12 is already installed and used in 10+ components. Adding a second animation library is wasteful. | `motion/react` (existing) |
| `zustand` / `jotai` / React Query | No global state management exists in the codebase. Game state (profile, quests) is fetched per-page via `fetch()` + `useEffect`, same as all other data. | React state + `fetch()` + `router.refresh()` (existing pattern) |
| `node-cron` / `cron` npm | BullMQ already handles all cron scheduling with `upsertJobScheduler`. Adding a second scheduler creates confusion. | BullMQ repeatable jobs (existing) |
| `recharts` / `chart.js` / `d3` | Team dashboard uses simple aggregate numbers (Erfuellungsquote, Backlog-Delta), not complex charts. A table or GlassKpiCards suffice for 5 users. If charts are ever needed, defer to a future milestone. | Tables + GlassKpiCard + Progress bars |
| External gamification SaaS (Bunchball, Mambo.io) | Violates self-hosted constraint. The gamification logic is deeply coupled to Prisma data. | Custom engine |
| `@radix-ui/react-slider` | Slider is for user input (e.g., volume control). Progress bars show read-only values. Different component. | `@radix-ui/react-progress` |
| Database-level computed columns | PostgreSQL computed columns cannot call Prisma. XP/Level calculation stays in application code. | TypeScript pure functions |

---

## Stack Patterns by Feature Area

**Gamification Dashboard Widget:**
- Glass design: `glass-card` wrapper + oklch tokens (existing)
- XP bar: `<Progress>` (new) + Motion/React `animate` for spring-fill
- Quest list: `map()` over daily quests with completion checkmarks
- Bossfight banner: `<Progress>` for HP + Socket.IO listener for real-time damage

**Quest Completion Flow:**
- User completes work (e.g., marks Frist as ERLEDIGT with Vermerk)
- API route checks quest conditions → if fulfilled, creates `QuestCompletion`
- Awards XP + Runen (with streak multiplier + Runen cap check)
- Socket.IO push `quest:completed` to `user:{userId}`
- Client shows toast (Sonner) + confetti (canvas-confetti)
- If bossfight active: decrement HP + broadcast `bossfight:damage`

**Level Up Flow:**
- `calculateLevel(newTotalXp)` detects level change
- Socket.IO push `level:up` to `user:{userId}`
- Client shows full-screen confetti + Motion/React scale animation on level badge
- No gameplay impact (levels are prestige, not gating)

**Item Shop:**
- Server-side Runen deduction + InventarItem creation (transactional)
- Prisma `$transaction` ensures atomic purchase
- No real currency, no payment integration, no external service

---

## Version Compatibility

| Package | Compatible With | Notes |
|---|---|---|
| `canvas-confetti@^1.9.4` | Any React version, any browser | Pure canvas API, no React dependency. Import as ES module. |
| `@types/canvas-confetti@^1.9.0` | `canvas-confetti@^1.9.x` | Types are from DefinitelyTyped, not bundled in the package |
| `@radix-ui/react-progress@^1.1.0` | React 18, existing Radix packages (^1.1.x range) | Same Radix version family as react-avatar (^1.1.2), react-tooltip (^1.1.6) |
| Motion/React ^12.34.3 (existing) | All new components | No version change needed. Already at latest. |
| Prisma ^5.22.0 (existing) | New models follow same patterns | No version change needed. Json type, enums, relations all proven. |
| BullMQ ^5.70.1 (existing) | New cron jobs | No version change needed. `upsertJobScheduler` available since 5.16.0. |

---

## Socket.IO Events (New)

| Event | Direction | Room Target | Payload |
|---|---|---|---|
| `quest:completed` | server -> client | `user:{userId}` | `{ questId, questName, xpEarned, runenEarned, newTotalXp, newLevel? }` |
| `quest:progress` | server -> client | `user:{userId}` | `{ questId, current, target }` |
| `level:up` | server -> client | `user:{userId}` | `{ newLevel, title }` |
| `bossfight:damage` | server -> client | all role rooms | `{ bossfightId, damage, newHp, maxHp, phase, userId, userName }` |
| `bossfight:phaseChange` | server -> client | all role rooms | `{ bossfightId, newPhase, bonusActive }` |
| `bossfight:defeated` | server -> client | all role rooms | `{ bossfightId, name }` |
| `streak:update` | server -> client | `user:{userId}` | `{ streakTage, multiplier }` |

---

## BullMQ Queues (New)

| Queue | Schedule | Processor Logic |
|---|---|---|
| `gamification` (daily reset) | `5 0 * * *` Europe/Berlin | For each user: evaluate yesterday's core quests, update streak (increment or reset), clear daily Runen counter in Redis |
| `gamification` (weekly reset) | `10 0 * * 1` Europe/Berlin | For each user: evaluate last week's weekly quests, award weekly bonuses |
| `gamification` (bossfight sync) | `0 3 * * *` Europe/Berlin | Recalculate bossfight HP from actual Wiedervorlage count (anti-drift, ensures HP matches reality) |

All three use the same `gamification` queue with different job names, following the pattern of `fristReminderQueue` handling multiple job types.

---

## Confidence Assessment

| Area | Confidence | Reason |
|---|---|---|
| Quest engine (custom evaluator) | HIGH | Pure TypeScript, same pattern as v0.2 complexity classifier. JSON DSL + Prisma queries. |
| XP/Level/Streak math | HIGH | Pure functions, fully testable, no external dependency |
| canvas-confetti | HIGH | 6.8k stars, actively maintained, 1.9.4 stable, zero deps, 6.3 kB gzipped |
| @radix-ui/react-progress | HIGH | Part of Radix ecosystem (6 Radix packages already installed), shadcn/ui component |
| BullMQ cron for resets | HIGH | 8 cron jobs already use identical pattern |
| Socket.IO for real-time | HIGH | 7+ event types already use identical broadcast pattern |
| Redis Runen cap | HIGH | Standard INCR + EXPIRE pattern, ioredis already available |
| Empty states component | HIGH | Pure UI, extends existing `email-empty-state.tsx` pattern |
| Clickable KPI cards | HIGH | ~10 LOC change to existing component |
| OCR Vision fallback | MEDIUM | AI SDK v4 supports image inputs, but MinIO presigned URL -> AI provider image path not yet tested |
| Bossfight real-time | HIGH | Socket.IO broadcast to role rooms, identical to alert broadcasts |
| Item Shop transactions | HIGH | Prisma `$transaction` for atomic Runen deduction + item creation |

---

## Sources

- [canvas-confetti npm](https://www.npmjs.com/package/canvas-confetti) -- version 1.9.4, 6.3 kB gzipped, zero dependencies
- [canvas-confetti GitHub](https://github.com/catdad/canvas-confetti) -- 6.8k stars, actively maintained
- [@types/canvas-confetti npm](https://www.npmjs.com/package/@types/canvas-confetti) -- version 1.9.0, DefinitelyTyped
- [shadcn/ui Progress component](https://ui.shadcn.com/docs/components/radix/progress) -- wraps @radix-ui/react-progress
- [Radix UI Progress](https://www.radix-ui.com/primitives/docs/components/progress) -- accessible progress indicator
- [BullMQ Job Schedulers](https://docs.bullmq.io/guide/job-schedulers) -- upsertJobScheduler pattern (v5.16.0+)
- [BullMQ Repeat Options](https://docs.bullmq.io/guide/job-schedulers/repeat-options) -- cron pattern format
- [Motion for React](https://motion.dev/docs/react) -- v12 stable, no breaking changes from v11
- Codebase analysis (all HIGH confidence):
  - `package.json` -- full dependency audit, confirmed 2 missing packages
  - `src/components/ui/glass-kpi-card.tsx` -- existing KPI card with Motion/React count-up
  - `src/components/email/email-empty-state.tsx` -- existing empty state pattern
  - `src/lib/queue/queues.ts` -- 8 `upsertJobScheduler` calls, established cron pattern
  - `src/worker.ts` -- 16+ BullMQ workers, startup/shutdown patterns
  - `src/lib/socket/rooms.ts` -- room join/leave patterns
  - `src/lib/socket/emitter.ts` -- Redis emitter for worker-to-browser broadcast
  - `prisma/schema.prisma` -- 80+ models, Json type usage, enum patterns

---

*Stack research for: AI-Lawyer v0.4 -- Gamification + Quick Wins*
*Researched: 2026-03-02*
