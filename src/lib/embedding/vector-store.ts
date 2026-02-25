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

export interface SearchResult {
  content: string;
  dokumentId: string;
  dokumentName: string;
  akteAktenzeichen: string;
  akteBeschreibung: string;
  score: number;
  chunkIndex: number;
}

interface SearchOptions {
  /** Case ID to scope search (required if crossAkte is false) */
  akteId?: string;
  /** Maximum number of results (default 10) */
  limit?: number;
  /** Filter by model version (optional, for safe upgrades) */
  modelVersion?: string;
  /** Search across all Akten the user has access to */
  crossAkte?: boolean;
  /** User ID for RBAC filtering in cross-Akte mode */
  userId?: string;
}

/**
 * Find the most similar chunks to a query embedding.
 * Uses cosine similarity via pgvector's <=> operator.
 *
 * Supports single-Akte mode (default) and cross-Akte mode
 * where results are filtered by Akten the user is assigned to.
 *
 * @param queryEmbedding - The query vector
 * @param opts - Search options including akteId, limit, crossAkte, userId
 */
export async function searchSimilar(
  queryEmbedding: number[],
  opts: SearchOptions
): Promise<SearchResult[]> {
  const { akteId, limit = 10, modelVersion, crossAkte = false, userId } = opts;
  const vectorSql = pgvector.toSql(queryEmbedding);

  type RawRow = {
    content: string;
    dokument_id: string;
    dokument_name: string;
    akte_aktenzeichen: string;
    akte_beschreibung: string;
    score: number;
    chunk_index: number;
  };

  const mapRow = (r: RawRow): SearchResult => ({
    content: r.content,
    dokumentId: r.dokument_id,
    dokumentName: r.dokument_name,
    akteAktenzeichen: r.akte_aktenzeichen ?? "",
    akteBeschreibung: r.akte_beschreibung ?? "",
    score: Number(r.score),
    chunkIndex: r.chunk_index,
  });

  if (crossAkte && userId) {
    // Cross-Akte: search all chunks from Akten the user is assigned to
    // (either as anwalt or sachbearbeiter)
    if (modelVersion) {
      const rows = await prisma.$queryRaw<RawRow[]>`
        SELECT
          dc.content,
          dc.dokument_id,
          d.name AS dokument_name,
          a.aktenzeichen AS akte_aktenzeichen,
          a.kurzrubrum AS akte_beschreibung,
          1 - (dc.embedding <=> ${vectorSql}::vector) AS score,
          dc.chunk_index
        FROM document_chunks dc
        JOIN dokumente d ON d.id = dc.dokument_id
        JOIN akten a ON a.id = d.akte_id
        WHERE (a.anwalt_id = ${userId} OR a.sachbearbeiter_id = ${userId})
          AND dc.model_version = ${modelVersion}
          AND dc.embedding IS NOT NULL
        ORDER BY dc.embedding <=> ${vectorSql}::vector ASC
        LIMIT ${limit}
      `;
      return rows.map(mapRow);
    }

    const rows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        dc.content,
        dc.dokument_id,
        d.name AS dokument_name,
        a.aktenzeichen AS akte_aktenzeichen,
        a.kurzrubrum AS akte_beschreibung,
        1 - (dc.embedding <=> ${vectorSql}::vector) AS score,
        dc.chunk_index
      FROM document_chunks dc
      JOIN dokumente d ON d.id = dc.dokument_id
      JOIN akten a ON a.id = d.akte_id
      WHERE (a.anwalt_id = ${userId} OR a.sachbearbeiter_id = ${userId})
        AND dc.embedding IS NOT NULL
      ORDER BY dc.embedding <=> ${vectorSql}::vector ASC
      LIMIT ${limit}
    `;
    return rows.map(mapRow);
  }

  // Single-Akte mode (original behavior)
  if (!akteId) return [];

  if (modelVersion) {
    const rows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        dc.content,
        dc.dokument_id,
        d.name AS dokument_name,
        a.aktenzeichen AS akte_aktenzeichen,
        a.kurzrubrum AS akte_beschreibung,
        1 - (dc.embedding <=> ${vectorSql}::vector) AS score,
        dc.chunk_index
      FROM document_chunks dc
      JOIN dokumente d ON d.id = dc.dokument_id
      JOIN akten a ON a.id = d.akte_id
      WHERE d.akte_id = ${akteId}
        AND dc.model_version = ${modelVersion}
        AND dc.embedding IS NOT NULL
      ORDER BY dc.embedding <=> ${vectorSql}::vector ASC
      LIMIT ${limit}
    `;
    return rows.map(mapRow);
  }

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      dc.content,
      dc.dokument_id,
      d.name AS dokument_name,
      a.aktenzeichen AS akte_aktenzeichen,
      a.kurzrubrum AS akte_beschreibung,
      1 - (dc.embedding <=> ${vectorSql}::vector) AS score,
      dc.chunk_index
    FROM document_chunks dc
    JOIN dokumente d ON d.id = dc.dokument_id
    JOIN akten a ON a.id = d.akte_id
    WHERE d.akte_id = ${akteId}
      AND dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> ${vectorSql}::vector ASC
    LIMIT ${limit}
  `;
  return rows.map(mapRow);
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
