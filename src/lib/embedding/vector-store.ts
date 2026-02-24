/**
 * pgvector CRUD operations via Prisma raw SQL.
 * Handles inserting, deleting, and searching document chunk embeddings
 * using cosine similarity with the HNSW index.
 */

import { prisma } from "@/lib/db";
import pgvector from "pgvector";

// ─── Insert ──────────────────────────────────────────────────────────────────

/**
 * Insert embedding chunks for a document.
 * Deletes existing chunks first (idempotent re-embedding).
 */
export async function insertChunks(
  dokumentId: string,
  chunks: { content: string; index: number; embedding: number[] }[],
  modelVersion: string
): Promise<void> {
  // Delete existing chunks first for idempotent re-embedding
  await deleteChunks(dokumentId);

  for (const chunk of chunks) {
    const vectorSql = pgvector.toSql(chunk.embedding);
    await prisma.$executeRaw`
      INSERT INTO document_chunks (id, dokument_id, chunk_index, content, embedding, model_version, created_at)
      VALUES (gen_random_uuid(), ${dokumentId}, ${chunk.index}, ${chunk.content}, ${vectorSql}::vector, ${modelVersion}, NOW())
    `;
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

/**
 * Delete all chunks for a given document.
 */
export async function deleteChunks(dokumentId: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM document_chunks WHERE dokument_id = ${dokumentId}`;
}

// ─── Search ──────────────────────────────────────────────────────────────────

interface SearchResult {
  content: string;
  dokumentId: string;
  dokumentName: string;
  score: number;
  chunkIndex: number;
}

/**
 * Find the most similar chunks to a query embedding within a case.
 * Uses cosine similarity via pgvector's <=> operator.
 *
 * @param queryEmbedding - The query vector
 * @param akteId - Case ID to scope search
 * @param limit - Max results (default 10)
 * @param modelVersion - Filter by model version (optional, for safe upgrades)
 */
export async function searchSimilar(
  queryEmbedding: number[],
  akteId: string,
  limit = 10,
  modelVersion?: string
): Promise<SearchResult[]> {
  const vectorSql = pgvector.toSql(queryEmbedding);

  // Build the query based on whether model version filter is provided
  if (modelVersion) {
    const rows = await prisma.$queryRaw<
      {
        content: string;
        dokument_id: string;
        dokument_name: string;
        score: number;
        chunk_index: number;
      }[]
    >`
      SELECT
        dc.content,
        dc.dokument_id,
        d.name AS dokument_name,
        1 - (dc.embedding <=> ${vectorSql}::vector) AS score,
        dc.chunk_index
      FROM document_chunks dc
      JOIN dokumente d ON d.id = dc.dokument_id
      WHERE d.akte_id = ${akteId}
        AND dc.model_version = ${modelVersion}
        AND dc.embedding IS NOT NULL
      ORDER BY dc.embedding <=> ${vectorSql}::vector ASC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      content: r.content,
      dokumentId: r.dokument_id,
      dokumentName: r.dokument_name,
      score: Number(r.score),
      chunkIndex: r.chunk_index,
    }));
  }

  const rows = await prisma.$queryRaw<
    {
      content: string;
      dokument_id: string;
      dokument_name: string;
      score: number;
      chunk_index: number;
    }[]
  >`
    SELECT
      dc.content,
      dc.dokument_id,
      d.name AS dokument_name,
      1 - (dc.embedding <=> ${vectorSql}::vector) AS score,
      dc.chunk_index
    FROM document_chunks dc
    JOIN dokumente d ON d.id = dc.dokument_id
    WHERE d.akte_id = ${akteId}
      AND dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> ${vectorSql}::vector ASC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    content: r.content,
    dokumentId: r.dokument_id,
    dokumentName: r.dokument_name,
    score: Number(r.score),
    chunkIndex: r.chunk_index,
  }));
}

// ─── Stats ───────────────────────────────────────────────────────────────────

/**
 * Aggregate embedding statistics for admin dashboard.
 */
export async function getEmbeddingStats(): Promise<{
  totalChunks: number;
  documentsWithEmbeddings: number;
  modelVersions: string[];
}> {
  const [countResult, docCountResult, versionsResult] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count FROM document_chunks WHERE embedding IS NOT NULL
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT dokument_id)::bigint AS count FROM document_chunks WHERE embedding IS NOT NULL
    `,
    prisma.$queryRaw<{ model_version: string }[]>`
      SELECT DISTINCT model_version FROM document_chunks ORDER BY model_version
    `,
  ]);

  return {
    totalChunks: Number(countResult[0]?.count ?? 0),
    documentsWithEmbeddings: Number(docCountResult[0]?.count ?? 0),
    modelVersions: versionsResult.map((r) => r.model_version),
  };
}
