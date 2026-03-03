# Phase 39: Item-Shop + Inventar - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can spend earned Runen on cosmetic and comfort items through a shop page. Four cosmetic types (Avatar-Rahmen, Banner, Profil-Titel, Abschluss-Animation) plus consumable comfort perks. Inventory management with equip/unequip. Level 25 gate for Legendary items. The Heldenkarte profile page is Phase 40 — this phase delivers the shop, inventory, and item infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Item Catalog & Pricing
- 16-20 items across 4 rarity tiers (4-5 per tier)
- Aspirational pricing: Common=20, Rare=50, Epic=120, Legendary=300 Runen
- Items seeded via code (seed script pattern), admin can enable/disable individual items but not create new ones
- All four cosmetic types included: Avatar-Rahmen, Banner, Profil-Titel, Abschluss-Animation
- 2-3 consumable comfort perks in the catalog alongside cosmetics

### Cosmetic Visibility
- Equipped cosmetics visible on Heldenkarte (Phase 40) + subtle avatar hints throughout the app
- Avatar frames rendered as CSS border/ring around avatar circles (colored ring, oklch gradient per rarity)
- Profil-Titel shown as tooltip on user avatars in sidebar and messages
- Banners = themed gradient/pattern as Heldenkarte header background (like LinkedIn banner)
- Completion animations play on quest completion Sonner toasts (CSS/canvas animation alongside existing toast)

### Comfort Perk Mechanics
- Perks are consumable: each purchase gives one use, then consumed. Creates ongoing Runen sink
- Fokus-Siegel: activating creates a KalenderEintrag (type FOKUSZEIT) for 30 minutes, visible to team
- 2-3 comfort perks total (Fokus-Siegel + 1-2 others, e.g., Streak-Schutz, Doppel-Runen)
- No cooldowns between perk purchases — Runen cost is the natural limiter
- Perk activation is immediate (no scheduling, no queue)

### Shop & Inventory UX
- Dedicated /shop page with new sidebar entry (Lucide Store icon)
- Category grid layout: filter tabs (Kosmetik / Perks) with responsive card grid
- Each card shows: icon/preview, name, rarity badge, Runen price, buy button
- Locked Legendary items show "Level 25 erforderlich" gate with current level indicator
- Confirmation dialog before purchase: item details + price + current Runen balance + Bestaetigen/Abbrechen
- Inventory as second tab on /shop page ("Shop" | "Inventar")
- Inventory shows owned items with equip/unequip toggle for cosmetics, activate button for perks

### Level Gate
- Legendary items (rarity tier 4) locked behind Level 25 requirement (from SHOP-05)
- Shop card shows the item but buy button is disabled with level requirement text
- Once user reaches Level 25, items unlock automatically (no proof-badge needed beyond the level)

### Claude's Discretion
- Exact item names and descriptions (German legal/office fantasy theme)
- Card visual design within Glass UI system
- Specific CSS gradient/pattern for each avatar frame rarity
- Animation implementation for quest completion (CSS keyframes vs canvas-confetti)
- Exact comfort perk effects beyond Fokus-Siegel
- Prisma model field names and indexes for ShopItem + InventarItem
- Whether perks use a separate activation API or are instant on purchase

</decisions>

<specifics>
## Specific Ideas

- Fantasy theming carries forward from Phase 33: "Runen" currency, German legal/office themed item names
- Avatar frames should use oklch color gradients matching the rarity tier (e.g., Common=silver, Rare=blue, Epic=purple, Legendary=gold)
- Banners are CSS gradients or SVG patterns, not uploaded images — keeps it lightweight and consistent
- Follow the atomic Prisma increment pattern from game-profile-service.ts for Runen deduction (never read-modify-write)
- Seed pattern follows seedFalldatenTemplates: SystemSetting version guard + idempotent upsert

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/gamification/game-profile-service.ts`: `awardRewards()` with atomic Prisma `{ increment }` — use `{ decrement }` for purchases
- `src/lib/gamification/types.ts`: `SpielKlasse`, `LEVEL_TIERS`, `LEVEL_TITLES`, `roleToKlasse` — reuse for level gate checks
- `src/lib/gamification/runen-cap.ts`: Redis INCR+EXPIRE for daily cap — pattern reference for purchase rate limiting if needed
- `prisma/schema.prisma`: `UserGameProfile` model with `runen Int`, `trophies Json` — extend or add relations for inventory
- `src/components/gamification/quest-widget.tsx`: Self-fetching dashboard widget pattern — reference for shop page data fetching
- `src/components/einstellungen/gamification-tab.tsx`: Admin gamification settings — extend for item enable/disable toggles
- `GlassCard`, `GlassPanel`: Glass UI card components for shop item cards
- Sonner toast system: Used throughout for notifications — extend for purchase confirmations and perk activation
- `seedFalldatenTemplates` in `prisma/seed.ts`: Idempotent seed pattern with SystemSetting version guard

### Established Patterns
- API routes: Zod validation, auth check, JSON response (`src/app/api/gamification/*`)
- Atomic DB operations: `prisma.$transaction` used in boss engine for concurrent safety
- BullMQ queue for async gamification events (`gamificationQueue`)
- Socket.IO for real-time updates (`getSocketEmitter()` from worker)
- KalenderEintrag creation: existing patterns for FRIST, WIEDERVORLAGE — extend with FOKUSZEIT type

### Integration Points
- Sidebar (`src/components/layout/sidebar.tsx`): Add "Shop" entry with Lucide Store icon
- Dashboard page: Quest widget already shows Runen balance — potential link to shop
- `UserGameProfile.runen`: Source of truth for purchase balance
- `getLevelForXp()`: Reuse for Level 25 gate check on Legendary items
- KalenderEintrag model: Extend for FOKUSZEIT type (comfort perk)
- User avatar components: Add CSS ring for equipped avatar frames

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 39-item-shop-inventar*
*Context gathered: 2026-03-03*
