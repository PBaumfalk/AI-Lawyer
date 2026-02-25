---
phase: 03-email-client
plan: 02
subsystem: ui
tags: [react-resizable-panels, tanstack-react-virtual, dompurify, inbox-ui, three-pane-layout, keyboard-shortcuts, email-html-sanitization]

# Dependency graph
requires:
  - phase: 03-email-client
    provides: Email API routes (emails, email-folders, email-konten, email-send, emails/bulk), EmailNachricht/EmailOrdner/EmailKonto Prisma models
  - phase: 01-infrastructure-foundation
    provides: shadcn/ui component library, dashboard layout with sidebar/header, Socket.IO provider
provides:
  - Three-pane resizable inbox layout (folder tree, email list, email detail)
  - Virtualized email list with infinite scroll and cursor-based pagination
  - Email detail view with DOMPurify-sanitized HTML rendering
  - Folder tree with collapsible mailboxes and unread count badges
  - Email filter bar (status, veraktet, unread, search, sort)
  - Bulk actions via checkboxes with shift+click range select
  - Email actions bar (reply, reply-all, forward, verakten, ticket, archive, spam, delete)
  - Inline reply/forward compose area below email body
  - Gmail-style keyboard shortcuts (J/K/R/A/F/V/E/Escape)
  - Resizable panel wrapper with localStorage persistence
  - Client-side email store hook for inbox state management
affects: [03-03, 03-04, email-compose, veraktung-panel, akte-email-tab]

# Tech tracking
tech-stack:
  added: []
  patterns: [shadcn-style resizable panel wrapper with localStorage auto-save, virtualized list with useVirtualizer and cursor-based infinite scroll, DOMPurify client-side HTML sanitization with email-safe config, contentEditable inline reply editor, custom event dispatch for keyboard shortcut actions]

key-files:
  created:
    - src/components/ui/resizable.tsx
    - src/hooks/use-email-store.ts
    - src/hooks/use-keyboard-shortcuts.ts
    - src/app/(dashboard)/email/layout.tsx
    - src/components/email/inbox-layout.tsx
    - src/components/email/folder-tree.tsx
    - src/components/email/email-empty-state.tsx
    - src/components/email/email-filters.tsx
    - src/components/email/email-list.tsx
    - src/components/email/email-list-row.tsx
    - src/components/email/email-detail.tsx
    - src/components/email/email-html-body.tsx
    - src/components/email/email-actions-bar.tsx
    - src/components/email/email-inline-reply.tsx
  modified:
    - src/app/(dashboard)/email/page.tsx

key-decisions:
  - "react-resizable-panels v4 API: Group/Panel/Separator (not PanelGroup), orientation (not direction), manual localStorage layout persistence via onLayoutChanged"
  - "Panel IDs required for layout persistence: folder-tree, email-list, email-detail"
  - "DOMPurify client-side with email-safe allowlist (tables, fonts, inline styles, images) and forced target=_blank on links"
  - "contentEditable for inline reply editor (minimal, TipTap reuse planned for Plan 03 compose)"
  - "Custom event dispatch pattern for keyboard shortcut actions (email:reply-action, email:action)"
  - "Verakten/Ticket buttons as stubs with toast info -- full implementation in Plan 04"
  - "Veraktungs-Empfehlung banner shows on reply/forward of unveraktete emails per locked decision"

patterns-established:
  - "Resizable panel wrapper: Group component with autoSaveId prop handles localStorage save/restore automatically"
  - "Email store pattern: useState/useCallback hook with localStorage for folder selection persistence"
  - "Email list row: memoized component with data-email-id attribute for keyboard navigation DOM queries"
  - "Filter chip pattern: small toggle buttons with active brand color state"
  - "Inline reply pattern: contentEditable div with toolbar buttons using document.execCommand"

requirements-completed: [REQ-EM-003, REQ-EM-004]

# Metrics
duration: 10min
completed: 2026-02-24
---

# Phase 3 Plan 02: Inbox UI Summary

**Three-pane resizable inbox with virtualized email list, DOMPurify-sanitized HTML detail view, inline reply/forward, folder tree with unread badges, and Gmail-style keyboard shortcuts**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-24T14:26:11Z
- **Completed:** 2026-02-24T14:36:16Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Three-pane resizable layout with localStorage-persisted panel sizes at /email
- Virtualized email list using @tanstack/react-virtual with cursor-based infinite scroll and overscan 10
- Folder tree with collapsible mailbox sections, special folder icons, and real-time unread count badges
- Email detail view with auto-mark-as-read, sanitized HTML rendering via DOMPurify, and attachment strip
- Filter bar with status/veraktet chips, unread toggle, debounced search, and sort dropdown
- Email actions bar with all 8 actions including soft delete with 5-second undo toast
- Inline reply/forward compose area below email body with pre-filled recipients and quoted text
- Veraktungs-Empfehlung yellow banner when replying to unveraktete emails
- Gmail-style keyboard shortcuts: J/K navigate, R reply, A reply-all, F forward, E archive, Escape deselect
- Bulk actions via checkboxes with shift+click range select

## Task Commits

Each task was committed atomically:

1. **Task 1: Three-pane resizable layout, folder tree, email store** - `6fb96d7` (feat)
2. **Task 2: Virtualized email list, filters, detail view, inline reply, keyboard shortcuts** - `87ec900` (feat)

## Files Created/Modified
- `src/components/ui/resizable.tsx` - shadcn-style wrapper around react-resizable-panels v4 with localStorage persistence
- `src/hooks/use-email-store.ts` - Client-side inbox state management (folder/email selection, filters, bulk checks)
- `src/hooks/use-keyboard-shortcuts.ts` - Gmail-style keyboard shortcuts for email navigation and actions
- `src/app/(dashboard)/email/layout.tsx` - Email-specific layout removing dashboard padding for full-height view
- `src/app/(dashboard)/email/page.tsx` - Server component rendering InboxLayout
- `src/components/email/inbox-layout.tsx` - Three-pane resizable layout with folder tree, email list, email detail
- `src/components/email/folder-tree.tsx` - Collapsible mailbox sections with IMAP folders and unread count badges
- `src/components/email/email-empty-state.tsx` - Empty states for no-mailbox, empty-folder, and no-selection
- `src/components/email/email-filters.tsx` - Filter bar with status chips, unread toggle, search, sort
- `src/components/email/email-list.tsx` - Virtualized email list with infinite scroll and bulk actions
- `src/components/email/email-list-row.tsx` - Memoized email row with sender, subject, date, badges, quick actions
- `src/components/email/email-detail.tsx` - Full email detail with header, attachments, body, and inline reply
- `src/components/email/email-html-body.tsx` - DOMPurify-sanitized HTML rendering with CSS containment
- `src/components/email/email-actions-bar.tsx` - 8 action buttons with Veraktungs-Empfehlung banner
- `src/components/email/email-inline-reply.tsx` - Inline reply/forward with pre-filled recipients, editor, quoted text

## Decisions Made
- react-resizable-panels v4 uses Group/Panel/Separator exports (not PanelGroup/PanelResizeHandle), orientation prop (not direction), and requires manual localStorage persistence via onLayoutChanged callback
- Panel IDs (folder-tree, email-list, email-detail) required for layout persistence mapping
- DOMPurify used client-side with email-safe allowed tags/attributes -- server-side sanitize-html from Plan 01 handles initial storage
- contentEditable used for inline reply editor as minimal approach; TipTap integration planned for compose popup in Plan 03
- Custom window events (email:reply-action, email:action) used to bridge keyboard shortcuts with email detail component
- Verakten and Ticket buttons are functional stubs showing toast info -- full slide-over panel in Plan 04

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed react-resizable-panels v4 API mismatch**
- **Found during:** Task 1 (resizable.tsx creation)
- **Issue:** shadcn pattern uses PanelGroup/PanelResizeHandle but react-resizable-panels v4 exports Group/Panel/Separator
- **Fix:** Updated wrapper to use correct v4 exports, added manual localStorage persistence via onLayoutChanged
- **Files modified:** src/components/ui/resizable.tsx, src/components/email/inbox-layout.tsx
- **Committed in:** 6fb96d7 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed orientation prop name**
- **Found during:** Task 1 (inbox-layout.tsx creation)
- **Issue:** v4 uses `orientation` prop instead of `direction`, and requires `id` on panels for layout persistence
- **Fix:** Changed direction="horizontal" to orientation="horizontal", added id props to all panels
- **Files modified:** src/components/email/inbox-layout.tsx
- **Committed in:** 6fb96d7 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs - API mismatch)
**Impact on plan:** Both fixes necessary for react-resizable-panels v4 compatibility. No scope creep.

## Issues Encountered
- Pre-existing TS errors in mailbox-config/sync-dashboard.tsx and user-assignment.tsx (Set spread with downlevelIteration) -- out of scope, from Plan 01

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Inbox UI complete and ready for email compose popup (Plan 03)
- Verakten/Ticket button stubs ready for Plan 04 slide-over panel implementation
- Inline reply framework in place for TipTap editor integration in Plan 03
- Keyboard shortcuts established -- can be extended in future plans
- All API routes from Plan 01 consumed by UI components

## Self-Check: PASSED

All 15 created/modified files verified present. All 2 task commits verified in git log.

---
*Phase: 03-email-client*
*Completed: 2026-02-24*
