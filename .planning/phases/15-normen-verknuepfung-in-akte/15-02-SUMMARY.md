---
phase: 15-normen-verknuepfung-in-akte
plan: "02"
subsystem: api
tags: [ki-chat, rag, gesetze, normen, system-prompt, prisma, chain-a]

# Dependency graph
requires:
  - phase: 15-normen-verknuepfung-in-akte-plan-01
    provides: AkteNorm model + pin/unpin API endpoints for normen
  - phase: 14-gesetze-rag
    provides: LawChunk table with gesetzKuerzel, paragraphNr, titel, content, sourceUrl, syncedAt
provides:
  - ki-chat Chain A returns pinnedNormenBlock alongside aktenKontextBlock
  - System prompt injects PINNED NORMEN block with highest priority (before QUELLEN and GESETZE-QUELLEN)
  - Parallel Promise.all(findFirst) per pinned norm — safe against vector column JOIN restriction
affects:
  - 16-pii-filter
  - 17-urteile-rag
  - any future ki-chat chain extensions

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chain A return type extended to object — previously returned plain string, now returns { aktenKontextBlock, pinnedNormenBlock }"
    - "Separate findMany + Promise.all(findFirst) pattern for AkteNorm->LawChunk — cannot use Prisma include JOIN due to Unsupported(vector(1024))"
    - "Null guard on chunk lookup — silently skips pinned norms whose LawChunk no longer exists"

key-files:
  created: []
  modified:
    - src/app/api/ki-chat/route.ts

key-decisions:
  - "Chain A return type changed from Promise<string> to Promise<{ aktenKontextBlock: string; pinnedNormenBlock: string }> — allows single parallel resolution with other chains unchanged"
  - "Pinned normen fetched INSIDE Chain A (not a new Chain E) — they are part of the Akte context, not independent retrieval"
  - "PINNED NORMEN block injected AFTER confidenceFlag instruction and BEFORE QUELLEN and GESETZE-QUELLEN — establishes highest priority for lawyer-curated norms"
  - "akteNorm.findMany separate from lawChunk.findFirst — avoids Prisma JOIN with Unsupported(vector(1024)) column per Phase 14 constraint"

patterns-established:
  - "Pattern: Chain A returns structured object, not string — future Chain A extensions should extend this object rather than returning a new promise"

requirements-completed:
  - GESETZ-04

# Metrics
duration: 4min
completed: "2026-02-27"
---

# Phase 15 Plan 02: Normen-Verknuepfung in Akte — Pinned Normen ki-chat Injection Summary

**Chain A in ki-chat extended to fetch pinned AkteNormen and inject a PINNED NORMEN block into Helena's system prompt with highest priority, using parallel Promise.all(findFirst) per norm and a safe null guard for missing LawChunks.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-27T07:31:13Z
- **Completed:** 2026-02-27T07:35:00Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments
- Chain A return type changed from `Promise<string>` to `Promise<{ aktenKontextBlock: string; pinnedNormenBlock: string }>` — clean structural extension
- `prisma.akteNorm.findMany` fetches all pinned norms for the Akte ordered by creation date
- `Promise.all(findFirst)` resolves each norm to its LawChunk in parallel — no sequential DB round-trips
- `PINNED NORMEN` block with `[P1]`, `[P2]`, ... labels + anmerkung + "nicht amtlich" disclaimer injected before QUELLEN and GESETZE-QUELLEN
- All early-return paths (no akteId, akte not found, catch) return `{ aktenKontextBlock: "", pinnedNormenBlock: "" }` — no undefined leakage

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Chain A to fetch pinned normen and build injection block** - `3bb3b14` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `/Users/patrickbaumfalk/Projekte/AI-Lawyer/src/app/api/ki-chat/route.ts` - Chain A extended with pinned normen fetch + PINNED NORMEN block injection into system prompt

## Decisions Made
- Chain A now returns an object instead of a string — the destructuring at the Promise.all call site is updated to `{ aktenKontextBlock, pinnedNormenBlock }`. Future Chain A extensions should add new fields to this object.
- Pinned norms are a Chain A concern (Akte-specific structured context), not a new Chain E — they represent the lawyer's curated legal strategy for the Akte.
- The PINNED NORMEN block is placed BEFORE QUELLEN (document chunks) and GESETZE-QUELLEN (auto-retrieved norms) to establish the highest prompt priority.

## Deviations from Plan
None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Phase 15 Plan 02 complete — ki-chat now surfaces pinned normen to Helena with highest priority
- Ready to verify end-to-end: pin a norm in Akte UI (Plan 01), chat with that Akte, confirm PINNED NORMEN block appears in system prompt
- Phase 16 (PII-Filter) is next in roadmap

---
*Phase: 15-normen-verknuepfung-in-akte*
*Completed: 2026-02-27*
