---
phase: 11-glass-ui-migration
plan: 05
subsystem: ui
tags: [glass-ui, oklch, react, tailwind, next-js, kontakte, email, ki-chat]

# Dependency graph
requires:
  - phase: 11-glass-ui-migration/11-03
    provides: [GlassPanel-elevation-prop, glass-card-class, glass-panel-class, glass-input-form-controls, button-motion-spring]
  - phase: 11-glass-ui-migration/11-02
    provides: [glass-sidebar, globals-css-glass-tiers]
provides:
  - kontakte-pages-glass-migrated
  - dokumente-page-glass-migrated
  - email-inbox-glass-migrated
  - ki-chat-glass-migrated
  - ki-entwurf-detail-glass-migrated
affects: [phase-12-falldatenblaetter, phase-13-bi-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Replace .glass class with GlassPanel elevation='panel' for all major section containers"
    - "Use glass-card CSS class for inner card sections within form tab content"
    - "Replace font-heading with font-semibold system-font on all headings"
    - "Use var(--glass-border-color) for border dividers instead of white/10 opacity values"
    - "list-item-in stagger class with animationDelay on table rows (max 10 items)"
    - "Email inline glass: glass-card on folder-tree, glass-panel on email detail pane"

key-files:
  created: []
  modified:
    - src/app/(dashboard)/kontakte/page.tsx
    - src/app/(dashboard)/kontakte/[id]/page.tsx
    - src/app/(dashboard)/kontakte/[id]/bearbeiten/page.tsx
    - src/app/(dashboard)/kontakte/neu/page.tsx
    - src/components/kontakte/kontakt-form.tsx
    - src/app/(dashboard)/dokumente/page.tsx
    - src/app/(dashboard)/ki-chat/page.tsx
    - src/components/email/inbox-layout.tsx
    - src/components/email/email-detail.tsx
    - src/components/email/email-detail-view.tsx
    - src/components/ki/ki-entwurf-detail.tsx

key-decisions:
  - "KontaktForm tab content wraps each tab section in glass-card (not GlassPanel) — client component, CSS class approach avoids extra import"
  - "InboxLayout ResizablePanelGroup: glass-card on folder pane, glass-panel on detail pane — matching visual weight hierarchy"
  - "EmailDetail/EmailDetailView dialogs (VeraktenDialog, TicketDialog) upgraded to GlassPanel elevation=elevated — dialogs are overlays, elevated tier appropriate"
  - "ki-entwuerfe/page.tsx is a redirect to /ki-chat — no glass migration needed"

patterns-established:
  - "var(--glass-border-color) token replaces all border-white/10 and border-white/20 dark:border-white/[0.06] patterns"
  - "font-semibold replaces font-heading across all pages (system font stack established in Plan 01)"

requirements-completed: [UI-01, UI-02, UI-03]

# Metrics
duration: 7min
completed: "2026-02-26"
---

# Phase 11 Plan 05: Kontakte, Dokumente, Email, KI Pages Glass Migration Summary

**Glass design applied to Kontakte list/detail/forms, Dokumente list, Email 3-pane inbox, KI-Chat, and KI-Entwurf detail using GlassPanel elevation tiers, replacing all .glass/.bg-white/opacity-based containers.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-02-26T21:25:05Z
- **Completed:** 2026-02-26T21:32:XX Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Kontakte list page: GlassPanel wrapping table, stagger animation on rows (max 10), glass-card toolbar area
- Kontakt detail page: all tab sections (Uebersicht, Adressen, Rechtliches, KYC, Dokumente, Akten) use GlassPanel elevation="panel"
- KontaktForm: each tab content section wrapped in glass-card with rounded-xl
- Dokumente page: GlassPanel for content area, glass-card for filter bar, font-semibold heading
- Email InboxLayout: folder-tree pane uses glass-card, email detail pane uses glass-panel
- EmailDetail (inline viewer): glass-panel container, font-semibold subject heading, glass-input attachment chips
- EmailDetailView (standalone): GlassPanel for email content card, VeraktenDialog and TicketDialog use GlassPanel elevated, var(--glass-border-color) for all dividers
- KI-Chat page: font-semibold heading, GlassPanel suspense fallback
- KI-Entwurf detail: metadata (panel), content (elevated), actions (panel) — three visual tiers

## Task Commits

1. **Task 1: Migrate Kontakte pages and components** - `7912be6` (feat)
2. **Task 2: Migrate Dokumente list, Email inbox, KI-Chat, KI-Entwuerfe** - `17fbd07` (feat)

## Files Created/Modified

- `src/app/(dashboard)/kontakte/page.tsx` - GlassPanel on table container, stagger animation, font-semibold
- `src/app/(dashboard)/kontakte/[id]/page.tsx` - All section containers → GlassPanel elevation="panel", font-semibold headings
- `src/app/(dashboard)/kontakte/[id]/bearbeiten/page.tsx` - font-semibold heading only
- `src/app/(dashboard)/kontakte/neu/page.tsx` - font-semibold heading only
- `src/components/kontakte/kontakt-form.tsx` - Tab content sections wrapped in glass-card rounded-xl
- `src/app/(dashboard)/dokumente/page.tsx` - GlassPanel on content area, glass-card search bar, font-semibold
- `src/app/(dashboard)/ki-chat/page.tsx` - font-semibold heading, GlassPanel suspense fallback
- `src/components/email/inbox-layout.tsx` - glass-card on folder-tree panel
- `src/components/email/email-detail.tsx` - glass-panel container replaces bg-white, font-semibold subject
- `src/components/email/email-detail-view.tsx` - GlassPanel on email card + dialogs, var(--glass-border-color) borders, glass-input chips
- `src/components/ki/ki-entwurf-detail.tsx` - GlassPanel on metadata/content/actions sections, font-semibold heading

## Decisions Made

- `ki-entwuerfe/page.tsx` already redirects to `/ki-chat` — no glass changes needed, handled at plan execution time
- `KontaktForm` uses `glass-card` CSS class (not `GlassPanel` component) for tab sections — it's a client component and the CSS approach is lighter
- Email dialog overlays (VeraktenDialog, TicketDialog) upgraded to `GlassPanel elevation="elevated"` — elevated tier appropriate for modal overlays
- `var(--glass-border-color)` replaces `border-white/10 dark:border-white/[0.06]` patterns throughout for consistent design token usage

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated EmailDetail and EmailDetailView components (not just page files)**
- **Found during:** Task 2 (Email page migration)
- **Issue:** email/page.tsx delegates entirely to `InboxLayout` and `EmailDetailView` client components — changes must go into those components
- **Fix:** Applied glass styling to `inbox-layout.tsx`, `email-detail.tsx`, and `email-detail-view.tsx` directly; also updated VeraktenDialog and TicketDialog within EmailDetailView
- **Files modified:** src/components/email/inbox-layout.tsx, src/components/email/email-detail.tsx, src/components/email/email-detail-view.tsx
- **Committed in:** `17fbd07` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing component-level changes)
**Impact on plan:** Required to achieve glass migration goals for email pages. No scope creep.

## Issues Encountered

Pre-existing TypeScript errors in `src/components/ki/chat-layout.tsx` (UIMessage from @ai-sdk/react) and `src/worker.ts` (storagePfad property) were present before this plan. No new errors introduced.

## Next Phase Readiness

- Kontakte, Dokumente, Email, KI-Chat, KI-Entwuerfe all carry glass design system styling
- Plan 06 (Finanzen, Kalender, Tickets, beA, Settings) can follow same patterns established here
- All form inputs on migrated pages auto-inherit glass-input from Plan 03 shared components

---
*Phase: 11-glass-ui-migration*
*Completed: 2026-02-26*
