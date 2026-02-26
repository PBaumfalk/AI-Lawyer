# Architecture Research

**Domain:** Legal RAG pipeline extension (Helena v0.1) — Next.js/Prisma/BullMQ/pgvector/Meilisearch
**Researched:** 2026-02-26
**Confidence:** HIGH (based on direct codebase inspection + established pgvector/BullMQ patterns)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Helena RAG Pipeline                          │
├──────────────────────┬──────────────────────┬───────────────────────┤
│   INGESTION WORKERS  │   RETRIEVAL ENGINE   │    HELENA CHAT UI     │
│  (BullMQ background) │  (ki-chat route)     │  (existing front end) │
│                      │                      │                       │
│  gesetze-sync-job    │  hybrid-search.ts    │  /app/ki-chat         │
│  urteil-ingestion    │  (RRF merger)        │  source citations     │
│  muster-ingestion    │                      │  normen-badge         │
│  pii-filter step     │  reranker.ts         │                       │
│  embedding step      │  (cross-encoder)     │  /admin/muster        │
│  meilisearch step    │                      │  (upload UI)          │
└──────────┬───────────┴──────────┬───────────┴───────────────────────┘
           │                      │
┌──────────▼──────────────────────▼───────────────────────────────────┐
│                          Data Layer                                  │
├─────────────────────┬────────────────────┬──────────────────────────┤
│  PostgreSQL 16       │   Meilisearch      │   MinIO S3               │
│  (pgvector)         │                    │                           │
│                      │                    │                           │
│  document_chunks     │  idx: dokumente    │  bucket: dokumente        │
│  law_chunks (NEW)    │  idx: gesetze(NEW) │  raw-gesetze/ (NEW)      │
│  urteil_chunks (NEW) │  idx: urteile(NEW) │  raw-urteile/ (NEW)      │
│  muster_chunks (NEW) │  idx: muster (NEW) │  muster/ (NEW)           │
│  akte_normen (NEW)   │                    │                           │
└─────────────────────┴────────────────────┴──────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | File Location |
|-----------|----------------|---------------|
| `embedder.ts` | Ollama embedding (existing, unchanged) | `src/lib/embedding/embedder.ts` |
| `chunker.ts` | Parent-child chunking (MODIFY) | `src/lib/embedding/chunker.ts` |
| `vector-store.ts` | pgvector CRUD (MODIFY to add new tables) | `src/lib/embedding/vector-store.ts` |
| `hybrid-search.ts` | Meilisearch BM25 + pgvector merge via RRF (NEW) | `src/lib/embedding/hybrid-search.ts` |
| `reranker.ts` | Cross-encoder reranking via Ollama (NEW) | `src/lib/embedding/reranker.ts` |
| `pii-filter.ts` | NER PII detection via Ollama (NEW) | `src/lib/pii-filter/index.ts` |
| `ki-chat/route.ts` | Orchestrate hybrid search + reranking (MODIFY) | `src/app/api/ki-chat/route.ts` |
| `gesetze-sync-job` | GitHub sync for bundestag/gesetze (NEW) | `src/lib/queue/processors/gesetze.processor.ts` |
| `urteil-ingestion-job` | BMJ scraping + BAG RSS + ingestion (NEW) | `src/lib/queue/processors/urteile.processor.ts` |
| `muster-ingestion-job` | Admin upload to MinIO then embed (NEW) | `src/lib/queue/processors/muster.processor.ts` |
| `akte-normen API` | Link norms to Akte (NEW) | `src/app/api/akten/[id]/normen/route.ts` |
| `admin/muster` | Upload UI for Formulare/Muster (NEW) | `src/app/(dashboard)/admin/muster/page.tsx` |

---

## Recommended Project Structure

```
src/
├── lib/
│   ├── embedding/
│   │   ├── chunker.ts            # MODIFY: add createParentChildChunks()
│   │   ├── embedder.ts           # NO CHANGE
│   │   ├── vector-store.ts       # MODIFY: add insertLawChunks, insertUrteilChunks,
│   │   │                         #          insertMusterChunks, searchAcross()
│   │   ├── hybrid-search.ts      # NEW: RRF merger (Meilisearch + pgvector)
│   │   └── reranker.ts           # NEW: cross-encoder via Ollama
│   ├── pii-filter/
│   │   └── index.ts              # NEW: NER entity detection via Ollama
│   ├── gesetze/
│   │   ├── github-sync.ts        # NEW: git clone/pull bundestag/gesetze
│   │   └── parser.ts             # NEW: XML/Markdown to chunks
│   ├── urteile/
│   │   ├── bmj-scraper.ts        # NEW: BMJ Rechtsprechung HTTP scraper
│   │   └── bag-rss.ts            # NEW: BAG RSS feed parser
│   ├── muster/
│   │   └── uploader.ts           # NEW: MinIO upload + queue enqueue helper
│   ├── meilisearch.ts            # MODIFY: add law/urteil/muster index helpers
│   └── queue/
│       ├── queues.ts             # MODIFY: add 3 new queues + cron registrations
│       └── processors/
│           ├── embedding.processor.ts  # NO CHANGE
│           ├── ocr.processor.ts        # NO CHANGE
│           ├── gesetze.processor.ts    # NEW
│           ├── urteile.processor.ts    # NEW
│           └── muster.processor.ts     # NEW
├── app/
│   ├── api/
│   │   ├── ki-chat/
│   │   │   └── route.ts          # MODIFY: hybrid search + reranking
│   │   ├── akten/[id]/normen/
│   │   │   └── route.ts          # NEW: GET/POST/DELETE akte_normen
│   │   └── admin/muster/
│   │       └── route.ts          # NEW: POST upload to MinIO then queue
│   └── (dashboard)/
│       └── admin/
│           └── muster/
│               └── page.tsx      # NEW: admin upload UI
```

---

## Architectural Patterns

### Pattern 1: Parallel Ingestion Workers (Independent per Knowledge Type)

**What:** Each of the three RAG knowledge types (Gesetze, Urteile, Muster) gets its own BullMQ queue and processor. They share the embedding infrastructure (`embedder.ts`, `vector-store.ts`) but are otherwise decoupled.

**When to use:** When ingestion sources have different triggers (cron vs. HTTP upload vs. RSS feed). Isolation means a BMJ scraper failure does not block Gesetze sync.

**Trade-offs:** Three separate processor files to maintain, but each is small (<200 LOC) and testable in isolation.

**Example:**
```typescript
// src/lib/queue/queues.ts — add to existing file
export const gesetzeSyncQueue = new Queue("gesetze-sync", {
  connection: getQueueConnection(),
  defaultJobOptions: { attempts: 3, backoff: { type: "custom" } },
});

export const urteilIngestionQueue = new Queue("urteil-ingestion", {
  connection: getQueueConnection(),
  defaultJobOptions: { attempts: 3, backoff: { type: "custom" } },
});

export const musterIngestionQueue = new Queue("muster-ingestion", {
  connection: getQueueConnection(),
  defaultJobOptions: { attempts: 2, backoff: { type: "custom" } },
});

// Cron registration (daily at 2:00 AM, matching existing pattern)
export async function registerGesetzeSyncJob(): Promise<void> {
  await gesetzeSyncQueue.upsertJobScheduler(
    "gesetze-sync-daily",
    { pattern: "0 2 * * *", tz: "Europe/Berlin" },
    { name: "sync-gesetze", data: {} }
  );
}
```

### Pattern 2: Parent-Child Chunking with FK on document_chunks

**What:** A "parent chunk" (~2000 tokens, full context for LLM prompt) stores full paragraphs. "Child chunks" (~500 tokens, for embedding/retrieval) reference the parent via `parentChunkId`. On retrieval, the child is matched by cosine similarity, but the parent content is passed to the LLM.

**When to use:** Required for all four chunk table types. The existing `document_chunks` table gets a new nullable `parentChunkId` self-reference. The three new tables include `parentContent` as a stored field (simpler than a FK join).

**Trade-offs:** Storing parentContent inline in law/urteil/muster tables avoids a JOIN at query time. Doubles storage per chunk row. Acceptable at kanzlei scale (<1M chunks total).

**Migration strategy:** Add `parentChunkId` to `document_chunks` via nullable ALTER TABLE. Existing rows keep `parentChunkId = NULL`. The next admin-triggered "Re-embed All" produces proper parent-child pairs. No data loss — existing chunks remain searchable during migration.

**Example:**
```typescript
// src/lib/embedding/chunker.ts — new export alongside existing chunkDocument()
export async function createParentChildChunks(text: string): Promise<{
  parent: { content: string; index: number };
  children: { content: string; index: number }[];
}[]> {
  // Parent splitter: 2000 chars, 400 overlap
  const parentSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 2000, chunkOverlap: 400,
    separators: GERMAN_LEGAL_SEPARATORS,
  });
  // Child splitter: 500 chars, 100 overlap
  const childSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500, chunkOverlap: 100,
    separators: GERMAN_LEGAL_SEPARATORS,
  });

  const parentTexts = await parentSplitter.splitText(text);
  return Promise.all(parentTexts.map(async (parentContent, parentIdx) => {
    const childTexts = await childSplitter.splitText(parentContent);
    return {
      parent: { content: parentContent, index: parentIdx },
      children: childTexts.map((content, childIdx) => ({
        content,
        index: parentIdx * 1000 + childIdx, // unique global index
      })),
    };
  }));
}
```

### Pattern 3: Hybrid Search with Reciprocal Rank Fusion (RRF)

**What:** Two retrieval paths run in parallel: Meilisearch BM25 (keyword/fuzzy) and pgvector cosine (semantic). Results are merged using RRF with k=60. The merged list is passed to the cross-encoder reranker.

**When to use:** Always, for all Helena retrievals. RRF is robust: if one retriever returns poor results, the other compensates. No score threshold tuning needed across retriever types.

**Trade-offs:** Two network calls per query (Meilisearch + pgvector). At kanzlei scale both complete in <100ms, so total overhead is <200ms before reranking.

**Location:** New file `src/lib/embedding/hybrid-search.ts`. The `ki-chat/route.ts` calls `hybridSearch()` instead of the current `searchSimilar()` call.

**Example:**
```typescript
// src/lib/embedding/hybrid-search.ts
function rrfMerge(
  vectorResults: { id: string; rank: number }[],
  bm25Results:   { id: string; rank: number }[],
  k = 60
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const r of vectorResults) {
    scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (k + r.rank));
  }
  for (const r of bm25Results) {
    scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (k + r.rank));
  }
  return scores;
}

export type SearchScope = "akte-only" | "law" | "full";

export async function hybridSearch(
  query: string,
  queryEmbedding: number[],
  opts: { scope: SearchScope; akteId?: string; limit?: number }
): Promise<HybridResult[]> {
  const [vectorResults, bm25Results] = await Promise.all([
    searchAcrossVectors(queryEmbedding, opts),
    searchAcrossMeili(query, opts),
  ]);
  const merged = rrfMerge(
    vectorResults.map((r, i) => ({ id: r.id, rank: i })),
    bm25Results.map((r, i) => ({ id: r.id, rank: i }))
  );
  // Build HybridResult array sorted by RRF score
  // ... (lookup content by id from vectorResults/bm25Results)
}
```

### Pattern 4: Cross-Encoder Reranking as Inline Async Step

**What:** After hybrid search returns ~20 candidates, pass (query, chunk_content) pairs to Ollama with a reranking prompt. The model scores relevance 0-10 for each candidate. Sort by score, take top-5 for LLM context.

**When to use:** After hybrid search, before building the system prompt in `ki-chat/route.ts`. Inline async step, not a BullMQ job, because the user is waiting for a streaming response.

**Trade-offs:** Adds 500-1500ms latency for 20 candidates at qwen3.5:35b speeds. Mitigate by running reranking in batches of 5 with `Promise.all`. If Ollama is slow, a 2-second timeout per candidate falls back to RRF order.

**Location:** `src/lib/embedding/reranker.ts`. Called from `ki-chat/route.ts` between retrieval and prompt building.

**Example:**
```typescript
// src/lib/embedding/reranker.ts
export async function rerankWithOllama(
  query: string,
  candidates: HybridResult[],
  topK = 5
): Promise<HybridResult[]> {
  const RERANK_TIMEOUT_MS = 2000;
  const scored = await Promise.all(
    candidates.map(async (c) => {
      try {
        const score = await scoreRelevance(query, c.content, RERANK_TIMEOUT_MS);
        return { ...c, rerankScore: score };
      } catch {
        // Timeout or Ollama error: fall back to RRF score scaled to 0-10
        return { ...c, rerankScore: c.rrfScore * 10 };
      }
    })
  );
  return scored.sort((a, b) => b.rerankScore - a.rerankScore).slice(0, topK);
}
```

### Pattern 5: PII Filter as Pre-Storage Middleware in BullMQ Processor

**What:** Before indexing any Urteil or Muster chunk into pgvector/Meilisearch, pass the text through `pii-filter/index.ts`. This calls Ollama with a NER prompt to detect names, addresses, IBAN, etc. Detected entities are replaced with `[PERSON]`, `[ADRESSE]`, `[IBAN]` tokens.

**When to use:** Only for Urteile (court rulings contain real party names) and kanzlei-eigene Muster. Official amtliche Formulare are already anonymized.

**Location:** `src/lib/pii-filter/index.ts`. Called inside `urteile.processor.ts` and `muster.processor.ts` before the embedding step.

**Trade-offs:** One additional Ollama call per chunk during ingestion. Background BullMQ work so user-facing latency is unaffected. For batch ingestion of 1000+ Urteile, set BullMQ job `priority: 10` (low priority) to avoid starving other queues.

---

## New Prisma Schema (Database Design)

### New Tables

```prisma
// NEW: Gesetze chunks (bundestag/gesetze source)
model LawChunk {
  id             String   @id @default(cuid())
  gesetzId       String   // e.g. "BGB", "ZPO", "StGB"
  paragraphNr    String   // e.g. "§ 242", "§ 823 Abs. 1"
  titel          String
  content        String   @db.Text  // child chunk (~500 tokens)
  parentContent  String?  @db.Text  // parent chunk (~2000 tokens, stored inline)
  embedding      Unsupported("vector(1024)")?
  modelVersion   String
  syncedAt       DateTime @default(now())
  sourceUrl      String?

  @@index([gesetzId])
  @@index([paragraphNr])
  @@map("law_chunks")
}

// NEW: Urteile chunks (BMJ + BAG RSS source)
model UrteilChunk {
  id             String   @id @default(cuid())
  aktenzeichen   String
  gericht        String
  datum          DateTime
  rechtsgebiet   String?
  content        String   @db.Text  // PII-filtered child chunk
  parentContent  String?  @db.Text  // PII-filtered parent chunk
  embedding      Unsupported("vector(1024)")?
  modelVersion   String
  sourceUrl      String?
  piiFiltered    Boolean  @default(false)
  ingestedAt     DateTime @default(now())

  @@index([gericht])
  @@index([datum])
  @@index([rechtsgebiet])
  @@map("urteil_chunks")
}

// NEW: Muster master record
model Muster {
  id             String        @id @default(cuid())
  name           String
  kategorie      String        // "Schriftsatz", "Formular", "Muster"
  beschreibung   String?       @db.Text
  minioKey       String        // path in MinIO bucket
  mimeType       String
  piiFiltered    Boolean       @default(false)
  uploadedById   String
  uploadedBy     User          @relation(fields: [uploadedById], references: [id])
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  chunks         MusterChunk[]

  @@map("muster")
}

// NEW: Muster chunks
model MusterChunk {
  id             String     @id @default(cuid())
  musterId       String
  muster         Muster     @relation(fields: [musterId], references: [id], onDelete: Cascade)
  chunkIndex     Int
  content        String     @db.Text  // PII-filtered child chunk
  parentContent  String?    @db.Text  // PII-filtered parent chunk
  embedding      Unsupported("vector(1024)")?
  modelVersion   String
  createdAt      DateTime   @default(now())

  @@unique([musterId, chunkIndex])
  @@index([musterId])
  @@map("muster_chunks")
}

// NEW: Normen-Verknuepfung (links law paragraphs to Akten)
model AkteNorm {
  id             String    @id @default(cuid())
  akteId         String
  akte           Akte      @relation(fields: [akteId], references: [id], onDelete: Cascade)
  gesetzId       String    // e.g. "BGB"
  paragraphNr    String    // e.g. "§ 242"
  anmerkung      String?   @db.Text
  addedById      String
  addedBy        User      @relation(fields: [addedById], references: [id])
  createdAt      DateTime  @default(now())

  @@unique([akteId, gesetzId, paragraphNr])
  @@index([akteId])
  @@map("akte_normen")
}
```

Also add `parentChunkId` to existing `DocumentChunk`:
```prisma
model DocumentChunk {
  // ... existing fields unchanged ...
  parentChunkId  String?        // NEW: nullable, no FK initially (add FK in follow-up migration)
  isParent       Boolean        @default(false)  // NEW
  // ... existing @@unique and @@index ...
  @@index([parentChunkId])     // NEW
}
```

### Index Strategy (raw SQL migration after Prisma migration)

```sql
-- HNSW indexes for pgvector. Use HNSW not IVFFlat: no training required,
-- works on empty table, consistent performance as data grows.
CREATE INDEX law_chunks_embedding_hnsw
  ON law_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX urteil_chunks_embedding_hnsw
  ON urteil_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX muster_chunks_embedding_hnsw
  ON muster_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

Add these as a raw SQL step inside a Prisma migration file after the table-creation migration has run.

---

## Data Flow

### Ingestion Flow: Gesetze (bundestag/gesetze GitHub Repo)

```
BullMQ cron (daily 02:00)
  gesetze.processor.ts
    github-sync.ts: isomorphic-git pull bundestag/gesetze into /data/gesetze volume
    parser.ts: XML/Markdown to { gesetzId, paragraphNr, titel, fullText }
    chunker.ts: createParentChildChunks(fullText) -> { parent, children[] }
    embedder.ts: generateEmbedding(child.content) for each child
    vector-store.ts: insertLawChunks(gesetzId, paragraphNr, chunks)
    meilisearch.ts: indexLawChunk({ id, gesetzId, paragraphNr, content })
    (no PII filter: Gesetze are public, no personal data)
```

### Ingestion Flow: Urteile (BMJ + BAG RSS)

```
BullMQ cron (daily 03:00) + on-demand trigger
  urteile.processor.ts
    bmj-scraper.ts or bag-rss.ts: fetch HTML/XML (rate: 1 req/2s)
    storage.ts: store raw HTML in MinIO at raw-urteile/{date}/{id}.html (audit)
    parser: extract { aktenzeichen, gericht, datum, bodyText }
    pii-filter/index.ts: Ollama NER -> redact names/addresses/IBAN
    chunker.ts: createParentChildChunks(redactedText)
    embedder.ts: generateEmbedding per child chunk
    vector-store.ts: insertUrteilChunks(...)
    meilisearch.ts: indexUrteilChunk(...)
```

### Ingestion Flow: Muster (Admin Upload)

```
Admin UI /admin/muster
  POST /api/admin/muster (multipart/form-data)
    storage.ts: upload to MinIO muster/{id}/{filename}
    prisma: Muster.create({ status: PENDING })
    musterIngestionQueue.add("ingest-muster", { musterId })
    200 OK to UI (processing is async)

muster.processor.ts (BullMQ worker picks up job)
  storage.ts: fetch file from MinIO
  (if PDF) ocrClient: Stirling-PDF OCR (reuse existing ocr pattern)
  pii-filter/index.ts: redact PII
  chunker.ts: createParentChildChunks(text)
  embedder.ts: embed each child chunk
  vector-store.ts: insertMusterChunks(musterId, ...)
  meilisearch.ts: indexMusterChunk(...)
  prisma: Muster.update({ status: INDEXED })
```

### Retrieval Flow: Helena Chat Query

```
POST /api/ki-chat
  generateQueryEmbedding(query)             [existing embedder.ts, unchanged]
  hybridSearch(query, queryEmbedding, scope) [NEW hybrid-search.ts]
    parallel:
      searchAcrossVectors(queryEmbedding, scope)   [modified vector-store.ts]
      searchAcrossMeili(query, scope)              [modified meilisearch.ts]
    rrfMerge(vectorResults, bm25Results) -> top-20 candidates
  rerankWithOllama(query, candidates, topK=5)  [NEW reranker.ts, timeout 2s]
  for each top result: use parentContent for LLM context (richer than child)
  build systemPrompt with parentContent excerpts + source citations
  streamText(model, systemPrompt, messages)   [existing Vercel AI SDK, unchanged]
```

### Normen-Verknuepfung Flow

```
[Auto-detection during AI scan]
  ai-scan processor: extract "§ 242 BGB" style citations from document text
  POST /api/akten/{id}/normen { gesetzId, paragraphNr }
  prisma: AkteNorm.create(...)

[Manual addition by user]
  Akte detail page: user clicks "Norm hinzufuegen"
  Search law_chunks for matching §
  POST /api/akten/{id}/normen

[Display]
  GET /api/akten/{id}/normen
  NormenCard component in akte detail sidebar
  Click norm: modal shows law_chunks.parentContent for that §
```

---

## Integration Points

### New vs. Modified Components

**MODIFIED (existing files with targeted changes):**

| File | Change |
|------|--------|
| `src/lib/embedding/chunker.ts` | Add `createParentChildChunks()` function. Existing `chunkDocument()` unchanged. |
| `src/lib/embedding/vector-store.ts` | Add `insertLawChunks()`, `insertUrteilChunks()`, `insertMusterChunks()`, `searchAcross()` (queries all four tables, scoped). Existing `insertChunks()`, `searchSimilar()`, `deleteChunks()` unchanged. |
| `src/lib/meilisearch.ts` | Add `indexLawChunk()`, `indexUrteilChunk()`, `indexMusterChunk()`, `ensureNewIndexes()`, `searchAcross()`. Existing `searchDokumente()` and `indexDokument()` unchanged. |
| `src/lib/queue/queues.ts` | Add `gesetzeSyncQueue`, `urteilIngestionQueue`, `musterIngestionQueue` and their cron registration functions. Add all three to `ALL_QUEUES` array. |
| `src/app/api/ki-chat/route.ts` | Replace `searchSimilar()` call with `hybridSearch()`. Add `rerankWithOllama()` call. Use `parentContent` from results for system prompt. Source attribution now includes `sourceType` field. |
| `prisma/schema.prisma` | Add `parentChunkId`/`isParent` to `DocumentChunk`. Add five new models: `LawChunk`, `UrteilChunk`, `Muster`, `MusterChunk`, `AkteNorm`. |

**NEW (created from scratch):**

| File | Purpose |
|------|---------|
| `src/lib/embedding/hybrid-search.ts` | RRF merger, unified search interface across all four RAG types with scope control |
| `src/lib/embedding/reranker.ts` | Cross-encoder reranking via Ollama with per-candidate timeout fallback |
| `src/lib/pii-filter/index.ts` | NER PII detection + entity redaction via Ollama |
| `src/lib/gesetze/github-sync.ts` | isomorphic-git pull of bundestag/gesetze repo into Docker volume |
| `src/lib/gesetze/parser.ts` | XML/Markdown law text parser producing structured chunks |
| `src/lib/urteile/bmj-scraper.ts` | BMJ Rechtsprechung HTTP scraper with 1 req/2s rate limiting |
| `src/lib/urteile/bag-rss.ts` | BAG RSS feed parser (rss-parser npm) |
| `src/lib/muster/uploader.ts` | MinIO upload + musterIngestionQueue.add() helper |
| `src/lib/queue/processors/gesetze.processor.ts` | BullMQ processor for Gesetze sync pipeline |
| `src/lib/queue/processors/urteile.processor.ts` | BullMQ processor for Urteil ingestion with PII filter |
| `src/lib/queue/processors/muster.processor.ts` | BullMQ processor for Muster ingestion with PII filter |
| `src/app/api/akten/[id]/normen/route.ts` | GET/POST/DELETE for AkteNorm records |
| `src/app/api/admin/muster/route.ts` | POST multipart upload to MinIO then enqueue |
| `src/app/(dashboard)/admin/muster/page.tsx` | Admin upload UI with file table and status column |

### External Service Integrations

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub (bundestag/gesetze) | `isomorphic-git` shallow clone into Docker volume `/data/gesetze` | Public repo, no token needed. Use `isomorphic-git` not `simple-git`: no git binary dependency in Docker image. First run: shallow clone (`depth: 1`). Subsequent runs: pull. |
| BMJ Rechtsprechung | HTTP fetch + HTML parse with cheerio | Rate limit: 1 req/2s hard limit. Store raw HTML in MinIO `raw-urteile/` for audit trail. Check robots.txt on startup. |
| BAG RSS Feed | Atom/RSS parse via `rss-parser` npm package | RSS gives metadata only; full text requires following each entry URL. Enqueue each entry as a separate `urteil-ingestion` BullMQ job to avoid long-running single job. |
| Ollama (reranker) | POST `/api/chat` with structured rerank prompt | Model: qwen3.5:35b (existing). 2-second timeout per candidate. Response format: `{ "score": 7 }` extracted via regex. |
| Ollama (PII filter) | POST `/api/chat` with NER prompt | Same model. Response format: array of `{ text, type, replacement }`. Falls back to unfiltered text on Ollama error (non-fatal, flagged in DB). |

### Internal Module Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `ki-chat/route.ts` to `hybrid-search.ts` | Direct function call | `hybridSearch()` encapsulates both retrieval paths. `ki-chat` no longer calls `searchSimilar()` or `searchDokumente()` directly. |
| `hybrid-search.ts` to `vector-store.ts` | Direct function call | `searchAcross()` in vector-store accepts `tables` scope parameter to query only relevant chunk tables. |
| `hybrid-search.ts` to `meilisearch.ts` | Direct function call | New `searchAcross()` in meilisearch fans out to all relevant Meilisearch indexes based on scope. |
| Worker entrypoint to new processors | Import + processor registration | The existing worker file registers processors per queue. Add three new `worker.registerQueue(gesetzeSyncQueue, processGesetzeSyncJob)` style registrations. |
| `pii-filter/index.ts` to `urteile.processor.ts` / `muster.processor.ts` | Direct async function call | PII filter is a synchronous step within the processor, not a separate queue. Failure is non-fatal: log warning, set `piiFiltered: false` in DB, continue ingestion. |
| `muster/uploader.ts` to `musterIngestionQueue` | `Queue.add()` | Upload API enqueues; processor picks up asynchronously. Upload API returns 200 with `{ status: "PENDING", musterId }`. |

---

## Suggested Build Order

Rationale: database schema must exist before any code that writes to it; shared retrieval infrastructure (hybrid search) before ki-chat changes; simple Gesetze source before complex Urteile scraping; PII filter before Urteile because Urteile processor depends on it.

```
Phase 1 — Schema Foundation (enables everything else, no UI)
  1a. prisma/schema.prisma: add parentChunkId + isParent to DocumentChunk
  1b. prisma/schema.prisma: add LawChunk, UrteilChunk, Muster, MusterChunk, AkteNorm
  1c. prisma migrate dev (safe — additive only, no existing data affected)
  1d. Add raw SQL HNSW index migration file

Phase 2 — Parent-Child Chunker (shared by all four RAG types)
  2a. Modify chunker.ts: add createParentChildChunks()
  2b. Modify vector-store.ts: add insertLawChunks(), insertUrteilChunks(), insertMusterChunks()
  2c. Skeleton hybrid-search.ts (vector-only first, Meilisearch side added in Phase 3)
  (Existing document_chunks embedding flow is untouched)

Phase 3 — Hybrid Search + Reranking (improves existing chat immediately)
  3a. Complete hybrid-search.ts (RRF, both retrieval paths, scope parameter)
  3b. Modify meilisearch.ts: add searchAcross(), new index setup helpers
  3c. Add reranker.ts
  3d. Modify ki-chat/route.ts: wire hybridSearch() + rerankWithOllama()
  (Existing document_chunks retrieval now upgraded, even before new knowledge types exist)

Phase 4 — Gesetze RAG (simplest source, validates end-to-end pipeline)
  4a. Add gesetze/github-sync.ts + gesetze/parser.ts
  4b. Add queue/processors/gesetze.processor.ts
  4c. Add gesetzeSyncQueue to queues.ts + registerGesetzeSyncJob()
  4d. Register processor in worker entrypoint
  4e. Manual trigger admin endpoint to run first sync
  (End-to-end validated: GitHub -> parse -> chunk -> embed -> pgvector -> Meilisearch -> ki-chat)

Phase 5 — PII Filter (prerequisite for Urteile and kanzlei-eigene Muster)
  5a. Add pii-filter/index.ts with Ollama NER prompt
  5b. Test with sample court ruling text (unit test with mocked Ollama)

Phase 6 — Urteile RAG (most complex source)
  6a. Add urteile/bmj-scraper.ts (rate limited, raw HTML to MinIO)
  6b. Add urteile/bag-rss.ts
  6c. Add queue/processors/urteile.processor.ts (includes PII filter step)
  6d. Add urteilIngestionQueue to queues.ts + registerUrteilCronJob()
  6e. Register processor in worker entrypoint

Phase 7 — Muster RAG + Admin UI (user-facing)
  7a. Add muster/uploader.ts
  7b. Add queue/processors/muster.processor.ts
  7c. Add musterIngestionQueue to queues.ts
  7d. Add api/admin/muster/route.ts (multipart upload handler)
  7e. Add admin/muster/page.tsx (shadcn/ui file input + data table with status column)
  7f. Register processor in worker entrypoint

Phase 8 — Normen-Verknuepfung in Akte (UI integration)
  8a. Add api/akten/[id]/normen/route.ts
  8b. Add NormenCard component in akte detail page (or sidebar panel)
  8c. Extend AI scan processor: extract § citations -> auto-create AkteNorm records
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Kanzlei (1-20 users, <100k chunks) | Current monolith fine. All workers in single BullMQ worker process. Meilisearch + pgvector on same Docker host. |
| Mid (20-100 users, <1M chunks) | Tune HNSW `ef_construction` to 128. Add BullMQ concurrency limits per queue to prevent Ollama saturation during batch ingestion. |
| Large (100+ users, >1M chunks) | Move pgvector to dedicated PostgreSQL instance. Consider a smaller dedicated embedding model on GPU-accelerated worker. Split Meilisearch indexes by Rechtsgebiet. |

### Scaling Priorities

1. **First bottleneck:** Ollama reranking latency. If qwen3.5:35b is too slow for reranking 20 candidates in 2 seconds, add a dedicated smaller model for reranking (e.g., a fine-tuned cross-encoder model served separately, or use cosine score directly for reranking as a fast fallback).
2. **Second bottleneck:** HNSW search across four tables via UNION queries. Mitigate with the `scope` parameter in `searchAcross()`: akte-specific chat only searches `document_chunks`, global legal questions search all four. Avoids scanning 200k law_chunks for a factual document question.

---

## Anti-Patterns

### Anti-Pattern 1: Synchronous PII Filter in the Upload API Route

**What people do:** Call `pii-filter/index.ts` inside the POST /api/admin/muster handler before returning 200, so the admin waits for Ollama to process the whole document.

**Why it's wrong:** PII filtering a multi-page document via Ollama takes 5-30 seconds. The API route would timeout. The file upload appears to hang or fail.

**Do this instead:** Upload to MinIO immediately, enqueue `muster-ingestion` BullMQ job, return 200 with `{ status: "PENDING", musterId }`. The processor handles PII filter + embedding asynchronously. Admin UI polls `GET /api/admin/muster?status=PENDING` to show progress. Match the pattern already used for OCR jobs in the existing codebase.

### Anti-Pattern 2: Embedding Full Law Paragraphs as Single Vectors

**What people do:** Embed the entire content of `§ 823 BGB` (including all sub-paragraphs, Absatz 1, Absatz 2, special cases) as one 1024-dimensional vector.

**Why it's wrong:** Long legal paragraphs exceed the ~512 token practical window of multilingual-e5-large-instruct. Cosine similarity quality degrades significantly for texts over 500 tokens. The embedding becomes a blurry average of many distinct legal concepts.

**Do this instead:** Apply parent-child chunking. Children (~500 tokens) are the retrieval units with precise embeddings. The parent (~2000 tokens) stores the surrounding context and is passed to the LLM as the actual prompt context. Retrieval precision is maintained by the small child; LLM quality is maintained by the large parent.

### Anti-Pattern 3: Querying All Four Chunk Tables for Every ki-chat Request

**What people do:** Every `hybridSearch()` call always searches `document_chunks + law_chunks + urteil_chunks + muster_chunks` via UNION regardless of context.

**Why it's wrong:** An akte-specific question "Wann wurde der Vertrag geschlossen?" should not search 200k Gesetze chunks. It adds latency and contaminates the top-20 candidates with irrelevant legal boilerplate, wasting the reranker's capacity.

**Do this instead:** Use the `scope` parameter. `"akte-only"`: search only `document_chunks` for the given akteId. `"law"`: search `law_chunks + muster_chunks`. `"full"`: search all four. The ki-chat route sets scope based on the presence of `akteId` and query content signals (does the query contain Gesetze keywords like "§", "BGB", "Urteil"?).

### Anti-Pattern 4: Committing the bundestag/gesetze Repo into the Docker Image

**What people do:** Clone bundestag/gesetze in the Dockerfile RUN layer, baking 600MB of law text into every Docker image build.

**Why it's wrong:** Images become multi-GB. Every `docker build` re-clones. Any law update requires a full image rebuild and redeploy. CI/CD pipeline breaks on large images.

**Do this instead:** Mount a named Docker volume (`gesetze-data:/data/gesetze`). The BullMQ gesetze-sync cron job runs `isomorphic-git` pull into that volume path on schedule. The repo persists between container restarts and rebuilds. First ever run does a shallow clone (`depth: 1`), subsequent runs do incremental pulls.

---

## Sources

- Direct codebase inspection: `src/lib/embedding/embedder.ts`, `src/lib/embedding/chunker.ts`, `src/lib/embedding/vector-store.ts`, `src/lib/meilisearch.ts`, `src/lib/queue/queues.ts`, `src/lib/queue/processors/embedding.processor.ts`, `src/app/api/ki-chat/route.ts`, `prisma/schema.prisma`
- pgvector HNSW index documentation: https://github.com/pgvector/pgvector — m=16, ef_construction=64 are the recommended defaults for datasets under 1M rows
- Reciprocal Rank Fusion: Cormack, Clarke & Buettcher (2009) — k=60 is the empirically validated constant that prevents any single rank-1 result from dominating
- BullMQ `upsertJobScheduler` pattern: matches existing usage in `src/lib/queue/queues.ts` (frist-reminder, ai-proactive, ai-briefing)
- isomorphic-git: https://isomorphic-git.org — pure JavaScript git implementation, no binary dependency, works in Node.js Docker containers without git installed
- Confidence: HIGH for integration architecture (all patterns verified against existing codebase conventions); MEDIUM for Ollama reranking latency numbers (hardware-dependent)

---

*Architecture research for: Helena RAG extension (v0.1) — Legal RAG integration into AI-Lawyer*
*Researched: 2026-02-26*
