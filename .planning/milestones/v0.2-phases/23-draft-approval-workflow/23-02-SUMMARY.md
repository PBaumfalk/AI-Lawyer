---
phase: 23-draft-approval-workflow
plan: 02
subsystem: ui
tags: [react, socket-io, radix-dialog, sonner, lucide-react, draft-workflow, keyboard-shortcuts]

# Dependency graph
requires:
  - phase: 23-draft-approval-workflow
    provides: HelenaDraft API routes (CRUD, lock, undo), draft-service business logic
  - phase: 19-schema-foundation
    provides: HelenaDraft, HelenaMemory, AktenActivity models
provides:
  - helena:draft-created/revision/accepted/rejected notification types
  - notifyDraftCreated, notifyDraftRevision helpers (notification + Socket.IO broadcast)
  - DraftCard component with dashed violet border, type icon, status badge, action buttons
  - DraftDetailModal with keyboard shortcuts (A/B/R), arrow navigation, lock acquisition
  - DraftPinnedSection grouping pending drafts by type with collapsible UI and "neuer Entwurf" banner
  - DraftRejectForm with 4 content-focused categories, free text, "Nicht ueberarbeiten"
  - DraftLockIndicator showing "Wird von [Name] geprueft"
  - DraftInbox global component with Akte/type filters and pagination
  - /entwuerfe dashboard page
  - Sidebar "Entwuerfe" navigation item with pending draft badge count (real-time via Socket.IO)
affects: [24-scanner-alerts, 25-helena-memory, 26-activity-feed-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [dialog-component-pattern, badge-key-sidebar-pattern, socket-io-banner-refetch, keyboard-shortcut-modal]

key-files:
  created:
    - src/lib/helena/draft-notification.ts
    - src/components/helena/draft-card.tsx
    - src/components/helena/draft-detail-modal.tsx
    - src/components/helena/draft-pinned-section.tsx
    - src/components/helena/draft-reject-form.tsx
    - src/components/helena/draft-lock-indicator.tsx
    - src/components/helena/draft-inbox.tsx
    - src/components/ui/dialog.tsx
    - src/app/(dashboard)/entwuerfe/page.tsx
  modified:
    - src/lib/notifications/types.ts
    - src/components/notifications/notification-center.tsx
    - src/components/layout/sidebar.tsx

key-decisions:
  - "Dialog component created from @radix-ui/react-dialog (already in node_modules) using standard shadcn pattern"
  - "NavItem extended with badgeKey for dynamic sidebar badge support (generic, not Entwuerfe-specific)"
  - "Socket.IO banner refetch pattern: new draft events show 'Neue Entwuerfe' banner instead of auto-inserting cards"
  - "Keyboard shortcuts A/B/R skip text inputs via target.tagName check to avoid conflicts"
  - "Double-bang (!!draft.meta?.datum) for unknown-to-boolean coercion in JSX conditionals"

patterns-established:
  - "Dialog component pattern: standard shadcn Dialog from @radix-ui/react-dialog for modals"
  - "Badge key sidebar pattern: NavItem.badgeKey maps to runtime-resolved badge counts in sidebar"
  - "Socket.IO banner pattern: live events show refetch banner, user clicks to reload (not auto-insert)"
  - "Keyboard shortcut modal: useEffect keydown listener with input element guard for power-user flows"

requirements-completed: [DRFT-03, DRFT-06]

# Metrics
duration: 7min
completed: 2026-02-27
---

# Phase 23 Plan 02: Draft Approval Workflow - UI Summary

**Draft notification pipeline, 7 React UI components (card, modal, pinned section, reject form, lock indicator, inbox), /entwuerfe page, and sidebar navigation with real-time badge**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-27T21:19:20Z
- **Completed:** 2026-02-27T21:27:11Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Complete draft review UI: cards with dashed violet borders, detail modal with keyboard shortcuts (A/B/R), arrow navigation between drafts
- Notification pipeline sends to triggering user + Akte owner via createNotification + Socket.IO room broadcast
- Global /entwuerfe inbox with Akte and type filters, pagination, empty state with Helena icon
- Sidebar badge count updates in real-time via Socket.IO event listeners

## Task Commits

Each task was committed atomically:

1. **Task 1: Notification types + helpers and draft UI components** - `0c357aa` (feat)
2. **Task 2: Global draft inbox page and sidebar navigation** - `d54599c` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `src/lib/notifications/types.ts` - Added 4 helena:draft-* notification types to union
- `src/lib/helena/draft-notification.ts` - notifyDraftCreated + notifyDraftRevision helpers
- `src/components/helena/draft-card.tsx` - DraftCard with type icon, status badge, action buttons, dashed violet border
- `src/components/helena/draft-detail-modal.tsx` - Full content modal with A/B/R shortcuts, arrow nav, lock acquisition
- `src/components/helena/draft-pinned-section.tsx` - Pending drafts grouped by type with collapsible sections and banner
- `src/components/helena/draft-reject-form.tsx` - 4 category checkboxes + free text + "Nicht ueberarbeiten"
- `src/components/helena/draft-lock-indicator.tsx` - "Wird von [Name] geprueft" amber indicator
- `src/components/helena/draft-inbox.tsx` - Global inbox with Akte/type filters, pagination
- `src/components/ui/dialog.tsx` - Standard shadcn Dialog component from @radix-ui/react-dialog
- `src/app/(dashboard)/entwuerfe/page.tsx` - Server component page wrapper with FileCheck icon
- `src/components/notifications/notification-center.tsx` - Added helena:draft-* icons and colors
- `src/components/layout/sidebar.tsx` - Added "Entwuerfe" nav item with FileCheck icon and badge count

## Decisions Made
- Created shadcn Dialog component (was missing but @radix-ui/react-dialog already installed)
- Extended NavItem type with `badgeKey` property for generic dynamic badge support in sidebar
- Used socket banner refetch pattern (show "new draft" banner, user clicks to reload) instead of auto-inserting cards into the feed
- Keyboard shortcuts guard against text input elements via tagName check

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing Dialog UI component**
- **Found during:** Task 1 (DraftDetailModal needs Dialog)
- **Issue:** Plan references shadcn Dialog component but it did not exist in the project
- **Fix:** Created `src/components/ui/dialog.tsx` using standard shadcn pattern with @radix-ui/react-dialog (already installed)
- **Files modified:** src/components/ui/dialog.tsx
- **Verification:** TypeScript compiles without errors
- **Committed in:** 0c357aa (Task 1 commit)

**2. [Rule 3 - Blocking] Updated notification-center with new notification types**
- **Found during:** Task 1 (adding notification types)
- **Issue:** notification-center.tsx has `Record<NotificationType, ...>` maps that became incomplete after adding 4 new helena:draft-* types
- **Fix:** Added icons (Sparkles for created/revision, CheckCircle2 for accepted, XCircle for rejected) and colors to both maps
- **Files modified:** src/components/notifications/notification-center.tsx
- **Verification:** TypeScript compiles without errors
- **Committed in:** 0c357aa (Task 1 commit)

**3. [Rule 1 - Bug] Fixed Set iteration and unknown-to-ReactNode coercion**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** `for...of` on `Set<string>` requires downlevelIteration; `draft.meta?.datum` (unknown) in JSX conditional evaluates to unknown ReactNode
- **Fix:** Used `Array.from()` for Set iteration; used `!!` double-bang for unknown-to-boolean coercion in JSX
- **Files modified:** src/lib/helena/draft-notification.ts, src/components/helena/draft-card.tsx, src/components/helena/draft-detail-modal.tsx
- **Verification:** TypeScript compiles without errors (only pre-existing helena/index.ts errors remain)
- **Committed in:** 0c357aa (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All auto-fixes necessary for compilation. No scope creep.

## Issues Encountered
- 5 pre-existing TypeScript errors in `src/lib/helena/index.ts` (timestamp type mismatch, description property) -- out of scope, from Phase 22

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Draft UI complete, ready for Phase 24 (Scanner + Alerts)
- DraftPinnedSection can be embedded in Akte detail page during Phase 26 (Activity Feed UI)
- Socket.IO events (helena:draft-created, helena:draft-revision) ready for cross-component consumption
- All components follow existing patterns (shadcn, cn(), toast from sonner)

---
*Phase: 23-draft-approval-workflow*
*Completed: 2026-02-27*
