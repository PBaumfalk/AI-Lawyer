---
phase: 15-normen-verknuepfung-in-akte
plan: "03"
subsystem: ui
tags: [react, client-component, radix-dialog, shadcn-sheet, normen, akte-detail]

# Dependency graph
requires:
  - phase: 15-01
    provides: REST API for pinning norms (GET/POST/DELETE) + ILIKE search endpoint
  - phase: 15-02
    provides: Helena ki-chat injects pinned normen into system prompt

provides:
  - NormenSection client component with chip-list, search modal, and detail sheet
  - Akte detail page updated to include normen in Prisma query and render NormenSection

affects:
  - src/app/(dashboard)/akten/[id]/page.tsx (NormenSection rendered between stats grid and AkteDetailTabs)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Radix Dialog primitive (not shadcn dialog.tsx) for modal overlay
    - Sheet side panel for full § content display
    - Debounced search (300ms) identical to BeteiligteAddDialog pattern
    - router.refresh() after mutations — no optimistic state

key-files:
  created:
    - src/components/akten/normen-section.tsx
  modified:
    - src/app/(dashboard)/akten/[id]/page.tsx

key-decisions:
  - "Used @radix-ui/react-dialog primitive directly (Dialog.Root/Portal/Overlay/Content) since dialog.tsx does not exist as a shadcn component in this project"
  - "initialNormen prop rendered directly from server props — no useState wrapper — router.refresh() re-runs server component with fresh DB data"
  - "handleChipClick fetches full norm content via search endpoint (same ILIKE query) to get content field truncated to 300 chars for preview in detail sheet"
  - "Stale props guard: chip list renders from initialNormen prop directly, not local state, to keep consistency with Next.js server component pattern"

requirements-completed:
  - GESETZ-04

# Metrics
duration: ~2min
completed: 2026-02-27
---

# Phase 15 Plan 03: NormenSection UI Component Summary

**NormenSection client component with chip-list + debounced search modal (Radix Dialog) + Sheet detail panel, wired into Akte detail page with Prisma normen include between stats grid and AkteDetailTabs**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-27T07:35:10Z
- **Completed:** 2026-02-27T07:37:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- NormenSection client component created with full chip-list, add-modal, and detail-sheet functionality
- Debounced search (300ms) calls /api/akten/[id]/normen/search with minimum 2-char guard
- Add modal uses Radix Dialog primitive (dialog.tsx not available as shadcn component); handles POST + toast + router.refresh()
- Each chip shows gesetzKuerzel + paragraphNr + optional truncated anmerkung; X button calls DELETE
- Chip label click opens Sheet side panel showing full § content, "nicht amtlich" disclaimer, and source URL link
- Empty state: "Noch keine Normen verknüpft. Normen fließen automatisch in Helenas Kontext ein."
- Akte detail page: normen Prisma include added (with addedBy, orderBy createdAt desc)
- NormenSection rendered between stats grid and AkteDetailTabs

## Task Commits

Each task was committed atomically:

1. **Task 1: Build NormenSection component** — `748d182` (feat)
2. **Task 2: Wire NormenSection into Akte detail page** — `95b0b05` (feat)

## Files Created/Modified

- `src/components/akten/normen-section.tsx` — NormenSection client component (export: NormenSection)
- `src/app/(dashboard)/akten/[id]/page.tsx` — Added normen Prisma include + NormenSection import + render

## Decisions Made

- Used `@radix-ui/react-dialog` primitive directly (`Dialog.Root`, `Dialog.Portal`, `Dialog.Overlay`, `Dialog.Content`) since `dialog.tsx` does not exist as a shadcn component in this project. `sheet.tsx` uses the same Radix Dialog package for its Sheet/overlay implementation, so no new dependency added.
- `initialNormen` prop rendered directly from server props rather than put into local useState — this matches the plan's "stale props guard" guidance: `router.refresh()` re-runs the server component and passes fresh props from DB, keeping the chip list in sync without optimistic state complexity.
- `handleChipClick` re-uses the normen/search endpoint to fetch the full (300-char truncated) content for the detail sheet, avoiding a separate dedicated detail endpoint.

## Deviations from Plan

None — plan executed exactly as written. The two implementation tasks proceeded without any bugs, missing dependencies, or blocking issues.

## Issues Encountered

None — both component tasks compiled cleanly on first attempt with zero TypeScript errors.

## User Setup Required

None — no external configuration needed. Uses existing API routes from Plan 01 and existing DB tables.

## Next Phase Readiness

- Phase 15 complete — all 3 plans done
- Phase 16 (PII-Filter) is next
- No blockers

## Self-Check: PASSED

Files verified:
- src/components/akten/normen-section.tsx — FOUND
- src/app/(dashboard)/akten/[id]/page.tsx — FOUND (modified)

Commits verified:
- 748d182 — FOUND (feat(15-03): build NormenSection client component)
- 95b0b05 — FOUND (feat(15-03): wire NormenSection into Akte detail page)

TypeScript: 0 errors (full `npx tsc --noEmit` clean pass).

---
*Phase: 15-normen-verknuepfung-in-akte*
*Completed: 2026-02-27*
