---
phase: 09-final-integration-wiring-tech-debt
plan: 01
subsystem: integration
tags: [versand-gate, socket-io, bullmq, audit, toast, dead-code]

# Dependency graph
requires:
  - phase: 08-integration-hardening
    provides: Versand-Gate pattern (checkDokumenteFreigegeben/markDokumenteVersendet)
  - phase: 04-document-pipeline-ocr-rag
    provides: Embedding worker and Socket.IO OCR notification pattern
  - phase: 07-rollen-sicherheit-compliance-observability
    provides: AuditTimeline component and audit log infrastructure
provides:
  - FREIGEGEBEN to VERSENDET document transition after email and beA sends
  - document:embedding-complete Socket.IO event for real-time embedding notifications
  - Document-specific audit history section on document detail page
  - dokumentId filter on /api/akten/[id]/historie endpoint
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Non-fatal try-catch for post-send document status updates (never fail the send)
    - Socket.IO dual-room emit pattern (akte room + user room) for embedding events
    - Prisma JSON path filtering for document-specific audit log queries

key-files:
  created: []
  modified:
    - src/lib/email/types.ts
    - src/app/api/email-send/route.ts
    - src/lib/email/smtp/send-processor.ts
    - src/app/api/bea/messages/route.ts
    - src/worker.ts
    - src/lib/email/imap/sync.ts
    - src/components/ki/chat-input.tsx
    - src/components/dokumente/document-detail.tsx
    - src/app/api/akten/[id]/historie/route.ts

key-decisions:
  - "Non-fatal markDokumenteVersendet: wrapped in try-catch so document status failure never blocks email/beA send"
  - "PDFRawStream.of confirmed as false alarm: tsc --noEmit clean, no code change needed"

patterns-established:
  - "Post-send document marking: always non-fatal, always after confirmed GESENDET status"

requirements-completed: [REQ-EM-006, REQ-BA-002, REQ-DV-010, REQ-KI-001, REQ-DV-005]

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 9 Plan 1: Final Integration Wiring + Tech Debt Summary

**Wire markDokumenteVersendet after email/beA sends for FREIGEGEBEN-to-VERSENDET transition, emit document:embedding-complete Socket.IO events, remove dead code, replace alert stub with toast, and add document audit history UI**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T15:12:19Z
- **Completed:** 2026-02-25T15:15:12Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Documents attached to sent emails now transition from FREIGEGEBEN to VERSENDET after successful SMTP send via markDokumenteVersendet()
- Documents attached to beA messages with status GESENDET also transition to VERSENDET
- Browser clients receive document:embedding-complete Socket.IO events when embedding finishes (akte room + user room)
- Dead code (syncNewMessages function) removed from imap/sync.ts
- alert() stub replaced with sonner toast.info in chat-input.tsx drag-drop handler
- Document detail page now shows audit history (Historie section) with document-specific events
- /api/akten/[id]/historie route supports ?dokumentId= query param for Prisma JSON path filtering
- PDFRawStream.of TypeScript error confirmed as false alarm (tsc --noEmit passes cleanly)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire markDokumenteVersendet after email/beA send + embedding Socket.IO event** - `fe8766e` (feat)
2. **Task 2: Tech debt cleanup -- dead code, alert stub, document audit history** - `e1fca0f` (fix)

## Files Created/Modified
- `src/lib/email/types.ts` - Added optional dmsDocumentIds field to EmailSendJob interface
- `src/app/api/email-send/route.ts` - Pass dmsIds through to BullMQ email-send queue job data
- `src/lib/email/smtp/send-processor.ts` - Import and call markDokumenteVersendet after GESENDET status
- `src/app/api/bea/messages/route.ts` - Import and call markDokumenteVersendet after GESENDET beA message creation
- `src/worker.ts` - Emit document:embedding-complete to akte and user rooms on embedding completion
- `src/lib/email/imap/sync.ts` - Removed syncNewMessages() dead code (35 lines)
- `src/components/ki/chat-input.tsx` - Replaced alert() with sonner toast.info for drag-drop
- `src/components/dokumente/document-detail.tsx` - Added DocumentHistorie component and Historie section after Versionsverlauf
- `src/app/api/akten/[id]/historie/route.ts` - Added dokumentId query param with Prisma JSON path filter

## Decisions Made
- Non-fatal markDokumenteVersendet: wrapped in try-catch so document status update failure never blocks successful email/beA send
- PDFRawStream.of TS error confirmed as false alarm by research and tsc --noEmit (no code change needed)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 9 (single plan) is complete -- all integration gaps closed and tech debt items resolved
- All 7 changes from the 6th audit are applied
- TypeScript compiles cleanly with no errors

---
*Phase: 09-final-integration-wiring-tech-debt*
*Completed: 2026-02-25*
