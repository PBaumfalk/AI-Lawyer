# Phase 38: Anti-Missbrauch - Research

**Researched:** 2026-03-02
**Domain:** Gamification anti-abuse hardening — Redis rate caps, Prisma transactions, audit sampling, DB constraint tightening
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Qualification Enforcement (ABUSE-01)
- Reuse existing `erledigungsgrund` field on KalenderEintrag for Wiedervorlage Vermerk (currently only used for FRIST — extend to WIEDERVORLAGE)
- Enforcement happens in the quest evaluator only — business logic (WV completion API) stays unchanged. A WV can still be completed without a Vermerk; it just won't count for quests
- Quest evaluator adds additional where-clause checks: `erledigungsgrund` must exist and have 30+ characters
- Follow-up WV is a bonus only: if a new WV was created for the same Akte within the same day, award bonus Runen. Not having one is fine — the quest still counts
- No minimum age check on the WV — the Vermerk requirement (30+ chars of real content) is sufficient friction against instant create-complete farming

#### Daily Runen Cap (ABUSE-02)
- Max 40 Runen/day from Wiedervorlage quests specifically — Fristen, Rechnungen, and other quest types are uncapped
- Beyond the cap: XP is still awarded, only Runen are capped
- Admin-configurable via SystemSetting `gamification.daily_runen_cap` (default: 40). Follows existing rate-limiter pattern
- Show indicator only when near or at cap: at 80%+ (32+ Runen), show subtle hint in quest widget; at cap, show "Runen-Limit erreicht — XP wird weiterhin vergeben"
- Completion toast reflects cap: "+60 XP (Runen-Limit erreicht)" when Runen would have been awarded but cap is hit
- Redis INCR + EXPIRE pattern for cap enforcement: `gamification:daily-runen:{userId}:{YYYYMMDD}` key with 86400s TTL. Fail-open if Redis unavailable (awards Runen without cap)

#### Random Audits (ABUSE-03)
- 1-3% of quest completions are randomly flagged for audit
- Audit prompt appears immediately on completion, before rewards are credited
- UI: Sonner toast with action buttons — "Stichproben-Prüfung: Erledigung bestätigen?" with Bestätigen / Zurücknehmen buttons
- If confirmed: rewards are credited normally
- If declined: no rewards, quest completion is not recorded
- If ignored (no response within 24 hours): auto-confirm, rewards stay. Most lenient approach
- No admin audit view needed — audits are a deterrent mechanism only, not a reporting system
- Audit state tracked on QuestCompletion or a flag field, not a separate model

#### Hardening (ABUSE-04)
- Wrap `awardRewards()` + `questCompletion.create()` in `prisma.$transaction` — if either fails, both roll back
- Tighten QuestCompletion unique constraint: add `@@unique([userId, questId, completedDate])` where `completedDate` is a DATE (not DateTime). Current unique includes millisecond timestamp which allows duplicates within the same dedup window
- Keep existing Prisma `{ increment: N }` pattern for XP/Runen (already atomic at SQL level)
- Redis INCR for daily cap is naturally atomic (single Redis command)

### Claude's Discretion
- Exact Redis key format and TTL handling for cap counter
- How to compute `completedDate` as DATE in the unique constraint (generated column vs application logic)
- Audit flag probability implementation (random number in BullMQ worker vs application layer)
- Toast styling and duration for audit prompt
- Whether follow-up WV bonus needs its own QuestCondition type or is a modifier on existing conditions
- Migration strategy for tightening the QuestCompletion unique constraint on existing data

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ABUSE-01 | Qualifizierte Erledigung: Wiedervorlage zählt nur mit Status-Änderung + Vermerk (30+ chars) + optionaler Folge-WV | Extend `evaluateCountCondition` where-clause in `quest-evaluator.ts` to check `erledigungsgrund` length. Follow-up WV = extra count query on KalenderEintrag with same akteId, today's dateRange, typ=WIEDERVORLAGE. |
| ABUSE-02 | Runen-Deckel: max 40 Runen/day from Wiedervorlage quests, beyond that only XP | New `src/lib/gamification/runen-cap.ts` using rate-limiter.ts INCR+EXPIRE pattern. Key: `gamification:daily-runen:{userId}:{YYYYMMDD}`. Cap read from `getSettingTyped("gamification.daily_runen_cap", 40)`. New DEFAULT_SETTING entry. Dashboard API returns `dailyRunenUsed` for widget cap indicator. |
| ABUSE-03 | Random Audits: 1-3% of completions flagged; user sees confirmation toast; decline revokes points | `auditStatus` field (`NONE \| PENDING \| CONFIRMED \| DECLINED`) on QuestCompletion. `pendingAuditId` on GameProfile to know when a quest-check needs audit confirmation. Sonner action toast from quest-service or BullMQ processor. Auto-confirm job scheduled 24h out. |
| ABUSE-04 | Atomic increments — wrap awardRewards + questCompletion.create in $transaction; tighten QuestCompletion unique constraint with DATE-level completedDate | Wrap in `prisma.$transaction` as shown in boss-engine.ts. Add `completedDate DateTime @db.Date` to QuestCompletion, set via `new Date(now.toDateString())` in application code. Add `@@unique([userId, questId, completedDate])`. Manual migration SQL (no Prisma migrate in this project). |
</phase_requirements>

---

## Summary

Phase 38 adds four anti-abuse layers to the existing gamification system. The work is entirely backend-heavy: three new behaviors in `quest-service.ts` / `quest-evaluator.ts` / `game-profile-service.ts`, one new Redis-backed rate-cap module, schema changes to QuestCompletion, and a small widget UI extension. No new quest types are introduced.

The codebase already has all necessary primitives: `prisma.$transaction` is proven in `boss-engine.ts`, the Redis INCR+EXPIRE pattern is fully established in `rate-limiter.ts`, and the Sonner toast system is used throughout. The project follows the manual-SQL migration pattern (no `prisma migrate dev` — schema changes require `manual_*.sql` files alongside Prisma schema updates).

The most architecturally interesting challenge is ABUSE-03: the audit prompt must appear to the user before rewards are credited, but the BullMQ worker runs fire-and-forget. The solution is to emit a Socket.IO event from the worker to the user's browser room, have the client show the Sonner action toast and POST to a new `/api/gamification/audit/confirm` endpoint, and the worker or a separate auto-confirm job handles the 24-hour timeout.

**Primary recommendation:** Implement in four discrete tasks: (1) ABUSE-04 schema + transaction hardening first (foundational), (2) ABUSE-02 Redis cap module, (3) ABUSE-01 evaluator extension, (4) ABUSE-03 audit flow last (most complex, depends on stable completion path).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ioredis | existing | Redis INCR/EXPIRE for daily cap | Already used in rate-limiter.ts with lazy singleton, fail-open pattern |
| Prisma | existing | `$transaction` wrapping awardRewards + create | Boss engine proves the pattern; PostgreSQL-level atomicity |
| Sonner | existing | Action toast for audit prompt | Already Toaster-mounted in layout.tsx; action buttons supported |
| date-fns | existing | Date truncation to calendar day for `completedDate` | Already imported throughout gamification layer |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| BullMQ | existing | Schedule 24h auto-confirm for pending audits | `gamificationQueue.add("audit-auto-confirm", {...}, { delay: 86400000 })` |
| Socket.IO | existing | Emit audit-needed event from worker to user browser | `getSocketEmitter().to(\`user:${userId}\`).emit("gamification:audit-needed", ...)` |
| Zod | existing | Validate audit confirm/decline API body | Same schema-validation pattern as all other API routes |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Socket.IO audit prompt | Polling on client | Socket.IO already wired; polling adds unnecessary latency and server load |
| Application-computed `completedDate` | PostgreSQL generated column | Generated columns require `Unsupported()` in Prisma and custom migration DDL; application-side `new Date(now.toDateString())` is simpler and just as correct |
| Separate AuditEntry model | Flag field on QuestCompletion | Separate model adds join complexity; audit is a transient state, not permanent data |

**Installation:** No new packages needed. All dependencies exist.

---

## Architecture Patterns

### Recommended Project Structure

```
src/lib/gamification/
├── runen-cap.ts          # NEW: Redis INCR+EXPIRE daily cap (mirrors rate-limiter.ts)
├── quest-service.ts      # MODIFIED: add cap check + audit sampling
├── quest-evaluator.ts    # MODIFIED: add erledigungsgrund length check + follow-up WV bonus
├── game-profile-service.ts  # MODIFIED: wrap awardRewards in $transaction
├── types.ts              # MODIFIED: add AuditStatus type
src/app/api/gamification/
├── audit/
│   └── confirm/route.ts  # NEW: POST endpoint for audit confirm/decline
src/components/gamification/
├── quest-widget.tsx      # MODIFIED: cap indicator display
prisma/
├── schema.prisma         # MODIFIED: QuestCompletion + completedDate + auditStatus
├── migrations/
│   └── manual_anti_missbrauch.sql  # NEW: migration SQL
src/lib/settings/defaults.ts  # MODIFIED: add gamification.daily_runen_cap entry
```

### Pattern 1: Redis Daily Cap (mirrors rate-limiter.ts exactly)

**What:** INCR + conditional EXPIRE with fail-open on Redis unavailability.
**When to use:** Any daily Runen cap check before crediting WV-quest rewards.

```typescript
// src/lib/gamification/runen-cap.ts
// Source: mirrors /src/lib/helena/rate-limiter.ts pattern

import Redis from "ioredis";
import { getSettingTyped } from "@/lib/settings/service";
import { createLogger } from "@/lib/logger";
import { format } from "date-fns";

const log = createLogger("runen-cap");
const KEY_PREFIX = "gamification:daily-runen:";
const WINDOW_SECONDS = 86400; // 24h TTL
const DEFAULT_CAP = 40;

let redisClient: Redis | null = null;
let redisUnavailable = false;

function getRedisClient(): Redis {
  if (!redisClient) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) { redisUnavailable = true; return null; }
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    redisClient.on("error", () => { redisUnavailable = true; });
    redisClient.on("connect", () => { redisUnavailable = false; });
  }
  return redisClient;
}

export interface RunenCapResult {
  /** How many Runen to actually credit (0 if cap hit) */
  runenToCredit: number;
  /** Whether the cap was hit */
  capHit: boolean;
  /** Total Runen used today (after this increment) */
  dailyUsed: number;
  /** The configured cap */
  cap: number;
}

/**
 * Check and record Runen for a WV quest completion.
 * Returns reduced runenToCredit if cap is hit; fail-open if Redis down.
 */
export async function checkAndRecordRunenCap(
  userId: string,
  runenEarned: number,
): Promise<RunenCapResult> {
  const cap = await getSettingTyped<number>("gamification.daily_runen_cap", DEFAULT_CAP);
  const dateKey = format(new Date(), "yyyyMMdd");
  const key = `${KEY_PREFIX}${userId}:${dateKey}`;

  if (redisUnavailable) {
    log.warn({ userId }, "Redis unavailable — Runen cap skipped (fail open)");
    return { runenToCredit: runenEarned, capHit: false, dailyUsed: runenEarned, cap };
  }

  const redis = getRedisClient();
  try {
    if (redis.status !== "ready" && redis.status !== "connect") {
      await redis.connect();
    }
    // Read current before incrementing to know how much headroom remains
    const currentStr = await redis.get(key);
    const current = currentStr ? parseInt(currentStr, 10) : 0;
    const headroom = Math.max(0, cap - current);
    const runenToCredit = Math.min(runenEarned, headroom);

    if (runenToCredit > 0) {
      const newTotal = await redis.incrby(key, runenToCredit);
      if (newTotal === runenToCredit) {
        await redis.expire(key, WINDOW_SECONDS);
      }
      return { runenToCredit, capHit: newTotal >= cap, dailyUsed: newTotal, cap };
    }

    return { runenToCredit: 0, capHit: true, dailyUsed: current, cap };
  } catch (err) {
    log.warn({ userId, err }, "Runen cap check failed — fail open");
    return { runenToCredit: runenEarned, capHit: false, dailyUsed: runenEarned, cap };
  }
}

/**
 * Read current daily Runen usage for a user (for dashboard display).
 * Returns 0 if Redis unavailable.
 */
export async function getDailyRunenUsed(userId: string): Promise<number> {
  if (redisUnavailable) return 0;
  const redis = getRedisClient();
  const dateKey = format(new Date(), "yyyyMMdd");
  const key = `${KEY_PREFIX}${userId}:${dateKey}`;
  try {
    if (redis.status !== "ready" && redis.status !== "connect") await redis.connect();
    const val = await redis.get(key);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}
```

### Pattern 2: Prisma $transaction for awardRewards + questCompletion.create

**What:** Both the XP/Runen update and the completion record must succeed atomically.
**When to use:** Everywhere quest completions are recorded. Proven in boss-engine.ts.

```typescript
// Source: mirrors boss-engine.ts $transaction pattern
// In quest-service.ts checkQuestsForUser loop:

await prisma.$transaction(async (tx) => {
  // 1. Award rewards atomically
  await tx.userGameProfile.update({
    where: { userId },
    data: {
      xp: { increment: quest.xpBelohnung },
      runen: { increment: runenToCredit }, // already cap-adjusted
    },
  });

  // 2. Record completion (with DATE-level completedDate for tighter dedup)
  const today = new Date();
  today.setHours(0, 0, 0, 0); // truncate to calendar day
  await tx.questCompletion.create({
    data: {
      userId,
      questId: quest.id,
      xpVerdient: quest.xpBelohnung,
      runenVerdient: runenToCredit,
      completedDate: today, // @db.Date field for unique constraint
      auditStatus: needsAudit ? "PENDING" : "NONE",
    },
  });
});
```

### Pattern 3: ABUSE-01 Erledigungsgrund Length Check in Evaluator

**What:** Extend the `where` clause in `evaluateCountCondition` to filter WV completions by `erledigungsgrund` length.
**When to use:** Any quest condition with `model: "KalenderEintrag"`, `where: { typ: "WIEDERVORLAGE" }`.

The limitation: Prisma's `where` object type is `Record<string, string | boolean>` in the current DSL, which does not support Prisma filter operators like `{ not: null }` or raw SQL. The evaluator uses `countForModel(model, where)` which calls `prisma.kalenderEintrag.count({ where })`.

**Solution:** The evaluator needs to detect WV quests and add operator-style Prisma filters to the where object post-DSL-merge. The existing `where: Record<string, any>` type in `countForModel` supports this already (it is typed as `any` for the Prisma `where` parameter).

```typescript
// In evaluateCountCondition, after building the base where object:
// Add 30-char Vermerk check for WIEDERVORLAGE quests
if (
  condition.model === "KalenderEintrag" &&
  (condition.where as Record<string, unknown>).typ === "WIEDERVORLAGE"
) {
  // erledigungsgrund must exist and be 30+ characters
  where.erledigungsgrund = {
    not: null,
  };
  // Note: Prisma does NOT support string_length filtering directly.
  // Use raw where extension: filter in JS after count, OR use a separate
  // Prisma query that returns records and checks length in application code.
  // RECOMMENDED: Use prisma.kalenderEintrag.findMany + JS filter for correctness.
  // See "Pitfall 2: Prisma has no string-length WHERE clause" below.
}
```

**Important:** Because Prisma's `count({ where })` does not support `string_length` or `CHAR_LENGTH` filters natively, the 30-char requirement must be enforced either:
1. (Recommended) By switching from `count()` to `findMany({ select: { erledigungsgrund: true } })` and filtering in JS — slightly less efficient but simple and type-safe.
2. (Alternative) Via `prisma.$queryRaw` with parameterized SQL — more performant but bypasses type safety.

For a kanzlei-scale query (max ~100 WV per user per day), option 1 is perfectly acceptable.

### Pattern 4: Audit Flow via Socket.IO + Deferred Auto-Confirm

**What:** The worker emits a `gamification:audit-needed` event to the user's browser room. The client shows a Sonner action toast. A BullMQ delayed job auto-confirms after 24h if no response.

**When to use:** When `Math.random() < 0.02` (1-3%) during quest completion in the worker.

```typescript
// In quest-service.ts (or gamification.processor.ts), after detecting audit needed:

// Emit to user's browser room
getSocketEmitter()
  .to(`user:${userId}`)
  .emit("gamification:audit-needed", {
    completionId: completion.id,
    questName: quest.name,
  });

// Schedule auto-confirm after 24h
await gamificationQueue.add(
  "audit-auto-confirm",
  { completionId: completion.id },
  { delay: 24 * 60 * 60 * 1000 }
);
```

Client-side in quest-widget or a top-level gamification listener:
```typescript
// Uses toast.("message", { action: { label, onClick }, cancel: { label, onClick } })
// Sonner action toast pattern — already in the app
socket.on("gamification:audit-needed", ({ completionId, questName }) => {
  toast("Stichproben-Prüfung", {
    description: `Erledigung "${questName}" bestätigen?`,
    duration: Infinity, // stays until user acts
    action: {
      label: "Bestätigen",
      onClick: () => fetch(`/api/gamification/audit/confirm`, {
        method: "POST",
        body: JSON.stringify({ completionId, decision: "CONFIRMED" }),
      }),
    },
    cancel: {
      label: "Zurücknehmen",
      onClick: () => fetch(`/api/gamification/audit/confirm`, {
        method: "POST",
        body: JSON.stringify({ completionId, decision: "DECLINED" }),
      }),
    },
  });
});
```

### Pattern 5: Schema Changes for QuestCompletion

```sql
-- manual_anti_missbrauch.sql

-- 1. Add completedDate (DATE) to QuestCompletion
ALTER TABLE "quest_completions" ADD COLUMN IF NOT EXISTS "completedDate" DATE;

-- 2. Backfill completedDate from completedAt for existing rows
UPDATE "quest_completions" SET "completedDate" = DATE("completedAt") WHERE "completedDate" IS NULL;

-- 3. Make completedDate NOT NULL
ALTER TABLE "quest_completions" ALTER COLUMN "completedDate" SET NOT NULL;

-- 4. Add auditStatus enum + column
CREATE TYPE "AuditStatus" AS ENUM ('NONE', 'PENDING', 'CONFIRMED', 'DECLINED');
ALTER TABLE "quest_completions" ADD COLUMN IF NOT EXISTS "auditStatus" "AuditStatus" NOT NULL DEFAULT 'NONE';

-- 5. Add tighter unique constraint (DATE-level dedup replaces millisecond dedup)
-- First: check for existing duplicates (none expected, but safety check)
-- Then drop old unique index and add new one
DROP INDEX IF EXISTS "quest_completions_userId_questId_completedAt_key";
CREATE UNIQUE INDEX "quest_completions_userId_questId_completedDate_key"
  ON "quest_completions"("userId", "questId", "completedDate");
```

**Note on existing unique constraint:** The current schema has `@@unique([userId, questId, completedAt])` using `completedAt` (DateTime). The migration must drop that index before creating the DATE-level one, since two completions from the same day would have different `completedAt` timestamps but same `completedDate`. The new constraint is strictly stronger (fewer allowed duplicates).

### Anti-Patterns to Avoid

- **Dynamic audit model:** Do NOT create a separate `AuditEntry` model. The `auditStatus` field on `QuestCompletion` is sufficient and avoids join complexity.
- **Audit rewards pre-credit:** Do NOT credit XP/Runen before audit confirmation for PENDING completions. The transaction must be held until the user confirms OR the 24h auto-confirm fires. The simplest implementation: for PENDING completions, the `$transaction` is NOT run until the audit confirm endpoint receives a CONFIRMED decision.
- **Blocking business logic:** NEVER add cap/audit checks to the WV completion API (`/api/kalender/[id]/erledigt`). All anti-abuse logic lives in `quest-service.ts` (the BullMQ worker), never in the business route.
- **Redis key without date suffix:** Do NOT use `gamification:daily-runen:{userId}` without a date component — it requires manual EXPIRE management. The `{YYYYMMDD}` suffix makes TTL reliable: the key naturally expires after 24h due to the EXPIRE set on first INCR.
- **prisma.kalenderEintrag.count() for string-length:** Prisma `count()` with `where` does not support `CHAR_LENGTH`. Use `findMany` + JS filter, or `$queryRaw`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Daily rate counter | Custom DB table with timestamps | Redis INCR+EXPIRE (existing rate-limiter pattern) | Atomic, sub-millisecond, no DB write on every quest check |
| Idempotent completion | Application-level try/catch on duplicate | `@@unique([userId, questId, completedDate])` DB constraint + Prisma upsert | Race conditions require DB-level enforcement |
| Audit timeout | Polling job that checks audit age | BullMQ delayed job with 24h delay | Precise, no polling overhead, existing queue infrastructure |
| Toast with buttons | Custom modal/dialog for audit prompt | Sonner action toast (existing) | Already wired, accessible, supports cancel pattern |

**Key insight:** All four problems have primitives already in the codebase. The phase is entirely about wiring them together correctly.

---

## Common Pitfalls

### Pitfall 1: Double-Award During Audit Window
**What goes wrong:** If rewards are credited optimistically (before audit confirmation), a DECLINED audit must reverse them. Reversing increments atomically is error-prone and requires careful handling of streak multipliers.
**Why it happens:** Optimistic UX feels faster.
**How to avoid:** For PENDING completions, hold the `$transaction` until `CONFIRMED`. The worker creates the `QuestCompletion` record with `auditStatus: "PENDING"` and `xpVerdient: 0 / runenVerdient: 0` as placeholder, then the confirm endpoint runs the actual reward transaction. This makes DECLINED trivially handled: just update `auditStatus` to `DECLINED` with no further action.
**Warning signs:** If awardRewards is called before the audit confirm endpoint is hit.

### Pitfall 2: Prisma Has No String-Length WHERE Clause
**What goes wrong:** `prisma.kalenderEintrag.count({ where: { erledigungsgrund: { gte: 30 } } })` does not work for string length — Prisma's `StringFilter` `gte/lte` compares lexicographically, not by character count.
**Why it happens:** Assuming Prisma filters translate cleanly to SQL functions.
**How to avoid:** Use `findMany({ select: { id: true, erledigungsgrund: true }, where: { ...base } })` then `filter(r => (r.erledigungsgrund?.length ?? 0) >= 30).length` in application code. For ~100 WV per user per day, this is fine.
**Warning signs:** Getting unexpected completion counts (too high or too low).

### Pitfall 3: QuestCompletion Unique Constraint Migration Race
**What goes wrong:** If the old `@@unique([userId, questId, completedAt])` index is dropped and the new `@@unique([userId, questId, completedDate])` index is added in separate statements, there is a window where neither constraint exists.
**Why it happens:** Sequential DDL without a transaction.
**How to avoid:** Wrap both `DROP INDEX` and `CREATE UNIQUE INDEX` in the same migration transaction. In PostgreSQL: `BEGIN; DROP INDEX ...; CREATE UNIQUE INDEX ...; COMMIT;`

### Pitfall 4: Redis Key TTL on Subsequent Days
**What goes wrong:** If the `EXPIRE` is only set on `current === 1` (first INCR of the day), but the key persists across calendar day boundaries, users get carried-over counts.
**Why it happens:** The rate-limiter.ts pattern sets TTL only when `current === 1`. For a 3600s window (1 hour), this is fine. For a 86400s (24h) window keyed by date string, it is safe because the key contains `{YYYYMMDD}` — a new date = a new key, no TTL carryover.
**How to avoid:** Use the `{userId}:{YYYYMMDD}` key format (not just `{userId}`). The EXPIRE call is belt-and-suspenders but needed for key cleanup.

### Pitfall 5: Sonner action Toast Duration
**What goes wrong:** Default Sonner toast duration is 4 seconds — the audit prompt would auto-dismiss before the user acts.
**Why it happens:** Forgot to set `duration: Infinity` for the audit toast.
**How to avoid:** Always set `duration: Infinity` for action toasts requiring user response. The 24h auto-confirm handles the true timeout server-side.

### Pitfall 6: Concurrent Quest Completions Bypassing the New Unique Constraint
**What goes wrong:** Two worker jobs run simultaneously for the same user+quest+day. Both check `findFirst` (no existing completion), both run `$transaction`. First succeeds; second fails with unique constraint violation.
**Why it happens:** The check-then-insert pattern has an inherent TOCTOU gap even inside a single Prisma transaction (unless using `SELECT FOR UPDATE`).
**How to avoid:** Catch the unique constraint violation (Prisma error `P2002`) in the `$transaction` catch block and treat it as a no-op (the other concurrent job already completed it). This is the correct idempotent pattern.

---

## Code Examples

### System Setting Registration (ABUSE-02)

```typescript
// Source: src/lib/settings/defaults.ts — add to DEFAULT_SETTINGS array
{
  key: "gamification.daily_runen_cap",
  value: "40",
  type: "number",
  category: "gamification",
  label: "Tägliches Runen-Limit (Wiedervorlage-Quests)",
  min: 10,
  max: 200,
},
```

### Modified checkQuestsForUser with Cap + Audit

```typescript
// quest-service.ts — modified quest completion block

// Determine if quest is a WV quest (for cap enforcement)
const isWvQuest =
  (condition as CountCondition).model === "KalenderEintrag" &&
  ((condition as CountCondition).where as Record<string, unknown>).typ === "WIEDERVORLAGE";

// Calculate rewards
const streakMultiplier = getStreakMultiplier(profile.streakTage);
let runenToCredit = Math.round(quest.runenBelohnung * streakMultiplier);

// Apply daily Runen cap for WV quests only
if (isWvQuest) {
  const capResult = await checkAndRecordRunenCap(userId, runenToCredit);
  runenToCredit = capResult.runenToCredit; // may be 0 if cap hit
}

// Determine if this completion needs audit (1-3% random)
const needsAudit = Math.random() < 0.02; // ~2% midpoint of 1-3%

// Atomic: award rewards + record completion in single transaction
try {
  await prisma.$transaction(async (tx) => {
    if (!needsAudit) {
      // Credit immediately
      await tx.userGameProfile.update({
        where: { userId },
        data: {
          xp: { increment: quest.xpBelohnung },
          runen: { increment: runenToCredit },
        },
      });
    }

    const today = startOfDay(now);
    await tx.questCompletion.create({
      data: {
        userId,
        questId: quest.id,
        xpVerdient: needsAudit ? 0 : quest.xpBelohnung,
        runenVerdient: needsAudit ? 0 : runenToCredit,
        completedDate: today,
        auditStatus: needsAudit ? "PENDING" : "NONE",
        // Store pending rewards for later credit
        pendingXp: needsAudit ? quest.xpBelohnung : 0,
        pendingRunen: needsAudit ? runenToCredit : 0,
      },
    });
  });
} catch (err: unknown) {
  if (isPrismaUniqueConstraintError(err)) {
    // Concurrent completion — no-op, idempotent
    continue;
  }
  throw err;
}

// If audit needed, emit event and schedule auto-confirm
if (needsAudit) {
  // Fetch completionId just created
  const completion = await prisma.questCompletion.findFirst({
    where: { userId, questId: quest.id, completedDate: startOfDay(now) },
  });
  if (completion) {
    getSocketEmitter()
      .to(`user:${userId}`)
      .emit("gamification:audit-needed", {
        completionId: completion.id,
        questName: quest.name,
      });
    gamificationQueue
      .add("audit-auto-confirm", { completionId: completion.id }, {
        delay: 24 * 60 * 60 * 1000,
        jobId: `audit-auto-confirm-${completion.id}`,
      })
      .catch(() => {});
  }
}
```

### Audit Confirm Endpoint

```typescript
// src/app/api/gamification/audit/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  completionId: z.string(),
  decision: z.enum(["CONFIRMED", "DECLINED"]),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validierungsfehler" }, { status: 400 });

  const { completionId, decision } = parsed.data;

  const completion = await prisma.questCompletion.findUnique({ where: { id: completionId } });
  if (!completion || completion.userId !== session.user.id) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  if (completion.auditStatus !== "PENDING") {
    return NextResponse.json({ message: "Bereits verarbeitet" });
  }

  if (decision === "CONFIRMED") {
    await prisma.$transaction(async (tx) => {
      await tx.userGameProfile.update({
        where: { userId: completion.userId },
        data: {
          xp: { increment: completion.pendingXp },
          runen: { increment: completion.pendingRunen },
        },
      });
      await tx.questCompletion.update({
        where: { id: completionId },
        data: {
          auditStatus: "CONFIRMED",
          xpVerdient: completion.pendingXp,
          runenVerdient: completion.pendingRunen,
        },
      });
    });
  } else {
    // DECLINED: no rewards, mark as declined
    await prisma.questCompletion.update({
      where: { id: completionId },
      data: { auditStatus: "DECLINED" },
    });
  }

  return NextResponse.json({ ok: true });
}
```

### Prisma Schema Changes

```prisma
// prisma/schema.prisma — modified QuestCompletion model

enum AuditStatus {
  NONE
  PENDING
  CONFIRMED
  DECLINED
}

model QuestCompletion {
  id            String           @id @default(cuid())
  userId        String
  questId       String
  quest         Quest            @relation(fields: [questId], references: [id], onDelete: Cascade)
  profile       UserGameProfile  @relation(fields: [userId], references: [userId], onDelete: Cascade)
  xpVerdient    Int
  runenVerdient Int
  pendingXp     Int              @default(0)    // Held during audit PENDING state
  pendingRunen  Int              @default(0)    // Held during audit PENDING state
  auditStatus   AuditStatus      @default(NONE)
  completedAt   DateTime         @default(now())
  completedDate DateTime         @db.Date       // DATE-only for tighter unique constraint

  @@index([userId, completedAt])
  @@index([questId])
  @@unique([userId, questId, completedDate])    // Replaces completedAt-based unique
  @@map("quest_completions")
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| QuestCompletion unique on `completedAt` (DateTime) | Unique on `completedDate` (Date) | Phase 38 | Prevents same-day duplicates that pass the millisecond dedup window |
| `awardRewards()` + `questCompletion.create()` as sequential awaits | Both inside `prisma.$transaction` | Phase 38 | Eliminates partial-award state if either operation fails |
| No Runen cap | Redis INCR+EXPIRE daily cap per userId per day | Phase 38 | WV-only cap; other quest Runen uncapped |

---

## Open Questions

1. **`pendingXp` / `pendingRunen` fields on QuestCompletion vs. storing in Redis**
   - What we know: The audit confirm endpoint needs to know how many XP/Runen to credit. These were computed in the BullMQ worker.
   - What's unclear: Whether storing pending amounts in DB columns (simple, durable) or in a Redis hash (ephemeral, 24h TTL) is preferred.
   - Recommendation: Store in DB columns (`pendingXp Int @default(0)`, `pendingRunen Int @default(0)`) — simpler, no additional Redis dependency, survives Redis restart. Cost: two extra INT columns on a low-volume table.

2. **Where to listen for `gamification:audit-needed` socket event on client**
   - What we know: `bossfight-banner.tsx` handles Socket.IO in a useEffect with `getSocket()`. The audit listener needs to be available throughout the session, not just when the banner is mounted.
   - What's unclear: Whether to add the listener to `quest-widget.tsx` or create a top-level `gamification-socket-listener.tsx` mounted in the dashboard layout.
   - Recommendation: Create a small `gamification-socket-listener.tsx` client component mounted once in the dashboard layout. This prevents the listener from being unmounted when the widget is not visible.

3. **Follow-up WV bonus Runen amount**
   - What we know: Bonus is awarded if a new WV was created for the same Akte within the same day (not a requirement for the quest to count).
   - What's unclear: How many bonus Runen? The CONTEXT.md does not specify an amount.
   - Recommendation: Use a small fixed bonus (e.g., +5 Runen) hardcoded as a constant in quest-service.ts, similar to `BASE_HIT_RUNEN` in boss-constants.ts. This also counts toward the daily cap.

---

## Validation Architecture

> `workflow.nyquist_validation` is NOT set in `.planning/config.json` — skip this section.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `src/lib/helena/rate-limiter.ts` (INCR+EXPIRE pattern), `src/lib/gamification/boss-engine.ts` ($transaction pattern), `src/lib/gamification/quest-service.ts` (completion flow), `prisma/schema.prisma` (QuestCompletion model), `src/lib/settings/defaults.ts` (SystemSetting pattern)
- Codebase inspection — `src/worker.ts`, `src/lib/queue/processors/gamification.processor.ts` (BullMQ job types and delayed job capability)
- Codebase inspection — `src/app/api/kalender/[id]/erledigt/route.ts` (WV completion endpoint — confirms business logic stays unchanged)

### Secondary (MEDIUM confidence)
- Prisma docs (from training knowledge, verified against existing codebase usage): `$transaction`, `{ increment: N }` atomic updates, `P2002` unique constraint error code
- PostgreSQL docs: `DATE` type behavior in `@@unique` constraints is well-established; `@db.Date` mapping in Prisma is the standard pattern

### Tertiary (LOW confidence)
- Sonner `action` + `cancel` toast pattern with `duration: Infinity` — verified against project imports (`src/app/layout.tsx` shows `Toaster` from `sonner`) but action toast API not directly verified against codebase usage (no existing examples of action toasts found in the project)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are existing project dependencies
- Architecture patterns: HIGH — directly derived from existing code (rate-limiter.ts, boss-engine.ts)
- Pitfalls: HIGH — derived from existing code structure and PostgreSQL/Prisma behavior
- Audit flow (ABUSE-03): MEDIUM — Socket.IO + BullMQ delayed job pattern is established in codebase; Sonner action toast API is LOW (no existing example in project)

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable stack)
