---
phase: 37-klassen-weekly-special-quests
plan: 02
subsystem: gamification
tags: [react, quest-widget, quest-sections, special-quest-crud, admin-ui, condition-templates]

# Dependency graph
requires:
  - phase: 37-klassen-weekly-special-quests
    plan: 01
    provides: Grouped dashboard API { daily, weekly, special }, QuestCondition DSL, Quest model with klasse/startDatum/endDatum
  - phase: 35-bossfight
    provides: GamificationTab Bossfight config (extended with Special Quest section)
provides:
  - QuestSection reusable component with section header, quest rows, deep-link, countdown badge
  - QuestWidget with grouped daily/weekly/special sections and amber special accent
  - GET/POST /api/gamification/special-quests (list + create with condition templates)
  - PATCH/DELETE /api/gamification/special-quests/[id] (update + delete)
  - SpecialQuestForm with preset template selection (no raw JSON)
  - GamificationTab extended with Special Quest management (CRUD)
  - CONDITION_TEMPLATES constant (4 templates: fristen, tickets, rechnungen, akten)
affects: [team-dashboard, item-shop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "QuestSection: reusable grouped quest renderer with optional countdown badge"
    - "Condition templates: admin selects preset, backend builds QuestCondition JSON"
    - "Amber accent border for Special quest section in widget"
    - "Template-to-condition mapping: admin picks template + count, API builds full condition object"

key-files:
  created:
    - src/components/gamification/quest-section.tsx
    - src/app/api/gamification/special-quests/route.ts
    - src/app/api/gamification/special-quests/[id]/route.ts
    - src/components/einstellungen/special-quest-form.tsx
  modified:
    - src/components/gamification/quest-widget.tsx
    - src/components/einstellungen/gamification-tab.tsx

key-decisions:
  - "QuestSection is a separate reusable component (not inlined in QuestWidget) for clean separation"
  - "Condition templates defined server-side and sent to client -- admin never writes raw JSON"
  - "Special Quest form uses template-to-model reverse mapping for edit mode pre-filling"
  - "Delete cascades manually (deleteMany completions then delete quest) for explicit control"

patterns-established:
  - "Grouped section rendering: conditional sections with dividers only between non-empty groups"
  - "Admin CRUD pattern: list + create on collection route, update + delete on item route"
  - "Condition template pattern: server defines templates, client picks, API builds condition JSON"

requirements-completed: [QUEST-04, QUEST-05, QUEST-06]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 37 Plan 02: Special Quest Frontend + Admin CRUD Summary

**Grouped quest widget with daily/weekly/special sections, amber-accented special quests with countdown, and admin CRUD for time-limited Special Quest campaigns via preset condition templates**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T19:58:50Z
- **Completed:** 2026-03-02T20:03:02Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- QuestWidget refactored from flat list to grouped sections (Tagesquests, Wochenquests, Special) with dividers and amber accent
- QuestSection reusable component with deep-link navigation, progress display, and countdown badge for special quests
- Full CRUD API for Special Quests (GET list + POST create, PATCH update + DELETE) with admin-only auth
- SpecialQuestForm with 4 preset condition templates (Fristen, Tickets, Rechnungen, Akten) -- admin never touches raw JSON
- GamificationTab extended with Special Quest management section showing active/expired status and inline edit/delete

## Task Commits

Each task was committed atomically:

1. **Task 1: QuestWidget grouped sections + QuestSection component** - `21006a4` (feat)
2. **Task 2: Special Quest CRUD API + admin form in GamificationTab** - `388b3e4` (feat)

## Files Created/Modified
- `src/components/gamification/quest-section.tsx` - Reusable section renderer with header, quest rows, countdown badge
- `src/components/gamification/quest-widget.tsx` - Refactored to render grouped daily/weekly/special sections with dividers
- `src/app/api/gamification/special-quests/route.ts` - GET (list + templates) + POST (create from template)
- `src/app/api/gamification/special-quests/[id]/route.ts` - PATCH (update) + DELETE (with cascading completion removal)
- `src/components/einstellungen/special-quest-form.tsx` - Create/edit form with preset template selection
- `src/components/einstellungen/gamification-tab.tsx` - Extended with Special Quest management CRUD section

## Decisions Made
- QuestSection extracted as separate component for reuse and clean separation from QuestWidget
- CONDITION_TEMPLATES defined server-side in API route and sent to client to keep template logic centralized
- Template-to-model reverse mapping in SpecialQuestForm for edit mode (guesses template from bedingung.model)
- Manual cascade delete (deleteMany completions then delete quest) instead of relying on Prisma cascade for explicit control
- Special Quest date range formatted as "DD.MM - DD.MM.YYYY" in admin list for German locale consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 37 (Klassen + Weekly + Special Quests) is fully complete
- All quest types functional: daily, weekly, special with class-based filtering
- Admin can create, edit, and delete time-limited Special Quest campaigns
- Widget displays all sections with appropriate visual hierarchy
- Ready for next phase (Anti-Missbrauch, Item-Shop, or Team-Dashboard)

## Self-Check: PASSED

All 6 files verified present. Both task commits (21006a4, 388b3e4) verified in git log.

---
*Phase: 37-klassen-weekly-special-quests*
*Completed: 2026-03-02*
