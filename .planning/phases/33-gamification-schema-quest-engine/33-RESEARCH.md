# Phase 33: Gamification Schema + Quest Engine - Research

**Researched:** 2026-03-02
**Domain:** Prisma schema design, BullMQ cron jobs, JSON DSL evaluation, XP/Level/Streak game mechanics
**Confidence:** HIGH

## Summary

Phase 33 is a backend-only phase that adds gamification infrastructure to the existing AI-Lawyer platform. It requires three Prisma models (UserGameProfile, Quest, QuestCompletion), new enums (SpielKlasse, QuestTyp, QuestPeriode), a JSON-based quest condition evaluator that runs Prisma COUNT queries, and two BullMQ cron jobs (daily quest reset at 00:05, nightly safety-net at 23:55). No UI is in scope -- that is Phase 34.

The codebase already has 17 BullMQ queues with established patterns for queue definition, worker registration, cron scheduling via `upsertJobScheduler`, and processor files. The gamification queue follows the identical pattern. The `feiertagejs` library and `UrlaubZeitraum` model are already available for streak workday-awareness. The seed pattern from `seedFalldatenTemplates` (version guard via SystemSetting) is the exact pattern for seeding the 5 initial daily quests.

**Primary recommendation:** Follow existing BullMQ + Prisma patterns exactly. The gamification queue is a lightweight cron-only queue (no LLM, no heavy IO). The quest condition DSL is a simple JSON object mapped to a `prisma.model.count()` call with date-range filtering. The main novel work is the DSL evaluator function and the XP/Level progression formula.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Quest DSL**: Simple count-based conditions: `{"model": "KalenderEintrag", "where": {"status": "ERLEDIGT", "typ": "FRIST"}, "count": 5, "period": "today"}`. Period types: "today", "thisWeek", "thisMonth". One condition per quest. Evaluator runs Prisma COUNT with where-clause + date filter + userId.
- **5 Hardcoded Daily Quests**: "Die Siegel des Tages" (Fristen), "Die Chroniken entwirren" (Wiedervorlagen), "Prägung der Münzen" (Rechnungen), "Ordnung im Skriptorium" (Akten nächster Schritt), "Bote der Klarheit" (Anfragen beantwortet)
- **XP/Level Curve**: Steigende Schwelle -- Level 1-10 = 300 XP/Level, Level 11-20 = 500 XP/Level, Level 21+ = 800 XP/Level. Function: `getRequiredXp(level)` returns cumulative XP threshold.
- **Level Titles**: "Junior Workflow" (1-10), "Workflow Stabil" (11-20), "Backlog Controller" (21-30), "Billing Driver" (31-40), "Kanzlei-Operator" (41-50)
- **Opt-in Mechanism**: Admin activates gamification globally (SystemSetting `gamification.enabled`). Individual users deactivate via Profil-Settings toggle. GameProfile created lazily on first opt-in. Klasse auto-assigned from RBAC role: ANWALT->JURIST, SACHBEARBEITER->SCHREIBER, SEKRETARIAT->WAECHTER, ADMIN->QUARTIERMEISTER.
- **Fantasy Theming**: Full Fantasy naming. Level titles are sachlich. IP-free names only.
- **Streak Logic**: Consecutive workdays (Mon-Fri minus Feiertage) where at least one Kernquest was completed. Use existing Feiertagskalender. Check UrlaubZeitraum for automatic freeze (not ABWESENHEIT calendar type -- see research finding). Bonuses: 3 days = +10% Runen, 7 days = +25% Runen (multiplier on quest rewards, Runen only).
- **Fire-and-Forget Quest Check**: `checkQuestsForUser(userId)` via BullMQ `gamification` queue. Nightly cron at 23:55 as safety net.
- **DSGVO Architecture**: UserGameProfile linked via userId (FK). No cross-user query paths. `gamificationOptIn: Boolean @default(false)` on User model. Cascade delete: User -> GameProfile + QuestCompletions.
- **Quest Rewards**: Siegel = 80 XP / 8 Runen, Chroniken = 60 XP / 12 Runen, Münzen = 60 XP / 10 Runen, Skriptorium = 40 XP / 5 Runen, Bote = 30 XP / 4 Runen.
- **Atomic Increments**: Always use `prisma.userGameProfile.update({ data: { xp: { increment }, runen: { increment } } })` -- never read-modify-write.
- **Seed Pattern**: Follow `seedFalldatenTemplates` pattern (SystemSetting version guard + ADMIN user lookup).

### Claude's Discretion
- Exact Prisma model field names and indexes
- BullMQ queue naming and job data structure
- Whether quest check is inline `.catch()` or BullMQ async (BullMQ recommended for isolation)
- Seed data format for 5 initial quests
- Nightly cron: whether to use existing worker process or separate

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GAME-01 | User hat ein GameProfile mit XP, Level, Runen, Streak-Tage und Klasse | Prisma schema for `UserGameProfile` model with all fields; `SpielKlasse` enum for class assignment |
| GAME-02 | XP-basiertes Level-System mit linearer Progression | `getRequiredXp(level)` and `getLevelForXp(xp)` pure functions; tiered thresholds (300/500/800) |
| GAME-03 | Runen als separate Belohnungswährung | Separate `runen: Int @default(0)` field on UserGameProfile; atomic increment pattern |
| GAME-04 | Streak-Tracking mit automatischem Freeze bei Urlaub/Abwesenheit | `UrlaubZeitraum` model + `istFeiertag()` from `feiertagejs` for workday detection; streak logic in GameProfileService |
| GAME-05 | Klassen-Zuweisung basierend auf RBAC-Rolle | `SpielKlasse` enum; mapping function `roleToKlasse(UserRole): SpielKlasse` |
| GAME-06 | DSGVO-konforme Datenarchitektur | `gamificationOptIn` on User; self-only API routes; cascade delete on relations |
| QUEST-01 | 5 Daily Quests mit maschinenlesbarer Bedingungslogik | Quest model with `bedingung: Json`; DSL type `QuestCondition`; 5 seed records |
| QUEST-02 | Quest-Bedingungen evaluieren automatisch gegen echte Prisma-Daten | `evaluateQuestCondition(condition, userId, date)` function; model-to-Prisma-delegate mapping |
| QUEST-03 | Quest-Completion wird nach Geschäftsaktion geprüft (fire-and-forget) | BullMQ `gamification` queue; `enqueueQuestCheck(userId)` helper; `.catch(() => {})` pattern |
| QUEST-07 | Nightly Cron als Safety Net für verpasste Quest-Checks und Streak-Finalisierung | Two `upsertJobScheduler` crons: daily-reset (00:05), nightly-safety-net (23:55) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | existing (5.x) | Schema models, migrations, typed queries | Already 80+ models in codebase, zero config needed |
| BullMQ | existing (5.x) | Queue for async quest evaluation + 2 cron jobs | 17 queues already running, pattern fully established |
| feiertagejs | existing | German public holidays for streak workday check | Already used in `src/lib/fristen/feiertage.ts` |
| date-fns | existing | Date manipulation for period calculations | Already used throughout codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | existing | Quest condition DSL type validation | Validate JSON before evaluation |
| ioredis | existing | BullMQ queue connections | Queue infrastructure |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON DSL in Prisma Json column | Separate condition tables (normalized) | Json is simpler, already 10+ Json columns in schema; normalization adds complexity with no benefit for 5 quests |
| BullMQ cron | node-cron in-process | BullMQ crons are already the standard; node-cron would be a new dependency with no persistence |

**Installation:**
```bash
# No new packages needed -- all libraries already in project
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── gamification/
│       ├── types.ts              # QuestCondition DSL type, GameProfile types
│       ├── game-profile-service.ts  # XP/Level/Runen/Streak CRUD + calculations
│       ├── quest-evaluator.ts    # evaluateQuestCondition() -- Prisma COUNT queries
│       ├── quest-service.ts      # checkQuestsForUser(), daily reset, nightly safety net
│       └── seed-quests.ts        # Idempotent seed for 5 daily quests
├── lib/queue/
│   └── processors/
│       └── gamification.processor.ts  # BullMQ processor (quest-check + cron handlers)
└── worker.ts                     # Register gamification worker + crons (add to existing)
```

### Pattern 1: Quest Condition DSL
**What:** A JSON object stored in `Quest.bedingung` (Prisma Json column) that describes what business action to count
**When to use:** For every quest evaluation
**Example:**
```typescript
// Type definition
interface QuestCondition {
  model: "KalenderEintrag" | "Ticket" | "Rechnung" | "Akte";
  where: Record<string, string | boolean>;  // Prisma where-clause fields
  count: number;                             // Target count for completion
  period: "today" | "thisWeek" | "thisMonth";
}

// Example: "Die Siegel des Tages" -- complete 3 Fristen today
const siegelCondition: QuestCondition = {
  model: "KalenderEintrag",
  where: { erledigt: true, typ: "FRIST" },
  count: 3,
  period: "today"
};
```

### Pattern 2: DSL Evaluator with Model Dispatch
**What:** A function that translates the DSL into a Prisma `count()` call with date filtering
**When to use:** When evaluating whether a quest is completed
**Example:**
```typescript
// Source: Project pattern -- Prisma typed queries
async function evaluateQuestCondition(
  condition: QuestCondition,
  userId: string,
  date: Date = new Date()
): Promise<{ current: number; target: number; completed: boolean }> {
  const dateRange = getDateRange(condition.period, date);

  // Build where clause with userId scoping + date range
  const where = {
    ...condition.where,
    ...getUserScope(condition.model, userId),
    ...dateRange,
  };

  // Dispatch to correct Prisma model
  const current = await countForModel(condition.model, where);

  return {
    current,
    target: condition.count,
    completed: current >= condition.count,
  };
}

// Model dispatch -- each model has different userId field and date field
function getUserScope(model: string, userId: string): Record<string, string> {
  switch (model) {
    case "KalenderEintrag": return { verantwortlichId: userId };
    case "Ticket":          return { verantwortlichId: userId };
    case "Rechnung":        return {}; // Rechnungen scoped via Akte → anwaltId
    case "Akte":            return {}; // Akten scoped via anwaltId or sachbearbeiterId
    default: throw new Error(`Unknown model: ${model}`);
  }
}

function getDateField(model: string): string {
  switch (model) {
    case "KalenderEintrag": return "erledigtAm";  // When the Frist was completed
    case "Ticket":          return "erledigtAm";   // When the WV was completed
    case "Rechnung":        return "createdAt";    // When the Rechnung was created
    case "Akte":            return "geaendert";    // When the Akte was last updated
    default: throw new Error(`Unknown model: ${model}`);
  }
}
```

### Pattern 3: BullMQ Cron Registration (Existing Pattern)
**What:** Register repeatable jobs using `upsertJobScheduler`
**When to use:** For the two gamification crons
**Example:**
```typescript
// Source: src/lib/queue/queues.ts -- existing pattern used 8+ times
export const gamificationQueue = new Queue("gamification", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 1,              // Quest eval is idempotent, no retry needed
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
  },
});

export async function registerGamificationDailyReset(
  cronPattern = "5 0 * * *"  // 00:05 Europe/Berlin
): Promise<void> {
  await gamificationQueue.upsertJobScheduler(
    "gamification-daily-reset",
    { pattern: cronPattern, tz: "Europe/Berlin" },
    {
      name: "daily-reset",
      data: {},
      opts: { removeOnComplete: { count: 50 }, removeOnFail: { count: 20 } },
    }
  );
}

export async function registerGamificationNightlySafetyNet(
  cronPattern = "55 23 * * *"  // 23:55 Europe/Berlin
): Promise<void> {
  await gamificationQueue.upsertJobScheduler(
    "gamification-nightly-safety-net",
    { pattern: cronPattern, tz: "Europe/Berlin" },
    {
      name: "nightly-safety-net",
      data: {},
      opts: { removeOnComplete: { count: 50 }, removeOnFail: { count: 20 } },
    }
  );
}
```

### Pattern 4: Atomic XP/Runen Increment (Locked Decision)
**What:** Use Prisma's atomic `increment` operation to avoid race conditions
**When to use:** Every time XP or Runen are awarded
**Example:**
```typescript
// Source: CONTEXT.md locked decision -- atomic increments
async function awardRewards(
  userId: string,
  xpReward: number,
  runenReward: number,
  streakMultiplier: number = 1.0
): Promise<void> {
  const adjustedRunen = Math.round(runenReward * streakMultiplier);

  await prisma.userGameProfile.update({
    where: { userId },
    data: {
      xp: { increment: xpReward },
      runen: { increment: adjustedRunen },
    },
  });
}
```

### Pattern 5: Seed with SystemSetting Version Guard
**What:** Idempotent seeding using a SystemSetting key as version guard
**When to use:** Seeding the 5 initial daily quests
**Example:**
```typescript
// Source: src/lib/falldaten/seed-templates.ts -- exact pattern to follow
const SEED_VERSION = "v0.4";
const SEED_SETTING_KEY = "gamification.quests_seed_version";

export async function seedDailyQuests(): Promise<void> {
  const currentVersion = await getSetting(SEED_SETTING_KEY);
  if (currentVersion === SEED_VERSION) return;

  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN", aktiv: true },
  });
  if (!adminUser) throw new Error("No active ADMIN user found");

  // Upsert 5 daily quests...
  await updateSetting(SEED_SETTING_KEY, SEED_VERSION);
}
```

### Anti-Patterns to Avoid
- **Read-Modify-Write for XP/Runen:** Never `const profile = await find(); await update({ xp: profile.xp + reward })`. Always use `{ increment: reward }`. Concurrent completions would cause lost updates.
- **Blocking business routes with quest evaluation:** Never `await checkQuests()` in API route handlers. Always fire-and-forget via BullMQ or `.catch(() => {})`.
- **Cross-user profile queries:** Never add an API route that returns another user's GameProfile. DSGVO violation. Phase 41 uses GROUP BY aggregates only.
- **Dynamic Prisma model access via `prisma[model]`:** TypeScript does not type-check dynamic model access. Use a switch/map pattern with explicit model names instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| German public holidays | Holiday lookup table | `feiertagejs` via existing `istFeiertag()` wrapper | 16 Bundeslaender, regional variations, moving holidays (Easter) |
| Date range calculations | Manual date arithmetic | `date-fns` `startOfDay/endOfDay/startOfWeek/endOfWeek/startOfMonth/endOfMonth` | Timezone-safe, DST-aware, well-tested |
| Cron scheduling | `setInterval` or `setTimeout` | BullMQ `upsertJobScheduler` | Persistence, exactly-once, timezone support, crash recovery |
| Queue infrastructure | Custom Redis pub/sub | BullMQ Queue + Worker | Already running 17 queues, proven retry/backoff/dead-letter |
| Settings storage | ENV vars or config files | `SystemSetting` model + `getSettingTyped()` | Already used for all feature flags, hot-reloadable |

**Key insight:** This phase adds zero new infrastructure. Every building block (queues, crons, Prisma models, settings, holidays) already exists. The novel work is the game logic and DSL evaluator.

## Common Pitfalls

### Pitfall 1: KalenderEintrag Date Field for "Completed Today" Queries
**What goes wrong:** Using `datum` field to check if a Frist was completed today. `datum` is the deadline date, not the completion date. A Frist due next month that was completed today should count today.
**Why it happens:** The `datum` field is the most visible date field. `erledigtAm` is the correct field for "when was this completed."
**How to avoid:** Quest condition for "Fristen erledigt" must filter on `erledigtAm` within the date range AND `erledigt: true`, not on `datum`.
**Warning signs:** Quests showing 0 completions even when Fristen were clearly marked as done.

### Pitfall 2: No ABWESENHEIT Calendar Type -- Use UrlaubZeitraum
**What goes wrong:** CONTEXT.md mentions "check against existing calendar entries with type ABWESENHEIT" for streak freeze, but `KalenderTyp` enum has only `TERMIN | FRIST | WIEDERVORLAGE` -- no ABWESENHEIT.
**Why it happens:** Vacation tracking is done via the dedicated `UrlaubZeitraum` model (discovered at `prisma/schema.prisma:449`), not via calendar entries.
**How to avoid:** Query `UrlaubZeitraum` to detect vacation days: `prisma.urlaubZeitraum.findFirst({ where: { userId, von: { lte: date }, bis: { gte: date } } })`.
**Warning signs:** Streak breaks during vacation despite documentation saying it should freeze.

### Pitfall 3: Streak Calculation Must Be Workday-Aware
**What goes wrong:** Counting calendar days instead of workdays for streak. Weekend gaps break streaks even though nobody works on weekends.
**Why it happens:** Simple `differenceInCalendarDays` logic ignores weekends and holidays.
**How to avoid:** Walk backwards through workdays only: skip Saturdays, Sundays, `istFeiertag()` days, and `UrlaubZeitraum` days. A streak of 5 means 5 consecutive workdays (could span 7+ calendar days).
**Warning signs:** All users lose streaks every Monday.

### Pitfall 4: Race Condition in Level-Up Check
**What goes wrong:** After incrementing XP atomically, reading the profile to check level-up can show stale data if another concurrent increment happened between the increment and the read.
**Why it happens:** `prisma.update({ data: { xp: { increment } } })` returns the updated record. But if you do a separate `findUnique` after, another increment may have landed.
**How to avoid:** Use the return value of the `update()` call directly -- it contains the post-increment values. Calculate level from the returned `xp` value.
**Warning signs:** Occasional level-up notifications with wrong XP values.

### Pitfall 5: Nightly Safety Net Double-Counting
**What goes wrong:** Nightly cron at 23:55 awards XP for quests that were already completed and awarded during the day via fire-and-forget checks.
**Why it happens:** The safety net re-evaluates all daily quests without checking if a `QuestCompletion` already exists for today.
**How to avoid:** Before awarding, always check `QuestCompletion` table: `prisma.questCompletion.findFirst({ where: { userId, questId, completedAt: { gte: startOfDay } } })`. If exists, skip.
**Warning signs:** Users getting double XP on days when both fire-and-forget AND nightly cron process their quests.

### Pitfall 6: Akte "Nächster Schritt" Quest Has No Direct Field
**What goes wrong:** The quest "Ordnung im Skriptorium" (Akten nächster Schritt) references a "next step" concept, but the `Akte` model has no `naechsterSchritt` field.
**Why it happens:** "Nächster Schritt" may refer to updating `Akte.notizen`, changing `Akte.status`, or creating an `AktenActivity`.
**How to avoid:** For the DSL evaluator, interpret "Ordnung im Skriptorium" as updating an Akte (any update that changes `geaendert` timestamp), or count `AktenActivity` records created today by the user. Clarify the exact business meaning before implementation. A practical approach: count Akten where the user set a new status or created an activity today.
**Warning signs:** Quest permanently stuck at 0/N or trivially completable.

### Pitfall 7: "Bote der Klarheit" (Anfragen) -- No Anfrage Model
**What goes wrong:** Quest references "Anfragen beantwortet" but there is no `Anfrage` model in the schema.
**Why it happens:** "Anfragen" likely maps to `Ticket` model (tickets are internal task/request tracking with status OFFEN -> IN_BEARBEITUNG -> ERLEDIGT).
**How to avoid:** Map "Anfragen beantwortet" to `Ticket` with `status: "ERLEDIGT"` and `verantwortlichId: userId`, filtered by `erledigtAm` within date range.
**Warning signs:** Quest evaluator throws "Unknown model: Anfrage" error.

## Code Examples

### XP/Level Progression Functions
```typescript
// Pure functions -- no DB access, easily testable

const LEVEL_TIERS = [
  { maxLevel: 10, xpPerLevel: 300 },
  { maxLevel: 20, xpPerLevel: 500 },
  { maxLevel: Infinity, xpPerLevel: 800 },
];

/** Get cumulative XP required to reach a given level */
export function getRequiredXp(level: number): number {
  if (level <= 1) return 0;
  let totalXp = 0;
  let currentLevel = 1;

  for (const tier of LEVEL_TIERS) {
    const levelsInTier = Math.min(level - 1, tier.maxLevel) - (currentLevel - 1);
    if (levelsInTier <= 0) break;
    totalXp += levelsInTier * tier.xpPerLevel;
    currentLevel += levelsInTier;
    if (currentLevel >= level) break;
  }

  return totalXp;
}

/** Get level for a given XP amount */
export function getLevelForXp(xp: number): number {
  let level = 1;
  while (getRequiredXp(level + 1) <= xp) {
    level++;
    if (level >= 50) break; // Cap at 50
  }
  return level;
}

/** Get level title for display */
export function getLevelTitle(level: number): string {
  if (level <= 10) return "Junior Workflow";
  if (level <= 20) return "Workflow Stabil";
  if (level <= 30) return "Backlog Controller";
  if (level <= 40) return "Billing Driver";
  return "Kanzlei-Operator";
}
```

### Streak Calculation
```typescript
import { subDays, isSaturday, isSunday, startOfDay } from "date-fns";
import { istFeiertag } from "@/lib/fristen/feiertage";
import type { BundeslandCode } from "@/lib/fristen/types";

/** Check if a date is a workday (not weekend, not holiday, not vacation) */
async function isWorkday(
  date: Date,
  userId: string,
  bundesland: BundeslandCode
): Promise<boolean> {
  if (isSaturday(date) || isSunday(date)) return false;
  if (istFeiertag(date, bundesland)) return false;

  // Check UrlaubZeitraum for vacation freeze
  const vacation = await prisma.urlaubZeitraum.findFirst({
    where: {
      userId,
      von: { lte: date },
      bis: { gte: startOfDay(date) },
    },
  });
  return !vacation;
}

/** Calculate current streak (consecutive workdays with at least 1 quest completed) */
async function calculateStreak(
  userId: string,
  bundesland: BundeslandCode
): Promise<number> {
  let streak = 0;
  let checkDate = new Date();

  for (let i = 0; i < 365; i++) { // Max lookback 1 year
    const isWork = await isWorkday(checkDate, userId, bundesland);

    if (isWork) {
      // Check if any quest was completed on this workday
      const completion = await prisma.questCompletion.findFirst({
        where: {
          userId,
          completedAt: {
            gte: startOfDay(checkDate),
            lt: new Date(startOfDay(checkDate).getTime() + 86_400_000),
          },
        },
      });

      if (completion) {
        streak++;
      } else {
        break; // Workday with no completion = streak broken
      }
    }
    // Non-workdays (weekend, holiday, vacation) are simply skipped

    checkDate = subDays(checkDate, 1);
  }

  return streak;
}

/** Get streak Runen multiplier */
export function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 7) return 1.25; // +25%
  if (streakDays >= 3) return 1.10; // +10%
  return 1.0;
}
```

### Quest Seed Data Format
```typescript
const DAILY_QUESTS = [
  {
    name: "Die Siegel des Tages",
    beschreibung: "Erledige 3 Fristen",
    typ: "DAILY",
    bedingung: {
      model: "KalenderEintrag",
      where: { erledigt: true, typ: "FRIST" },
      dateField: "erledigtAm",
      userField: "verantwortlichId",
      count: 3,
      period: "today",
    },
    xpBelohnung: 80,
    runenBelohnung: 8,
    sortierung: 1,
  },
  {
    name: "Die Chroniken entwirren",
    beschreibung: "Erledige 3 Wiedervorlagen",
    typ: "DAILY",
    bedingung: {
      model: "Ticket",
      where: { status: "ERLEDIGT" },
      dateField: "erledigtAm",
      userField: "verantwortlichId",
      count: 3,
      period: "today",
    },
    xpBelohnung: 60,
    runenBelohnung: 12,
    sortierung: 2,
  },
  {
    name: "Prägung der Münzen",
    beschreibung: "Erstelle 2 Rechnungen",
    typ: "DAILY",
    bedingung: {
      model: "Rechnung",
      where: { status: "GESTELLT" },
      dateField: "createdAt",
      userField: null, // Scoped via Akte membership
      count: 2,
      period: "today",
    },
    xpBelohnung: 60,
    runenBelohnung: 10,
    sortierung: 3,
  },
  {
    name: "Ordnung im Skriptorium",
    beschreibung: "Aktualisiere 3 Akten",
    typ: "DAILY",
    bedingung: {
      model: "AktenActivity",
      where: {},
      dateField: "createdAt",
      userField: "userId",
      count: 3,
      period: "today",
    },
    xpBelohnung: 40,
    runenBelohnung: 5,
    sortierung: 4,
  },
  {
    name: "Bote der Klarheit",
    beschreibung: "Beantworte 2 Tickets",
    typ: "DAILY",
    bedingung: {
      model: "Ticket",
      where: { status: "ERLEDIGT" },
      dateField: "erledigtAm",
      userField: "verantwortlichId",
      count: 2,
      period: "today",
    },
    xpBelohnung: 30,
    runenBelohnung: 4,
    sortierung: 5,
  },
];
```

### Prisma Schema Models
```prisma
// ─── Gamification ────────────────────────────────────────────────────────────

enum SpielKlasse {
  JURIST          // ANWALT
  SCHREIBER       // SACHBEARBEITER
  WAECHTER        // SEKRETARIAT
  QUARTIERMEISTER // ADMIN
}

enum QuestTyp {
  DAILY
  WEEKLY
  SPECIAL
}

model UserGameProfile {
  id           String      @id @default(cuid())
  userId       String      @unique
  user         User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  klasse       SpielKlasse
  xp           Int         @default(0)
  runen        Int         @default(0)
  streakTage   Int         @default(0)
  streakLetzte DateTime?   // Last workday a quest was completed (for streak calc)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  completions  QuestCompletion[]

  @@index([userId])
  @@map("user_game_profiles")
}

model Quest {
  id              String    @id @default(cuid())
  name            String
  beschreibung    String?
  typ             QuestTyp  @default(DAILY)
  bedingung       Json      // QuestCondition DSL
  xpBelohnung     Int       @default(0)
  runenBelohnung  Int       @default(0)
  aktiv           Boolean   @default(true)
  sortierung      Int       @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  completions     QuestCompletion[]

  @@index([typ, aktiv])
  @@map("quests")
}

model QuestCompletion {
  id          String           @id @default(cuid())
  userId      String
  questId     String
  quest       Quest            @relation(fields: [questId], references: [id], onDelete: Cascade)
  profile     UserGameProfile  @relation(fields: [userId], references: [userId], onDelete: Cascade)
  xpVerdient  Int
  runenVerdient Int
  completedAt DateTime         @default(now())

  @@index([userId, completedAt])
  @@index([questId])
  @@unique([userId, questId, completedAt]) // Prevent exact-timestamp duplicates
  @@map("quest_completions")
}
```

**Note on deduplication:** The `@@unique` on `[userId, questId, completedAt]` is a safety net but not sufficient for daily dedup since `completedAt` includes time component. The service layer must check for existing completions within the same day using a date range query before creating a new one.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Game logic in frontend | Game logic in backend with DB as source of truth | Always for this project | Frontend only displays; backend validates and awards |
| setTimeout-based crons | BullMQ repeatable jobs with persistence | BullMQ 4.x+ | Crash recovery, exactly-once semantics, timezone support |
| Read-modify-write for counters | Prisma atomic `increment` | Prisma 4.x+ | Race-condition-free concurrent updates |

**Deprecated/outdated:**
- None relevant -- all patterns used are current and established in the codebase.

## Open Questions

1. **"Ordnung im Skriptorium" Quest Target Model**
   - What we know: Akte has no `naechsterSchritt` field. `AktenActivity` tracks user actions on Akten.
   - What's unclear: Whether the quest should count `AktenActivity` records (any activity), or specifically Akte status changes, or something else.
   - Recommendation: Use `AktenActivity` model with `userId` and `createdAt` filter. This counts any meaningful action a user takes on an Akte (status changes, document uploads, etc.). The `AktenActivity` model already exists at line 1896+ in the schema and has `userId` and `createdAt` fields.

2. **"Prägung der Münzen" User Scoping**
   - What we know: `Rechnung` has no direct `userId` field. It is linked to an `Akte`, which has `anwaltId` and `sachbearbeiterId`.
   - What's unclear: Whether the quest should count only Rechnungen where the user is the Akte's Anwalt, or any Rechnung the user created.
   - Recommendation: Extend the DSL evaluator to support a join-based scope: Rechnungen where `akte.anwaltId = userId OR akte.sachbearbeiterId = userId`. Alternatively, since seed data is hardcoded, the DSL could use a special `userScope: "akteRelation"` field to trigger this join.

3. **Bundesland for Streak Holiday Check**
   - What we know: `feiertagejs` requires a `BundeslandCode`. The Kanzlei or user might have a default.
   - What's unclear: Where the Bundesland comes from for streak calculations.
   - Recommendation: Read from SystemSetting `kanzlei.bundesland` (likely already set during onboarding). Fall back to `"NW"` (Nordrhein-Westfalen) as the codebase default used in `frist-reminder.ts`.

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` (lines 14-19, 57-61, 164-168, 349-437, 449-460, 710-777, 1112-1168, 1223-1262, 1730-1758, 1801-1813) -- All existing models, enums, and patterns
- `src/lib/queue/queues.ts` -- 17 queues, `upsertJobScheduler` cron pattern, `defaultJobOptions`
- `src/worker.ts` -- Worker registration, startup sequence, cron registration, graceful shutdown
- `src/lib/fristen/feiertage.ts` -- `istFeiertag()` wrapper around `feiertagejs`
- `src/lib/fristen/types.ts` -- `BundeslandCode` type
- `src/lib/falldaten/seed-templates.ts` -- Idempotent seed pattern with SystemSetting version guard
- `src/lib/settings/service.ts` -- `getSetting()`, `getSettingTyped()`, `updateSetting()`, cache with 30s TTL
- `src/workers/processors/frist-reminder.ts` -- Reference processor pattern with date handling

### Secondary (MEDIUM confidence)
- CONTEXT.md user decisions -- All locked decisions verified against codebase feasibility

### Tertiary (LOW confidence)
- "Ordnung im Skriptorium" target model -- Assumption that `AktenActivity` is the right proxy; needs validation during implementation
- "Prägung der Münzen" user scoping -- Rechnung lacks direct userId; join logic needed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Zero new dependencies. All libraries already in use with established patterns.
- Architecture: HIGH -- Follows exact BullMQ queue/worker/cron pattern used 17 times. Prisma model patterns match 80+ existing models.
- Pitfalls: HIGH -- Identified 7 concrete pitfalls from actual codebase investigation (missing ABWESENHEIT type, date field confusion, race conditions, model mapping gaps).

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable domain -- no external API changes expected)
