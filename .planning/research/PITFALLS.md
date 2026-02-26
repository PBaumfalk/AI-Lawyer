# Pitfalls Research

**Domain:** Legal RAG Addition — Hybrid Search, German Law Ingestion, NER PII Filter, Parent-Child Chunking added to existing AI-Lawyer (Node.js/Prisma/Meilisearch/pgvector/Ollama/BullMQ)
**Researched:** 2026-02-26
**Confidence:** MEDIUM-HIGH (stack-specific pitfalls from verified sources; BMJ scraping HTML specifics LOW from training data only)

> This file covers pitfalls specific to the v0.1 Helena RAG milestone. For general Kanzleisoftware pitfalls (IMAP, WOPI, RVG, Fristen, etc.) see git history of this file (2026-02-24 version).

---

## Critical Pitfalls

### Pitfall 1: RRF Candidate Count Asymmetry — BM25 Drowning Vector Results

**What goes wrong:**
Meilisearch returns 20 results by default. pgvector returns however many you ask for (e.g., 50). When these two unequal pools are merged with RRF (`1/(k + rank)` where k=60), the leg with more candidates dominates the fused ranking because there are simply more ranked positions to contribute scores from. German legal text makes this worse: Gesetze chunks contain highly repetitive statutory boilerplate ("gemäß § X Absatz Y") that inflates BM25 term-frequency scores. BM25 will surface the most-mentioned-paragraph, not the most legally relevant one.

**Why it happens:**
Developers implement RRF from the formula without auditing whether both retrieval legs produce equal candidate counts. The Meilisearch API default limit of 20 is never changed because the existing Meilisearch integration "works fine" for the current full-text search feature.

**How to avoid:**
- Retrieve exactly N candidates from both legs before fusion (e.g., top-50 from Meilisearch with `limit: 50`, top-50 from pgvector with `LIMIT 50`).
- Implement RRF as a single PostgreSQL CTE, not as application-layer merging of two separate DB round-trips. This avoids the N+1 round-trip problem and keeps fusion atomic.
- Use `k=60` (empirically validated across literature). Do not tune per-query — it generalizes poorly.
- Log per-query: candidate count from each leg. Alert (Slack/email) when one leg returns fewer than 10 results.

**Warning signs:**
- Helena retrieves only Gesetze paragraphs for questions where client Akte documents should rank first.
- Vector search returning 0 results for queries with clear semantic matches — pgvector HNSW index not built on new tables.
- RRF result position 1 always matches BM25 position 1 regardless of semantic content — candidate count mismatch.

**Phase to address:** Phase 1 (Hybrid Search implementation). Write a 20-query gold-standard test set (mix of Akte questions + legal norm questions) and measure MRR before shipping.

---

### Pitfall 2: Cross-Encoder Latency Explosion — 280ms × N Candidates = Unusable

**What goes wrong:**
Calling Ollama for cross-encoder reranking on each candidate document individually results in sequential inference calls. At ~280ms per call (Qwen3-Reranker-4B on local GPU), reranking 20 candidates takes 5.6 seconds. `Promise.all` parallelization does not help: Ollama processes one request at a time internally, so parallel requests queue and produce the same wall-clock time while consuming more GPU memory. For a chat interface, >3s total latency kills the UX.

**Why it happens:**
Reranking benchmarks report throughput (documents/sec) measured in batch, not end-to-end chat latency measured per user request. Developers copy benchmark numbers without accounting for Ollama's single-request concurrency model.

**How to avoid:**
- Cap cross-encoder input at 10 candidates (not 20 or 50). Worst case: 2.8s, which is borderline acceptable with streaming.
- Implement a time budget: if cross-encoder does not complete within 2 seconds, fall back to RRF ordering and begin streaming the LLM response immediately.
- Consider ONNX-exported reranker (`BAAI/bge-reranker-v2-m3`) run via `@xenova/transformers` in the BullMQ worker — CPU-side at ~80ms/doc, no Ollama overhead.
- Stream LLM response tokens while reranking runs in background (decouple retrieval from generation in the pipeline architecture).

**Warning signs:**
- Helena chat response time consistently >3s for legal questions with many matching chunks.
- BullMQ queue depth growing — upstream reranking jobs not completing before the next request arrives.
- Ollama GPU memory at 100% when 2+ users query simultaneously — sequential queuing with high per-call memory.

**Phase to address:** Phase 1 (Hybrid Search + Reranking). Benchmark latency with realistic candidate counts BEFORE integrating into the live chat endpoint. Set a hard threshold: P95 latency < 3s.

---

### Pitfall 3: Parent-Child Schema Migration Breaking Existing `document_chunks`

**What goes wrong:**
The existing `document_chunks` table (from v3.4 RAG pipeline) stores flat paragraph chunks. Adding parent-child hierarchy by naively adding a nullable `parentChunkId` FK without a migration strategy for existing rows produces a mixed state: old chunks have `parentChunkId = NULL`, new chunks have populated FKs. The retrieval layer now assumes children always have a parent. Queries that JOIN to parent to get 2000-token context return NULL for all existing chunks. Result: Akte document search regresses for all pre-migration documents.

**Why it happens:**
Prisma schema changes are treated as additive ("just add a nullable field — existing data is fine"). The impact on the retrieval query logic is not considered until after deployment.

**How to avoid:**
- Add a `chunkType` enum to `document_chunks`: `STANDALONE | PARENT | CHILD`. Write a Prisma migration that sets `chunkType = STANDALONE` for ALL existing rows BEFORE deploying new ingestion code.
- Retrieval logic gates on `chunkType`: embed and search child chunks; fetch parent chunks to send to LLM. For `STANDALONE` chunks, content is both the embedding source and the LLM context.
- Use `onDelete: SetNull` on the `parentChunkId` FK — never `Cascade` toward parents. Orphaned children become `STANDALONE` automatically, not deleted silently.
- Verify migration: `SELECT COUNT(*) FROM document_chunks WHERE "chunkType" IS NULL` must return 0 after deploy.
- Re-ingestion of existing documents should be a separate, optional BullMQ job — not forced on deploy.

**Warning signs:**
- Helena returns 500-token child chunks instead of 2000-token parent context — retrieval layer fetching children directly.
- Retrieval quality drops immediately after migration deploy — mixed chunkType state.
- Prisma migration fails with FK constraint violation during re-ingestion of existing documents — parent inserted after child.

**Phase to address:** Phase 1 (Parent-Child Chunking). Schema migration must be a separate PR from retrieval logic changes. Deploy migration → verify data → deploy retrieval changes.

---

### Pitfall 4: bundestag/gesetze — Markdown Repo is Derived, Not Authoritative; Encoding Bugs

**What goes wrong:**
The `bundestag/gesetze` GitHub repo stores laws as Markdown files converted from upstream BMJV XML. Two critical failure modes: (1) Developers clone the Markdown repo and treat it as authoritative, missing that it is a derived artifact from `gesetze-im-internet.de` XML and may lag weeks behind legal changes. (2) Full `git clone` of the repo (thousands of laws, full history) causes Docker build OOM kills. A third failure: XML text nodes from `gesetze-im-internet.de` are UTF-8 but if the XML parser defaults to Latin-1 or double-encodes, `§` (U+00A7) appears as `Â§` in the database.

**Why it happens:**
The GitHub repo looks like a convenient data source. Developers read the README, see "Bundesgesetze und -verordnungen," and proceed to `git clone`. The encoding issue happens because Node.js XML parsers default to UTF-8 but some BMJV XMLs declare `encoding="iso-8859-1"` in the XML prolog — the actual bytes are UTF-8 but the declaration says otherwise, causing parsers to mishandle it.

**How to avoid:**
- Do NOT clone the bundestag/gesetze Markdown repo in production. Use the BMJV XML feed directly: `https://www.gesetze-im-internet.de/Teilliste_mit_Aenderungen.xml` gives a table of all laws with last-modified dates. Fetch only changed law XMLs via `https://www.gesetze-im-internet.de/{abbreviation}/xml.zip`.
- Parse XML using `fast-xml-parser` with `htmlEntities: true` and `ignoreAttributes: false` to capture `<norm builddate="">` metadata.
- Force UTF-8 decoding regardless of XML prolog declaration: `Buffer.from(responseBuffer).toString('utf8')` before feeding to XML parser.
- Encoding smoke test as the first step in the ingestion pipeline: `SELECT content FROM law_chunks WHERE content LIKE '%§%' LIMIT 1` must return actual `§`, not `Â§` or `?`.
- Store the BMJV last-modified date per law in `law_chunks.lastModified` for idempotent daily sync.

**Warning signs:**
- `§` appearing as `Â§` or `?` in `law_chunks.content` — encoding bug.
- Law version returned by Helena is from 2020 for a law that was amended in 2024 — repo lag.
- Docker build OOM when running `git clone bundestag/gesetze` in Dockerfile — use HTTP fetch per law instead.
- `fast-xml-parser` throwing on BMJV XML — check if XMLs use HTML entities inside XML text nodes.

**Phase to address:** Phase 2 (Gesetze-RAG ingestion). Encoding smoke test must be task 1. Daily sync via BullMQ cron, not git pull.

---

### Pitfall 5: BMJ Rechtsprechung Scraping — Rate Limiting, HTML Fragility, and DSGVO Exposure

**What goes wrong:**
`rechtsprechung-im-internet.de` (operated by the BMJ) allows crawling per robots.txt but has no published rate limit. Aggressive parallel fetching causes IP-level blocks within minutes of starting a bulk ingestion. HTML structure changes without versioned API — CSS selectors used for extraction break silently, producing empty or malformed `urteil_chunks`. Most critically: court decisions contain names of natural persons (Kläger, Beklagter) that courts anonymize inconsistently. Re-publishing identified persons in the RAG index creates DSGVO Article 5(1)(c) data minimization liability — even though the decisions are technically "public."

**Why it happens:**
Government legal databases are treated as freely scrapable because the content is public law. Developers assume court decisions are fully anonymized by courts (they are not — lower courts especially leave names in). DSGVO liability for re-processing public personal data is not widely understood.

**How to avoid:**
- Rate limit to 1 request per 2 seconds with exponential backoff on 429/503. Implement as BullMQ job delay, not `setTimeout` in a loop.
- Cache fetched HTML in MinIO before any processing — allows re-running NER with an improved prompt without re-scraping.
- Parse court decision metadata (Gericht, Datum, Aktenzeichen, ECLI) from `<meta>` tags in the HTML `<head>`, not from body text — meta tags are structurally stable.
- Run NER PII filter (see Pitfall 6) as a REQUIRED step before any text enters `urteil_chunks`. Raw HTML must never be directly indexed.
- Add a schema validation step: assert that expected HTML elements (`article.result`, `div.dokument-meta`) exist in each fetched page. If not, log and skip — do not silently produce empty chunks.
- Set `User-Agent: AI-Lawyer/1.0 Kanzlei-Baumfalk (+contact@kanzlei-baumfalk.de)` on all scraping requests.

**Warning signs:**
- HTTP 429 responses appearing in BullMQ job logs during bulk ingestion.
- Court decisions with full names (e.g., "Familie Baumfalk" or "Johann M.") appearing in Helena's cited context — PII filter not running.
- Ingestion producing chunks with only whitespace or HTML artifacts — HTML structure changed, selectors broken.

**Phase to address:** Phase 3 (Urteile-RAG ingestion). DSGVO compliance gate (NER PII filter) must be implemented and tested before any court decision reaches `urteil_chunks`.

---

### Pitfall 6: Ollama NER PII Filter — False Positives Remove Legal Institutions, False Negatives Leak Names

**What goes wrong:**
Prompting a general-purpose LLM for NER on German court decisions produces two simultaneous failure modes: (1) False positives — the model redacts institution names ("der Bundesgerichtshof," "die BaFin," "das Amtsgericht Dortmund") because the prompt does not distinguish `INSTITUTION` from `PERSON`. Result: Helena cites "laut [REDACTED] Urteil vom..." — legally useless. (2) False negatives — hyphenated surnames ("Müller-Schmidt"), abbreviated names ("J.M."), names embedded in compound legal terms ("Beklagten-Partei Frau X") survive unredacted. Both failures are dangerous: false positives destroy citation quality; false negatives create DSGVO liability.

**Why it happens:**
NER prompts are typically written for English text using CoNLL-2003 entity categories (PER, ORG, LOC, MISC). German legal text has a rich taxonomy of institutional entities that must not be redacted. Without few-shot examples from German court decisions, the model has no basis to distinguish "Amtsgericht Köln" (court, do not redact) from "Frau Köhler" (person, redact).

**How to avoid:**
- Define explicit categories in the NER prompt: only redact `NATÜRLICHE_PERSON`. Explicitly exclude `GERICHT`, `BEHÖRDE`, `JURISTISCHE_PERSON`, `ANWALT_KANZLEI`, `PARTEI_BEZEICHNUNG` (e.g., "die Klägerin" without a name is fine).
- Include at least 5 few-shot examples in the system prompt, taken from real German court decision formatting.
- Post-process: after LLM NER, apply a whitelist regex that un-redacts known German court name patterns:
  - `/(Bundesgerichtshof|Oberlandesgericht\s+\w+|Landgericht\s+\w+|Amtsgericht\s+\w+)/g`
- Run NER as a BullMQ job (async). Store both the raw text AND the NER-filtered text in separate MinIO objects — allows re-running NER with an improved prompt without re-scraping.
- Set BullMQ job `timeout: 60000` AND `AbortSignal` with 45s on the Ollama fetch call. Without this, a stalled qwen3.5:35b NER call on a long court decision (>5000 tokens) holds a worker slot indefinitely.
- Acceptance test: run NER on 10 known court decisions. Verify: zero institution names redacted, zero full person names surviving.

**Warning signs:**
- "[REDACTED]" appearing in court names in Helena's cited sources — institution whitelist missing.
- Full person names in `urteil_chunks.content` — NER not catching all patterns.
- BullMQ NER jobs timing out — Ollama stalling on long documents, no timeout set.
- NER jobs consuming 100% of one BullMQ worker slot for 10+ minutes — blocking other jobs.

**Phase to address:** Phase 3 (Urteile-RAG ingestion). NER is a blocking gate — no court decision enters `urteil_chunks` without passing NER.

---

### Pitfall 7: Kanzlei-Muster Upload — Unredacted Client Data Permanently in RAG Index

**What goes wrong:**
A staff member uploads a real Schriftsatz (e.g., a filed brief for Mandant Müller) as a Muster template. It contains real client names, addresses, case details, and IBAN. The MinIO upload succeeds immediately; the UI shows "Hochgeladen." If PII filtering is async and not a hard gate on indexing, the document lands in `muster_chunks` before NER completes. If the NER BullMQ job crashes silently (worker OOM, Ollama timeout), the unredacted document remains indexed permanently — a BRAO §43a Abs. 2 (Verschwiegenheitspflicht) violation.

**Why it happens:**
Developers wire up: upload to MinIO → enqueue NER job → job indexes to pgvector. The gap is that the indexing step happens inside the NER job — but if the job crashes after indexing and before marking completion, or if another code path indexes on upload, the gate is bypassed.

**How to avoid:**
- Explicit status machine per Muster document: `PENDING_NER → NER_RUNNING → NER_COMPLETE → INDEXED | NER_FAILED | REJECTED_PII_DETECTED`.
- The database record is created with status `PENDING_NER` on upload. Indexing to pgvector and Meilisearch ONLY happens in the state transition to `INDEXED`. No other code path inserts to `muster_chunks`.
- If NER detects high-confidence PII (IBAN regex + full name + address in same document), set `REJECTED_PII_DETECTED` and notify the uploading admin via Socket.IO. Do NOT silently discard — the admin needs to know their upload was rejected.
- Placeholder normalization: before indexing, run a regex pass to normalize Muster placeholders to a canonical form (`{{Mandant.Name}}`). Inconsistent placeholder formats (`{Mandant_Name}`, `[Mandant]`, `<<Mandant>>`) cause Helena to match on placeholder text instead of legal content.
- Never-in-Git: add a pre-commit hook rejecting DOCX/PDF files committed to the repository. Muster files live exclusively in MinIO.

**Warning signs:**
- Admin uploads a DOCX and the UI shows "Indexiert" within 1 second — NER has not run (async job didn't fire or was bypassed).
- Real client names appearing in Helena's Schriftsatz drafts from supposedly anonymized Muster.
- `SELECT content FROM muster_chunks WHERE content LIKE '%IBAN%'` returns rows — IBAN in indexed content.
- Admin UI showing only "Hochgeladen" status with no NER progress indicator — status machine not implemented.

**Phase to address:** Phase 4 (Arbeitswissen-RAG / Muster Upload). Admin UI must expose NER status, not just upload status. DSGVO compliance audit before shipping.

---

### Pitfall 8: Helena Hallucinating Aktenzeichen Despite Real Citations in Context

**What goes wrong:**
Helena receives a real court decision as context (e.g., "BGH, Urteil vom 14.03.2023, Az. XII ZR 45/22") but generates a citation with a plausible-but-wrong Aktenzeichen ("Az. XII ZR 45/23" — year off by one, or "OLG Düsseldorf statt BGH"). German Aktenzeichen have structured formats (Roman numeral division, case type abbreviation, sequential number, year) that LLMs mimic from training data rather than copying verbatim from context. A hallucinated AZ is legally dangerous: it cannot be verified on juris or beck-online, makes the brief look unprofessional, and potentially cites a different case.

**Why it happens:**
LLMs interpolate between statistical patterns, not copy-paste from context. Chunking that splits the AZ header from the Leitsatz body means the AZ may not appear in the retrieved chunk at all, forcing the model to generate one from memory.

**How to avoid:**
- Extract Aktenzeichen at indexing time using regex and store in structured `citation` metadata on `urteil_chunks`: `/[A-Z][a-z]?\s+\d+\/\d{2}/` plus common prefixes (`Az.`, `Aktenzeichen`).
- System prompt instruction: "Zitiere ausschließlich Aktenzeichen, die wörtlich in den bereitgestellten Kontextblöcken erscheinen. Erfinde keine Aktenzeichen."
- Post-process Helena output: extract AZ patterns from generated text with regex, verify each against `urteil_chunks.citation` metadata of the retrieved chunks. Flag mismatches in the UI ("Quellennachweis konnte nicht verifiziert werden").
- Chunking rule: never split at the metadata block of a court decision. Keep Gericht + Datum + AZ + ECLI + first 200 tokens of Leitsatz in a single chunk (even if it exceeds normal chunk size).
- Automatic "nicht amtliche Leitsätze" disclaimer on all Helena Urteil summaries (BRAK requirement).

**Warning signs:**
- AZ in Helena output does not match any `urteil_chunks.citation` field for the retrieved chunks — hallucination detected.
- Missing "nicht amtlich" label on Helena Urteil summaries in the UI.
- Users reporting citations that return no results on external legal databases.

**Phase to address:** All RAG phases. Citation integrity must be built into the retrieval prompt template and post-processing pipeline from the first Urteil-RAG task.

---

### Pitfall 9: multilingual-e5 Embedding Quality Degradation for Formal German Legal Language

**What goes wrong:**
`multilingual-e5-large` was trained on Common Crawl and Wikipedia — not on formal German legal text. It handles conversational German well but struggles with: (1) archaic legal phrasing ("gemäß § 823 Abs. 1 BGB iVm § 31 BGB"), (2) unexpanded legal abbreviations ("iVm," "aF," "nF," "idF," "BVerwGE"), (3) Latin legal maxims common in German law ("exceptio doli," "in dubio pro reo"). Semantic search returns poor results: "Schadensersatz" and "Schmerzensgeld" treated as unrelated; "Kündigung" matches employment AND rental law equally with no domain signal.

**Why it happens:**
Developers pick the highest-quality available multilingual embedding model without benchmarking on the actual domain. Legal German is a specialized sublanguage that deviates significantly from the web text the model was trained on.

**How to avoid:**
- Abbreviation expansion pre-processing: before embedding, normalize common German legal abbreviations. Examples: "iVm" → "in Verbindung mit," "aF" → "alter Fassung," "nF" → "neuer Fassung." Store the expanded form in a separate `contentNormalized` column; embed `contentNormalized`, not raw `content`.
- Evaluate `jina-embeddings-v3` (available via Ollama, context window 8192 tokens) against `multilingual-e5-large` on a 50-query German legal test set before committing to either for the new law/judgment chunks.
- Hybrid search mitigates embedding weakness: BM25 excels at exact legal term matching (Aktenzeichen, paragraph citations, statute abbreviations). Ensure BM25 leg carries meaningful weight in RRF — do not downweight it in favor of pure vector search.
- Add `rechtsgebiet`, `normReference`, `gericht` metadata fields to `law_chunks` and `urteil_chunks`. Helena pre-filters by these fields before semantic search — reduces embedding quality burden significantly.
- Store the embedding model name and version with every vector row. When upgrading models, existing embeddings are invalid — mark them for re-processing, do not mix vectors from different model versions in the same similarity search.

**Warning signs:**
- Query "Schadensersatz Verkehrsunfall" returns Mietrecht paragraphs — domain confusion.
- Query with exact Aktenzeichen string returns no pgvector results — expected; BM25 leg must handle this.
- Retrieval MRR below 0.5 on gold-standard query set — time to re-evaluate embedding model choice.
- `law_chunks.embedding` and `document_chunks.embedding` mixed in same pgvector query — model version mismatch possible.

**Phase to address:** Phase 1 (before bulk ingestion of laws/Urteile). Validate embedding quality on a 50-law sample before triggering full Gesetze ingestion.

---

### Pitfall 10: pgvector HNSW Index Missing on New Chunk Tables — Full-Table-Scan at Scale

**What goes wrong:**
The existing `document_chunks` table has an HNSW index (built in v3.4). New tables (`law_chunks`, `urteil_chunks`, `muster_chunks`) are added in Prisma schema migrations without explicitly creating HNSW indexes. Prisma does not automatically create HNSW indexes from the schema — they must be added as raw SQL in the migration file. Without the index, every vector similarity query is a full sequential scan. At 10,000+ law chunks, queries go from ~10ms to >30s, making the app appear frozen.

**Why it happens:**
Prisma schema does not support vector index creation natively (as of early 2026). Developers add the `embedding` column as `Unsupported("vector(1536)")` but forget to add the corresponding index creation as a raw SQL step in the migration file.

**How to avoid:**
- In every Prisma migration that adds an `embedding` column, add immediately after:
  ```sql
  CREATE INDEX CONCURRENTLY "law_chunks_embedding_hnsw_idx"
  ON "law_chunks" USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
  ```
- Run `\d law_chunks` after migration to verify the index exists.
- Add to the app health check: query each chunk table with a trivial vector similarity search and assert response time < 100ms. This catches missing indexes immediately.
- Use `CREATE INDEX CONCURRENTLY` to avoid locking the table during index build — safe for production deploys.

**Warning signs:**
- First bulk ingestion of 2000+ laws takes minutes per query afterward.
- `EXPLAIN ANALYZE` on a vector similarity query shows `Seq Scan` instead of `Index Scan using hnsw`.
- Health check passes (table exists) but vector queries time out.

**Phase to address:** Phase 2 (Gesetze-RAG ingestion). Index creation is task 1 of every new chunk table migration — not an afterthought.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Flat chunks only (no parent-child), feed child directly to LLM | Faster to implement | Context truncation, poor answer quality for long legal arguments, cannot be retrofitted without re-ingestion | Never — implement parent-child from the start for new chunk tables |
| RRF in application code (two Node.js DB round-trips, merge in JS) | Simpler initial code | 2× DB latency per query, fusion logic duplicated across multiple endpoints, hard to tune | Prototype only — move to SQL CTE before any production traffic |
| NER prompt without few-shot German legal examples | Reuses existing generic prompt | High false positive rate on court/institution names, low false negative catch rate for German name patterns | Never for production — few-shot mandatory |
| Indexing Muster immediately on MinIO upload (before NER) | Instant indexing feedback to admin | DSGVO violation, BRAO §43a breach if client data indexed | Never |
| Cloning bundestag/gesetze Markdown repo as data source | Simple git pull for updates | Stale data (repo lags behind gesetze-im-internet.de), large git history causes Docker OOM, Markdown has idiosyncrasies | Prototype only |
| Cross-encoder reranking on 50 candidates | Higher theoretical reranking quality | 14s latency per query at 280ms/doc — app becomes unusable | Never — hard cap at 10 candidates |
| Embedding raw German legal text without abbreviation expansion | No preprocessing step needed | Poor semantic retrieval for abbreviation-heavy legal text | Only if benchmarks show no MRR improvement from expansion |
| Separate pgvector queries per source type (Akte, Gesetze, Urteile, Muster) then merge in JS | Simple mental model | N×DB round-trips, fusion quality degrades without RRF, harder to weight sources | Only during initial development — unify into single hybrid query before production |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Meilisearch + pgvector RRF | Querying sequentially in Node.js then merging arrays | Implement as single PostgreSQL function or CTE. Alternatively: use Meilisearch as pre-filter for relevant `dokumentId`s, then do vector search `WHERE "dokumentId" = ANY($filtered_ids)` — reduces vector search space significantly |
| Meilisearch freshness vs. pgvector | Wrapping Meilisearch index + pgvector insert in one "transaction" (they are NOT transactional) | Two-phase approach: write to Prisma/pgvector first (in DB transaction). Enqueue Meilisearch indexing as separate BullMQ job with retry. If Meilisearch job fails, chunk is searchable via vector but not BM25 — acceptable degradation |
| Ollama cross-encoder reranking | Calling `/api/generate` with query+document, parsing relevance from text output | Use a dedicated reranker model that outputs a scalar score, not a chat response. Qwen3-Reranker-4B via Ollama's `/api/embed` endpoint with the correct reranker prompt template |
| bundestag/gesetze XML parsing | `fast-xml-parser` default config on BMJV XMLs | Set `htmlEntities: true` (BMJV XMLs use HTML entities inside XML), `ignoreAttributes: false` (to capture `builddate` metadata), force UTF-8 regardless of XML prolog encoding declaration |
| MinIO Muster storage | Storing only the raw DOCX, no processing state | Store: (1) raw DOCX at `muster/raw/{id}.docx`, (2) extracted plain text at `muster/text/{id}.txt`, (3) NER-filtered text at `muster/filtered/{id}.txt`. Use MinIO object tags (`pii-status: pending|clean|rejected`) to track NER state |
| BullMQ NER jobs with Ollama | No timeout — stalled Ollama call holds worker slot indefinitely | Set BullMQ `timeout: 60000` on the job definition AND create `AbortController` with 45s signal for the Ollama fetch call. Log and mark job `NER_FAILED` on timeout; do not retry indefinitely |
| Prisma migrations adding vector columns | Forgetting HNSW index in the migration SQL | Every migration adding `embedding Unsupported("vector(N)")` must include `CREATE INDEX CONCURRENTLY ... USING hnsw` as a raw SQL statement in the same migration file |
| Existing `document_chunks` + new `law_chunks`/`urteil_chunks` in same pgvector query | Mixing embeddings from different models (multilingual-e5 for Akte docs, potentially jina-v3 for law chunks) | Never mix vectors from different embedding models in the same similarity search. Use separate queries per chunk type, then RRF-fuse. Or standardize on one embedding model for all chunk types from the start |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Embedding large parent chunks (2000 tokens) in pgvector | Embeddings truncated silently (multilingual-e5-large max = 512 tokens, jina-v3 = 8192) | ONLY embed child chunks (≤500 tokens). Parent chunks are never embedded — retrieved by FK join after child retrieval | Day 1 if parent chunks exceed model context window — truncation is silent, produces wrong embeddings |
| N+1 fetch: one `SELECT parent FROM document_chunks WHERE id = $childParentId` per retrieved child | N child results → N DB round-trips for parent context | Single query: `SELECT c.*, p.content AS parentContent FROM document_chunks c LEFT JOIN document_chunks p ON c."parentChunkId" = p.id WHERE c.id = ANY($1)` | At >3 results per query — noticeable latency spike |
| Sequential Ollama NER: `for doc of docs { await ollama.generate(doc) }` | BullMQ ingestion queue depth grows monotonically during bulk import | Use BullMQ `concurrency: 3` for NER worker, not sequential awaits within a single job | At >5 documents in a single ingestion batch |
| Missing HNSW index on `law_chunks`, `urteil_chunks`, `muster_chunks` | Vector queries take >10s, app appears frozen | Add HNSW index in migration file. Verify with `EXPLAIN ANALYZE`. Add to health check. | At >5,000 chunks per table — queries go from 10ms to 30s+ |
| Re-scraping rechtsprechung-im-internet.de on every ingestion run | IP block within 5 minutes of bulk re-run | Cache raw HTML in MinIO (`urteil/html/{id}.html`). Only re-scrape if `lastScraped` > 30 days old or if forced | First bulk ingestion attempt without caching |
| Meilisearch re-indexing all chunks on attribute schema change | Full re-index causes search service downtime during heavy use | Add new filterable/searchable attributes as nullable first; use Meilisearch settings API to add attributes incrementally, not via full index deletion + re-creation | Any schema change without planning |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing unredacted court decisions in `urteil_chunks` | DSGVO Art. 5(1)(c) data minimization violation — personal data of litigants stored beyond necessity | NER PII filter is a hard gate before any text enters `urteil_chunks`. Document NER as a technical-organizational measure in the Verarbeitungsverzeichnis |
| Muster containing real client data indexed to RAG | BRAO §43a Abs. 2 (Verschwiegenheitspflicht) violation — attorney professional secrecy breach | Two-stage upload: MinIO store → PII gate → conditional index. Status machine with `PENDING_NER | INDEXED | REJECTED_PII_DETECTED`. No bypasses |
| Mixing client Akte RAG context with public law context in cloud LLM calls | Client data sent to OpenAI/Anthropic when cloud provider is selected — DSGVO data processor agreement required, but `document_chunks` content should never leave the self-hosted environment | Separate retrieval paths: `document_chunks` (Akte-scoped, only Ollama) vs. `law_chunks`/`urteil_chunks` (public, can use cloud LLM). Guard: if provider is cloud AND query uses `document_chunks`, refuse and redirect to Ollama |
| `law_chunks` and `urteil_chunks` accessible without RBAC filter | Public law content is fine to share, but the retrieval endpoint also touches `document_chunks` — a misconfigured JOIN or union leaks Akte documents to wrong user | Retrieval architecture must enforce Akte-scoped filtering on `document_chunks` at the SQL level (WHERE `"akteId" = $userAccessibleAkteIds`), not post-fetch in application code |
| BMJ scraping without User-Agent identification | Potential ToS violation, IP block, bad actor classification | Always set descriptive User-Agent identifying the application and operator contact |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No async status for Muster upload | Admin clicks upload, waits with no feedback, clicks again — duplicate uploads, both with unredacted data | Real-time status via Socket.IO: "Hochgeladen (1/3) → NER läuft (2/3) → Indexiert (3/3)" or "Abgelehnt — PII erkannt" |
| Helena cites "Chunk ID a3f9b2c" instead of "§ 123 BGB Abs. 2" | Anwalt cannot verify the citation; loses trust in Helena entirely | Store norm reference ("§ 123 BGB") and Aktenzeichen ("BGH XII ZR 45/22") as structured metadata. Citation UI renders human-readable reference, not internal chunk ID |
| Retrieval returning outdated Gesetze versions | Anwalt acts on superseded law text — professional liability | Store `gueltigBis` date on `law_chunks`. Filter out expired norms at query time: `WHERE "gueltigBis" IS NULL OR "gueltigBis" > NOW()` |
| Cross-encoder latency shows as UI freeze | Anwalt thinks app crashed; hits back button, losing context | Always stream LLM response tokens as they arrive. Do not wait for full reranking + full response before showing anything. Show a "Helena denkt nach..." skeleton while retrieving |
| No "nicht amtlich" disclaimer on Helena Urteil summaries | BRAK compliance violation; professional liability exposure | Automatic disclaimer appended to every Helena Urteil summary: "Hinweis: Nicht amtliche Zusammenfassung. Ohne Gewähr." Non-removable by user |
| Muster search returning placeholder text ("{{Mandant.Name}}") as relevant matches | Helena drafts briefs with unfilled placeholder variable names instead of actual content | Normalize all placeholders to a canonical form at indexing time. Optionally exclude placeholder tokens from Meilisearch searchable attributes |

---

## "Looks Done But Isn't" Checklist

- [ ] **Hybrid Search RRF:** Often missing equal candidate count from both legs — verify both Meilisearch and pgvector return exactly N=50 candidates before fusion, not Meilisearch default 20.
- [ ] **Parent-Child Chunking:** Often missing the parent fetch on retrieval — verify by logging prompt token count: LLM must receive ~2000-token parent content, not ~500-token child content.
- [ ] **Gesetze encoding:** Often missing UTF-8 validation — run `SELECT content FROM law_chunks WHERE content LIKE '%§%' LIMIT 1` and verify actual `§` character, not `Â§`.
- [ ] **Gesetze freshness:** Often missing staleness detection — verify daily sync BullMQ cron fires and updates `lastModified` on changed laws. Check one law known to have changed recently.
- [ ] **NER institution whitelist:** Often missing after adding few-shot examples — verify "Bundesgerichtshof," "Amtsgericht Köln," "BaFin" are NOT redacted in a sample court decision NER run.
- [ ] **Muster PII gate:** Often missing the indexing lock — search `muster_chunks` immediately after upload: must return 0 results. Results should appear only after NER job completes successfully.
- [ ] **Citation integrity:** Often missing post-generation verification — verify Helena's cited Aktenzeichen matches the `citation` metadata field of the retrieved `urteil_chunks` records, not a hallucinated variant.
- [ ] **pgvector HNSW index:** Often missing on new tables — run `\d law_chunks` and verify HNSW index present. Run `EXPLAIN ANALYZE` on a vector query and verify `Index Scan` not `Seq Scan`.
- [ ] **Ollama NER timeout:** Often missing — verify BullMQ NER job definition has `timeout: 60000` and that a stalled Ollama call does not hold a worker slot beyond 60s (test by artificially stalling Ollama).
- [ ] **Embedding model consistency:** Often mixing — verify `SELECT DISTINCT "embeddingModel" FROM law_chunks` returns exactly one value matching the current production model name.
- [ ] **DSGVO documentation:** Often missing Verarbeitungsverzeichnis entry for Urteile-RAG processing — verify that the NER PII filter is documented as a technical-organizational measure before going live.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Encoding bug (Umlauts mangled in `law_chunks`) | HIGH | Delete all `law_chunks` rows. Fix ingestion pipeline encoding. HNSW index rebuilds automatically on re-ingestion. Re-run daily sync for all laws. |
| Unredacted client data found in `muster_chunks` | HIGH | Immediate: `DELETE FROM muster_chunks WHERE id IN (...)` AND delete from Meilisearch index. Audit: check all uploads since pipeline went live. Legal: assess DSGVO Art. 33 notification obligation. BRAO: assess professional secrecy breach. |
| Hallucinated AZ found in production Helena citations | MEDIUM | Add post-generation AZ verification (regex + chunk metadata comparison) to existing endpoint — no re-ingestion needed. Ship fix same day. Add "Quellennachweis nicht verifiziert" flag to UI for unverifiable citations. |
| Cross-encoder latency making app unusable (>5s P50) | MEDIUM | Feature flag: disable cross-encoder, fall back to RRF ordering immediately. Implement 10-candidate cap and ONNX-based reranker offline. Re-enable with capped candidate count. |
| Parent-child retrieval returning child chunks directly | MEDIUM | SQL fix only: update retrieval query to JOIN parent. No re-ingestion needed if `parentChunkId` FKs are correctly populated. |
| pgvector HNSW index missing on new table | LOW | `CREATE INDEX CONCURRENTLY` — runs without table lock. Takes ~5 minutes for 100k chunks. No app restart needed. |
| Meilisearch out of sync with pgvector (failed indexing jobs) | LOW | Re-queue Meilisearch indexing BullMQ jobs scoped to affected `chunkId`s. No re-ingestion from source needed. |
| BMJ IP block during bulk scraping | LOW | Reduce rate to 1 req/5s. Wait 24h for unblock. Use cached MinIO HTML for re-processing without re-scraping. |
| NER false positive discovered (institution name redacted) | LOW | Update NER prompt + whitelist regex. Re-run NER BullMQ job against raw HTML in MinIO (no re-scraping). Re-index affected chunks only. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| RRF candidate count asymmetry | Phase 1: Hybrid Search | Gold-standard 20-query MRR test (MRR > 0.6), verify equal candidate counts in logs |
| Cross-encoder latency explosion | Phase 1: Reranking | P95 end-to-end chat latency < 3s measured with 10 candidate cap |
| Parent-child schema migration | Phase 1: Parent-Child Chunking | `SELECT COUNT(*) FROM document_chunks WHERE "chunkType" IS NULL = 0` after migration |
| Embedding quality for German legal | Phase 1: before bulk ingestion | 50-query benchmark multilingual-e5 vs. alternative; MRR documented |
| pgvector HNSW index missing | Phase 1 + all new table migrations | `EXPLAIN ANALYZE` shows `Index Scan`. Health check asserts < 100ms vector query |
| bundestag/gesetze encoding + freshness | Phase 2: Gesetze-RAG | Encoding smoke test passes. Daily sync cron fires. One known-changed law verified current |
| BMJ scraping compliance + HTML fragility | Phase 3: Urteile-RAG | Rate limit verified in logs. Schema validation step asserts expected HTML elements per page |
| Ollama NER false positives/negatives | Phase 3: Urteile-RAG | Acceptance test: 10 known decisions, 0 institution names redacted, 0 full person names surviving |
| Muster PII gate | Phase 4: Arbeitswissen-RAG | Upload-then-immediate-search returns 0 results. Socket.IO status events fire correctly |
| Helena citation hallucination | All phases with Urteil context | Post-generation AZ regex verification runs on every Helena response containing an Urteil citation |
| Unredacted client data mixing with public law in cloud LLM | Phase 1: Retrieval architecture | Integration test: cloud provider selected + Akte query → error returned, not forwarded to cloud |

---

## Sources

- [Advanced RAG: Reciprocal Rank Fusion (glaforge.dev, Feb 2026)](https://glaforge.dev/posts/2026/02/10/advanced-rag-understanding-reciprocal-rank-fusion-in-hybrid-search/)
- [Azure AI Search Hybrid Search Scoring / RRF](https://learn.microsoft.com/en-us/azure/ai-search/hybrid-search-ranking)
- [Better RAG with RRF and Hybrid Search — assembled.com](https://www.assembled.com/blog/better-rag-results-with-reciprocal-rank-fusion-and-hybrid-search)
- [Reranking with Ollama and Qwen3 Reranker in Go (Medium, 2025)](https://medium.com/@rosgluk/reranking-documents-with-ollama-and-qwen3-reranker-model-in-go-6dc9c2fb5f0b)
- [Ultimate Guide to Reranking Models — ZeroEntropy 2026](https://www.zeroentropy.dev/articles/ultimate-guide-to-choosing-the-best-reranking-model-in-2025)
- [Cross-Encoder Reranking: +40% Accuracy — Ailog RAG](https://app.ailog.fr/en/blog/guides/reranking)
- [Parent-Child Chunking in LangChain for Advanced RAG (Medium)](https://medium.com/@seahorse.technologies.sl/parent-child-chunking-in-langchain-for-advanced-rag-e7c37171995a)
- [Chunking Strategies for RAG — Stack Overflow Blog (Dec 2024)](https://stackoverflow.blog/2024/12/27/breaking-up-is-hard-to-do-chunking-in-rag-applications/)
- [bundestag/gesetze GitHub repo](https://github.com/bundestag/gesetze)
- [bundestag/gesetze-tools GitHub repo](https://github.com/bundestag/gesetze-tools)
- [Local LLM-Based NER with Ollama — drezil.de case study (2025)](https://drezil.de/Writing/ner4all-case-study.html)
- [PII Masking — LlamaIndex official docs](https://docs.llamaindex.ai/en/stable/examples/node_postprocessor/PII/)
- [Universal NER model on Ollama](https://ollama.com/zeffmuks/universal-ner)
- [Web scraping legal compliance 2025 — browserless.io](https://www.browserless.io/blog/is-web-scraping-legal)
- [Hamburg Court on AI scraping copyright Germany (2024) — Harte-Bavendamm](https://www.harte-bavendamm.de/en/ip-blog/landmark-decision-by-the-hamburg-regional-court-on-the-copyright-admissibility-of-data-scraping-for-training-ai-models)
- Project context: `/Users/patrickbaumfalk/Projekte/AI-Lawyer/.planning/PROJECT.md` (AI-Lawyer v3.5 → v0.1 milestone)

---

*Pitfalls research for: Legal RAG addition to AI-Lawyer (Node.js/Prisma/Meilisearch/pgvector/Ollama/BullMQ)*
*Researched: 2026-02-26*
