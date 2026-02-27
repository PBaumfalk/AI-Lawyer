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
      INSERT INTO document_chunks (id, "dokumentId", "chunkIndex", content, embedding, "modelVersion", "createdAt")
      VALUES (gen_random_uuid(), ${dokumentId}, ${chunk.index}, ${chunk.content}, ${vectorSql}::vector, ${modelVersion}, NOW())
    `;
  }
}

/**
 * Insert parent-child chunks for a document.
 * PARENT chunks are stored without embedding (context retrieval only).
 * CHILD chunks are stored with embedding + parentChunkId FK.
 * Deletes existing chunks first (idempotent).
 */
export async function insertParentChildChunks(
  dokumentId: string,
  chunks: Array<{
    parent: { content: string; index: number };
    children: Array<{ content: string; index: number; embedding: number[] }>;
  }>,
  modelVersion: string
): Promise<void> {
  // Delete existing chunks first (idempotent re-embedding)
  await deleteChunks(dokumentId);

  for (const group of chunks) {
    // Insert PARENT chunk — no embedding (parents are 2000+ tokens, exceed embedding model limits)
    const parentIdRows = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO document_chunks (id, "dokumentId", "chunkIndex", content, embedding, "modelVersion", "createdAt", "chunkType")
      VALUES (gen_random_uuid(), ${dokumentId}, ${group.parent.index}, ${group.parent.content}, NULL, ${modelVersion}, NOW(), 'PARENT')
      RETURNING id
    `;
    const parentChunkId = parentIdRows[0].id;

    // Insert CHILD chunks with embedding and FK to parent
    for (const child of group.children) {
      const vectorSql = pgvector.toSql(child.embedding);
      await prisma.$executeRaw`
        INSERT INTO document_chunks (id, "dokumentId", "chunkIndex", content, embedding, "modelVersion", "createdAt", "chunkType", "parentChunkId")
        VALUES (gen_random_uuid(), ${dokumentId}, ${child.index}, ${child.content}, ${vectorSql}::vector, ${modelVersion}, NOW(), 'CHILD', ${parentChunkId})
      `;
    }
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

/**
 * Delete all chunks for a given document.
 */
export async function deleteChunks(dokumentId: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM document_chunks WHERE "dokumentId" = ${dokumentId}`;
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
  chunkType: string;            // 'STANDALONE' | 'CHILD' | 'PARENT'
  parentChunkId: string | null; // null for STANDALONE/PARENT, set for CHILD
  id: string;                   // chunk ID (needed for reranker and parent lookup)
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
    id: string;
    content: string;
    dokumentId: string;
    dokument_name: string;
    akte_aktenzeichen: string;
    akte_beschreibung: string;
    score: number;
    chunkIndex: number;
    chunkType: string;
    parentChunkId: string | null;
  };

  const mapRow = (r: RawRow): SearchResult => ({
    id: r.id,
    content: r.content,
    dokumentId: r.dokumentId,
    dokumentName: r.dokument_name,
    akteAktenzeichen: r.akte_aktenzeichen ?? "",
    akteBeschreibung: r.akte_beschreibung ?? "",
    score: Number(r.score),
    chunkIndex: r.chunkIndex,
    chunkType: r.chunkType,
    parentChunkId: r.parentChunkId ?? null,
  });

  if (crossAkte && userId) {
    // Cross-Akte: search all chunks from Akten the user is assigned to
    // (either as anwalt or sachbearbeiter)
    if (modelVersion) {
      const rows = await prisma.$queryRaw<RawRow[]>`
        SELECT
          dc.id,
          dc.content,
          dc."dokumentId",
          d.name AS dokument_name,
          a.aktenzeichen AS akte_aktenzeichen,
          a.kurzrubrum AS akte_beschreibung,
          1 - (dc.embedding <=> ${vectorSql}::vector) AS score,
          dc."chunkIndex",
          dc."chunkType",
          dc."parentChunkId"
        FROM document_chunks dc
        JOIN dokumente d ON d.id = dc."dokumentId"
        JOIN akten a ON a.id = d."akteId"
        WHERE (a."anwaltId" = ${userId} OR a."sachbearbeiterId" = ${userId})
          AND dc."modelVersion" = ${modelVersion}
          AND dc.embedding IS NOT NULL
          AND dc."chunkType" != 'PARENT'
        ORDER BY dc.embedding <=> ${vectorSql}::vector ASC
        LIMIT ${limit}
      `;
      return rows.map(mapRow);
    }

    const rows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        dc.id,
        dc.content,
        dc."dokumentId",
        d.name AS dokument_name,
        a.aktenzeichen AS akte_aktenzeichen,
        a.kurzrubrum AS akte_beschreibung,
        1 - (dc.embedding <=> ${vectorSql}::vector) AS score,
        dc."chunkIndex",
        dc."chunkType",
        dc."parentChunkId"
      FROM document_chunks dc
      JOIN dokumente d ON d.id = dc."dokumentId"
      JOIN akten a ON a.id = d."akteId"
      WHERE (a."anwaltId" = ${userId} OR a."sachbearbeiterId" = ${userId})
        AND dc.embedding IS NOT NULL
        AND dc."chunkType" != 'PARENT'
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
        dc.id,
        dc.content,
        dc."dokumentId",
        d.name AS dokument_name,
        a.aktenzeichen AS akte_aktenzeichen,
        a.kurzrubrum AS akte_beschreibung,
        1 - (dc.embedding <=> ${vectorSql}::vector) AS score,
        dc."chunkIndex",
        dc."chunkType",
        dc."parentChunkId"
      FROM document_chunks dc
      JOIN dokumente d ON d.id = dc."dokumentId"
      JOIN akten a ON a.id = d."akteId"
      WHERE d."akteId" = ${akteId}
        AND dc."modelVersion" = ${modelVersion}
        AND dc.embedding IS NOT NULL
        AND dc."chunkType" != 'PARENT'
      ORDER BY dc.embedding <=> ${vectorSql}::vector ASC
      LIMIT ${limit}
    `;
    return rows.map(mapRow);
  }

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      dc.id,
      dc.content,
      dc."dokumentId",
      d.name AS dokument_name,
      a.aktenzeichen AS akte_aktenzeichen,
      a.kurzrubrum AS akte_beschreibung,
      1 - (dc.embedding <=> ${vectorSql}::vector) AS score,
      dc."chunkIndex",
      dc."chunkType",
      dc."parentChunkId"
    FROM document_chunks dc
    JOIN dokumente d ON d.id = dc."dokumentId"
    JOIN akten a ON a.id = d."akteId"
    WHERE d."akteId" = ${akteId}
      AND dc.embedding IS NOT NULL
      AND dc."chunkType" != 'PARENT'
    ORDER BY dc.embedding <=> ${vectorSql}::vector ASC
    LIMIT ${limit}
  `;
  return rows.map(mapRow);
}

// ─── Parent Lookup ────────────────────────────────────────────────────────────

/**
 * Fetch parent chunk content for a set of CHILD chunk IDs.
 * Returns a Map from childId -> parentContent.
 * STANDALONE chunks (parentChunkId = NULL) are not returned — caller handles them separately.
 */
export async function fetchParentContent(
  chunkIds: string[]
): Promise<Map<string, string>> {
  if (chunkIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<
    Array<{ childId: string; parentContent: string }>
  >`
    SELECT dc_child.id AS "childId", dc_parent.content AS "parentContent"
    FROM document_chunks dc_child
    JOIN document_chunks dc_parent ON dc_parent.id = dc_child."parentChunkId"
    WHERE dc_child.id = ANY(${chunkIds})
      AND dc_child."chunkType" = 'CHILD'
      AND dc_parent."chunkType" = 'PARENT'
  `;

  const map = new Map<string, string>();
  rows.forEach((row) => map.set(row.childId, row.parentContent));
  return map;
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
      SELECT COUNT(DISTINCT "dokumentId")::bigint AS count FROM document_chunks WHERE embedding IS NOT NULL
    `,
    prisma.$queryRaw<{ modelVersion: string }[]>`
      SELECT DISTINCT "modelVersion" FROM document_chunks ORDER BY "modelVersion"
    `,
  ]);

  return {
    totalChunks: Number(countResult[0]?.count ?? 0),
    documentsWithEmbeddings: Number(docCountResult[0]?.count ?? 0),
    modelVersions: versionsResult.map((r) => r.modelVersion),
  };
}
