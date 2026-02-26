---
phase: 11-glass-ui-migration
plan: 02
subsystem: layout-shell
tags: [glass-ui, sidebar, header, motion, dark-mode, oklch, layout]
dependency_graph:
  requires: [11-01]
  provides: [glass-sidebar, glass-header, transparent-layout-shell]
  affects: [all-dashboard-pages, all-layout-components]
tech_stack:
  added: []
  patterns: [motion-spring-animation, glass-sidebar-class, useReducedMotion, useTheme, oklch-active-states]
key_files:
  created: []
  modified:
    - src/components/layout/sidebar.tsx
    - src/components/layout/header.tsx
    - src/app/(dashboard)/layout.tsx
decisions:
  - "Removed @ts-expect-error directives — motion@12.34.3 types are compatible with React 19 in this project (no type mismatch exists at runtime or compile time)"
  - "Used motion.aside with width animation (56px/240px) driven by collapsed boolean state, spring stiffness 300 damping 30"
  - "Active nav item uses oklch(45% 0.2 260 / 0.15) bg + oklch(45% 0.2 260) text + 2px left border for brand-blue indicator"
metrics:
  duration: 3 minutes
  completed_date: "2026-02-26T21:13:28Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 11 Plan 02: Layout Shell Glass Migration Summary

Glass sidebar with Motion/React spring animation, dark mode toggle, and brand-blue active states replaces the dark Slate-900 sidebar; header upgraded to sticky glass-panel; dashboard layout made fully transparent so gradient mesh canvas shows through.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate sidebar to glass-sidebar with Motion and dark mode toggle | eb8a64e | src/components/layout/sidebar.tsx |
| 2 | Upgrade header to glass-panel + update dashboard layout shell | c6e45fd | src/components/layout/header.tsx, src/app/(dashboard)/layout.tsx |

## What Was Built

**sidebar.tsx** — Complete rewrite to glass-sidebar design:
- `<motion.aside>` with spring animation: `width: 56px (collapsed) / 240px (expanded)`, spring stiffness 300, damping 30
- `useReducedMotion()` hook: respects `prefers-reduced-motion` OS setting (sets duration 0)
- `glass-sidebar` CSS class from Plan 01 (backdrop-blur 40px, transparent background)
- Text colors: `oklch(20% 0.01 250)` light / `oklch(92% 0.005 250)` dark
- Logo area: `rounded-[10px]` glass chip (`bg-white/15 backdrop-blur-[8px]`) with brand-blue Scale icon
- Collapse button: chevron rotates 180° when collapsed
- Active nav item: `bg-[oklch(45%_0.2_260/0.15)] text-[oklch(45%_0.2_260)] border-l-2 border-[oklch(45%_0.2_260)] -ml-[2px]`
- Inactive nav item: `oklch(40% 0.015 250)` light / `oklch(65% 0.01 250)` dark with subtle hover
- `title={collapsed ? item.name : undefined}` on all links (native tooltip on hover when collapsed)
- `motion.span` fade-in (`opacity: 0 → 1, duration: 0.15s`) on all text labels when expanded
- Admin section: oklch separator borders + ADMINISTRATION caps label with oklch text
- Timer widget wrapped in `glass-card` chip container (hidden when collapsed)
- Dark mode toggle: Sun icon in dark mode / Moon icon in light mode, calls `setTheme("light"/"dark")`
- Profile chip: `glass-card` container, user initials in brand-blue circle, display name, logout icon
- Collapsed profile chip: shows only logout icon centered

**header.tsx** — Upgraded to explicit glass-panel:
- `sticky top-0 z-40` — stays fixed at top while content scrolls
- `glass-panel` — explicit 24px backdrop-blur tier from Plan 01 design system
- `border-b border-[var(--glass-border-color)]` — uses new CSS token (adapts light/dark)
- Search button border updated to `border-[var(--glass-border-color)]`
- User avatar updated from `bg-brand-600` to `bg-[oklch(45%_0.2_260)]` for consistency with sidebar

**layout.tsx** — Dashboard shell made transparent:
- Removed `bg-mesh` from outer wrapper div — body gradient from Plan 01 handles all background (uses `background-attachment: fixed`)
- Added `bg-transparent` to `<main>` element — glass panels now float directly on the gradient canvas

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed @ts-expect-error directives from motion elements**
- **Found during:** Task 1
- **Issue:** Plan specified adding `@ts-expect-error -- motion v11 + React 19 type mismatch` before each `motion.*` element. However, the project uses `motion@12.34.3` which has proper React 19 types. The `@ts-expect-error` directives caused TypeScript error TS2578 ("Unused '@ts-expect-error' directive") on every motion element, breaking strict TypeScript compilation.
- **Fix:** Removed all `@ts-expect-error` directives. Motion types are fully compatible in this project.
- **Files modified:** src/components/layout/sidebar.tsx
- **Commit:** eb8a64e (included in task commit)

## Self-Check: PASSED

Files verified:
- `src/components/layout/sidebar.tsx` — FOUND (motion.aside, glass-sidebar, dark mode toggle, profile chip)
- `src/components/layout/header.tsx` — FOUND (sticky, glass-panel, var(--glass-border-color))
- `src/app/(dashboard)/layout.tsx` — FOUND (bg-mesh removed, bg-transparent on main)

Commits verified:
- eb8a64e — FOUND (sidebar glass migration)
- c6e45fd — FOUND (header + layout shell)
