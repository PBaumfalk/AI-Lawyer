---
phase: 63-tab-reduktion-keyfacts
plan: 01
subsystem: akten-ui
tags: [ui, tabs, overflow-menu, akte-detail]
requires:
  - existing overflow menu pattern (Chat, Portal) in akte-detail-tabs.tsx
provides:
  - 4-visible-tab layout (Aktivitaeten, Dokumente, Termine & Fristen, Finanzen)
  - 4-entry overflow menu (Falldaten, KI-Analyse, Chat, Portal)
affects:
  - src/components/akten/akte-detail-tabs.tsx
tech-stack:
  added: []
  patterns:
    - "Overflow dropdown as single navigation point for secondary tabs"
key-files:
  created: []
  modified:
    - src/components/akten/akte-detail-tabs.tsx
decisions:
  - "Falldaten and KI-Analyse placed before Chat/Portal in overflow (secondary-level grouping)"
  - "completeness state retained even though its (%) badge display moved off the tab bar"
metrics:
  duration: "~5 min"
  completed: 2026-07-23
status: complete
---

# Phase 63 Plan 01: Tab-Reduktion (Keyfacts Overflow) Summary

Reduced the Akte detail tab bar from 6 primary tabs to 4 by moving Falldaten and KI-Analyse into the existing three-dot overflow menu.

## What Was Done

**Task 1: Move KI-Analyse and Falldaten into the overflow menu** (commit `22f43a1`)

- Extended `overflowTabs` from 2 to 4 entries: `falldaten` (FileText icon), `zusammenfassung` (FileBarChart icon), then existing `nachrichten` (Chat) and `portal-nachrichten` (Portal).
- Added `FileText` to the lucide-react import.
- Removed the `TabsTrigger` elements for `falldaten` and `zusammenfassung` from `TabsList` — the primary bar now contains exactly 4 triggers: Aktivitaeten (feed), Dokumente (with count badge), Termine & Fristen (with count badge), Finanzen.
- All `TabsContent` panels unchanged; `completeness` state, `falldatenDirty` guard, and `pendingTab`/`showUnsavedDialog` logic untouched. The overflow menu buttons already route through `handleTabChange(value)`, so the unsaved-changes guard fires identically when switching away from Falldaten via the overflow.
- Overflow button highlighting (`overflowActive`) automatically covers the two new entries since it derives from `overflowTabs.some(...)`.

## Verification

- `grep -c "TabsTrigger" src/components/akten/akte-detail-tabs.tsx` → 7 lines (1 import + 4 trigger elements, down from 6 triggers)
- `overflowTabs` array has 4 entries
- `npx tsc --noEmit` → no errors in any file except the pre-existing broken `src/lib/jlawyer/client.ts` (unrelated, see below); zero errors reference `akte-detail-tabs.tsx`

## Deviations from Plan

None — plan executed exactly as written.

## Out-of-Scope Discoveries

Logged to `.planning/phases/63-tab-reduktion-keyfacts/deferred-items.md`:

- `src/lib/jlawyer/client.ts` has pre-existing TypeScript syntax errors (TS1128/TS1005/TS1434) at base commit 402cf39, unrelated to this plan. File untouched by this phase.

## Requirements

- FEED-06: 4 visible primary tabs with remaining tabs in overflow menu — satisfied.

## Self-Check: PASSED

- FOUND: src/components/akten/akte-detail-tabs.tsx (modified, 4 TabsTriggers, 4 overflow entries)
- FOUND: commit 22f43a1 (`feat(63-01): move Falldaten and KI-Analyse tabs into overflow menu`)
