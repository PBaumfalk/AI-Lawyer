---
phase: 30-scan-05-neu-urteil-check
plan: "02"
subsystem: scanner, ai, ui
tags: [pgvector, cosine-similarity, llm, briefing, alerts, bullmq]

# Dependency graph
requires:
  - phase: 30-scan-05-neu-urteil-check
    provides: "summaryEmbedding on Akte, assembleAkteSummaryText(), SystemSettings for threshold"
  - phase: 21-phase21-embedding-pipeline
    provides: "pgvector infrastructure, UrteilChunk embeddings"
  - phase: 24-phase24-scanner-infra
    provides: "createScannerAlert(), resolveAlertRecipients(), Alert-Center UI"
provides:
  - "runNeuesUrteilCheck() cross-matching engine with Sachgebiet pre-filter"
  - "Helena LLM briefings for matched Urteile (3-section structured format)"
  - "NEUES_URTEIL alerts with per-Urteil dedup"
  - "Worker trigger after urteile-sync completion"
  - "NEUES_URTEIL Alert-Center UI (violet Scale icon, filter chip)"
  - "Admin range slider for threshold tuning"
affects: [scan-05-complete, helena-agent]

# Tech tracking
tech-stack:
  added: []
  patterns: ["pgvector cosine similarity cross-matching with Sachgebiet pre-filter", "Per-entity dedup via JSON meta path query"]

key-files:
  created:
    - src/lib/scanner/checks/neues-urteil-check.ts
  modified:
    - src/worker.ts
    - src/components/helena/alert-center.tsx
    - src/app/(dashboard)/admin/settings/page.tsx

key-decisions:
  - "Per-Urteil dedup uses Prisma JSON path query on meta.urteilChunkId instead of time-based 24h dedup"
  - "Sachgebiet pre-filter maps Rechtsgebiet to Sachgebiet array; Verfassungsrecht matches all Akten"
  - "LLM briefing uses 3-section structure: Was entschieden, Warum relevant, Moegliche Auswirkungen"

patterns-established:
  - "Cross-matching pattern: raw SQL pgvector query with conditional Sachgebiet WHERE clause"
  - "Akte summary text cache pattern: Map<akteId, text> to avoid re-fetching same Akte"

requirements-completed: [SCAN-02, SCAN-03, SCAN-05]

# Metrics
duration: 3min
completed: 2026-02-28
---

# Phase 30 Plan 02: Neu-Urteil Cross-Matching Engine Summary

**pgvector cosine similarity cross-matching with Sachgebiet pre-filter, Helena LLM briefings, NEUES_URTEIL alerts, and admin threshold slider**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-28T22:38:07Z
- **Completed:** 2026-02-28T22:40:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Cross-matching engine finds newly ingested Urteile and matches against active Akten via pgvector cosine similarity
- Sachgebiet pre-filter narrows search space using RECHTSGEBIET_TO_SACHGEBIET mapping
- Helena generates structured 3-section German briefings explaining Urteil relevance per Akte
- Per-Urteil dedup prevents duplicate alerts for same Urteil-Akte pair (uses JSON meta path query)
- Worker automatically triggers cross-matching after urteile-sync when new Urteile are inserted
- Alert-Center shows NEUES_URTEIL with violet Scale icon and dedicated filter chip
- Admin settings page renders range slider with Lockerer/Strenger labels for threshold tuning

## Task Commits

Each task was committed atomically:

1. **Task 1: Cross-matching check with LLM briefing and alert creation** - `a84ea43` (feat)
2. **Task 2: Worker trigger wiring + Alert-Center UI + admin threshold slider** - `e85f436` (feat)

## Files Created/Modified
- `src/lib/scanner/checks/neues-urteil-check.ts` - Core matching engine: pgvector queries, Sachgebiet mapping, LLM briefing, alert creation with per-Urteil dedup
- `src/worker.ts` - Import runNeuesUrteilCheck, trigger after urteile-sync completion when inserted > 0
- `src/components/helena/alert-center.tsx` - NEUES_URTEIL in ALERT_TYPE_CONFIG (violet Scale icon) and TYPE_CHIPS filter
- `src/app/(dashboard)/admin/settings/page.tsx` - Range slider for scanner.neues_urteil_threshold with Lockerer/Strenger labels

## Decisions Made
- Per-Urteil dedup uses Prisma JSON path query (`meta.urteilChunkId`) instead of time-based 24h dedup -- NEUES_URTEIL alerts don't auto-resolve so permanent dedup is needed
- Sachgebiet pre-filter maps BMJ RSS rechtsgebiet values to application Sachgebiet enum; Verfassungsrecht has empty mapping to match all Akten (cross-cutting)
- LLM briefing capped at maxTokens: 500 with structured 3-section format and graceful fallback on failure
- Score-to-severity: >= 0.90 -> 9, >= 0.85 -> 8, >= 0.80 -> 7, >= 0.75 -> 6, else -> 5
- Akte summary text cached per-Akte ID to avoid re-fetching when same Akte matches multiple Urteile

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full Neu-Urteil pipeline is complete: RSS ingestion -> PII filtering -> embedding -> cross-matching -> alerts
- Phase 30 (SCAN-05) is now fully implemented across both plans
- Admin can tune threshold and toggle feature independently via SystemSettings

---
*Phase: 30-scan-05-neu-urteil-check*
*Completed: 2026-02-28*
