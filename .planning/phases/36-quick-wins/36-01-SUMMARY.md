---
phase: 36-quick-wins
plan: 01
subsystem: ui
tags: [react, empty-state, tabs, kpi, ux]

# Dependency graph
requires:
  - phase: none
    provides: none
provides:
  - Reusable EmptyState component with icon, title, description, role-filtered CTAs
  - Clickable KPI cards with tab navigation in Akte detail view
  - Controlled/uncontrolled AkteDetailTabs (accepts external activeTab/onTabChange)
  - Chat rename from Nachrichten throughout Akte detail
affects: [36-02-PLAN, akte-detail, empty-states]

# Tech tracking
tech-stack:
  added: []
  patterns: [controlled-uncontrolled-tabs, reusable-empty-state, kpi-card-navigation]

key-files:
  created:
    - src/components/ui/empty-state.tsx
    - src/app/(dashboard)/akten/[id]/akte-detail-client.tsx
  modified:
    - src/app/(dashboard)/akten/[id]/page.tsx
    - src/components/akten/akte-detail-tabs.tsx
    - src/components/dokumente/dokumente-tab.tsx
    - src/components/kalender/kalender-tab.tsx
    - src/components/messaging/message-list.tsx
    - src/components/finanzen/akte-zeiterfassung-tab.tsx

key-decisions:
  - "EmptyState in message-list.tsx (not akte-channel-tab.tsx) since MessageView has visible composer even when empty"
  - "Zeiterfassung EmptyState inside td colSpan to preserve table structure rather than full component replacement"
  - "Controlled/uncontrolled pattern for AkteDetailTabs so it works both standalone and with external KPI control"

patterns-established:
  - "EmptyState pattern: icon circle + title + description + role-filtered CTA buttons"
  - "KPI-to-tab navigation: client wrapper manages activeTab, passes to AkteDetailTabs"

requirements-completed: [QW-01, QW-03, QW-04]

# Metrics
duration: 5min
completed: 2026-03-02
---

# Phase 36 Plan 01: KPI Cards + Empty States Summary

**Clickable KPI cards navigating to tabs, reusable EmptyState component in 4 tabs, Nachrichten renamed to Chat**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-02T17:43:40Z
- **Completed:** 2026-03-02T17:48:31Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- KPI stat cards in Akte detail are now clickable with hover effects, navigating to the corresponding tab
- Reusable EmptyState component with icon, title, description, and role-filtered CTA buttons
- EmptyState wired into Dokumente, Kalender, Chat, and Zeiterfassung tabs
- "Nachrichten" renamed to "Chat" in both KPI card and tab trigger
- AkteDetailTabs supports external control via activeTab/onTabChange props

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EmptyState component + refactor KPI cards as clickable with tab state lifting** - `8eab880` (feat)
2. **Task 2: Wire EmptyState into Dokumente, Kalender, Nachrichten, and Zeiterfassung tabs** - `1dcb62e` (feat)

## Files Created/Modified
- `src/components/ui/empty-state.tsx` - Reusable EmptyState with icon, title, description, role-filtered CTAs
- `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx` - Client wrapper with clickable KPI cards and tab control
- `src/app/(dashboard)/akten/[id]/page.tsx` - Server component refactored to use AkteDetailClient
- `src/components/akten/akte-detail-tabs.tsx` - Controlled/uncontrolled tab pattern, Chat rename, zeiterfassung-section id
- `src/components/dokumente/dokumente-tab.tsx` - EmptyState with upload + template CTAs
- `src/components/kalender/kalender-tab.tsx` - EmptyState with Termin erstellen CTA
- `src/components/messaging/message-list.tsx` - EmptyState for no messages
- `src/components/finanzen/akte-zeiterfassung-tab.tsx` - EmptyState with manual entry CTA

## Decisions Made
- EmptyState placed in message-list.tsx (not akte-channel-tab.tsx) because the MessageView already shows a visible composer input even when there are no messages -- the empty state appears in the message area only
- Zeiterfassung EmptyState rendered inside a `<td colSpan={6}>` to preserve the table structure rather than replacing the entire table
- Controlled/uncontrolled pattern for AkteDetailTabs so it works both standalone (internal state) and with external KPI card control

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EmptyState component is reusable for any future tab/view that needs empty states
- AkteDetailTabs now supports external control, enabling future features like URL-based tab switching
- Ready for Plan 02 (remaining quick wins)

---
*Phase: 36-quick-wins*
*Completed: 2026-03-02*
