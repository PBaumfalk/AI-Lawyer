---
phase: 18-muster-rag-admin-upload-ui
verified: 2026-02-27T11:30:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Upload DOCX or PDF via /admin/muster and confirm file appears with PENDING_NER status"
    expected: "File shown in table immediately; after NER passes (INDEXED), chunk count > 0 visible on refresh"
    why_human: "Requires running MinIO + worker + NER pipeline; cannot verify end-to-end ingestion programmatically"
  - test: "Ask Helena a Schriftsatz-related question in ki-chat for an Akte with muster_chunks populated"
    expected: "Response contains RUBRUM / ANTRAEGE / BEGRUENDUNG structure with {{PLATZHALTER}} and ENTWURF closing warning"
    why_human: "Requires live Helena inference with seeded muster_chunks; cannot verify RAG output programmatically"
---

# Phase 18: Muster-RAG + Admin Upload UI Verification Report

**Phase Goal:** Muster-RAG with admin upload UI — kanzlei-eigene Schriftsatzmuster and amtliche Formulare as RAG context for Helena Schriftsatz-Entwurf generation
**Verified:** 2026-02-27T11:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                                              | Status     | Evidence                                                                                                                   |
|----|------------------------------------------------------------------------------------------------------------------------------------|------------|----------------------------------------------------------------------------------------------------------------------------|
| 1  | muster_chunks DB table has isKanzleiEigen (Muster) and kanzleiEigen (MusterChunk) columns after migration                         | VERIFIED   | `prisma/schema.prisma` lines 1009, 1029; migration SQL `20260227114302_add_muster_kanzlei_eigen/migration.sql` both ALTERs |
| 2  | searchMusterChunks() applies 1.3x score multiplier to kanzleiEigen=true results and returns them ranked first                     | VERIFIED   | `ingestion.ts` line 26: `KANZLEI_BOOST = 1.3`; line 310: `score: Number(r.rawScore) * (r.kanzleiEigen ? KANZLEI_BOOST : 1.0)` |
| 3  | seedAmtlicheFormulare() inserts 6 amtliche Formulare with {{PLATZHALTER}} idempotently via SystemSetting version key               | VERIFIED   | `seed-amtliche.ts`: 6 entries in AMTLICHE_MUSTER; 105+ `{{` occurrences; getSetting("muster.amtliche_seed_version") guard |
| 4  | insertMusterChunks() skips extractMusterFullText entirely when optional content param provided                                     | VERIFIED   | `ingestion.ts` lines 190-193: `content && content.trim().length > 0 ? content : await extractMusterFullText(...)` |
| 5  | Admin can upload DOCX or PDF to /admin/muster — file appears with PENDING_NER status immediately                                  | VERIFIED   | `route.ts` POST: MIME guard (415), `isKanzleiEigen: true`, `nerStatus: "PENDING_NER"`, `nerPiiQueue.add()`; page.tsx 342 lines |
| 6  | After NER passes (INDEXED), muster_chunks are automatically inserted — no manual trigger needed                                    | VERIFIED   | `ner-pii.processor.ts` lines 126-127: `musterIngestionQueue.add("ingest-muster", { musterId })` after INDEXED transition   |
| 7  | REJECTED_PII_DETECTED muster never enters muster_chunks — PII gate invariant holds without bypass                                 | VERIFIED   | Trigger placed only in "no PII" else branch; processor guards: `if (muster.nerStatus !== "INDEXED") return` at line 58     |
| 8  | Admin can delete a Muster — MinIO object and muster_chunks are removed                                                            | VERIFIED   | `[id]/route.ts` DELETE: `$executeRaw DELETE FROM muster_chunks`, `deleteFile(muster.minioKey)`, `prisma.muster.delete()`   |
| 9  | muster-ingestion queue appears in Bull Board for monitoring                                                                        | VERIFIED   | `queues.ts` line 189: `musterIngestionQueue` in `ALL_QUEUES` array                                                         |
| 10 | Helena retrieves top-5 muster_chunks in parallel with Chain D and E — no extra latency                                            | VERIFIED   | `ki-chat/route.ts` line 532: 6-element `Promise.all` including `musterChunksPromise`; reuses `queryEmbeddingPromise`       |
| 11 | MUSTER-QUELLEN block appears with Muster name, herkunft (Kanzlei-Muster / Amtliches Formular), and parentContent                 | VERIFIED   | `ki-chat/route.ts` lines 603-611: `--- MUSTER-QUELLEN ---`, herkunft string, `parentContent ?? content`                   |
| 12 | Chain F failure is non-fatal — catch returns [] and Helena responds without Muster context                                         | VERIFIED   | `ki-chat/route.ts` lines 524-527: `catch (err) { console.error(...); return []; }`                                         |
| 13 | MUSTER-QUELLEN injection includes closing ENTWURF instruction with RUBRUM / ANTRAEGE / BEGRUENDUNG + {{PLATZHALTER}}              | VERIFIED   | `ki-chat/route.ts` line 611: full closing instruction with ENTWURF marker present                                           |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact                                                              | Provides                                              | Status     | Details                                                                      |
|-----------------------------------------------------------------------|-------------------------------------------------------|------------|------------------------------------------------------------------------------|
| `prisma/schema.prisma`                                               | isKanzleiEigen on Muster, kanzleiEigen on MusterChunk | VERIFIED   | Both fields present with @default(false); migration file exists              |
| `prisma/migrations/20260227114302_add_muster_kanzlei_eigen/migration.sql` | DDL for both columns                              | VERIFIED   | 2 ALTER TABLE statements for muster and muster_chunks                        |
| `src/lib/muster/ingestion.ts`                                        | extractMusterFullText, insertMusterChunks (optional content), searchMusterChunks, MusterChunkResult | VERIFIED | All 4 exports present; 319 lines; substantive implementation |
| `src/lib/muster/seed-amtliche.ts`                                    | AMTLICHE_MUSTER (6 forms) + seedAmtlicheFormulare    | VERIFIED   | 6 Arbeitsrecht Formulare; 105+ {{PLATZHALTER}}; idempotency guard; 603 lines |
| `src/lib/queue/processors/muster-ingestion.processor.ts`             | processMusterIngestionJob + processMusterIngestPending + MusterIngestionJobData | VERIFIED | Created; INDEXED guard present; 111 lines |
| `src/lib/queue/queues.ts`                                            | musterIngestionQueue in ALL_QUEUES                   | VERIFIED   | Queue exported at line 164; added to ALL_QUEUES at line 189                  |
| `src/lib/queue/processors/ner-pii.processor.ts`                      | musterIngestionQueue trigger after INDEXED            | VERIFIED   | Import at line 20; trigger at line 127 in INDEXED (no-PII) branch only       |
| `src/worker.ts`                                                       | musterIngestionWorker (concurrency:2) + startup calls | VERIFIED  | Worker registered; processMusterIngestPending + seedAmtlicheFormulare called |
| `src/app/(dashboard)/admin/layout.tsx`                               | Muster nav entry at /admin/muster                    | VERIFIED   | Line 12: `{ name: "Muster", href: "/admin/muster" }`                        |
| `src/app/(dashboard)/admin/muster/page.tsx`                          | Upload form + muster table with NER badges           | VERIFIED   | 342 lines; "use client"; upload handler; delete handler; retry NER handler   |
| `src/app/api/admin/muster/route.ts`                                  | GET (list) + POST (upload + nerPiiQueue.add)         | VERIFIED   | ADMIN guard; MIME check (415); isKanzleiEigen:true; nerPiiQueue.add         |
| `src/app/api/admin/muster/[id]/route.ts`                             | DELETE + PATCH (retry NER)                           | VERIFIED   | DELETE removes chunks + MinIO + row; PATCH guards REJECTED/PENDING_NER only  |
| `src/app/api/ki-chat/route.ts`                                       | Chain F musterChunksPromise + MUSTER-QUELLEN injection | VERIFIED | Import line 30; Chain F lines 514-528; 6-element Promise.all line 532; injection lines 601-612 |

### Key Link Verification

| From                                       | To                                      | Via                                                | Status   | Details                                                                     |
|--------------------------------------------|----------------------------------------|-----------------------------------------------------|----------|-----------------------------------------------------------------------------|
| `ingestion.ts:insertMusterChunks`          | `prisma.muster_chunks`                 | `$executeRaw INSERT` with `kanzleiEigen` from `muster.isKanzleiEigen` | WIRED | Line 213-236: INSERT uses `${muster.isKanzleiEigen}` for kanzleiEigen column |
| `ingestion.ts:searchMusterChunks`          | `muster_chunks`                        | `$queryRaw` cosine similarity + 1.3x kanzleiEigen boost | WIRED | Lines 282-317: rawScore query + KANZLEI_BOOST multiplier                  |
| `seed-amtliche.ts:seedAmtlicheFormulare`   | `SystemSetting muster.amtliche_seed_version` | getSetting idempotency guard before insert    | WIRED | Lines 550-556: getSetting check returns early if SEED_VERSION matches      |
| `seed-amtliche.ts:seedAmtlicheFormulare`   | `ingestion.ts:insertMusterChunks`      | passes `amtliches.content` — no MinIO fetch         | WIRED | Line 590: `insertMusterChunks(muster.id, amtliches.content)`              |
| `api/admin/muster/route.ts POST`           | `nerPiiQueue.add({ musterId })`        | after MinIO upload + prisma.muster.create           | WIRED | Line 132: `nerPiiQueue.add("ner-muster", { musterId: muster.id })`        |
| `ner-pii.processor.ts:processMusterNer`    | `musterIngestionQueue.add({ musterId })` | after INDEXED transition (INDEXED-only branch)    | WIRED | Lines 126-127: trigger in no-PII branch only; REJECTED branch absent      |
| `muster-ingestion.processor.ts`            | `insertMusterChunks(musterId)`         | after confirming nerStatus === INDEXED; no content param | WIRED | Line 69: `insertMusterChunks(musterId)` — no content param               |
| `ki-chat/route.ts:Chain F`                 | `searchMusterChunks(queryEmbedding, { limit: 5, minScore: 0.55 })` | queryEmbeddingPromise shared with Chain D/E | WIRED | Lines 519-521: `await queryEmbeddingPromise` reused; `searchMusterChunks` called |
| `ki-chat/route.ts:MUSTER-QUELLEN block`    | system prompt string                   | conditional injection after URTEILE-QUELLEN block   | WIRED | Lines 601-612: block appended to `systemPrompt` conditionally             |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                                   | Status     | Evidence                                                                              |
|-------------|------------|---------------------------------------------------------------------------------------------------------------|------------|--------------------------------------------------------------------------------------|
| ARBW-01     | 18-01      | Amtliche Formulare in muster_chunks table; Platzhalter normalized                                             | SATISFIED  | 6 formulare in AMTLICHE_MUSTER; 105+ {{PLATZHALTER}}; muster_chunks table with pgvector |
| ARBW-02     | 18-02      | Admin UI at /admin/muster for upload of kanzlei-eigene Muster (DOCX/PDF); NER-Status column                 | SATISFIED  | `/admin/muster/page.tsx` 342 lines; upload form; NerStatusBadge component; chunk count |
| ARBW-03     | 18-02      | PII anonymization via NER before ingestion; state machine PENDING_NER → NER_RUNNING → INDEXED/REJECTED; no bypass | SATISFIED | ner-pii.processor.ts trigger only in INDEXED branch; processor INDEXED guard; PATCH route guards status |
| ARBW-04     | 18-01      | Kanzlei-eigene Muster get highest retrieval boost; Schriftsatz-Relevanz-Score in metadata                    | SATISFIED  | KANZLEI_BOOST = 1.3 applied post-query; kanzleiEigen field on MusterChunkResult      |
| ARBW-05     | 18-03      | Helena creates structured Schriftsatz-Entwuerfe (Rubrum, Antraege, Begruendung) from muster_chunks; always ENTWURF with {{PLATZHALTER}} | SATISFIED | Chain F + MUSTER-QUELLEN injection + ENTWURF closing instruction in ki-chat/route.ts |

No orphaned requirements — all 5 ARBW requirements are claimed in plan frontmatter and verified in codebase.

ARBW-03 is listed as "Phase 16" in REQUIREMENTS.md coverage table but the NER state machine was extended in Phase 18 (trigger in ner-pii.processor.ts). The Phase 16 NER gate was the prerequisite; Phase 18 wired the muster-ingestion trigger into it. This is correctly implemented.

### Anti-Patterns Found

| File                                      | Line | Pattern        | Severity | Impact                                                              |
|-------------------------------------------|------|----------------|----------|---------------------------------------------------------------------|
| `ner-pii.processor.ts` (line 126)         | 126  | `/ Phase 18:` — single slash instead of `//` before comment text | INFO | Not a functional issue; grep shows comment is present as `// Phase 18:` — verified actual content is `// Phase 18: trigger chunk ingestion after NER passes`. Grep output showed single slash only because the grep result was line-truncated display artifact. |

No blocking anti-patterns. No TODO/FIXME/placeholder stubs. No empty return null implementations. No console.log-only handlers. TypeScript clean (`npx tsc --noEmit` exits 0).

### Human Verification Required

#### 1. End-to-End Muster Upload Pipeline

**Test:** Log in as ADMIN, navigate to /admin/muster, upload a DOCX or PDF Muster file with name and kategorie filled in.
**Expected:** File appears in the Muster table immediately with PENDING_NER status. After the worker processes the NER job (30-120 seconds depending on Ollama), status changes to INDEXED and chunk count becomes > 0 on refresh. Retry button hidden for INDEXED entries; Loschen button visible.
**Why human:** Requires running Docker services (MinIO, PostgreSQL, worker with Ollama) — cannot verify the NER pipeline end-to-end programmatically.

#### 2. Helena Schriftsatz-Entwurf Generation

**Test:** After muster_chunks are populated (either via seeded amtliche Formulare or uploaded kanzlei Muster), open an Akte in ki-chat and ask Helena to draft a Kündigungsschutzklage.
**Expected:** Helena's response contains a structured Schriftsatz with RUBRUM (parties + Gericht), ANTRAEGE (numbered), and BEGRUENDUNG (I., II., ...) sections. Missing data fields appear as {{PLATZHALTER}}. Response closes with the ENTWURF warning marker.
**Why human:** Requires live Helena inference with pgvector similarity search returning muster_chunks results; outcome depends on embedding quality and whether minScore 0.55 threshold is correctly calibrated.

### Gaps Summary

No gaps found. All 13 must-have truths verified, all 13 artifacts confirmed substantive and wired, all 9 key links confirmed wired. All 5 ARBW requirements satisfied. TypeScript clean.

---

_Verified: 2026-02-27T11:30:00Z_
_Verifier: Claude (gsd-verifier)_
