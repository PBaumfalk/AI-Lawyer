/**
 * Hybrid search orchestrator: BM25 (Meilisearch) + vector (pgvector) + RRF + LLM reranker.
 *
 * Pipeline:
 *   1. Parallel: BM25 via Meilisearch + vector via pgvector
 *   2. BM25 document → best child chunk resolution (single SQL round-trip)
 *   3. RRF fusion of BM25 and vector candidate lists
 *   4. LLM reranking via Ollama (graceful fallback to RRF order)
 *   5. Parent content lookup for context (CHILD → parent, STANDALONE → self)
 *   6. Return HybridSearchResult[] with contextContent populated
 */

import { prisma } from "@/lib/db";
import pgvector from "pgvector";
import { searchDokumente } from "@/lib/meilisearch";
import { rerankWithOllama, type RrfCandidate } from "@/lib/ai/reranker";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Final hybrid search result with both retrieval evidence and LLM context.
 */
export interface HybridSearchResult {
  id: string;
  dokumentId: string;
  dokumentName: string;
  akteAktenzeichen: string;
  akteBeschreibung: string;
  /** Child chunk content — the retrieval match evidence */
  content: string;
  /**
   * Parent chunk content (2000 tokens) for CHILD chunks, or
   * the chunk content itself for STANDALONE chunks.
   * Used in the LLM prompt for context-rich answers.
   */
  contextContent: string;
  /** RRF score */
  score: number;
  sources: ("bm25" | "vector")[];
}

// ─── RRF ─────────────────────────────────────────────────────────────────────

/** RRF constant k=60 per original paper (Robertson et al., 2009) */
const RRF_K = 60;

/**
 * Reciprocal Rank Fusion of two ranked candidate lists.
 * Merges by chunk ID — candidates appearing in both lists get additive score boost.
 *
 * @param bm25Candidates - Candidates from BM25 (in rank order, rank 1 = best)
 * @param vectorCandidates - Candidates from vector search (in rank order)
 * @param limit - Maximum number of results to return
 * @returns Fused and sorted candidates
 */
export function reciprocalRankFusion(
  bm25Candidates: RrfCandidate[],
  vectorCandidates: RrfCandidate[],
  limit: number
): RrfCandidate[] {
  const scoreMap = new Map<
    string,
    { score: number; data: RrfCandidate; sources: Set<"bm25" | "vector"> }
  >();

  // Process BM25 list (1-indexed rank)
  bm25Candidates.forEach((candidate, index) => {
    const rank = index + 1;
    const rrfScore = 1 / (RRF_K + rank);
    const existing = scoreMap.get(candidate.id);
    if (existing) {
      existing.score += rrfScore;
      existing.sources.add("bm25");
    } else {
      scoreMap.set(candidate.id, {
        score: rrfScore,
        data: candidate,
        sources: new Set<"bm25" | "vector">(["bm25"]),
      });
    }
  });

  // Process vector list (1-indexed rank)
  vectorCandidates.forEach((candidate, index) => {
    const rank = index + 1;
    const rrfScore = 1 / (RRF_K + rank);
    const existing = scoreMap.get(candidate.id);
    if (existing) {
      existing.score += rrfScore;
      existing.sources.add("vector");
    } else {
      scoreMap.set(candidate.id, {
        score: rrfScore,
        data: candidate,
        sources: new Set<"bm25" | "vector">(["vector"]),
      });
    }
  });

  // Sort by RRF score descending and build result
  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => ({
      ...entry.data,
      score: entry.score,
      sources: Array.from(entry.sources),
    }));
}

// ─── Internal SQL types ───────────────────────────────────────────────────────

interface ChunkRow {
  id: string;
  dokumentId: string;
  dokument_name: string;
  akte_aktenzeichen: string;
  akte_beschreibung: string;
  content: string;
  chunk_type: string;
  parent_chunk_id: string | null;
  score: number;
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Hybrid search combining BM25 + pgvector + RRF + Ollama reranking.
 *
 * @param queryText - The raw user query string
 * @param queryEmbedding - Pre-computed query embedding vector
 * @param opts - Search options
 */
export async function hybridSearch(
  queryText: string,
  queryEmbedding: number[],
  opts: {
    akteId?: string;
    crossAkte?: boolean;
    userId?: string;
    bm25Limit?: number;
    vectorLimit?: number;
    finalLimit?: number;
  }
): Promise<HybridSearchResult[]> {
  // Guard: empty query
  if (!queryText.trim()) return [];

  const {
    akteId,
    crossAkte = false,
    userId,
    bm25Limit = 50,
    vectorLimit = 50,
    finalLimit = 10,
  } = opts;

  const vectorSql = pgvector.toSql(queryEmbedding);

  // ── Step 1: Parallel retrieval ──────────────────────────────────────────────

  const [bm25Response, vectorRows] = await Promise.all([
    // BM25: Meilisearch document-level search
    searchDokumente(queryText, { akteId: crossAkte ? undefined : akteId, limit: bm25Limit }),

    // Vector: pgvector chunk-level search (raw SQL to get id + chunkType + parentChunkId)
    (async (): Promise<ChunkRow[]> => {
      if (crossAkte && userId) {
        return prisma.$queryRaw<ChunkRow[]>`
          SELECT
            dc.id,
            dc."dokumentId",
            d.name AS dokument_name,
            a.aktenzeichen AS akte_aktenzeichen,
            a.kurzrubrum AS akte_beschreibung,
            dc.content,
            dc."chunkType" AS chunk_type,
            dc."parentChunkId" AS parent_chunk_id,
            1 - (dc.embedding <=> ${vectorSql}::vector) AS score
          FROM document_chunks dc
          JOIN dokumente d ON d.id = dc."dokumentId"
          JOIN akten a ON a.id = d."akteId"
          WHERE (a."anwaltId" = ${userId} OR a."sachbearbeiterId" = ${userId})
            AND dc."chunkType" != 'PARENT'
            AND dc.embedding IS NOT NULL
          ORDER BY dc.embedding <=> ${vectorSql}::vector ASC
          LIMIT ${vectorLimit}
        `;
      }

      if (!akteId) return [];

      return prisma.$queryRaw<ChunkRow[]>`
        SELECT
          dc.id,
          dc."dokumentId",
          d.name AS dokument_name,
          a.aktenzeichen AS akte_aktenzeichen,
          a.kurzrubrum AS akte_beschreibung,
          dc.content,
          dc."chunkType" AS chunk_type,
          dc."parentChunkId" AS parent_chunk_id,
          1 - (dc.embedding <=> ${vectorSql}::vector) AS score
        FROM document_chunks dc
        JOIN dokumente d ON d.id = dc."dokumentId"
        JOIN akten a ON a.id = d."akteId"
        WHERE d."akteId" = ${akteId}
          AND dc."chunkType" != 'PARENT'
          AND dc.embedding IS NOT NULL
        ORDER BY dc.embedding <=> ${vectorSql}::vector ASC
        LIMIT ${vectorLimit}
      `;
    })(),
  ]);

  let bm25Hits = bm25Response.hits;

  // Cross-Akte RBAC: post-filter BM25 hits to only include accessible Akten
  if (crossAkte && userId && bm25Hits.length > 0) {
    const accessibleAkten = await prisma.akte.findMany({
      where: { OR: [{ anwaltId: userId }, { sachbearbeiterId: userId }] },
      select: { id: true },
    });
    const accessibleIds = new Set(accessibleAkten.map((a) => a.id));
    bm25Hits = bm25Hits.filter((hit) => accessibleIds.has(hit.akteId));
  }

  // Guard: both searches returned 0 results
  if (bm25Hits.length === 0 && vectorRows.length === 0) return [];

  // ── Step 2: BM25 document → best child chunk resolution ────────────────────

  let bm25ChunkCandidates: RrfCandidate[] = [];

  if (bm25Hits.length > 0) {
    // Build rank map: dokumentId → bm25 rank (1-indexed)
    const bm25RankMap = new Map<string, number>();
    bm25Hits.forEach((hit, index) => {
      bm25RankMap.set(hit.id, index + 1);
    });

    const bm25DocumentIds = bm25Hits.map((h) => h.id);

    // DISTINCT ON resolves: one best child chunk per BM25 document, ordered by vector similarity
    const bm25ChunkRows = await prisma.$queryRaw<ChunkRow[]>`
      SELECT DISTINCT ON (dc."dokumentId")
        dc.id,
        dc."dokumentId",
        d.name AS dokument_name,
        a.aktenzeichen AS akte_aktenzeichen,
        a.kurzrubrum AS akte_beschreibung,
        dc.content,
        dc."chunkType" AS chunk_type,
        dc."parentChunkId" AS parent_chunk_id,
        1 - (dc.embedding <=> ${vectorSql}::vector) AS score
      FROM document_chunks dc
      JOIN dokumente d ON d.id = dc."dokumentId"
      JOIN akten a ON a.id = d."akteId"
      WHERE dc."dokumentId" = ANY(${bm25DocumentIds})
        AND dc."chunkType" != 'PARENT'
        AND dc.embedding IS NOT NULL
      ORDER BY dc."dokumentId", dc.embedding <=> ${vectorSql}::vector ASC
    `;

    // Map to RrfCandidate — preserve BM25 document rank for RRF ordering
    bm25ChunkCandidates = bm25ChunkRows
      .sort((a, b) => {
        // Re-sort by BM25 document rank (DISTINCT ON doesn't preserve document order)
        const rankA = bm25RankMap.get(a.dokumentId) ?? 999;
        const rankB = bm25RankMap.get(b.dokumentId) ?? 999;
        return rankA - rankB;
      })
      .map((row) => ({
        id: row.id,
        dokumentId: row.dokumentId,
        dokumentName: row.dokument_name,
        akteAktenzeichen: row.akte_aktenzeichen ?? "",
        akteBeschreibung: row.akte_beschreibung ?? "",
        content: row.content,
        chunkType: row.chunk_type,
        parentChunkId: row.parent_chunk_id,
        score: Number(row.score),
        sources: ["bm25" as const],
      }));
  }

  // Map vector rows to RrfCandidate
  const vectorCandidates: RrfCandidate[] = vectorRows.map((row) => ({
    id: row.id,
    dokumentId: row.dokumentId,
    dokumentName: row.dokument_name,
    akteAktenzeichen: row.akte_aktenzeichen ?? "",
    akteBeschreibung: row.akte_beschreibung ?? "",
    content: row.content,
    chunkType: row.chunk_type,
    parentChunkId: row.parent_chunk_id,
    score: Number(row.score),
    sources: ["vector" as const],
  }));

  // ── Step 3: RRF fusion ──────────────────────────────────────────────────────

  const rrfTop50 = reciprocalRankFusion(bm25ChunkCandidates, vectorCandidates, 50);

  if (rrfTop50.length === 0) return [];

  // ── Step 4: LLM reranking ───────────────────────────────────────────────────

  const reranked = await rerankWithOllama(queryText, rrfTop50, 3000);

  // ── Step 5: Parent content lookup ───────────────────────────────────────────

  // Collect parentChunkIds for CHILD chunks (top results only)
  const childChunks = reranked.filter(
    (r) => r.chunkType === "CHILD" && r.parentChunkId
  );

  const parentContentMap = new Map<string, string>();

  if (childChunks.length > 0) {
    const parentIds = Array.from(new Set(childChunks.map((c) => c.parentChunkId!)))

    type ParentRow = { id: string; content: string };
    const parentRows = await prisma.$queryRaw<ParentRow[]>`
      SELECT id, content
      FROM document_chunks
      WHERE id = ANY(${parentIds})
    `;

    parentRows.forEach((row) => {
      parentContentMap.set(row.id, row.content);
    });
  }

  // ── Step 6: Build final results with contextContent ─────────────────────────

  // 12,000-char total budget: top 3 get full parent, rest get child content
  const CONTEXT_BUDGET_CHARS = 12_000;
  const FULL_CONTEXT_SLOTS = 3;

  let charBudgetRemaining = CONTEXT_BUDGET_CHARS;

  const results: HybridSearchResult[] = reranked
    .slice(0, finalLimit)
    .map((candidate, index) => {
      let contextContent: string;

      if (candidate.chunkType === "STANDALONE") {
        // STANDALONE: use own content as context
        contextContent = candidate.content;
      } else if (candidate.chunkType === "CHILD" && candidate.parentChunkId) {
        if (index < FULL_CONTEXT_SLOTS) {
          // Top-3: use full parent content
          contextContent =
            parentContentMap.get(candidate.parentChunkId) ?? candidate.content;
        } else {
          // Remaining: use child content to stay within budget
          contextContent = candidate.content;
        }
      } else {
        // Fallback (e.g., PARENT chunk without parent lookup)
        contextContent = candidate.content;
      }

      // Apply budget cap
      if (contextContent.length > charBudgetRemaining) {
        contextContent = contextContent.slice(0, charBudgetRemaining);
      }
      charBudgetRemaining = Math.max(0, charBudgetRemaining - contextContent.length);

      return {
        id: candidate.id,
        dokumentId: candidate.dokumentId,
        dokumentName: candidate.dokumentName,
        akteAktenzeichen: candidate.akteAktenzeichen,
        akteBeschreibung: candidate.akteBeschreibung,
        content: candidate.content,
        contextContent,
        score: candidate.score,
        sources: candidate.sources,
      };
    });

  return results;
}
