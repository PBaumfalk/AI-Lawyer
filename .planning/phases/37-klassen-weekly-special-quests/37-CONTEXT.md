# Phase 37: Klassen + Weekly + Special Quests - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Tailor quests to RBAC roles (Klassen), add weekly quests with aggregate conditions, and add admin-configurable time-limited Special Quests. Extends the existing daily quest system (Phase 33) without changing core gamification mechanics (XP, levels, streaks, bossfight).

</domain>

<decisions>
## Implementation Decisions

### Role-Quest Filtering (QUEST-04)
- Add nullable `klasse` field (SpielKlasse?) to Quest model — null means all roles, specific value means class-exclusive
- Class-themed content: each role gets quests with different names and descriptions matching their daily work (e.g. JURIST gets Fristen-themed quests, SCHREIBER gets Rechnungs-themed)
- Reassign existing 5 daily quests to their natural classes (based on which models they query) and add new class-specific ones
- 3 daily quests per class (total seed pool: ~12 quests)
- `checkQuestsForUser()` must filter quests by user's SpielKlasse (via `roleToKlasse()`) in addition to quest type

### Weekly Quest Behavior (QUEST-05)
- Weekly quests are always visible (all 7 days), reset Monday 00:00 via existing `thisWeek` period
- Extend QuestCondition DSL with a new condition type for delta/ratio changes (e.g. "reduce open tickets by 20%") — needs new evaluator path comparing start-of-week snapshot vs current count
- Mix of universal (klasse=null) and class-specific weekly quests
- Show all matching weekly quests to the user (no fixed cap)

### Special Quest Admin UI (QUEST-06)
- Admin UI lives in the Einstellungen page as a Gamification settings tab/section
- Full CRUD with fields: name, Beschreibung, start date, end date, XP reward, Runen reward, target roles (all or specific SpielKlasse), condition (from preset templates)
- Condition builder uses preset templates (e.g. "Fristen erledigen", "Rechnungen erstellen", "Tickets bearbeiten") — admin picks template and sets target count
- Auto-hide from widget after end date passes; completions remain in history; no manual cleanup needed
- Quest model needs `startDatum` and `endDatum` fields (nullable, only used for SPECIAL type)

### Quest Widget Sections
- Grouped sections with headers: "Tagesquests", "Wochenquests", "Special" — all visible at once, separated by dividers
- Special Quest section gets a subtle accent border (amber/gold left border) to draw attention
- Special quests show a countdown badge with remaining days (e.g. "3 Tage verbleibend")
- Hide empty sections entirely (e.g. no Special section if no active special quests)

### Claude's Discretion
- Exact quest names and XP/Runen balancing for new class-specific quests
- Delta/ratio evaluator implementation details (snapshot storage approach)
- Preset template list for special quest condition builder
- Exact styling of section headers, dividers, and accent borders within oklch Glass UI system
- Weekly quest completion dedup strategy (weekly completions vs daily re-evaluation)

</decisions>

<specifics>
## Specific Ideas

- Existing `QuestTyp` enum already has DAILY, WEEKLY, SPECIAL values — no schema enum change needed
- `roleToKlasse()` mapping in types.ts already maps UserRole to SpielKlasse
- Weekly "Backlog -20%" style quests need a baseline snapshot mechanism (count at week start vs current)
- Preset templates for admin should map directly to QuestCondition JSON — admin never writes raw JSON

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `QuestCondition` DSL (types.ts): JSON schema for quest conditions — extend with delta/ratio type
- `evaluateQuestCondition()` (quest-evaluator.ts): Evaluation engine — add delta evaluator path
- `QuestWidget` (quest-widget.tsx): Dashboard widget in GlassCard — refactor for grouped sections
- `seedDailyQuests()` (seed-quests.ts): Idempotent seeder with version guard — extend for weekly + class quests
- `roleToKlasse()` (types.ts): Role-to-class mapping already implemented
- `buildQuestDeepLink()` (quest-deep-link.ts): Deep link generation per quest condition

### Established Patterns
- Fire-and-forget quest evaluation via BullMQ (`enqueueQuestCheck`)
- Dedup via `QuestCompletion` with date-based uniqueness
- Seed version guard pattern (`SystemSetting` key check)
- `countForModel()` explicit switch dispatch (not dynamic prisma[model])
- GlassCard + oklch Glass UI for all dashboard widgets

### Integration Points
- `checkQuestsForUser()` in quest-service.ts — must be extended to handle WEEKLY and filter by klasse
- `/api/gamification/dashboard` route — must return quests grouped by type
- Einstellungen page — add gamification/special quest admin section
- Nightly cron (23:55) — may need weekly snapshot creation for delta conditions
- Quest model in schema.prisma — add klasse, startDatum, endDatum fields

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 37-klassen-weekly-special-quests*
*Context gathered: 2026-03-02*
