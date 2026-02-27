---
gsd_state_version: 1.0
milestone: v3.4
milestone_name: Helena RAG
status: unknown
last_updated: "2026-02-27T09:49:39.797Z"
progress:
  total_phases: 9
  completed_phases: 8
  total_plans: 26
  completed_plans: 26
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollstaendig im Browser verwalten, waehrend eine proaktive KI-Agentin aktenuebergreifend lernt, automatisch Entwuerfe erstellt, Fristen erkennt und als digitale Rechtsanwaltsfachangestellte mitarbeitet.
**Current focus:** v0.1 Helena RAG — Phase 17 (Urteile-RAG) COMPLETE — Phase 18 (Muster-RAG + Admin Upload UI) is next

## Current Position

Phase: 17 of 18 (Urteile-RAG) — COMPLETE
Plan: 3 of 3 complete
Status: Phase 17 Plan 03 complete — Chain E parallel Urteil retrieval + URTEILE-QUELLEN injection wired into ki-chat. Phase 18 (Muster-RAG + Admin Upload UI) is next.
Last activity: 2026-02-27 — Phase 17 Plan 03 complete: Chain E (urteilChunksPromise), Promise.all[4], URTEILE-QUELLEN system prompt injection, anti-hallucination AZ instruction

Progress: [█████░░░░░] ~56%

## Performance Metrics

**Velocity:**
- Total plans completed: 48 (v3.4: 38 + v3.5: 10)
- Average duration: see milestone archives
- Total execution time: see milestones/v3.4-ROADMAP.md + milestones/v3.5-ROADMAP.md

**By Phase (v0.1 — not started):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 12. RAG Schema Foundation | 1/1 | ~5m | 5m |
| 13. Hybrid Search + Reranking | 3/3 | ~18m | 6m |
| 14. Gesetze-RAG | 3/3 | ~4m | ~2m |
| 15. Normen-Verknüpfung in Akte | 3/3 | ~4m+~4m+~2m | ~3m |
| 16. PII-Filter | 3/3 | ~5m | ~2m |
| 17. Urteile-RAG | 3/3 | ~6m | ~2m |
| 18. Muster-RAG + Admin Upload UI | 0/TBD | - | - |
| Phase 14-gesetze-rag P02 | 2 | 2 tasks | 3 files |
| Phase 15-normen-verknuepfung-in-akte P01 | 4 | 2 tasks | 4 files |
| Phase 16-pii-filter P01 | 2m | 2 tasks | 2 files |
| Phase 16-pii-filter P02 | ~2m | 2 tasks | 3 files |
| Phase 16-pii-filter P03 | 1 | 1 tasks | 1 files |
| Phase 17-urteile-rag P01 | 3 | 2 tasks | 2 files |
| Phase 17-urteile-rag P02 | ~2m | 2 tasks | 3 files |
| Phase 17-urteile-rag P03 | 1 | 1 tasks | 1 files |

## Accumulated Context

### Decisions

All v3.5 decisions archived in PROJECT.md Key Decisions table.

Recent decisions affecting v0.1:
- qwen3.5:35b als Ollama-Standard — validiert fuer LLM-as-reranker (Option A); Qwen3-Reranker-4B (Option B) availability unverified, nicht verwenden
- DSGVO-Gate ist non-negotiable: PII-Filter muss standalone acceptance-getestet sein BEVOR Urteile oder Muster in pgvector/Meilisearch indiziert werden
- Phase 12-01: chunkType column NOT NULL DEFAULT 'STANDALONE' — no backfill script needed, Prisma migration handles existing rows
- Phase 12-01: HNSW manual SQL file (manual_rag_hnsw_indexes.sql) follows manual_pgvector_index.sql convention — both applied at Docker entrypoint
- [Phase 13-01]: hybridSearch() queries pgvector directly (inline SQL) instead of calling searchSimilar() — SearchResult lacks id/chunkType/parentChunkId required for RRF keying
- [Phase 13-01]: DISTINCT ON (dokumentId) resolves BM25 document hits to best child chunk in one SQL round-trip; AbortSignal.timeout(3000) on Ollama reranker with graceful RRF fallback
- [Phase 13-02]: chunkDocumentParentChild uses GERMAN_LEGAL_SEPARATORS for both parent (8000 chars) and child (2000 chars) splitters; global child index across all parents
- [Phase 13-02]: PARENT rows stored with NULL embedding; chunkType != PARENT filter guards all 4 searchSimilar branches; insertChunks() preserved for STANDALONE pipeline until Plan 03
- [Phase 13-03]: confidenceFlag 'low' not used for RRF — RRF scores (max ~0.016) not comparable to cosine threshold 0.3; any RRF result is 'ok'; bm25Limit:50 + vectorLimit:50 -> finalLimit:10 for wide candidate fusion
- [Phase 14-01]: SHA cache stored in SystemSetting as JSON string via getSetting/updateSetting — setSettingTyped does not exist; use manual JSON.parse/stringify
- [Phase 14-01]: upsertLawChunks uses DELETE+INSERT per row (not SQL UPSERT) for clean embedding replacement on model version change
- [Phase 14-01]: searchLawChunks receives pre-computed queryEmbedding — ki-chat Chain D reuses Chain B embedding to avoid second Ollama call
- [Phase 14-03]: queryEmbeddingPromise shared between Chain B and Chain D via Promise memoization — single Ollama call regardless of chain count
- [Phase 14-03]: Chain D non-fatal — failure returns [] and Helena responds from hybridSearch; minScore:0.6 gates law chunk injection for non-legal queries
- [Phase 14-03]: GESETZE-QUELLEN injected after ENDE QUELLEN — law context supplements document context; every Norm carries "nicht amtlich — Stand: [date] | Quelle: [url]"
- [Phase 14-gesetze-rag]: [Phase 14-02]: gesetzeSyncWorker concurrency:1 — sequential sync avoids GitHub rate limit and Ollama contention for nightly cron
- [Phase 14-gesetze-rag]: [Phase 14-02]: SHA cache saved once at end of full sync run — batch save avoids N Settings writes; failed-mid-sync Gesetze retry on next cron (idempotent)
- [Phase 15-01]: NORM_VERKNUEPFT and NORM_ENTFERNT added to AuditAktion union type for type-safe audit logging in normen routes
- [Phase 15-01]: POST validates law_chunk existence before creating AkteNorm — returns 404 if not found in DB, 409 if already pinned
- [Phase 15-01]: Search route uses LEFT(content, 300) in raw ILIKE SQL to cap payload; minimum q.length < 2 guard prevents full-table scans
- [Phase 15-02]: Chain A return type changed from Promise<string> to Promise<{ aktenKontextBlock, pinnedNormenBlock }> — pinned normen fetched inside Chain A, not a new Chain E; PINNED NORMEN injected before QUELLEN and GESETZE-QUELLEN
- [Phase 15-02]: akteNorm.findMany + Promise.all(findFirst) pattern — cannot use Prisma include JOIN with LawChunk due to Unsupported(vector(1024)) column
- [Phase 15-03]: @radix-ui/react-dialog primitive used directly (Dialog.Root/Portal/Overlay/Content) — dialog.tsx shadcn component does not exist in this project; no new package added
- [Phase 15-03]: initialNormen rendered directly from server props (no local useState) — router.refresh() re-runs server component for fresh DB data after mutations
- [Phase 16-pii-filter]: NER_TIMEOUT_MS=45_000: AbortSignal.timeout propagates uncaught — BRAO §43a compliance, no silent hasPii:false on Ollama timeout
- [Phase 16-pii-filter]: format:json + /\{[\s\S]*\}/ double defense against Qwen3 <think> token leakage in ner-filter.ts
- [Phase 16-pii-filter]: buildNerPrompt() does not slice text — caller responsible for windowing (UrteilChunk: full content; Muster: slice(0,6000)+slice(-2000) in Phase 18 processor)
- [Phase 16-02]: nerPiiQueue attempts:1 — NER timeout is permanent fail; processor resets nerStatus PENDING_NER before re-throw; Phase 18 re-submits manually
- [Phase 16-02]: Muster.name used for logging (schema has no dateiname field); plan spec was incorrect — actual field is name
- [Phase 16-02]: processUrteilNer() throws Error on PII — Phase 17 caller skips ingestion; no DB write in processor — Phase 17 sets piiFiltered:true
- [Phase 16-pii-filter]: /// <reference types="vitest/globals" /> in test file keeps vitest types scoped to tests without modifying tsconfig.json
- [Phase 16-pii-filter]: Partial-match assertion added to forbiddenInPersons check — catches LLM edge case of appending city/country qualifiers to institution names
- [Phase 17-urteile-rag]: parseAttributeValue (no trailing s) is the correct fast-xml-parser v5 X2jOptions property name — TypeScript caught the plan spec error
- [Phase 17-urteile-rag]: Array.from(guids) instead of [...guids] for Set serialization — TS target lacks downlevelIteration; identical runtime behavior
- [Phase 17-urteile-rag]: ingestUrteilItem never throws — AbortError from Ollama timeout caught, returns 'error'; processor must not mark GUID as seen on 'error' to enable retry on next cron
- [Phase 17-02]: urteileSyncQueue cron at 03:00 Europe/Berlin — one hour after gesetzeSyncJob at 02:00 to avoid simultaneous Ollama embedding calls
- [Phase 17-02]: concurrency:1 for urteile-sync Worker — sequential sync avoids GPU contention during NER gate + embedding inside ingestUrteilItem
- [Phase 17-02]: pii_rejected GUIDs ARE added to guidCache (no NER re-run); error GUIDs NOT added (retry on next cron)
- [Phase 17-03]: Chain E failure is non-fatal — catch returns [] so Helena responds without Urteile without crashing ki-chat
- [Phase 17-03]: queryEmbeddingPromise shared between Chain B, D, and Chain E — single Ollama embedding call for all three chains (urteil_chunks reuses existing embedding)

### Pending Todos

7 todos pending — 4 sind in v0.1 Roadmap aufgenommen, 3 fuer spaeter:
- RAG pipeline hybrid search (Phase 13) — in Scope
- Gesetze-RAG (Phasen 14-15) — in Scope
- Urteile-RAG (Phasen 16-17) — in Scope
- Arbeitswissen-RAG (Phase 18) — in Scope
- Falldatenblaetter — deferred to post-v0.1
- BI-Dashboard — deferred to post-v0.1
- Export CSV/XLSX — deferred to post-v0.1

### Blockers/Concerns

- Phase 13 (Reranking): Cross-encoder P95-Latenz muss BEVOR Live-Wiring benchmarked werden. Wenn P95 > 3s: erst RRF-only shippen, Reranking als Feature-Flag nachliefern.
- Phase 17 (Urteile): BMJ HTML-Selektoren (article.result, div.dokument-meta) muessen live verifiziert werden vor Scraper-Bau. robots.txt-Check erforderlich.
- Phase 16 (PII) RESOLVED: Acceptance test suite created (tests/pii/ner-filter.acceptance.test.ts). Must be run against live Ollama with qwen3.5:35b before Phase 17 ingestion begins — `npx vitest run tests/pii/ner-filter.acceptance.test.ts --timeout 60000`

## Session Continuity

Last session: 2026-02-27
Stopped at: Phase 17 Plan 03 complete. Chain E (urteilChunksPromise) + URTEILE-QUELLEN injection wired. Phase 17 fully complete. Phase 18 (Muster-RAG + Admin Upload UI) is next.
Resume file: None
