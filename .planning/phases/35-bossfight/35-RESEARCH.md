# Phase 35: Bossfight - Research

**Researched:** 2026-03-02
**Domain:** Real-time gamification mechanics (Prisma + Socket.IO + BullMQ)
**Confidence:** HIGH

## Summary

Phase 35 implements a team-wide "Bossfight" mechanic where a shared monster's HP is tied to the count of open Wiedervorlagen. Clearing Wiedervorlagen deals damage; new ones heal the boss. The boss has 4 HP-threshold phases with escalating Runen rewards, and defeating it awards a collective Legendary trophy. The entire system broadcasts state changes in real-time via Socket.IO.

The implementation is entirely within the existing stack: two new Prisma models (`Bossfight`, `BossfightDamage`), a server-side engine service that manages HP/phase transitions, hooks into the existing `KalenderEintrag` erledigt route for damage triggers, Socket.IO Redis emitter for real-time broadcasts, and a full-width `BossfightBanner` client component on the dashboard. Admin configuration uses the existing `SystemSetting` pattern. No new npm packages are required except `canvas-confetti` for the victory celebration.

**Primary recommendation:** Build the schema + engine first (Plan 01), then the dashboard UI + Socket.IO integration + admin config (Plan 02). The engine is the core logic; the UI consumes it via API + Socket.IO events.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full-width GlassCard **top banner** at the very top of the dashboard, above KPIs
- Boss only renders when active; when inactive, show a **teaser card** with current Wiedervorlage backlog count + threshold ("Noch 12 bis zum naechsten Boss")
- Themed **Lucide icon** per boss phase (e.g. Skull, Bug, Flame) -- icon changes at phase transitions
- **Animated HP bar** with color transitions: green -> amber -> rose as HP drops
- **Named bosses from a pool** of 5-10 German-themed names (e.g. "Der Aktenberg", "Fristenfresser", "Backlog-Krake") -- each spawn picks one randomly
- **1:1 HP mapping**: Boss HP = number of open Wiedervorlagen at spawn. Clearing 1 WV = 1 damage
- **Boss heals**: New Wiedervorlagen created during an active fight ADD HP to the boss
- **Damage trigger**: Setting `erledigt=true` on a KalenderEintrag with `typ=WIEDERVORLAGE`
- **Per-user damage tracking**: BossfightDamage table records userId + timestamp for each point of damage dealt
- **HP threshold transitions**: Phase 2 at 75% HP, Phase 3 at 50% HP, Phase 4 at 25% HP
- **Dual reward structure**: Per-hit Runen multiplier (Phase 1=base, Phase 2=1.5x, Phase 3=2x, Phase 4=3x) + Team-wide Runen bonus at each phase transition
- **Phase 4 victory**: Legendary trophy entry on every participant's GameProfile + significant one-time XP bonus for all
- **No timeout**: Boss persists until defeated. HP fluctuates with incoming/outgoing Wiedervorlagen
- **Damage ticker** inside the boss banner: scrolling feed of "Max hat 1 WV erledigt (-1 HP)"
- **Top 3 leaderboard** in the banner showing damage dealers during the active fight, real-time via Socket.IO
- **Victory celebration**: Banner transforms into victory banner with confetti animation, shows MVP, total team damage, Runen earned. Stays ~30s, then transitions to trophy display
- Real-time updates via **Socket.IO broadcast** to all connected clients (Redis emitter pattern)
- **Threshold + cooldown** in Einstellungen under Gamification tab
- Admin sets spawn threshold: "Boss spawns when open Wiedervorlagen exceed X" (default 30)
- Minimum cooldown between bosses (e.g. 24h after last defeat before a new boss can spawn)

### Claude's Discretion
- Exact boss name pool and icon-per-phase mapping
- Confetti animation implementation details
- Exact Runen amounts for phase bonuses and base per-hit rewards
- Damage ticker scroll behavior and max visible entries
- Trophy display format on GameProfile

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOSS-01 | Bossfight-Mechanik mit HP = offene Wiedervorlagen (Team kaempft gemeinsam gegen Backlog-Monster) | Prisma `Bossfight` model with `spawnHp`, `currentHp`, `phase` fields; `BossfightDamage` tracks per-user hits; engine service manages HP/spawn/defeat lifecycle; hook into `KalenderEintrag` erledigt route for damage + creation route for healing |
| BOSS-02 | 4 Boss-Phasen mit eskalierenden Belohnungen (Phase 3: mehr Runen, Phase 4: Legendary-Trophae) | Phase transition constants (75%/50%/25% HP thresholds); Runen multiplier per phase; team-wide bonus at each transition; `awardRewards()` from `game-profile-service.ts` handles atomic XP/Runen increment; new `trophies` JSON field on `UserGameProfile` for Legendary |
| BOSS-03 | Team-Fortschritts-Banner auf Dashboard mit Echtzeit-Updates via Socket.IO | `BossfightBanner` client component with `useSocket()` hook; `boss:damage`, `boss:phase-change`, `boss:defeated` events via `getSocketEmitter()` to `kanzlei:{kanzleiId}` room; HP bar, damage ticker, top-3 leaderboard, victory celebration |
| BOSS-04 | Boss-Activation konfigurierbar (Admin setzt Schwellenwert fuer Backlog-Groesse) | `SystemSetting` keys `gamification.boss.threshold` (number, default 30) and `gamification.boss.cooldownHours` (number, default 24); admin UI in Einstellungen Gamification tab; boss spawn check runs after WV count exceeds threshold |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 6.x (existing) | Bossfight + BossfightDamage models, atomic HP updates | Single source of truth (project convention) |
| Socket.IO + @socket.io/redis-emitter | (existing) | Real-time boss state broadcasts | Existing pattern: `getSocketEmitter().to(room).emit(event, data)` |
| BullMQ | (existing) | Boss spawn check job, phase transition processing | Existing gamification queue + processor pattern |
| motion | ^12.34.3 (existing) | HP bar animation, victory banner transitions | Already used in `XpProgressBar` |
| canvas-confetti | ^1.9.x | Victory confetti animation | Lightweight (6KB), no-dependency, fire-and-forget API |
| Lucide React | (existing) | Boss phase icons (Skull, Bug, Flame, etc.) | Project standard icon library |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | (existing) | Cooldown calculation (addHours, differenceInHours) | Boss cooldown elapsed check |
| Zod | (existing) | Admin config form validation | Threshold/cooldown input validation |
| Sonner | (existing) | Toast notifications for phase transitions | Team-wide toast on boss spawn/phase change/defeat |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| canvas-confetti | CSS animations | canvas-confetti is 6KB, battle-tested, fire-and-forget; CSS confetti is manual and less impressive |
| kanzlei room broadcast | Emit to each role room individually | kanzlei room is cleaner (1 emit vs 4); requires adding `kanzlei:{id}` auto-join in rooms.ts |
| Dedicated Bossfight queue | Reuse gamification queue | Reusing gamification queue is simpler; boss jobs are just another job name on the same queue |

**Installation:**
```bash
npm install canvas-confetti && npm install -D @types/canvas-confetti
```

## Architecture Patterns

### Recommended Project Structure
```
prisma/
  schema.prisma              # + Bossfight, BossfightDamage models
src/
  lib/
    gamification/
      boss-engine.ts         # Core boss lifecycle: spawn, damage, heal, phase transitions, defeat
      boss-constants.ts      # Phase thresholds, rewards, boss names, icon mapping
      game-profile-service.ts # Extended with trophy awarding
    queue/
      processors/
        gamification.processor.ts  # Extended with boss-check, boss-damage jobs
      queues.ts              # Extended GamificationJobData with boss job types
    socket/
      rooms.ts               # Add kanzlei:{kanzleiId} auto-join room
  app/
    api/
      gamification/
        bossfight/
          route.ts           # GET current boss state (for initial load)
        bossfight/admin/
          route.ts           # GET/PATCH boss admin settings (threshold, cooldown)
      kalender/
        [id]/
          erledigt/route.ts  # Hook: trigger boss damage on WV erledigt
        route.ts             # Hook: trigger boss heal on new WV creation
  components/
    gamification/
      bossfight-banner.tsx   # Full-width GlassCard banner component
      boss-hp-bar.tsx        # Animated HP bar with color transitions
      boss-damage-ticker.tsx # Scrolling damage feed
      boss-leaderboard.tsx   # Top 3 damage dealers
      boss-victory.tsx       # Victory celebration with confetti
```

### Pattern 1: Boss Engine (Server-Side State Machine)
**What:** Centralized service managing all boss state transitions with atomic Prisma operations
**When to use:** All boss state changes (spawn, damage, heal, phase transition, defeat)
**Example:**
```typescript
// src/lib/gamification/boss-engine.ts

/** Deal 1 damage point from a user clearing a Wiedervorlage */
export async function dealBossDamage(bossfightId: string, userId: string): Promise<DamageResult> {
  // Atomic transaction: decrement HP, record damage, check phase transition
  return prisma.$transaction(async (tx) => {
    const boss = await tx.bossfight.update({
      where: { id: bossfightId },
      data: { currentHp: { decrement: 1 } },
    });

    await tx.bossfightDamage.create({
      data: { bossfightId, oderId: null, userId, amount: 1 },
    });

    // Check phase transition
    const newPhase = calculatePhase(boss.currentHp, boss.spawnHp);
    if (newPhase !== boss.phase) {
      await tx.bossfight.update({
        where: { id: bossfightId },
        data: { phase: newPhase },
      });
      // Award team-wide phase transition bonus
      await awardPhaseBonus(tx, bossfightId, newPhase);
    }

    // Check defeat
    if (boss.currentHp <= 0) {
      await tx.bossfight.update({
        where: { id: bossfightId },
        data: { status: "DEFEATED", defeatedAt: new Date() },
      });
      await awardVictoryRewards(tx, bossfightId);
    }

    return { boss, newPhase, defeated: boss.currentHp <= 0 };
  });
}
```

### Pattern 2: Socket.IO Team Broadcast via Kanzlei Room
**What:** Broadcasting boss events to all connected team members using a kanzlei-scoped room
**When to use:** All boss state changes that need real-time UI updates
**Example:**
```typescript
// In rooms.ts -- add kanzlei room auto-join
if (kanzleiId) {
  const kanzleiRoom = `kanzlei:${kanzleiId}`;
  socket.join(kanzleiRoom);
}

// In boss-engine.ts -- emit after state change
import { getSocketEmitter } from "@/lib/socket/emitter";

function emitBossEvent(kanzleiId: string, event: string, data: unknown) {
  getSocketEmitter()
    .to(`kanzlei:${kanzleiId}`)
    .emit(event, data);
}

// Usage:
emitBossEvent(kanzleiId, "boss:damage", {
  bossfightId, userId, userName, currentHp, maxHp, phase
});
emitBossEvent(kanzleiId, "boss:phase-change", {
  bossfightId, newPhase, bonusRunen
});
emitBossEvent(kanzleiId, "boss:defeated", {
  bossfightId, mvpUserId, mvpUserName, totalDamage, runenEarned
});
```

### Pattern 3: Self-Fetching Banner with Socket.IO Overlay
**What:** Dashboard banner that loads initial state via API, then overlays real-time updates via Socket.IO
**When to use:** The BossfightBanner component on the dashboard
**Example:**
```typescript
// Same pattern as QuestWidget: fetch initial state, then listen for updates
export function BossfightBanner() {
  const [boss, setBoss] = useState<BossState | null>(null);
  const { socket } = useSocket();

  // Initial fetch
  useEffect(() => {
    fetch("/api/gamification/bossfight")
      .then(r => r.ok ? r.json() : null)
      .then(setBoss);
  }, []);

  // Real-time overlay
  useEffect(() => {
    if (!socket) return;
    socket.on("boss:damage", (data) => {
      setBoss(prev => prev ? { ...prev, currentHp: data.currentHp, phase: data.phase } : prev);
      // Add to damage ticker
    });
    socket.on("boss:defeated", (data) => {
      // Trigger victory celebration
    });
    return () => { socket.off("boss:damage"); socket.off("boss:defeated"); };
  }, [socket]);

  // Render: active boss banner OR teaser card
}
```

### Pattern 4: Damage Hook in Existing API Routes
**What:** Adding boss damage/heal triggers to existing KalenderEintrag API routes without modifying business logic
**When to use:** After the Prisma update succeeds in the erledigt and creation routes
**Example:**
```typescript
// In /api/kalender/[id]/erledigt/route.ts -- after successful update
// Only trigger for WIEDERVORLAGE type entries being marked erledigt
if (parsed.data.erledigt && existing.typ === "WIEDERVORLAGE") {
  // Fire-and-forget: never block business route
  enqueueBossDamage(userId).catch(() => {});
}

// In /api/kalender/route.ts (POST) -- after successful creation
// Only trigger for new WIEDERVORLAGE entries during active boss
if (body.typ === "WIEDERVORLAGE") {
  enqueueBossHeal().catch(() => {});
}
```

### Anti-Patterns to Avoid
- **Polling for boss state:** Do NOT poll `/api/gamification/bossfight` on an interval. Use Socket.IO events for real-time updates, API only for initial load and reconnection recovery.
- **Direct HP manipulation without transaction:** Always use `prisma.$transaction` for HP changes to prevent race conditions when multiple users clear WVs simultaneously.
- **Inline boss processing in API routes:** Boss damage/heal should be fire-and-forget (enqueue to BullMQ), never blocking the KalenderEintrag API response.
- **Storing boss state in Redis only:** Prisma is the source of truth. Redis emitter is just the broadcast channel.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confetti animation | Custom CSS/canvas particles | `canvas-confetti` | 6KB, works on any element, fire-and-forget API, handles cleanup |
| HP bar animation | Manual CSS transitions | `motion` (existing) + `animate()` | Already used in XpProgressBar, smooth interpolation |
| Atomic HP counter | Raw SQL UPDATE ... SET hp = hp - 1 | Prisma `{ decrement: 1 }` inside `$transaction` | Prisma handles race conditions, type-safe |
| Real-time broadcast | WebSocket server from scratch | `getSocketEmitter()` (existing) | Redis-backed, works from worker processes, no extra server |
| Admin settings storage | New config table | `SystemSetting` + `getSettingTyped()` | Existing pattern with cache, Redis pub/sub propagation |

**Key insight:** The entire boss engine is a state machine operating on Prisma data with Socket.IO side-effects. Every piece of infrastructure already exists -- the new work is business logic only.

## Common Pitfalls

### Pitfall 1: Race Condition on Concurrent Damage
**What goes wrong:** Two users clear WVs at the same millisecond; both read HP=10, both write HP=9 instead of HP=8.
**Why it happens:** Non-atomic read-then-write pattern.
**How to avoid:** Use `prisma.$transaction()` with `{ decrement: 1 }` for HP updates. Prisma's atomic increment/decrement generates `UPDATE ... SET current_hp = current_hp - 1` SQL which is inherently safe.
**Warning signs:** Boss HP doesn't match expected value after multiple rapid clears.

### Pitfall 2: Boss Spawn Triggered Multiple Times
**What goes wrong:** Multiple users cross the WV threshold simultaneously, spawning multiple bosses.
**Why it happens:** Non-atomic "check threshold + create boss" sequence.
**How to avoid:** Use a unique constraint on `Bossfight` (e.g., `status = ACTIVE` unique per kanzlei) or a `$transaction` with a check-then-create pattern. Only ONE active boss per kanzlei at any time.
**Warning signs:** Multiple active boss records in the database.

### Pitfall 3: Phantom Damage After Boss Defeat
**What goes wrong:** A damage event arrives after the boss reaches 0 HP, causing negative HP or errors.
**Why it happens:** Async processing delay between the defeating hit and the status update.
**How to avoid:** Check `boss.status === "ACTIVE"` inside the transaction before applying damage. If boss is already DEFEATED, silently discard the damage.
**Warning signs:** Negative HP values, errors in damage processing after victory.

### Pitfall 4: HP Bar Stutter from Optimistic vs Real-Time Conflicts
**What goes wrong:** The HP bar jumps around because optimistic local state and Socket.IO events arrive out of order.
**Why it happens:** Client applies optimistic -1 HP, then receives a Socket.IO event with the "real" HP which may be different.
**How to avoid:** Do NOT use optimistic updates for the HP bar. Always use the authoritative HP value from Socket.IO events. The banner is read-only for all users except the one dealing damage, and even that user should trust the server state.
**Warning signs:** HP bar flickering or jumping values.

### Pitfall 5: Stale Boss State on Page Navigation
**What goes wrong:** User navigates away from dashboard and back; banner shows outdated boss state.
**Why it happens:** Component remounts but Socket.IO events received during unmount are lost.
**How to avoid:** Refetch boss state from API on component mount (same pattern as QuestWidget). Socket.IO events are for live updates only, not for state recovery.
**Warning signs:** Boss banner shows wrong HP after navigation.

### Pitfall 6: Boss Heal Creates Unbounded HP
**What goes wrong:** New WVs created during a fight increase HP above the spawn HP, making the boss harder than intended.
**Why it happens:** The user decision explicitly says "boss heals" from new WVs, but no cap is defined.
**How to avoid:** Cap `currentHp` at `spawnHp` (original HP at spawn time). New WVs heal but never exceed the original HP. This prevents griefing where someone creates 100 fake WVs.
**Warning signs:** Boss HP exceeds spawn HP.

## Code Examples

### Prisma Schema: Bossfight + BossfightDamage Models
```prisma
// Bossfight status enum
enum BossfightStatus {
  ACTIVE
  DEFEATED
}

model Bossfight {
  id          String           @id @default(cuid())
  kanzleiId   String
  kanzlei     Kanzlei          @relation(fields: [kanzleiId], references: [id], onDelete: Cascade)
  name        String           // Random from boss name pool
  spawnHp     Int              // HP at spawn = open WV count
  currentHp   Int              // Current HP (decremented by damage, incremented by heals)
  phase       Int              @default(1) // 1-4
  status      BossfightStatus  @default(ACTIVE)
  spawnedAt   DateTime         @default(now())
  defeatedAt  DateTime?
  // Reward tracking
  phaseRewardsGiven Int        @default(0) // Bitmask: which phase bonuses already awarded

  damages     BossfightDamage[]

  @@index([kanzleiId, status])
  @@map("bossfights")
}

model BossfightDamage {
  id           String    @id @default(cuid())
  bossfightId  String
  bossfight    Bossfight @relation(fields: [bossfightId], references: [id], onDelete: Cascade)
  userId       String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  amount       Int       @default(1) // Always 1 for WV clears
  runenEarned  Int       @default(0) // Per-hit Runen (with phase multiplier)
  createdAt    DateTime  @default(now())

  @@index([bossfightId, userId])
  @@index([bossfightId, createdAt])
  @@map("bossfight_damages")
}
```

### Boss Engine: Phase Calculation
```typescript
// src/lib/gamification/boss-constants.ts

export const BOSS_NAMES = [
  "Der Aktenberg",
  "Fristenfresser",
  "Backlog-Krake",
  "Papierdrache",
  "Der Paragraphenwurm",
  "Terminmonster",
  "Aktenstaub-Golem",
];

export const PHASE_ICONS = {
  1: "Bug",        // Lucide: initial threat
  2: "Flame",      // Lucide: heating up
  3: "Skull",      // Lucide: danger zone
  4: "Swords",     // Lucide: final battle
} as const;

export const PHASE_THRESHOLDS = [
  { phase: 4, hpFraction: 0.25 }, // Below 25% -> Phase 4
  { phase: 3, hpFraction: 0.50 }, // Below 50% -> Phase 3
  { phase: 2, hpFraction: 0.75 }, // Below 75% -> Phase 2
  // Phase 1 is default (above 75%)
] as const;

export const PHASE_RUNEN_MULTIPLIER = {
  1: 1.0,
  2: 1.5,
  3: 2.0,
  4: 3.0,
} as const;

/** Base Runen per WV clear during bossfight */
export const BASE_HIT_RUNEN = 5;

/** Team-wide bonus Runen at each phase transition */
export const PHASE_TRANSITION_BONUS = {
  2: 20,   // Entering Phase 2
  3: 40,   // Entering Phase 3
  4: 80,   // Entering Phase 4
} as const;

/** Victory rewards */
export const VICTORY_XP_BONUS = 500;
export const VICTORY_RUNEN_BONUS = 100;

export function calculatePhase(currentHp: number, spawnHp: number): number {
  if (spawnHp <= 0) return 1;
  const fraction = currentHp / spawnHp;
  for (const threshold of PHASE_THRESHOLDS) {
    if (fraction <= threshold.hpFraction) return threshold.phase;
  }
  return 1;
}
```

### Socket.IO: Kanzlei Room Auto-Join
```typescript
// Addition to src/lib/socket/rooms.ts -- in the connection handler
if (kanzleiId) {
  const kanzleiRoom = `kanzlei:${kanzleiId}`;
  socket.join(kanzleiRoom);
  log.debug({ userId, kanzleiId }, "Joined Kanzlei room");
}
```

### Admin Settings Keys
```typescript
// Addition to src/lib/settings/defaults.ts
{
  key: "gamification.boss.threshold",
  value: "30",
  type: "number",
  category: "gamification",
  label: "Boss-Schwellenwert (offene Wiedervorlagen)",
  min: 5,
  max: 200,
},
{
  key: "gamification.boss.cooldownHours",
  value: "24",
  type: "number",
  category: "gamification",
  label: "Boss-Abklingzeit (Stunden nach Sieg)",
  min: 1,
  max: 168,
},
```

### HP Bar Component (Color Transitions)
```typescript
// Color transitions based on HP fraction
function getHpBarColor(fraction: number): string {
  if (fraction > 0.5) return "from-emerald-500 to-emerald-400";
  if (fraction > 0.25) return "from-amber-500 to-amber-400";
  return "from-rose-500 to-rose-400";
}
```

### Victory Confetti
```typescript
// canvas-confetti usage -- fire-and-forget
import confetti from "canvas-confetti";

function triggerVictoryConfetti() {
  // Two bursts from left and right
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
  confetti({ ...defaults, particleCount: 80, origin: { x: 0.2, y: 0.6 } });
  confetti({ ...defaults, particleCount: 80, origin: { x: 0.8, y: 0.6 } });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| framer-motion | motion (same API, rebranded) | 2024 | Already using `motion/react` in project |
| Manual WebSocket | Socket.IO + Redis emitter | Existing | Team-wide broadcast via rooms is established pattern |
| Custom confetti | canvas-confetti | Stable since 2020 | 6KB, zero config, no cleanup needed |

**Deprecated/outdated:**
- `framer-motion` package name: Use `motion` import path (already done in project)

## Open Questions

1. **Trophy storage on UserGameProfile**
   - What we know: User decided Phase 4 victory grants a "Legendary trophy entry" on every participant's GameProfile
   - What's unclear: No `trophies` field exists on `UserGameProfile` yet. Need to add a JSON array field or a new `Trophy` model.
   - Recommendation: Add a `trophies Json @default("[]")` field on `UserGameProfile`. Each trophy is `{ type: "BOSS_VICTORY", bossName: string, date: string, bossfightId: string }`. This is simpler than a separate model and Phase 40 (Profil/Heldenkarte) can display it.

2. **Boss spawn trigger: automatic vs manual**
   - What we know: Admin configures threshold. STATE.md lists "Bossfight activation trigger: manual admin vs automatic cron detection" as a blocker to decide in Phase 35 planning.
   - What's unclear: Should the boss auto-spawn when WV count exceeds threshold, or should admin manually trigger it?
   - Recommendation: **Automatic.** Check WV count in the nightly safety-net cron (23:55) AND after each new WV creation. If count > threshold AND no active boss AND cooldown elapsed, spawn automatically. This is the gamification spirit -- the boss "attacks" when the backlog grows too large. Admin only controls the threshold, not the timing.

3. **Healing cap**
   - What we know: User says "New Wiedervorlagen created during an active fight ADD HP to the boss"
   - What's unclear: Is there an upper limit? Can HP exceed spawnHp?
   - Recommendation: Cap `currentHp` at `spawnHp`. This prevents gaming/griefing and keeps the boss beatable. The boss "heals" but never grows stronger than at spawn.

4. **Kanzlei room for Socket.IO**
   - What we know: Rooms currently are `user:{userId}`, `role:{ROLE}`, `akte:{akteId}`, etc. No `kanzlei` room exists.
   - What's unclear: Is `kanzleiId` always present on the JWT/socket data?
   - Recommendation: Add `kanzlei:{kanzleiId}` auto-join in `rooms.ts`. The auth middleware already extracts `kanzleiId` from the JWT. For single-kanzlei deployments (current setup), this broadcasts to everyone. Falls back gracefully if `kanzleiId` is null (no room join, no events).

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `prisma/schema.prisma` -- existing gamification models (UserGameProfile, Quest, QuestCompletion), KalenderEintrag with erledigt/typ fields
- Codebase analysis: `src/lib/socket/emitter.ts` + `rooms.ts` -- Redis emitter pattern, room naming conventions
- Codebase analysis: `src/lib/gamification/game-profile-service.ts` -- `awardRewards()` atomic increment, streak logic
- Codebase analysis: `src/lib/gamification/quest-service.ts` -- fire-and-forget `enqueueQuestCheck()` pattern
- Codebase analysis: `src/app/api/kalender/[id]/erledigt/route.ts` -- existing erledigt toggle endpoint
- Codebase analysis: `src/lib/settings/service.ts` + `defaults.ts` -- SystemSetting pattern with cache and Redis pub/sub
- Codebase analysis: `src/components/gamification/quest-widget.tsx` -- self-fetching client component pattern
- Codebase analysis: `src/components/akten/akte-socket-bridge.tsx` -- Socket.IO event listener pattern

### Secondary (MEDIUM confidence)
- canvas-confetti npm package: Well-known, 6KB, fire-and-forget API (verified via training data, widely used)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project except canvas-confetti (trivial addition)
- Architecture: HIGH - Direct extension of established patterns (gamification service, Socket.IO rooms, SystemSettings, dashboard widget)
- Pitfalls: HIGH - Race conditions and state machine edge cases are well-understood; Prisma $transaction handles atomicity

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable domain, no external API dependencies)
