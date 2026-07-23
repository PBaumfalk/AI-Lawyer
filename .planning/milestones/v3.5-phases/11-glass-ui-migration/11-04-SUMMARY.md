---
phase: 11-glass-ui-migration
plan: 04
subsystem: ui
tags: [glass-ui, tailwind, animations, css-keyframes, oklch, react, nextjs]

# Dependency graph
requires:
  - phase: 11-glass-ui-migration/11-03
    provides: [glass-card-variant-prop, glass-panel-elevation-prop, glass-input-form-primitives, button-motion-spring]
  - phase: 11-glass-ui-migration/11-02
    provides: [glass-sidebar, dark-mode-toggle, theme-provider]
provides:
  - dashboard-glass-layout
  - akten-list-glass-panel
  - akte-detail-glass-tabs
  - akte-neu-glass-form
  - list-item-stagger-animation
affects: [all-dashboard-pages, akten-subsystem]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS keyframe stagger: list-item-in animation with prefers-reduced-motion guard, 50ms delay per item (max 10), applied via class + animationDelay inline style"
    - "Card-with-header pattern: GlassCard p-0 + div px-6 py-4 border-b border-[var(--glass-border-color)] for card header separator"
    - "GlassPanel wrapping: server components wrap section containers in GlassPanel without needing use-client"

key-files:
  created: []
  modified:
    - src/app/globals.css
    - src/app/(dashboard)/dashboard/page.tsx
    - src/app/(dashboard)/akten/page.tsx
    - src/app/(dashboard)/akten/[id]/page.tsx
    - src/app/(dashboard)/akten/[id]/emails/page.tsx
    - src/app/(dashboard)/akten/neu/page.tsx
    - src/components/akten/akte-detail-tabs.tsx
    - src/components/akten/akte-detail-header.tsx

key-decisions:
  - "CSS keyframe stagger chosen over Motion stagger for server components — avoids use-client requirement on server-side dashboard page"
  - "prefers-reduced-motion guard wraps list-item-in class in @media query so reduced-motion users see instant appearance"
  - "glass-panel class directly applied on akte-neu form section (not GlassPanel component) — page is already use-client, className approach simpler"
  - "akten-search-bar.tsx unchanged — already uses Input and Select components which auto-apply glass-input from Plan 03"
  - "dokumente/[docId]/page.tsx unchanged — pure passthrough with no layout styling to migrate"

patterns-established:
  - "List stagger pattern: CSS .list-item-in class + inline animationDelay style, max 10 animated items, rest appear instantly"
  - "Card header separator: GlassCard className=p-0 with inner div using border-b border-[var(--glass-border-color)]"
  - "font-heading eliminated: all h1/h2/h3 replaced with font-semibold across dashboard and akten subsystem"

requirements-completed: [UI-01, UI-03]

# Metrics
duration: 3min
completed: "2026-02-26"
---

# Phase 11 Plan 04: Dashboard and Akten Glass Migration Summary

**Dashboard and all Akten pages migrated to glass design system with GlassPanel section wrappers, card-with-header pattern, CSS stagger animations on list items, and font-heading eliminated throughout.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-26T21:20:02Z
- **Completed:** 2026-02-26T21:22:38Z
- **Tasks:** 2
- **Files modified:** 8 (+ globals.css)

## Accomplishments

- Dashboard: Tagesuebersicht wrapped in GlassPanel, GlassCard uses card-with-header visual pattern (px-6 py-4 header + border-b separator), stagger CSS animation on recent Akten and upcoming Fristen lists (max 10 items, 50ms delay)
- Added `list-item-in` CSS keyframe animation to globals.css with prefers-reduced-motion guard — works in server components without Motion/React
- Akten list page: table/empty state wrapped in GlassPanel (explicit, not the legacy `.glass` alias)
- Akte detail: StatMini uses explicit `glass-card` class; AkteDetailTabs replaces all `bg-white/50 backdrop-blur-md border border-white/20` inline patterns with `glass-card rounded-xl`
- Akte-Neu form: form section uses `glass-panel rounded-2xl`
- All h1/h2/h3 headings replaced from `font-heading` to `font-semibold` across 6 files

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate Dashboard page + add stagger animation** - `6edca78` (feat)
2. **Task 2: Migrate Akten list, detail, sub-pages, and components** - `a5b4017` (feat)

## Files Created/Modified

- `src/app/globals.css` - Added list-item-in CSS keyframe animation with prefers-reduced-motion guard
- `src/app/(dashboard)/dashboard/page.tsx` - GlassPanel for Tagesuebersicht, card-with-header pattern on GlassCards, CSS stagger list animation, font-semibold headings
- `src/app/(dashboard)/akten/page.tsx` - GlassPanel for table and empty state, font-semibold heading
- `src/app/(dashboard)/akten/[id]/page.tsx` - glass-card class on StatMini (was legacy `.glass` alias)
- `src/app/(dashboard)/akten/[id]/emails/page.tsx` - font-semibold heading
- `src/app/(dashboard)/akten/neu/page.tsx` - glass-panel class on form section, font-semibold heading
- `src/components/akten/akte-detail-tabs.tsx` - Replace all bg-white/50 backdrop-blur inline patterns with glass-card class, font-semibold headings
- `src/components/akten/akte-detail-header.tsx` - font-semibold heading

## Decisions Made

- CSS keyframe approach for stagger instead of Motion — server components cannot use `"use client"` hooks, so CSS animation-delay with the `list-item-in` class is the correct pattern for Next.js server pages
- `prefers-reduced-motion` guard placed at media-query level in globals.css, not inline — consistent with Plan 01 accessibility approach
- `akten-search-bar.tsx` required no changes — already uses `<Input>` and `<Select>` from shadcn which received glass-input styling in Plan 03

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `src/components/ki/chat-layout.tsx` (UIMessage from @ai-sdk/react) and `src/worker.ts` (storagePfad property) were present before this plan. No new errors introduced.

## Next Phase Readiness

- Dashboard and Akten subsystem fully on glass design language
- Plan 05 (Kontakte + Dokumente pages) can proceed immediately
- CSS stagger pattern established and reusable for any list page

---
*Phase: 11-glass-ui-migration*
*Completed: 2026-02-26*
