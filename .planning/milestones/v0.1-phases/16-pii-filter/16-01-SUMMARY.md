---
phase: 16-pii-filter
plan: "01"
subsystem: pii-filter
tags: [ner, pii, dsgvo, ollama, institution-whitelist]
dependency_graph:
  requires: []
  provides:
    - src/lib/pii/ner-filter.ts (runNerFilter, buildNerPrompt, NerResult)
    - src/lib/pii/institution-whitelist.ts (isInstitutionName, INSTITUTION_PATTERNS)
  affects:
    - Phase 17 Urteile-RAG (calls runNerFilter inline as synchronous gate)
    - Phase 18 Muster-RAG (BullMQ processor calls runNerFilter)
tech_stack:
  added: []
  patterns:
    - Ollama /api/generate with format:"json" + AbortSignal.timeout(45_000)
    - Regex institution whitelist applied post-NER-extraction
    - Double defense against Qwen3 <think> token leakage (format:json + /\{[\s\S]*\}/)
key_files:
  created:
    - src/lib/pii/ner-filter.ts
    - src/lib/pii/institution-whitelist.ts
  modified: []
decisions:
  - "NER_TIMEOUT_MS=45_000 — AbortSignal.timeout propagates uncaught (BRAO §43a: never silent pass)"
  - "format:json + /\\{[\\s\\S]*\\}/ double defense — both applied as defense-in-depth against <think> leakage"
  - "Institution whitelist applied post-NER (not as negative examples only) — regex more reliable than LLM exclusion alone"
  - "buildNerPrompt() does not slice text — caller is responsible for windowing (UrteilChunk: full content; Muster: slice(0,6000)+slice(-2000))"
metrics:
  duration: "~2m"
  completed: "2026-02-27T08:24:45Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 16 Plan 01: NER-PII Core Module Summary

**One-liner:** Ollama qwen3.5:35b NER filter with 6-example few-shot prompt + German institution regex whitelist as DSGVO gate before pgvector ingestion.

## What Was Built

Two TypeScript modules forming the core PII detection layer:

**`src/lib/pii/institution-whitelist.ts`**
- `INSTITUTION_PATTERNS: RegExp[]` — 20+ patterns covering all 7 Bundesgerichte, regional court types (Amtsgericht, Landgericht, OLG, etc.), standard abbreviations (AG/LG/OLG/BAG/BGH/BVerfG/BFH/BVerwG/BSG/BPatG), government bodies (Senat, Kammer, Staatsanwaltschaft, Bundesministerium), and constitutional bodies (Bundestag, Landtag)
- `isInstitutionName(candidate: string): boolean` — returns true if any pattern matches

**`src/lib/pii/ner-filter.ts`**
- `NerResult` interface: `{ persons: string[], hasPii: boolean }`
- `buildNerPrompt(text: string): string` — 6 few-shot German legal NER examples covering: BGH no-persons case, Amtsgericht Koeln with Hans Mueller, 2. Senat with Dr. Sabine Hoffmann, multi-party Rechtsanwalt case with Dr. Klaus Weber/Thomas Fischer/Anna Braun, LAG Hamm with Karl Lehmann, and a no-names Urteil
- `runNerFilter(text: string): Promise<NerResult>` — Ollama fetch with format:json + AbortSignal.timeout(45_000) + double JSON defense + institution whitelist filter

## Success Criteria Verification

| Criterion | Status | Evidence |
|-----------|--------|---------|
| runNerFilter() returns NerResult | PASS | Exported function with return type Promise<NerResult> |
| Institution names never in persons[] | PASS | isInstitutionName() applied at line 160 before hasPii set |
| 45s AbortSignal.timeout fires and throws | PASS | AbortSignal.timeout(NER_TIMEOUT_MS) at line 127; no catch for AbortError |
| format:json + /\{[\s\S]*\}/ double defense | PASS | Both present in runNerFilter() |
| TypeScript compiles clean | PASS | `npx tsc --noEmit` exits 0 with no pii/ errors |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: institution-whitelist.ts | `60a29d4` | 20+ RegExp patterns + isInstitutionName() |
| Task 2: ner-filter.ts | `4c5715a` | NerResult + buildNerPrompt (6 examples) + runNerFilter |

## Deviations from Plan

None — plan executed exactly as written.

The plan specified both `format:"json"` and the `/\{[\s\S]*\}/` regex defense. Both were implemented exactly as documented. The institution whitelist covered all required patterns from the task spec.

## Architecture Notes for Downstream Consumers

**Phase 17 (Urteile-RAG):** Call `runNerFilter(urteilContent)` inline. If `result.hasPii`, skip row. If `!result.hasPii`, insert UrteilChunk with `piiFiltered: true`. No BullMQ queue needed for Urteile.

**Phase 18 (Muster-RAG):** BullMQ `ner-pii` processor will import `runNerFilter`. For long Muster files, pass `text.slice(0, 6000) + "\n...\n" + text.slice(-2000)` to cover Rubrum and signatures. Processor must catch AbortError, reset `nerStatus` to `PENDING_NER`, and re-throw.

## Self-Check: PASSED

Files created:
- [x] `src/lib/pii/institution-whitelist.ts` — exists, exports INSTITUTION_PATTERNS and isInstitutionName
- [x] `src/lib/pii/ner-filter.ts` — exists, exports NerResult, buildNerPrompt, runNerFilter

Commits:
- [x] `60a29d4` — feat(16-01): create institution-whitelist.ts PII filter
- [x] `4c5715a` — feat(16-01): create ner-filter.ts core NER-PII module

TypeScript: clean (`npx tsc --noEmit` exits 0)
