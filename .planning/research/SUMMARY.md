# Project Research Summary

**Project:** AI-Lawyer v0.4 -- Gamification + UX Quick Wins
**Domain:** Enterprise Kanzleisoftware Gamification (Quests, XP, Bossfight, Item Shop, Team Dashboard) + UX Quick Wins (Clickable KPIs, Empty States, OCR Recovery)
**Researched:** 2026-03-02
**Confidence:** HIGH

## Executive Summary

v0.4 adds a gamification layer (Quests, XP/Levels, Streaks, Bossfight, Item Shop, Team Dashboard) and targeted UX improvements (clickable KPI cards, empty states, OCR recovery flow) to the existing 125k LOC TypeScript codebase. The architectural foundation is already in place: the gamification engine builds entirely on existing Prisma, BullMQ, Socket.IO, Redis, and Motion/React infrastructure. Only two small new packages are required -- `canvas-confetti` (6.3 kB) for celebration effects and `@radix-ui/react-progress` via shadcn/ui for XP bars and HP bars. All quest logic, XP calculation, streak tracking, and bossfight mechanics are implemented as custom server-side TypeScript using a JSON condition DSL evaluated against Prisma queries -- no gamification SaaS, no external game engine, no state machine library.

The critical architectural decision is that gamification is a **read-only observation layer** on top of existing business events: quest completion detection reads from KalenderEintrag, Rechnung, Wiedervorlage, and AktenActivity but never modifies them. This keeps integration hooks clean and avoids invasive changes to core legal workflow logic. The Quick Wins are surgical one-component changes (StatMini click handlers, empty state render branches, OCR banner UI) with zero schema changes required.

The most significant risk is not technical but legal: German DSGVO and BetrVG section 87 Abs. 1 Nr. 6 classify per-user gamification metrics as employee performance monitoring. The design must be compliance-first -- individual profiles visible only to the user themselves, team dashboard showing only anonymized aggregates, opt-in participation with genuine choice, and automatic data retention limits. Failure to encode these constraints in the data model from Phase 1 would require a full schema rewrite. Build DSGVO-compliant by default, not as an afterthought.

## Key Findings

### Recommended Stack

The existing stack handles all v0.4 requirements without major additions. All gamification infrastructure (cron scheduling, real-time push, relational data storage, atomic counters) is already operational via BullMQ (8 existing cron jobs with the exact `upsertJobScheduler` pattern needed), Socket.IO (room system already supports per-user and role-broadcast targeting), Redis (INCR + EXPIREAT for Runen-Deckel cap), and Prisma (80+ models with JSON column support for quest condition DSL).

**Core technologies (unchanged):**
- **Next.js 14+ App Router**: API routes for quest completion, game profile, item shop; dashboard widgets
- **Prisma ORM ^5.22.0**: 7 new models (UserGameProfile, Quest, QuestCompletion, Bossfight, BossfightDamage, ShopItem, InventarItem) + 4 new enums; atomic `{ increment }` operations prevent XP race conditions
- **BullMQ ^5.70.1**: Three new cron jobs (daily quest reset at 00:05, weekly reset at Mon 00:10, bossfight HP recalibration at 03:00) using established `upsertJobScheduler` pattern
- **Socket.IO + Redis**: 7 new event types (quest:completed, quest:progress, level:up, bossfight:damage, bossfight:phaseChange, bossfight:defeated, streak:update) using existing room conventions
- **Motion/React ^12.34.3**: XP bar spring animation, level-up scale pulse, quest card stagger -- extends existing usage in GlassKpiCard and modals
- **Redis 7**: Runen-Deckel daily cap via INCR + EXPIREAT (O(1), no DB round-trip)

**New dependencies (2 packages only):**
- **`canvas-confetti ^1.9.4`**: Quest completion and level-up celebrations; 6.3 kB, zero dependencies, actively maintained (6.8k GitHub stars)
- **`@radix-ui/react-progress ^1.1.0`**: XP bar and bossfight HP bar; part of existing Radix ecosystem (6 Radix packages already installed)

### Expected Features

Research identifies a clear MVP core plus two phases of depth. The gamification MVP is only coherent if all 5 components ship together (schema, quests, XP/Runen, dashboard widget, bossfight) -- partial gamification feels broken. Quick Wins ship alongside Phase 1 because they demonstrate immediate quality improvement and build trust that gamification is additive.

**Must have (table stakes):**
- XP + Level progression with visible progress bar -- core feedback loop, users need visible long-term progress
- 3-5 Daily Quests with machine-readable `bedingung` JSON verified against real Prisma data -- the make-or-break piece; unverified quests are worthless
- Dashboard Quest Widget (GlassCard) showing today's quests, XP bar, level, streak, Runen balance
- Bossfight "Backlog-Monster" team progress banner with HP bar and phase display
- Runen as separate spendable currency (never conflated with XP -- XP is earned progression, Runen are spent currency)
- Streak tracking with workday-aware pause logic (Urlaub, Krankheit, Feiertage do not break streaks)
- KPI cards (StatMini) clickable with tab navigation -- 30-minute fix with immediate daily UX impact
- Empty states (beA, E-Mails, Zeiterfassung, Nachrichten tabs) with icon + explanation + role-aware CTA
- OCR recovery banner with three actions: Retry OCR, Vision-Analyse (GPT-4o), Manual text entry

**Should have (differentiators):**
- Klassen-spezifische Quests mapped to RBAC roles (ANWALT sees Jurist quests, SEKRETARIAT sees Waechter quests)
- Bossfight phase mechanics with 4 escalating phases and Socket.IO phase-transition broadcasts
- Anti-Missbrauch: minimum Vermerk length (30 chars), Akte cool-down (48h per quest type), Runen-Deckel (40/day via Redis)
- Item Shop with cosmetic (RELIKT), comfort (ARTEFAKT), and prestige (TROPHAEE) items -- Runen need a meaningful purpose
- Weekly Quests for strategic goals ("Backlog -20% this week", "All abrechnungsreife Akten invoiced")
- Random Audit system (1-3% spot checks with `auditFlag` on QuestCompletion) -- subtle deterrent against gaming
- Async quest evaluation via BullMQ `quest-eval` queue (2s debounce) to keep API hot paths fast

**Defer (v2+):**
- Team Dashboard with aggregated metrics (needs weeks of accumulated QuestCompletion data to be meaningful)
- Special campaign quests
- Monthly reporting / BI integration
- Adaptive quest difficulty (needs baseline completion rate data from Phase 1)

**Anti-features (explicitly never build):**
- Public individual leaderboard -- toxic in 5-person team and legally problematic under BetrVG section 87
- Real-money or salary-linked rewards -- Arbeitsrecht violation risk (Verguetungsbestandteil)
- Mandatory participation or penalties for non-completion -- breeds resentment, undermines Berufsethos
- AI-generated quests -- unpredictable conditions, adds latency, unnecessary for 5 well-defined business routines
- Gamification of Helena AI usage -- incentivizes unnecessary AI calls, creates artificial dependency
- Purchasable XP or level boosts -- destroys level meaning

### Architecture Approach

Gamification is a standalone subsystem layered over existing business events, not woven into them. Quest evaluation runs in two modes: on-demand (enqueued as async BullMQ job with 2s debounce after qualifying user actions, to keep API response times fast) and nightly batch (23:55 cron evaluates all users as safety net). This dual-mode pattern eliminates the performance risk of synchronous quest evaluation on hot paths. All XP/Runen increments use Prisma atomic operations (`{ increment: n }`) to prevent race conditions on concurrent completions.

**Major components:**
1. **Quest Engine** (`src/lib/gamification/quest-evaluator.ts`) -- Pure TypeScript function ~150 LOC, evaluates JSON `bedingung` DSL against Prisma aggregation queries; returns `{ fulfilled, current, target }` per quest. Same pattern as v0.2 rule-based complexity classifier.
2. **GameProfile Service** (`src/lib/gamification/game-profile.ts`) -- XP/Level calculation (pure exponential functions), Runen cap check via Redis INCR, streak update logic with workday awareness integrated against existing `UrlaubZeitraum` model
3. **Gamification Worker** (`src/worker.ts` extension) -- Three new cron jobs: daily quest reset (00:05), weekly quest reset (Mon 00:10), bossfight HP recalibration (03:00); one new `gamification` queue for async on-demand evaluation with 2s debounce
4. **Dashboard Quest Widget** (`src/components/gamification/quest-widget.tsx`) -- Client component polling quest status every 30s (not event-driven), renders quest list + XP bar + streak + Runen balance + bossfight banner
5. **Bossfight Engine** -- Dynamic HP computed from live `COUNT(Wiedervorlage WHERE status='OFFEN')` against fixed `maxHp` baseline; boss "heals" when new items arrive, providing an honest metric that cannot be gamed by churn
6. **Quick Win patches** -- `GlassKpiCard`/`StatMini` onClick/href props (~10 LOC), per-tab `EmptyState` components reusing existing `email-empty-state.tsx` pattern, `OcrStatusBadge` extended with 8-state state machine to prevent orphaned jobs

**Key patterns:**
- JSON DSL for quest conditions (same pattern as `HelenaAlert.meta` and `FalldatenTemplate.schema`)
- Prisma atomic increments for all XP/Runen mutations -- never read-modify-write
- Redis INCR + EXPIREAT for daily Runen cap -- O(1) without DB round-trip
- `@@unique([profileId, questId, completionDate])` DB constraint as idempotency guard against double-completion
- RBAC-scoped data access: individual game profiles accessible only via `WHERE userId = session.user.id`

### Critical Pitfalls

1. **DSGVO/Arbeitsrecht compliance (Critical, must address before Phase 1 schema)** -- Per-user gamification data is legally classified as employee performance monitoring under section 87 Abs. 1 Nr. 6 BetrVG and DSGVO Art. 6. Prevention: individual profiles visible only to the user themselves (enforced at API level), team dashboard shows anonymized aggregates only, opt-in with `gameProfileOptedIn: Boolean @default(false)`, DSGVO Art. 13/14 transparency notice before first opt-in, 12-month data retention limit enforced by nightly cron.

2. **Goodhart's Law / Quest gaming (Critical, Phase 1)** -- Quantitative quest conditions invite optimization of the metric rather than actual work quality (e.g., setting meaningless "naechster Schritt" on 5 Akten in 10 minutes to earn XP). Prevention: minimum Vermerk length (30 chars), 48h Akte cool-down per quest type via `@@unique` constraint, outcome-based conditions over activity-based, launch with 3 quests not 5.

3. **XP/Runen race conditions (Moderate, Phase 1)** -- Concurrent quest completions cause read-modify-write races on `UserGameProfile.xp`. Prevention: always use Prisma atomic `{ increment: n }` operations, single `evaluateQuests(userId)` in a `$transaction`, `@@unique` DB constraint on `(profileId, questId, completionDate)` for idempotency.

4. **Bossfight HP drift from actual backlog (Moderate, Phase 1)** -- Treating bossfight HP as a simple decrement counter ignores new Wiedervorlage creation. The boss "wins" when backlog is still large. Prevention: dynamic HP computed from live COUNT query, nightly recalibration cron, victory condition based on configurable threshold (not HP=0), net damage display showing inflow/outflow.

5. **Toxic implicit ranking (Critical, Phase 3)** -- Even without an explicit leaderboard, showing per-person bossfight damage on the Team Dashboard creates an implicit ranking that demotivates lower performers and violates Pitfall 1 (DSGVO). Prevention: Team Dashboard shows only team totals, no "MVP" callouts, bossfight celebration is collective.

6. **Empty state CTAs leading to permission errors (Moderate, Quick Wins)** -- Role-unaware CTAs cause 403s (SACHBEARBEITER clicking "beA konfigurieren"). Prevention: render CTAs based on `useSession()` role check, design role-specific CTA variants, use informational-only empty states for restricted features.

7. **OCR recovery orphaned jobs and state conflicts (Moderate, Quick Wins)** -- Three recovery paths (Retry, Vision, Manual) are not mutually exclusive. Prevention: OCR status state machine with 8 states (PENDING | PROCESSING | COMPLETED | FAILED | RETRY_PENDING | RETRY_PROCESSING | VISION_PENDING | MANUAL_INPUT), cancel previous job before retry, manual input takes permanent precedence.

## Implications for Roadmap

Based on combined research, the milestone naturally splits into three phases with clear dependency ordering and effort estimates totaling ~50-70 hours.

### Phase 1: Foundation + MVP Gamification + All Quick Wins (~25-35 hours)

**Rationale:** DSGVO compliance constraints must be encoded in the schema before any subsequent work -- this is a compliance-first design constraint that shapes the entire data model. Quick Wins are 1-2 day fixes providing immediate visible improvement and ship alongside gamification to make the milestone feel substantial from day one. Gamification MVP needs all 5 components (schema, quests, XP, widget, bossfight) to feel coherent -- any subset feels broken.

**Delivers:** Working gamification system with 3-5 daily quests, XP/Level/Streak, Bossfight "Backlog-Monster" with real-time HP updates, and all UX quick wins

**Addresses features from FEATURES.md:**
- Prisma schema migration (UserGameProfile, Quest, QuestCompletion, Bossfight, BossfightDamage + 4 enums)
- Quest `bedingung` evaluator with anti-gaming qualifiers (min Vermerk length, Akte cool-down)
- XP/Runen/Level/Streak server-side computation with atomic Prisma increments
- Dashboard Quest Widget (GlassCard with XP bar, streak, Runen balance)
- Bossfight HP bar with dynamic live-count computation and Socket.IO real-time damage broadcasts
- KPI cards (StatMini) clickable, wired to tab state navigation
- Empty states for beA, E-Mails, Zeiterfassung, Nachrichten with role-aware CTAs
- OCR recovery banner with state machine (Retry / Vision / Manual)
- Nachrichten KPI rename/hide fix + Zeiterfassung description display fix

**Avoids pitfalls:**
- Pitfall 1 (DSGVO): schema encodes `gameProfileOptedIn`, individual-only data access at API level
- Pitfall 2 (Goodhart): minimum Vermerk length and Akte cool-down baked into quest condition schema
- Pitfall 3 (Race conditions): atomic increments + `$transaction` + `@@unique` idempotency
- Pitfall 4 (Bossfight drift): dynamic HP from live COUNT query + nightly recalibration cron
- Pitfall 6 (Empty state CTAs): role-aware rendering from day one via `useSession()`
- Pitfall 7 (OCR state): 8-state machine before recovery flow UI is built

### Phase 2: Gamification Depth (~15-22 hours)

**Rationale:** Phase 2 features depend on Phase 1 data to validate quest difficulty per role and observe whether gaming behavior emerges before adding anti-abuse enforcement. Item Shop requires Runen to accumulate over 2-4 weeks before purchasing is meaningful. Klassen-spezifische Quests need the base quest system proven first.

**Delivers:** Role-specific quests, weekly quests, full anti-abuse enforcement, Item Shop with purchase flow

**Addresses features from FEATURES.md:**
- Klassen-spezifische Quests per RBAC role (JURIST, SCHREIBER, WAECHTER, QUARTIERMEISTER)
- Weekly Quests with aggregate business metric conditions and weekly reset cron
- Full Runen-Deckel enforcement via Redis (40/day cap, already architected in Phase 1)
- Random Audit system (1-3% spot checks, `auditFlag` on QuestCompletion, audit UI modal)
- XP decay for undone completions (nightly BullMQ validation job)
- ShopItem catalog + InventarItem purchase flow (Prisma `$transaction` for atomic Runen deduction)
- Item activation (cosmetic frames, comfort perks like Fokus-Siegel)

**Uses stack from STACK.md:**
- BullMQ: weekly reset cron + audit validation job (same `upsertJobScheduler` pattern)
- Prisma `$transaction`: atomic Runen deduction + InventarItem creation for purchase safety
- Redis: Runen-Deckel fully enforced with INCR + EXPIREAT pattern

### Phase 3: Team Dashboard + Controls (~10-14 hours)

**Rationale:** Team Dashboard requires accumulated data over weeks to be meaningful -- a dashboard of zeros is not useful. Must wait for Phase 1 and Phase 2 quest completion history to accumulate. DSGVO-compliant design (team aggregates only, no per-person breakdown) should be validated against legal review before building, as this phase is most exposed to Pitfall 1 and Pitfall 5.

**Delivers:** Quartiermeister/ADMIN view with team health metrics, bossfight attribution, weekly backlog delta

**Addresses features from FEATURES.md:**
- Team Dashboard: Erfuellungsquote (team aggregate only), Backlog-Delta per week, Bossfight total team damage
- Bossfight phase celebration (collective, no individual MVP attribution)
- Optional: Special campaign quests (event-driven, time-bounded, requires seasonal triggers)

**Avoids pitfalls:**
- Pitfall 5 (Toxic ranking): team-only aggregates enforced at API level, no per-person breakdown in any shared view
- Pitfall 1 (DSGVO): all Team Dashboard API queries use GROUP BY without user identification columns

### Phase Ordering Rationale

- Phase 1 must come first because DSGVO compliance constraints shape the entire data model -- building APIs or UI before encoding privacy invariants requires a schema rewrite
- Quick Wins are bundled with Phase 1 (not deferred) because they demonstrate immediate quality improvement alongside the new gamification system, building user trust that gamification is additive rather than a distraction
- Item Shop is Phase 2 (not Phase 1) because Runen need 2-4 weeks to accumulate for purchasing to feel meaningful; an empty shop at launch is worse than no shop
- Team Dashboard is Phase 3 (not Phase 2) because it needs weeks of accumulated QuestCompletion data to show meaningful trends; shipping it with Phase 1 data would show mostly zeros
- Anti-abuse enforcement (full audit system, XP decay) is Phase 2 because for a 5-person team, light enforcement is sufficient at launch; behavioral gaming patterns from Phase 1 need observation before tuning thresholds

### Research Flags

Phases requiring deeper research during planning:

- **Phase 1 (DSGVO opt-in flow UX):** The legal requirement for a DSGVO Art. 13/14 transparency notice before first gamification opt-in is clear, but the specific UI implementation pattern (modal, settings page, inline notice) needs design research. The data retention automation (12-month deletion cron) also needs a Prisma `deleteMany` + BullMQ monthly cron design.
- **Phase 1 (OCR Vision fallback):** AI SDK v4 image input support exists, but the MinIO presigned URL to multi-provider AI image attachment path is marked MEDIUM confidence -- has not been tested in this codebase. Validate the attachment pattern before committing to the Vision-Analyse CTA in the recovery banner.
- **Phase 1 (Streak workday awareness):** Integration with the existing `UrlaubZeitraum` model is straightforward, but a German Feiertagskalender (public holidays by Bundesland) does not exist in the codebase. Decide whether to use `feiertagejs` package or a hardcoded table during Phase 1 planning.
- **Phase 2 (Random Audit UX):** The audit interaction pattern (modal asking user to confirm Vermerk existence on a flagged completion) has no existing precedent in the codebase; the UX flow needs design research.

Phases with standard patterns (skip research-phase):

- **Phase 1 (BullMQ crons, Socket.IO broadcasts, Prisma schema additions):** 8 existing cron jobs, 20+ existing event types, 80+ existing models provide complete implementation templates. No research needed.
- **Phase 1 (Quick Wins -- KPI cards, empty states):** Trivial component changes with existing patterns (`email-empty-state.tsx`, `GlassKpiCard`). No research needed.
- **Phase 2 (Item Shop):** Standard transactional purchase pattern using Prisma `$transaction`. Identical to existing Schriftsatz pipeline transaction patterns. No research needed.
- **Phase 3 (Team Dashboard):** Standard aggregation query pattern using existing dashboard page server component architecture. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All existing packages verified against codebase. 2 new packages are de facto standards with documented APIs. Custom quest evaluator follows established v0.2 pattern (complexity classifier). No speculation required. |
| Features | HIGH | Gamification patterns well-documented in enterprise literature. Quest condition mapping to Kanzlei entities verified against existing Prisma schema. Anti-feature list grounded in documented gamification failure modes (Goodhart, Overjustification). |
| Architecture | HIGH | Codebase directly inspected. All integration points (BullMQ queues.ts, Socket.IO rooms, Prisma atomic ops, Redis INCR) verified against existing worker.ts, queues.ts, emitter.ts. Quest evaluator pattern identical to v0.2 complexity classifier. |
| Pitfalls | HIGH | DSGVO/BetrVG analysis verified against primary legal sources (KREMER LEGAL, Hogan Lovells, Bird & Bird). Goodhart and Overjustification Effect well-documented in peer-reviewed literature. Technical pitfalls (race conditions, OCR state machine) verified against existing code paths. |

**Overall confidence:** HIGH

### Gaps to Address

- **OCR Vision fallback (MEDIUM):** AI SDK v4 image input support exists in theory, but MinIO presigned URL to multi-provider image attachment has not been tested in this codebase. Validate during Phase 1 planning before committing to the "Vision-Analyse" CTA.
- **DSGVO opt-in flow UX:** Legal requirement clear, but the specific UI pattern (modal vs. settings page) and data retention automation (12-month deletion cron) need design decisions in Phase 1 planning.
- **Streak Feiertagskalender:** German public holidays by Bundesland do not exist in the codebase. Decide on `feiertagejs` package or hardcoded table during Phase 1 planning. Small but must be resolved before streak logic is built.
- **Bossfight activation trigger:** Research specifies boss activates when backlog exceeds `schwellenwert` (default 50), but the mechanism (manual admin trigger vs. automatic nightly cron detection) is not specified. Decide in Phase 1 planning.

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection: `prisma/schema.prisma`, `src/lib/queue/queues.ts`, `src/worker.ts`, `src/lib/socket/emitter.ts`, `src/components/ui/glass-kpi-card.tsx`, `src/components/email/email-empty-state.tsx`, `src/components/dokumente/ocr-status-badge.tsx` -- all integration points verified
- [canvas-confetti npm](https://www.npmjs.com/package/canvas-confetti) -- v1.9.4, 6.3 kB gzipped, zero dependencies, 6.8k GitHub stars
- [Radix UI Progress](https://www.radix-ui.com/primitives/docs/components/progress) -- accessible progress primitive, same Radix version family
- [BullMQ Job Schedulers](https://docs.bullmq.io/guide/job-schedulers) -- `upsertJobScheduler` pattern verified against existing 8 cron jobs
- [Prisma Client Atomic Number Operations](https://www.prisma.io/docs/orm/reference/prisma-client-reference) -- `{ increment }` semantics, SQL-level atomicity
- [KREMER LEGAL: Gamification vs. Beschaeftigtendatenschutz](https://kremer-rechtsanwaelte.de/2017/12/22/gamification-innovation-vs-beschaeftigtendatenschutz/) -- section 87 BetrVG analysis
- [Hogan Lovells: Draft Employee Data Act (BeschDG)](https://www.hoganlovells.com/en/publications/germany-draft-for-employee-data-act-issued) -- BeschDG section 19 draft October 2024
- [Bird & Bird: DSGVO Arbeitsrecht](https://www.twobirds.com/en/insights/2025/germany/dsgvo-konturen-fr-datenschutz-im-arbeitsrecht-werden-immer-klarer) -- DSGVO Art. 6 employment context

### Secondary (MEDIUM confidence)
- [Habitica Gamification Case Study (Trophy, 2025)](https://trophy.so/blog/habitica-gamification-case-study) -- cooperative vs competitive mechanics
- [Growth Engineering: Dark Side of Gamification](https://www.growthengineering.co.uk/dark-side-of-gamification/) -- Overjustification Effect, leaderboard demotivation
- [NN/g: Designing Empty States in Complex Applications](https://www.nngroup.com/articles/empty-state-interface-design/) -- empty state UX patterns
- [phys.org: Workplace Gamification Erodes Moral Agency (2026-02)](https://phys.org/news/2026-02-workplace-gamification-erodes-employee-moral.html) -- Carnegie Mellon study
- [Trophy: Productivity App Gamification That Doesn't Backfire](https://trophy.so/blog/productivity-app-gamification-doesnt-backfire) -- Goodhart's Law mitigation strategies
- [Gamification of Cooperation Framework (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S0268401222000834) -- cooperation vs. competition in small teams

### Tertiary (LOW confidence)
- [Gamification in Law Firms (Lexology)](https://www.lexology.com/library/detail.aspx?g=e14ef966-4eb5-432a-892c-13652d0b93ac) -- legal-specific adoption patterns; sparse, small sample, not peer-reviewed

---
*Research completed: 2026-03-02*
*Ready for roadmap: yes*
