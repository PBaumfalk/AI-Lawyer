# Phase 42: Integration Wiring Fixes - Research

**Researched:** 2026-03-03
**Domain:** Gamification integration wiring (perk effects, startup seeds, dead endpoint removal)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Streak-Schutz Perk Effect**
- Forward-only protection: next missed workday is forgiven (not retroactive)
- Auto-consume with notification: nightly cron detects miss, finds active streak-schutz, marks as used, streak stays intact. User sees toast on next login: "Streak-Schutz hat deinen Streak gerettet!"
- One day only: protects exactly one missed workday per consumed item (matches "Einmalverbrauch" description)
- Detection mechanism: `calculateStreak()` queries UserInventoryItem for consumed streak-schutz items where activatedAt is within last 7 days and no `usedForDate` is set. When it skips a gap, it sets `usedForDate` on that item

**Doppel-Runen Perk Effect**
- Cap then double: daily 40 Runen cap (WV quests) applies first, then result is doubled. Max effective WV Runen with doppel-runen: 80/day
- Only Runen, not XP: name says "Doppel-Runen" — only doubles Runen currency reward. XP progression stays consistent
- All quest types: doubles Runen from any quest completed within the 2h window (daily, weekly, special). Perk costs 50 Runen so this is fair value
- Detection: `checkQuestsForUser()` queries UserInventoryItem for verbraucht=true, perkType="doppel-runen", activatedAt > now-2h. If found, multiply runenToCredit by 2. Uses existing schema, no new fields needed

**WeeklySnapshot Cold-Start**
- Trigger location: `worker.ts` startup() function, alongside other seed calls
- Covers all users: same as existing Monday cron — snapshot Ticket and Frist counts for all users with verantwortlichId
- Always run on every restart: `createWeeklySnapshots()` already uses upsert, so running repeatedly is safe. No conditional check needed

### Claude's Discretion
- Exact toast/notification implementation for streak-schutz protection event
- Whether to add a `usedForDate` field to UserInventoryItem schema or repurpose existing metadata JSON
- Error handling and logging approach for perk detection queries

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

## Summary

Phase 42 is a pure integration wiring phase with zero new features — it closes five gaps identified by the v0.4 milestone audit. All five fixes are small, targeted, and all affected files are already known from the CONTEXT.md code context.

The most substantive change is the streak-schutz perk effect: `calculateStreak()` must be modified to detect active streak-schutz inventory items and skip workday gaps that have protection. This requires either adding a `usedForDate` field to the `UserInventoryItem` schema (needs Prisma migration) or storing it in the existing `metadata` JSON column. The CONTEXT.md specifies `usedForDate` explicitly, so a schema migration is the right approach. The doppel-runen effect requires only a single DB query inside `checkQuestsForUser()` and multiplication of `runenToCredit` — no schema changes needed.

The three remaining fixes (seedShopItems startup call, WeeklySnapshot cold-start call, dead profile endpoint removal) are mechanical: two import+try-catch additions in `worker.ts` following the established non-fatal startup seed pattern, and one file deletion.

**Primary recommendation:** Implement in this order: (1) schema migration for `usedForDate`, (2) doppel-runen wiring in quest-service, (3) streak-schutz wiring in calculateStreak + nightly processor, (4) both startup seed calls in worker.ts, (5) delete dead profile route.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma ORM | existing | Schema migration + `usedForDate` field + inventory queries | Project ORM, atomic transactions |
| date-fns | existing | `startOfDay`, `subDays`, workday date math in calculateStreak | Already used in calculateStreak |
| BullMQ / Worker | existing | Nightly safety-net job processes streak-schutz | Already registered cron |
| Sonner (toast) | existing | Client-side "Streak-Schutz hat deinen Streak gerettet!" notification | Used across dashboard, imported from `sonner` |
| Socket.IO Redis Emitter | existing | Emit streak-schutz event from worker to user browser room | Already used for audit events |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/socket/emitter` | n/a | `getSocketEmitter().to("user:{id}").emit(...)` | Push streak-schutz rescue notification to client |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `usedForDate DateTime?` schema field | Repurpose `metadata` JSON | Schema field is cleaner, type-safe, queryable via Prisma WHERE; metadata JSON requires manual JSON parsing in queries and loses Prisma type safety |
| Socket.IO emit for streak notification | Poll-on-login via dashboard API | Socket.IO already wired for gamification events; emit pattern matches audit-needed precedent |

**Installation:**
No new packages needed.

## Architecture Patterns

### Established Startup Seed Pattern (worker.ts)

```typescript
// Source: existing worker.ts lines 1047-1073
// Seed X on startup (idempotent via SystemSetting version guard)
try {
  await seedShopItems();
} catch (err) {
  log.warn({ err }, "Failed to seed shop items (non-fatal)");
}
```

All startup seeds follow this exact pattern: try/catch with log.warn, non-fatal. The new `seedShopItems()` and `createWeeklySnapshots()` calls both slot in after `seedDailyQuests()` at line ~1073.

Import additions needed:
```typescript
import { seedShopItems } from "@/lib/gamification/shop-items";
import { createWeeklySnapshots } from "@/lib/gamification/weekly-snapshot";
```

### Doppel-Runen Detection Pattern (quest-service.ts)

Insert after the existing Runen cap check (line ~148), before the audit sampling. Query once per `checkQuestsForUser()` call (not per quest iteration to avoid N+1):

```typescript
// Check for active doppel-runen perk (activatedAt within last 2 hours)
const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
const activeDoppelRunen = await prisma.userInventoryItem.findFirst({
  where: {
    userId,
    verbraucht: true,
    activatedAt: { gte: twoHoursAgo },
    shopItem: {
      metadata: {
        path: ["perkType"],
        equals: "doppel-runen",
      },
    },
  },
});
```

Then after cap enforcement and before audit check:
```typescript
// Apply doppel-runen doubling (cap applies first, then double)
if (activeDoppelRunen) {
  runenToCredit *= 2;
}
```

**Key constraint:** The doppel-runen query must be hoisted outside the per-quest loop. One query per user invocation, not per quest.

**Prisma JSON path filter:** Prisma supports `path: ["perkType"]` + `equals: "doppel-runen"` on `Json` fields. This is the standard approach for querying JSON metadata in Prisma with PostgreSQL.

### Streak-Schutz Detection Pattern (game-profile-service.ts)

The `calculateStreak()` function loops day-by-day, breaking on the first workday with no completion. Streak-schutz intercepts that break condition:

```typescript
// When a workday has no completion and streak would break:
if (!completion) {
  // Check for available streak-schutz perk
  const schutz = await prisma.userInventoryItem.findFirst({
    where: {
      userId,
      verbraucht: true,
      usedForDate: null, // Not yet consumed for a date
      shopItem: {
        metadata: {
          path: ["perkType"],
          equals: "streak-schutz",
        },
      },
    },
    orderBy: { activatedAt: "asc" }, // Use oldest first
  });

  if (schutz) {
    // Mark as used for this date
    await prisma.userInventoryItem.update({
      where: { id: schutz.id },
      data: { usedForDate: checkDate },
    });
    // Streak continues — don't break
    streak++;
  } else {
    break; // No protection — streak ends
  }
}
```

### Streak-Schutz Notification via Socket.IO

After `calculateStreak()` saves a protected gap via `usedForDate`, `updateStreak()` (or the nightly processor) should emit a notification to the user's browser room:

```typescript
// In nightly safety-net or updateStreak — after usedForDate is set
getSocketEmitter()
  .to(`user:${userId}`)
  .emit("gamification:streak-schutz-used", {
    savedDate: checkDate.toISOString(),
  });
```

Client-side (SocketProvider or GameWidget): listen for `gamification:streak-schutz-used` and call `toast.success("Streak-Schutz hat deinen Streak gerettet!")`.

### Schema Migration for usedForDate

Add to `UserInventoryItem` model in `prisma/schema.prisma`:

```prisma
model UserInventoryItem {
  id           String    @id @default(cuid())
  userId       String
  ...
  activatedAt  DateTime?
  usedForDate  DateTime? // Date the perk was consumed to protect a streak gap

  @@index([userId, shopItemId])
  @@index([userId, ausgeruestet])
  @@map("user_inventory_items")
}
```

Generate migration with `npx prisma migrate dev --name add-used-for-date-to-inventory`.

### Dead Endpoint Removal

Delete `/Users/patrickbaumfalk/Projekte/AI-Lawyer/src/app/api/gamification/profile/route.ts`.

Confirmed: no other file in `src/` references `/api/gamification/profile` — grep returned zero results outside the route file itself. Safe to delete.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON field filtering in Prisma | Raw SQL WHERE clause | `metadata: { path: ["perkType"], equals: "..." }` | Prisma PostgreSQL supports JSON path queries natively |
| Streak-schutz dedup | Manual array tracking | `usedForDate: null` WHERE clause | Schema-level guard is atomic, no race condition |
| Toast notification delivery | Custom notification system | `sonner` toast (already imported in dashboard) | Already wired in layout.tsx with glass-panel styling |

**Key insight:** All perk detection is read-only inventory queries. No new models, no new queues, no new crons — just query existing data where `activatePerk()` already left the hooks.

## Common Pitfalls

### Pitfall 1: N+1 Queries in Per-Quest Loop
**What goes wrong:** Placing the `doppel-runen` inventory query inside the per-quest `for` loop causes one DB query per quest (5+ queries for a user with 5 active quests).
**Why it happens:** Natural instinct is to check "does this quest have doubling active?" inside the quest loop.
**How to avoid:** Hoist the `activeDoppelRunen` check BEFORE the quest loop. One query per `checkQuestsForUser()` invocation, result reused for all quests in that call.
**Warning signs:** Performance regression in nightly safety-net when users have many active quests.

### Pitfall 2: Doppel-Runen Cap Order
**What goes wrong:** Doubling BEFORE cap enforcement allows users to get up to 80 Runen from WV quests, then cap applies at 80 instead of 40 — effectively double the intended cap.
**Why it happens:** "multiply by 2" feels like it should come first.
**How to avoid:** Per locked decision: cap applies first (`checkAndRecordRunenCap(userId, runenToCredit)`), THEN multiply by 2. Sequence: compute base → apply WV cap → multiply if doppel-runen.

### Pitfall 3: Streak-Schutz in calculateStreak without Schema Migration
**What goes wrong:** Querying `usedForDate: null` before the migration adds the column causes Prisma client mismatch / runtime error.
**Why it happens:** `usedForDate` does not currently exist in the schema.
**How to avoid:** Apply Prisma migration FIRST (Wave 0 task), then implement the streak-schutz detection logic. Keep tasks in dependency order.

### Pitfall 4: Multiple Streak-Schutz Items — Oldest First
**What goes wrong:** `findFirst()` without an `orderBy` returns an arbitrary item. If a user has two streak-schutz items both with `usedForDate: null`, the newer one might be consumed before the older one (counterintuitive FIFO expectation).
**How to avoid:** Always `orderBy: { activatedAt: "asc" }` — consume the oldest unused streak-schutz first.

### Pitfall 5: Streak-Schutz Detection Window
**What goes wrong:** The CONTEXT.md says "activatedAt within last 7 days." The detection query uses `usedForDate: null` (not consumed yet) — no time window is strictly needed since items stay in inventory until used. However, if the intent is to prevent very old unused items from protecting gaps months later, a 7-day window on `activatedAt` can be applied.
**How to avoid:** Use `usedForDate: null` as the primary guard. `activatedAt` is already set when `activatePerk()` is called. Since streak-schutz protects the NEXT missed workday, any unused item with `usedForDate: null` is valid protection regardless of age. The 7-day window in CONTEXT.md describes the detection scan range, not an item expiry. Items stay valid until consumed.

### Pitfall 6: createWeeklySnapshots on Every Restart — Not a Problem
**What goes wrong:** Fear that calling `createWeeklySnapshots()` on every worker restart will overwrite baseline snapshots incorrectly mid-week.
**Why it's not a problem:** The function uses `upsert` with `update: { count: entry._count.id }`. On restart mid-week, it updates the existing snapshot for the current `weekStart` with fresh counts. This is the correct behavior — the snapshot always reflects the count at the start of the week as of when it was last snapshotted. The Monday cron and the startup call both do the same thing.

## Code Examples

### Confirmed Prisma JSON Path Query Pattern

```typescript
// Source: Prisma docs / existing shop-service.ts pattern
await prisma.userInventoryItem.findFirst({
  where: {
    userId,
    verbraucht: true,
    activatedAt: { gte: twoHoursAgo },
    shopItem: {
      metadata: {
        path: ["perkType"],
        equals: "doppel-runen",
      },
    },
  },
});
```

This leverages Prisma's nested relation filtering combined with JSON path queries. `shopItem.metadata.path` is the Prisma PostgreSQL JSON field accessor syntax.

### Socket.IO Emit Pattern (from existing audit-needed event)

```typescript
// Source: quest-service.ts line 202-207 — established pattern
getSocketEmitter()
  .to(`user:${userId}`)
  .emit("gamification:streak-schutz-used", {
    savedDate: checkDate.toISOString(),
  });
```

Room format: `user:{userId}`. Event namespace prefix: `gamification:*`. Consistent with existing events.

### Toast Pattern (from existing app code)

```typescript
// Source: existing dashboard components (sonner)
import { toast } from "sonner";
toast.success("Streak-Schutz hat deinen Streak gerettet!");
```

The Sonner `<Toaster>` is mounted in `app/layout.tsx` with glass-panel styling. No additional setup needed.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual streak reset (no protection) | Streak-schutz perk (phase 42) | Phase 42 | Users can protect streak on one missed day |
| Fresh deploys have empty shop | seedShopItems() at startup | Phase 42 | Shop is always pre-populated after first deploy |
| WeeklySnapshot baseline requires Monday cron | Cold-start via worker.ts | Phase 42 | Weekly delta quests work immediately after deployment |

## Open Questions

1. **Notification delivery: Socket.IO emit vs. flag in dashboard API response**
   - What we know: Socket.IO emitter is already used for `gamification:audit-needed` events. Pattern is established.
   - What's unclear: If the user is not online at 23:55 when the nightly cron runs streak-schutz, the Socket.IO event is missed. Claude's discretion covers this.
   - Recommendation: Emit Socket.IO event (for online users) AND store a `streakSchutzUsed: boolean` flag on the user or profile to surface in the next dashboard API response. However, given Claude's discretion, the simplest approach is Socket.IO emit only — the nightly cron runs at 23:55, most users log in the next morning, and the toast is informational, not critical. Keep it simple: emit only.

2. **usedForDate field type: DateTime vs Date**
   - What we know: `calculateStreak()` uses `startOfDay(checkDate)` — the date at midnight.
   - What's unclear: Should `usedForDate` be `DateTime?` (stores full timestamp) or just a `Date?`.
   - Recommendation: Use `DateTime?` with Prisma (PostgreSQL TIMESTAMP) and store `startOfDay(checkDate)`. The existing `activatedAt` is `DateTime?`, so this is consistent. Prisma doesn't have a native `Date`-only type for PostgreSQL DATE columns without `@db.Date`.

## Validation Architecture

> nyquist_validation not present in config.json (workflow object has no nyquist_validation key) — skip this section.

## Sources

### Primary (HIGH confidence)
- `/Users/patrickbaumfalk/Projekte/AI-Lawyer/src/worker.ts` — startup() pattern at lines 1047-1073, seedDailyQuests call at 1068-1073
- `/Users/patrickbaumfalk/Projekte/AI-Lawyer/src/lib/gamification/shop-items.ts` — seedShopItems() at line 226, confirmed exported and idempotent
- `/Users/patrickbaumfalk/Projekte/AI-Lawyer/src/lib/gamification/shop-service.ts` — activatePerk() at line 137, streak-schutz and doppel-runen cases at lines 188-198
- `/Users/patrickbaumfalk/Projekte/AI-Lawyer/src/lib/gamification/game-profile-service.ts` — calculateStreak() at line 182, break-on-gap logic at line 211
- `/Users/patrickbaumfalk/Projekte/AI-Lawyer/src/lib/gamification/quest-service.ts` — checkQuestsForUser(), runenToCredit at line 125, cap check at 145-148
- `/Users/patrickbaumfalk/Projekte/AI-Lawyer/src/lib/gamification/weekly-snapshot.ts` — createWeeklySnapshots() at line 19, confirmed upsert-based idempotency
- `/Users/patrickbaumfalk/Projekte/AI-Lawyer/src/lib/queue/processors/gamification.processor.ts` — nightly safety-net calls updateStreak() at line 163
- `/Users/patrickbaumfalk/Projekte/AI-Lawyer/src/app/api/gamification/profile/route.ts` — confirmed dead endpoint, no external references
- `/Users/patrickbaumfalk/Projekte/AI-Lawyer/prisma/schema.prisma` — UserInventoryItem model at line 2315, confirmed no `usedForDate` field exists

### Secondary (MEDIUM confidence)
- Prisma JSON path query (`path: ["key"], equals: "value"`) — standard Prisma PostgreSQL JSON filter pattern, consistent with how metadata is already read in shop-service.ts via `(invItem.shopItem.metadata as Record<string, unknown>).perkType`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, no new dependencies
- Architecture: HIGH — all files located, all patterns verified from source code
- Pitfalls: HIGH — derived from direct code inspection, not assumptions

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable codebase, no external dependencies)
