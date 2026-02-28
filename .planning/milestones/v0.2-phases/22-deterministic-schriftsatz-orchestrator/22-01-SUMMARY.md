---
phase: 22-deterministic-schriftsatz-orchestrator
plan: 01
subsystem: ai
tags: [zod, schriftsatz, intent-router, slot-filler, klageart-registry, generateObject]

# Dependency graph
requires:
  - phase: 20-agent-tools-react-loop
    provides: complexity-classifier with getModelForTier(), generateObject pattern
  - phase: 19-schema-foundation
    provides: HelenaDraft Prisma model, HelenaTask model, Sachgebiet enum
provides:
  - SchriftsatzSchema Zod type contract for all pipeline stages
  - IntentResultSchema for Stage 1 classification
  - KLAGEART_REGISTRY with 7 filing types (kschg_klage, lohnklage, ev_antrag, klageerwiderung, berufung, abmahnung, generic)
  - recognizeIntent() Stage 1 via generateObject
  - fillSlots() + prefillSlotsFromAkte() Stage 2 (deterministic, no LLM)
  - generateRueckfrage() for conversational slot collection
affects: [22-02 RAG-Assembly + ERV-Validator, 23 Draft-Approval Workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deterministic pipeline stage pattern: Zod schema -> generateObject -> typed result"
    - "Klageart registry: data-driven slot definitions per filing type"
    - "Akte pre-fill: Mandant->Klaeger/Gegner->Beklagter with address resolution"
    - "One-at-a-time Rueckfragen in conversational German"

key-files:
  created:
    - src/lib/helena/schriftsatz/schemas.ts
    - src/lib/helena/schriftsatz/klageart-registry.ts
    - src/lib/helena/schriftsatz/intent-router.ts
    - src/lib/helena/schriftsatz/slot-filler.ts
  modified: []

key-decisions:
  - "IntentResultSchema.rechtsgebiet uses Prisma Sachgebiet values (not ZIVILRECHT) for consistency"
  - "KLAGEART_REGISTRY uses shared slot definitions (SLOT_KLAEGER_NAME etc.) to avoid duplication"
  - "fillSlots() is a pure function -- no LLM, no DB -- for deterministic testing"
  - "Akte pre-fill maps all alias slots (PARTEI_A_NAME, ANTRAGSTELLER_NAME, BERUFUNGSKLAEGER, ABSENDER) from mandant/gegner"
  - "KSchG 3-Wochen-Frist check uses date-only arithmetic to avoid timezone issues"
  - "Abmahnung has custom sections (no standard rubrum/antraege/beweisangebote) reflecting its aussergerichtlich nature"

patterns-established:
  - "{{UPPER_SNAKE_CASE}} is the unified Platzhalter standard for all Schriftsatz output"
  - "Klageart registry as single source of truth for slot requirements per filing type"
  - "Pre-fill then ask: always pre-fill from Akte before generating any Rueckfragen"
  - "One-at-a-time Rueckfragen: never batch, always conversational"

requirements-completed: [ORCH-02, ORCH-03, ORCH-04]

# Metrics
duration: 6min
completed: 2026-02-27
---

# Phase 22 Plan 01: Schriftsatz Pipeline Foundation Summary

**Zod schema contracts, 7-entry Klageart registry, intent router via generateObject, and deterministic slot-filler with Akte pre-fill and conversational Rueckfragen**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-27T19:49:10Z
- **Completed:** 2026-02-27T19:55:15Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- SchriftsatzSchema validates all 8 mandatory sections (Rubrum, Antraege, Sachverhalt, Rechtliche Wuerdigung, Beweisangebote, Anlagen, Kosten, Formales)
- KLAGEART_REGISTRY with 7 filing types: kschg_klage (goldstandard, 11 required slots), lohnklage (goldstandard), ev_antrag, klageerwiderung, berufung, abmahnung, generic
- Intent-Router classifies Klageart/Stadium/Gerichtszweig from natural language using tier 3 model with Akte context enrichment
- Slot-Filler pre-fills from Akte (Mandant->Klaeger, Gegner->Beklagter) and generates one-at-a-time conversational Rueckfragen
- KSchG 3-Wochen-Frist warning when ZUGANG_DATUM is provided (with days remaining calculation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SchriftsatzSchema Zod types and Klageart Registry** - `2314347` (feat)
2. **Task 2: Create Intent-Router and Slot-Filler pipeline stages** - `0af8157` (feat)

## Files Created/Modified
- `src/lib/helena/schriftsatz/schemas.ts` - All Zod schemas: SchriftsatzSchema, IntentResultSchema, RetrievalBelegSchema, ErvWarnungSchema, PartySchema, AnlageSchema, BeweisangebotSchema
- `src/lib/helena/schriftsatz/klageart-registry.ts` - Data-driven registry of 7 Klagearten with slot definitions, section configs, Streitwert rules, ERV checks
- `src/lib/helena/schriftsatz/intent-router.ts` - Stage 1: recognizeIntent() via generateObject + buildAkteContext() from Prisma
- `src/lib/helena/schriftsatz/slot-filler.ts` - Stage 2: prefillSlotsFromAkte(), fillSlots() (pure function), generateRueckfrage()

## Decisions Made
- IntentResultSchema.rechtsgebiet aligns with Prisma Sachgebiet enum values (VERKEHRSRECHT, INKASSO included instead of ZIVILRECHT) for direct mapping compatibility
- Shared slot definitions (SLOT_KLAEGER_NAME, SLOT_BEKLAGTER_NAME, etc.) extracted to avoid duplication across registry entries
- fillSlots() kept as pure function (no LLM, no DB) for deterministic behavior and easy testing
- Akte pre-fill populates all alias slots (PARTEI_A, ANTRAGSTELLER, BERUFUNGSKLAEGER, ABSENDER) to support any Klageart without re-querying
- Abmahnung gets custom section config (no beweisangebote, no anlagen, no kosten sections) since it's an aussergerichtlich document
- KSchG 3-Wochen-Frist uses date-only arithmetic (no time components) per research pitfall guidance on timezone issues

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Schema contracts ready for RAG-Assembly (Plan 02) to consume
- Intent-Router and Slot-Filler ready to be wired into the pipeline orchestrator
- KLAGEART_REGISTRY sections define ragSources and ragQuery templates for Plan 02 assembly stage
- ERV-Validator (Plan 02) can use ErvWarnungSchema and KlageartDefinition.ervPruefungen

## Self-Check: PASSED

All 4 created files verified on disk. Both task commits (2314347, 0af8157) verified in git log.

---
*Phase: 22-deterministic-schriftsatz-orchestrator*
*Completed: 2026-02-27*
