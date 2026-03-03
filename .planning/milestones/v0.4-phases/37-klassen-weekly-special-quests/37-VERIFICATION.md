---
phase: 37-klassen-weekly-special-quests
verified: 2026-03-02T20:08:36Z
status: passed
score: 9/9 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "QuestWidget displays three sections with correct visual hierarchy"
    expected: "Tagesquests section, Wochenquests section, Special section (amber border + countdown badge) render in production with real user data"
    why_human: "Cannot verify rendering behavior and amber border visual without browser execution"
  - test: "Admin Special Quest CRUD flows end-to-end"
    expected: "Admin creates a Special Quest in Einstellungen, it appears in the widget for opted-in users, edit and delete work without errors"
    why_human: "Requires DB connection, authenticated session, and browser interaction to validate"
  - test: "Weekly delta quests evaluate correctly after Monday snapshot cron runs"
    expected: "After cron creates WeeklySnapshot baselines, 'Backlog-Bezwinger' and 'Fristenwaechter' show correct progress percentages"
    why_human: "Requires Monday cron to have run (first Monday after deploy) and real ticket data in DB"
---

# Phase 37: Klassen + Weekly + Special Quests Verification Report

**Phase Goal:** Quests are tailored to each role and include weekly structural goals and time-limited campaigns
**Verified:** 2026-03-02T20:08:36Z
**Status:** PASSED
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Daily quests are filtered by user SpielKlasse — each role sees only universal and class-matching quests | VERIFIED | `quest-service.ts` lines 58-67: `OR [{ klasse: null }, { klasse: userKlasse }]` in `prisma.quest.findMany`; dashboard route mirrors the same pattern (lines 71-80) |
| 2 | Weekly quests evaluate delta conditions comparing start-of-week snapshot vs current count | VERIFIED | `quest-evaluator.ts` lines 182-236: `evaluateDeltaCondition()` reads `prisma.weeklySnapshot.findFirst` for baseline then computes decrease/increase against current count |
| 3 | Dashboard API returns quests grouped by type (daily/weekly/special) instead of flat array | VERIFIED | `dashboard/route.ts` lines 157-161: returns `{ quests: { daily: [...], weekly: [...], special: [...] } }` |
| 4 | Monday 00:00 cron creates WeeklySnapshot baselines for delta quest evaluation | VERIFIED | `queues.ts` lines 467-476: `gamificationQueue.upsertJobScheduler("gamification-weekly-snapshot", { pattern: "0 0 * * 1", tz: "Europe/Berlin" })`; `gamification.processor.ts` line 40: `case "weekly-snapshot": return handleWeeklySnapshot()` |
| 5 | Seed includes 14 class-specific daily quests (3 per class + 2 universal) plus 3 weekly quests | VERIFIED | `seed-quests.ts`: JURIST=3 (Die Siegel des Tages, Richterspruch studieren, Akte des Tages), SCHREIBER=3, WAECHTER=3, QUARTIERMEISTER=3, universal=2 (Die Chroniken entwirren, Ordnung im Skriptorium); WEEKLY_QUESTS array has 3 entries |
| 6 | QuestWidget shows three sections (Tagesquests, Wochenquests, Special) with amber border accent | VERIFIED | `quest-widget.tsx` lines 162-190: conditional `QuestSection` renders for each group; special section wrapped in `<div className="border-l-2 border-amber-500/60 ml-2">` |
| 7 | QuestSection shows countdown badge with remaining days for Special quests | VERIFIED | `quest-section.tsx` lines 54-57: `differenceInDays(new Date(quest.endDatum), new Date())` rendered as amber badge; "Letzter Tag" for 0 days |
| 8 | Admin can create/edit/delete Special Quests from Einstellungen using preset condition templates | VERIFIED | `special-quests/route.ts`: GET returns `{ quests, templates: CONDITION_TEMPLATES }`, POST creates from template; `[id]/route.ts`: PATCH updates, DELETE cascades completions; `gamification-tab.tsx` fetches and wires CRUD; `special-quest-form.tsx` uses templates prop |
| 9 | SEED_VERSION bumped to v0.4.1, backward compat alias seedDailyQuests exported | VERIFIED | `seed-quests.ts` line 7: `const SEED_VERSION = "v0.4.1"`; line 379: `export const seedDailyQuests = seedQuests` |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | Quest.klasse, startDatum, endDatum + WeeklySnapshot model | VERIFIED | Lines 2272-2279: klasse (SpielKlasse?), startDatum (DateTime?), endDatum (DateTime?); lines 2306-2317: WeeklySnapshot with @@unique([model, weekStart, userId]) |
| `src/lib/gamification/types.ts` | CountCondition, DeltaCondition union, campaign QuestPeriod | VERIFIED | Lines 10-39: QuestPeriod includes "campaign"; CountCondition, DeltaCondition, QuestCondition union fully defined |
| `src/lib/gamification/quest-evaluator.ts` | evaluateDeltaCondition() for weekly delta quests | VERIFIED | Lines 102-120: `evaluateQuestCondition` branches on `condition.type ?? "count"`; lines 182-236: full `evaluateDeltaCondition` with snapshot lookup |
| `src/lib/gamification/weekly-snapshot.ts` | createWeeklySnapshots() for Monday cron | VERIFIED | Full implementation: snapshots Ticket (by verantwortlichId) and KalenderEintrag (by verantwortlichId) counts per user |
| `src/lib/gamification/seed-quests.ts` | 14 class-specific daily + 3 weekly quests, SEED_VERSION v0.4.1 | VERIFIED | 14 daily quests (2 universal + 3x4 class-specific) + 3 weekly quests; SEED_VERSION = "v0.4.1" |
| `src/app/api/gamification/dashboard/route.ts` | Grouped response { daily, weekly, special } | VERIFIED | Lines 157-161: returns grouped quests object; klasse filter and SPECIAL date range filter applied |
| `src/components/gamification/quest-widget.tsx` | Grouped quest sections (daily/weekly/special) | VERIFIED | Consumes `GroupedQuests` type; renders QuestSection for each non-empty group; amber accent for Special |
| `src/components/gamification/quest-section.tsx` | Reusable QuestSection with header and quest rows | VERIFIED | Standalone component with title prop, quest rows with deep-link click, countdown badge via showCountdown prop |
| `src/app/api/gamification/special-quests/route.ts` | GET (list + templates) + POST (create from template) | VERIFIED | CONDITION_TEMPLATES exported; GET returns `{ quests, templates }`; POST validates required fields and builds condition from template |
| `src/app/api/gamification/special-quests/[id]/route.ts` | PATCH (update) + DELETE (cascade) | VERIFIED | PATCH rebuilds condition if templateId+count provided; DELETE does `deleteMany completions` then `delete quest` |
| `src/components/einstellungen/gamification-tab.tsx` | Special Quest management section with CRUD | VERIFIED | Fetches from `/api/gamification/special-quests`; renders list with Aktiv/Abgelaufen badges, edit/delete buttons; mounts SpecialQuestForm |
| `src/components/einstellungen/special-quest-form.tsx` | Create/edit form with preset template selection | VERIFIED | CONDITION_TEMPLATES-driven Select; guessTemplateId for edit mode pre-fill; POSTs/PATCHes to correct endpoints |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `quest-service.ts` | `prisma.quest.findMany` | klasse filter in where clause | WIRED | Lines 58-67: `OR [{ klasse: null }, { klasse: userKlasse }]` |
| `quest-evaluator.ts` | `weekly-snapshot.ts` | snapshot lookup for delta evaluation | WIRED | Line 189: `prisma.weeklySnapshot.findFirst({ where: { model, weekStart, userId } })` |
| `gamification.processor.ts` | `weekly-snapshot.ts` | Monday cron calls createWeeklySnapshots | WIRED | Line 21: import; line 40-41: `case "weekly-snapshot": return handleWeeklySnapshot()`; line 98-101: handler calls `createWeeklySnapshots()` |
| `quest-widget.tsx` | `/api/gamification/dashboard` | fetch consuming grouped quests response | WIRED | Line 72: `fetch("/api/gamification/dashboard")`; lines 115-117: destructures `quests.daily`, `quests.weekly`, `quests.special` |
| `gamification-tab.tsx` | `/api/gamification/special-quests` | fetch for CRUD operations | WIRED | Line 75: GET fetch; line 116: DELETE fetch; SpecialQuestForm handles POST/PATCH |
| `special-quest-form.tsx` | `CONDITION_TEMPLATES` | preset template selection mapped to QuestCondition JSON | WIRED | templates passed as prop from GamificationTab; Select renders templates; API builds condition JSON server-side |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| QUEST-04 | 37-01-PLAN, 37-02-PLAN | Klassen-spezifische Quests (unterschiedliche Quests pro RBAC-Rolle/Klasse) | SATISFIED | Quest.klasse field in schema; OR filter in quest-service and dashboard API; seed has 12 class-specific daily quests (3 per SpielKlasse); QuestSection renders class-filtered results |
| QUEST-05 | 37-01-PLAN, 37-02-PLAN | Weekly Quests fur strukturelle Ziele (Backlog-Reduktion, Abrechnung, Akten-Checks) | SATISFIED | DeltaCondition type with direction+percent; evaluateDeltaCondition() with WeeklySnapshot baseline; 3 weekly quests seeded (Backlog-Bezwinger, Fristenwaechter, Wochenabrechnung); QuestWidget renders "Wochenquests" section |
| QUEST-06 | 37-02-PLAN | Special Quests / zeitlich begrenzte Kampagnen (Admin-konfigurierbar mit Start-/Enddatum) | SATISFIED | Quest.startDatum/endDatum fields; full CRUD API at /api/gamification/special-quests; SpecialQuestForm with 4 preset templates; GamificationTab management section; countdown badge in QuestSection |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `quest-widget.tsx` | 108 | Comment "no placeholder" — informational comment, not code | Info | None — comment explains design intent |
| `special-quest-form.tsx` | 166,178 | HTML `placeholder` attributes on Input fields | Info | None — these are HTML input placeholder text, not code stubs |

No blockers or warnings found. The TypeScript compiler reports no errors in any phase 37 file.

Note: `npx tsc --noEmit` does report errors but they are all in pre-existing files unrelated to Phase 37 (`src/components/akten/falldaten-tab.tsx` and `src/lib/helena/index.ts`). Zero errors in any of the 11 files created or modified by Phase 37.

### Human Verification Required

#### 1. Grouped Quest Widget Visual Rendering

**Test:** Log in as a JURIST user with gamificationOptIn=true, open the dashboard, inspect the QuestWidget
**Expected:** Three distinct sections visible — "TAGESQUESTS" (3 daily quests), "WOCHENQUESTS" (weekly quests), no Special section (unless a Special Quest was created by admin); amber left border on Special section when it appears
**Why human:** Cannot verify actual browser rendering, CSS class application, or visual hierarchy programmatically

#### 2. Admin Special Quest CRUD End-to-End

**Test:** Log in as ADMIN, navigate to Einstellungen > Gamification tab, create a Special Quest using "Fristen erledigen" template with 5-day campaign, verify it appears for JURIST users in the widget, edit the reward, then delete it
**Expected:** Quest appears/disappears correctly in widget; countdown badge shows remaining days; "Abgelaufen" badge shows after endDatum passes; deletion removes quest from widget
**Why human:** Requires authenticated browser session, DB write, and cross-user verification

#### 3. Weekly Delta Quest Evaluation After Monday Cron

**Test:** Trigger the `gamification-weekly-snapshot` job manually via Bull Board admin, then check a user's quest progress for "Backlog-Bezwinger"
**Expected:** Progress shows as "X/Y" where Y is 20% of the Monday baseline ticket count; completing tickets during the week reduces the gap
**Why human:** Requires cron execution, real ticket data, and live DB state; cannot verify delta math without a real WeeklySnapshot row

### Gaps Summary

No gaps found. All 9 observable truths verified, all 12 artifacts confirmed substantive and wired, all 3 key links confirmed wired, all 3 requirement IDs (QUEST-04, QUEST-05, QUEST-06) satisfied.

The phase delivered exactly what was promised:
- Class-based quest filtering via SpielKlasse (JURIST/SCHREIBER/WAECHTER/QUARTIERMEISTER)
- Weekly delta quests using WeeklySnapshot baselines with decrease/increase directions
- Time-limited Special Quest campaigns with admin CRUD and preset condition templates
- Grouped quest widget (daily/weekly/special) with amber Special section accent
- Monday 00:00 BullMQ cron for snapshot creation

---
_Verified: 2026-03-02T20:08:36Z_
_Verifier: Claude (gsd-verifier)_
