---
phase: 22-deterministic-schriftsatz-orchestrator
verified: 2026-02-27T21:15:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 22: Deterministic Schriftsatz Orchestrator — Verification Report

**Phase Goal:** Helena can draft legally-structured court filings via a deterministic pipeline (not free-form agent), with every section validated against retrieved legal sources
**Verified:** 2026-02-27T21:15:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Helena produces a Zod-validated SchriftsatzSchema with all mandatory sections (Rubrum, Antraege, Sachverhalt, Rechtliche Wuerdigung, Beweisangebote, Anlagen, Kosten, Formales) | VERIFIED | `schemas.ts:138-196` — SchriftsatzSchema z.object with 8 named sections, all fields present. `index.ts:233` — SchriftsatzSchema.safeParse is called on assembly output. |
| 2 | Intent-Router correctly identifies Klageart, Stadium, and Gerichtszweig from natural language user input (KSchG-Klage, Mahnung, EV-Antrag, etc.) | VERIFIED | `intent-router.ts:109-128` — recognizeIntent() uses generateObject with IntentResultSchema and tier 3 model. System prompt maps all 7 klageart IDs with German filing terms. Gerichtszweig derived from Rechtsgebiet per rules in INTENT_ROUTER_SYSTEM_PROMPT. |
| 3 | Missing mandatory fields (Klaeger, Beklagter, Kuendigungsdatum etc.) trigger automatic Rueckfrage to the user before proceeding | VERIFIED | `slot-filler.ts:192-241` — fillSlots() checks each requiredSlot in the klageart definition, sets missingRequired[], generates rueckfrage for the first missing slot. `index.ts:197-208` — pipeline returns {status:"needs_input", rueckfrage} if !slotResult.vollstaendig. |
| 4 | Every generated Schriftsatz contains retrieval_belege[] documenting which RAG chunks were used (audit trail) | VERIFIED | `rag-assembler.ts:105,122,132,142,152` — allBelege[] accumulated across all sections. `index.ts:260,291` — stored in SchriftsatzSchema as retrieval_belege and returned in SchriftsatzPipelineResult. `schemas.ts:188` — retrieval_belege is z.array(RetrievalBelegSchema). |
| 5 | ERV/beA-Validator runs as the last step and produces warnungen[] for PDF/A compliance, signature requirements, and file size limits | VERIFIED | `erv-validator.ts:45-79` — validateErv() is a pure function, never throws. `erv-validator.ts:214-230` — always adds INFO warnings for PDF/A (SS 2 ERVV), signature (SS 130a ZPO), beA 60MB. `index.ts:250` — called after assembly as stage 5. |

**Score:** 5/5 truths verified

---

### Required Artifacts

All 9 files verified at Level 1 (exists), Level 2 (substantive), and Level 3 (wired).

| Artifact | Lines | Status | Details |
|----------|-------|--------|---------|
| `src/lib/helena/schriftsatz/schemas.ts` | 196 | VERIFIED | Exports SchriftsatzSchema, IntentResultSchema, RetrievalBelegSchema, ErvWarnungSchema, PartySchema, AnlageSchema, BeweisangebotSchema + inferred types. All 8 mandatory sections present. |
| `src/lib/helena/schriftsatz/klageart-registry.ts` | 910 | VERIFIED | Exports KLAGEART_REGISTRY (7 entries: kschg_klage, lohnklage, ev_antrag, klageerwiderung, berufung, abmahnung, generic), KlageartDefinition, getKlageartDefinition with generic fallback. |
| `src/lib/helena/schriftsatz/intent-router.ts` | 206 | VERIFIED | Exports recognizeIntent(), buildAkteContext(). Uses generateObject with IntentResultSchema + tier 3 model. Prisma query with beteiligte.kontakt and dokumente. |
| `src/lib/helena/schriftsatz/slot-filler.ts` | 477 | VERIFIED | Exports prefillSlotsFromAkte(), fillSlots(), generateRueckfrage(). Pure function fillSlots, prisma.akte.findFirst with adressen. Imports getKlageartDefinition. |
| `src/lib/helena/schriftsatz/rag-assembler.ts` | 656 | VERIFIED | Exports assembleSchriftsatz(). Imports searchLawChunks, searchUrteilChunks, searchMusterChunks, generateQueryEmbedding. Per-section retrieval with 4000-char cap, audit trail. |
| `src/lib/helena/schriftsatz/erv-validator.ts` | 620 | VERIFIED | Exports validateErv(). Four check categories: inhaltlich, formal, frist, vollstaendigkeit. Never throws (try/catch safety net). Sorted output. |
| `src/lib/helena/schriftsatz/platzhalter.ts` | 263 | VERIFIED | Exports PLATZHALTER_MAP, extractUnresolvedPlatzhalter(), resolvePlatzhalterInSchema(), toDottedKey(), toUpperSnake(). Recursive walk, deep-clone resolution. |
| `src/lib/helena/schriftsatz/index.ts` | 461 | VERIFIED | Exports runSchriftsatzPipeline(), isSchriftsatzIntent(), renderSchriftsatzMarkdown(). Full 5+1 stage pipeline, HelenaDraft creation, re-exports. |
| `src/lib/helena/index.ts` | (modified) | VERIFIED | Imports runSchriftsatzPipeline, isSchriftsatzIntent from "./schriftsatz". Routing block at line 183-248, between classification and model selection. Re-exports at lines 462-463. |

---

### Key Link Verification

All 9 key links from the two plan frontmatter sections verified:

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `intent-router.ts` | `ai.generateObject` | generateObject call with IntentResultSchema | WIRED | Line 120-125: `generateObject({ model, schema: IntentResultSchema, system: ..., prompt: ... })` |
| `slot-filler.ts` | `prisma.akte` | prisma.akte.findFirst | WIRED | Line 59: `prisma.akte.findFirst({ where: { id: akteId }, include: { beteiligte: { include: { kontakt: { include: { adressen: true } } } } } })` |
| `slot-filler.ts` | `klageart-registry.ts` | import getKlageartDefinition | WIRED | Line 17-19: `import { getKlageartDefinition } from "./klageart-registry"`. Called in fillSlots(). |
| `rag-assembler.ts` | `searchLawChunks/searchUrteilChunks/searchMusterChunks` | imports from RAG modules | WIRED | Lines 18-20: all three search functions imported. Lines 252-275: all three called in parallel per section ragSources. |
| `rag-assembler.ts` | `generateQueryEmbedding` | import from embedder | WIRED | Line 17: import. Line 245: `const embedding = await generateQueryEmbedding(query)`. |
| `schriftsatz/index.ts` | `prisma.helenaDraft.create` | stores pipeline output with meta=SchriftsatzSchema | WIRED | Line 274-284: `prisma.helenaDraft.create({ data: { akteId, userId, typ: "DOKUMENT", status: "PENDING", titel, inhalt: markdown, meta: schriftsatz } })` |
| `helena/index.ts` | `schriftsatz/index.ts` | import runSchriftsatzPipeline, conditional routing | WIRED | Lines 37-41: import. Lines 183-248: conditional block with early return before ReAct agent. |

---

### Requirements Coverage

All 7 requirement IDs declared across plans verified. REQUIREMENTS.md maps all to Phase 22, all marked complete.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| ORCH-01 | 22-02 | Deterministic 5-stage pipeline: Intent -> Slot-Filling -> RAG -> Assembly -> ERV-Validator | SATISFIED | runSchriftsatzPipeline() in `index.ts:153-307` chains all stages with abort checks and progress callbacks. |
| ORCH-02 | 22-01 | Intent-Router recognizes Klageart, Stadium, Gerichtszweig from user input | SATISFIED | recognizeIntent() with IntentResultSchema covering klageart, stadium, gerichtszweig. 7 klageart IDs mapped in system prompt. |
| ORCH-03 | 22-01 | SchriftsatzSchema as Zod-typed intermediate format with all 8 sections | SATISFIED | SchriftsatzSchema in `schemas.ts:138-196` with all 8 sections (Rubrum, Antraege, Sachverhalt, RechtlicheWuerdigung, Beweisangebote, Anlagen, Kosten, Formales). |
| ORCH-04 | 22-01 | Slot-filling with automatic Rueckfrage for missing mandatory fields | SATISFIED | fillSlots() checks requiredSlots per klageart, generates conversational German Rueckfragen one-at-a-time. Pipeline returns needs_input status. |
| ORCH-05 | 22-02 | Unified placeholder standard across all output ({{UPPER_SNAKE_CASE}}) | SATISFIED | PLATZHALTER_MAP with 40+ entries, extractUnresolvedPlatzhalter(), resolvePlatzhalterInSchema(), toDottedKey(), toUpperSnake() all in `platzhalter.ts`. Convention enforced throughout. |
| ORCH-06 | 22-02 | ERV/beA-Validator as final step with warnungen[] (PDF/A, signature, file size) | SATISFIED | validateErv() in `erv-validator.ts`. Always produces: PDF/A INFO (SS 2 ERVV), signature INFO (SS 130a ZPO), beA 60MB INFO. Plus inhaltlich, frist checks. Never throws. |
| ORCH-07 | 22-02 | Every Schriftsatz draft contains retrieval_belege[] (audit trail) | SATISFIED | RetrievalBelegSchema in schemas.ts, allBelege accumulated in rag-assembler, stored in HelenaDraft.meta and in SchriftsatzPipelineResult.retrieval_belege. |

No orphaned requirements — all 7 ORCH IDs are accounted for in plans 22-01 and 22-02.

---

### Anti-Patterns Found

No blockers or warnings found.

| File | Pattern | Severity | Impact |
|------|---------|---------|--------|
| (none) | — | — | All files are substantive implementations. No placeholder returns, no TODO stubs, no console.log-only handlers. |

Notable: `return null` appears in helper functions (getStreitwert, buildRubrum helpers) as valid no-data returns, not stub implementations. These are correct.

The `warnungen` field in SchriftsatzSchema is `z.array(z.string())` while validateErv() returns `ErvWarnung[]` (typed objects). The pipeline correctly maps at line 263: `warnungen: warnungen.map((w) => w.text)`. The full ErvWarnung objects are separately returned in SchriftsatzPipelineResult.warnungen for UI consumption. This design is intentional and sound.

---

### Human Verification Required

Three items cannot be verified programmatically and require runtime testing:

#### 1. End-to-End Pipeline Integration Test

**Test:** In a real session with a populated Akte (ARBEITSRECHT, Mandant + Gegner Beteiligte with kontakt.adressen), send: "Erstelle einen Schriftsatz fuer die Kuendigungsschutzklage"
**Expected:** Helena routes to deterministic pipeline (tier 3), pre-fills KLAEGER_NAME and BEKLAGTER_NAME from Akte beteiligte, asks about KUENDIGUNGSDATUM (first missing required slot for kschg_klage), eventually produces a HelenaDraft with SchriftsatzSchema in meta containing all 8 sections and retrieval_belege[]
**Why human:** Requires live database, LLM calls (recognizeIntent, assembleSchriftsatz), and end-to-end pipeline execution. Cannot verify without running the app.

#### 2. ERV-Validator KSchG 3-Wochen-Frist Deadline Warning

**Test:** Create a Schriftsatz with ZUGANG_DATUM set to a date 25 days ago (past the 3-week deadline)
**Expected:** validateErv() produces a KRITISCH warning for the missed KSchG deadline. Set to 5 days ago: WARNUNG about imminent deadline.
**Why human:** Requires setting specific date values and verifying the date arithmetic produces correct severity levels.

#### 3. isSchriftsatzIntent Routing Boundary

**Test:** In Helena chat, send "Was ist eine Kuendigungsschutzklage?" (question, not creation request) and verify it does NOT route to the deterministic pipeline
**Expected:** Falls through to ReAct agent. Contrast with "Erstelle eine Kuendigungsschutzklage fuer Akte X" which should route to pipeline.
**Why human:** The heuristic pattern matching in isSchriftsatzIntent needs verification against edge cases in a real session.

---

### Gaps Summary

No gaps. All 5 observable truths are verified, all 9 artifacts pass all three levels (exists, substantive, wired), all 7 key links are wired, and all 7 ORCH requirement IDs are satisfied.

The phase goal — "Helena can draft legally-structured court filings via a deterministic pipeline (not free-form agent), with every section validated against retrieved legal sources" — is architecturally achieved. The pipeline is fully assembled, the routing from Helena's main entry point is in place, and every component is connected to the next.

---

_Verified: 2026-02-27T21:15:00Z_
_Verifier: Claude (gsd-verifier)_
