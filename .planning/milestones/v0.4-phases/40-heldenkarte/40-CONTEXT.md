# Phase 40: Heldenkarte - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Personal profile page ("Heldenkarte") showcasing a user's gamification achievements. Displays avatar with equipped cosmetics, class, level, title, earned badges, and quest history. Self-only visibility (DSGVO decision from Phase 33). No social/public profile features.

</domain>

<decisions>
## Implementation Decisions

### Badge System
- Small curated set of 5-8 badges tied to milestone thresholds
- Examples: Fristenwächter (50 Fristen erledigt), Aktenkönig (100 Akten bearbeitet), Streak-Meister (30-Tage Streak), Bannbrecher (Boss besiegt — already exists as trophy)
- Badges are permanently awarded when threshold is hit, stored with earn date — never revoked even if count drops later
- Consistent with existing boss trophy pattern (trophies JSON on UserGameProfile)
- Badges are earned-only, never purchasable (explicitly stated in PROFIL-02)
- Badge definitions stored as a catalog (like shop-items.ts) — evaluated via a badge-check service

### Page Layout
- Hero header + scrollable sections (single scroll page, no tabs)
- Top: Large hero card (GlassCard) with AvatarFrame, class icon, level, title, XP bar, Runen balance, streak count, equipped cosmetics list
- Middle: Badge showcase grid — earned badges with icons + earn dates, locked badges shown as muted silhouettes
- Bottom: Quest history table — recent completed quests with date, name, XP/Runen earned

### Quest History
- Shows all-time completed quests, most recent first
- Table columns: Datum, Quest-Name, Typ (Daily/Weekly/Special), XP, Runen
- Paginated (not infinite scroll) — 20 per page, simple prev/next
- No filtering needed at this stage — simple chronological list

### Profile Access
- Strictly self-only (DSGVO from Phase 33) — no public profile view
- Single API endpoint: extend existing `/api/gamification/profile` or create `/api/gamification/heldenkarte`

### Claude's Discretion
- Exact badge icon choices (Lucide icons)
- Badge card visual design within glass aesthetic
- Hero card exact layout proportions
- Quest history empty state design
- Whether to show "progress toward next badge" indicators

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AvatarFrame` (src/components/gamification/avatar-frame.tsx): CSS ring with oklch gradient per rarity — use for hero avatar display
- `XpProgressBar` (src/components/gamification/xp-progress-bar.tsx): Animated XP bar with motion/react — reuse in hero card
- `RarityBadge` (src/components/gamification/rarity-badge.tsx): Colored label per rarity tier — may reuse for badge rarity if applicable
- `QuestSection` (src/components/gamification/quest-section.tsx): Quest row rendering with deep-link — reference pattern for history rows
- `/api/gamification/profile/route.ts`: Exists but has no consumer — returns id, klasse, xp, level, levelTitle, runen, streakTage, progress

### Established Patterns
- Self-fetching absent-until-loaded: QuestWidget, BossfightBanner, Shop page all use this pattern
- GlassCard for all card containers
- `trophies` JSON field on UserGameProfile — boss trophies already stored here, badges could extend or parallel this
- `LEVEL_TITLES` map in types.ts — level-based title strings already exist

### Integration Points
- `UserGameProfile` model: xp, runen, streakTage, klasse, trophies — all needed for hero card
- `QuestCompletion` model: userId, questId, completedDate, xpVerdient, runenVerdient — quest history source
- `UserInventoryItem` with `ausgeruestet: true` — equipped cosmetics for display
- Sidebar navigation: Add "Heldenkarte" entry (same pattern as Shop addition in Phase 39)

</code_context>

<specifics>
## Specific Ideas

- Badge showcase should show locked badges as muted/greyed-out silhouettes so users can see what's achievable
- Hero card should feel like a character sheet — the "reward" for all the gamification work
- Bannbrecher trophy from bossfight should appear in the badge grid alongside new badges (unify display)

</specifics>

<deferred>
## Deferred Ideas

- Public/team-visible profile card — would require DSGVO review, separate phase
- Badge progress indicators ("42/50 Fristen for Fristenwächter") — Claude's discretion for v1
- Badge notification toast when earned — could be added later via Socket.IO event

</deferred>

---

*Phase: 40-heldenkarte*
*Context gathered: 2026-03-03*
