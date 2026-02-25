---
phase: 06-ai-features-bea
plan: 02
subsystem: ai
tags: [rag, streaming, pgvector, ai-sdk, useChat, react-markdown, chat-ui, source-citations]

# Dependency graph
requires:
  - phase: 06-ai-features-bea
    provides: AI provider factory (getModel), token tracking (trackTokenUsage), Helena bot user
  - phase: 04-document-pipeline-ocr-rag
    provides: Vector store (searchSimilar), embedder (generateQueryEmbedding), document chunks
provides:
  - Streaming RAG chat API at POST /api/ki-chat with source citations
  - Conversation CRUD at /api/ki-chat/conversations (list, create, get, update, delete)
  - Cross-Akte vector search toggle on searchSimilar()
  - ChatGPT-style UI at /ki-chat with conversation sidebar, Akte selector, quick-action buttons
  - Markdown rendering with react-markdown + remark-gfm
  - Source citations component with numbered references and document links
  - Sidebar renamed to Helena, Cmd+K Helena fragen integration
  - Fallzusammenfassung button on Akte detail page
  - /ki-entwuerfe redirect to /ki-chat
  - Shareable conversation URLs with RBAC enforcement
affects: [06-03, 06-04, 06-05]

# Tech tracking
tech-stack:
  added: [react-markdown@9, remark-gfm@4]
  patterns: [rag-streaming-chat, cross-akte-search, conversation-persistence, source-citation-display]

key-files:
  created:
    - src/app/api/ki-chat/route.ts
    - src/app/api/ki-chat/conversations/route.ts
    - src/app/api/ki-chat/conversations/[id]/route.ts
    - src/app/(dashboard)/ki-chat/page.tsx
    - src/app/(dashboard)/ki-chat/layout.tsx
    - src/components/ki/chat-layout.tsx
    - src/components/ki/chat-messages.tsx
    - src/components/ki/chat-input.tsx
    - src/components/ki/source-citations.tsx
    - src/components/ki/conversation-sidebar.tsx
  modified:
    - src/lib/embedding/vector-store.ts
    - src/app/(dashboard)/ki-entwuerfe/page.tsx
    - src/app/(dashboard)/akten/[id]/page.tsx
    - src/components/layout/sidebar.tsx
    - src/components/layout/command-palette.tsx
    - package.json

key-decisions:
  - "onFinish callback for token tracking and conversation persistence (streamText result has no .then() in AI SDK v4)"
  - "X-Sources header for passing source citations metadata alongside stream (custom data in response headers)"
  - "Cross-Akte search via JOIN on Akte assignments (anwalt_id or sachbearbeiter_id = userId)"
  - "Conversation RBAC: owner always has access, shared conversations check Akte assignment for non-owners"
  - "Quick-action buttons use predefined German prompt text (not template substitution)"
  - "Helena empty state greeting in German with disclaimer about anwaltliche Pruefung"

patterns-established:
  - "RAG streaming pattern: query embedding -> searchSimilar -> system prompt with sources -> streamText -> onFinish for tracking"
  - "Source citation display: numbered badges linking to /dokumente/[id] with Akte badge and passage excerpt"
  - "Conversation persistence: create on first message, append on subsequent messages, grouped by Akte in sidebar"
  - "Navigation integration: sidebar icon + Cmd+K command + Akte detail button all routing to /ki-chat with searchParams"

requirements-completed: [REQ-KI-003, REQ-KI-007, REQ-KI-010]

# Metrics
duration: 8min
completed: 2026-02-25
---

# Phase 6 Plan 2: Document Chat Summary

**Streaming RAG document chat with pgvector retrieval, ChatGPT-style UI at /ki-chat, inline source citations, conversation history, cross-Akte toggle, and full navigation integration**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-25T05:28:00Z
- **Completed:** 2026-02-25T05:36:00Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Streaming RAG chat API that retrieves document chunks via pgvector, builds system prompt with numbered source references, and streams AI responses with onFinish token tracking
- Cross-Akte vector search mode allowing users to search across all assigned Akten with RBAC filtering
- ChatGPT-style chat UI with conversation sidebar grouped by Akte, quick-action buttons, Markdown rendering, and source citation display
- Full navigation integration: sidebar renamed to Helena, Cmd+K "Helena fragen" command, Fallzusammenfassung button on Akte detail page
- Conversation persistence with create-on-first-message, shareable URLs with RBAC enforcement

## Task Commits

Each task was committed atomically:

1. **Task 1: Streaming RAG Chat API + Conversation CRUD + Vector Store Cross-Akte Toggle** - `49601d9` (feat)
2. **Task 2: Chat UI Page + Message Components + Conversation Sidebar + Navigation Integration** - `3458885` (feat)

## Files Created/Modified
- `src/app/api/ki-chat/route.ts` - Streaming RAG chat endpoint with source citations and confidence handling
- `src/app/api/ki-chat/conversations/route.ts` - Conversation list (cursor-paginated) and create endpoints
- `src/app/api/ki-chat/conversations/[id]/route.ts` - Conversation get/update/delete with RBAC
- `src/lib/embedding/vector-store.ts` - Added cross-Akte search mode, enriched SearchResult with Akte metadata
- `src/app/(dashboard)/ki-chat/page.tsx` - Server page accepting akteId, q, conversationId searchParams
- `src/app/(dashboard)/ki-chat/layout.tsx` - Auth-checked layout with full-height container
- `src/components/ki/chat-layout.tsx` - Three-panel layout with sidebar, chat area, Akte selector
- `src/components/ki/chat-messages.tsx` - Message display with react-markdown, auto-scroll, loading animation
- `src/components/ki/chat-input.tsx` - Auto-resize textarea with quick-action buttons and drag-drop stub
- `src/components/ki/source-citations.tsx` - Numbered source list with document links and passage excerpts
- `src/components/ki/conversation-sidebar.tsx` - Grouped conversation list with relative time and delete
- `src/app/(dashboard)/ki-entwuerfe/page.tsx` - Replaced with redirect to /ki-chat
- `src/app/(dashboard)/akten/[id]/page.tsx` - Added Fallzusammenfassung button linking to /ki-chat
- `src/components/layout/sidebar.tsx` - Renamed KI-Entwuerfe to Helena with Sparkles icon
- `src/components/layout/command-palette.tsx` - Added Helena fragen command in KI group
- `package.json` - Added react-markdown and remark-gfm

## Decisions Made
- Used `onFinish` callback instead of `.then()` on streamText result (AI SDK v4 StreamTextResult is not a Promise)
- Source citations passed via `X-Sources` response header (encoded JSON) alongside the data stream
- Cross-Akte search implemented via SQL JOIN filtering by anwalt_id or sachbearbeiter_id = userId
- Conversation RBAC: owner always has access; shared links check Akte assignment for non-owners; Akte-less conversations accessible to all authenticated users
- Quick-action buttons use pre-defined German prompt strings (simple approach, extensible later)
- Helena empty state displays German greeting with legal disclaimer

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] streamText result.then() does not exist in AI SDK v4**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Plan implied using `.then()` on streamText result, but StreamTextResult in AI SDK v4 is not a Promise
- **Fix:** Used `onFinish` callback parameter of `streamText()` instead for token tracking and conversation persistence
- **Files modified:** src/app/api/ki-chat/route.ts
- **Verification:** tsc --noEmit passes (zero errors in our files)
- **Committed in:** 49601d9

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor API usage correction. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in scan-processor.ts, briefing-processor.ts, proactive-processor.ts (reference HelenaSuggestion model not yet in schema) -- these are from future Plan 03/04 files, not related to this plan. Out of scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Chat infrastructure ready for proactive Helena features (Plan 03)
- Conversation model available for Helena suggestion integration
- Source citation pattern established for reuse in document analysis features
- Quick-action system extensible for additional prompts

## Self-Check: PASSED

All 10 created files verified present. Both task commits (49601d9, 3458885) verified in git log.

---
*Phase: 06-ai-features-bea*
*Completed: 2026-02-25*
