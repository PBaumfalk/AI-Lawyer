---
created: 2026-02-26T21:58:43.476Z
title: Improve Helena RAG pipeline with hybrid search and reranking
area: api
files:
  - src/lib/embedding/embedder.ts
  - src/lib/embedding/chunker.ts
  - src/lib/embedding/vector-store.ts
  - src/app/api/ki-chat/route.ts
---

## Problem

Helenas aktuelles RAG (multilingual-e5-large-instruct + pgvector, 1000-Zeichen-Chunks, Top-10 Cosine Similarity) ist funktional aber nicht NotebookLM-Qualität. Drei konkrete Lücken:

1. **Nur Vector Search** — Juristische Begriffe, Aktenzeichen (§ 433 BGB, Az. 12 O 345/23) und exakte Bezeichnungen werden von Embedding-Modellen oft schlechter gefunden als von Keyword-Suche. Meilisearch läuft bereits im Stack.

2. **Kein Reranking** — Top-10 per Cosine geht direkt in den Prompt. Irrelevante Chunks landen im Kontext, präzis relevante fallen raus. Ein Cross-Encoder als zweite Stufe würde massiv helfen.

3. **Kein Parent-Child Chunking** — 1000-Zeichen-Chunks werden eingebettet UND zurückgegeben. Retrieval-Precision vs. Kontext-Qualität sind im Konflikt. Lösung: kleine Chunks (500 Zeichen) für Embedding, Parent-Chunk (2000–3000 Zeichen) für den Prompt.

## Solution

Priorisiert nach Impact/Aufwand:

1. **Hybrid Search** (höchster Impact): Meilisearch BM25 + pgvector kombinieren via Reciprocal Rank Fusion (RRF). Meilisearch hat bereits Dokument-Volltext — nur Suche und Merge-Logik in `vector-store.ts` / `ki-chat/route.ts` ergänzen.

2. **Reranking**: Local cross-encoder via Ollama oder `cross-encoder/ms-marco-MiniLM-L-6-v2` als eigener Endpoint. Top-50 retrieven, Top-5–10 reranken.

3. **Parent-Child Chunking**: Schema-Migration (parent_chunk_id FK auf document_chunks), Chunker auf zwei Ebenen umstellen, vector-store gibt Parent-Content zurück.
