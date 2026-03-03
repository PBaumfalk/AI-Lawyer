# Phase 33: Gamification Schema + Quest Engine - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Prisma schema for gamification (UserGameProfile, Quest, QuestCompletion, enums), XP/Level/Runen/Streak calculation engine, Quest condition DSL evaluator that checks against real business data, BullMQ crons (daily reset 00:05, nightly safety net 23:55), and DSGVO-compliant opt-in architecture. No UI in this phase — that's Phase 34.

</domain>

<decisions>
## Implementation Decisions

### Quest DSL Design
- Simple count-based conditions for Phase 1: `{"model": "KalenderEintrag", "where": {"status": "ERLEDIGT", "typ": "FRIST"}, "count": 5, "period": "today"}`
- Period types: "today", "thisWeek", "thisMonth" — evaluator calculates date ranges
- Each quest has one condition object — composite AND/OR deferred to Phase 37 when Weekly Quests need it
- Evaluator runs Prisma COUNT query against the specified model with where-clause + date filter + userId
- 5 hardcoded Daily Quests from todo: "Die Siegel des Tages" (Fristen), "Die Chroniken entwirren" (Wiedervorlagen), "Prägung der Münzen" (Rechnungen), "Ordnung im Skriptorium" (Akten nächster Schritt), "Bote der Klarheit" (Anfragen beantwortet)

### XP/Level Curve
- Steigende Schwelle: Level 1-10 = 300 XP/Level, Level 11-20 = 500 XP/Level, Level 21+ = 800 XP/Level
- Function: `getRequiredXp(level)` returns cumulative XP threshold
- Level titles from todo: "Junior Workflow" (1-10), "Workflow Stabil" (11-20), "Backlog Controller" (21-30), "Billing Driver" (31-40), "Kanzlei-Operator" (41-50)

### Opt-in Mechanism
- Admin activates gamification globally (SystemSetting `gamification.enabled`)
- Individual users can deactivate via Profil-Settings toggle
- GameProfile created lazily on first opt-in (not for every user automatically)
- Klasse auto-assigned from RBAC role at profile creation: ANWALT→JURIST, SACHBEARBEITER→SCHREIBER, SEKRETARIAT→WAECHTER, ADMIN→QUARTIERMEISTER

### Fantasy Theming
- Full Fantasy as specified in the todo — "Die Siegel des Tages", "Wustwurm", "Runen", "Skriptorium"
- Level titles are sachlich (not fantasy) for professional context
- IP-free names only (no Tolkien/Star Wars references)

### Streak Logic
- Streak counts consecutive workdays where at least one Kernquest was completed
- Workdays = Monday-Friday minus Feiertage (use existing Feiertagskalender from frist-berechnung)
- Urlaub/Abwesenheit: check against existing calendar entries with type ABWESENHEIT — automatic freeze, no manual toggle needed
- Streak bonuses: 3 days = +10% Runen, 7 days = +25% Runen (applied as multiplier on quest rewards)

### Fire-and-Forget Quest Check
- `checkQuestsForUser(userId)` called at end of business API routes (e.g. after Wiedervorlage status change, Rechnung creation)
- Wrapped in `.catch(() => {})` — never blocks business operation
- Alternatively: enqueue to BullMQ `gamification` queue for async evaluation (preferred for isolation)
- Nightly cron at 23:55 as safety net catches anything missed

### DSGVO Architecture
- UserGameProfile linked via userId (FK to User)
- No cross-user query paths in API routes — endpoint returns only own profile
- Team aggregates in Phase 41 use GROUP BY without individual attribution
- `gamificationOptIn: Boolean @default(false)` on User model
- Cascade delete: User deletion → GameProfile + QuestCompletions deleted

### Claude's Discretion
- Exact Prisma model field names and indexes
- BullMQ queue naming and job data structure
- Whether quest check is inline `.catch()` or BullMQ async (recommend BullMQ for isolation)
- Seed data format for 5 initial quests
- Nightly cron: whether to use existing worker process or separate

</decisions>

<specifics>
## Specific Ideas

- Quest rewards from todo: "Siegel" = 80 XP / 8 Runen, "Chroniken" = 60 XP / 12 Runen, "Münzen" = 60 XP / 10 Runen, "Skriptorium" = 40 XP / 5 Runen, "Bote" = 30 XP / 4 Runen
- Streak bonus is a multiplier on Runen only (not XP)
- Atomic increments: always use `prisma.userGameProfile.update({ where: { userId }, data: { xp: { increment: reward }, runen: { increment: runenReward } } })` — never read-modify-write
- Follow seedFalldatenTemplates pattern for quest seed (SystemSetting version guard + ADMIN user lookup)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/queue/queues.ts`: 8+ existing cron jobs with `upsertJobScheduler` pattern — gamification crons follow identical pattern
- `src/lib/frist-berechnung.ts`: Feiertagskalender (per Bundesland) — reuse for streak workday calculation
- `prisma/schema.prisma`: 80+ models, enum pattern established (German uppercase: `OFFEN`, `ERLEDIGT`)
- `src/lib/db.ts`: Extended Prisma client with `$extends` — use for business invariants if needed
- `prisma/seed.ts` + `seedFalldatenTemplates`: Idempotent seed pattern with SystemSetting version guard

### Established Patterns
- BullMQ workers in `src/lib/queue/processors/` — one file per processor
- Queue registration in `queues.ts` with typed `Queue<T>` generics
- Socket.IO emitter via `getSocketEmitter()` from worker process
- API routes: Zod validation, auth check at handler start, JSON response
- Prisma Json columns: 10+ existing uses (Quest.bedingung follows same pattern)

### Integration Points
- Quest check hooks into: `/api/kalender/[id]/route.ts` (Frist erledigt), `/api/wiedervorlagen/` (WV update), `/api/rechnungen/` (Rechnung erstellt), `/api/akten/[id]/route.ts` (Akte update)
- Worker startup in `src/lib/queue/worker.ts` — register gamification processor + cron here
- User model in `prisma/schema.prisma` — add `gamificationOptIn` field + GameProfile relation

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 33-gamification-schema-quest-engine*
*Context gathered: 2026-03-02*
