# Stack Research

**Domain:** Legal RAG Enhancement — Hybrid Search, Cross-Encoder Reranking, Legal Data Ingestion, NER PII Filter (Helena v0.1 Milestone)
**Researched:** 2026-02-26
**Confidence:** MEDIUM-HIGH (core algorithms verified via official sources; Ollama reranking is emerging 2025 pattern, flagged separately)

> This document covers ONLY libraries to ADD for the Helena RAG milestone.
> The existing validated stack (Next.js 14, Prisma, PostgreSQL 16+pgvector, MinIO, Meilisearch, OnlyOffice, NextAuth v5, BullMQ+Redis, Vercel AI SDK v4, LangChain textsplitters, Ollama qwen3.5:35b) is NOT repeated here.

---

## Existing RAG Code to Extend (Not Replace)

| File | Current State | Extension Needed |
|------|--------------|-----------------|
| `src/lib/embedding/embedder.ts` | Ollama `/api/embed` with `multilingual-e5-large-instruct` (1024-dim) | Add query embedding for hybrid search |
| `src/lib/embedding/chunker.ts` | `RecursiveCharacterTextSplitter` 1000-char/200-overlap | Add parent (2000-char) + child (500-char) splitters |
| `src/lib/embedding/vector-store.ts` | `searchSimilar()` cosine via pgvector raw SQL | Add `hybridSearch()` that fuses pgvector + Meilisearch results |
| `src/app/api/ki-chat/route.ts` | top-10 cosine retrieval, direct to prompt | Add RRF fusion + optional reranking before prompt construction |
| `prisma/schema.prisma` | `DocumentChunk` model (no parent-child) | Add `chunkType`, `parentChunkId` to `DocumentChunk`; add `LawChunk`, `UrteilChunk`, `MusterChunk` tables |

---

## 1. Hybrid Search — Reciprocal Rank Fusion (RRF)

**No new npm library needed.** RRF is a 15-line pure TypeScript function with zero dependencies. The algorithm (Cormack et al. 2009, k=60) is mathematically stable and universally applied — Elasticsearch, OpenSearch, and Azure AI Search all use k=60 as default.

**Implementation — write to `src/lib/search/rrf.ts`:**

```typescript
/**
 * Reciprocal Rank Fusion — merges two ranked result lists.
 * k=60 is the standard regularization constant (Cormack et al. 2009).
 * Each item scores 1/(k + rank). Sum across all lists.
 */
export function reciprocalRankFusion<T extends { id: string }>(
  lists: T[][],
  k = 60
): (T & { rrfScore: number })[] {
  const scores = new Map<string, number>();
  const items = new Map<string, T>();

  for (const list of lists) {
    for (const [rank, item] of list.entries()) {
      scores.set(item.id, (scores.get(item.id) ?? 0) + 1 / (k + rank + 1));
      if (!items.has(item.id)) items.set(item.id, item);
    }
  }

  return [...scores.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([id, rrfScore]) => ({ ...items.get(id)!, rrfScore }));
}
```

**Integration point in `ki-chat/route.ts`:**

```typescript
// Run both retrievals in parallel
const [vectorResults, bm25Results] = await Promise.all([
  searchSimilar(queryEmbedding, { akteId, limit: 20 }),
  meilisearch.index('documents').search(lastUserMessage, { limit: 20 }),
]);

// Normalize Meilisearch results to have an `id` field matching chunk ID
const fused = reciprocalRankFusion([
  vectorResults.map(r => ({ ...r, id: r.dokumentId + ':' + r.chunkIndex })),
  bm25Chunks, // resolved from Meilisearch doc IDs to chunk IDs
], 60);

const topChunks = fused.slice(0, 10); // pass top-10 to prompt
```

**Meilisearch → chunk ID resolution:** Meilisearch indexes documents (not chunks). After getting document IDs from Meilisearch BM25, fetch their most-relevant chunks via a second pgvector query scoped to those document IDs. This keeps both lists on the same granularity (chunk level) for RRF.

---

## 2. Cross-Encoder Reranking via Ollama

**No dedicated npm package — use Ollama REST API directly** (`/api/generate` already used in the codebase).

**Two viable approaches, ordered by recommendation:**

### Option A (Recommended): LLM-as-reranker with `qwen3.5:35b` (already running)

Uses the existing model to score query-document relevance pairs. No additional model pull needed.

```typescript
// src/lib/search/reranker.ts
const RERANK_PROMPT = (query: string, passage: string) =>
  `Bewerte die Relevanz des Textes für die Anfrage.
Antworte NUR mit einer Zahl zwischen 0.0 und 1.0. Nichts sonst.

Anfrage: ${query}
Text: ${passage.slice(0, 600)}
Relevanz:`;

export async function rerankChunks(
  query: string,
  candidates: Array<{ id: string; content: string }>,
  topK = 5
): Promise<Array<{ id: string; content: string; rerankScore: number }>> {
  const scored = await Promise.all(
    candidates.map(async (c) => {
      const res = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL ?? 'qwen3.5:35b',
          prompt: RERANK_PROMPT(query, c.content),
          stream: false,
          options: { temperature: 0, num_predict: 5 },
        }),
      });
      const data = await res.json() as { response: string };
      const score = parseFloat(data.response.trim()) || 0;
      return { ...c, rerankScore: Math.min(1, Math.max(0, score)) };
    })
  );
  return scored.sort((a, b) => b.rerankScore - a.rerankScore).slice(0, topK);
}
```

**Latency:** ~200-400ms per candidate on GPU. Apply only on RRF top-20, return top-5. Run `Promise.all` in parallel — total latency ~400ms (not 20×400ms) if GPU handles concurrent requests.

### Option B (Alternative): `qwen3-reranker:1.5b` dedicated reranker model

Ollama added support for Qwen3 reranker models in mid-2025. Smaller and faster than 35b for reranking.

```bash
ollama pull qwen3-reranker:1.5b
```

Uses same `qwen3.5:35b` REST pattern but with a dedicated model. Requires testing whether model is available in the Ollama library for the current Ollama version.

**Confidence for Option B:** LOW — depends on Ollama version and whether `qwen3-reranker` is available. Option A is safe and battle-tested.

### Option C (Fallback): Skip reranking, use RRF only

RRF alone provides 60-70% of the quality improvement over pure cosine retrieval. If GPU is constrained or latency is unacceptable, skip reranking and return RRF top-5 directly to the prompt.

---

## 3. Parent-Child Chunking

**No new library.** Extend existing `@langchain/textsplitters` (already installed) and Prisma schema.

**Prisma schema changes to `document_chunks` + new `ChunkType` enum:**

```prisma
enum ChunkType {
  PARENT
  CHILD
}

model DocumentChunk {
  id             String     @id @default(cuid())
  dokumentId     String
  dokument       Dokument   @relation(fields: [dokumentId], references: [id], onDelete: Cascade)
  chunkIndex     Int
  content        String     @db.Text
  embedding      Unsupported("vector(1024)")?
  modelVersion   String
  createdAt      DateTime   @default(now())
  // Parent-child fields (new):
  chunkType      ChunkType  @default(CHILD)
  parentChunkId  String?
  parentChunk    DocumentChunk?  @relation("ParentChild", fields: [parentChunkId], references: [id])
  childChunks    DocumentChunk[] @relation("ParentChild")

  @@unique([dokumentId, chunkIndex])
  @@index([dokumentId])
  @@index([parentChunkId])
  @@map("document_chunks")
}
```

**Chunking strategy — extend `chunker.ts`:**

```typescript
// Parent: 2000 chars (~500 tokens) — stored for prompt context, NOT embedded
export function createParentSplitter(): RecursiveCharacterTextSplitter {
  return new RecursiveCharacterTextSplitter({
    chunkSize: 2000,
    chunkOverlap: 100,
    separators: GERMAN_LEGAL_SEPARATORS,
  });
}

// Child: 500 chars (~125 tokens) — embedded, used for retrieval
export function createChildSplitter(): RecursiveCharacterTextSplitter {
  return new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
    separators: GERMAN_LEGAL_SEPARATORS,
  });
}
```

**Query-time behavior:** Retrieve top-K child chunks (via hybrid search + reranking). Then fetch their parent chunks via `parentChunkId` for the LLM prompt. The child chunk gives precise semantic match; the parent chunk gives the LLM full paragraph context.

**Update to `insertChunks()` in `vector-store.ts`:** Accept parent/child structure, store parent (no embedding), then store children with `parentChunkId` FK.

---

## 4. Gesetze Ingestion — bundestag/gesetze GitHub

**Format confirmed via direct inspection:** All German federal laws as Markdown files (`.md`), organized in `a/`–`z/` subdirectories. Source: `https://github.com/bundestag/gesetze`. Updates are pushed when Bundesgesetzblatt publishes changes (~weekly).

**New library needed:**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `simple-git` | ^3.27.0 | Clone + incremental `git pull` of bundestag/gesetze in BullMQ worker | Thin wrapper over system git CLI. Zero native deps. Proven in Node.js workers. Alternatives (nodegit, isomorphic-git) are heavier or harder to maintain. |

```bash
npm install simple-git
```

**Implementation pattern (BullMQ job `gesetze-sync`):**

```typescript
import simpleGit from 'simple-git';
import fs from 'fs/promises';
import path from 'path';

const REPO_PATH = '/data/gesetze'; // Docker volume mount

export async function syncGesetze() {
  const git = simpleGit();
  try {
    await fs.access(path.join(REPO_PATH, '.git'));
    const result = await simpleGit(REPO_PATH).pull();
    // result.summary.changes = list of changed files
    return result.summary.changes; // only re-embed changed files
  } catch {
    // First run: clone shallow
    await git.clone('https://github.com/bundestag/gesetze.git', REPO_PATH, ['--depth=1']);
    return null; // signal full ingest on first run
  }
}
```

**Incremental sync:** `simple-git.pull()` returns changed file paths. Only re-chunk and re-embed changed `.md` files. Store last sync timestamp in a `sync_state` table keyed by `source = 'bundestag-gesetze'`.

**No additional parsing library.** bundestag/gesetze is already Markdown. Use `fs.readFile` + existing `createChildSplitter()` + `createParentSplitter()` from the extended `chunker.ts`.

**New Prisma table `law_chunks`** (separate from `document_chunks` to keep Kanzlei docs isolated from public law corpus):

```prisma
model LawChunk {
  id            String   @id @default(cuid())
  gesetzKuerzel String   // e.g. "BGB", "ZPO", "ArbGG"
  paragraph     String   // e.g. "§ 823", "§ 1" — extracted from Markdown heading
  content       String   @db.Text
  parentContent String?  @db.Text  // parent chunk text for LLM prompt
  embedding     Unsupported("vector(1024)")?
  modelVersion  String
  syncedAt      DateTime @default(now())
  sourceUrl     String?  // gesetze-im-internet.de canonical URL

  @@index([gesetzKuerzel])
  @@index([paragraph])
  @@map("law_chunks")
}
```

**Docker Compose addition:** Mount a volume for the cloned repo:

```yaml
volumes:
  - gesetze_data:/data/gesetze
```

Worker service needs git CLI (already available in Debian-based images). No Dockerfile change needed if base image has `git`.

---

## 5. Urteile Ingestion — BMJ Rechtsprechung-im-Internet

**RSS feeds confirmed via official BMJ documentation:** Seven XML RSS feeds provide newest court decisions as headlines + links.

| Court | Feed URL |
|-------|---------|
| BVerfG | `https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bverfg.xml` |
| BGH | `https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bgh.xml` |
| BVerwG | `https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bverwg.xml` |
| BFH | `https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bfh.xml` |
| BAG | `https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bag.xml` |
| BSG | `https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bsg.xml` |
| BPatG | `https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bpatg.xml` |

**New libraries needed:**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `rss-parser` | ^3.13.0 | Parse BMJ XML RSS feeds | De-facto standard Node.js RSS parser, handles XML → JS objects, date normalization, custom feed fields. ~2M weekly downloads. |
| `cheerio` | ^1.0.0 | Extract decision text from rechtsprechung-im-internet.de HTML pages | RSS items link to HTML pages containing the full decision text. Cheerio provides jQuery-like server-side HTML parsing — faster and lighter than Playwright/Puppeteer for simple DOM extraction. |

```bash
npm install rss-parser cheerio
```

**Implementation pattern (BullMQ job `urteil-fetch`):**

```typescript
import Parser from 'rss-parser';
import { load } from 'cheerio';

const parser = new Parser();

export async function fetchNewUrteile(feedUrl: string, since: Date) {
  const feed = await parser.parseURL(feedUrl);
  const newItems = feed.items.filter(
    item => item.pubDate && new Date(item.pubDate) > since
  );

  for (const item of newItems) {
    const html = await fetch(item.link!).then(r => r.text());
    const $ = load(html);
    // BMJ decision pages wrap decision text in .docLayoutArea or similar
    const text = $('.docLayoutArea').text() || $('body').text();
    // → PII filter → chunk → embed → store in urteil_chunks
  }
}
```

**Important:** Do not re-fetch decisions already in `urteil_chunks`. Check `sourceUrl` uniqueness before inserting. Store last-fetched timestamp per court/feed in `sync_state`.

**New Prisma table `urteil_chunks`:**

```prisma
model UrteilChunk {
  id            String   @id @default(cuid())
  aktenzeichen  String   // e.g. "8 AZR 123/24"
  gericht       String   // "BAG", "BGH", "BVerfG" etc.
  datum         DateTime
  content       String   @db.Text
  parentContent String?  @db.Text
  embedding     Unsupported("vector(1024)")?
  modelVersion  String
  piiFiltered   Boolean  @default(false)
  sourceUrl     String   @unique  // prevents re-fetching
  fetchedAt     DateTime @default(now())

  @@index([gericht])
  @@index([aktenzeichen])
  @@map("urteil_chunks")
}
```

---

## 6. NER PII Filter via Ollama

**No new npm library.** Use Ollama `qwen3.5:35b` (already running) with a structured prompt. Hybrid approach: fast regex pre-pass for structured PII (phone, email, IBAN) + LLM NER pass for German names and addresses.

**Implementation — write to `src/lib/pii/ner-filter.ts`:**

```typescript
const PII_PROMPT = (text: string) =>
  `Du bist ein Datenschutzfilter fuer deutsche Gerichtsurteile.
Ersetze alle personenbezogenen Daten von Privatpersonen durch Platzhalter.
Regeln:
- Vor-/Nachname einer Privatperson → [PERSON]
- Strasse + Hausnummer → [ADRESSE]
- Telefonnummer → [TEL]
- E-Mail-Adresse → [EMAIL]
- IBAN/Kontonummer → [KONTO]
Behalte unveraendert: Richternamen, Gerichtsbezeichnungen, Firmennamen, Gesetzeszitate, Aktenzeichen.
Antworte NUR mit dem anonymisierten Text, keine Erklaerungen.

Text:
${text.slice(0, 3000)}

Anonymisierter Text:`;

export async function filterPII(text: string): Promise<string> {
  // Pass 1: fast regex for structured PII
  let filtered = text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    .replace(/\+?49[\s-]?\d{3,4}[\s-]?\d{3,}/g, '[TEL]')
    .replace(/[A-Z]{2}\d{2}[\s]?[\dA-Z]{4,30}/g, '[KONTO]') // IBAN
    .replace(/\b\d{8,}\b/g, '[KONTO]'); // long numeric strings (account numbers)

  // Pass 2: LLM NER for names + addresses (3000-char chunks to stay in context)
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL ?? 'qwen3.5:35b',
        prompt: PII_PROMPT(filtered),
        stream: false,
        options: { temperature: 0, num_predict: 2000 },
      }),
    });
    const data = await res.json() as { response: string };
    return data.response.trim() || filtered;
  } catch {
    // If LLM fails, regex-only filtering is still better than nothing
    return filtered;
  }
}
```

**Performance note:** For batch Urteile ingestion, run `filterPII()` inside a separate low-priority BullMQ queue (`urteil-pii`). Mark `piiFiltered: false` on initial ingest. Block Helena retrieval of unfiltered chunks with `WHERE pii_filtered = true` in the query.

**Why not `pii-paladin` npm:** Uses compromise.js/wink-nlp which have poor German language coverage and no legal-domain training. Not suitable for German court decisions.

---

## 7. Kanzlei-Muster Upload — DOCX + PDF to Markdown

**PDF extraction:** `pdf-parse` is already in the stack (`^2.4.5`). No new library needed.

**DOCX extraction:** Use `mammoth` (DOCX → HTML) + `turndown` (HTML → Markdown). Mammoth's built-in Markdown output is officially deprecated per their own documentation — the correct pipeline is always DOCX → HTML → Markdown.

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `mammoth` | ^1.11.0 | DOCX to HTML | Only Node.js library that handles German Word documents reliably without requiring LibreOffice. Preserves paragraph/heading structure. Current version 1.11.0 (verified). |
| `turndown` | ^7.2.2 | HTML to Markdown | Recommended follow-on to mammoth. Handles all HTML elements, configurable heading styles. Current version 7.2.2 (verified). |

```bash
npm install mammoth turndown
npm install -D @types/turndown
```

**Implementation — write to `src/lib/ingestion/document-converter.ts`:**

```typescript
import mammoth from 'mammoth';
import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',       // # ## ### headings
  codeBlockStyle: 'fenced',  // ```code```
});

export async function docxToMarkdown(buffer: Buffer): Promise<string> {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  return turndown.turndown(html);
}

export async function pdfToText(buffer: Buffer): Promise<string> {
  // Dynamic import — pdf-parse uses require() internally, avoid SSR issues
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return data.text;
}
```

**New Prisma table `muster_chunks`:**

```prisma
model MusterChunk {
  id            String   @id @default(cuid())
  name          String   // e.g. "Abmahnung Arbeitsrecht"
  kategorie     String   // e.g. "Arbeitsrecht", "Mietrecht"
  content       String   @db.Text
  parentContent String?  @db.Text
  embedding     Unsupported("vector(1024)")?
  modelVersion  String
  minioPath     String   // original file path in MinIO (source of truth)
  uploadedById  String
  uploadedAt    DateTime @default(now())
  piiFiltered   Boolean  @default(false)

  @@index([kategorie])
  @@map("muster_chunks")
}
```

---

## Complete Installation Summary

```bash
# 5 new production packages total
npm install simple-git rss-parser cheerio mammoth turndown

# TypeScript types
npm install -D @types/turndown
```

Everything else (RRF, parent-child chunking, LLM reranking, PII NER, PDF text extraction) uses existing stack components with zero new npm dependencies.

---

## Recommended Stack (New Libraries Only)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `simple-git` | ^3.27.0 | Clone + incremental pull of bundestag/gesetze repo in BullMQ worker | Thin wrapper over system git CLI. Zero native binary deps. Proven in Node.js workers. `git.pull()` returns changed file list for incremental sync. |
| `rss-parser` | ^3.13.0 | Parse BMJ XML RSS feeds for court decisions | De-facto standard. Handles XML parsing, RFC 822 date normalization, custom feed fields. ~2M weekly downloads. |
| `cheerio` | ^1.0.0 | Extract decision text from rechtsprechung-im-internet.de HTML pages | jQuery-like server-side DOM parsing. Correct choice for simple HTML extraction — Playwright/Puppeteer would be massive overkill. |
| `mammoth` | ^1.11.0 | DOCX to HTML for Kanzlei-Muster upload pipeline | Only reliable DOCX parser for Node.js without a LibreOffice sidecar. Preserves paragraph structure for German legal documents. |
| `turndown` | ^7.2.2 | HTML to Markdown (after mammoth) | Mammoth's own Markdown output is officially deprecated. Turndown is the canonical follow-on step. |

### Zero-Dependency Implementations (TypeScript Only)

| Feature | Approach | File to Create |
|---------|---------|----------------|
| RRF hybrid fusion | 15-line pure TypeScript function | `src/lib/search/rrf.ts` |
| Cross-encoder reranking | Ollama `/api/generate` REST call | `src/lib/search/reranker.ts` |
| Parent-child chunking | Extended `@langchain/textsplitters` | Extend `src/lib/embedding/chunker.ts` |
| PII NER filter | Regex pre-pass + Ollama LLM NER | `src/lib/pii/ner-filter.ts` |
| DOCX/PDF conversion | mammoth + turndown + pdf-parse | `src/lib/ingestion/document-converter.ts` |

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Hand-written RRF function | `rerank-ts` npm package | Adds a dependency for a formula that is 15 lines of TypeScript. Zero value over DIY. |
| Ollama LLM reranking | Cohere Rerank API | Cloud dependency, DSGVO risk (data leaves the system), monthly cost. Violates self-hosted constraint. |
| Ollama LLM reranking | Dedicated Python cross-encoder service | New Docker service + Python runtime. Violates no-new-services constraint. |
| Ollama LLM NER for PII | `pii-paladin` npm | Uses compromise.js/wink-nlp with poor German coverage. Not legal-domain aware. |
| `rss-parser` + `cheerio` for Urteile | BMJ bulk download / API | No official API exists. RSS feeds are the official documented mechanism (confirmed on BMJ site). |
| `simple-git` for Gesetze | `isomorphic-git` | More complex for a simple clone+pull workflow. simple-git's pull summary with changed files is exactly what incremental sync needs. |
| `simple-git` for Gesetze | `nodegit` | Native bindings that break on Node.js version upgrades. simple-git uses git CLI via child_process. |
| `mammoth` + `turndown` | LibreOffice DOCX conversion | Requires a LibreOffice Docker sidecar — unnecessary operational complexity for DOCX → text extraction. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Python NER libraries (spaCy, Flair, transformers) | Introduces Python runtime + new Docker service. Violates stack constraint. | Ollama `qwen3.5:35b` with structured NER prompt |
| LangChain `ParentDocumentRetriever` | Python-only. The JS LangChain port lacks this retriever. | Hand-implement parent lookup in `vector-store.ts` |
| Separate cross-encoder Docker service (HuggingFace TEI, Triton) | New service + GPU contention with Ollama. | Ollama reranking (Option A) or RRF-only (Option C) |
| `playwright` / `puppeteer` for BMJ scraping | Requires Chromium, heavyweight, slow for simple HTML extraction | `cheerio` on raw `fetch()` response |
| `wink-nlp` / `compromise.js` for German NER | Trained on English, minimal German legal vocabulary | Ollama LLM NER |
| `nodegit` | Native bindings, complex build, breaks on Node.js upgrades | `simple-git` |
| `docx2md` npm | Unmaintained. Last release 2020. | `mammoth` + `turndown` |

---

## Stack Patterns by Variant

**If GPU is constrained (slow reranking):**
- Skip LLM reranking (Option C)
- Return RRF top-5 directly to the prompt
- RRF alone provides ~60-70% of quality improvement over baseline cosine-only

**If bundestag/gesetze repo is too large for Docker volume:**
- Use `git sparse-checkout` via simple-git to clone only relevant Rechtsgebiete:
- `await simpleGit(REPO_PATH).raw(['sparse-checkout', 'set', 'a/arbgg', 'b/bgb', 'z/zpo'])`

**If Ollama NER is too slow for batch Urteile ingestion:**
- Use a separate low-priority BullMQ queue (`urteil-pii`) for PII filtering
- Ingest first (mark `piiFiltered: false`), filter async
- Block Helena retrieval of unfiltered chunks via `AND pii_filtered = true` in SQL

**If parent-child chunking adds too much DB storage:**
- Store `parentContent` as TEXT inline on each child chunk (denormalized)
- Instead of FK to parent row — simpler retrieval, more storage
- Avoids a second DB round-trip at query time

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|----------------|-------|
| `simple-git@^3.27.0` | Node.js 16+ | Requires git CLI in Docker image. Debian-based images have git by default. |
| `rss-parser@^3.13.0` | Node.js 14+ | No native deps. Works in Next.js API routes and BullMQ worker. |
| `cheerio@^1.0.0` | Node.js 14+ | v1.0 stable (released 2023). Use `load()` API not `cheerio()` (the latter is removed in v1). |
| `mammoth@^1.11.0` | Node.js 12+ | Accepts `{ buffer: Buffer }` — compatible with MinIO stream-to-buffer pattern already in use. |
| `turndown@^7.2.2` | Node.js + Browser | Requires `@types/turndown` for TypeScript. No peer dependency issues. |

---

## Integration Points with Existing Code

| New Feature | Integrates With | Integration Notes |
|-------------|----------------|------------------|
| Hybrid Search (RRF) | `src/lib/embedding/vector-store.ts` + `meilisearch` client | Add `hybridSearch()` alongside existing `searchSimilar()`. Share the same Meilisearch client instance already configured in the app. |
| Cross-Encoder Reranking | `src/app/api/ki-chat/route.ts` | Insert between RRF fusion and system prompt construction. Guard with `if (RERANKING_ENABLED)` env flag. |
| Parent-Child Chunking | `src/lib/embedding/chunker.ts` + `src/lib/embedding/vector-store.ts` | Extend `insertChunks()` to accept `{ parent: ChunkData; children: ChunkData[] }`. Update OCR processor to call new signature. |
| Gesetze Sync | BullMQ worker (`src/lib/queue/processors/`) | New processor `gesetze-sync.processor.ts`. Schedule daily via BullMQ cron (same pattern as `vorfristen-cron`). |
| Urteile RSS Fetch | BullMQ worker | New processor `urteil-fetch.processor.ts`. Schedule daily per court. |
| PII Filter | Called inside `urteil-fetch` processor | Sequential: fetch RSS → fetch HTML → extract text → PII filter → chunk → embed → insert `urteil_chunks`. |
| Muster Upload | New API route `/api/admin/muster/upload` | MinIO upload (existing S3 client) + enqueue BullMQ job for conversion + chunking + embedding. |
| Helena RAG retrieval | `src/app/api/ki-chat/route.ts` | Extend source selection: query `document_chunks`, `law_chunks`, `urteil_chunks`, `muster_chunks` in parallel. Merge results via RRF before reranking. |

---

## Sources

- bundestag/gesetze repo format: https://github.com/bundestag/gesetze — direct inspection, Markdown format confirmed (HIGH confidence)
- BMJ RSS feed URLs: https://www.rechtsprechung-im-internet.de/jportal/portal/page/bsjrsprod.psml?cmsuri=/technik/de/hilfe_1/bsjrsrss.jsp&riinav=3 — official BMJ documentation, all 7 feed URLs confirmed (HIGH confidence)
- `simple-git` npm: https://www.npmjs.com/package/simple-git — v3.27.0, actively maintained (HIGH confidence)
- `rss-parser` npm: https://www.npmjs.com/package/rss-parser — v3.13.0 confirmed (HIGH confidence)
- `cheerio` npm: https://www.npmjs.com/package/cheerio — v1.0.0 stable release (HIGH confidence)
- `mammoth` npm: https://www.npmjs.com/package/mammoth — v1.11.0 confirmed current (HIGH confidence)
- `turndown` npm: https://www.npmjs.com/package/turndown — v7.2.2 confirmed current (HIGH confidence)
- RRF algorithm (k=60): Cormack et al. 2009, validated via Elasticsearch RRF docs + multiple production implementations (HIGH confidence)
- Mammoth Markdown deprecation: https://github.com/mwilliamson/mammoth.js — README explicitly states Markdown output is deprecated (HIGH confidence)
- Ollama reranking with Qwen3: https://www.glukhov.org/post/2025/06/qwen3-embedding-qwen3-reranker-on-ollama/ — 2025 article, Go examples but REST API is identical (MEDIUM confidence)
- Ollama LLM NER for PII: https://drezil.de/Writing/ner4all-case-study.html — local LLM NER case study, German legal specifics are extrapolation (MEDIUM confidence)

---

*Stack research for: Helena RAG Enhancement — AI-Lawyer v0.1 milestone*
*Researched: 2026-02-26*
