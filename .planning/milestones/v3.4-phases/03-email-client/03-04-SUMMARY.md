---
phase: 03-email-client
plan: 04
subsystem: email-workflow
tags: [veraktung, auto-suggest, ticket-from-email, akte-email-tab, verantwortlicher, sheet-panel, dms-copy]

# Dependency graph
requires:
  - phase: 03-email-client
    provides: Email Prisma models, IMAP sync, SMTP send queue, email CRUD APIs, inbox UI with actions bar, mailbox config
  - phase: 01-infrastructure-foundation
    provides: BullMQ queues, MinIO storage, shadcn/ui components, Sonner toasts
  - phase: 02-deadline-calculation-document-templates
    provides: Dokument model, OrdnerSchema, Akte CRUD APIs
provides:
  - Veraktung auto-suggest logic (thread history, sender/contact matching, Aktenzeichen regex)
  - Slide-over VeraktungPanel with suggestions, Akte search, attachment selection, DMS folder, notes
  - verakteEmail function with DMS attachment copy and Dokument record creation
  - Reversible Veraktung (hebeVeraktungAuf) with proper veraktet flag management
  - Veraktung CRUD API (GET/POST/DELETE) with audit logging
  - Verantwortlicher assignment API for Kanzlei mailbox emails
  - Ticket-from-Email API creating tickets with pre-filled email data
  - TicketFromEmailDialog with editable form fields
  - AkteEmailTab showing chronological list of veraktete emails per case
  - /akten/[id]/emails dedicated page route
affects: [phase-04, ticket-management, akte-detail, email-workflow-complete]

# Tech tracking
tech-stack:
  added: []
  patterns: [Veraktung auto-suggest with confidence scoring, Sheet slide-over for workflow panels, DMS attachment copy from email MinIO to case folder]

key-files:
  created:
    - src/lib/email/veraktung.ts
    - src/components/email/veraktung-panel.tsx
    - src/app/api/emails/[id]/veraktung/route.ts
    - src/app/api/emails/[id]/verantwortlicher/route.ts
    - src/app/api/emails/[id]/ticket/route.ts
    - src/components/email/ticket-from-email-dialog.tsx
    - src/components/email/akte-email-tab.tsx
    - src/app/(dashboard)/akten/[id]/emails/page.tsx
  modified:
    - src/components/email/email-detail.tsx
    - src/components/email/email-actions-bar.tsx
    - src/components/email/inbox-layout.tsx
    - src/lib/audit.ts
    - src/components/akten/akte-detail-tabs.tsx

key-decisions:
  - "Auto-suggest priority: thread history (hoch) > sender/contact match (mittel) > Aktenzeichen regex (niedrig)"
  - "Veraktung reversal does NOT remove DMS copies (per user decision: files remain in DMS)"
  - "All attachments selected by default in Veraktung panel (per user decision)"
  - "Default DMS folder 'Korrespondenz' for veraktete email attachments"
  - "Sidebar already had E-Mail link in correct position -- no sidebar change needed"

patterns-established:
  - "Veraktung auto-suggest pattern: thread-first, then Kontakt/Beteiligter matching, then subject regex"
  - "Sheet slide-over for workflow panels: VeraktungPanel and TicketFromEmailDialog use Sheet component"
  - "DMS copy pattern: read from email MinIO path, write to akten/{akteId}/{folder}/, create Dokument record"
  - "Confidence-based quick action: high-confidence suggestions get one-click prominent button"

requirements-completed: [REQ-EM-005, REQ-EM-007, REQ-EM-008]

# Metrics
duration: 8min
completed: 2026-02-24
---

# Phase 3 Plan 04: Veraktung Workflow, Ticket-from-Email, Akte E-Mail Tab Summary

**Veraktung slide-over with 3-tier auto-suggest (thread/contact/Aktenzeichen), DMS attachment copy, reversible case assignment, Ticket-from-Email with pre-filled form, AkteEmailTab with veraktete email list, and Verantwortlicher assignment for Kanzlei mailboxes**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-24T14:41:37Z
- **Completed:** 2026-02-24T14:49:37Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Veraktung auto-suggest with 3-tier confidence scoring: thread history (hoch), sender/contact matching (mittel), Aktenzeichen regex in subject (niedrig)
- Slide-over VeraktungPanel with auto-suggestions, Akte search typeahead, per-attachment checkboxes, DMS folder dropdown, optional note, and one-click quick veraktung for high-confidence matches
- DMS attachment copy: selected email attachments are copied from email MinIO storage to case DMS path with Dokument record creation
- Reversible Veraktung with proper multi-Akte support (email.veraktet reflects remaining active Veraktungen)
- Ticket-from-Email API + dialog with pre-filled title/description/Akte/priority from email data, all fields editable before save
- AkteEmailTab showing chronological list of all veraktete emails for a case, reusing inbox-style row format, with per-row Veraktung aufheben action
- Verantwortlicher assignment dropdown on Kanzlei mailbox emails in email detail header
- Full audit logging for all veraktung, veraktung reversal, verantwortlicher assignment, and ticket creation events

## Task Commits

Each task was committed atomically:

1. **Task 1: Veraktung auto-suggest, slide-over panel, APIs, Verantwortlicher** - `0c22ff6` (feat)
2. **Task 2: Ticket-from-Email, Akte E-Mail Tab, sidebar check** - `8e56661` (feat)

## Files Created/Modified
- `src/lib/email/veraktung.ts` - suggestAktenForEmail, verakteEmail with DMS copy, hebeVeraktungAuf
- `src/components/email/veraktung-panel.tsx` - Slide-over with auto-suggestions, Akte search, attachment selection, DMS folder, notes
- `src/app/api/emails/[id]/veraktung/route.ts` - GET (list + suggest), POST (create), DELETE (reverse) with audit
- `src/app/api/emails/[id]/verantwortlicher/route.ts` - PATCH for Kanzlei mailbox email assignment
- `src/app/api/emails/[id]/ticket/route.ts` - POST to create Ticket from email with pre-filled data
- `src/components/email/ticket-from-email-dialog.tsx` - Sheet dialog with editable ticket form
- `src/components/email/akte-email-tab.tsx` - Chronological veraktete email list for Akte detail page
- `src/app/(dashboard)/akten/[id]/emails/page.tsx` - Dedicated page for Akte emails
- `src/components/email/email-detail.tsx` - Added Veraktung info section, aufheben button, Verantwortlicher dropdown
- `src/components/email/email-actions-bar.tsx` - Wired Verakten/Ticket buttons to real handlers (replaced stubs)
- `src/components/email/inbox-layout.tsx` - Added VeraktungPanel and TicketFromEmailDialog state management
- `src/lib/audit.ts` - Added EMAIL_VERAKTET, EMAIL_VERAKTUNG_AUFGEHOBEN, EMAIL_VERANTWORTLICHER_GESETZT, EMAIL_TICKET_ERSTELLT
- `src/components/akten/akte-detail-tabs.tsx` - Updated to use AkteEmailTab instead of EmailTab

## Decisions Made
- Auto-suggest priority: thread history is highest (replies to veraktete emails suggest same Akte), contact matching is medium, Aktenzeichen regex is lowest
- Veraktung reversal removes the link but keeps DMS file copies (per user decision)
- All attachments are selected by default in the Veraktung panel (per user decision)
- Default DMS folder is "Korrespondenz" for email attachment copies
- Sidebar already had "E-Mails" link positioned correctly after "Kalender" and before "Tickets" -- no change needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required for these features.

## Next Phase Readiness
- Phase 3 (Email Client) is now complete with all 4 plans executed
- Full email workflow: IMAP sync -> Inbox UI -> Compose/Send -> Veraktung/Ticket/Assignment
- Veraktung workflow connects emails to the case management core
- Ready for Phase 4 or whatever comes next in the roadmap

## Self-Check: PASSED

All 8 created files verified present. Both task commits verified in git log.

---
*Phase: 03-email-client*
*Completed: 2026-02-24*
