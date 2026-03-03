---
phase: 39-item-shop-inventar
plan: 01
subsystem: api
tags: [prisma, gamification, shop, inventory, perk, transaction]

# Dependency graph
requires:
  - phase: 33-gamification-grundlagen
    provides: UserGameProfile model, getLevelForXp, Runen system, quest seed pattern
  - phase: 38-anti-missbrauch
    provides: Runen cap enforcement (daily limit must exist before spending)
provides:
  - ShopItem and UserInventoryItem Prisma models with ItemRarity, ItemTyp enums
  - FOKUSZEIT value in KalenderTyp enum
  - 18-item catalog (5 Common, 5 Rare, 5 Epic, 3 Legendary) with idempotent seeder
  - Shop service with atomic purchase ($transaction), equip/unequip, perk activation
  - 3 API routes (GET/POST shop, PATCH equip, POST activate)
  - Shop type exports (RARITY_LABELS, RARITY_COLORS, ITEM_TYP_LABELS, LEGENDARY_LEVEL_GATE)
affects: [39-02-item-shop-inventar, team-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Atomic Runen decrement via Prisma $transaction (prevents negative balance race)
    - One-active-per-type equip enforcement via updateMany + update in $transaction
    - Perk activation with side-effect dispatch (KalenderEintrag creation for fokus-siegel)

key-files:
  created:
    - prisma/migrations/manual_item_shop.sql
    - src/lib/gamification/shop-items.ts
    - src/lib/gamification/shop-service.ts
    - src/app/api/gamification/shop/route.ts
    - src/app/api/gamification/shop/equip/route.ts
    - src/app/api/gamification/shop/activate/route.ts
  modified:
    - prisma/schema.prisma
    - src/lib/gamification/types.ts

key-decisions:
  - "Atomic Runen decrement via $transaction prevents race conditions on purchase"
  - "Level 25 gate checked inside $transaction for LEGENDARY items"
  - "Perk side-effects (streak-schutz, doppel-runen) tracked by consumed inventory item -- full integration deferred to nightly cron / quest-service"
  - "FOKUSZEIT KalenderEintrag created on fokus-siegel activation with 30-min window"

patterns-established:
  - "Shop purchase: $transaction with findUnique + level gate + balance check + decrement + create"
  - "One-active-per-type: updateMany(same-type, ausgeruestet:false) then update(target, ausgeruestet:true)"
  - "Perk activation: mark consumed + dispatch side-effect by perkType switch"

requirements-completed: [SHOP-01, SHOP-02, SHOP-03, SHOP-04, SHOP-05]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 39 Plan 01: Item-Shop Backend Summary

**ShopItem + UserInventoryItem schema with 18-item catalog, atomic purchase service, and 3 API routes (shop/equip/activate)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T06:09:47Z
- **Completed:** 2026-03-03T06:14:14Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- ShopItem and UserInventoryItem Prisma models with ItemRarity/ItemTyp enums and FOKUSZEIT in KalenderTyp
- 18-item catalog across 4 rarity tiers (Common=20, Rare=50, Epic=120, Legendary=300 Runen) with 3 perks
- Atomic purchase transaction with Level 25 gate for Legendary items and balance validation
- One-active-per-type equip constraint and perk activation with FOKUSZEIT KalenderEintrag creation

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema + migration + item catalog + types** - `8418198` (feat)
2. **Task 2: Shop service + 3 API routes** - `33b7a3b` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added ItemRarity, ItemTyp enums, FOKUSZEIT, ShopItem, UserInventoryItem models
- `prisma/migrations/manual_item_shop.sql` - Idempotent migration for enums, tables, indexes, FKs
- `src/lib/gamification/shop-items.ts` - 18-item catalog definition with seedShopItems()
- `src/lib/gamification/types.ts` - ShopItemRarity, ShopItemTyp types, RARITY_LABELS/COLORS, LEGENDARY_LEVEL_GATE
- `src/lib/gamification/shop-service.ts` - purchaseItem, equipItem, unequipItem, activatePerk
- `src/app/api/gamification/shop/route.ts` - GET catalog+inventory, POST purchase
- `src/app/api/gamification/shop/equip/route.ts` - PATCH equip/unequip toggle
- `src/app/api/gamification/shop/activate/route.ts` - POST perk activation

## Decisions Made
- Atomic Runen decrement via Prisma $transaction prevents race conditions on concurrent purchases
- Level 25 gate checked inside $transaction for LEGENDARY items (not just client-side)
- Perk side-effects (streak-schutz, doppel-runen) tracked by consumed inventory item with activatedAt -- full integration with nightly cron and quest-service deferred to those systems
- FOKUSZEIT KalenderEintrag created on fokus-siegel activation with 30-minute duration window

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 API routes operational with auth + opt-in guards
- Plan 02 can build the shop UI against stable GET/POST/PATCH endpoints
- Item catalog seeder ready for deployment via seedShopItems()

## Self-Check: PASSED

All 8 files verified present. Both task commits (8418198, 33b7a3b) verified in git log.

---
*Phase: 39-item-shop-inventar*
*Completed: 2026-03-03*
