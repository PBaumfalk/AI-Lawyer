# Phase 37: Klassen + Weekly + Special Quests - Research

**Researched:** 2026-03-02
**Domain:** Gamification quest system extension (role filtering, weekly quests, admin CRUD)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Role-Quest Filtering (QUEST-04):**
- Add nullable `klasse` field (SpielKlasse?) to Quest model -- null means all roles, specific value means class-exclusive
- Class-themed content: each role gets quests with different names and descriptions matching their daily work (e.g. JURIST gets Fristen-themed quests, SCHREIBER gets Rechnungs-themed)
- Reassign existing 5 daily quests to their natural classes (based on which models they query) and add new class-specific ones
- 3 daily quests per class (total seed pool: ~12 quests)
- `checkQuestsForUser()` must filter quests by user's SpielKlasse (via `roleToKlasse()`) in addition to quest type

**Weekly Quest Behavior (QUEST-05):**
- Weekly quests are always visible (all 7 days), reset Monday 00:00 via existing `thisWeek` period
- Extend QuestCondition DSL with a new condition type for delta/ratio changes (e.g. "reduce open tickets by 20%") -- needs new evaluator path comparing start-of-week snapshot vs current count
- Mix of universal (klasse=null) and class-specific weekly quests
- Show all matching weekly quests to the user (no fixed cap)

**Special Quest Admin UI (QUEST-06):**
- Admin UI lives in the Einstellungen page as a Gamification settings tab/section
- Full CRUD with fields: name, Beschreibung, start date, end date, XP reward, Runen reward, target roles (all or specific SpielKlasse), condition (from preset templates)
- Condition builder uses preset templates (e.g. "Fristen erledigen", "Rechnungen erstellen", "Tickets bearbeiten") -- admin picks template and sets target count
- Auto-hide from widget after end date passes; completions remain in history; no manual cleanup needed
- Quest model needs `startDatum` and `endDatum` fields (nullable, only used for SPECIAL type)

**Quest Widget Sections:**
- Grouped sections with headers: "Tagesquests", "Wochenquests", "Special" -- all visible at once, separated by dividers
- Special Quest section gets a subtle accent border (amber/gold left border) to draw attention
- Special quests show a countdown badge with remaining days (e.g. "3 Tage verbleibend")
- Hide empty sections entirely (e.g. no Special section if no active special quests)

### Claude's Discretion
- Exact quest names and XP/Runen balancing for new class-specific quests
- Delta/ratio evaluator implementation details (snapshot storage approach)
- Preset template list for special quest condition builder
- Exact styling of section headers, dividers, and accent borders within oklch Glass UI system
- Weekly quest completion dedup strategy (weekly completions vs daily re-evaluation)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QUEST-04 | Klassen-spezifische Quests (unterschiedliche Quests pro RBAC-Rolle/Klasse) | Quest.klasse field + seed-quests extension + checkQuestsForUser filter + dashboard API grouped response |
| QUEST-05 | Weekly Quests fuer strukturelle Ziele (Backlog-Reduktion, Abrechnung, Akten-Checks) | QuestCondition DSL delta type + WeeklySnapshot model + weekly evaluator path + Monday cron |
| QUEST-06 | Special Quests / zeitlich begrenzte Kampagnen (Admin-konfigurierbar mit Start-/Enddatum) | Quest.startDatum/endDatum fields + Special Quest CRUD API + Admin UI in GamificationTab + auto-hide logic |
</phase_requirements>

## Summary

This phase extends the existing Phase 33 quest system (5 daily quests, fire-and-forget evaluation, QuestCondition DSL) with three capabilities: role-based quest filtering, weekly aggregate quests, and admin-managed special quests. The existing architecture is well-suited for extension -- the `QuestTyp` enum already has DAILY/WEEKLY/SPECIAL values, `roleToKlasse()` already maps RBAC roles to SpielKlasse, and the evaluator's model dispatch pattern supports adding new condition types.

The most complex new concept is the **delta/ratio evaluator** for weekly quests. Unlike daily quests which count absolute values within a date range, weekly "reduce backlog by 20%" quests need a baseline snapshot taken at week start and compared against current state. This requires a new `WeeklySnapshot` model and a Monday 00:00 cron to create snapshots. The evaluator needs a second code path for `type: "delta"` conditions that reads the snapshot and computes the ratio.

The admin Special Quest UI is a standard CRUD form in the existing Einstellungen Gamification tab. The condition builder uses preset templates that map to `QuestCondition` JSON -- the admin never writes raw JSON. The widget refactor groups quests into three sections with distinct visual treatment.

**Primary recommendation:** Extend in two plans -- Plan 01 for schema + backend (klasse field, weekly evaluator, cron, seed) and Plan 02 for frontend (widget sections, admin CRUD UI, Special Quest API).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma ORM | existing | Quest model schema changes, WeeklySnapshot model | Single source of truth, already used for all gamification models |
| date-fns | existing | `startOfWeek`, `endOfWeek`, `differenceInDays` for weekly/countdown logic | Already imported in quest-evaluator.ts |
| BullMQ | existing | Monday 00:00 weekly snapshot cron job | Already used for gamification crons (daily-reset, nightly-safety-net) |
| NextAuth v5 | existing | RBAC role check for admin-only Special Quest CRUD | Already used on all API routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui (Select, DatePicker, Dialog) | existing | Special Quest admin form components | Admin CRUD form in GamificationTab |
| sonner | existing | Toast notifications for CRUD success/error | Already used in GamificationTab |
| lucide-react | existing | Section icons (Scroll, Calendar, Sparkles) | Widget section headers |

### Alternatives Considered
None -- this phase uses exclusively existing stack. No new npm packages needed.

**Installation:**
```bash
# No new packages needed -- all existing
```

## Architecture Patterns

### Recommended Project Structure
```
prisma/
  schema.prisma                    # + klasse, startDatum, endDatum on Quest; + WeeklySnapshot model
  migrations/                      # + new migration for schema changes

src/lib/gamification/
  types.ts                         # + DeltaQuestCondition type, QuestConditionUnion
  quest-evaluator.ts               # + evaluateDeltaCondition(), countCurrentForDelta()
  quest-service.ts                 # + WEEKLY handling in checkQuestsForUser(), klasse filtering
  seed-quests.ts                   # + class-specific daily quests, weekly quests (bump SEED_VERSION)
  weekly-snapshot.ts               # NEW: createWeeklySnapshots(), getSnapshot()

src/lib/queue/
  queues.ts                        # + registerWeeklySnapshotCron()
  processors/gamification.processor.ts  # + handleWeeklySnapshot() job

src/app/api/gamification/
  dashboard/route.ts               # Refactor to return grouped quests by type
  special-quests/route.ts          # NEW: GET (list) + POST (create) for admin
  special-quests/[id]/route.ts     # NEW: PATCH + DELETE for admin

src/components/gamification/
  quest-widget.tsx                 # Refactor: grouped sections with headers
  quest-section.tsx                # NEW: reusable section renderer

src/components/einstellungen/
  gamification-tab.tsx             # Extend: add Special Quest CRUD section
  special-quest-form.tsx           # NEW: create/edit form with preset templates
```

### Pattern 1: Klasse-Filtered Quest Loading
**What:** Add `klasse` nullable field to Quest model. In `checkQuestsForUser()` and the dashboard API, filter quests where `klasse` is null (universal) OR matches the user's SpielKlasse.
**When to use:** Every quest query (service, dashboard, nightly safety net).
**Example:**
```typescript
// In quest-service.ts checkQuestsForUser()
const profile = await getOrCreateGameProfile(userId, user.role);
const userKlasse = profile.klasse; // SpielKlasse from GameProfile

// Load quests filtered by type AND klasse
const quests = await prisma.quest.findMany({
  where: {
    typ: questType,
    aktiv: true,
    OR: [
      { klasse: null },          // Universal quests
      { klasse: userKlasse },    // Class-specific quests
    ],
    // For SPECIAL: also filter by date range
    ...(questType === "SPECIAL" ? {
      startDatum: { lte: new Date() },
      endDatum: { gte: new Date() },
    } : {}),
  },
  orderBy: { sortierung: "asc" },
});
```

### Pattern 2: Delta/Ratio QuestCondition Extension
**What:** A new condition `type: "delta"` in the QuestCondition DSL that compares a snapshot baseline against current count.
**When to use:** Weekly quests with aggregate goals like "reduce open tickets by 20%".
**Example:**
```typescript
// Extended QuestCondition union type
interface BaseQuestCondition {
  model: QuestModel;
  where: Record<string, string | boolean>;
  dateField: string;
  userField: string | null;
  period: QuestPeriod;
}

interface CountCondition extends BaseQuestCondition {
  type: "count";    // or undefined for backward compat
  count: number;
}

interface DeltaCondition extends BaseQuestCondition {
  type: "delta";
  direction: "decrease" | "increase";
  percent: number;  // e.g. 20 for "reduce by 20%"
}

type QuestConditionUnion = CountCondition | DeltaCondition;

// Delta evaluator
async function evaluateDeltaCondition(
  condition: DeltaCondition,
  userId: string,
): Promise<{ current: number; target: number; completed: boolean }> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  // Get baseline from WeeklySnapshot
  const snapshot = await prisma.weeklySnapshot.findFirst({
    where: {
      model: condition.model,
      weekStart: weekStart,
      userId: condition.userField ? userId : null,
    },
  });

  if (!snapshot) {
    return { current: 0, target: 0, completed: false };
  }

  const baseline = snapshot.count;
  const currentCount = await countForModel(condition.model, buildCurrentWhere(condition, userId));

  if (condition.direction === "decrease") {
    const targetCount = Math.floor(baseline * (1 - condition.percent / 100));
    return {
      current: Math.max(0, baseline - currentCount),
      target: Math.max(0, baseline - targetCount),
      completed: currentCount <= targetCount,
    };
  }

  // "increase" direction
  const targetCount = Math.ceil(baseline * (1 + condition.percent / 100));
  return {
    current: currentCount - baseline,
    target: targetCount - baseline,
    completed: currentCount >= targetCount,
  };
}
```

### Pattern 3: Weekly Snapshot Cron
**What:** Monday 00:00 cron creates WeeklySnapshot records for all quest-relevant models. These serve as baselines for delta conditions.
**When to use:** Registered at worker startup alongside existing gamification crons.
**Example:**
```typescript
// In queues.ts
export async function registerWeeklySnapshotCron(): Promise<void> {
  await gamificationQueue.upsertJobScheduler(
    "gamification-weekly-snapshot",
    { pattern: "0 0 * * 1", tz: "Europe/Berlin" },  // Monday 00:00
    {
      name: "weekly-snapshot",
      data: {},
      opts: { removeOnComplete: { count: 10 }, removeOnFail: { count: 10 } },
    }
  );
}

// In gamification.processor.ts handleWeeklySnapshot()
async function handleWeeklySnapshot(): Promise<void> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  // Snapshot open Tickets per user
  const ticketCounts = await prisma.ticket.groupBy({
    by: ["verantwortlichId"],
    where: { status: "OFFEN" },
    _count: { id: true },
  });

  for (const entry of ticketCounts) {
    if (!entry.verantwortlichId) continue;
    await prisma.weeklySnapshot.upsert({
      where: {
        model_weekStart_userId: {
          model: "Ticket",
          weekStart,
          userId: entry.verantwortlichId,
        },
      },
      create: {
        model: "Ticket",
        weekStart,
        userId: entry.verantwortlichId,
        count: entry._count.id,
      },
      update: { count: entry._count.id },
    });
  }

  // Add more model snapshots as needed for weekly quest conditions
}
```

### Pattern 4: Grouped Dashboard API Response
**What:** Dashboard API returns quests grouped by type instead of a flat array.
**When to use:** Required for the widget to render sections.
**Example:**
```typescript
// API response shape
return NextResponse.json({
  profile: { /* same as before */ },
  quests: {
    daily: questResults.filter(q => q.typ === "DAILY"),
    weekly: questResults.filter(q => q.typ === "WEEKLY"),
    special: questResults.filter(q => q.typ === "SPECIAL"),
  },
});
```

### Pattern 5: Special Quest Preset Templates
**What:** Admin selects from preset condition templates; each template maps to a QuestCondition JSON object. Admin only sets the target count -- never writes raw JSON.
**When to use:** Special Quest CRUD form.
**Example:**
```typescript
interface ConditionTemplate {
  id: string;
  label: string;           // German display name
  description: string;     // Brief explanation for admin
  condition: Omit<QuestCondition, "count">;  // Everything except target count
}

const CONDITION_TEMPLATES: ConditionTemplate[] = [
  {
    id: "fristen-erledigen",
    label: "Fristen erledigen",
    description: "Anzahl erledigter Fristen im Zeitraum",
    condition: {
      type: "count",
      model: "KalenderEintrag",
      where: { erledigt: true, typ: "FRIST" },
      dateField: "erledigtAm",
      userField: "verantwortlichId",
      period: "today", // Overridden to match special quest date range
    },
  },
  {
    id: "tickets-bearbeiten",
    label: "Tickets bearbeiten",
    description: "Anzahl erledigter Wiedervorlagen im Zeitraum",
    condition: {
      type: "count",
      model: "Ticket",
      where: { status: "ERLEDIGT" },
      dateField: "erledigtAm",
      userField: "verantwortlichId",
      period: "today",
    },
  },
  {
    id: "rechnungen-erstellen",
    label: "Rechnungen erstellen",
    description: "Anzahl erstellter Rechnungen im Zeitraum",
    condition: {
      type: "count",
      model: "Rechnung",
      where: {},
      dateField: "createdAt",
      userField: null,
      period: "today",
    },
  },
  {
    id: "akten-aktualisieren",
    label: "Akten aktualisieren",
    description: "Anzahl Aktenaktivitaeten im Zeitraum",
    condition: {
      type: "count",
      model: "AktenActivity",
      where: {},
      dateField: "createdAt",
      userField: "userId",
      period: "today",
    },
  },
];
```

### Anti-Patterns to Avoid
- **Dynamic `prisma[model]` access:** Always use the explicit `countForModel()` switch dispatch. Dynamic access breaks TypeScript type checking and is the project's established pattern.
- **Raw JSON editing for conditions:** Admin must never write QuestCondition JSON manually. Use preset templates with only the `count` field exposed.
- **Storing delta baselines in the Quest record itself:** Baselines are user-specific and time-dependent. Use a separate `WeeklySnapshot` model with a compound unique key `(model, weekStart, userId)`.
- **Polling-based weekly reset:** Do not check "is it Monday?" on every request. Use a BullMQ repeatable cron at `0 0 * * 1` (Monday 00:00) for snapshot creation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Week start calculation | Custom date math | `startOfWeek(date, { weekStartsOn: 1 })` from date-fns | Already used in quest-evaluator.ts, handles DST correctly |
| Countdown days | Manual date diff | `differenceInDays(endDatum, new Date())` from date-fns | Handles timezone edge cases |
| Cron scheduling | `setInterval` or custom timer | BullMQ `upsertJobScheduler` with cron pattern | Already used for all crons, survives restarts, idempotent |
| Quest dedup | Custom locking | Prisma `@@unique` constraint on QuestCompletion | Already works for daily dedup, extend for weekly period |
| Role-based visibility | Custom middleware per route | `session.user.role === "ADMIN"` guard | Already used in all Einstellungen admin-only content |

**Key insight:** Every piece of infrastructure needed already exists. This phase is purely extending existing patterns -- no new paradigms.

## Common Pitfalls

### Pitfall 1: Weekly Completion Dedup Collision
**What goes wrong:** The existing `@@unique([userId, questId, completedAt])` on QuestCompletion uses `completedAt` (timestamp with auto-now). Two checks in the same second could create duplicates, but two checks across different days would always create separate records. For weekly quests, we want ONE completion per week, not per day.
**Why it happens:** Daily quests use `startOfDay` dedup check (`completedAt >= today`). If we keep the same pattern for weekly quests, a user could get awarded the same weekly quest 7 times (once per day).
**How to avoid:** For weekly quests, change the dedup check in `checkQuestsForUser()` to use `startOfWeek` instead of `startOfDay`:
```typescript
const dedupeStart = quest.typ === "WEEKLY"
  ? startOfWeek(new Date(), { weekStartsOn: 1 })
  : startOfDay(new Date());

const existing = await prisma.questCompletion.findFirst({
  where: { userId, questId: quest.id, completedAt: { gte: dedupeStart } },
});
```
**Warning signs:** A user getting weekly quest XP every day of the week.

### Pitfall 2: Missing Snapshot on First Week
**What goes wrong:** If the weekly snapshot cron hasn't run yet (first deployment, or worker was down on Monday), delta quests have no baseline and silently return `completed: false`.
**Why it happens:** `WeeklySnapshot.findFirst()` returns null, and the evaluator treats null as "can't evaluate".
**How to avoid:** In the snapshot creation, also run an immediate snapshot on first seed. Additionally, the evaluator should show a meaningful state (e.g., "Kein Ausgangswert" / "Baseline wird berechnet") when no snapshot exists, rather than just hiding progress.
**Warning signs:** Weekly delta quests always showing 0/0 progress.

### Pitfall 3: Backward Compatibility of QuestCondition Type
**What goes wrong:** Existing seeded quests have QuestCondition without a `type` field. Adding a required `type` field breaks backward compatibility.
**Why it happens:** The existing `QuestCondition` interface has no `type` discriminator.
**How to avoid:** Make `type` optional with a default of `"count"`. In the evaluator, treat `undefined` type as `"count"`:
```typescript
const conditionType = condition.type ?? "count";
if (conditionType === "delta") {
  return evaluateDeltaCondition(condition as DeltaCondition, userId);
}
return evaluateCountCondition(condition, userId);
```
**Warning signs:** TypeScript compilation errors or runtime crashes on existing quests.

### Pitfall 4: Special Quest Date Filtering Performance
**What goes wrong:** Loading all SPECIAL quests and then filtering by date in JS wastes DB round trips.
**Why it happens:** Filtering by `startDatum <= now AND endDatum >= now` should be in the Prisma `where` clause, not in post-fetch JS.
**How to avoid:** Apply date filtering in the Prisma query:
```typescript
where: {
  typ: "SPECIAL",
  aktiv: true,
  startDatum: { lte: new Date() },
  endDatum: { gte: new Date() },
}
```
**Warning signs:** Expired special quests appearing in the widget.

### Pitfall 5: Seed Version Bump Missing
**What goes wrong:** New class-specific quests don't appear after deployment because `SEED_VERSION` wasn't bumped.
**Why it happens:** The idempotent seeder checks `gamification.quests_seed_version` SystemSetting and skips if already at current version.
**How to avoid:** Bump `SEED_VERSION` from `"v0.4"` to `"v0.4.1"` (or similar) when adding new quests. Update existing quests' `klasse` field in the same seed.
**Warning signs:** Only original 5 quests appearing, new class-specific ones missing.

### Pitfall 6: Special Quest Period Mismatch
**What goes wrong:** Special quests have a custom date range (startDatum to endDatum), but the QuestCondition DSL uses `period: "today"`. The evaluator would only count records from today, not the full special quest period.
**Why it happens:** The period field in QuestCondition was designed for daily/weekly/monthly, not arbitrary date ranges.
**How to avoid:** For SPECIAL quests, override the period with a custom date range derived from the quest's `startDatum`/`endDatum`. Either add a `"custom"` period type or compute the date range outside the evaluator and pass it in.
**Warning signs:** Special quest progress resetting daily instead of accumulating over the campaign period.

## Code Examples

### Prisma Schema Changes
```prisma
model Quest {
  id              String        @id @default(cuid())
  name            String
  beschreibung    String?
  typ             QuestTyp      @default(DAILY)
  klasse          SpielKlasse?  // null = all classes, specific = class-exclusive
  bedingung       Json
  xpBelohnung     Int           @default(0)
  runenBelohnung  Int           @default(0)
  aktiv           Boolean       @default(true)
  sortierung      Int           @default(0)
  startDatum      DateTime?     // Only for SPECIAL: campaign start
  endDatum        DateTime?     // Only for SPECIAL: campaign end
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  completions     QuestCompletion[]

  @@unique([name, typ])
  @@index([typ, aktiv])
  @@index([typ, aktiv, klasse])  // Optimized for filtered queries
  @@map("quests")
}

model WeeklySnapshot {
  id        String   @id @default(cuid())
  model     String   // QuestModel name: "Ticket", "KalenderEintrag", etc.
  weekStart DateTime // Monday 00:00 of the snapshot week
  userId    String?  // null for global counts (e.g. Rechnung scoped by Akte)
  count     Int      // Baseline count at week start
  createdAt DateTime @default(now())

  @@unique([model, weekStart, userId])
  @@index([weekStart])
  @@map("weekly_snapshots")
}
```

### Class-Specific Daily Quest Seeds (Discretion: Recommended Names)
```typescript
// JURIST (ANWALT) quests -- Fristen and legal work focused
{ name: "Die Siegel des Tages", klasse: "JURIST", bedingung: { model: "KalenderEintrag", where: { erledigt: true, typ: "FRIST" }, ... } },
{ name: "Die Chroniken entwirren", klasse: "JURIST", bedingung: { model: "Ticket", ... } },
{ name: "Ordnung im Skriptorium", klasse: "JURIST", bedingung: { model: "AktenActivity", ... } },

// SCHREIBER (SACHBEARBEITER) quests -- billing and document focused
{ name: "Praegung der Muenzen", klasse: "SCHREIBER", bedingung: { model: "Rechnung", ... } },
{ name: "Bote der Klarheit", klasse: "SCHREIBER", bedingung: { model: "Ticket", ... } },
{ name: "Schriftrolle verfassen", klasse: "SCHREIBER", bedingung: { model: "AktenActivity", ... } },

// WAECHTER (SEKRETARIAT) quests -- calendar and organization focused
{ name: "Wacht am Kalender", klasse: "WAECHTER", bedingung: { model: "KalenderEintrag", where: { erledigt: true }, ... } },
{ name: "Torhueter der Ordnung", klasse: "WAECHTER", bedingung: { model: "Ticket", ... } },
{ name: "Inventar der Archive", klasse: "WAECHTER", bedingung: { model: "AktenActivity", ... } },

// QUARTIERMEISTER (ADMIN) quests -- oversight and management focused
{ name: "Inspektion der Festung", klasse: "QUARTIERMEISTER", bedingung: { model: "AktenActivity", ... } },
{ name: "Versiegelung der Buendnisse", klasse: "QUARTIERMEISTER", bedingung: { model: "Ticket", ... } },
{ name: "Tributeinzug", klasse: "QUARTIERMEISTER", bedingung: { model: "Rechnung", ... } },
```

### Widget Section Rendering
```tsx
// quest-widget.tsx refactored structure
<GlassCard className="p-0">
  {/* Header: unchanged */}
  <div className="px-5 py-4 border-b border-[var(--glass-border-color)]">
    {/* Level, streak, runen, XP bar */}
  </div>

  {/* Daily section */}
  {quests.daily.length > 0 && (
    <QuestSection title="Tagesquests" quests={quests.daily} />
  )}

  {/* Weekly section */}
  {quests.weekly.length > 0 && (
    <QuestSection title="Wochenquests" quests={quests.weekly} />
  )}

  {/* Special section with amber accent */}
  {quests.special.length > 0 && (
    <div className="border-l-2 border-amber-500/60 ml-2">
      <QuestSection
        title="Special"
        quests={quests.special}
        showCountdown
      />
    </div>
  )}
</GlassCard>

// QuestSection component
function QuestSection({ title, quests, showCountdown }: Props) {
  return (
    <div className="px-2 py-2">
      <div className="px-3 py-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </span>
      </div>
      {quests.map((quest) => (
        <QuestRow key={quest.id} quest={quest} showCountdown={showCountdown} />
      ))}
    </div>
  );
}
```

### Special Quest CRUD API
```typescript
// POST /api/gamification/special-quests
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const body = await req.json();
  const { name, beschreibung, templateId, count, xpBelohnung, runenBelohnung,
          startDatum, endDatum, targetKlassen } = body;

  // Build condition from template
  const template = CONDITION_TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    return NextResponse.json({ error: "Unbekannte Vorlage" }, { status: 400 });
  }

  const quest = await prisma.quest.create({
    data: {
      name,
      beschreibung,
      typ: "SPECIAL",
      klasse: targetKlassen === "ALL" ? null : targetKlassen,
      bedingung: { ...template.condition, count },
      xpBelohnung,
      runenBelohnung,
      startDatum: new Date(startDatum),
      endDatum: new Date(endDatum),
      aktiv: true,
      sortierung: 0,
    },
  });

  return NextResponse.json(quest, { status: 201 });
}
```

### Weekly Completion Dedup
```typescript
// In checkQuestsForUser -- type-aware dedup window
function getDedupeStart(questTyp: QuestTyp): Date {
  switch (questTyp) {
    case "WEEKLY":
      return startOfWeek(new Date(), { weekStartsOn: 1 });
    case "DAILY":
    case "SPECIAL":
    default:
      return startOfDay(new Date());
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat quest list (5 daily) | Type-grouped sections (daily/weekly/special) | Phase 37 | Widget needs refactor, API response shape changes |
| No role filtering | klasse-based filtering with null=universal | Phase 37 | All quest queries must include klasse OR condition |
| Static QuestCondition (count only) | Union type with count + delta discriminator | Phase 37 | Evaluator needs branching, backward compat via optional type field |

**Deprecated/outdated:**
- The existing `handleDailyReset()` is a no-op placeholder. Phase 37 should NOT repurpose it for weekly logic -- keep it as-is and add a separate `handleWeeklySnapshot()` job name.

## Open Questions

1. **Special Quest Period Evaluation Strategy**
   - What we know: Special quests have startDatum/endDatum (arbitrary range), but QuestCondition.period is `"today" | "thisWeek" | "thisMonth"`.
   - What's unclear: Should special quests evaluate cumulative progress over the entire campaign, or use the same daily evaluation with campaign-scoped dedup?
   - Recommendation: Add a `"campaign"` period type for special quests. The evaluator would use the quest's startDatum/endDatum as the date range instead of computing from `getDateRange()`. This makes special quest progress cumulative over the campaign. Dedup uses startDatum as the dedup window start (one completion per campaign).

2. **Snapshot Scope for Non-User-Scoped Models**
   - What we know: `Rechnung` has no direct `userField` -- it's scoped via the `Akte` relation. The existing evaluator handles this with a special case.
   - What's unclear: How should weekly snapshots work for Rechnung? Per-user via Akte relation, or global?
   - Recommendation: For the initial implementation, limit delta conditions to user-scoped models (Ticket, KalenderEintrag) where `userId` is straightforward. If Rechnung delta quests are needed, add a global snapshot (userId=null) with total count.

3. **Existing Quest Reassignment**
   - What we know: The current 5 daily quests overlap across roles (e.g., "Erledige 3 Fristen" could be for JURIST or WAECHTER).
   - What's unclear: Should existing quests be reassigned to a specific klasse, or should some remain universal (klasse=null)?
   - Recommendation: Keep 0-2 universal quests that all roles naturally encounter (e.g., AktenActivity), and reassign the rest to their natural class. The seed bump handles the migration. Exact assignment is in Claude's Discretion.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/lib/gamification/quest-service.ts` -- current checkQuestsForUser() flow
- Codebase analysis: `src/lib/gamification/quest-evaluator.ts` -- current QuestCondition DSL and evaluator
- Codebase analysis: `src/lib/gamification/seed-quests.ts` -- current seed pattern with version guard
- Codebase analysis: `src/lib/gamification/types.ts` -- QuestCondition, QuestModel, QuestPeriod, roleToKlasse
- Codebase analysis: `src/components/gamification/quest-widget.tsx` -- current flat quest list rendering
- Codebase analysis: `src/app/api/gamification/dashboard/route.ts` -- current API response shape
- Codebase analysis: `src/lib/queue/queues.ts` -- BullMQ cron registration pattern
- Codebase analysis: `src/lib/queue/processors/gamification.processor.ts` -- job processor dispatch
- Codebase analysis: `src/components/einstellungen/gamification-tab.tsx` -- existing admin Gamification UI
- Codebase analysis: `src/app/(dashboard)/einstellungen/page.tsx` -- Einstellungen tab structure
- Codebase analysis: `prisma/schema.prisma` -- Quest, QuestCompletion, UserGameProfile, SpielKlasse, QuestTyp

### Secondary (MEDIUM confidence)
- Project decisions: `37-CONTEXT.md` -- user-locked implementation decisions
- Project state: `.planning/STATE.md` -- accumulated context and patterns

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- entirely existing libraries, no new dependencies
- Architecture: HIGH -- extending well-understood patterns with verified code references
- Pitfalls: HIGH -- derived from direct codebase analysis of existing dedup, evaluation, and seeding logic

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (30 days -- stable domain, no external API dependencies)
