# Phase 35: Bossfight - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The team fights a shared Backlog-Monster whose HP reflects real open Wiedervorlagen. Clearing Wiedervorlagen deals damage. Boss progresses through 4 phases with escalating Runen rewards. Admin configures activation threshold. Victory grants collective Legendary trophy.

</domain>

<decisions>
## Implementation Decisions

### Boss Visual & Dashboard Placement
- Full-width GlassCard **top banner** at the very top of the dashboard, above KPIs
- Boss only renders when active; when inactive, show a **teaser card** with current Wiedervorlage backlog count + threshold ("Noch 12 bis zum nächsten Boss")
- Themed **Lucide icon** per boss phase (e.g. Skull, Bug, Flame) — icon changes at phase transitions
- **Animated HP bar** with color transitions: green → amber → rose as HP drops
- **Named bosses from a pool** of 5-10 German-themed names (e.g. "Der Aktenberg", "Fristenfresser", "Backlog-Krake") — each spawn picks one randomly

### HP & Damage Mechanics
- **1:1 HP mapping**: Boss HP = number of open Wiedervorlagen at spawn. Clearing 1 WV = 1 damage
- **Boss heals**: New Wiedervorlagen created during an active fight ADD HP to the boss (boss fights back)
- **Damage trigger**: Setting `erledigt=true` on a KalenderEintrag with `typ=WIEDERVORLAGE`
- **Per-user damage tracking**: BossfightDamage table records userId + timestamp for each point of damage dealt

### Boss Phase Progression & Rewards
- **HP threshold transitions**: Phase 2 at 75% HP, Phase 3 at 50% HP, Phase 4 at 25% HP
- **Dual reward structure**:
  - Per-hit Runen multiplier: Phase 1 = base, Phase 2 = 1.5x, Phase 3 = 2x, Phase 4 = 3x
  - Team-wide Runen bonus at each phase transition (flat amount to ALL team members)
- **Phase 4 victory**: Legendary trophy entry on every participant's GameProfile + significant one-time XP bonus for all
- **No timeout**: Boss persists until defeated. HP fluctuates with incoming/outgoing Wiedervorlagen

### Team Damage Feed & Celebration
- **Damage ticker** inside the boss banner: scrolling feed of "⚔ Max hat 1 WV erledigt (-1 HP)" with timestamps
- **Top 3 leaderboard** in the banner showing damage dealers during the active fight, real-time via Socket.IO
- **Victory celebration**: Banner transforms into victory banner with confetti animation, shows MVP (top damage), total team damage, Runen earned. Stays ~30 seconds, then transitions to trophy display
- Real-time updates via **Socket.IO broadcast** to all connected clients (Redis emitter pattern)

### Admin Configuration
- **Threshold + cooldown** in Einstellungen under Gamification tab
- Admin sets spawn threshold: "Boss spawns when open Wiedervorlagen exceed X" (default e.g. 30)
- Minimum cooldown between bosses (e.g. 24h after last defeat before a new boss can spawn)

### Claude's Discretion
- Exact boss name pool and icon-per-phase mapping
- Confetti animation implementation details
- Exact Runen amounts for phase bonuses and base per-hit rewards
- Damage ticker scroll behavior and max visible entries
- Trophy display format on GameProfile

</decisions>

<specifics>
## Specific Ideas

- Boss names should be German legal/office themed: "Der Aktenberg", "Fristenfresser", "Backlog-Krake", "Papierdrache"
- HP bar should feel like a game health bar — not just a progress bar. Color transitions matter.
- Teaser state ("Noch X bis zum Boss") builds anticipation and motivates proactive WV clearing
- Victory confetti should feel earned — the team worked together to defeat the monster

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GlassCard`, `GlassKpiCard`, `GlassPanel`: Glass UI components for dashboard layout
- `QuestWidget`: Existing self-fetching dashboard widget pattern (fetch → render → graceful degradation)
- `UserGameProfile`: XP, Runen, streakTage, SpielKlasse — existing gamification profile
- `Quest` + `QuestCompletion`: Existing reward tracking pattern (xpVerdient, runenVerdient)
- `game-profile-service.ts`: XP/level calculation, Runen tracking, streak logic — extend for boss rewards
- `XpProgressBar`: Existing animated progress bar component

### Established Patterns
- Socket.IO rooms: `user:{userId}`, `role:{ROLE}` for broadcasting — use `role:*` for team-wide boss updates
- Redis emitter (`getSocketEmitter()`): Worker process emits to browser clients without direct Socket.IO server connection
- `SocketProvider` context: Client-side Socket.IO connection with auth, reconnection, session-based
- KalenderEintrag with `typ: "WIEDERVORLAGE"` and `erledigt` boolean — existing data model for damage triggers
- Sonner toast system for notifications
- Dashboard page is a server component with parallel data fetching (`Promise.all`)

### Integration Points
- Dashboard page (`src/app/(dashboard)/dashboard/page.tsx`): Add BossfightBanner above existing KPI cards
- KalenderEintrag update routes: Hook into erledigt=true events to trigger damage
- Gamification processor (`src/lib/queue/processors/gamification.processor.ts`): Extend for boss damage events
- Einstellungen page (`src/app/(dashboard)/einstellungen/page.tsx`): Add Gamification tab for admin config
- Socket.IO rooms (`src/lib/socket/rooms.ts`): May need a `boss:{bossfightId}` room or reuse `role:*` broadcast

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 35-bossfight*
*Context gathered: 2026-03-02*
