# Roadmap: AI-Lawyer

## Milestones

- ✅ **v3.4 Full-Featured Kanzleisoftware** — Phases 1-9 (shipped 2026-02-25)
- ✅ **v3.5 Production Ready** — Phases 10-11 (shipped 2026-02-26)
- ✅ **v0.1 Helena RAG** — Phases 12-18 (shipped 2026-02-27)
- ✅ **v0.2 Helena Agent** — Phases 19-27 (shipped 2026-02-28)
- ✅ **v0.3 Kanzlei-Collaboration** — Phases 28-32 (shipped 2026-03-02)
- 🚧 **v0.4 Quest & Polish** — Phases 33-41 (in progress)

## Phases

<details>
<summary>v3.4 Full-Featured Kanzleisoftware (Phases 1-9) -- SHIPPED 2026-02-25</summary>

- [x] Phase 1: Infrastructure Foundation (3/3 plans) -- completed 2026-02-24
- [x] Phase 2: Deadline Calculation + Document Templates (6/6 plans) -- completed 2026-02-24
- [x] Phase 2.1: Wire Frist-Reminder Pipeline + Settings Init (1/1 plan) -- completed 2026-02-24
- [x] Phase 2.2: Fix API Routes + UI Paths (1/1 plan) -- completed 2026-02-24
- [x] Phase 3: Email Client (4/4 plans) -- completed 2026-02-24
- [x] Phase 3.1: Wire Email Real-Time + Compose Integration (1/1 plan) -- completed 2026-02-24
- [x] Phase 4: Document Pipeline (OCR + RAG Ingestion) (3/3 plans) -- completed 2026-02-24
- [x] Phase 4.1: Wire Akte Real-Time + Email Compose + Admin Pipeline (1/1 plan) -- completed 2026-02-24
- [x] Phase 5: Financial Module (6/6 plans) -- completed 2026-02-24
- [x] Phase 6: AI Features + beA (5/5 plans) -- completed 2026-02-25
- [x] Phase 7: Rollen/Sicherheit + Compliance + Observability (3/3 plans) -- completed 2026-02-25
- [x] Phase 8: Integration Hardening (3/3 plans) -- completed 2026-02-25
- [x] Phase 9: Final Integration Wiring + Tech Debt (1/1 plan) -- completed 2026-02-25

**Total: 13 phases, 38 plans, 105 tasks, 64/64 requirements**

See: `milestones/v3.4-ROADMAP.md` for full phase details.

</details>

<details>
<summary>v3.5 Production Ready (Phases 10-11) -- SHIPPED 2026-02-26</summary>

- [x] Phase 10: Docker Build Fix (3/3 plans) -- completed 2026-02-25
- [x] Phase 11: Glass UI Migration (7/7 plans) -- completed 2026-02-26

**Total: 2 phases, 10 plans**

See: `milestones/v3.5-ROADMAP.md` for full phase details.

</details>

<details>
<summary>v0.1 Helena RAG (Phases 12-18) -- SHIPPED 2026-02-27</summary>

- [x] Phase 12: RAG Schema Foundation (1/1 plan) -- completed 2026-02-26
- [x] Phase 13: Hybrid Search + Reranking (3/3 plans) -- completed 2026-02-27
- [x] Phase 14: Gesetze-RAG (3/3 plans) -- completed 2026-02-27
- [x] Phase 15: Normen-Verknuepfung in Akte (3/3 plans) -- completed 2026-02-27
- [x] Phase 16: PII-Filter (3/3 plans) -- completed 2026-02-27
- [x] Phase 17: Urteile-RAG (3/3 plans) -- completed 2026-02-27
- [x] Phase 18: Muster-RAG + Admin Upload UI (3/3 plans) -- completed 2026-02-27

**Total: 7 phases, 19 plans, 16/16 requirements**

See: `milestones/v0.1-ROADMAP.md` for full phase details.

</details>

<details>
<summary>v0.2 Helena Agent (Phases 19-27) -- SHIPPED 2026-02-28</summary>

- [x] Phase 19: Schema Foundation (1/1 plan) -- completed 2026-02-27
- [x] Phase 20: Agent Tools + ReAct Loop (4/4 plans) -- completed 2026-02-27
- [x] Phase 21: @Helena Task-System (2/2 plans) -- completed 2026-02-27
- [x] Phase 22: Deterministic Schriftsatz Orchestrator (2/2 plans) -- completed 2026-02-27
- [x] Phase 23: Draft-Approval Workflow (3/3 plans) -- completed 2026-02-27
- [x] Phase 23.1: Integration Wiring Fixes (3/3 plans) -- completed 2026-02-27
- [x] Phase 24: Scanner + Alerts (2/2 plans) -- completed 2026-02-28
- [x] Phase 25: Helena Memory (1/1 plan) -- completed 2026-02-28
- [x] Phase 26: Activity Feed UI + QA-Gates (3/3 plans) -- completed 2026-02-28
- [x] Phase 27: Activity Feed + QA Pipeline Wiring (2/2 plans) -- completed 2026-02-28

**Total: 10 phases, 23 plans, 53 tasks, 52/53 requirements (SCAN-05 deferred)**

See: `milestones/v0.2-ROADMAP.md` for full phase details.

</details>

<details>
<summary>v0.3 Kanzlei-Collaboration (Phases 28-32) -- SHIPPED 2026-03-02</summary>

- [x] Phase 28: Falldatenblaetter Schema + Templates (4/4 plans) -- completed 2026-02-28
- [x] Phase 29: Falldatenblaetter UI (2/2 plans) -- completed 2026-02-28
- [x] Phase 30: SCAN-05 Neu-Urteil-Check (2/2 plans) -- completed 2026-02-28
- [x] Phase 31: Messaging Schema + API (3/3 plans) -- completed 2026-03-02
- [x] Phase 32: Messaging UI (2/2 plans) -- completed 2026-03-02

**Total: 5 phases, 13 plans, 25 tasks, 20/20 requirements**

See: `milestones/v0.3-ROADMAP.md` for full phase details.

</details>

### 🚧 v0.4 Quest & Polish (In Progress)

**Milestone Goal:** Gamification als Kanzlei-Steuerungsinstrument (Quests, XP, Bossfight, Item-Shop, Team-Dashboard) + UX-Quick-Wins in der Akte-Detailansicht.

- [x] **Phase 33: Gamification Schema + Quest Engine** - Prisma models, XP/Level/Streak/Runen engine, Quest DSL evaluator, nightly cron, DSGVO-compliant data architecture (completed 2026-03-02)
- [x] **Phase 34: Dashboard Widget + Quest Deep-Links** - GlassCard quest widget with XP bar, level, streak, Runen, opt-in visibility, quest click-to-navigate (completed 2026-03-02)
- [x] **Phase 35: Bossfight** - Team Backlog-Monster with HP bar, 4 phases, Socket.IO real-time updates, admin activation threshold (completed 2026-03-02)
- [x] **Phase 36: Quick Wins** - Clickable KPI cards, OCR recovery flow, empty states, Chat KPI rename, Zeiterfassung description fix (completed 2026-03-02)
- [x] **Phase 37: Klassen + Weekly + Special Quests** - Role-specific quests, weekly structural goals, time-limited admin campaigns (completed 2026-03-02)
- [x] **Phase 38: Anti-Missbrauch** - Qualified completion checks, Runen daily cap, random audits, atomic increments (completed 2026-03-02)
- [ ] **Phase 39: Item-Shop + Inventar** - 4-tier item catalog, cosmetic + comfort purchases, inventory management, level gates
- [ ] **Phase 40: Heldenkarte** - Profile page with avatar, class, active cosmetics, badge showcase, quest history
- [ ] **Phase 41: Team-Dashboard + Reporting** - Team aggregates (quest fulfillment, backlog delta, bossfight damage), monthly PDF/CSV report

## Phase Details

### Phase 33: Gamification Schema + Quest Engine
**Goal**: Users have a game profile and quests auto-evaluate against real business data
**Depends on**: Nothing (first phase of v0.4)
**Requirements**: GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, GAME-06, QUEST-01, QUEST-02, QUEST-03, QUEST-07
**Success Criteria** (what must be TRUE):
  1. User can opt-in to gamification and sees a GameProfile with XP, Level, Runen, Streak, and Klasse assigned from their RBAC role
  2. Completing a qualifying business action (e.g., closing a Wiedervorlage with Vermerk) triggers async quest evaluation that awards XP and Runen without blocking the business action
  3. Daily quests reset at 00:05 and nightly safety-net cron at 23:55 catches any missed quest completions and finalizes streaks
  4. GameProfile data is only visible to the owning user (DSGVO-compliant, no cross-user profile reads)
  5. XP awards correct level using linear progression formula; Runen are tracked separately and not conflated with XP
**Plans**: 3 plans

Plans:
- [x] 33-01-PLAN.md -- Prisma schema migration (UserGameProfile, Quest, QuestCompletion + enums) + types + quest seed
- [x] 33-02-PLAN.md -- GameProfile service (XP/Level/Runen/Streak) + quest evaluator + quest service + API route
- [x] 33-03-PLAN.md -- BullMQ gamification queue + processor + crons + business route hooks

### Phase 34: Dashboard Widget + Quest Deep-Links
**Goal**: Users see their gamification status at a glance and can navigate directly to quest-relevant views
**Depends on**: Phase 33
**Requirements**: GAME-07, GAME-08, QUEST-08
**Success Criteria** (what must be TRUE):
  1. Dashboard shows a Quest Widget (GlassCard) with today's quests, XP progress bar, current level, Runen balance, and streak count
  2. Widget is opt-in visible -- only appears for users who have activated gamification (no forced display)
  3. Clicking a quest opens the filtered view relevant to that quest (e.g., clicking "5 Fristen erledigen" opens today's Fristen list)
**Plans**: 2 plans

Plans:
- [ ] 34-01-PLAN.md -- Combined dashboard API + QuestWidget component (XP bar, quest list, streak, Runen badges, deep-link utility) + dashboard integration
- [ ] 34-02-PLAN.md -- Opt-in toggle (PATCH endpoint + settings UI) + KalenderListe deep-link filter initialization

### Phase 35: Bossfight
**Goal**: The team fights a shared Backlog-Monster whose HP reflects real open Wiedervorlagen
**Depends on**: Phase 33
**Requirements**: BOSS-01, BOSS-02, BOSS-03, BOSS-04
**Success Criteria** (what must be TRUE):
  1. A Bossfight appears on the dashboard when the open Wiedervorlage backlog exceeds the admin-configured threshold
  2. Clearing Wiedervorlagen reduces Boss HP in real-time (Socket.IO broadcast) and the team can see the HP bar update live
  3. Boss progresses through 4 phases with escalating Runen rewards; Phase 4 victory grants a collective Legendary trophy
  4. Admin can configure the activation threshold (backlog size) for boss spawning
**Plans**: 3 plans

Plans:
- [x] 35-01-PLAN.md -- Bossfight schema (Bossfight, BossfightDamage) + engine (dynamic HP, phase transitions)
- [x] 35-02-PLAN.md -- Bossfight dashboard banner + Socket.IO real-time updates + admin config
- [ ] 35-03-PLAN.md -- Gap closure: fix Socket.IO event payload shapes + API leaderboard field name

### Phase 36: Quick Wins
**Goal**: Akte detail view and document management have polished UX with no dead-end states
**Depends on**: Nothing (independent of gamification phases)
**Requirements**: QW-01, QW-02, QW-03, QW-04, QW-05
**Success Criteria** (what must be TRUE):
  1. Clicking a KPI card in Akte detail navigates to the corresponding tab (Dokumente, Fristen, E-Mails, etc.)
  2. A document with failed OCR shows a recovery banner offering Retry OCR, Vision-Analyse fallback, and manual text entry
  3. Empty tabs (beA, E-Mail, Zeiterfassung, etc.) show an icon, explanation text, and role-appropriate CTAs instead of blank space
  4. The "Nachrichten" KPI card reads "Chat" and links to channel messages; Zeiterfassung shows "Keine Kategorie" and "Beschreibung hinzufuegen" for empty fields
**Plans**: 2 plans

Plans:
- [ ] 36-01-PLAN.md -- Clickable KPI cards with tab navigation + reusable EmptyState component + empty states in 4 tabs + Chat rename
- [ ] 36-02-PLAN.md -- OCR recovery banner (3 recovery paths: retry, vision, manual) + Vision/Manual-Text API endpoints + Zeiterfassung inline editing

### Phase 37: Klassen + Weekly + Special Quests
**Goal**: Quests are tailored to each role and include weekly structural goals and time-limited campaigns
**Depends on**: Phase 33
**Requirements**: QUEST-04, QUEST-05, QUEST-06
**Success Criteria** (what must be TRUE):
  1. Each RBAC role sees different daily quests matching their class (ANWALT=Jurist quests, SACHBEARBEITER=Schreiber quests, etc.)
  2. Weekly quests with aggregate conditions (e.g., "Backlog -20% this week") appear on Mondays and reset weekly
  3. Admin can create time-limited Special Quests with start/end dates that appear for all or specific roles
**Plans**: 2 plans

Plans:
- [ ] 37-01-PLAN.md -- Schema (Quest.klasse, startDatum, endDatum, WeeklySnapshot) + delta evaluator + klasse-filtered quest service + weekly snapshot cron + expanded seed (~15 daily + 3 weekly)
- [ ] 37-02-PLAN.md -- QuestWidget grouped sections (Tagesquests/Wochenquests/Special) + Special Quest CRUD API + admin form in GamificationTab

### Phase 38: Anti-Missbrauch
**Goal**: Quest completion is quality-gated so gaming the system is harder than doing the actual work
**Depends on**: Phase 33, Phase 37
**Requirements**: ABUSE-01, ABUSE-02, ABUSE-03, ABUSE-04
**Success Criteria** (what must be TRUE):
  1. A Wiedervorlage completion only counts for quests if it has a status change, a Vermerk of 30+ characters, and optionally a follow-up WV
  2. A user earns max 40 Runen/day from Wiedervorlage quests; beyond the cap, only XP is awarded (Redis INCR enforcement)
  3. 1-3% of quest completions are flagged for random audit; the user sees a confirmation prompt, and declining revokes points
  4. Concurrent quest completions on the same profile never cause XP/Runen drift (atomic Prisma increments, DB-level idempotency)
**Plans**: 2 plans

Plans:
- [ ] 38-01-PLAN.md -- Schema migration (QuestCompletion + AuditStatus) + Runen daily cap (Redis) + qualified WV completion check + atomic $transaction hardening + cap indicator UI
- [ ] 38-02-PLAN.md -- Random audit system (2% sampling, Socket.IO event, Sonner action toast, confirm/decline API, 24h auto-confirm BullMQ job)

### Phase 39: Item-Shop + Inventar
**Goal**: Users can spend earned Runen on cosmetic and comfort items
**Depends on**: Phase 33 (Runen accumulation), Phase 38 (Runen cap enforced)
**Requirements**: SHOP-01, SHOP-02, SHOP-03, SHOP-04, SHOP-05
**Success Criteria** (what must be TRUE):
  1. The shop page displays items in 4 rarity tiers (Common, Rare, Epic, Legendary) with Runen prices
  2. User can purchase a cosmetic item (avatar frame, banner, title, animation) and it is deducted from their Runen balance atomically
  3. User can purchase a comfort perk (e.g., Fokus-Siegel) and activate it from their inventory
  4. Legendary items are locked with a "Level 25 required" gate and only purchasable after reaching that level
  5. User has an inventory page showing owned items with equip/unequip actions
**Plans**: TBD

Plans:
- [ ] 39-01: ShopItem + InventarItem schema + item catalog seed + shop page UI
- [ ] 39-02: Purchase flow (atomic transaction) + inventory management + level gate + perk activation

### Phase 40: Heldenkarte
**Goal**: Users have a personal profile page showcasing their gamification achievements
**Depends on**: Phase 33 (game profile), Phase 39 (cosmetic items)
**Requirements**: PROFIL-01, PROFIL-02, PROFIL-03
**Success Criteria** (what must be TRUE):
  1. User sees a "Heldenkarte" profile page showing their avatar, class, level, title, and any active cosmetic items
  2. The badge showcase displays earned (never purchased) badges like "Fristenwaechter" and "Bannbrecher" with earn dates
  3. Quest history tab shows all completed quests with completion date and reward amounts
**Plans**: TBD

Plans:
- [ ] 40-01: Heldenkarte profile page (avatar, class, cosmetics, badge showcase, quest history)

### Phase 41: Team-Dashboard + Reporting
**Goal**: Admins and team leads see aggregated team health metrics without per-person breakdowns
**Depends on**: Phase 33 (quest data accumulated), Phase 35 (bossfight data)
**Requirements**: TEAM-01, TEAM-02, TEAM-03, TEAM-04
**Success Criteria** (what must be TRUE):
  1. Team Dashboard shows quest fulfillment rate as a team aggregate (no individual breakdown visible)
  2. Backlog delta per week is displayed as a trend indicator (rising/falling/stable) with historical chart
  3. Total bossfight team damage is shown as a collective metric (no per-person MVP callout)
  4. Admin can export a monthly report (PDF/CSV) with Backlog-Delta, Billing-Delta, and Quest fulfillment rates
**Plans**: TBD

Plans:
- [ ] 41-01: Team Dashboard page (fulfillment rate, backlog delta, bossfight damage aggregates)
- [ ] 41-02: Monthly reporting export (PDF/CSV generation)

## Progress

**Execution Order:**
Phases execute in numeric order: 33 → 34 → 35 → 36 → 37 → 38 → 39 → 40 → 41
Note: Phase 36 (Quick Wins) is independent and can run in parallel with Phase 34 or 35.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-9 | v3.4 | 38/38 | Complete | 2026-02-25 |
| 10-11 | v3.5 | 10/10 | Complete | 2026-02-26 |
| 12-18 | v0.1 | 19/19 | Complete | 2026-02-27 |
| 19-27 | v0.2 | 23/23 | Complete | 2026-02-28 |
| 28-32 | v0.3 | 13/13 | Complete | 2026-03-02 |
| 33. Gamification Schema + Quest Engine | 3/3 | Complete    | 2026-03-02 | - |
| 34. Dashboard Widget + Quest Deep-Links | 2/2 | Complete    | 2026-03-02 | - |
| 35. Bossfight | 3/3 | Complete    | 2026-03-02 | - |
| 36. Quick Wins | 2/2 | Complete    | 2026-03-02 | - |
| 37. Klassen + Weekly + Special Quests | 2/2 | Complete    | 2026-03-02 | - |
| 38. Anti-Missbrauch | 2/2 | Complete    | 2026-03-02 | - |
| 39. Item-Shop + Inventar | v0.4 | 0/2 | Not started | - |
| 40. Heldenkarte | v0.4 | 0/1 | Not started | - |
| 41. Team-Dashboard + Reporting | v0.4 | 0/2 | Not started | - |

---
*Roadmap created: 2026-02-24*
*Last updated: 2026-03-02 after Phase 36 planning*
