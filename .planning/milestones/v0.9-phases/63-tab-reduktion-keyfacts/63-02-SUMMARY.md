---
phase: 63-tab-reduktion-keyfacts
plan: 02
subsystem: ui
tags: [react, nextjs, tailwind, lucide-react, akten]

requires: []
provides:
  - Sticky Key-Facts panel above Akte tabs with Gegenstandswert, Phase, Sachgebiet, Gericht, naechste Frist, Mandant/Gegner
  - STATUS_LABELS map for human-readable German AkteStatus labels (Offen/Ruhend/Archiviert)
affects: [akten-detail, feed, keyfacts]

tech-stack:
  added: []
  patterns:
    - "Key-Facts chips derived from beteiligte rolle lookups (MANDANT/GEGNER/GERICHT) with firma-or-name fallback"

key-files:
  created: []
  modified:
    - src/app/(dashboard)/akten/[id]/akte-detail-client.tsx

key-decisions:
  - "Used Building2 icon (lucide-react) for the Gericht chip per plan preference, Scale remains on Gegenstandswert"
  - "Sticky offset top-2 z-10 so panel floats above tab content during scroll"

patterns-established:
  - "German status label mapping via module-level STATUS_LABELS Record with raw-enum fallback"

requirements-completed: [FEED-07]

coverage:
  - id: D1
    description: "Sticky Key-Facts panel showing Gegenstandswert (Euro), Phase (German label), Gericht (rolle=GERICHT), naechste Frist with urgency warning, Mandant/Gegner"
    requirement: FEED-07
    verification:
      - kind: other
        ref: "grep checks: 'Gegenstandswert:' present, no 'Streitwert', 'GERICHT' rolle lookup, 'STATUS_LABELS', 'sticky top-2 z-10' class"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit — zero errors in akte-detail-client.tsx (repo-wide run blocked by pre-existing jlawyer/client.ts syntax errors, see deferred-items.md)"
        status: pass
    human_judgment: true
    rationale: "Sticky-on-scroll behavior and chip layout are visual; a human must confirm the panel stays pinned while scrolling tab content."

duration: 5min
completed: 2026-07-23
status: complete
---

# Phase 63 Plan 02: Key-Facts Panel Enhancement Summary

**Sticky Key-Facts panel above Akte tabs now shows all five FEED-07 facts — Gegenstandswert (Euro), Phase (Offen/Ruhend/Archiviert), Gericht from rolle=GERICHT Beteiligte, naechste Frist with urgency warning, Mandant/Gegner — and stays pinned during scroll**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-23T09:35:45Z
- **Completed:** 2026-07-23T09:40:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Renamed misleading "Streitwert:" label to "Gegenstandswert:" (FEED-07 terminology)
- Added Phase chip with human-readable German status via module-level STATUS_LABELS map (OFFEN/RUHEND/ARCHIVIERT with raw-value fallback)
- Added Gericht chip (Building2 icon) derived from `beteiligte.find(b => b.rolle === "GERICHT")` with firma-or-vorname/nachname fallback
- Made the panel sticky (`sticky top-2 z-10`) so it remains visible while scrolling tab content
- Extended `hasAnyInfo` with `gerichtName` and `akte.status` so the panel renders whenever any fact exists

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Gericht, Status fields; fix label; make panel sticky** - `eec8e2b` (feat)

**Plan metadata:** committed alongside this SUMMARY (docs commit below)

## Files Created/Modified
- `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx` - KeyFactsPanel: STATUS_LABELS, gerichtName extraction, Phase + Gericht chips, Gegenstandswert label, sticky positioning, extended hasAnyInfo
- `.planning/phases/63-tab-reduktion-keyfacts/deferred-items.md` - Out-of-scope pre-existing bug log (jlawyer client syntax errors)

## Decisions Made
- Used `Building2` icon for Gericht per plan preference (visually suggests a court building); `Scale` stays on Gegenstandswert — no icon collision.
- Chip order per plan: Gegenstandswert → Phase → Sachgebiet → Gericht → Naechste Frist → Mandant → Gegner.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npx tsc --noEmit` reports ~30 syntax errors, but **all are confined to `src/lib/jlawyer/client.ts`** — a file broken at the wave base commit (402cf39b) by an extra closing brace at line 49 (introduced in 3de6bbe). This is pre-existing and unrelated to this plan; per the scope-boundary rule it was **not fixed here** and is logged in `.planning/phases/63-tab-reduktion-keyfacts/deferred-items.md`. The modified file (`akte-detail-client.tsx`) compiles with zero errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Key-Facts panel fulfils FEED-07; ready for any follow-up Akte-detail UI work (plan 63-01 runs in the same wave on separate files).
- **Concern:** repo-wide `tsc --noEmit` (and likely `next build`, since `ignoreBuildErrors: false`) will fail until the pre-existing `src/lib/jlawyer/client.ts` brace bug is fixed — see deferred-items.md.

## Self-Check: PASSED
- FOUND: `.planning/phases/63-tab-reduktion-keyfacts/63-02-SUMMARY.md`
- FOUND: `.planning/phases/63-tab-reduktion-keyfacts/deferred-items.md`
- FOUND: commit `eec8e2b` (feat(63-02): enhance Key-Facts panel...)

---
*Phase: 63-tab-reduktion-keyfacts*
*Completed: 2026-07-23*
