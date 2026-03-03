# Phase 39: Item-Shop + Inventar - Research

**Researched:** 2026-03-03
**Domain:** Gamification commerce (shop, inventory, cosmetics, comfort perks)
**Confidence:** HIGH

## Summary

Phase 39 builds a self-contained shop and inventory system using only the existing stack: Prisma models for item catalog and user inventory, Next.js API routes for purchase/equip/activate, and React client components with the Glass UI design system. No new npm packages are needed -- the entire feature is a standard CRUD + atomic-decrement pattern on top of the already-shipped gamification infrastructure (UserGameProfile.runen, getLevelForXp, $transaction).

The core technical challenge is the atomic purchase transaction: deducting Runen and creating an inventory record must happen in a single Prisma $transaction to prevent race conditions (double-buy, negative balance). This pattern is already established in `quest-service.ts` and `boss-engine.ts`. The secondary challenge is rendering cosmetic effects (avatar frames, completion animations) without impacting performance. CSS-only approaches (oklch gradient rings, keyframe animations) are the right choice for the project's Chrome-only target.

**Primary recommendation:** Model the shop as two Prisma models (ShopItem catalog + UserInventoryItem ownership), seed items via the existing seed.ts pattern, build purchase/equip API routes with Prisma $transaction, and render the shop/inventory as a tabbed page at `/shop` using GlassCard components.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 16-20 items across 4 rarity tiers (4-5 per tier)
- Aspirational pricing: Common=20, Rare=50, Epic=120, Legendary=300 Runen
- Items seeded via code (seed script pattern), admin can enable/disable individual items but not create new ones
- All four cosmetic types included: Avatar-Rahmen, Banner, Profil-Titel, Abschluss-Animation
- 2-3 consumable comfort perks in the catalog alongside cosmetics
- Equipped cosmetics visible on Heldenkarte (Phase 40) + subtle avatar hints throughout the app
- Avatar frames rendered as CSS border/ring around avatar circles (colored ring, oklch gradient per rarity)
- Profil-Titel shown as tooltip on user avatars in sidebar and messages
- Banners = themed gradient/pattern as Heldenkarte header background (like LinkedIn banner)
- Completion animations play on quest completion Sonner toasts (CSS/canvas animation alongside existing toast)
- Perks are consumable: each purchase gives one use, then consumed. Creates ongoing Runen sink
- Fokus-Siegel: activating creates a KalenderEintrag (type FOKUSZEIT) for 30 minutes, visible to team
- 2-3 comfort perks total (Fokus-Siegel + 1-2 others, e.g., Streak-Schutz, Doppel-Runen)
- No cooldowns between perk purchases -- Runen cost is the natural limiter
- Perk activation is immediate (no scheduling, no queue)
- Dedicated /shop page with new sidebar entry (Lucide Store icon)
- Category grid layout: filter tabs (Kosmetik / Perks) with responsive card grid
- Each card shows: icon/preview, name, rarity badge, Runen price, buy button
- Locked Legendary items show "Level 25 erforderlich" gate with current level indicator
- Confirmation dialog before purchase: item details + price + current Runen balance + Bestaetigen/Abbrechen
- Inventory as second tab on /shop page ("Shop" | "Inventar")
- Inventory shows owned items with equip/unequip toggle for cosmetics, activate button for perks
- Legendary items (rarity tier 4) locked behind Level 25 requirement
- Shop card shows the item but buy button is disabled with level requirement text
- Once user reaches Level 25, items unlock automatically

### Claude's Discretion
- Exact item names and descriptions (German legal/office fantasy theme)
- Card visual design within Glass UI system
- Specific CSS gradient/pattern for each avatar frame rarity
- Animation implementation for quest completion (CSS keyframes vs canvas-confetti)
- Exact comfort perk effects beyond Fokus-Siegel
- Prisma model field names and indexes for ShopItem + InventarItem
- Whether perks use a separate activation API or are instant on purchase

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SHOP-01 | Item-Katalog mit 4 Seltenheitsstufen (Common, Rare, Epic, Legendary) | Prisma enum `ItemRarity` + `ShopItem` model with rarity field; seed script creates 16-20 items across 4 tiers |
| SHOP-02 | Kosmetische Items kaufbar mit Runen (Avatar-Rahmen, Banner, Profil-Titel, Abschluss-Animation) | Prisma enum `ItemTyp` with 4 cosmetic types + `PERK`; purchase API uses `$transaction` with atomic `{ decrement }` on `UserGameProfile.runen` |
| SHOP-03 | Komfort-Perks kaufbar (z.B. Fokus-Siegel: 30 Min Fokuszeit-Block) | `UserInventoryItem` tracks perk ownership; activation API creates `KalenderEintrag` with new `FOKUSZEIT` KalenderTyp and sets `verbraucht=true` |
| SHOP-04 | Inventar-Verwaltung pro User (gekaufte Items, aktive Ausruestung) | `UserInventoryItem` model with `ausgeruestet` and `verbraucht` booleans; equip/unequip API enforces one-active-per-type constraint |
| SHOP-05 | Level-Gate fuer Legendary Items (erst ab Level 25 kaufbar) | Purchase API calls `getLevelForXp()` to check user level >= 25 before allowing Legendary purchases; shop UI disables buy button with level indicator |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | (existing) | ShopItem + UserInventoryItem models, $transaction for purchase | Already used for all 70+ models; atomic increment/decrement pattern proven in quest-service.ts |
| Next.js App Router | 14+ (existing) | API routes at `/api/gamification/shop/*`, page at `/shop` | Existing pattern for all gamification routes |
| Zod | (existing) | Request body validation for purchase/equip/activate endpoints | Used in all gamification API routes (audit/confirm, bossfight/admin) |
| React + Tailwind + shadcn/ui | (existing) | Shop page UI with GlassCard, Button, Badge, tabs | Established Glass UI pattern from quest-widget, gamification-tab |
| Lucide React | (existing) | Store icon for sidebar, Gem icon for Runen, item type icons | Already imported extensively in sidebar.tsx |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| canvas-confetti | (existing) | Quest completion animation for Abschluss-Animation cosmetic | Already installed for bossfight victory (boss-victory.tsx); reuse for completion toast animation |
| Sonner | (existing) | Purchase confirmation toasts, perk activation feedback | Already used throughout app for all toast notifications |
| motion/react | (existing) | Card hover/transition animations on shop items | Already imported in sidebar.tsx and throughout UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma seed script | Admin CRUD UI for items | User decided: items seeded via code, admin only enables/disables. No CRUD UI needed. |
| CSS keyframe animations | canvas-confetti for completion | canvas-confetti already installed and used; CSS keyframes are lighter but less dramatic. Recommendation: CSS keyframes for most, canvas-confetti for Legendary completion. |
| Separate /inventar page | Tab on /shop page | User decided: Inventory as second tab on /shop page. Single page, simpler routing. |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
prisma/
  schema.prisma          # Add ShopItem + UserInventoryItem models, ItemRarity + ItemTyp enums, FOKUSZEIT to KalenderTyp
  seed.ts                # Add seedShopItems() function

src/
  lib/gamification/
    shop-service.ts      # Purchase, equip/unequip, activate perk logic
    shop-items.ts        # Item catalog definition (names, descriptions, metadata)
  app/api/gamification/shop/
    route.ts             # GET catalog, POST purchase
    equip/route.ts       # PATCH equip/unequip
    activate/route.ts    # POST activate perk
  app/(dashboard)/shop/
    page.tsx             # Shop + Inventory page with tabs
  components/gamification/
    shop-item-card.tsx   # Individual item card component
    inventory-item.tsx   # Inventory row with equip/activate actions
    rarity-badge.tsx     # Rarity tier badge (Common/Rare/Epic/Legendary with oklch colors)
    avatar-frame.tsx     # CSS ring wrapper for user avatars with equipped frame
```

### Pattern 1: Atomic Purchase Transaction
**What:** Deduct Runen + create inventory record in single Prisma $transaction
**When to use:** Every purchase action
**Example:**
```typescript
// Source: Established pattern from src/lib/gamification/quest-service.ts (line 156)
// and src/lib/gamification/boss-engine.ts (line 111)
export async function purchaseItem(userId: string, shopItemId: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Read item and profile inside transaction
    const item = await tx.shopItem.findUnique({ where: { id: shopItemId } });
    if (!item || !item.aktiv) throw new Error("Item nicht verfuegbar");

    const profile = await tx.userGameProfile.findUnique({ where: { userId } });
    if (!profile) throw new Error("Kein GameProfile");

    // 2. Level gate check for Legendary
    if (item.rarity === "LEGENDARY") {
      const level = getLevelForXp(profile.xp);
      if (level < 25) throw new Error("Level 25 erforderlich");
    }

    // 3. Balance check
    if (profile.runen < item.preis) throw new Error("Nicht genuegend Runen");

    // 4. Atomic decrement (mirrors awardRewards pattern but with decrement)
    await tx.userGameProfile.update({
      where: { userId },
      data: { runen: { decrement: item.preis } },
    });

    // 5. Create inventory record
    return tx.userInventoryItem.create({
      data: { userId, shopItemId },
    });
  });
}
```

### Pattern 2: One-Active-Per-Type Constraint
**What:** When equipping a cosmetic, unequip any previously equipped item of the same type
**When to use:** Equip action for cosmetics (Avatar-Rahmen, Banner, Profil-Titel, Abschluss-Animation)
**Example:**
```typescript
// Equip: unequip same-type first, then equip new
export async function equipItem(userId: string, inventoryItemId: string) {
  return prisma.$transaction(async (tx) => {
    const invItem = await tx.userInventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: { shopItem: true },
    });
    if (!invItem || invItem.userId !== userId) throw new Error("Nicht gefunden");
    if (invItem.shopItem.kategorie === "PERK") throw new Error("Perks werden aktiviert, nicht ausgeruestet");

    // Unequip all items of the same type for this user
    await tx.userInventoryItem.updateMany({
      where: {
        userId,
        ausgeruestet: true,
        shopItem: { typ: invItem.shopItem.typ },
      },
      data: { ausgeruestet: false },
    });

    // Equip the new item
    return tx.userInventoryItem.update({
      where: { id: inventoryItemId },
      data: { ausgeruestet: true },
    });
  });
}
```

### Pattern 3: Seed Script with Upsert
**What:** Idempotent item seeding using upsert on a stable identifier
**When to use:** `prisma/seed.ts` and migration scripts
**Example:**
```typescript
// Source: Existing upsert pattern from prisma/seed.ts (line 10-23)
const SHOP_ITEMS = [
  { slug: "silber-rahmen", name: "Silber-Rahmen", typ: "AVATAR_RAHMEN", rarity: "COMMON", preis: 20, ... },
  // ... 16-20 items
];

async function seedShopItems() {
  for (const item of SHOP_ITEMS) {
    await prisma.shopItem.upsert({
      where: { slug: item.slug },
      update: { name: item.name, preis: item.preis }, // Allow price updates
      create: item,
    });
  }
}
```

### Pattern 4: Self-Fetching Shop Page (Absent-Until-Loaded)
**What:** Client component fetches shop data, renders null until loaded
**When to use:** Shop page that requires auth and opt-in check
**Example:**
```typescript
// Source: Established pattern from src/components/gamification/quest-widget.tsx
// Shop page follows same fetch pattern with opt-in guard (404 = not opted in)
const [data, setData] = useState<ShopData | null>(null);
const [loaded, setLoaded] = useState(false);

useEffect(() => {
  let cancelled = false;
  async function fetchShop() {
    const res = await fetch("/api/gamification/shop");
    if (cancelled) return;
    if (res.status === 404) { setLoaded(true); return; }
    if (!res.ok) { setLoaded(true); return; }
    setData(await res.json());
    setLoaded(true);
  }
  fetchShop();
  return () => { cancelled = true; };
}, []);
```

### Anti-Patterns to Avoid
- **Read-modify-write for Runen:** Never read balance, subtract in JS, then write back. Always use `{ decrement }` inside a $transaction. The existing `awardRewards()` function demonstrates the correct pattern with `{ increment }`.
- **Optimistic UI for purchases:** Do not optimistically update the UI before the server confirms. Purchases involve real currency and must be confirmed server-side first. Show a loading state on the buy button instead.
- **Client-side level gate:** Never rely solely on client-side level checks to gate Legendary items. The server must re-verify the level inside the purchase transaction.
- **Separate migration for KalenderTyp enum:** Prisma enum changes require a migration. Plan for adding `FOKUSZEIT` to the `KalenderTyp` enum as part of the schema changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic balance deduction | Manual read + subtract + write | Prisma `$transaction` + `{ decrement }` | Race conditions with concurrent purchases; pattern already proven in boss-engine.ts |
| Level calculation | Custom XP math | `getLevelForXp()` from game-profile-service.ts | Already handles all tier boundaries; tested and consistent across the app |
| Idempotent seeding | Raw SQL inserts | Prisma `upsert` on slug | Existing seed.ts pattern; handles re-runs gracefully |
| Toast notifications | Custom notification system | Sonner `toast.success()` | Already used for all gamification feedback (quest completion, boss damage, audit) |
| CSS gradient rings | SVG or canvas for avatar frames | CSS `box-shadow` / `outline` with oklch gradients | Chrome-only target supports oklch natively; CSS is zero-dependency and performant |
| Animation on completion | Custom animation library | canvas-confetti (already installed) + CSS @keyframes | canvas-confetti is 6KB and already used for boss victory |

**Key insight:** The entire shop feature is a CRUD application with one non-trivial invariant (atomic purchase). Every infrastructure piece already exists in the codebase -- Prisma for data, Zod for validation, GlassCard for UI, $transaction for atomicity.

## Common Pitfalls

### Pitfall 1: Negative Runen Balance from Race Conditions
**What goes wrong:** Two concurrent purchase requests both read balance=50, both see enough for a 30-Runen item, both decrement, balance goes to -10.
**Why it happens:** Read-modify-write without transaction isolation.
**How to avoid:** All purchases MUST use `prisma.$transaction` with the balance check and decrement in the same transaction. The `decrement` operation itself is atomic, but the balance check must be inside the same transaction boundary.
**Warning signs:** Any purchase code that reads `profile.runen` outside a transaction and checks `>=` before a separate update call.

### Pitfall 2: Double-Equip of Same Item Type
**What goes wrong:** User has two Avatar-Rahmen equipped simultaneously, UI shows inconsistent state.
**Why it happens:** Equip logic does not unequip existing item of same type before equipping new one.
**How to avoid:** Use `updateMany` to set `ausgeruestet=false` for all items of the same `typ` for the user, then set `ausgeruestet=true` for the new item -- all inside a `$transaction`.
**Warning signs:** Multiple inventory items with `ausgeruestet=true` and the same `typ` for the same user.

### Pitfall 3: Perk Consumed But Effect Not Created
**What goes wrong:** The perk is marked as consumed (verbraucht=true) but the KalenderEintrag is not created (e.g., due to validation error).
**Why it happens:** Marking consumption and creating the effect are separate operations outside a transaction.
**How to avoid:** Wrap both the `verbraucht=true` update and the KalenderEintrag creation in a single `$transaction`. If the KalenderEintrag creation fails, the consumption is rolled back.
**Warning signs:** Inventory items with `verbraucht=true` but no corresponding KalenderEintrag.

### Pitfall 4: KalenderTyp Enum Migration
**What goes wrong:** Adding `FOKUSZEIT` to the Prisma `KalenderTyp` enum requires a database migration. If forgotten, Prisma client crashes at runtime with "Invalid value for enum KalenderTyp."
**Why it happens:** Prisma enums are enforced at the database level (PostgreSQL CHECK constraint).
**How to avoid:** Create a Prisma migration that adds `FOKUSZEIT` to the `KalenderTyp` enum BEFORE any code that creates a FOKUSZEIT KalenderEintrag.
**Warning signs:** Prisma validation errors when running `prisma generate` or at runtime.

### Pitfall 5: Shop Items Not Visible After Seed
**What goes wrong:** The seed script runs but items don't appear because the API query filters on `aktiv: true` and the seed doesn't set `aktiv` explicitly.
**Why it happens:** Prisma `@default(true)` is only applied on `create`, not `upsert.update`.
**How to avoid:** Explicitly set `aktiv: true` in the seed data. Or better, don't include `aktiv` in updates (only set on create).
**Warning signs:** Empty shop after fresh seed.

## Code Examples

### Prisma Schema: ShopItem + UserInventoryItem
```prisma
// Source: Pattern from existing UserGameProfile + Bossfight models in schema.prisma

enum ItemRarity {
  COMMON
  RARE
  EPIC
  LEGENDARY
}

enum ItemTyp {
  AVATAR_RAHMEN
  BANNER
  PROFIL_TITEL
  ABSCHLUSS_ANIMATION
  PERK
}

model ShopItem {
  id            String      @id @default(cuid())
  slug          String      @unique  // Stable identifier for upsert seeding
  name          String
  beschreibung  String?     @db.Text
  typ           ItemTyp
  rarity        ItemRarity
  preis         Int         // Runen cost
  aktiv         Boolean     @default(true)  // Admin can disable
  sortierung    Int         @default(0)
  metadata      Json        @default("{}")  // CSS class, gradient, animation name, etc.
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  inventoryItems UserInventoryItem[]

  @@index([typ, aktiv])
  @@index([rarity])
  @@map("shop_items")
}

model UserInventoryItem {
  id           String    @id @default(cuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  shopItemId   String
  shopItem     ShopItem  @relation(fields: [shopItemId], references: [id], onDelete: Cascade)
  ausgeruestet Boolean   @default(false)  // For cosmetics: is this currently equipped?
  verbraucht   Boolean   @default(false)  // For perks: has this been activated/consumed?
  purchasedAt  DateTime  @default(now())
  activatedAt  DateTime?                  // When a perk was activated

  @@index([userId, shopItemId])
  @@index([userId, ausgeruestet])
  @@map("user_inventory_items")
}
```

### API Route: GET /api/gamification/shop
```typescript
// Source: Pattern from src/app/api/gamification/dashboard/route.ts
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
    return NextResponse.json({ error: "Gamification nicht aktiviert" }, { status: 404 });
  }

  const profile = await getOrCreateGameProfile(session.user.id, user.role);
  const level = getLevelForXp(profile.xp);

  const [items, inventory] = await Promise.all([
    prisma.shopItem.findMany({
      where: { aktiv: true },
      orderBy: [{ typ: "asc" }, { sortierung: "asc" }],
    }),
    prisma.userInventoryItem.findMany({
      where: { userId: session.user.id },
      include: { shopItem: true },
    }),
  ]);

  return NextResponse.json({
    runen: profile.runen,
    level,
    items,
    inventory,
  });
}
```

### Avatar Frame CSS Ring
```typescript
// Source: oklch Glass UI system from project design conventions
const RARITY_RINGS: Record<string, string> = {
  COMMON:    "ring-2 ring-[oklch(75%_0.05_250)]",          // Silver
  RARE:      "ring-2 ring-[oklch(60%_0.15_250)]",          // Blue
  EPIC:      "ring-2 ring-[oklch(55%_0.2_300)]",           // Purple
  LEGENDARY: "ring-2 ring-[oklch(75%_0.18_85)] shadow-lg shadow-amber-500/20", // Gold glow
};

export function AvatarFrame({
  children,
  rarity,
}: {
  children: React.ReactNode;
  rarity: string | null;
}) {
  if (!rarity) return <>{children}</>;
  return (
    <div className={cn("rounded-full p-[2px]", RARITY_RINGS[rarity])}>
      {children}
    </div>
  );
}
```

### Comfort Perk: Fokus-Siegel Activation
```typescript
// Source: KalenderEintrag creation pattern from existing codebase
async function activateFokusSiegel(userId: string, inventoryItemId: string) {
  return prisma.$transaction(async (tx) => {
    const invItem = await tx.userInventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: { shopItem: true },
    });
    if (!invItem || invItem.userId !== userId) throw new Error("Nicht gefunden");
    if (invItem.verbraucht) throw new Error("Bereits verbraucht");

    // Mark as consumed
    await tx.userInventoryItem.update({
      where: { id: inventoryItemId },
      data: { verbraucht: true, activatedAt: new Date() },
    });

    // Create 30-minute focus time block
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 60 * 1000);

    return tx.kalenderEintrag.create({
      data: {
        typ: "FOKUSZEIT",  // New KalenderTyp enum value
        titel: "Fokus-Siegel aktiv",
        beschreibung: "30 Minuten ungestoerte Fokuszeit",
        datum: now,
        datumBis: end,
        verantwortlichId: userId,
      },
    });
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual SQL for enum changes | Prisma migration with enum alter | Prisma 4+ | Must create migration for FOKUSZEIT enum value |
| Separate balance table | Field on existing UserGameProfile | Phase 33 | Runen already tracked; use { decrement } for purchases |
| Image uploads for cosmetics | CSS-only cosmetics (gradients, rings, patterns) | User decision | No storage needed; pure CSS, Chrome-only |

**Deprecated/outdated:**
- None relevant -- all patterns in use are current

## Open Questions

1. **Comfort perk: Streak-Schutz mechanics**
   - What we know: User decided 2-3 comfort perks total, Fokus-Siegel is defined
   - What's unclear: Exact mechanics of Streak-Schutz (does it prevent next streak break? How long does protection last?)
   - Recommendation: Implement as a flag on UserGameProfile (`streakSchutzAktiv: Boolean`) that the streak calculation in `calculateStreak()` checks. One-time use: next missed workday is forgiven, then flag resets. Can be defined during planning.

2. **Comfort perk: Doppel-Runen mechanics**
   - What we know: Mentioned as potential third perk
   - What's unclear: Duration of effect, scope (all quests or only next quest?)
   - Recommendation: Implement as a timed multiplier (e.g., next 2 hours all Runen rewards doubled). Store activation time on UserGameProfile and check in quest-service.ts reward calculation. Can be defined during planning.

3. **Completion animation trigger point**
   - What we know: Plays on quest completion Sonner toasts
   - What's unclear: How to trigger animation for the correct item type since quest completion happens server-side via BullMQ worker
   - Recommendation: The existing Socket.IO `gamification:audit-needed` pattern shows how server-side events reach the client. Add a similar `gamification:quest-completed` event that includes equipped animation info, or fetch equipped animation from the inventory API when rendering the completion toast. The quest-widget already refetches after completion events -- animation can piggyback on that.

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` -- existing UserGameProfile model (line 2255), KalenderTyp enum (line 57), User model (line 377)
- `src/lib/gamification/game-profile-service.ts` -- awardRewards() atomic increment pattern, getLevelForXp() function
- `src/lib/gamification/quest-service.ts` -- $transaction pattern for atomic XP/Runen + completion recording
- `src/lib/gamification/boss-engine.ts` -- $transaction with double-check-then-act pattern
- `src/lib/gamification/runen-cap.ts` -- Redis INCR+EXPIRE daily cap pattern
- `src/components/gamification/quest-widget.tsx` -- absent-until-loaded self-fetching component pattern
- `src/components/einstellungen/gamification-tab.tsx` -- admin settings with GlassCard UI
- `src/components/layout/sidebar.tsx` -- navigation item structure, badge pattern
- `src/app/api/gamification/dashboard/route.ts` -- auth + opt-in check + JSON response pattern
- `src/app/api/gamification/audit/confirm/route.ts` -- Zod validation + $transaction pattern
- `prisma/seed.ts` -- upsert seeding pattern

### Secondary (MEDIUM confidence)
- `src/components/gamification/boss-victory.tsx` -- canvas-confetti usage for celebration animations
- `src/app/(dashboard)/layout.tsx` -- GamificationAuditListener mounted globally, provider hierarchy

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all patterns already proven in codebase
- Architecture: HIGH -- direct extension of existing gamification models and API patterns
- Pitfalls: HIGH -- race condition patterns well-documented in existing boss-engine.ts and quest-service.ts

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable -- no external dependencies or fast-moving APIs)
