---
phase: 47-portal-messaging
plan: 02
subsystem: ui, api
tags: [portal, mandant, messaging, chat, file-upload, minio, glass-ui, nextjs]

# Dependency graph
requires:
  - phase: 47-portal-messaging
    provides: "PORTAL ChannelTyp, portal channel/messages API routes, createPortalChannel()"
  - phase: 46-dokument-freigabe-portal-dms
    provides: "Portal document upload endpoint, download endpoint, MinIO integration"
  - phase: 44-portal-authentifizierung
    provides: "MANDANT UserRole, portal session auth, (portal) route group layout"
provides:
  - "PortalMessaging component with channel fetch, loading/error states"
  - "PortalMessageList with cursor pagination and 10s polling"
  - "PortalMessageBubble with own=right/anwalt=left alignment and downloadable attachment chips"
  - "PortalMessageComposer with file attachment upload (max 5 files, 25 MB each)"
  - "Portal nachrichten page at /portal/nachrichten and /portal/akten/[id]/nachrichten"
  - "Server-side attachment URL resolution in GET messages API"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["Portal chat polling (10s interval) instead of Socket.IO for portal MVP simplicity", "Two-step file upload: upload to MinIO first, then send message with dokumentId references", "Server-side presigned URL resolution for message attachments", "DOM-based refetch callback pattern (parent <-> child component communication)"]

key-files:
  created:
    - src/components/portal/portal-messaging.tsx
    - src/components/portal/portal-message-list.tsx
    - src/components/portal/portal-message-bubble.tsx
    - src/components/portal/portal-message-composer.tsx
    - src/app/(portal)/nachrichten/page.tsx
    - src/app/(portal)/akten/[id]/nachrichten/page.tsx
  modified:
    - src/app/api/portal/akten/[id]/messages/route.ts

key-decisions:
  - "10s polling instead of Socket.IO for portal MVP -- simpler, sufficient for Mandant use case"
  - "Reuse existing portal upload endpoint for message attachments -- no separate upload route needed"
  - "Server-side presigned URL resolution in GET messages API rather than client-side per-attachment fetch"
  - "Single-Akte Mandant renders messaging directly, multi-Akte redirects to per-Akte page"

patterns-established:
  - "Portal polling pattern: 10s setInterval refetch with near-bottom auto-scroll detection"
  - "Two-step attachment flow: upload files first, then send message with dokumentId references"
  - "Portal message bubble: own=right (violet tint), anwalt=left (neutral glass), system=centered"

requirements-completed: [MSG-01, MSG-02, MSG-03]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 47 Plan 02: Portal Chat UI Summary

**WhatsApp-style Mandant chat interface with message bubbles, cursor pagination, file attachment upload to MinIO, and downloadable attachment chips**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T13:00:31Z
- **Completed:** 2026-03-03T13:04:26Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- WhatsApp-style chat UI with own messages right (violet) and Anwalt messages left (neutral glass)
- File attachment support: Paperclip button opens file picker (max 5 files, 25 MB each), files uploaded to MinIO
- Attachment chips displayed in message bubbles with download link via presigned URLs resolved server-side
- Cursor-based pagination with "load older" button and 10s polling for new messages
- Portal nachrichten page for single-Akte direct rendering and per-Akte nachrichten route

## Task Commits

Each task was committed atomically:

1. **Task 1: Portal messaging page + message list + message bubble components** - `441522e` (feat)
2. **Task 2: Portal message composer with file attachment upload** - `54422d6` (feat)

## Files Created/Modified
- `src/components/portal/portal-messaging.tsx` - Main portal messaging layout with channel fetch and loading/error states
- `src/components/portal/portal-message-list.tsx` - Scrollable message list with cursor pagination and 10s polling
- `src/components/portal/portal-message-bubble.tsx` - Chat bubble with own/anwalt alignment, attachment download chips
- `src/components/portal/portal-message-composer.tsx` - Textarea with Enter=send, Paperclip file attachment, removable file chips
- `src/app/(portal)/nachrichten/page.tsx` - Portal nachrichten page (single-Akte direct, multi-Akte redirect)
- `src/app/(portal)/akten/[id]/nachrichten/page.tsx` - Per-Akte nachrichten page
- `src/app/api/portal/akten/[id]/messages/route.ts` - Updated GET to resolve presigned URLs for attachments

## Decisions Made
- **10s polling over Socket.IO:** Portal does not have Socket.IO infrastructure. Polling is simpler, sufficient for Mandant use case, and avoids adding WebSocket complexity to the portal layout.
- **Reuse existing upload endpoint:** The `/api/portal/akten/[id]/dokumente/upload` endpoint from Phase 46 handles MinIO upload, Dokument record creation, and audit logging. No need for a separate message attachment upload route.
- **Server-side URL resolution:** Presigned download URLs for attachments are resolved in the GET messages API response, avoiding per-attachment client-side fetch calls and reducing latency.
- **Single-Akte direct render:** Mandant with one Akte sees messaging immediately without selection step. Multi-Akte Mandant is redirected to the per-Akte nachrichten page.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- 7 pre-existing TypeScript errors in falldaten-tab.tsx and helena/index.ts remain unrelated to changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Portal messaging feature complete: channel infrastructure (Plan 01) + chat UI (Plan 02)
- Mandant can view message history, send text messages, and attach files
- Anwalt can see and respond to Mandant messages via the internal /nachrichten view

## Self-Check: PASSED

All artifacts verified:
- 47-02-SUMMARY.md exists
- Commit 441522e (Task 1) exists
- Commit 54422d6 (Task 2) exists
- All 7 files created/modified exist on disk
- PortalMessaging, PortalMessageList, PortalMessageBubble, PortalMessageComposer components created
- Portal nachrichten pages created at both routes
- Message API updated with attachment URL resolution

---
*Phase: 47-portal-messaging*
*Completed: 2026-03-03*
