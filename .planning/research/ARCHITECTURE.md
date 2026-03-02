# Architecture Research: v0.4 Gamification + Quick Wins Integration

**Domain:** Gamification system (Quest Engine, XP/Level, Bossfight, Item Shop, Team Dashboard) + UX Quick Wins (Clickable KPIs, Empty States, OCR Recovery) -- integration into existing AI-Lawyer architecture
**Researched:** 2026-03-02
**Confidence:** HIGH (codebase directly inspected; all integration points verified against existing schema, workers, Socket.IO, dashboard page, Akte detail page, and established patterns)

---

## Executive Summary

The v0.4 milestone adds two orthogonal feature sets: (1) a gamification system that transforms existing Kanzlei workflows into trackable quests with XP/Runen rewards, and (2) targeted UX improvements to the Akte detail page. The key architectural insight is that **gamification is a read-heavy observation layer on top of existing business events** -- quest completion detection reads from KalenderEintrag, Rechnung, Zeiterfassung, and AktenActivity, but never modifies them. This means the gamification engine can be built as a standalone subsystem with clear integration hooks rather than invasive changes to core business logic.

The Quick Wins are surgical UI changes to existing components (StatMini, OcrStatusBadge, empty state renders) with no schema changes required.

---

## Existing Architecture Inventory (Relevant Surfaces)

### Dashboard Page (`src/app/(dashboard)/dashboard/page.tsx`)
- **Server component** fetching stats via Prisma in `Promise.all`
- Uses `GlassKpiCard` for stats grid (4 cards: Offene Akten, Fristen heute, Ueberfaellige Fristen, Erledigt 30 Tage)
- Uses `GlassPanel` wrapping `Tagesuebersicht` component
- Uses `GlassCard` for "Zuletzt bearbeitete Akten" and "Anstehende Fristen & Termine"
- RBAC-scoped via `buildAkteAccessFilter(userId, userRole)`
- Layout: `space-y-6` with sections stacked vertically

### Akte Detail Page (`src/app/(dashboard)/akten/[id]/page.tsx`)
- **Server component** loading full Akte with includes
- `StatMini` grid (6 cards: Beteiligte, Dokumente, Termine/Fristen, E-Mails, Zeiterfassung, Nachrichten) -- NOT clickable, purely decorative `<div>`
- `AkteDetailTabs` with 6 tabs: Aktivitaeten (default), Dokumente, Termine & Fristen, Finanzen, Falldaten, Nachrichten
- Tab state managed via `useState("feed")`, controlled tab switching with unsaved-changes guard
- `_count` relation used for StatMini values
- `chatNachrichten` count is stale (references old model, not v0.3 Channel/Message)

### GlassKpiCard (`src/components/ui/glass-kpi-card.tsx`)
- Client component with Motion/React count-up animation
- Props: `title, value, icon, color, className, skeleton`
- Renders as `<div className="glass-card">` -- no click handler, no `onClick` prop, no `href`
- Color variants: blue, amber, rose, emerald

### OcrStatusBadge (`src/components/dokumente/ocr-status-badge.tsx`)
- Client component showing OCR processing state
- FEHLGESCHLAGEN state: tiny Badge + small RotateCcw icon button for retry
- Retry calls `POST /api/dokumente/{dokumentId}/ocr`
- No "Vision-Analyse" or "Manuell" fallback options exist

### AkteDetailTabs (`src/components/akten/akte-detail-tabs.tsx`)
- Client component, controlled Tabs from shadcn/ui
- `activeTab` state: can be set programmatically via `setActiveTab()`
- Currently no mechanism to set initial tab from URL or props (defaults to "feed")

### BullMQ Worker Infrastructure
- **17 queues** in `src/lib/queue/queues.ts`
- **Single worker.ts** with all processors, cron jobs registered at startup
- Cron schedule: scanner (01:00), gesetze-sync (02:00), akte-embedding (02:30), urteile-sync (03:00), frist-reminder (06:00), ai-briefing (07:00), ai-proactive (4h)
- Pattern for adding new cron: add Queue, add Worker, add `registerXxxJob()`, call in startup()

### Socket.IO Infrastructure
- Room conventions: `user:{userId}`, `role:{ROLE}`, `akte:{akteId}`, `mailbox:{kontoId}`, `channel:{channelId}`
- Redis emitter for worker-to-client push: `getSocketEmitter()`
- Existing notification event: `"notification"` with `{ type, title, message, data }`

### Prisma Schema (Relevant Models)
- **User**: `role: UserRole` (ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT), `id`, `name`, `aktiv`
- **KalenderEintrag**: `typ` (TERMIN, FRIST, WIEDERVORLAGE), `erledigt`, `erledigtAm`, `erledigungsgrund`, `verantwortlichId`
- **Rechnung**: `status` (ENTWURF, GESTELLT, BEZAHLT...), `akteId`
- **Zeiterfassung**: `userId`, `akteId`, `dauer`, `beschreibung`, `kategorie`, `abgerechnet`
- **Akte**: `status`, `anwaltId`, `sachbearbeiterId`, `geaendert`
- **AktenActivity**: `typ` (8 types), per-Akte timeline

---

## Gamification Architecture

### Architecture Decision: Event-Sourced Quest Evaluation with Nightly + On-Demand Dual Mode

Quest completion should NOT be evaluated by modifying existing business operations (Frist-erledigung, Rechnung-erstellen, etc.). Instead, quest conditions are evaluated by **querying existing data** -- counting completed Fristen, created Rechnungen, and updated Akten for the current day/week.

Two evaluation triggers:
1. **On-demand**: After a user completes a business action (e.g., marks Frist as erledigt), the API response includes a lightweight quest-check that updates progress
2. **Nightly cron**: Batch evaluates all users' daily quest completion at 23:55, handles edge cases where on-demand checks were missed

### New Prisma Models

```prisma
// ─── Gamification Enums ──────────────────────────────────────────────────────

enum Klasse {
  JURIST           // ANWALT role
  SCHREIBER        // SACHBEARBEITER role
  WAECHTER         // SEKRETARIAT role
  QUARTIERMEISTER  // ADMIN role
}

enum QuestTyp {
  DAILY
  WEEKLY
  SPECIAL
}

enum ItemRaritaet {
  COMMON
  RARE
  EPIC
  LEGENDARY
}

enum ItemTyp {
  RELIKT      // Cosmetic: avatar frame, banner, title
  ARTEFAKT    // Comfort perk: focus timer, template shortcut
  TROPHAEE    // Prestige: earned only, never purchasable
}

enum BossfightPhase {
  PHASE_1     // 100-75% HP
  PHASE_2     // 75-50% HP
  PHASE_3     // 50-25% HP
  PHASE_4     // 25-0% HP (finale)
}

// ─── Gamification Models ─────────────────────────────────────────────────────

model UserGameProfile {
  id             String    @id @default(cuid())
  userId         String    @unique
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  xp             Int       @default(0)
  level          Int       @default(1)
  runen          Int       @default(0)
  streakTage     Int       @default(0)
  streakAktiv    Boolean   @default(false)
  letzteQuestAm  DateTime?
  klasse         Klasse
  impactScore    Int       @default(0)   // Cumulative kanzlei contribution

  completions    QuestCompletion[]
  inventar       InventarItem[]
  bossfightDmg   BossfightDamage[]
  badges         UserBadge[]

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([level])
  @@index([klasse])
  @@map("user_game_profiles")
}

model Quest {
  id             String    @id @default(cuid())
  name           String                           // Fantasy name: "Die Siegel des Tages"
  beschreibung   String    @db.Text               // What user needs to do
  typ            QuestTyp
  klasse         Klasse?                           // null = available to all classes
  xpReward       Int
  runenReward    Int
  bedingung      Json                              // Machine-readable condition (see below)
  aktiv          Boolean   @default(true)
  sortierung     Int       @default(0)             // Display order
  // Special quest campaign fields
  gueltigVon     DateTime?                         // Campaign start (null = always)
  gueltigBis     DateTime?                         // Campaign end (null = always)

  completions    QuestCompletion[]

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([typ, aktiv])
  @@index([klasse])
  @@map("quests")
}

model QuestCompletion {
  id              String   @id @default(cuid())
  profileId       String
  profile         UserGameProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  questId         String
  quest           Quest    @relation(fields: [questId], references: [id], onDelete: Cascade)
  abgeschlossenAm DateTime @default(now())
  verifiziert     Boolean  @default(true)          // Set to false on audit
  auditFlag       Boolean  @default(false)          // Flagged for random audit
  auditErgebnis   String?                           // BESTAETIGT | ZURUECKGENOMMEN

  @@index([profileId, abgeschlossenAm])
  @@index([questId])
  @@map("quest_completions")
}

model Bossfight {
  id               String    @id @default(cuid())
  name             String                           // "Der Wustwurm"
  beschreibung     String?   @db.Text
  maxHp            Int                              // Initial backlog count
  aktuelleHp       Int                              // Current HP (decrements)
  phase            BossfightPhase @default(PHASE_1)
  aktiv            Boolean   @default(true)
  schwellenwert    Int       @default(50)           // Backlog threshold to trigger
  // Campaign window
  gestartetAm      DateTime  @default(now())
  abgeschlossenAm  DateTime?

  damage           BossfightDamage[]

  @@map("bossfights")
}

model BossfightDamage {
  id              String          @id @default(cuid())
  bossfightId     String
  bossfight       Bossfight       @relation(fields: [bossfightId], references: [id], onDelete: Cascade)
  profileId       String
  profile         UserGameProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  schaden         Int                               // Damage dealt this action
  quelle          String                            // What caused damage: "wiedervorlage_erledigt"
  erzieltAm       DateTime @default(now())

  @@index([bossfightId, erzieltAm])
  @@index([profileId])
  @@map("bossfight_damage")
}

model ShopItem {
  id             String       @id @default(cuid())
  name           String
  beschreibung   String?      @db.Text
  typ            ItemTyp
  raritaet       ItemRaritaet @default(COMMON)
  runenPreis     Int                               // 0 for TROPHAEE (earned, not bought)
  levelMin       Int          @default(1)           // Minimum level to purchase
  badgeVoraussetzung String?                        // Badge ID required (for Legendary items)
  meta           Json?                              // Item-specific config (e.g., avatar frame URL)
  vorrat         Int?                               // null = unlimited, else finite stock
  aktiv          Boolean      @default(true)

  inventar       InventarItem[]

  createdAt      DateTime     @default(now())

  @@index([typ, aktiv])
  @@map("shop_items")
}

model InventarItem {
  id             String          @id @default(cuid())
  profileId      String
  profile        UserGameProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  itemId         String
  item           ShopItem        @relation(fields: [itemId], references: [id])
  erworbenAm     DateTime        @default(now())
  ausgeruestet   Boolean         @default(false)   // Currently equipped (cosmetics)

  @@unique([profileId, itemId])                    // One of each item per user
  @@map("inventar_items")
}

model Badge {
  id             String       @id @default(cuid())
  name           String       @unique              // "fristenwaechter", "backlog_halbiert"
  anzeigeName    String                             // "Fristenwachter"
  beschreibung   String       @db.Text
  iconUrl        String?                            // Badge icon path
  bedingung      Json                               // Machine-readable unlock condition

  userBadges     UserBadge[]

  @@map("badges")
}

model UserBadge {
  id             String          @id @default(cuid())
  profileId      String
  profile        UserGameProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  badgeId        String
  badge          Badge           @relation(fields: [badgeId], references: [id])
  erhaltenAm     DateTime        @default(now())

  @@unique([profileId, badgeId])
  @@map("user_badges")
}
```

### Quest Condition Schema (JSON bedingung)

Quest conditions are stored as machine-readable JSON that the quest evaluator interprets. This avoids hardcoding quest logic while keeping evaluation deterministic (no LLM).

```typescript
// Types for Quest.bedingung JSON
interface QuestCondition {
  /** What data source to count */
  source: "fristen" | "wiedervorlagen" | "rechnungen" | "akten" | "zeiterfassungen" | "dokumente" | "emails";
  /** What to count */
  metric: "erledigt_heute" | "erstellt_heute" | "aktualisiert_heute" | "abgerechnet_heute" | "beantwortet_heute";
  /** Minimum count to satisfy */
  threshold: number;
  /** Additional filters */
  filters?: {
    requireVermerk?: boolean;     // Must have erledigungsgrund
    requireNextStep?: boolean;    // Must set next Wiedervorlage
    requireStatusChange?: boolean;
    typ?: string;                 // e.g., "FRIST" or "WIEDERVORLAGE"
  };
}
```

Example for "Die Siegel des Tages" (all today's Fristen checked + Vermerk):

```json
{
  "source": "fristen",
  "metric": "erledigt_heute",
  "threshold": -1,
  "filters": {
    "requireVermerk": true,
    "typ": "FRIST"
  }
}
```

`threshold: -1` means "ALL items due today" -- the evaluator counts how many Fristen are due today for this user and checks that all are erledigt with a Vermerk.

### Quest Evaluation Engine

```
src/lib/gamification/
  quest-evaluator.ts      -- Core: evaluateQuestForUser(userId, quest) -> QuestProgress
  xp-calculator.ts        -- Level curve: xpForLevel(n), levelForXp(xp)
  streak-manager.ts       -- Streak logic: checkStreak(profile), breakStreak(), pauseStreak()
  bossfight-engine.ts     -- HP calculation, phase transitions, damage recording
  runen-limiter.ts        -- Daily Runen cap (40/day from Wiedervorlagen)
  audit-sampler.ts        -- Random 1-3% audit selection
  seed-quests.ts          -- Seed initial 5 Daily + 3 Weekly quests
  seed-badges.ts          -- Seed initial badge definitions
  types.ts                -- QuestCondition, QuestProgress, LevelInfo types
```

### Quest Evaluation Flow

```
User marks Frist as erledigt
  -> PATCH /api/kalender/{id} (existing endpoint)
  -> After successful update:
     -> Call checkQuestsForUser(userId) (lightweight, sync)
        -> Load today's active quests for user's Klasse
        -> For each incomplete quest:
           -> evaluateQuestCondition(userId, quest.bedingung)
              -> Prisma COUNT query against relevant table
              -> Compare count vs threshold
           -> If newly completed:
              -> Create QuestCompletion record
              -> Award XP + Runen (with daily cap check)
              -> Update streak
              -> Check bossfight damage
              -> Emit Socket.IO event to user:{userId}
                 -> "game:quest-complete" { questId, xp, runen }
              -> Emit to role:* room if bossfight HP threshold crossed
                 -> "game:bossfight-phase" { phase, hp }
  -> Return original API response (quest check is fire-and-forget)
```

### Integration Points with Existing API Routes

Quest evaluation hooks into existing endpoints WITHOUT modifying their core logic. The hook is a post-action side-effect:

| Existing Endpoint | Quest Source | Hook Location |
|---|---|---|
| `PATCH /api/kalender/{id}` (erledigt=true) | fristen, wiedervorlagen | After successful DB update |
| `POST /api/finanzen/rechnungen` | rechnungen | After successful creation |
| `PATCH /api/akten/{id}` (status change, notizen update) | akten | After successful update |
| `POST /api/finanzen/zeiterfassung` | zeiterfassungen | After successful creation |
| `POST /api/channels/{id}/messages` | emails/messages answered | After successful creation |

**Implementation pattern**: A `withQuestCheck(userId)` wrapper function called at the end of each API route handler. This is a single `await` call that runs the evaluator. If it fails, it logs the error but does NOT fail the parent API response (non-blocking, best-effort).

```typescript
// Usage in API route:
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // ... existing logic ...
  const updated = await prisma.kalenderEintrag.update({ ... });

  // Fire-and-forget quest check (non-blocking)
  checkQuestsForUser(session.user.id).catch(err =>
    log.warn({ err, userId: session.user.id }, "Quest check failed (non-fatal)")
  );

  return NextResponse.json(updated);
}
```

### Bossfight Integration

The Bossfight tracks backlog as a single entity. "Backlog" = all open Wiedervorlagen across all Akten.

```
Bossfight HP Calculation:
  maxHp = count of WIEDERVORLAGE WHERE erledigt=false at bossfight start
  aktuelleHp = current count of WIEDERVORLAGE WHERE erledigt=false
  schaden = maxHp - aktuelleHp (total damage dealt)
  phase = f(aktuelleHp / maxHp)

Bossfight creation:
  Admin clicks "Bossfight starten" in Team Dashboard
  OR automatic when Wiedervorlagen backlog > schwellenwert (checked by nightly scanner)

Bossfight damage per action:
  User marks Wiedervorlage as erledigt (qualifiziert)
  -> BossfightDamage record: { schaden: 1, quelle: "wiedervorlage_erledigt" }
  -> Bossfight.aktuelleHp -= 1
  -> If phase threshold crossed -> emit "game:bossfight-phase" to all users
```

### Streak System

Streak evaluation runs at quest-check time:

```
checkStreak(profile):
  if (letzteQuestAm is today) -> no change (already counted)
  if (letzteQuestAm is yesterday AND all Kernquests completed today):
    streakTage += 1
    streakAktiv = true
    Apply Runen multiplier: 3d=1.1x, 7d=1.25x, 14d=1.5x
  if (letzteQuestAm is before yesterday):
    Check for UrlaubZeitraum overlap
    if (user was on Urlaub) -> pause, no break
    else -> streakTage = 0, streakAktiv = false
```

The `UrlaubZeitraum` model already exists in the schema and stores user vacation periods. Streak pauses during vacations automatically.

### Runen Daily Cap

```typescript
const DAILY_RUNEN_CAP_WIEDERVORLAGEN = 40;

async function awardRunen(profileId: string, amount: number, quelle: string): Promise<number> {
  if (quelle === "wiedervorlage") {
    const todayEarned = await prisma.questCompletion.aggregate({
      where: { profileId, abgeschlossenAm: { gte: startOfDay() } },
      _sum: { /* join quest.runenReward where source is wiedervorlagen */ },
    });
    const remaining = DAILY_RUNEN_CAP_WIEDERVORLAGEN - (todayEarned._sum ?? 0);
    amount = Math.min(amount, Math.max(0, remaining));
  }
  // Award capped amount
  await prisma.userGameProfile.update({
    where: { id: profileId },
    data: { runen: { increment: amount } },
  });
  return amount;
}
```

### Level Curve

```typescript
// Quadratic XP curve: level N requires N^2 * 100 XP total
function xpForLevel(level: number): number {
  return level * level * 100;
}

function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100));
}

// Level 1:  100 XP
// Level 5:  2,500 XP
// Level 10: 10,000 XP
// Level 20: 40,000 XP
// Level 50: 250,000 XP
```

### Anti-Abuse: Random Audits

```
After QuestCompletion is created:
  if (Math.random() < 0.02):  // 2% chance
    Set auditFlag = true
    Emit Socket.IO "game:audit" to user:{userId}
    UI shows: "Stichprobe: Erledigung bestaetigen? Vermerk vorhanden?"
    User confirms -> verifiziert = true
    User denies / no response in 24h -> verifiziert = false, revert XP + Runen
```

### RBAC-to-Klasse Mapping

Automatic Klasse assignment from existing UserRole:

```typescript
function roleToKlasse(role: UserRole): Klasse {
  switch (role) {
    case "ANWALT": return "JURIST";
    case "SACHBEARBEITER": return "SCHREIBER";
    case "SEKRETARIAT": return "WAECHTER";
    case "ADMIN": return "QUARTIERMEISTER";
  }
}
```

UserGameProfile is auto-created on first login (or via seed) with Klasse derived from role.

### Nightly Gamification Cron

A new `gamification-eval` cron runs at 23:55:

```
registerGamificationEvalJob("55 23 * * *"):
  For each active user:
    Evaluate all daily quests not yet completed
    Finalize streak for the day
    Update bossfight HP from actual Wiedervorlagen count (consistency check)
    Generate impact score delta
```

This is a safety net for missed on-demand checks. It also handles the case where a user completes work via batch operations that bypass API hooks.

---

## Gamification New API Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/gamification/profile` | Current user's game profile (XP, level, runen, streak) |
| GET | `/api/gamification/quests` | Today's quests with progress for current user |
| GET | `/api/gamification/quests/{id}` | Single quest detail with completion status |
| GET | `/api/gamification/bossfight` | Active bossfight status (HP, phase, damage log) |
| POST | `/api/gamification/bossfight` | Admin: create new bossfight |
| GET | `/api/gamification/shop` | Available shop items |
| POST | `/api/gamification/shop/{id}/purchase` | Purchase item with Runen |
| GET | `/api/gamification/leaderboard` | Team leaderboard (XP, level, streak, impact) |
| POST | `/api/gamification/audit/{id}/confirm` | Confirm audit check |
| POST | `/api/gamification/audit/{id}/deny` | Deny audit check (revert points) |
| GET | `/api/gamification/team` | Admin: team dashboard data |
| GET | `/api/gamification/badges` | Available badges with unlock status |

---

## Gamification New UI Components

| Component | Location | Purpose |
|---|---|---|
| `QuestWidget` | Dashboard page, below KPI cards | Today's quests, progress bars, 1-click deep-links |
| `XpBar` | Dashboard sidebar or QuestWidget | Current level + XP progress to next level |
| `RunenCounter` | Dashboard header or QuestWidget | Current Runen balance |
| `StreakBadge` | QuestWidget | Flame icon + streak day count |
| `BossfightBanner` | Dashboard page, full-width | Boss name, HP bar, phase indicator, team damage |
| `BossfightDamageLog` | Bossfight detail page | Per-user damage contributions |
| `HeldenkartePage` | `/profil/held` (new page) | Avatar, class, level, badges, inventory |
| `ShopPage` | `/shop` (new page) | Item grid, Runen prices, rarity badges |
| `InventarPanel` | Profile/Heldenkarte page | Equipped items, item grid |
| `TeamDashboard` | `/admin/team` (new page) | Erfuellungsquote, backlog delta, bossfight damage per person |
| `AuditDialog` | Modal overlay on notification | "Erledigung bestaetigen?" with Yes/No |
| `QuestCompletionToast` | Global toast overlay | "+80 XP, +8 Runen" with animation |
| `LevelUpOverlay` | Global overlay (rare) | Level-up celebration animation |

### Dashboard Layout (Modified)

```
Current layout:
  [Welcome]
  [KPI Grid: 4 cards]
  [Tagesuebersicht]
  [2-col: Letzte Akten | Anstehende Fristen]

New layout:
  [Welcome]
  [KPI Grid: 4 cards]
  [QuestWidget: Today's quests + XP bar + streak + runen] <<< NEW
  [BossfightBanner (if active)]                            <<< NEW
  [Tagesuebersicht]
  [2-col: Letzte Akten | Anstehende Fristen]
```

QuestWidget is a new GlassCard inserted between KPI grid and Tagesuebersicht. Each quest item links to the relevant filtered view (e.g., "Fristen-Quest" links to `/kalender?filter=frist&status=offen`).

---

## Gamification Socket.IO Events

| Event | Direction | Room | Payload |
|---|---|---|---|
| `game:quest-complete` | server->client | `user:{userId}` | `{ questId, questName, xp, runen, streakBonus }` |
| `game:level-up` | server->client | `user:{userId}` | `{ newLevel, title }` |
| `game:bossfight-damage` | server->client | `role:*` (all) | `{ bossfightId, schaden, userName, aktuelleHp, phase }` |
| `game:bossfight-phase` | server->client | `role:*` (all) | `{ bossfightId, phase, aktuelleHp, maxHp }` |
| `game:bossfight-defeated` | server->client | `role:*` (all) | `{ bossfightId, name }` |
| `game:audit` | server->client | `user:{userId}` | `{ completionId, questName }` |
| `game:badge-earned` | server->client | `user:{userId}` | `{ badgeId, badgeName }` |

These use the existing Socket.IO infrastructure -- `getSocketEmitter()` from worker/API routes, delivered via existing `user:` and `role:` rooms. No new rooms needed.

---

## Quick Wins Architecture

### QW-1: Clickable KPI Cards (Akte Detail)

**Current**: `StatMini` renders as a `<div>` with icon + value + label.

**Change**: Make StatMini accept an optional `onClick` or `tabTarget` prop. When clicked, call `setActiveTab(tabTarget)` on the parent `AkteDetailTabs`.

**Integration challenge**: StatMini is rendered in the server component `AkteDetailPage`, but `setActiveTab` lives in the client component `AkteDetailTabs`. Solution: lift the StatMini grid into `AkteDetailTabs` as a client component, or pass a shared state setter via context/callback.

**Recommended approach**: Convert the stats grid section to a client component `AkteStatsGrid` that receives the counts as props and exposes an `onTabSelect` callback. The parent page passes counts from server-side query, and `AkteDetailTabs` accepts an `initialTab` prop that can be set by the stats grid.

Alternatively, simpler: use URL search params (`?tab=dokumente`) and read them in `AkteDetailTabs` to set initial tab. Each StatMini becomes an `<a href="?tab=dokumente">` which triggers a client-side navigation. This avoids lifting state and uses the URL as the source of truth.

```
StatMini clicks:
  Beteiligte    -> ?tab=feed (Beteiligte are in activity feed, or add dedicated tab)
  Dokumente     -> ?tab=dokumente
  Termine/Fristen -> ?tab=kalender
  E-Mails       -> /akten/{id}/emails (separate page already exists)
  Zeiterfassung -> ?tab=finanzen (Zeiterfassung is a sub-section of Finanzen tab)
  Nachrichten   -> ?tab=nachrichten
```

**Implementation**: Wrap StatMini in a Next.js `<Link>` or `<button>` with router.push. Read `searchParams.tab` in AkteDetailTabs `useEffect` to set initial active tab.

### QW-2: OCR Recovery Flow

**Current**: OcrStatusBadge shows a tiny retry icon for FEHLGESCHLAGEN state.

**Change**: Replace the mini badge+icon with an inline recovery banner component for FEHLGESCHLAGEN documents.

New component: `OcrRecoveryBanner`

```
+-----------------------------------------------------------+
| OCR fehlgeschlagen                                         |
| Der Text konnte nicht automatisch erkannt werden.         |
| [Erneut versuchen]  [Vision-Analyse]  [Manuell eingeben] |
+-----------------------------------------------------------+
```

- **Erneut versuchen**: Same as existing retry (`POST /api/dokumente/{id}/ocr`)
- **Vision-Analyse**: New endpoint `POST /api/dokumente/{id}/ocr-vision` -- sends page images to GPT-4o Vision via Vercel AI SDK, extracts text, stores as OCR result. Uses existing AI provider infrastructure.
- **Manuell eingeben**: Opens a text input modal. Saves to `Dokument.ocrText` (existing field). Sets `ocrStatus = ABGESCHLOSSEN`.

**New API route**: `POST /api/dokumente/{id}/ocr-vision`
- Extract PDF page images via Stirling-PDF `/api/v1/convert/pdf/img`
- Send images to cloud provider (GPT-4o Vision or Claude Vision) with prompt "Extract all text from this document image"
- Store result in `Dokument.ocrText`, set `ocrStatus = ABGESCHLOSSEN`
- Trigger embedding pipeline as if OCR completed normally

### QW-3: Empty States

**Current**: Various tabs show bare "Keine X vorhanden" text or empty white space.

**Change**: Create a reusable `EmptyState` component with icon, title, description, and optional CTA buttons.

```typescript
interface EmptyStateProps {
  icon: React.ElementType;      // Lucide icon
  title: string;                 // "Noch keine beA-Aktivitaeten"
  description: string;           // Explanatory text
  actions?: Array<{
    label: string;
    href?: string;               // Link target
    onClick?: () => void;        // Or click handler
    variant?: "default" | "outline";
  }>;
}
```

Apply to:
- beA tab: Shield icon, "Sobald Schriftsaetze ueber beA uebermittelt werden, erscheinen sie hier automatisch."
- E-Mails tab (0 veraktete): Mail icon, "E-Mails koennen direkt aus dem Posteingang zu dieser Akte hinzugefuegt werden." + CTA "E-Mail verfassen" + "Posteingang oeffnen"
- Dokumente tab (empty): FileText icon, "Laden Sie Dokumente hoch oder erstellen Sie neue aus Vorlagen." + CTA "Dokument hochladen"
- Kalender tab (empty): Calendar icon, "Legen Sie Fristen, Termine oder Wiedervorlagen an." + CTA "Eintrag erstellen"

### QW-4: "Nachrichten: 0" KPI-Card Fix

**Current**: StatMini shows `chatNachrichten` count from old model, always 0 since v0.3 switched to Channel/Message.

**Change**: Replace `_count.chatNachrichten` with a count of Messages in this Akte's Channel. Since the Channel is lazy-created, if no Channel exists the count is 0 and the label should read "Chat" instead of "Nachrichten".

```typescript
// In Akte detail page query, add:
const messageCount = await prisma.message.count({
  where: { channel: { akteId: id } },
});
```

Or rename StatMini label from "Nachrichten" to "Chat" and show the correct channel message count.

### QW-5: Zeiterfassung Description Visibility

**Current**: Unknown specifics on display, but the todo says dashes shown for empty categories and descriptions hidden.

**Change**:
- Replace `"—"` in category column with gray `"Keine Kategorie"` text
- Replace empty description with `"Beschreibung hinzufuegen"` link that opens inline edit
- Focus description field when creating new time entry

These are pure UI changes in `AkteZeiterfassungTab` component.

---

## Component Boundary Map

```
                        +------------------+
                        |   Next.js App    |
                        |   (App Router)   |
                        +--------+---------+
                                 |
              +---------+--------+--------+---------+
              |         |                 |         |
       +------+------+  |          +------+------+  |
       | Gamification |  |          | Quick Wins  |  |
       | API Routes   |  |          | (no new     |  |
       | /api/game/*  |  |          |  routes     |  |
       +------+------+  |          |  except     |  |
              |         |          |  ocr-vision) |  |
              v         v          +------+------+  |
       +------+------+  |                 |         |
       | Quest Engine|  |                 v         v
       | (evaluator, |  |          +------+------+------+
       |  streak,    |  |          | Modified UI        |
       |  bossfight, |  |          | Components:        |
       |  runen cap) |  |          | - StatMini (click) |
       +------+------+  |          | - OcrRecoveryBnr   |
              |         |          | - EmptyState       |
              v         v          | - AkteZeiterfTab   |
       +------+------+------+     +--------------------+
       | Prisma Models:     |
       | - UserGameProfile* |
       | - Quest*           |
       | - QuestCompletion* |
       | - Bossfight*       |
       | - BossfightDamage* |
       | - ShopItem*        |
       | - InventarItem*    |
       | - Badge*           |
       | - UserBadge*       |
       +------+------+------+
              |         |
              v         v
       +------+------+  +------+------+
       | Socket.IO   |  | BullMQ      |
       | Events      |  | gamification|
       | (existing   |  | -eval cron  |
       | rooms)      |  | (NEW queue) |
       +-------------+  +-------------+

       * = new Prisma models
```

---

## Relation Changes to Existing Models

### User Model (additions)

```prisma
model User {
  // ... existing fields ...

  // Phase 34: Gamification
  gameProfile      UserGameProfile?
}
```

Single addition: one-to-one relation to UserGameProfile. No other existing model changes for gamification.

### No Changes to Business Models

Critically, NO changes to KalenderEintrag, Rechnung, Zeiterfassung, Akte, or any other business model. The gamification layer reads from these models but does not modify their schema. This is a deliberate architectural boundary.

---

## Data Flow Summary

### Quest Completion Flow

```
[User Action] -> [Existing API Route] -> [DB Write] -> [checkQuestsForUser]
                                                              |
                                    +-------------------------+
                                    |
                            [Quest Evaluator]
                                    |
                    +---------------+---------------+
                    |               |               |
            [Prisma COUNT     [Streak Check]  [Bossfight
             queries on                        Damage Check]
             existing tables]
                    |               |               |
                    +-------+-------+-------+-------+
                            |
                    [Award XP + Runen]
                            |
                    [Socket.IO Events]
                            |
                    [Client UI Update]
```

### Bossfight HP Sync Flow

```
[Nightly Cron 23:55]
  -> Count all open Wiedervorlagen
  -> Compare with Bossfight.aktuelleHp
  -> If delta > 0: record damage, update HP
  -> If phase threshold crossed: emit phase event
  -> If HP == 0: mark bossfight completed, award Legendary trophy

[On-demand (Wiedervorlage erledigt)]
  -> Bossfight.aktuelleHp -= 1
  -> Record BossfightDamage
  -> Check phase transition
```

---

## Suggested Build Order

### Phase 1: Gamification Schema + Seed Data
**Rationale**: DB migration is the foundation. 9 new models, 5 new enums. Must run before any game logic.

1. Add enums (Klasse, QuestTyp, ItemRaritaet, ItemTyp, BossfightPhase)
2. Add models (UserGameProfile, Quest, QuestCompletion, Bossfight, BossfightDamage, ShopItem, InventarItem, Badge, UserBadge)
3. Add User.gameProfile relation
4. Run migration
5. Seed 5 Daily Quests + 3 Weekly Quests
6. Seed initial badges
7. Auto-create UserGameProfile for existing users (with Klasse from role)

### Phase 2: Quest Engine + XP/Level (Backend Only)
**Rationale**: Core game logic must work before any UI. Pure TypeScript, testable in isolation.

1. Quest evaluator: `evaluateQuestCondition(userId, bedingung)` -> boolean
2. XP calculator: level curve, award XP
3. Streak manager: check/break/pause
4. Runen limiter: daily cap enforcement
5. Audit sampler: random flag
6. `checkQuestsForUser()` orchestrator function
7. Hook into 5 existing API routes (Frist, Rechnung, Akte, Zeiterfassung, Channel message)
8. Gamification API routes (profile, quests, leaderboard)

### Phase 3: Dashboard Quest Widget + XP Bar
**Rationale**: First visible gamification UI. Users see their quests on the dashboard.

1. `QuestWidget` component (quests list + progress bars)
2. `XpBar` component (level + progress)
3. `StreakBadge` component
4. `RunenCounter` component
5. Integrate into dashboard page layout
6. `QuestCompletionToast` for real-time notifications (Socket.IO listener)

### Phase 4: Bossfight System
**Rationale**: Depends on quest engine (Phase 2) being complete. Bossfight damage is recorded alongside quest completions.

1. Bossfight engine: HP calculation, phase transitions
2. `BossfightBanner` component
3. Bossfight damage recording in quest check flow
4. Admin: create bossfight API + UI
5. Real-time HP updates via Socket.IO
6. Nightly consistency check in gamification-eval cron

### Phase 5: Quick Wins (Parallel with Phase 3-4)
**Rationale**: Quick Wins are independent of gamification. Can be built in parallel by different focus areas. Zero schema changes (except removing stale chatNachrichten count).

1. QW-1: Clickable KPI cards (StatMini -> URL-param tab switching)
2. QW-3: EmptyState component + apply to 4+ tabs
3. QW-4: Nachrichten count fix (Channel message count)
4. QW-5: Zeiterfassung description visibility
5. QW-2: OCR Recovery banner + Vision-Analyse endpoint

### Phase 6: Klassen-spezifische Quests + Weekly Quests
**Rationale**: Extends Phase 2 quest engine with class-filtered quests and weekly evaluation cycle.

1. Add Klasse filter to quest evaluation
2. Seed class-specific daily quests (Jurist, Schreiber, Waechter, Quartiermeister)
3. Weekly quest evaluation (different threshold period)
4. Weekly reset logic

### Phase 7: Item Shop + Inventar
**Rationale**: Depends on Runen being earned (Phase 2). Cosmetic-first approach.

1. Shop API routes (list items, purchase)
2. `ShopPage` component
3. `InventarPanel` component
4. Equipped items display on profile
5. Seed initial shop items (avatar frames, titles)

### Phase 8: Team Dashboard + Reporting
**Rationale**: Depends on enough data being accumulated from Phases 2-6. Admin-only view.

1. Team dashboard API (aggregated stats per user)
2. `TeamDashboard` page
3. Erfuellungsquote chart
4. Backlog delta tracking
5. Bossfight damage per person
6. Monthly report generation

### Phase 9: Heldenkarte + Polish
**Rationale**: Profile page, badge showcase, final polish.

1. `HeldenkartePage` (/profil/held)
2. Badge unlock checks (via nightly cron)
3. Level-up overlay animation
4. Special quest campaigns (time-limited)

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Modifying Business Model Schemas for Gamification
**What:** Adding `xpWert`, `questRelevant`, or `gamificationProcessed` columns to KalenderEintrag, Rechnung, etc.
**Why bad:** Couples gamification to core business logic. Makes gamification removal/refactoring impossible without business model migration. Violates single responsibility.
**Instead:** Gamification reads from existing tables via COUNT queries. Quest conditions are stored in Quest.bedingung JSON, not in business models.

### Anti-Pattern 2: Synchronous Quest Evaluation Blocking API Responses
**What:** Making the API response wait for full quest evaluation, badge checks, bossfight updates, and Socket.IO emissions before returning.
**Why bad:** Adds 100-500ms latency to every business action. Users notice.
**Instead:** Fire-and-forget pattern. Call `checkQuestsForUser()` with `.catch()` -- if it fails, the business action still succeeds. UI updates come asynchronously via Socket.IO.

### Anti-Pattern 3: Using LLM for Quest Evaluation
**What:** Sending user activity to an LLM to determine if a quest is complete.
**Why bad:** Expensive, slow, non-deterministic. Quest conditions must be precisely verifiable.
**Instead:** Machine-readable JSON conditions evaluated by deterministic Prisma queries. Same philosophy as the existing rule-based complexity classifier.

### Anti-Pattern 4: Global Leaderboard Without Privacy Controls
**What:** Showing all users' XP, level, and quest completion rates to everyone.
**Why bad:** Can create toxic competition in a small kanzlei. Arbeitsrechtlich problematic.
**Instead:** Team-level aggregates visible to all. Individual stats visible only to the user themselves and ADMIN/QUARTIERMEISTER role. Opt-out for leaderboard display.

### Anti-Pattern 5: Complex Client-Side State for Game Data
**What:** Managing quest progress, XP, level, runen, streak as complex client state with optimistic updates.
**Why bad:** Gamification data must be authoritative from the server (anti-abuse). Client state drifts.
**Instead:** Server is source of truth. Client fetches on mount + listens to Socket.IO events for incremental updates. SWR/React Query with `revalidateOnFocus` for stale data recovery.

### Anti-Pattern 6: Building OCR Vision as a Background Queue Job
**What:** Enqueueing Vision OCR the same way as Stirling-PDF OCR (BullMQ, async).
**Why bad:** User clicked "Vision-Analyse" expecting an immediate result. Background queue + polling adds UX friction for what should be a 5-10 second operation.
**Instead:** Synchronous API call with streaming response. Vision API call takes 5-15s, acceptable as a loading state. If it times out (30s), fall back to async queue.

---

## Scalability Considerations

| Concern | Current Scale (5 users) | Future Scale (50+ users) |
|---|---|---|
| Quest evaluation per action | ~5 COUNT queries, <50ms | Still trivial -- indexed queries |
| Daily quest check for all users | 5 users * 5 quests * 5 queries = 125 queries | 50 * 10 * 5 = 2500 queries -- batch with Promise.all |
| Bossfight HP updates | Single atomic decrement | Concurrent decrements -- use Prisma `{ decrement: 1 }` for atomicity |
| Socket.IO game events | 5 clients, ~10 events/day/user | 50 clients -- no concern with Redis adapter |
| Quest completion history | ~25 records/day | ~500/day -- add composite index on (profileId, abgeschlossenAm) |
| Shop inventory | ~5 users * ~10 items | ~50 * 50 = 2500 records -- no concern |

---

## Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Quest condition storage | JSON in Quest.bedingung | Flexible, no schema change per quest, same pattern as HelenaAlert.meta |
| Quest evaluation | Deterministic Prisma COUNT queries | No LLM, no ambiguity, testable, same philosophy as rule-based classifier |
| XP/Level persistence | PostgreSQL (Prisma) | Source of truth, ACID, audit trail |
| Real-time game events | Socket.IO via existing infrastructure | No new WebSocket setup, Redis adapter already configured |
| Gamification cron | BullMQ repeatable job (new queue) | Same pattern as scanner, frist-reminder -- proven |
| OCR Vision fallback | Vercel AI SDK v4 (existing multi-provider) | Reuse GPT-4o/Claude Vision via existing provider factory |
| Empty state component | Reusable React component | Shared across 4+ locations, consistent UX |
| Tab navigation from KPIs | URL search params (?tab=x) | Stateless, shareable, no client state lifting needed |

**Zero new npm packages.** All features build on existing stack: Prisma, Socket.IO, BullMQ, Vercel AI SDK v4, shadcn/ui, Motion/React.

---

## Sources

- Codebase inspection: `prisma/schema.prisma` (80+ models, all enums, User, KalenderEintrag, Zeiterfassung, Rechnung relations)
- Codebase inspection: `src/app/(dashboard)/dashboard/page.tsx` (dashboard layout, GlassKpiCard usage, Prisma queries)
- Codebase inspection: `src/app/(dashboard)/akten/[id]/page.tsx` (StatMini grid, AkteDetailTabs, _count usage)
- Codebase inspection: `src/components/akten/akte-detail-tabs.tsx` (tab state, activeTab setter, unsaved-changes guard)
- Codebase inspection: `src/components/ui/glass-kpi-card.tsx` (Motion/React animation, no click handler)
- Codebase inspection: `src/components/dokumente/ocr-status-badge.tsx` (FEHLGESCHLAGEN retry, POST /api/dokumente/{id}/ocr)
- Codebase inspection: `src/lib/queue/queues.ts` (17 queues, cron registration patterns)
- Codebase inspection: `src/worker.ts` (worker startup, processor registration, cron scheduling)
- Codebase inspection: `src/lib/socket/rooms.ts` (room conventions, dynamic join/leave)
- Codebase inspection: `src/lib/socket/emitter.ts` (Redis emitter for worker-to-client push)
- Codebase inspection: `src/workers/processors/scanner.ts` (deterministic rule-based checks, SystemSetting config)
- Codebase inspection: gamification TODO (`2026-02-26-gamification-kanzlei-steuerung-quests-xp-bossfight-fantasy.md`)
- Codebase inspection: quick-wins TODO (`2026-02-26-quick-wins-akte-detail-empty-states-ocr-kpi-navigation.md`)
- Confidence: HIGH -- all integration points verified against actual code, all patterns follow established codebase conventions
