---
phase: 11-glass-ui-migration
plan: 03
subsystem: ui
tags: [glass-ui, motion, animations, oklch, react, shadcn, tailwind]

# Dependency graph
requires:
  - phase: 11-glass-ui-migration/11-01
    provides: [globals-css-oklch, glass-tier-classes, motion-installed]
provides:
  - glass-card-variant-prop
  - glass-kpi-card-count-up-animation
  - glass-kpi-card-skeleton-prop
  - glass-panel-elevation-prop
  - button-motion-spring
  - glass-input-form-primitives
  - skeleton-glass-shimmer
  - toast-glass-styling
affects: [all-pages, all-components, dashboard, akten, forms]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Motion spring button: whileHover scale 1.02, whileTap scale 0.98, spring stiffness 400 damping 25"
    - "Count-up animation: useMotionValue + animate with onUpdate Math.round, useReducedMotion guard"
    - "Glass input tier: glass-input CSS class replaces border/bg-background in all form controls"
    - "Skeleton shimmer: glass-shimmer class from globals.css (gradient slide animation)"

key-files:
  created:
    - src/components/ui/skeleton.tsx
  modified:
    - src/components/ui/glass-card.tsx
    - src/components/ui/glass-kpi-card.tsx
    - src/components/ui/glass-panel.tsx
    - src/components/ui/button.tsx
    - src/components/ui/input.tsx
    - src/components/ui/textarea.tsx
    - src/components/ui/select.tsx
    - src/app/layout.tsx

key-decisions:
  - "glass-kpi-card count-up imports motion but unused motion variable kept via named import — removed unused import to keep clean (only useMotionValue/animate/useReducedMotion used)"
  - "button.tsx asChild path uses plain Slot without motion wrapping — asChild renders arbitrary children so spring would conflict with their own transforms"
  - "@ts-expect-error retained on motion.button line — motion v11 + React 19 ButtonHTMLAttributes type mismatch is a known upstream issue, runtime correct"
  - "textarea default resize-none — prevents layout breaks in glass forms; user can override via className"

patterns-established:
  - "Glass form control pattern: replace border/bg-background with glass-input class in all form inputs"
  - "Motion button pattern: forwardRef + prefersReducedMotion check + conditional scale props"
  - "Skeleton pattern: glass-shimmer class (not animate-pulse bg-muted) for all loading placeholders"

requirements-completed: [UI-01, UI-02, UI-03]

# Metrics
duration: 1min
completed: "2026-02-26"
---

# Phase 11 Plan 03: Glass UI Primitives Summary

**Shared UI components upgraded with Motion spring interactions, glass-input tier on all form controls, count-up KPI animations, and glass-shimmer skeleton — propagates glass design system to all 46 pages without per-page edits.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-26T21:15:38Z
- **Completed:** 2026-02-26T21:17:XX Z
- **Tasks:** 2
- **Files modified:** 8 (1 created)

## Accomplishments

- GlassCard and GlassPanel now have variant/elevation props with 4-tier glass class mapping, backward-compat props preserved
- GlassKpiCard counts up from 0 to actual value on mount (Motion animate, 0.8s easeOut) with skeleton prop for shimmer loading state
- Button wraps in motion.button with spring hover/tap (scale 1.02/0.98, stiffness 400), useReducedMotion respected, asChild path unaffected
- Input, Textarea, Select all switched to glass-input styling (8px blur, oklch border, brand-blue focus ring)
- Skeleton component created with glass-shimmer animation (replaces Tailwind animate-pulse bg-muted pattern)
- Sonner Toaster in layout.tsx uses glass-panel classNames with CSS variable border/shadow overrides

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade glass-card, glass-kpi-card, glass-panel with Motion** - `e10ff89` (feat)
2. **Task 2: Upgrade Button with Motion, apply glass-input to form primitives, upgrade Skeleton, update Toast** - `c491769` (feat)

## Files Created/Modified

- `src/components/ui/glass-card.tsx` - Added variant prop (default=glass-card / elevated=glass-panel-elevated), backward-compat heavy prop
- `src/components/ui/glass-kpi-card.tsx` - Count-up animation with Motion useMotionValue+animate, skeleton prop with glass-shimmer
- `src/components/ui/glass-panel.tsx` - Added elevation prop (card/panel/elevated), backward-compat prominent prop
- `src/components/ui/button.tsx` - motion.button wrapper with whileHover/whileTap spring, useReducedMotion guard, asChild Slot path unchanged
- `src/components/ui/input.tsx` - glass-input class replaces border/bg-background/ring-offset pattern
- `src/components/ui/textarea.tsx` - glass-input class + resize-none default
- `src/components/ui/select.tsx` - glass-input class on select element (trigger only)
- `src/components/ui/skeleton.tsx` - Created new; glass-shimmer CSS class (not animate-pulse)
- `src/app/layout.tsx` - Toaster toastOptions.classNames.toast = glass-panel + CSS var border/shadow

## Decisions Made

- `@ts-expect-error` retained on `motion.button` — motion v11 + React 19 ButtonHTMLAttributes type mismatch is a known upstream issue; runtime behavior correct
- `asChild` path in button.tsx uses plain `Slot` (no motion) — Slot renders arbitrary children; adding spring to Slot would conflict with children's own transforms
- Unused `motion` named import not included in glass-kpi-card — only `useMotionValue`, `animate`, `useReducedMotion` needed
- `textarea` gets `resize-none` default — prevents glass layout breaks; fully overridable via className prop

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `src/components/ki/chat-layout.tsx` (UIMessage from @ai-sdk/react) and `src/worker.ts` (storagePfad property) were present before this plan. No new errors introduced.

## Next Phase Readiness

- All shared UI primitives now carry glass design system styling
- Plan 04 (Dashboard) can use GlassKpiCard with count-up and skeleton props immediately
- Glass-input automatically applied to all forms across 46 pages via shared Input/Textarea/Select components
- Button spring animations live on every clickable element site-wide

---
*Phase: 11-glass-ui-migration*
*Completed: 2026-02-26*
