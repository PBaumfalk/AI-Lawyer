---
phase: 25-helena-memory
verified: 2026-02-28T10:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 25: Helena Memory Verification Report

**Phase Goal:** Helena remembers case context across sessions and automatically refreshes her understanding when a case changes
**Verified:** 2026-02-28
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                                                       | Status     | Evidence                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | When Helena is invoked on an Akte (ki-chat or background task), her system prompt includes a structured German markdown memory section with the required sections                           | VERIFIED | `formatMemoryForPrompt()` renders `## Fallgedaechtnis (Stand: DD.MM.YYYY)` with Zusammenfassung, Erkannte Risiken, Strategie, Naechste Schritte, Offene Fragen sections. Both ki-chat (line 838) and helena-task (line 124) paths call it. |
| 2   | If the Akte has been modified since the last memory refresh (`Akte.geaendert > HelenaMemory.lastRefreshedAt`), memory auto-regenerates before the Helena response                          | VERIFIED | `loadOrRefresh()` lines 430-454: checks `memory.lastRefreshedAt < akte.geaendert` and regenerates via `generateMemory()` when stale. Cooldown prevents rapid-fire calls. Both invocation paths call `loadOrRefresh()`. |
| 3   | Regeneration produces a JSON object matching the defined schema via `generateObject`                                                                                                        | VERIFIED | `HelenaMemoryContentSchema` (Zod) defined at lines 36-49 in `memory-service.ts`. `generateMemory()` calls `generateObject({ model, schema: HelenaMemoryContentSchema, system, prompt })` at lines 329-334.             |
| 4   | Existing `rejectionPatterns` in `HelenaMemory.content` are preserved across memory refreshes                                                                                               | VERIFIED | Lines 467-480 in `memory-service.ts`: extracts `rejectionPatterns` array from existing content and merges into `mergedContent` before upsert.                                                                          |
| 5   | Deleting an Akte cascade-deletes the associated HelenaMemory entry (DSGVO Art. 17)                                                                                                         | VERIFIED | `prisma/schema.prisma` line 1986: `akte Akte @relation(fields: [akteId], references: [id], onDelete: Cascade)` on the `HelenaMemory` model.                                                                            |

**Score:** 5/5 truths verified

---

## Required Artifacts

| Artifact                                                         | Expected                                                                                    | Status     | Details                                                                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/helena/memory-service.ts`                               | HelenaMemoryService with `loadOrRefresh`, `formatMemoryForPrompt`, `generateMemory`, schema | VERIFIED   | 536 lines. Exports: `HelenaMemoryContentSchema`, `HelenaMemoryContent`, `LoadOrRefreshResult`, `loadOrRefresh`, `formatMemoryForPrompt`. `generateMemory` is internal. |
| `src/lib/helena/system-prompt.ts`                                | Updated `buildSystemPrompt` using `formatMemoryForPrompt` instead of `JSON.stringify`       | VERIFIED   | Lines 11-14: imports `formatMemoryForPrompt`, `HelenaMemoryContent`. Lines 42-51: structured type detection, calls `formatMemoryForPrompt` with legacy JSON fallback.  |
| `src/app/api/ki-chat/route.ts`                                   | Chain G: HelenaMemory loading + staleness check + auto-refresh                              | VERIFIED   | Lines 800-814: Chain G defined. Lines 817-818: included in `Promise.all`. Lines 836-839: `formatMemoryForPrompt` injected into `systemPrompt`. Line 1025: header set. |
| `src/lib/queue/processors/helena-task.processor.ts`              | Staleness-aware memory loading via `loadOrRefresh` replacing direct `findUnique`            | VERIFIED   | Line 29: imports `loadOrRefresh`. Line 111: `await loadOrRefresh(prisma, akteId)`. Lines 123-125: passes structured content with `_changes` to `runHelenaAgent`.      |

---

## Key Link Verification

| From                                                        | To                                             | Via                                          | Status   | Details                                                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/lib/helena/memory-service.ts`                          | `prisma.helenaMemory`                          | `upsert` with version increment              | WIRED    | Lines 484-496: `prisma.helenaMemory.upsert({ where: { akteId }, create: {...}, update: { version: { increment: 1 }, ... } })` |
| `src/lib/helena/memory-service.ts`                          | `ai generateObject`                            | Zod schema LLM call                          | WIRED    | Lines 329-334: `generateObject({ model, schema: HelenaMemoryContentSchema, system: MEMORY_GENERATION_SYSTEM_PROMPT, prompt })` |
| `src/app/api/ki-chat/route.ts`                              | `src/lib/helena/memory-service.ts`             | Chain G parallel promise                     | WIRED    | Lines 44-46: static imports `loadOrRefresh`, `formatMemoryForPrompt`. Line 806: `loadOrRefresh(prisma, akteId)`. Line 818: in `Promise.all`. |
| `src/lib/queue/processors/helena-task.processor.ts`         | `src/lib/helena/memory-service.ts`             | `loadOrRefresh` replacing `findUnique`       | WIRED    | Line 29: `import { loadOrRefresh } from "@/lib/helena/memory-service"`. Line 111: called with `prisma` and `akteId`. |
| `src/lib/helena/system-prompt.ts`                           | `src/lib/helena/memory-service.ts`             | `formatMemoryForPrompt` import               | WIRED    | Lines 12-14: `import { formatMemoryForPrompt, type HelenaMemoryContent } from "./memory-service"`. Used at line 46. |

---

## Requirements Coverage

| Requirement | Source Plan | Description                                                                                      | Status    | Evidence                                                                                                                                                                           |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MEM-02      | 25-01-PLAN  | Memory wird bei jedem Helena-Aufruf in dieser Akte als Kontext geladen ("Helena erinnert sich")  | SATISFIED | `loadOrRefresh` called in both ki-chat Chain G (line 806) and `helena-task.processor.ts` (line 111). Memory content injected into system prompt via `formatMemoryForPrompt` in both paths. |
| MEM-03      | 25-01-PLAN  | Automatischer Memory-Refresh wenn Akte seit letztem Scan veraendert wurde                        | SATISFIED | Staleness check at `memory-service.ts` lines 431-454: `isStale = memory.lastRefreshedAt < akte.geaendert`. Auto-regenerates via `generateMemory()` when stale and not on cooldown. |
| MEM-04      | 25-01-PLAN  | DSGVO-konform: Memory-Eintraege werden bei Akten-Loeschung kaskadierend geloescht (Art. 17 DSGVO) | SATISFIED | `prisma/schema.prisma` line 1986: `onDelete: Cascade` on `HelenaMemory.akte` relation. Database enforces cascade delete without application-level code.                            |

**Orphaned Requirements Check:** MEM-01 is assigned to Phase 19 (per REQUIREMENTS.md traceability table) — it is not in scope for Phase 25. No orphaned requirements found.

---

## Anti-Patterns Found

| File                                                | Line | Pattern | Severity | Impact |
| --------------------------------------------------- | ---- | ------- | -------- | ------ |
| No anti-patterns detected in any modified file.     | —    | —       | —        | —      |

No `TODO`/`FIXME`/`PLACEHOLDER` comments, empty return stubs, or disconnected handlers found across all four modified files.

---

## TypeScript Compilation

`npx tsc --noEmit` run against the full codebase. The only errors present are pre-existing errors in `src/lib/helena/index.ts` (StepUpdate type mismatch, 4 errors), explicitly documented as out-of-scope pre-existing issues in the SUMMARY. Zero errors in any file modified by Phase 25.

---

## Commit Verification

Both commits documented in SUMMARY exist in git history:
- `9d3bd1b` — feat(25-01): create HelenaMemory service
- `6a8bf41` — feat(25-01): wire memory service into ki-chat, helena-task processor, and system-prompt

---

## Human Verification Required

### 1. LLM Memory Generation Quality

**Test:** Open an Akte with documents, beteiligte, and fristen. Open ki-chat in context of that Akte. On first load (no existing HelenaMemory), observe whether Helena's system prompt was enriched with a case memory block.
**Expected:** Response header `X-Memory-Refreshed: true` is present. Helena's responses reference case context (parties, risks, strategy) without being asked.
**Why human:** Cannot invoke the LLM in a static codebase scan. Quality of `generateObject` output and whether it produces meaningful German markdown sections requires runtime observation.

### 2. Staleness Refresh End-to-End

**Test:** After memory is generated for an Akte, add a new document to the Akte, then re-invoke Helena on that Akte.
**Expected:** `X-Memory-Refreshed: true` header on the response. Helena proactively mentions the new document ("Ich sehe, dass seit unserem letzten Gespraech...").
**Why human:** Requires runtime state transitions (DB writes, timestamp comparisons, LLM re-generation) that cannot be verified statically.

### 3. RejectionPatterns Preservation

**Test:** Reject a Helena draft to create a `rejectionPatterns` entry in `HelenaMemory.content`. Trigger a memory refresh (modify the Akte). Inspect the `helena_memories` table to confirm `rejectionPatterns` persisted in the new `content` JSON.
**Expected:** `rejectionPatterns` array is present in the refreshed content alongside the newly generated fields.
**Why human:** Requires DB inspection after runtime execution through the draft-service.ts rejection flow followed by a memory refresh cycle.

---

## Gaps Summary

No gaps found. All five must-have truths are fully verified at all three levels (exists, substantive, wired).

---

_Verified: 2026-02-28_
_Verifier: Claude (gsd-verifier)_
