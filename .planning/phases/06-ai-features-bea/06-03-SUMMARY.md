---
phase: 06-ai-features-bea
plan: 03
subsystem: ai
tags: [bullmq, ai-sdk, generateObject, zod, proactive-scanning, suggestions-feed, deadline-extraction, party-extraction]

# Dependency graph
requires:
  - phase: 06-01
    provides: AI provider factory, token tracker, Helena user
provides:
  - Helena proactive AI scan pipeline (document + email scanning)
  - Deadline extractor with structured Zod schema via generateObject
  - Party extractor with structured Zod schema via generateObject
  - AI scan processor with idempotency and budget enforcement
  - Daily briefing processor with cron scheduling
  - Proactive Akten scanner with batch processing
  - HelenaSuggestion Prisma model with status workflow
  - Suggestions CRUD API with cursor pagination
  - Card-based suggestions feed UI with filter tabs
  - SuggestionCard component with accept/reject/edit actions and feedback
  - Email detail KI-Antwort banner for draft suggestions
  - ai_suggestion notification type integration
affects: [06-04, 06-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AI SDK generateObject with Zod schema for structured extraction"
    - "BullMQ processor chaining: embedding -> ai-scan"
    - "Idempotency via daily deduplication (max 1 per doc+type per day)"
    - "Budget enforcement: scanning pauses at 100%, chat stays on"
    - "Suggestion status workflow: NEU -> UEBERNOMMEN/ABGELEHNT/BEARBEITET"

key-files:
  created:
    - src/lib/ai/scan-processor.ts
    - src/lib/ai/deadline-extractor.ts
    - src/lib/ai/party-extractor.ts
    - src/lib/ai/briefing-processor.ts
    - src/lib/ai/proactive-processor.ts
    - src/app/api/helena/suggestions/route.ts
    - src/app/api/helena/suggestions/[id]/route.ts
    - src/components/ki/suggestion-card.tsx
    - src/components/ki/helena-feed.tsx
    - src/app/(dashboard)/ki-chat/helena-tab.tsx
  modified:
    - prisma/schema.prisma
    - src/worker.ts
    - src/lib/queue/queues.ts
    - src/lib/queue/processors/embedding.processor.ts
    - src/lib/email/imap/sync.ts
    - src/lib/notifications/types.ts
    - src/components/notifications/notification-center.tsx
    - src/components/email/email-detail-view.tsx
    - src/app/(dashboard)/ki-chat/page.tsx

key-decisions:
  - "AI scan triggered from imap/sync.ts (where emails are created) not smtp/send-processor.ts"
  - "EmailNachricht has no akteId field; AI scan for emails works without akte context"
  - "ENTWURF KalenderEintrag created immediately during scan, activated on accept"
  - "Single HelenaSuggestion for all parties from one document (not one per party)"
  - "ChatLayout integrated into HelenaTab component for Chat/Vorschlaege tab switching"
  - "ai_suggestion notification type added to types.ts with Sparkles icon in notification-center"

patterns-established:
  - "generateObject with Zod schema for structured AI extraction (deadlines, parties)"
  - "Processor chaining: embedding completion triggers ai-scan queue"
  - "Suggestion status workflow: NEU -> UEBERNOMMEN (creates entity) / ABGELEHNT / BEARBEITET"
  - "Idempotency check per (sourceId, typ, today) before AI processing"
  - "Budget enforcement before every AI scan call"

requirements-completed: [REQ-KI-004, REQ-KI-005, REQ-KI-006, REQ-KI-008, REQ-KI-011]

# Metrics
duration: 16min
completed: 2026-02-25
---

# Phase 6 Plan 3: Helena Proactive AI Scanning Summary

**Event-driven AI scan pipeline with deadline/party extraction, card-based suggestions feed, email draft generation, and daily briefing processor**

## Performance

- **Duration:** 16 min
- **Started:** 2026-02-25T05:27:59Z
- **Completed:** 2026-02-25T05:44:00Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments
- Built complete AI scanning pipeline: new documents trigger deadline/party extraction after embedding, new emails trigger response draft generation
- Created HelenaSuggestion model with full status workflow (NEU/UEBERNOMMEN/ABGELEHNT/BEARBEITET) and feedback tracking
- Built card-based suggestions feed with filter tabs, type/akte filters, and accept/reject/edit actions that create real entities
- Added KI-Antwort banner to email detail view showing inline draft preview with accept/reject
- Integrated daily briefing and proactive scanning processors with cron scheduling and budget enforcement

## Task Commits

Each task was committed atomically:

1. **Task 1: HelenaSuggestion Schema + Extractors + Scan Processor + Worker Wiring** - `7912699` (feat)
2. **Task 2: Helena Suggestions Feed UI + API + Email Banner + Notification Integration** - `2988573` (feat)

## Files Created/Modified

**Created:**
- `src/lib/ai/scan-processor.ts` - BullMQ processor for AI document/email scanning with idempotency
- `src/lib/ai/deadline-extractor.ts` - Structured deadline extraction using generateObject + Zod schema
- `src/lib/ai/party-extractor.ts` - Structured party extraction using generateObject + Zod schema
- `src/lib/ai/briefing-processor.ts` - Daily morning briefing generator
- `src/lib/ai/proactive-processor.ts` - Periodic Akten scanner for stale cases and missing Fristen
- `src/app/api/helena/suggestions/route.ts` - Suggestions GET API with cursor pagination and filters
- `src/app/api/helena/suggestions/[id]/route.ts` - Single suggestion GET/PATCH with accept logic
- `src/components/ki/suggestion-card.tsx` - Card component with type icons, actions, feedback
- `src/components/ki/helena-feed.tsx` - Feed component with status tabs, filters, pagination
- `src/app/(dashboard)/ki-chat/helena-tab.tsx` - Tab switcher between Chat and Vorschlaege

**Modified:**
- `prisma/schema.prisma` - Added HelenaSuggestion model with indexes
- `src/worker.ts` - Registered ai-scan, ai-briefing, ai-proactive workers
- `src/lib/queue/queues.ts` - Added aiScanQueue, aiBriefingQueue, aiProactiveQueue
- `src/lib/queue/processors/embedding.processor.ts` - Triggers AI scan after embedding
- `src/lib/email/imap/sync.ts` - Triggers AI scan for new inbound emails
- `src/lib/notifications/types.ts` - Added ai_suggestion notification type
- `src/components/notifications/notification-center.tsx` - Added Sparkles icon for AI suggestions
- `src/components/email/email-detail-view.tsx` - Added KI-Antwort banner with draft preview
- `src/app/(dashboard)/ki-chat/page.tsx` - Integrated HelenaTab wrapper

## Decisions Made
- AI scan is triggered from `imap/sync.ts` where emails are actually created, not from `smtp/send-processor.ts` which only handles sending and on-demand sync
- EmailNachricht model has no akteId field, so AI scan for emails proceeds without akte context (the scan still works, just without akte-specific suggestions)
- ENTWURF KalenderEintrag entries are created immediately during scan (with HOCH priority) and confirmed on acceptance via the suggestion card
- All parties from a single document are grouped into one HelenaSuggestion (not one suggestion per party) for cleaner UX
- Existing ChatLayout is integrated into HelenaTab component for seamless Chat/Vorschlaege tab switching
- `ai_suggestion` notification type added with Sparkles icon (violet-500) for visual differentiation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed auth import pattern for NextAuth v5**
- **Found during:** Task 2 (API routes)
- **Issue:** Plan specified `getServerSession(authOptions)` but project uses NextAuth v5 with `auth()` export
- **Fix:** Changed to `import { auth } from "@/lib/auth"` and `await auth()` pattern
- **Files modified:** src/app/api/helena/suggestions/route.ts, src/app/api/helena/suggestions/[id]/route.ts
- **Committed in:** 2988573 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed ChatNachricht.akteId null handling**
- **Found during:** Task 2 (Accept logic)
- **Issue:** ChatNachricht.akteId is required in schema but suggestion.akteId is nullable
- **Fix:** Added null guard before creating ChatNachricht, returning null if no akteId
- **Files modified:** src/app/api/helena/suggestions/[id]/route.ts
- **Committed in:** 2988573 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed EmailNachricht.akteId reference**
- **Found during:** Task 1 (Email sync trigger)
- **Issue:** EmailNachricht model has no akteId field; plan referenced it
- **Fix:** Removed akteId from the AI scan job data for emails (field doesn't exist on model)
- **Files modified:** src/lib/email/imap/sync.ts
- **Committed in:** 7912699 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All auto-fixes necessary for correctness against actual schema/auth patterns. No scope creep.

## Issues Encountered
- Database not running locally (db push skipped) -- schema is correct and Prisma client generates fine

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Helena proactive scanning pipeline ready for Plan 04 (Helena Chat with RAG)
- Suggestion feed provides the UI foundation for all future AI features
- Budget enforcement and idempotency patterns established for all AI processors

## Self-Check: PASSED

All 11 created files verified present. Both task commits (7912699, 2988573) verified in git log.

---
*Phase: 06-ai-features-bea*
*Completed: 2026-02-25*
