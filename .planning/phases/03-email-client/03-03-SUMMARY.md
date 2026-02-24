---
phase: 03-email-client
plan: 03
subsystem: email-ui
tags: [tiptap, compose, signature, mailbox-admin, provider-discovery, connection-test, bullmq, sonner]

# Dependency graph
requires:
  - phase: 03-email-client
    provides: Email Prisma models, IMAP sync, SMTP send queue, email CRUD APIs, mailbox config APIs
  - phase: 01-infrastructure-foundation
    provides: BullMQ queues, Socket.IO, Sonner toasts, shadcn/ui components
provides:
  - Gmail-style floating compose popup with TipTap rich-text editor
  - ComposeManager context for managing multiple compose windows
  - Recipient auto-complete from contacts and previous emails
  - Attachment upload (drag-and-drop) and DMS file picker
  - Signature template rendering with placeholder substitution
  - 10-second send-with-undo via BullMQ and cancel API
  - Scheduled sending with preset and custom datetime
  - Admin mailbox settings page at /einstellungen/email
  - Mailbox CRUD with provider auto-discovery (M365, Gmail, IONOS, Strato)
  - Connection test with live step-by-step IMAP/SMTP feedback
  - TipTap signature template editor with placeholder chips and preview
  - Sync dashboard with per-mailbox status, error log, manual sync
  - User-to-mailbox assignment matrix
  - Manual sync trigger API route
affects: [03-04, email-compose-integration, akte-email-tab, einstellungen-navigation]

# Tech tracking
tech-stack:
  added: []
  patterns: [ComposeManager context pattern for multiple compose windows, provider auto-discovery profiles, signature placeholder rendering, Set.add pattern for downlevelIteration compatibility]

key-files:
  created:
    - src/lib/email/signature.ts
    - src/components/email/compose-popup.tsx
    - src/components/email/compose-editor.tsx
    - src/components/email/compose-toolbar.tsx
    - src/components/email/compose-recipients.tsx
    - src/components/email/compose-attachments.tsx
    - src/components/email/compose-manager.tsx
    - src/app/api/email-send/cancel/route.ts
    - src/app/(dashboard)/einstellungen/email/page.tsx
    - src/components/email/mailbox-config/mailbox-form.tsx
    - src/components/email/mailbox-config/mailbox-list.tsx
    - src/components/email/mailbox-config/connection-test.tsx
    - src/components/email/mailbox-config/provider-profiles.tsx
    - src/components/email/mailbox-config/signature-editor.tsx
    - src/components/email/mailbox-config/sync-dashboard.tsx
    - src/components/email/mailbox-config/user-assignment.tsx
    - src/app/api/email-konten/[id]/sync/route.ts
  modified: []

key-decisions:
  - "TextStyle and Color imported as named exports from TipTap v3 (no default exports)"
  - "User.position mapped to signature titel, User.telefon mapped to mobil/durchwahl (User model lacks dedicated fields)"
  - "Set.add() instead of Set spread for downlevelIteration TypeScript compatibility"
  - "Compose popup is for NEW emails only -- reply/forward handled inline in Plan 02"
  - "Provider auto-discovery covers M365, Gmail, IONOS, Strato with manual fallback"

patterns-established:
  - "ComposeManager context: React context provider wrapping app for managing multiple compose windows"
  - "Provider auto-discovery: ProviderProfile interface with pre-filled IMAP/SMTP config per provider"
  - "Signature placeholder pattern: {{name}}, {{titel}}, {{mobil}}, {{durchwahl}}, {{email}} in HTML template"
  - "Connection test step UI: step list with pending/running/success/error states and live feedback"

requirements-completed: [REQ-EM-006, REQ-EM-002]

# Metrics
duration: 10min
completed: 2026-02-24
---

# Phase 3 Plan 03: Email Compose & Mailbox Admin Summary

**Gmail-style floating compose popup with TipTap rich-text editor, recipient auto-complete, 10-second undo send, and full mailbox admin settings with provider auto-discovery, connection testing, signature template editor, and user assignment matrix**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-24T14:26:15Z
- **Completed:** 2026-02-24T14:36:51Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Gmail-style floating compose popup with minimize/maximize support and multiple simultaneous drafts via ComposeManager context
- Full TipTap rich-text editor with toolbar (bold, italic, underline, links, tables, images, color, headings, code, blockquote)
- Recipient auto-complete searching contacts and previous email addresses with debounced tag-style input
- Signature template system: admin defines HTML template with placeholders, renderSignature() fills user profile data
- 10-second send-with-undo via BullMQ queue + cancel API endpoint
- Admin mailbox settings at /einstellungen/email with 4 tabs: Postfaecher, Signatur, Sync-Status, Zuweisung
- Mailbox CRUD with provider auto-discovery (Microsoft 365, Gmail, IONOS, Strato) pre-filling server configs
- Live connection test with step-by-step IMAP/SMTP feedback
- User-to-mailbox assignment matrix with checkbox grid

## Task Commits

Each task was committed atomically:

1. **Task 1: Gmail-style compose popup with TipTap, recipients, attachments, signature, send queue** - `e92ba29` (feat)
2. **Task 2: Mailbox admin settings with config form, connection test, signature editor, sync dashboard** - `b6c4dbd` (feat)

## Files Created/Modified
- `src/lib/email/signature.ts` - Signature template rendering with {{placeholder}} substitution
- `src/components/email/compose-popup.tsx` - Floating Gmail-style compose window with all form fields
- `src/components/email/compose-editor.tsx` - TipTap rich-text editor wrapper with clipboard image paste
- `src/components/email/compose-toolbar.tsx` - Full formatting toolbar with 17+ buttons
- `src/components/email/compose-recipients.tsx` - Tag-style recipient input with auto-complete dropdown
- `src/components/email/compose-attachments.tsx` - Drag-and-drop upload + DMS file picker
- `src/components/email/compose-manager.tsx` - Context provider managing multiple compose instances
- `src/app/api/email-send/cancel/route.ts` - POST endpoint to cancel queued sends (undo)
- `src/app/(dashboard)/einstellungen/email/page.tsx` - Admin E-Mail settings page with 4 tabs
- `src/components/email/mailbox-config/mailbox-form.tsx` - Add/edit mailbox dialog with Zod validation
- `src/components/email/mailbox-config/mailbox-list.tsx` - Mailbox list with status, toggle, CRUD
- `src/components/email/mailbox-config/connection-test.tsx` - Step-by-step IMAP/SMTP connection test
- `src/components/email/mailbox-config/provider-profiles.tsx` - M365/Gmail/IONOS/Strato/Manual profiles
- `src/components/email/mailbox-config/signature-editor.tsx` - TipTap HTML signature editor with placeholders
- `src/components/email/mailbox-config/sync-dashboard.tsx` - Per-mailbox sync status and error log
- `src/components/email/mailbox-config/user-assignment.tsx` - User-to-mailbox checkbox matrix
- `src/app/api/email-konten/[id]/sync/route.ts` - Manual sync trigger via BullMQ

## Decisions Made
- TipTap v3 uses named exports for TextStyle and Color extensions (not default exports)
- User.position mapped to signature {{titel}} and User.telefon to {{mobil}}/{{durchwahl}} since User model lacks dedicated fields
- Set.add() pattern used instead of Set spread to avoid downlevelIteration TS config requirement
- Compose popup handles only new emails; reply/forward handled inline in detail pane per Plan 02
- Provider auto-discovery covers the 4 most common German law firm email providers plus manual config

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TipTap TextStyle/Color import style**
- **Found during:** Task 1 (compose-editor.tsx)
- **Issue:** TipTap v3 extension-text-style and extension-color have no default export, causing TS2613
- **Fix:** Changed to named imports: `import { TextStyle } from "@tiptap/extension-text-style"`
- **Files modified:** src/components/email/compose-editor.tsx
- **Committed in:** e92ba29 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Prisma User.select for non-existent fields**
- **Found during:** Task 1 (signature.ts)
- **Issue:** User model lacks titel/mobil/durchwahl fields; Prisma select threw TS2353
- **Fix:** Select position/telefon instead, map to signature placeholders
- **Files modified:** src/lib/email/signature.ts
- **Committed in:** e92ba29 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed Set spread incompatibility with downlevelIteration**
- **Found during:** Task 2 (sync-dashboard.tsx, user-assignment.tsx)
- **Issue:** `new Set([...prev, item])` fails without downlevelIteration TS flag (TS2802)
- **Fix:** Used `Set.add()` pattern: create new Set from prev, then add item
- **Files modified:** src/components/email/mailbox-config/sync-dashboard.tsx, user-assignment.tsx
- **Committed in:** b6c4dbd (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All auto-fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed type errors documented above.

## User Setup Required
None - no external service configuration required for these UI components.

## Next Phase Readiness
- Compose system ready for integration with inbox three-pane layout
- ComposeManager context can be wrapped around the email layout for compose-from-anywhere
- Mailbox admin page ready at /einstellungen/email
- Signature system ready - admin can create templates, users get personalized signatures
- All components compile cleanly and follow existing project patterns

## Self-Check: PASSED

All 17 created files verified present. Both task commits verified in git log.

---
*Phase: 03-email-client*
*Completed: 2026-02-24*
