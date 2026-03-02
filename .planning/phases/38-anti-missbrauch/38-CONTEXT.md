# Phase 38: Anti-Missbrauch - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Quality-gate quest completions so gaming the system is harder than doing the actual work. Four requirements: qualified WV completion validation (ABUSE-01), daily Runen cap with Redis enforcement (ABUSE-02), random audit sampling with user confirmation (ABUSE-03), and atomic increment hardening with tightened DB constraints (ABUSE-04). No new quest types, no new UI pages — extends existing gamification infrastructure with anti-abuse measures.

</domain>

<decisions>
## Implementation Decisions

### Qualification Enforcement (ABUSE-01)
- Reuse existing `erledigungsgrund` field on KalenderEintrag for Wiedervorlage Vermerk (currently only used for FRIST — extend to WIEDERVORLAGE)
- Enforcement happens in the quest evaluator only — business logic (WV completion API) stays unchanged. A WV can still be completed without a Vermerk; it just won't count for quests
- Quest evaluator adds additional where-clause checks: `erledigungsgrund` must exist and have 30+ characters
- Follow-up WV is a bonus only: if a new WV was created for the same Akte within the same day, award bonus Runen. Not having one is fine — the quest still counts
- No minimum age check on the WV — the Vermerk requirement (30+ chars of real content) is sufficient friction against instant create-complete farming

### Daily Runen Cap (ABUSE-02)
- Max 40 Runen/day from Wiedervorlage quests specifically — Fristen, Rechnungen, and other quest types are uncapped
- Beyond the cap: XP is still awarded, only Runen are capped
- Admin-configurable via SystemSetting `gamification.daily_runen_cap` (default: 40). Follows existing rate-limiter pattern
- Show indicator only when near or at cap: at 80%+ (32+ Runen), show subtle hint in quest widget; at cap, show "Runen-Limit erreicht — XP wird weiterhin vergeben"
- Completion toast reflects cap: "+60 XP (Runen-Limit erreicht)" when Runen would have been awarded but cap is hit
- Redis INCR + EXPIRE pattern for cap enforcement: `gamification:daily-runen:{userId}:{YYYYMMDD}` key with 86400s TTL. Fail-open if Redis unavailable (awards Runen without cap)

### Random Audits (ABUSE-03)
- 1-3% of quest completions are randomly flagged for audit
- Audit prompt appears immediately on completion, before rewards are credited
- UI: Sonner toast with action buttons — "Stichproben-Prüfung: Erledigung bestätigen?" with Bestätigen / Zurücknehmen buttons
- If confirmed: rewards are credited normally
- If declined: no rewards, quest completion is not recorded
- If ignored (no response within 24 hours): auto-confirm, rewards stay. Most lenient approach
- No admin audit view needed — audits are a deterrent mechanism only, not a reporting system
- Audit state tracked on QuestCompletion or a flag field, not a separate model

### Hardening (ABUSE-04)
- Wrap `awardRewards()` + `questCompletion.create()` in `prisma.$transaction` — if either fails, both roll back
- Tighten QuestCompletion unique constraint: add `@@unique([userId, questId, completedDate])` where `completedDate` is a DATE (not DateTime). Current unique includes millisecond timestamp which allows duplicates within the same dedup window
- Keep existing Prisma `{ increment: N }` pattern for XP/Runen (already atomic at SQL level)
- Redis INCR for daily cap is naturally atomic (single Redis command)

### Claude's Discretion
- Exact Redis key format and TTL handling for cap counter
- How to compute `completedDate` as DATE in the unique constraint (generated column vs application logic)
- Audit flag probability implementation (random number in BullMQ worker vs application layer)
- Toast styling and duration for audit prompt
- Whether follow-up WV bonus needs its own QuestCondition type or is a modifier on existing conditions
- Migration strategy for tightening the QuestCompletion unique constraint on existing data

</decisions>

<specifics>
## Specific Ideas

- Follow existing `rate-limiter.ts` INCR+EXPIRE pattern exactly for Runen cap — proven, fail-open, lazy Redis singleton
- Audit toast uses Sonner's action toast pattern (already used throughout the app)
- The 30+ char Vermerk check in the quest evaluator extends the existing `CountCondition.where` object — no new condition type needed
- SystemSetting for cap follows same pattern as `ai.helena.rate_limit_per_hour`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/helena/rate-limiter.ts`: Complete Redis INCR+EXPIRE pattern with fail-open, lazy singleton, SystemSettings-configurable limit — direct template for daily Runen cap
- `src/lib/gamification/quest-evaluator.ts`: `evaluateQuestCondition()` with `CountCondition.where` as `Record<string, string | boolean>` — extend for Vermerk length check
- `src/lib/gamification/quest-service.ts`: `checkQuestsForUser()` orchestrator — add cap check and audit sampling here
- `src/lib/gamification/game-profile-service.ts`: `awardRewards()` with Prisma `{ increment }` — wrap in $transaction
- `gamificationQueue` in `queues.ts`: BullMQ queue with `attempts: 1`, ready for new job types
- Sonner toast system: Action toasts with buttons used throughout the app

### Established Patterns
- Fire-and-forget quest evaluation via BullMQ (`enqueueQuestCheck`)
- Dedup via `QuestCompletion` with date-based uniqueness windows (daily/weekly/special)
- SystemSetting for configurable limits (`getSettingTyped<number>()`)
- `prisma.$transaction` used in boss engine for atomic HP mutations
- Redis lazy singleton with `lazyConnect: true` and `enableOfflineQueue: false`

### Integration Points
- `quest-service.ts checkQuestsForUser()`: Main orchestrator — add qualified completion check, cap enforcement, audit sampling
- `quest-evaluator.ts evaluateQuestCondition()`: Extend where-clause handling for string length validation
- `game-profile-service.ts awardRewards()`: Wrap in $transaction with QuestCompletion creation
- `QuestCompletion` model in schema.prisma: Add completedDate field + tightened unique constraint
- `KalenderEintrag.erledigungsgrund`: Extend usage from FRIST-only to also WIEDERVORLAGE
- Quest widget (`quest-widget.tsx`): Add cap indicator near WV quest section
- Dashboard API (`/api/gamification/dashboard`): Return daily Runen usage for cap display

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 38-anti-missbrauch*
*Context gathered: 2026-03-02*
