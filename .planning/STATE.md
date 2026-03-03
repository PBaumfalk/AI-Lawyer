---
gsd_state_version: 1.0
milestone: v0.4
milestone_name: Quest & Polish
status: in-progress
last_updated: "2026-03-03T06:14:14Z"
progress:
  total_phases: 21
  completed_phases: 20
  total_plans: 56
  completed_plans: 57
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollstaendig im Browser verwalten, waehrend eine autonome KI-Agentin aktenuebergreifend lernt und als digitale Rechtsanwaltsfachangestellte mitarbeitet.
**Current focus:** v0.4 Quest & Polish -- Phase 39 IN PROGRESS (Item-Shop + Inventar)

## Current Position

Phase: 39 of 41 (Item-Shop + Inventar) -- 7 of 9 in milestone IN PROGRESS
Plan: 1 of 2 in current phase COMPLETE
Status: Plan 39-01 Complete
Last activity: 2026-03-03 -- Completed 39-01 (Item-Shop Backend)

Progress: [████████░░] 83% (15/18 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 117 (v3.4:38 + v3.5:10 + v0.1:19 + v0.2:23 + v0.3:13 + v0.4:14)
- Average duration: ~15 min
- Total execution time: ~26 hours

**By Milestone:**

| Milestone | Phases | Plans | Timeline |
|-----------|--------|-------|----------|
| v3.4 | 13 | 38 | 2 days |
| v3.5 | 2 | 10 | 2 days |
| v0.1 | 7 | 19 | 2 days |
| v0.2 | 10 | 23 | 2 days |
| v0.3 | 5 | 13 | 3 days |

**Recent Trend:**
- Last milestone (v0.3): 13 plans, avg ~3.4 min/plan
- Trend: Stable
| Phase 34 P01 | 3min | 2 tasks | 5 files |
| Phase 35 P01 | 14min | 2 tasks | 14 files |
| Phase 35 P02 | 4min | 2 tasks | 9 files |
| Phase 35 P03 | 2min | 1 tasks | 2 files |
| Phase 36 P01 | 5min | 2 tasks | 8 files |
| Phase 36 P02 | 3min | 2 tasks | 5 files |
| Phase 37 P01 | 6min | 2 tasks | 11 files |
| Phase 37 P02 | 4min | 2 tasks | 6 files |
| Phase 38 P01 | 4min | 2 tasks | 9 files |
| Phase 38 P02 | 2min | 2 tasks | 6 files |
| Phase 39 P01 | 4min | 2 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v0.4 roadmap]: DSGVO compliance baked into Phase 33 schema (opt-in field, self-only visibility)
- [v0.4 roadmap]: Quick Wins (Phase 36) independent of gamification -- can run in parallel
- [v0.4 roadmap]: Item-Shop after Anti-Missbrauch (Runen cap must exist before spending)
- [v0.4 roadmap]: Team-Dashboard last (needs accumulated quest completion data)
- [33-01]: QuestCondition DSL stores evaluation rules as JSON -- evaluator in Plan 02 will interpret
- [33-01]: Manual migration SQL created (Docker not running) -- apply on next deploy
- [33-02]: gamificationOptIn queried from DB in API route (not in session token)
- [33-02]: enqueueQuestCheck uses direct .catch() fallback until Plan 03 wires BullMQ
- [33-03]: Gamification queue uses attempts:1 (idempotent, no retry needed)
- [33-03]: Hourly dedup via jobId prevents redundant quest checks per user
- [33-03]: Nightly safety net processes users sequentially (kanzlei-scale: <50 users)
- [34-02]: Combined GET+PATCH in single opt-in route for fetch simplicity
- [34-02]: Auto-create GameProfile on opt-in enable so widget works immediately
- [34-02]: Only KalenderListe needs searchParams init -- Tickets already has server-side params
- [Phase 34]: Widget uses absent-until-loaded pattern (returns null until fetch completes) to avoid layout shift
- [Phase 34]: API returns 404 for opted-out users; widget treats 404 as opt-out signal and renders nothing
- [Phase 34]: Deep-link builder uses static MODEL_TO_PATH lookup with URLSearchParams from condition.where
- [35-01]: Boss HP mutations use Prisma $transaction with atomic decrement/increment to prevent race conditions
- [35-01]: Phase transition rewards tracked via bitmask (phaseRewardsGiven) to prevent duplicate awards
- [35-01]: Kanzlei room (kanzlei:{kanzleiId}) used for team-wide broadcasts instead of role-based rooms
- [35-01]: Boss spawn check runs both in nightly cron AND on-demand after new WV creation
- [35-02]: BossfightBanner uses self-fetching absent-until-loaded pattern (same as QuestWidget)
- [35-02]: Socket.IO events overlay real-time state on top of initial fetch (no polling)
- [35-02]: canvas-confetti is the only new npm dependency for bossfight UI (6KB, fire-and-forget)
- [35-03]: All event shape fixes on emitter/API side only -- consumer components left untouched
- [35-03]: totalDamage uses aggregate query across all participants for accurate defeat stats
- [35-03]: runenEarned in boss:defeated uses VICTORY_RUNEN_BONUS constant for consistency
- [36-01]: EmptyState in message-list.tsx (not akte-channel-tab.tsx) since MessageView has visible composer even when empty
- [36-01]: Controlled/uncontrolled pattern for AkteDetailTabs so it works both standalone and with external KPI control
- [36-01]: Zeiterfassung EmptyState inside td colSpan to preserve table structure
- [36-02]: Vision-Analyse only for image MIME types (not PDFs) per research pitfall guidance
- [36-02]: Manual text entry uses inline expanding textarea (not modal) per user decision
- [36-02]: Category dropdown saves on selection for minimal friction (no separate save button)
- [37-01]: QuestCondition union type with optional type? field for backward compat (existing quests treated as count)
- [37-01]: WeeklySnapshot model with compound unique (model, weekStart, userId) for delta baselines
- [37-01]: Dashboard API returns grouped quests { daily, weekly, special } instead of flat array
- [37-01]: Widget temporarily flattens grouped response; Plan 02 adds proper section headers
- [Phase 37]: QuestSection is a separate reusable component (not inlined in QuestWidget) for clean separation
- [Phase 37]: Condition templates defined server-side and sent to client -- admin never writes raw JSON
- [38-01]: Redis INCR+EXPIRE for daily Runen cap (mirrors rate-limiter.ts pattern, fail-open)
- [38-01]: findMany + JS filter for WV 30+ char check (Prisma lacks string length WHERE)
- [38-01]: Runen cap on WV quests only; P2002 catch for concurrent idempotent completions
- [38-01]: completedDate (DATE-only) replaces completedAt in unique constraint for tighter dedup
- [38-02]: 2% audit rate (Math.random < 0.02) as midpoint of 1-3% range from CONTEXT.md
- [38-02]: Toast duration: Infinity -- server-side 24h auto-confirm is the real timeout
- [38-02]: Audit listener mounted in SocketProvider (global) not QuestWidget (page-specific)
- [39-01]: Atomic Runen decrement via $transaction prevents race conditions on purchase
- [39-01]: Level 25 gate checked inside $transaction for LEGENDARY items
- [39-01]: Perk side-effects (streak-schutz, doppel-runen) tracked by consumed inventory item -- full integration deferred
- [39-01]: FOKUSZEIT KalenderEintrag created on fokus-siegel activation with 30-min window

### Pending Todos

Deferred from previous milestones (not in v0.4 scope):
- BI-Dashboard -- deferred to post-v0.4
- Export CSV/XLSX -- deferred to post-v0.4

### Blockers/Concerns

- Streak Feiertagskalender: RESOLVED -- uses existing istFeiertag() from feiertagejs + Bundesland from SystemSetting
- OCR Vision fallback: RESOLVED -- Vision API endpoint uses Buffer from MinIO stream directly (not presigned URL), tested via AI SDK generateText with image content
- Bossfight activation trigger: RESOLVED -- automatic dual trigger (nightly cron + on-demand after WV creation), admin configures threshold

## Session Continuity

Last session: 2026-03-03
Stopped at: Completed 39-01-PLAN.md
Resume file: .planning/phases/39-item-shop-inventar/39-01-SUMMARY.md
