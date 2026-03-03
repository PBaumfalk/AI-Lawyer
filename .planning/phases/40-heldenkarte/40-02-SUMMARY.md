---
phase: 40-heldenkarte
plan: 02
subsystem: ui
tags: [gamification, heldenkarte, profile, badges, quest-history, glass-ui]

# Dependency graph
requires:
  - phase: 40-heldenkarte
    plan: 01
    provides: GET /api/gamification/heldenkarte endpoint, BADGE_CATALOG, evaluateBadges service
  - phase: 39-item-shop-inventar
    provides: AvatarFrame, XpProgressBar, GlassCard components, ShopItemRarity type
provides:
  - HeroCard component (avatar frame, class icon, level, XP bar, Runen, streak, equipped cosmetics)
  - BadgeShowcase component (earned/locked badge grid with dynamic Lucide icons)
  - QuestHistoryTable component (paginated table with typed quest badges)
  - Heldenkarte page at /heldenkarte with self-fetching absent-until-loaded pattern
  - Sidebar navigation entry for Heldenkarte with IdCard icon
affects: [team-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [hero-card-character-sheet, badge-earned-locked-grid, paginated-quest-history]

key-files:
  created:
    - src/components/gamification/hero-card.tsx
    - src/components/gamification/badge-showcase.tsx
    - src/components/gamification/quest-history-table.tsx
    - src/app/(dashboard)/heldenkarte/page.tsx
  modified:
    - src/components/layout/sidebar.tsx

key-decisions:
  - "Highest-rarity equipped cosmetic determines AvatarFrame ring color (fallback COMMON)"
  - "Badge icon lookup via static BADGE_ICONS map with HelpCircle fallback (no dynamic import)"
  - "Quest type badges use distinct color coding: DAILY=sky, WEEKLY=emerald, SPECIAL=amber"
  - "Single re-fetch on page change (no separate caching) since badge evaluation is fast"

patterns-established:
  - "Hero card: two-column desktop, stacked mobile with AvatarFrame + stats"
  - "Badge grid: earned=emerald border + full opacity, locked=opacity-40 + Lock icon + '???' text"
  - "Quest history: plain HTML table with glass styling, paginated with prev/next buttons"

requirements-completed: [PROFIL-01, PROFIL-02, PROFIL-03]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 40 Plan 02: Heldenkarte UI Summary

**Character sheet profile page with hero card, badge showcase grid, and paginated quest history table at /heldenkarte with sidebar navigation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T07:24:10Z
- **Completed:** 2026-03-03T07:26:25Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- HeroCard component displaying avatar with rarity-based frame ring, class icon, level/title, XP progress bar, Runen balance, streak counter, and equipped cosmetics badges
- BadgeShowcase grid with earned badges (icon, name, description, earn date) and locked badges (Lock icon, muted opacity, hidden description)
- QuestHistoryTable with 5-column layout (Datum, Quest-Name, Typ, XP, Runen), color-coded type badges, and prev/next pagination
- Heldenkarte page wired to API with self-fetching absent-until-loaded pattern and quest history pagination

## Task Commits

Each task was committed atomically:

1. **Task 1: HeroCard + BadgeShowcase + QuestHistoryTable components** - `7955f24` (feat)
2. **Task 2: Heldenkarte page + sidebar navigation entry** - `d0b27e3` (feat)

## Files Created/Modified
- `src/components/gamification/hero-card.tsx` - Glass hero header with avatar frame, class icon, level, XP bar, stats, cosmetics
- `src/components/gamification/badge-showcase.tsx` - Badge grid with earned/locked states and dynamic Lucide icon lookup
- `src/components/gamification/quest-history-table.tsx` - Paginated quest history table with typed badges and empty state
- `src/app/(dashboard)/heldenkarte/page.tsx` - Client page with fetch, pagination, and absent-until-loaded pattern
- `src/components/layout/sidebar.tsx` - Added Heldenkarte entry with IdCard icon after Shop

## Decisions Made
- Used highest-rarity cosmetic to determine AvatarFrame ring color, with COMMON fallback when no cosmetics equipped
- Static BADGE_ICONS map with 8 icons + HelpCircle fallback instead of dynamic Lucide icon import (simpler, no bundle concern)
- Quest type badges use distinct color families (sky for daily, emerald for weekly, amber for special) for visual differentiation
- Full re-fetch on page change (not partial cache) since badge evaluation is fast and already persisted

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 40 (Heldenkarte) fully complete -- backend API + UI page both shipped
- Ready for Phase 41 (Team-Dashboard) which builds on accumulated gamification data

## Self-Check: PASSED

All 5 files verified present. Both commit hashes (7955f24, d0b27e3) confirmed in git log.

---
*Phase: 40-heldenkarte*
*Completed: 2026-03-03*
