---
phase: 17-urteile-rag
plan: "01"
subsystem: database
tags: [rss, xml, pgvector, ner, pii, dsgvo, ollama, ingestion, search]

# Dependency graph
dependency_graph:
  requires:
    - phase: 16-pii-filter
      provides: "src/lib/pii/ner-filter.ts (runNerFilter, NerResult) — DSGVO gate"
    - phase: 14-gesetze-rag
      provides: "src/lib/gesetze/ingestion.ts — DELETE+INSERT pattern mirror"
  provides:
    - src/lib/urteile/rss-client.ts (fetchUrteileFeed, UrteilRssItem, BMJ_RSS_FEEDS)
    - src/lib/urteile/ingestion.ts (ingestUrteilItem, loadGuidCache, saveGuidCache, searchUrteilChunks, UrteilChunkResult)
  affects:
    - Phase 17 Plan 02 (BullMQ cron processor imports from both files)
    - Phase 17 Plan 03 (ki-chat Chain E imports searchUrteilChunks)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - BMJ RSS fetcher with AbortSignal.timeout(15_000) and loose title regex for all court variants
    - flatMap for graceful parse-failure skipping (bad titles silently dropped, no throw)
    - Inline NER gate: runNerFilter() called before any pgvector INSERT in ingestUrteilItem()
    - DELETE+INSERT idempotency keyed on sourceUrl (mirrors gesetze/ingestion.ts)
    - GUID cache stored as JSON array in SystemSetting key 'urteile.seen_guids'
    - Array.from(guids) for Set serialization (compatible with TS target, avoids spread)
    - searchUrteilChunks filters empty/null aktenzeichen post-query (URTEIL-04 compliance)

key-files:
  created:
    - src/lib/urteile/rss-client.ts
    - src/lib/urteile/ingestion.ts
  modified: []

key-decisions:
  - "parseAttributeValue (no trailing s) is the correct fast-xml-parser v5 option — TypeScript caught parseAttributeValues as unknown property"
  - "Array.from(guids) instead of [...guids] for Set serialization — TypeScript target does not support downlevelIteration for Set spread"
  - "ingestUrteilItem never throws — AbortError from Ollama timeout caught by outer try/catch returns 'error', processor does not mark GUID as seen, item retries on next cron"
  - "nerText uses leitsatz when non-empty, structured fallback (Entscheidungstyp + Gericht + Datum + AZ) for empty BGH leitsatz items"
  - "piiFiltered=true only set after hasPii:false confirmation — hasPii:true returns pii_rejected with no INSERT"
  - "searchUrteilChunks filters piiFiltered=true in SQL and empty aktenzeichen in post-filter (URTEIL-04)"

patterns-established:
  - "Urteile DSGVO gate: runNerFilter inline (not BullMQ) — synchronous gate before any pgvector INSERT"
  - "GUID cache round-trip: getSetting -> JSON.parse -> Set<string> -> Array.from -> JSON.stringify -> updateSetting"
  - "RSS title regex: loose /^.+?,\s*(.+?)\s+vom\s+(\d{2})\.(\d{2})\.(\d{4}),\s+(.+)$/ handles all BMJ court+senat formats"

requirements-completed: [URTEIL-01]

# Metrics
duration: ~3min
completed: "2026-02-27"
---

# Phase 17 Plan 01: Urteile-RAG Core Library Summary

**BMJ RSS fetcher for 7 federal courts + PII-gated pgvector ingestion + GUID deduplication library forming the complete Urteile-RAG data access layer.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-27T09:38:47Z
- **Completed:** 2026-02-27T09:41:12Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- `rss-client.ts`: Fetches and parses BMJ RSS feeds for BGH, BAG, BVerwG, BFH, BSG, BPatG, BVerfG using fast-xml-parser v5 with a loose title regex that handles all court/senat/Kammerbeschluss variants
- `ingestion.ts`: PII-gated ingestion pipeline where hasPii:true from runNerFilter returns "pii_rejected" (no INSERT), AbortError returns "error" (no GUID cache write, item retries), and clean items are inserted with piiFiltered:true
- GUID deduplication cache via SystemSetting JSON array — loadGuidCache/saveGuidCache round-trip via getSetting/updateSetting
- searchUrteilChunks with pgvector cosine similarity, piiFiltered=true SQL filter, and empty-aktenzeichen post-filter (URTEIL-04 compliance)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create rss-client.ts — BMJ RSS feed fetcher and XML parser** - `381a312` (feat)
2. **Task 2: Create ingestion.ts — PII-gated ingestion, GUID cache, pgvector search** - `905ff0d` (feat)

## Files Created/Modified

- `src/lib/urteile/rss-client.ts` — BMJ_RSS_FEEDS (7 courts), UrteilRssItem interface, fetchUrteileFeed with loose TITLE_REGEX and flatMap skip pattern
- `src/lib/urteile/ingestion.ts` — ingestUrteilItem (NER gate + DELETE+INSERT), loadGuidCache, saveGuidCache, searchUrteilChunks with URTEIL-04 filter

## Decisions Made

- `parseAttributeValue` (no trailing 's') is the correct fast-xml-parser v5.3.8 option — TypeScript strict check caught `parseAttributeValues` as unknown property (Rule 1 auto-fix)
- `Array.from(guids)` for Set serialization instead of `[...guids]` — TypeScript target incompatibility with Set spread without `--downlevelIteration` (Rule 1 auto-fix)
- `ingestUrteilItem` never throws — all errors caught and returned as "error" string so BullMQ processor can control GUID cache behavior
- NER text selection: leitsatz when non-empty (preferred for semantic content), structured fallback for empty BGH leitsatz (avoids empty-string NER call)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed XMLParser option name: parseAttributeValues → parseAttributeValue**
- **Found during:** Task 1 (rss-client.ts creation)
- **Issue:** Plan spec used `parseAttributeValues: true` but fast-xml-parser v5 X2jOptions type requires `parseAttributeValue` (no trailing 's') — TypeScript error TS2561
- **Fix:** Changed to `parseAttributeValue: true`
- **Files modified:** src/lib/urteile/rss-client.ts
- **Verification:** `npx tsc --noEmit` returned zero errors after fix
- **Committed in:** `381a312` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Set spread: [...guids] → Array.from(guids)**
- **Found during:** Task 2 (ingestion.ts creation)
- **Issue:** Plan spec used `JSON.stringify([...guids])` but TypeScript TS2802 error — Set can only be iterated when `--downlevelIteration` is enabled or target is ES2015+. Project tsconfig has no explicit target.
- **Fix:** Changed to `JSON.stringify(Array.from(guids))` which works at any target
- **Files modified:** src/lib/urteile/ingestion.ts
- **Verification:** `npx tsc --noEmit` returned zero errors after fix
- **Committed in:** `905ff0d` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in plan spec caught by TypeScript)
**Impact on plan:** Both fixes are trivial API/syntax corrections with identical runtime behavior. No scope creep.

## Issues Encountered

None beyond the two TypeScript type errors that were immediately auto-fixed.

## Next Phase Readiness

- Plan 02 (BullMQ cron processor) can import `fetchUrteileFeed`, `ingestUrteilItem`, `loadGuidCache`, `saveGuidCache` from these files without modification
- Plan 03 (ki-chat Chain E) can import `searchUrteilChunks` and `UrteilChunkResult` from ingestion.ts
- TypeScript compiles clean across the entire project

## Self-Check: PASSED

Files created:
- [x] `src/lib/urteile/rss-client.ts` — exists, exports BMJ_RSS_FEEDS, UrteilRssItem, fetchUrteileFeed
- [x] `src/lib/urteile/ingestion.ts` — exists, exports UrteilChunkResult, ingestUrteilItem, loadGuidCache, saveGuidCache, searchUrteilChunks

Commits:
- [x] `381a312` — feat(17-01): create rss-client.ts — BMJ RSS feed fetcher and XML parser
- [x] `905ff0d` — feat(17-01): create ingestion.ts — PII-gated ingestion, GUID cache, pgvector search

TypeScript: clean (`npx tsc --noEmit` exits 0, zero errors)

---
*Phase: 17-urteile-rag*
*Completed: 2026-02-27*
