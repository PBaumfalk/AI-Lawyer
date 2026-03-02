# Feature Landscape: Gamification + Quick Wins UX

**Domain:** Enterprise Kanzleisoftware Gamification (Quests, XP, Bossfight, Item-Shop, Team-Dashboard) + UX Quick Wins (Empty States, Clickable KPIs, Recovery Flows)
**Researched:** 2026-03-02
**Overall confidence:** HIGH (Gamification patterns well-documented; Quick Wins are standard UX patterns with existing codebase precedent)

---

## Table Stakes

Features that must work correctly for the system to feel complete. If any of these are missing or broken, the gamification system feels like a toy rather than a steering instrument.

### Gamification Table Stakes

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| XP + Level progression | Core feedback loop; users need visible long-term progress | Low | New `UserGameProfile` model | Linear XP thresholds (e.g. level = floor(xp/500)+1). Simple, predictable. |
| Daily Quest display + completion tracking | The primary daily interaction surface; without this, there is no gamification | Med | New `Quest`, `QuestCompletion` models; existing Prisma models for Fristen/Wiedervorlagen/Rechnungen | 5 hardcoded quests initially, maschinenlesbare `bedingung` JSON for evaluation |
| Quest completion verification against real data | Quests MUST verify against actual DB state (Fristen marked, Wiedervorlagen with Vermerk, Rechnungen created). Unverified quests = pointless clicks. | Med | Prisma queries against existing KalenderEintrag, Wiedervorlage, Rechnung models | This is the make-or-break: bedingung JSON must map to real Prisma count/where queries |
| Dashboard Quest Widget | Users must see quests without navigating away from their daily view | Low | Existing Dashboard page, GlassCard components | Widget sits alongside existing KPI cards. 3-5 quests + progress bar + XP display. |
| Runen (Credits) as separate currency from XP | XP = progression (never spent), Runen = spendable currency. Conflating them creates the "spend your level" anti-pattern. | Low | `runen` field on UserGameProfile | Habitica uses gold vs XP separation for this exact reason |
| Streak tracking with pause/vacation logic | Streaks without vacation handling punish absence and breed resentment. This is a DAY ONE requirement, not a "nice to have." | Low | `streakTage`, `streakAktiv`, `letzteQuestAm` on UserGameProfile + Abwesenheit/Urlaub check | Streak breaks only on workdays where Kernquest was possible but not completed |
| Bossfight team progress visualization | The cooperative boss mechanic is the emotional centerpiece. A progress bar showing team damage against the backlog monster. | Med | New `Bossfight` model + aggregated Wiedervorlage completion counts | Single active boss at a time. HP = initial backlog count. Each qualified completion = 1 damage. |

### Quick Wins Table Stakes

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|------------|-------|
| KPI Cards clickable with tab navigation | Users click "5 Termine/Fristen" and expect to land on the Fristen tab. Current cards are dead-end decorations. | Low | Existing `GlassKpiCard` component + `akte-detail-tabs.tsx` tab state | Add `onClick` prop to GlassKpiCard, wire each card to `setActiveTab()`. 30-minute fix. |
| Empty states with icon + explanation + CTA | Blank white areas in beA, E-Mails, Zeiterfassung tabs are UX dead-ends. Users do not know what to do. | Low | Existing `EmailEmptyState` pattern to replicate | Follow the EmailEmptyState component pattern already in codebase. Icon + text + 1-2 action buttons. |
| OCR failure recovery banner | Current OCR failure shows a tiny retry icon. Users need a visible banner with clear recovery options. | Med | Existing `ocr.processor.ts`, `dokumente-tab.tsx`, OCR API route | Banner with 3 actions: Retry OCR, Vision fallback (GPT-4o), Manual text entry |
| "Nachrichten: 0" KPI card fix | Showing "0" for a feature that has no content yet confuses users. Either rename to reflect actual channel/chat or hide when empty. | Low | `akte-detail-tabs.tsx` KPI section | Rename to "Chat" and link to Nachrichten tab, or conditionally hide |
| Zeiterfassung description visibility | "---" as category with no description visible is a data display failure | Low | `akte-zeiterfassung-tab.tsx` | Show "Keine Kategorie" in grey instead of dash, add inline "Beschreibung hinzufuegen" link |

---

## Differentiators

Features that set this gamification system apart from generic point/badge implementations. Not expected by users, but create significant engagement value when present.

### Gamification Differentiators

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Klassen-spezifische Quests mapped to RBAC roles | ANWALT sees Jurist quests (Fristen, Abrechnung), SEKRETARIAT sees Waechter quests (Posteingang, Fristenanlage). Role-appropriate gamification instead of one-size-fits-all. | Med | Existing RBAC role system (4 roles), Quest `klasse` field | Unique in legal software. Maps fantasy classes to real job functions. |
| Bossfight phase mechanics (4 phases with escalating rewards) | Boss phases create narrative tension: Phase 3 "Wut-Phase" gives more Runen, Phase 4 finale yields Legendary trophy. Keeps team engaged through the long slog of backlog reduction. | Med | Bossfight model with `phase` field, threshold calculations | Inspired by raid boss mechanics. Phase transitions announced via Socket.IO to all users. |
| Anti-Missbrauch: Qualified completion verification | Quest completion requires actual work product (Vermerk written, status changed, next Wiedervorlage set). Prevents "click-to-complete" gaming. | High | Deep integration with existing Wiedervorlage, KalenderEintrag, Rechnung workflows | This is what makes it a steering instrument vs a toy. Most enterprise gamification skips this. |
| Runen-Deckel (daily cap on farming) | Max 40 Runen/day from Wiedervorlagen prevents gaming behavior while still rewarding genuine productivity. XP continues uncapped. | Low | Counter logic in quest completion handler | Prevents the "clear 100 trivial items" exploit |
| Random Audit system (1-3% spot checks) | Stichprobenartige Pruefung: system randomly asks "Vermerk vorhanden?" on completed quests. Failed audit = points reversed. | Med | QuestCompletion `auditFlag` field, audit UI modal | Subtle but powerful deterrent. Keeps system honest without heavy policing. |
| Item Shop with cosmetic + comfort perks | Avatar frames, banner decorations, profile titles (cosmetic) + "Fokus-Siegel" 30-min focus block (comfort). Never pay-to-win, never productivity-gating. | Med | New InventarItem model, Shop UI, item catalog | Runen finally have a purpose beyond number. Cosmetics drive engagement without unfairness. |
| Weekly Quests for structural goals | "Backlog -20% this week", "All abrechnungsreife Akten invoiced" -- these drive strategic behavior, not just daily habits. | Med | Weekly reset logic, aggregate queries | Bridges the gap between daily grind and monthly controlling |
| Team Dashboard for Quartiermeister/ADMIN | Erfuellungsquote per person (aggregated, not shaming), Backlog-Delta per week, Bossfight damage contribution. Management steering, not surveillance. | Med | Aggregation queries, new dashboard page | Framed as team health, not individual ranking. No public leaderboard. |

### UX Quick Wins Differentiators

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Vision-Analyse fallback for OCR | When Stirling-PDF OCR fails, offer GPT-4o Vision as fallback. Extract text from page images. Actually recovers content instead of just retrying the same failure. | Med | Existing multi-provider AI setup (Vercel AI SDK v4), document page rendering | Real differentiator: most DMS just retry the same OCR. Vision fallback handles scanned handwriting, stamps, poor quality. |
| Manual text entry for OCR recovery | Last resort: user can type/dictate the document content themselves. The document becomes searchable even when all automation fails. | Low | Text editor overlay, save to document metadata | Ensures 100% of documents are eventually searchable. No permanent dead-ends. |

---

## Anti-Features

Features to explicitly NOT build. These are tempting but harmful.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Public individual leaderboard | Creates toxic competition, demotivates bottom-half performers, breeds resentment in a 5-person Kanzlei. The "Leaderboard Loser Effect" is well-documented: users ranked low disengage entirely. | Use team-aggregate metrics only. Show Bossfight damage as team total. Individual stats visible only to self + admin. |
| Real-money rewards or salary-linked bonuses | Creates Arbeitsrecht issues (Verguetungsbestandteil), overjustification effect kills intrinsic motivation, and "once the external rewards dry up, motivation collapses completely." | Keep rewards purely virtual: cosmetics, comfort perks, prestige. Frame as internal organization tool. |
| Mandatory participation / penalty for non-participation | Forcing gamification breeds resentment. Some people hate game mechanics. Penalties for not playing make work feel surveillant. | Make gamification opt-in visible. Users who ignore it still see their normal dashboard. Quests appear but do not nag. |
| Complex achievement trees or skill trees | Over-engineering the progression creates "meta-gaming" where users optimize the game instead of doing actual work. Complexity also makes maintenance a burden. | Keep progression linear (XP -> Level). Badges for milestones. No branching paths. |
| AI-generated quests | LLM-generated quest text/conditions are unpredictable, may create impossible or trivially easy quests, and add latency. The 5 daily quests are well-defined business routines. | Hardcode quest definitions. Adaptive difficulty = adjust thresholds based on backlog size, not LLM creativity. |
| Gamification of Helena AI usage | "Use Helena 5 times today" quests would incentivize unnecessary AI calls, waste compute, and create artificial dependency on AI tools. | Helena usage should be organic, driven by need. Never gamify AI interaction frequency. |
| Cross-Kanzlei leaderboards or competitions | Comparing law firms against each other is meaningless (different sizes, practice areas) and could leak competitive intelligence. | Single-tenant only. No external data sharing. |
| Purchasable XP or level boosts | Destroys the meaning of levels. If you can buy your way up, levels stop signaling competence/consistency. | XP is earned only. Runen buy cosmetics/perks, never progression. |
| Notifications/push for quest reminders | Daily quest spam via push notifications will be ignored within a week and actively resented within a month. | Quests visible on dashboard only. No push, no email, no toast spam. The dashboard IS the quest board. |

---

## Feature Dependencies

```
Quest Completion Verification
  |-> requires existing Wiedervorlage/Frist/Rechnung Prisma models (already exist)
  |-> requires bedingung JSON evaluator (new)

Dashboard Quest Widget
  |-> requires UserGameProfile (new model)
  |-> requires Quest + QuestCompletion (new models)
  |-> requires existing Dashboard page (already exists)

Bossfight Banner
  |-> requires Bossfight model (new)
  |-> requires Wiedervorlage completion counting (existing queries)
  |-> requires Socket.IO for real-time updates (already exists)

Streak System
  |-> requires UserGameProfile.streakTage/streakAktiv (new fields)
  |-> requires daily cron job or quest-completion hook (BullMQ already exists)

Item Shop (Phase 2)
  |-> requires Runen currency working (from Phase 1)
  |-> requires InventarItem model (new)
  |-> requires Shop UI page (new)

Klassen-spezifische Quests (Phase 2)
  |-> requires base quest system working (from Phase 1)
  |-> requires RBAC role mapping (already exists)

Team Dashboard (Phase 3)
  |-> requires QuestCompletion data accumulated over time (from Phase 1)
  |-> requires Bossfight damage tracking (from Phase 1)
  |-> requires aggregation queries (new)

Weekly Quests (Phase 2)
  |-> requires weekly reset cron (BullMQ, already have cron infrastructure)
  |-> requires aggregate business metric queries (partially exist)

KPI Cards Clickable
  |-> requires GlassKpiCard onClick prop (trivial addition)
  |-> requires akte-detail-tabs tab state management (already exists)

Empty States
  |-> requires EmailEmptyState pattern (already exists as reference)
  |-> requires per-tab empty state components (new, but trivial)

OCR Recovery Flow
  |-> requires existing OCR processor + API route (already exist)
  |-> requires Vision API integration (existing AI SDK multi-provider)
  |-> requires manual text entry UI (new overlay component)
```

---

## MVP Recommendation

### Phase 1: Gamification MVP + All Quick Wins

Prioritize (ship together):

1. **DB Schema** -- UserGameProfile, Quest, QuestCompletion, Bossfight models in Prisma
2. **5 Daily Quests with verification** -- Hardcoded definitions, maschinenlesbare bedingung JSON, real Prisma verification queries
3. **XP/Runen/Level/Streak calculation** -- Server-side computation on quest completion
4. **Dashboard Quest Widget** -- GlassCard-based widget showing today's quests, XP bar, level, streak, Runen balance
5. **Bossfight "Backlog-Monster"** -- Team progress banner, HP bar, phase display
6. **KPI Cards clickable** -- Add onClick to GlassKpiCard, wire to tab navigation
7. **Empty States** -- beA, E-Mails, Zeiterfassung tabs with icon + text + CTA
8. **OCR Recovery Flow** -- Banner with Retry + Vision + Manual options
9. **Nachrichten KPI fix** -- Rename or conditionally hide
10. **Zeiterfassung description** -- Grey placeholder text, inline edit link

**Rationale:** Quick Wins are 1-2 day fixes that immediately improve daily UX. They ship alongside gamification Phase 1 to make the milestone feel substantial from day one. The gamification MVP needs all 5 pieces (schema, quests, XP, widget, bossfight) to be coherent -- shipping partial gamification feels broken.

### Phase 2: Gamification Depth

Defer (ship as Phase 2):

- **Klassen-spezifische Quests**: Need Phase 1 data to validate quest difficulty per role
- **Weekly Quests**: Need daily quest infrastructure proven first
- **Anti-Missbrauch (Runen-Deckel, Random Audits)**: Important but not needed for a 5-person team at launch. Add before scaling.
- **Item Shop + Inventar**: Runen need time to accumulate. Ship shop 2-4 weeks after Phase 1.
- **Adaptive Quest difficulty**: Needs baseline data from Phase 1 completion rates.

### Phase 3: Controlling

Defer (ship as Phase 3):

- **Special Quests / Campaigns**: Need quest system maturity
- **Team Dashboard**: Needs accumulated data over weeks
- **Monthly Reporting**: Needs historical data

---

## Complexity Assessment

| Feature Area | Estimated Effort | Risk Level | Notes |
|---|---|---|---|
| Prisma schema (4 new models) | 2-3 hours | Low | Straightforward model additions |
| Quest bedingung evaluator | 4-6 hours | Medium | JSON->Prisma query mapping is the core complexity |
| Daily quest UI widget | 3-4 hours | Low | Existing GlassCard/GlassPanel patterns |
| Bossfight mechanics + banner | 4-6 hours | Medium | Phase transitions, Socket.IO broadcasts |
| XP/Level/Streak/Runen logic | 2-3 hours | Low | Pure arithmetic server-side |
| KPI Cards clickable | 1 hour | Low | Add onClick prop, wire tab state |
| Empty states (4 tabs) | 2-3 hours | Low | Copy EmailEmptyState pattern |
| OCR Recovery banner + flows | 4-6 hours | Medium | Vision fallback needs API integration |
| Nachrichten KPI fix | 30 min | Low | Rename or conditional render |
| Zeiterfassung description | 1 hour | Low | UI text changes |
| Item Shop (Phase 2) | 6-8 hours | Medium | New page, catalog, purchase flow |
| Klassen Quests (Phase 2) | 3-4 hours | Low | Quest filtering by role |
| Anti-Missbrauch (Phase 2) | 4-6 hours | Medium | Audit system, cap logic |
| Team Dashboard (Phase 3) | 6-8 hours | Medium | Aggregation queries, new page |

**Total Phase 1 estimate:** ~25-35 hours
**Total Phase 2 estimate:** ~15-22 hours
**Total Phase 3 estimate:** ~10-14 hours

---

## Key Design Decisions for Roadmap

### 1. Cooperation over Competition
The Bossfight mechanic is deliberately cooperative (team vs monster, not person vs person). Research strongly supports this for small teams: Atlassian's internal gamification case studies show cooperation-based mechanics outperform competition in teams under 20. In a 5-person Kanzlei, a leaderboard would immediately reveal who is "last place" every day -- destructive for team dynamics.

### 2. Steering Instrument, Not Game
The quest definitions map 1:1 to existing Kanzlei-Routinen (Fristen pruefen, Wiedervorlagen abarbeiten, Rechnungen stellen). This is not a game bolted onto work -- it is work made visible and rewarded. The fantasy theme (Runen, Bossfight, Klassen) provides emotional engagement without changing what people actually do.

### 3. Verification is Non-Negotiable
The entire system collapses if quests can be "completed" without real work. The `bedingung` JSON -> Prisma query pipeline is the most critical piece. Each quest must verify: Was a Vermerk written? Did the status change? Was a Rechnung actually created? Without this, it is Habitica for lawyers (meaningless self-reporting) instead of a management steering instrument.

### 4. Quick Wins Ship First or Simultaneously
The UX quick wins (clickable KPIs, empty states, OCR recovery) should ship in the same milestone because they demonstrate immediate quality improvement. Users see "the app got better" alongside "there is now a quest system." This builds trust that gamification is additive, not a distraction.

---

## Sources

- [Habitica Gamification Case Study (Trophy, 2025)](https://trophy.so/blog/habitica-gamification-case-study)
- [The Dark Side of Gamification (Growth Engineering)](https://www.growthengineering.co.uk/dark-side-of-gamification/)
- [Enterprise Gamification: Completion vs Competition (Centrical)](https://centrical.com/resources/completion-vs-competition-which-is-better-for-enterprise-gamification/)
- [12 Gamification Techniques for Workplace Productivity (GamificationHub, 2026)](https://www.gamificationhub.org/how-can-i-apply-gamification-techniques-in-the-workplace-to-increase-productivity/)
- [Gamification in Law Firms (Lexology)](https://www.lexology.com/library/detail.aspx?g=e14ef966-4eb5-432a-892c-13652d0b93ac)
- [Are Law Firms Ready for Gamification? (Jaffe)](https://www.jaffepr.com/insights/are-law-firms-ready-gamification)
- [Gamification and Engineering KPIs (Oobeya, 2025)](https://www.oobeya.io/blog/gamification-and-engineerin-kpis)
- [Designing Empty States in Complex Applications (NN/g)](https://www.nngroup.com/articles/empty-state-interface-design/)
- [Empty State UX Best Practices (Pencil & Paper)](https://www.pencilandpaper.io/articles/empty-states)
- [Dashboard Design UX Patterns (Pencil & Paper)](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards)
- [Overjustification Effect in Gamification (Medium)](https://medium.com/gamification-curated/why-the-overjustification-effect-is-the-catch-22-of-gamification-5022a4e9ad79)
- [Gamification: Overjustification and Cheating (GameDeveloper)](https://www.gamedeveloper.com/business/gamification-overjustification-effect-and-cheating)
- [Team Engagement with Gamified Dashboards (Plecto)](https://www.plecto.com/blog/gamification/team-engagement-and-gamification-dashboards/)
- [Gamification of Cooperation Framework (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S0268401222000834)
