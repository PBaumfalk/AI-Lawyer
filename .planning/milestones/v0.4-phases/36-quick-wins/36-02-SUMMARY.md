---
phase: 36-quick-wins
plan: 02
subsystem: ui, api
tags: [ocr, vision, ai, inline-edit, zeiterfassung, embedding, document-recovery]

# Dependency graph
requires:
  - phase: none
    provides: none
provides:
  - OcrRecoveryBanner component with 3 recovery paths for failed OCR documents
  - Vision API endpoint for AI-based image text extraction
  - Manual text API endpoint for user-pasted text with embedding pipeline
  - Inline editing pattern for Zeiterfassung empty kategorie and beschreibung fields
affects: [document-management, zeiterfassung]

# Tech tracking
tech-stack:
  added: []
  patterns: [state-machine-driven recovery banner, inline edit with lazy-loaded dropdown, optimistic local state update]

key-files:
  created:
    - src/components/dokumente/ocr-recovery-banner.tsx
    - src/app/api/dokumente/[id]/vision/route.ts
    - src/app/api/dokumente/[id]/manual-text/route.ts
  modified:
    - src/components/dokumente/document-detail.tsx
    - src/components/finanzen/akte-zeiterfassung-tab.tsx

key-decisions:
  - "Vision-Analyse only for image MIME types (not PDFs) per research pitfall guidance"
  - "Manual text entry uses inline expanding textarea (not modal) per user decision"
  - "Category dropdown saves on selection (no separate save button) for minimal friction"
  - "Beschreibung inline edit saves on blur/Enter, cancels on Escape"

patterns-established:
  - "State-machine recovery banner: idle -> action -> success/error flow with auto-refetch"
  - "Inline edit with lazy-loaded select: categories fetched only when first dropdown opens"

requirements-completed: [QW-02, QW-05]

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 36 Plan 02: OCR Recovery + Zeiterfassung Inline Edit Summary

**OCR recovery banner with 3 paths (retry/vision/manual) for failed documents, plus inline editing for empty Zeiterfassung fields**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-02T17:43:43Z
- **Completed:** 2026-03-02T17:47:19Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Failed OCR documents now show a recovery banner with 3 options: retry OCR, AI vision analysis (image docs only), and manual text entry
- Both vision and manual-text endpoints save text, update status to ABGESCHLOSSEN, and enqueue embedding jobs
- Zeiterfassung null kategorie shows "Keine Kategorie" as clickable muted text opening inline dropdown
- Empty beschreibung shows "Beschreibung hinzufuegen" as clickable inline input

## Task Commits

Each task was committed atomically:

1. **Task 1: OCR recovery banner + Vision API + Manual text API** - `10ec746` (feat)
2. **Task 2: Zeiterfassung inline editing for empty fields** - `0bbaa99` (feat)

## Files Created/Modified
- `src/components/dokumente/ocr-recovery-banner.tsx` - State-machine recovery banner with 3 recovery paths
- `src/app/api/dokumente/[id]/vision/route.ts` - POST endpoint for AI vision text extraction from images
- `src/app/api/dokumente/[id]/manual-text/route.ts` - POST endpoint for saving manually entered text + embedding
- `src/components/dokumente/document-detail.tsx` - Integrated OcrRecoveryBanner for FEHLGESCHLAGEN status
- `src/components/finanzen/akte-zeiterfassung-tab.tsx` - Inline edit for kategorie dropdown and beschreibung input

## Decisions Made
- Vision-Analyse only enabled for image MIME types (not PDFs) per research guidance that PDF vision is unreliable
- Manual text entry uses inline expanding textarea (not modal) matching the user's stated preference
- Category dropdown saves immediately on selection for minimal friction (no extra save button)
- Beschreibung input saves on blur/Enter, cancels on Escape for standard inline-edit UX

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- OCR recovery flow complete, all 3 paths wire through existing embedding pipeline
- Zeiterfassung inline editing uses existing PATCH endpoint (no backend changes needed)
- Ready for remaining Phase 36 plans

## Self-Check: PASSED

- All 5 files verified present on disk
- Commit 10ec746 (Task 1) verified in git log
- Commit 0bbaa99 (Task 2) verified in git log
- No TypeScript errors in changed files (pre-existing errors in unrelated files only)

---
*Phase: 36-quick-wins*
*Completed: 2026-03-02*
