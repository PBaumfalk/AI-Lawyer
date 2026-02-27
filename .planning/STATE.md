---
gsd_state_version: 1.0
milestone: v3.4
milestone_name: Helena RAG
status: unknown
last_updated: "2026-02-27T00:26:49.571Z"
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 14
  completed_plans: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollstaendig im Browser verwalten, waehrend eine proaktive KI-Agentin aktenuebergreifend lernt, automatisch Entwuerfe erstellt, Fristen erkennt und als digitale Rechtsanwaltsfachangestellte mitarbeitet.
**Current focus:** v0.1 Helena RAG — Phase 14 (Gesetze-RAG) — Plan 01 complete

## Current Position

Phase: 14 of 18 (Gesetze-RAG) — IN PROGRESS
Plan: 1 of 3 complete
Status: Phase 14 Plan 01 complete — Plan 02 (gesetze-sync cron processor) next
Last activity: 2026-02-27 — Phase 14 Plan 01 complete: GitHub API client, Markdown parser, law_chunks ingestion/search library

Progress: [██░░░░░░░░] ~10%

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
| 14. Gesetze-RAG | 1/3 | ~2m | 2m |
| 15. Normen-Verknüpfung in Akte | 0/TBD | - | - |
| 16. PII-Filter | 0/TBD | - | - |
| 17. Urteile-RAG | 0/TBD | - | - |
| 18. Muster-RAG + Admin Upload UI | 0/TBD | - | - |

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
- Phase 16 (PII): qwen3.5:35b NER-Qualitaet auf echten deutschen Gerichtsentscheidungen (BAG/BGH Arbeitsrecht + Mietrecht) muss empirisch validiert werden — Few-Shot-Beispiele aus echten Urteilen, nicht synthetisch.

## Session Continuity

Last session: 2026-02-27
Stopped at: Phase 14 Plan 01 complete. Phase 14 Plan 02 (gesetze-sync cron processor) is next.
Resume file: None
