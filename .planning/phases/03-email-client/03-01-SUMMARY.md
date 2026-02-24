---
phase: 03-email-client
plan: 01
subsystem: email
tags: [imap, smtp, imapflow, mailparser, nodemailer, bullmq, aes-256-gcm, sanitize-html, tiptap, prisma]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation
    provides: BullMQ worker process, Socket.IO emitter, MinIO storage, Redis, notifications service
  - phase: 02.1-wire-frist-reminder-pipeline
    provides: nodemailer v7 SMTP transport pattern, notification service
provides:
  - 6 Prisma email models (EmailKonto, EmailOrdner, EmailNachricht, EmailAnhang, EmailVeraktung, EmailKontoZuweisung)
  - IMAP connection manager with IDLE, reconnection, and folder sync
  - Email sync engine (initial + incremental) from IMAP to PostgreSQL
  - SMTP send processor via BullMQ with 10-second undo delay
  - AES-256-GCM credential encryption for IMAP/SMTP passwords
  - Email CRUD API routes with cursor pagination and mailbox access control
  - Mailbox configuration CRUD (admin only) with connection test
  - Folder management API (create, rename, delete IMAP folders)
  - Email send queue with scheduled sending support
affects: [03-02, 03-03, 03-04, email-ui, akte-email-tab, einstellungen-email]

# Tech tracking
tech-stack:
  added: [imapflow, mailparser, sanitize-html, dompurify, "@tanstack/react-virtual", react-resizable-panels, "@tiptap/react", "@tiptap/pm", "@tiptap/starter-kit", "@tiptap/extension-link", "@tiptap/extension-image", "@tiptap/extension-table", "@tiptap/extension-placeholder", "@tiptap/extension-color", "@tiptap/extension-text-style"]
  patterns: [IMAP connection manager per mailbox, AES-256-GCM credential encryption, email HTML sanitization, thread detection via References/In-Reply-To, BullMQ email send with undo delay]

key-files:
  created:
    - prisma/schema.prisma (6 new email models + enums)
    - src/lib/email/crypto.ts
    - src/lib/email/types.ts
    - src/lib/email/sanitize.ts
    - src/lib/email/threading.ts
    - src/lib/email/imap/connection-manager.ts
    - src/lib/email/imap/sync.ts
    - src/lib/email/imap/idle-handler.ts
    - src/lib/email/imap/folder-sync.ts
    - src/lib/email/imap/parser.ts
    - src/lib/email/smtp/transport-factory.ts
    - src/lib/email/smtp/send-processor.ts
    - src/app/api/email-konten/route.ts
    - src/app/api/email-konten/[id]/route.ts
    - src/app/api/email-konten/[id]/test/route.ts
    - src/app/api/email-konten/[id]/zuweisungen/route.ts
    - src/app/api/emails/route.ts
    - src/app/api/emails/[id]/route.ts
    - src/app/api/emails/[id]/read/route.ts
    - src/app/api/emails/bulk/route.ts
    - src/app/api/email-folders/route.ts
    - src/app/api/email-folders/[id]/route.ts
    - src/app/api/email-send/route.ts
  modified:
    - src/lib/queue/queues.ts (emailSendQueue, emailSyncQueue)
    - src/worker.ts (IMAP startup, email workers, graceful shutdown)
    - docker-compose.yml (LanguageTool, EMAIL_ENCRYPTION_KEY)
    - .env.example (EMAIL_ENCRYPTION_KEY)
    - src/lib/notifications/types.ts (email:connection-failure, email:send-failed)
    - src/components/notifications/notification-center.tsx (new type icons/colors)
    - package.json (new dependencies)

key-decisions:
  - "ImapFlow with IDLE on INBOX per mailbox, NOOP heartbeat every 4 min"
  - "AES-256-GCM with scryptSync key derivation for credential encryption"
  - "sanitize-html server-side with email-specific tag allowlist (tables, fonts, styles)"
  - "Thread detection: References header first, then In-Reply-To, then new thread"
  - "normalizeSubject strips German prefixes (AW, WG, Antwort, Weiterleitung)"
  - "10-second BullMQ delay for outgoing emails as undo window"
  - "SMTP transport factory with lazy creation and per-kontoId caching"
  - "Exponential backoff reconnection: 5s base, 5min max, admin notify after 3 failures"
  - "LanguageTool as optional Docker service with profiles: [full]"

patterns-established:
  - "IMAP connection manager pattern: one ImapFlow instance per active mailbox, always create new instance on reconnect"
  - "Email mailbox access control: EmailKontoZuweisung join table, admin sees all"
  - "Email folder special type detection: SPECIAL-USE flags first, then name patterns (German + English)"
  - "Email send queue pattern: create EmailNachricht first, then add BullMQ job with delay"

requirements-completed: [REQ-EM-001, REQ-EM-002]

# Metrics
duration: 14min
completed: 2026-02-24
---

# Phase 3 Plan 01: Email Backend Summary

**Full email backend with 6 Prisma models, IMAP sync engine with IDLE and reconnection, SMTP send queue via BullMQ, and 11 API routes for email/mailbox/folder CRUD with access control**

## Performance

- **Duration:** 14 min
- **Started:** 2026-02-24T14:08:33Z
- **Completed:** 2026-02-24T14:22:30Z
- **Tasks:** 4
- **Files modified:** 31

## Accomplishments
- 6 new Prisma email models (EmailKonto, EmailKontoZuweisung, EmailOrdner, EmailNachricht, EmailAnhang, EmailVeraktung) with proper indexes and relations
- IMAP connection manager maintains per-mailbox ImapFlow connections with IDLE, heartbeat, and exponential backoff reconnection
- Email sync engine downloads and parses IMAP messages into PostgreSQL with attachment storage in MinIO
- SMTP send processor sends emails via BullMQ queue with 10-second undo delay and scheduled sending
- 11 API routes covering email CRUD, mailbox configuration, folder management, and email sending
- AES-256-GCM credential encryption for IMAP/SMTP passwords at rest
- Email HTML sanitization with email-specific allowed tags (tables, fonts, styles)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps, Prisma schema, crypto, types, sanitize, threading** - `1ff9a20` (feat)
2. **Task 2a: IMAP connection manager, sync, IDLE handler, folder sync, parser** - `986c519` (feat)
3. **Task 2b: SMTP transport, send processor, BullMQ queues, worker wiring** - `718d921` (feat)
4. **Task 3: Email CRUD, mailbox config, folder management, email-send API** - `a471757` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - 6 new email models + 6 new enums
- `src/lib/email/crypto.ts` - AES-256-GCM encrypt/decrypt credentials
- `src/lib/email/types.ts` - Shared email domain TypeScript types
- `src/lib/email/sanitize.ts` - Email HTML sanitizer with email-specific allowlist
- `src/lib/email/threading.ts` - Thread detection and German subject normalization
- `src/lib/email/imap/connection-manager.ts` - Per-mailbox ImapFlow lifecycle management
- `src/lib/email/imap/sync.ts` - Initial and incremental IMAP-to-PostgreSQL sync
- `src/lib/email/imap/idle-handler.ts` - NOOP heartbeat monitoring
- `src/lib/email/imap/folder-sync.ts` - IMAP folder mirroring with special type detection
- `src/lib/email/imap/parser.ts` - mailparser wrapper for MIME parsing
- `src/lib/email/smtp/transport-factory.ts` - Lazy nodemailer transport per mailbox
- `src/lib/email/smtp/send-processor.ts` - BullMQ processor for email sending
- `src/lib/queue/queues.ts` - Added emailSendQueue and emailSyncQueue
- `src/worker.ts` - IMAP startup, email workers, graceful shutdown
- `src/app/api/email-konten/route.ts` - Mailbox list/create
- `src/app/api/email-konten/[id]/route.ts` - Mailbox detail/update/delete
- `src/app/api/email-konten/[id]/test/route.ts` - IMAP+SMTP connection test
- `src/app/api/email-konten/[id]/zuweisungen/route.ts` - User-mailbox assignments
- `src/app/api/emails/route.ts` - Email list with cursor pagination and filters
- `src/app/api/emails/[id]/route.ts` - Email detail with presigned attachment URLs
- `src/app/api/emails/[id]/read/route.ts` - Mark email as read
- `src/app/api/emails/bulk/route.ts` - Bulk actions on multiple emails
- `src/app/api/email-folders/route.ts` - Folder listing grouped by mailbox
- `src/app/api/email-folders/[id]/route.ts` - Rename/delete custom folders
- `src/app/api/email-send/route.ts` - Queue outgoing email with undo support

## Decisions Made
- ImapFlow with IDLE on INBOX, NOOP heartbeat every 4 minutes to detect dead connections
- AES-256-GCM with scryptSync key derivation (fixed salt) for credential encryption
- sanitize-html with email-specific allowlist (tables, fonts, inline styles) for server-side HTML sanitization
- Thread detection algorithm: References header (root message) > In-Reply-To > new thread
- German email subject prefix stripping: AW, WG, Antwort, Weiterleitung, Wtr, SV, VS
- 10-second BullMQ delay for outgoing emails as undo window (cancelled via DELETE /api/email-send)
- SMTP transport factory with lazy creation and per-kontoId caching
- Exponential backoff reconnection: 5s base, 5min max, admin notification after 3 consecutive failures
- LanguageTool as optional Docker service with profiles: ["full"] (does not block other functionality)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed sanitize-html allowedStyles type mismatch**
- **Found during:** Task 1 (sanitize.ts creation)
- **Issue:** sanitize-html TypeScript types expect `Record<string, Record<string, RegExp[]>>` not `Record<string, RegExp[]>`
- **Fix:** Changed ALLOWED_STYLES to use per-CSS-property nested structure
- **Files modified:** src/lib/email/sanitize.ts
- **Committed in:** 1ff9a20 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed mailparser AddressObject[] type for to/cc/bcc**
- **Found during:** Task 2a (parser.ts creation)
- **Issue:** mailparser to/cc/bcc can be AddressObject[] (not just AddressObject), causing TS error
- **Fix:** Updated extractAddresses to handle both single and array AddressObject
- **Files modified:** src/lib/email/imap/parser.ts
- **Committed in:** 986c519 (Task 2a commit)

**3. [Rule 2 - Missing Critical] Added email notification types to NotificationType**
- **Found during:** Task 2a (connection-manager.ts creation)
- **Issue:** "email:connection-failure" and "email:send-failed" not in NotificationType union
- **Fix:** Added both types to notification types and updated notification-center.tsx with icons/colors
- **Files modified:** src/lib/notifications/types.ts, src/components/notifications/notification-center.tsx
- **Committed in:** 986c519 (Task 2a commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for TypeScript compilation and correct operation. No scope creep.

## Issues Encountered
- Database not running locally (db push failed) -- expected in dev, schema validates and Prisma client generates fine
- Map iteration not supported without downlevelIteration -- used forEach() instead

## User Setup Required

External services require manual configuration:
- `EMAIL_ENCRYPTION_KEY` environment variable: Generate a random 32+ character string for AES-256-GCM credential encryption
- IMAP/SMTP email server: Required for actual email receiving and sending

## Next Phase Readiness
- Email backend is fully implemented and compiles clean
- All API routes are ready for the three-pane inbox UI (Plan 02)
- IMAP sync engine ready to connect to actual mailboxes when configured
- Send queue with undo support ready for compose UI
- Veraktung data model ready for case assignment workflow

## Self-Check: PASSED

All 23 created files verified present. All 4 task commits verified in git log.

---
*Phase: 03-email-client*
*Completed: 2026-02-24*
