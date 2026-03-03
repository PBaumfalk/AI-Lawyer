# Phase 34: Dashboard Widget + Quest Deep-Links - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Users see their gamification status at a glance on the dashboard and can navigate directly to quest-relevant views. The widget shows today's quests, XP progress, current level, Runen balance, and streak count. It is opt-in only — invisible to users who haven't activated gamification. Clicking a quest opens the filtered view relevant to that quest.

</domain>

<decisions>
## Implementation Decisions

### Widget Layout & Content
- Compact summary card style inside a single GlassCard
- Header row: level title + XP progress bar + inline badges for streak and Runen
- Body: today's quests as a checklist, each item showing title + progress fraction + XP/Runen reward
- Completed quests get a checkmark visual indicator

### XP Progress Bar
- Claude's discretion on bar style (thin/thick, gradient, colors) — must fit existing glass UI aesthetic

### Quest Item Display
- Full info per quest: "5 Fristen erledigen — 3/5 • 50 XP"
- Completed quests show checkmark + earned rewards

### Streak & Runen Display
- Inline badges in the card header row alongside the level title (pill-shaped badges)

### Quest Deep-Link Targets
- Clicking a quest navigates to an exact filtered view
- Convention-based URL mapping from quest condition: model=KalenderEintrag → /kalender, model=Ticket → /tickets, model=Rechnung → /finanzen/rechnungen, model=AktenActivity → /akten
- Query parameters derived from condition.where and condition.period (e.g. ?typ=FRIST&datum=heute)
- Same-tab navigation via Next.js router (consistent with sidebar links)

### Completed Quest Clickability
- Claude's discretion on whether completed quests remain clickable or become static

### Opt-In Visibility
- Widget does NOT render at all when gamificationOptIn is false — no placeholder, no empty space, as if it doesn't exist
- Dashboard layout shifts naturally (no reserved space)

### Opt-In Toggle Location
- Claude's discretion — check if /einstellungen already has a gamification toggle; if not, add a simple one

### Loading Behavior
- Claude's discretion on loading skeleton vs. absent-until-loaded, considering the server/client component split

### Error Handling
- Graceful degradation: widget silently disappears on API error, rest of dashboard renders normally
- Console error logged for debugging

### Widget Placement & Sizing
- Positioned below KPI cards grid, above Tagesuebersicht panel
- Dashboard order: Welcome → KPI cards → Quest Widget → Tagesuebersicht → 2-col grid

### Widget Width & Collapsibility
- Claude's discretion on full-width vs. half-width and whether to include a collapse toggle

### Empty State (All Quests Done / No Quests)
- Claude's discretion on showing a celebratory message vs. stats-only view

### Claude's Discretion
- XP progress bar visual design (style, gradient, thickness)
- Streak/Runen badge visual design
- Loading skeleton vs. absent-until-loaded approach
- Widget width (full vs. half)
- Collapsible toggle (yes/no, persistence)
- Empty state design (celebratory vs. stats-only)
- Completed quest clickability
- Opt-in toggle in settings (add if missing)

</decisions>

<specifics>
## Specific Ideas

- Quest items should feel informational and actionable — "at a glance I know what to do and how far along I am"
- The widget should not dominate the dashboard — it's a helpful addition, not the main feature

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GlassCard` component (`src/components/ui/glass-card.tsx`): Two variants (default 16px blur, elevated 40px blur)
- `GlassKpiCard` component (`src/components/ui/glass-kpi-card.tsx`): Animated number counter, supports skeleton loading state, 4 color variants
- `GlassPanel` component: Used for Tagesuebersicht wrapping
- No existing progress bar component — needs to be created

### Established Patterns
- Dashboard page is a **server component** (`src/app/(dashboard)/dashboard/page.tsx`) — quest widget will likely need a client component for interactivity
- KPI cards use animated counters with `motion/react`
- Color coding: risk-based (emerald=niedrig, amber=mittel, rose=hoch)
- Glass UI with oklch colors, 4 blur tiers

### Gamification Backend (Phase 33)
- `GET /api/gamification/profile` — returns XP, level, levelTitle, runen, streakTage, progress (0-1)
- `gamificationOptIn` flag on User model (checked server-side)
- `Quest` model with `bedingung` JSON (QuestCondition DSL: model, where, dateField, userField, count, period)
- `QuestCompletion` model tracks per-user per-quest daily completions
- `quest-service.ts` → `checkQuestsForUser()` evaluates all active DAILY quests
- `quest-evaluator.ts` → evaluates individual quest conditions
- Level tiers: 300/500/800 XP per level, titles from "Junior Workflow" to "Kanzlei-Operator"
- Streak: consecutive workdays with completions, skips weekends/holidays/vacation

### Integration Points
- Dashboard page (`src/app/(dashboard)/dashboard/page.tsx`): Insert widget between KPI grid and Tagesuebersicht
- Sidebar (`src/components/layout/sidebar.tsx`): No changes needed
- Settings page (`src/app/(dashboard)/einstellungen/`): May need gamification toggle
- Need new API endpoint or extend existing one to return today's quests with progress for the widget

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 34-dashboard-widget-quest-deep-links*
*Context gathered: 2026-03-02*
