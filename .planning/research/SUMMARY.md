# Project Research Summary

**Project:** AI-Lawyer — Helena RAG Enhancement (v0.1 Milestone)
**Domain:** Legal RAG Pipeline — Hybrid Search, German Law Ingestion, NER PII Filter, Parent-Child Chunking
**Researched:** 2026-02-27
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone extends an existing ~91,300-LOC AI-Lawyer codebase with a production-grade RAG pipeline for German legal practice. The project adds hybrid search (Meilisearch BM25 + pgvector via RRF), parent-child chunking, three new knowledge sources (German federal laws from bundestag/gesetze, court decisions from BMJ Rechtsprechung-im-Internet, and kanzlei-eigene Muster), and NER-based PII filtering for DSGVO compliance. The recommended approach layers these capabilities incrementally — schema and retrieval infrastructure first, then knowledge sources one by one — so that each phase delivers an immediately verifiable improvement to Helena's answer quality.

The recommended stack requires only 5 new npm packages (`simple-git`, `rss-parser`, `cheerio`, `mammoth`, `turndown`). RRF fusion, cross-encoder reranking, parent-child chunking, PII NER, and DOCX/PDF conversion are all implemented using existing stack components (Ollama, LangChain textsplitters, pgvector, pdf-parse) with zero new services. This keeps the Docker Compose topology stable and avoids operational complexity. The biggest technical risk is Ollama reranking latency: at ~280ms per candidate with qwen3.5:35b, reranking must be capped at 10 candidates with a 2-second hard timeout. RRF alone provides 60-70% of the quality improvement and is the safe fallback if reranking proves too slow.

The non-negotiable DSGVO constraint shapes the entire phase order: NER PII filtering must be implemented and validated before any court decision or client-uploaded Muster enters the pgvector index. A missed gate here creates BRAO §43a professional secrecy liability (for Muster) and DSGVO Art. 5(1)(c) data minimization violations (for Urteile). Helena's unique competitive position — self-hosted + retrieval-grounded-only citations + ENTWURF enforcement + Normen pinned to Akte — is only defensible if these compliance gates hold.

---

## Key Findings

### Recommended Stack

The existing stack (Next.js 14, Prisma, PostgreSQL 16+pgvector, Meilisearch, BullMQ+Redis, Vercel AI SDK v4, Ollama qwen3.5:35b, multilingual-e5-large-instruct) requires minimal additions. RRF is a 15-line pure TypeScript function needing no npm package. Cross-encoder reranking uses the existing Ollama REST API. Parent-child chunking extends the already-installed `@langchain/textsplitters`. PII NER is a structured Ollama prompt. Only the three ingestion sources require new libraries.

**Core new technologies:**
- `simple-git` ^3.27.0 — incremental git pull of bundestag/gesetze into Docker volume; returns changed file list for differential re-embedding
- `rss-parser` ^3.13.0 — parse BMJ XML RSS feeds for 7 federal courts; de-facto standard, ~2M weekly downloads
- `cheerio` ^1.0.0 — server-side HTML DOM extraction from BMJ decision pages; jQuery-like, correct choice over Playwright for static HTML
- `mammoth` ^1.11.0 — DOCX to HTML for Muster upload pipeline; only reliable Node.js DOCX parser without LibreOffice sidecar
- `turndown` ^7.2.2 — HTML to Markdown after mammoth; mammoth's own Markdown output is officially deprecated

**Zero-dependency implementations (TypeScript only):**
- RRF hybrid fusion (`src/lib/search/rrf.ts`) — 15-line function, k=60, Cormack et al. 2009 validated standard
- Cross-encoder reranking (`src/lib/embedding/reranker.ts`) — Ollama `/api/generate` with structured scoring prompt, Option A: qwen3.5:35b
- Parent-child chunking — extend `src/lib/embedding/chunker.ts`: 2000-char parent / 500-char child splitters with `GERMAN_LEGAL_SEPARATORS`
- PII NER filter (`src/lib/pii/ner-filter.ts`) — regex pre-pass (email, phone, IBAN) + Ollama LLM NER for German names and addresses

### Expected Features

**Must have (table stakes — v0.1):**
- Hybrid Search RRF — exact §-number and Aktenzeichen retrieval fails with cosine-only; BM25+vector fusion is mandatory for legal text with statutory references
- Parent-Child Chunking — 500-token child for precise embedding/retrieval, 2000-token parent for full LLM context; prevents truncated §§ and Urteil sections
- Gesetze-RAG — lawyers constantly query "Was sagt § X Y?"; Helena answering from LLM training data = hallucination risk; bundestag/gesetze is public domain
- Urteile-RAG + NER PII filter — Arbeitsrecht focus requires BAG/BGH case law; NER filter is non-negotiable DSGVO blocker before any court decision is indexed
- Normen-Verknüpfung in Akte — AkteNorm model links pinned §§ to cases; concrete lawyer workflow built on Gesetze-RAG
- Arbeitswissen-RAG + Admin Upload UI — enables Schriftsatz-Entwurf; MinIO upload + muster_chunks pipeline with mandatory PII gate
- "Nicht amtlich" disclaimer and "Stand: [Datum]" on all cited norms — required by BMJV precedent and BRAK guidelines
- Source attribution on every AI claim extended to new knowledge sources (law_chunks, urteil_chunks, muster_chunks)

**Should have (add after v0.1 validation):**
- Cross-Encoder Reranking — validate German model quality first; +33-40% retrieval accuracy but adds 200-400ms latency overhead
- Schriftsatz-Entwurf (Helena Schriftsatz-Modus) — only useful after firm templates are seeded; ZPO §253 section structure with explicit placeholders
- BAG RSS incremental sync — low-effort incremental Arbeitsrecht coverage once BMJ static sync is proven
- Helena auto-suggest Normen on Akte open — UX polish; depends on Normen-Verknüpfung adoption in practice first

**Defer (v0.2+):**
- §§ Knowledge Graph / Verweisketten — separate multi-month project; not needed for core retrieval use case
- Commercial legal DB integration (juris, beck-online) — licensing cost + no public API; only if BMJ coverage proves insufficient
- Automated Sachverhalt generation — LLM hallucination rates too high for curated legal narrative; revisit when demonstrably lower

### Architecture Approach

The architecture extends the existing BullMQ + pgvector + Meilisearch stack with three parallel ingestion workers (one per knowledge source), a unified hybrid search layer with RRF fusion, and a cross-encoder reranker sitting between retrieval and prompt construction. Each knowledge type has its own Prisma table with inline `parentContent` storage to avoid JOIN round-trips at query time. The `ki-chat/route.ts` orchestrator calls `hybridSearch()` with a `scope` parameter (`akte-only | law | full`) to avoid scanning all four chunk tables on every request — critical for performance when law_chunks grows to 200k+ rows.

**Major components:**
1. `hybrid-search.ts` (NEW) — RRF merger over Meilisearch BM25 + pgvector cosine; scope-controlled fan-out across all four chunk table types; feeds reranker
2. `reranker.ts` (NEW) — Cross-encoder via Ollama with 2s per-candidate timeout; falls back to RRF order on Ollama error; hard cap at 10 candidates
3. `pii-filter/index.ts` (NEW) — Regex pre-pass + Ollama LLM NER; blocking gate before any Urteil/Muster text enters pgvector or Meilisearch
4. BullMQ processors, 3 new — `gesetze.processor.ts` (daily cron 02:00), `urteile.processor.ts` (daily cron 03:00 + on-demand), `muster.processor.ts` (triggered by admin upload)
5. `vector-store.ts` (MODIFY) — Add `insertLawChunks()`, `insertUrteilChunks()`, `insertMusterChunks()`, `searchAcross()` alongside existing unchanged methods
6. `ki-chat/route.ts` (MODIFY) — Replace `searchSimilar()` with `hybridSearch()` + `rerankWithOllama()`; extend source attribution to include `sourceType` field for all chunk types

**New Prisma tables:** `LawChunk`, `UrteilChunk`, `Muster`, `MusterChunk`, `AkteNorm`, plus `parentChunkId`/`isParent` additions to existing `DocumentChunk`.

**HNSW indexes** must be added as raw SQL in each migration file — Prisma does not create them automatically from schema. Omitting this causes full sequential scans at 10,000+ chunks.

### Critical Pitfalls

1. **RRF candidate count asymmetry** — Meilisearch default limit is 20; pgvector can return 50. Unequal pools cause one leg to dominate the merged ranking. Fetch exactly N=50 from both legs before fusion; log per-query candidate counts; alert when either leg returns fewer than 10.

2. **Cross-encoder latency explosion** — 280ms per candidate with qwen3.5:35b means 20 candidates = 5.6s, which destroys chat UX. Ollama processes requests sequentially internally — `Promise.all` does not help. Hard cap at 10 candidates, 2s timeout per candidate, fall back to RRF order on timeout. Benchmark P95 < 3s before wiring to live endpoint.

3. **Parent-child schema migration breaking existing document_chunks** — Adding nullable `parentChunkId` without a migration strategy creates a mixed state where existing rows have `NULL` parents and retrieval JOINs silently return NULL context for all pre-migration documents. Add `chunkType` enum (`STANDALONE | PARENT | CHILD`), SET existing rows to `STANDALONE` in the migration, gate retrieval logic on `chunkType`.

4. **bundestag/gesetze encoding bugs + Markdown repo staleness** — The GitHub Markdown repo lags behind gesetze-im-internet.de XML. BMJV XMLs may declare `encoding="iso-8859-1"` while bytes are actually UTF-8, causing `§` to appear as `Â§`. Use the BMJV XML feed directly, force UTF-8 decoding, run encoding smoke test (`SELECT content LIKE '%§%' LIMIT 1`) as first ingestion step.

5. **Ollama NER PII filter — false positives remove institution names** — General-purpose NER prompts redact "Bundesgerichtshof," "Amtsgericht Köln" because the model cannot distinguish `INSTITUTION` from `PERSON` without guidance. Mandate 5+ few-shot German legal examples in the system prompt; post-process with whitelist regex for known German court name patterns.

6. **pgvector HNSW index missing on new chunk tables** — Prisma does not auto-create HNSW indexes. Without them every vector query is a full sequential scan. At 10,000+ law chunks, queries go from 10ms to >30s. Add `CREATE INDEX CONCURRENTLY ... USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)` as raw SQL in every migration that adds an `embedding` column. Verify with `EXPLAIN ANALYZE`.

7. **Muster PII gate bypass creating permanent BRAO §43a violation** — If async NER crashes silently, unredacted client data stays indexed permanently. Implement explicit status machine: `PENDING_NER → NER_RUNNING → NER_COMPLETE → INDEXED | REJECTED_PII_DETECTED`. Indexing to pgvector/Meilisearch ONLY happens at the `INDEXED` state transition — no bypass code path.

---

## Implications for Roadmap

Based on combined research, an 8-phase build order is recommended, driven by schema-first dependencies, the DSGVO compliance gate sequence, and the hybrid search infrastructure-before-knowledge-sources principle.

### Phase 1: Schema Foundation
**Rationale:** Every downstream phase writes to database tables that must exist before any code can be tested end-to-end. This migration is additive-only and safe — no existing data is affected.
**Delivers:** New Prisma models (LawChunk, UrteilChunk, Muster, MusterChunk, AkteNorm); `parentChunkId`/`chunkType` enum on DocumentChunk; HNSW indexes for all new embedding columns as raw SQL in migration.
**Addresses:** Foundation for all subsequent phases; Normen-Verknüpfung data model; parent-child structure for all 4 chunk types
**Avoids:** Parent-child migration breaking existing document_chunks (Pitfall 3); missing HNSW indexes causing sequential scans (Pitfall 6)

### Phase 2: Parent-Child Chunker + Vector Store Extensions
**Rationale:** Shared infrastructure consumed by all three ingestion sources. Must exist before any processor can write parent-child chunk pairs. Existing `chunkDocument()` and `searchSimilar()` remain unchanged.
**Delivers:** `createParentChildChunks()` in chunker.ts; `insertLawChunks()`, `insertUrteilChunks()`, `insertMusterChunks()` in vector-store.ts; skeleton hybrid-search.ts (vector-only path first).
**Addresses:** Parent-child chunking (table stakes); highest ROI improvement for existing document RAG
**Avoids:** Embedding large parent chunks in pgvector — multilingual-e5 max is 512 tokens; only child chunks (~500 tokens) are embedded

### Phase 3: Hybrid Search + Reranking
**Rationale:** Improves existing document RAG immediately, even before new knowledge sources are seeded. Validates the full retrieval-reranking-prompt pipeline against familiar data volume before bulk Gesetze ingestion adds 100k+ chunks.
**Delivers:** Complete `hybrid-search.ts` (RRF with k=60, both retrieval paths, scope parameter); `reranker.ts` (Ollama cross-encoder, 2s timeout, RRF fallback); modified `ki-chat/route.ts` using hybridSearch + rerankWithOllama.
**Addresses:** Hybrid Search RRF (table stakes P1); Cross-Encoder Reranking (P2 baseline)
**Avoids:** RRF candidate count asymmetry (Pitfall 1); cross-encoder latency explosion (Pitfall 2)
**Research flag:** Benchmark reranking P95 latency with realistic GPU load BEFORE wiring to live chat endpoint. If P95 > 3s, ship RRF-only first and add reranking as a feature-flagged follow-on.

### Phase 4: Gesetze-RAG
**Rationale:** Simplest ingestion source — public domain, no PII, Markdown format already confirmed. Validates the full end-to-end ingestion pipeline (sync → parse → chunk → embed → pgvector → Meilisearch → ki-chat) before introducing the complexity of Urteile scraping.
**Delivers:** `gesetze/github-sync.ts` (simple-git pull into Docker volume), `gesetze/parser.ts` (Markdown to structured chunks), `gesetze.processor.ts`, daily BullMQ cron at 02:00 Europe/Berlin, law_chunks populated, Meilisearch gesetze index.
**Addresses:** Gesetze-RAG (table stakes P1); prerequisite for Normen-Verknüpfung
**Avoids:** bundestag/gesetze encoding bugs (Pitfall 4) — force UTF-8 decode, run encoding smoke test as task 1; do not clone full git history into Docker image

### Phase 5: PII Filter
**Rationale:** Blocking prerequisite for both Urteile-RAG and Muster-RAG. Implementing and acceptance-testing the PII gate as a standalone phase before the processors that depend on it ensures compliance quality is verified in isolation before DSGVO liability is at stake.
**Delivers:** `pii-filter/index.ts` — regex pre-pass (email/phone/IBAN) + Ollama LLM NER with 5+ few-shot German legal examples + institution whitelist regex post-processing. Acceptance test: 10 known court decisions, 0 institution names redacted, 0 full person names surviving.
**Addresses:** DSGVO Art. 5(1)(c) data minimization; prerequisite compliance gate for Phases 6 and 7
**Avoids:** Ollama NER false positives removing court institution names (Pitfall 5); NER timeout holding BullMQ worker slot (set `timeout: 60000` on job + `AbortSignal` 45s on Ollama fetch)

### Phase 6: Urteile-RAG
**Rationale:** Most complex ingestion source — HTTP scraping with rate limits, HTML structure fragility, and mandatory PII gate. Phase 5 PII filter must pass acceptance test before this phase begins. Raw HTML cached to MinIO enables NER re-runs without re-scraping.
**Delivers:** `urteile/bmj-scraper.ts` (1 req/2s rate limit, raw HTML to MinIO `raw-urteile/`), `urteile/bag-rss.ts` (rss-parser, follows entry URLs), `urteile.processor.ts` (PII filter + embed pipeline), daily cron at 03:00 for all 7 BMJ courts, urteil_chunks populated, Meilisearch urteile index.
**Addresses:** Urteile-RAG + NER PII filter (table stakes P1); BAG RSS incremental sync (P2 add-on)
**Avoids:** BMJ rate limiting + HTML fragility (Pitfall, add schema validation step per page); DSGVO exposure from unredacted court decisions; Helena hallucinating Aktenzeichen (store `citation` metadata at index time, verify post-generation)
**Research flag:** BMJ HTML structure (`article.result`, `div.dokument-meta` selectors) needs live verification before building scraper. Schema validation assertion is required, not optional.

### Phase 7: Muster-RAG + Admin Upload UI
**Rationale:** User-facing admin feature requiring both a working PII gate (Phase 5) and a status machine to prevent bypass. The MinIO-first async pattern already exists in the codebase (OCR jobs) and maps cleanly to this feature.
**Delivers:** `muster/uploader.ts`, `muster.processor.ts` (PII filter + DOCX/PDF conversion + embed), `/api/admin/muster/route.ts` (multipart upload), `admin/muster/page.tsx` (shadcn/ui file table with NER status column: PENDING / NER_RUNNING / INDEXED / REJECTED), muster_chunks populated, Meilisearch muster index.
**Addresses:** Arbeitswissen-RAG + Admin Upload UI (table stakes P1); prerequisite for Schriftsatz-Entwurf (P2)
**Avoids:** Muster PII gate bypass creating BRAO §43a violation (Pitfall 7); synchronous PII filter in upload API route causing timeout (async BullMQ job pattern)

### Phase 8: Normen-Verknüpfung in Akte
**Rationale:** UI integration layer requiring seeded law_chunks (Phase 4) and the Akte-Normen API. By this phase all data sources are live. Pinned norms inject per-Akte grounding context into Helena, preventing retrieval of irrelevant norms from other Rechtsgebiete.
**Delivers:** `/api/akten/[id]/normen/route.ts` (GET/POST/DELETE AkteNorm records), NormenCard component in Akte detail sidebar (norm search modal over law_chunks → one-click add), AI scan processor extension auto-extracting § citations from documents, pinned norms injected into Helena system context per Akte.
**Addresses:** Normen-Verknüpfung in Akte (table stakes P1); Helena auto-suggest Normen (P2 follow-on after adoption)
**Avoids:** Helena Aktenzeichen hallucination — post-generation AZ regex verification against `urteil_chunks.citation` metadata field on every Helena response containing an Urteil citation

### Phase Ordering Rationale

- Schema-first prevents breaking changes on existing tables during active development; additive-only migration is safe
- Hybrid search (Phase 3) before knowledge source ingestion validates the full pipeline at manageable data volume; if retrieval is broken, it is cheaper to diagnose with existing document_chunks than with 200k law_chunks
- PII filter (Phase 5) as a dedicated standalone phase before Urteile (Phase 6) ensures the compliance gate is empirically tested, not rushed as a sub-task inside a processor
- Gesetze before Urteile: no PII complexity validates the full ingestion pattern first; also required as prerequisite for Normen-Verknüpfung
- Muster last among data sources because it requires both the PII filter (Phase 5) and a user-facing admin UI — most dependencies; placing it here keeps earlier phases unblocked

### Research Flags

Phases needing deeper research during planning:

- **Phase 3 (Hybrid Search + Reranking):** Cross-encoder reranking latency is hardware-dependent. Benchmark before production wiring. If P95 > 3s, consider ONNX `BAAI/bge-reranker-v2-m3` via `@xenova/transformers` at ~80ms/doc CPU-side as fallback. Also validate `scope` parameter logic — what query signals should trigger `"full"` vs `"akte-only"` scope in `ki-chat/route.ts`.
- **Phase 5 (PII Filter):** German legal NER quality of qwen3.5:35b needs empirical validation on real court decisions from the firm's Rechtsgebiete (Arbeitsrecht, Mietrecht). Few-shot examples must come from actual BAG/BGH decisions, not synthesized examples.
- **Phase 6 (Urteile-RAG):** BMJ HTML structure is undocumented and may change without notice. Live verification of CSS selectors required before building the scraper. Also verify: does rechtsprechung-im-internet.de robots.txt permit crawling at 1 req/2s?

Phases with standard patterns (skip additional research):

- **Phase 1 (Schema):** Standard Prisma migration + raw SQL HNSW index — well-documented pattern, matches existing codebase convention
- **Phase 2 (Chunker):** LangChain RecursiveCharacterTextSplitter extension — established pattern with official docs; parent-child sizes (2000/500 chars) validated by multiple sources
- **Phase 4 (Gesetze-RAG):** bundestag/gesetze repo format confirmed (Markdown via direct inspection), simple-git pull pattern is straightforward
- **Phase 7 (Admin UI):** Standard shadcn/ui file upload + data table + BullMQ async processing — mirrors existing OCR upload pattern in the codebase
- **Phase 8 (Normen UI):** Standard CRUD API + React component — no novel patterns; NormenCard is a standard Akte sidebar extension

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All 5 new npm packages version-verified on npmjs.com. Zero-dependency implementations (RRF, reranker, PII NER) are well-documented with multiple corroborating sources. One exception: Qwen3-Reranker-4B Option B availability in current Ollama version is LOW confidence — stick with Option A (qwen3.5:35b LLM-as-reranker). |
| Features | MEDIUM-HIGH | RAG pipeline patterns HIGH from multiple authoritative sources. German legal UX citation standards MEDIUM from citation guides and live court case evidence (Frankfurt Sept 2025). Cross-encoder model availability for German text is LOW — needs empirical validation before Phase 3 ships. |
| Architecture | HIGH | Based on direct codebase inspection of existing files. All integration points verified against existing code conventions (BullMQ registration pattern, Prisma migration style, Ollama REST usage). HNSW index parameters (m=16, ef_construction=64) verified via pgvector official docs. |
| Pitfalls | MEDIUM-HIGH | Stack-specific pitfalls from verified sources. BMJ HTML structure specifics (Pitfall for Phase 6) are LOW confidence — training data only, requires live verification. Ollama NER quality on German legal text is MEDIUM — one case study found, legal specifics are extrapolation from general German NER performance. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Cross-encoder latency on production GPU:** The 280ms/candidate figure is a community benchmark, not from this specific hardware. Benchmark before Phase 3 wires to live chat. If unacceptable, ship RRF-only first.
- **BMJ HTML selector stability:** The `article.result` / `div.dokument-meta` selectors need live verification on rechtsprechung-im-internet.de before Phase 6 development begins. Add schema validation step as a hard requirement — not optional defensive code.
- **multilingual-e5 quality on German legal abbreviations:** `iVm`, `aF`, `nF`, `idF` are common in legal text and may degrade semantic retrieval quality. Evaluate abbreviation expansion pre-processing (`iVm` → `in Verbindung mit`) on a 50-query benchmark before bulk Gesetze ingestion in Phase 4.
- **Qwen3-Reranker-4B (Option B) availability:** Depends on current Ollama version. Do not block Phase 3 on this — Option A is validated. Evaluate Option B only after Option A is stable.
- **DSGVO Verarbeitungsverzeichnis entry:** NER PII filter must be documented as a technical-organizational measure before Urteile-RAG goes live in Phase 6. This is a process gap, not a code gap — assign to a separate non-development task.

---

## Sources

### Primary (HIGH confidence)
- bundestag/gesetze repo format: https://github.com/bundestag/gesetze — Markdown format confirmed by direct inspection
- BMJ RSS feed URLs: https://www.rechtsprechung-im-internet.de — all 7 court feed URLs confirmed from official BMJ documentation
- pgvector HNSW index parameters: https://github.com/pgvector/pgvector — m=16, ef_construction=64 for datasets under 1M rows
- RRF algorithm k=60: Cormack, Clarke & Buettcher (2009) — validated via Elasticsearch, Azure AI Search, and OpenSearch defaults
- npm packages: simple-git@3.27.0, rss-parser@3.13.0, cheerio@1.0.0, mammoth@1.11.0, turndown@7.2.2 — all version-verified on npmjs.com
- Mammoth Markdown deprecation: https://github.com/mwilliamson/mammoth.js README — explicit deprecation notice
- AI hallucination liability in German courts: https://www.jura.cc/rechtstipps/ki-fehlzitate-vor-gericht (Frankfurt court Sept 2025 case)
- Germany regional court AI expert report inadmissible: https://www.loc.gov/item/global-legal-monitor/2026-02-04/germany-regional-court-rules-ai-generated-expert-report-inadmissible

### Secondary (MEDIUM confidence)
- RRF for legal hybrid search (87% top-10 relevance): ragaboutit.com 2025 — multiple corroborating sources
- Parent-child chunk sizes (400-512 child, 1500-2000 parent): databricks.com community blog, unstructured.io chunking guide, medium.com/seahorse-technologies
- Cross-encoder +33-40% accuracy gain: ailog.fr, ragaboutit.com, zeroentropy.dev — consistent across multiple sources
- Ollama Qwen3 reranking: https://www.glukhov.org/post/2025/06/qwen3-embedding-qwen3-reranker-on-ollama/ — Go examples but REST API is identical
- Local LLM NER for German text: https://drezil.de/Writing/ner4all-case-study.html — German legal specifics are extrapolation from general German NER
- NJW citation standard: Wikipedia German legal citation + Harvard Law Library guide
- Legal RAG patterns: Harvard JOLT, datategy.net 2025

### Tertiary (LOW confidence)
- BMJ HTML structure (CSS selectors `article.result`, `div.dokument-meta`) — training data only; live verification required before Phase 6 development begins
- Qwen3-Reranker-4B Ollama availability as dedicated reranker model — one 2025 article; needs verification against current Ollama version in production

---

*Research completed: 2026-02-27*
*Ready for roadmap: yes*
