---
phase: 22-deterministic-schriftsatz-orchestrator
plan: 02
subsystem: ai
tags: [rag, erv-validator, platzhalter, pipeline, generateObject, schriftsatz, helena]

# Dependency graph
requires:
  - phase: 22-01
    provides: SchriftsatzSchema, IntentResultSchema, KLAGEART_REGISTRY, recognizeIntent, fillSlots, prefillSlotsFromAkte
  - phase: 20-agent-tools-react-loop
    provides: complexity-classifier with getModelForTier(), runHelenaAgent entry point
  - phase: 14-gesetze-rag
    provides: searchLawChunks for RAG retrieval
  - phase: 17-urteile-rag
    provides: searchUrteilChunks for RAG retrieval
  - phase: 18-muster-rag-admin-upload-ui
    provides: searchMusterChunks for RAG retrieval
provides:
  - assembleSchriftsatz() per-section RAG retrieval + LLM content generation with retrieval_belege audit trail
  - validateErv() pure validation producing ErvWarnung[] (inhaltlich SS 253 ZPO + formal + frist checks)
  - Unified {{UPPER_SNAKE_CASE}} platzhalter standard with extraction, resolution, and dotted.key mapping
  - runSchriftsatzPipeline() 5-stage deterministic orchestrator storing HelenaDraft with SchriftsatzSchema in meta
  - isSchriftsatzIntent() heuristic routing check for Schriftsatz queries
  - renderSchriftsatzMarkdown() formatted German markdown with ERV checklist and collapsible sources
  - Helena index.ts routing: tier-3 Schriftsatz intents bypass ReAct agent
affects: [23 Draft-Approval Workflow, 26 Activity Feed UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RAG per-section: each Klageart section defines ragSources and ragQuery, retrieval capped at 4000 chars"
    - "ERV-Validator as pure function: no LLM, no DB, no side effects, never throws"
    - "Deterministic vs LLM sections: Rubrum/Kosten/Formales/Anlagen assembled from slots, Antraege/Sachverhalt/RW via generateObject"
    - "Pipeline early-return pattern: Schriftsatz intent detected -> deterministic pipeline, else -> ReAct agent"
    - "Platzhalter dual-format: {{UPPER_SNAKE_CASE}} for Schriftsatz output, dotted.key for Vorlagen compatibility"

key-files:
  created:
    - src/lib/helena/schriftsatz/rag-assembler.ts
    - src/lib/helena/schriftsatz/erv-validator.ts
    - src/lib/helena/schriftsatz/platzhalter.ts
    - src/lib/helena/schriftsatz/index.ts
  modified:
    - src/lib/helena/index.ts

key-decisions:
  - "ERV-Validator never hard-blocks draft creation -- warnings only, return sorted by severity"
  - "RAG context capped at 4000 chars per section to keep LLM prompts manageable"
  - "Tier 3 model (highest quality) used for all legal content generation"
  - "isSchriftsatzIntent is a fast heuristic (no LLM) -- pattern matching on filing terms + action verbs"
  - "Pipeline stores SchriftsatzSchema as HelenaDraft.meta JSON for downstream processing"
  - "3-Wochen KSchG frist uses date-only arithmetic (no time components) per timezone pitfall guidance"
  - "Schriftsatz routing is an early return in runHelenaAgent -- ReAct code path completely untouched"
  - "computeGkgFee * 3 for Klageverfahren court costs in Kosten section"

patterns-established:
  - "Pipeline stage pattern: onStepUpdate callback for progress reporting per stage"
  - "Deterministic section builders: buildRubrum, buildFormales, buildKosten -- no LLM, pure slot mapping"
  - "ResolvePlatzhalterInSchema: deep-clone + walk-and-replace, leave unresolved as-is for ERV detection"
  - "Markdown rendering with collapsible sources section (<details>/<summary>)"

requirements-completed: [ORCH-01, ORCH-05, ORCH-06, ORCH-07]

# Metrics
duration: 8min
completed: 2026-02-27
---

# Phase 22 Plan 02: Schriftsatz Pipeline Completion Summary

**RAG assembly with per-section retrieval and audit trail, ERV-Validator with SS 253 ZPO + frist checks, unified platzhalter standard, and 5-stage pipeline orchestrator wired into Helena entry point**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-27T19:58:09Z
- **Completed:** 2026-02-27T20:06:09Z
- **Tasks:** 2
- **Files created:** 4
- **Files modified:** 1

## Accomplishments
- RAG assembler retrieves law/case law/template chunks per section with 4000-char cap and tracks retrieval_belege for audit trail
- ERV-Validator runs 4 check categories: inhaltlich (SS 253 ZPO rubrum/antraege/parteien), formal (datum/unterschrift/PDF-A/signatur/beA), frist (3-Wochen KSchG, Berufungs/Begruendungsfrist, Erwiderungsfrist, Faelligkeit), and vollstaendigkeit (unresolved platzhalter detection)
- Unified platzhalter utility with {{UPPER_SNAKE_CASE}} <-> dotted.key mapping, recursive extraction, and deep-clone resolution
- runSchriftsatzPipeline chains all 5 stages deterministically with "needs_input" Rueckfrage support and HelenaDraft creation
- Helena index.ts routes tier-3 Schriftsatz intents to deterministic pipeline instead of ReAct agent (early return, no existing code modified)
- isSchriftsatzIntent detects both gerichtlich (Klage, Antrag, Berufung) and aussergerichtlich (Abmahnung, Kuendigungsschreiben, Aufforderungsschreiben) patterns
- renderSchriftsatzMarkdown produces formatted German markdown with section headers, ERV checklist, and collapsible source references

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RAG Assembler, ERV Validator, and Platzhalter utility** - `281964f` (feat)
2. **Task 2: Create pipeline orchestrator and wire into Helena entry point** - `c40ba81` (feat)

## Files Created/Modified
- `src/lib/helena/schriftsatz/rag-assembler.ts` - Stage 3-4: per-section RAG retrieval + LLM generation via generateObject, deterministic builders for Rubrum/Kosten/Formales/Anlagen
- `src/lib/helena/schriftsatz/erv-validator.ts` - Stage 5: pure validation function producing sorted ErvWarnung[] with inhaltlich + formal + frist + vollstaendigkeit checks
- `src/lib/helena/schriftsatz/platzhalter.ts` - Unified {{UPPER_SNAKE_CASE}} placeholder standard with PLATZHALTER_MAP, extraction, resolution, and format conversion
- `src/lib/helena/schriftsatz/index.ts` - Pipeline orchestrator: runSchriftsatzPipeline, isSchriftsatzIntent, renderSchriftsatzMarkdown, plus re-exports
- `src/lib/helena/index.ts` - Added Schriftsatz routing (step 3b) between complexity classification and model selection

## Decisions Made
- ERV-Validator never hard-blocks: all issues captured as ErvWarnung with schwere (KRITISCH/WARNUNG/INFO), sorted by severity
- RAG context capped at 4000 chars per section: higher-scoring chunks prioritized, lower ones truncated
- Tier 3 model used for all legal content generation (Antraege, Sachverhalt, Rechtliche Wuerdigung, Beweisangebote)
- isSchriftsatzIntent uses fast pattern matching (no LLM call) for routing -- covers gerichtlich and aussergerichtlich document types
- SchriftsatzSchema stored in HelenaDraft.meta JSON field for machine-readable downstream processing
- GKG fee calculated as 3x simple fee for Klageverfahren (standard multiplier)
- Schriftsatz routing placed as early return before tool creation/system prompt to avoid unnecessary work

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Complete 5-stage Schriftsatz pipeline ready for end-to-end testing
- HelenaDraft.meta contains full SchriftsatzSchema for Draft-Approval Workflow (Phase 23) consumption
- ERV warnungen available for UI display in approval review screen
- retrieval_belege audit trail ready for compliance/transparency features
- Pipeline returns structured "needs_input" state for conversational slot collection in chat UI

## Self-Check: PASSED

All 4 created files and 1 modified file verified on disk. Both task commits (281964f, c40ba81) verified in git log.

---
*Phase: 22-deterministic-schriftsatz-orchestrator*
*Completed: 2026-02-27*
