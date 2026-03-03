# Phase 42: Integration Wiring Fixes - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Close all cross-phase integration gaps identified by the v0.4 milestone audit. Five specific wiring fixes: seedShopItems startup call, streak-schutz perk effect, doppel-runen perk effect, WeeklySnapshot cold-start baselines, and dead `/api/gamification/profile` endpoint removal.

</domain>

<decisions>
## Implementation Decisions

### Streak-Schutz Perk Effect
- Forward-only protection: next missed workday is forgiven (not retroactive)
- Auto-consume with notification: nightly cron detects miss, finds active streak-schutz, marks as used, streak stays intact. User sees toast on next login: "Streak-Schutz hat deinen Streak gerettet!"
- One day only: protects exactly one missed workday per consumed item (matches "Einmalverbrauch" description)
- Detection mechanism: `calculateStreak()` queries UserInventoryItem for consumed streak-schutz items where activatedAt is within last 7 days and no `usedForDate` is set. When it skips a gap, it sets `usedForDate` on that item

### Doppel-Runen Perk Effect
- Cap then double: daily 40 Runen cap (WV quests) applies first, then result is doubled. Max effective WV Runen with doppel-runen: 80/day
- Only Runen, not XP: name says "Doppel-Runen" — only doubles Runen currency reward. XP progression stays consistent
- All quest types: doubles Runen from any quest completed within the 2h window (daily, weekly, special). Perk costs 50 Runen so this is fair value
- Detection: `checkQuestsForUser()` queries UserInventoryItem for verbraucht=true, perkType="doppel-runen", activatedAt > now-2h. If found, multiply runenToCredit by 2. Uses existing schema, no new fields needed

### WeeklySnapshot Cold-Start
- Trigger location: `worker.ts` startup() function, alongside other seed calls
- Covers all users: same as existing Monday cron — snapshot Ticket and Frist counts for all users with verantwortlichId
- Always run on every restart: `createWeeklySnapshots()` already uses upsert, so running repeatedly is safe. No conditional check needed

### Claude's Discretion
- Exact toast/notification implementation for streak-schutz protection event
- Whether to add a `usedForDate` field to UserInventoryItem schema or repurpose existing metadata JSON
- Error handling and logging approach for perk detection queries

</decisions>

<specifics>
## Specific Ideas

- seedShopItems() call follows the same pattern as seedDailyQuests(), seedAmtlicheFormulare(), etc. in worker.ts startup — try/catch with non-fatal log.warn
- Dead `/api/gamification/profile` endpoint removed entirely (dashboard uses `/api/gamification/dashboard`)
- Perk detection queries should be lightweight — single DB query per perk type, not N+1

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `seedShopItems()` in `shop-items.ts:226`: Already exported, idempotent via SEED_VERSION guard + upsert
- `activatePerk()` in `shop-service.ts:137`: Already marks consumed with `activatedAt` timestamp — provides the data hook
- `createWeeklySnapshots()` in `weekly-snapshot.ts:19`: Already idempotent via upsert — can be called on startup safely
- `calculateStreak()` in `game-profile-service.ts:182`: Needs modification to check inventory for streak-schutz
- `checkQuestsForUser()` in `quest-service.ts`: Needs modification to check for active doppel-runen before crediting

### Established Patterns
- Startup seed pattern in `worker.ts`: `try { await seedX(); } catch { log.warn(..., "non-fatal"); }`
- Perk activation in `shop-service.ts`: switch on perkType, mark consumed, execute effect
- Runen cap via Redis INCR+EXPIRE in `runen-cap.ts` (fail-open)
- UserInventoryItem has `verbraucht: Boolean`, `activatedAt: DateTime?`, `shopItem.metadata` JSON with perkType

### Integration Points
- `worker.ts:startup()` line ~1068: After `seedDailyQuests()` — add `seedShopItems()` call
- `game-profile-service.ts:calculateStreak()` line 182: Add inventory query for streak-schutz before gap detection
- `quest-service.ts:checkQuestsForUser()` around line 125: After computing runenToCredit, check for doppel-runen perk
- `weekly-snapshot.ts:createWeeklySnapshots()`: Already complete, just needs startup call in worker.ts
- `/api/gamification/profile/route.ts`: Delete entirely

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 42-integration-wiring-fixes*
*Context gathered: 2026-03-03*
