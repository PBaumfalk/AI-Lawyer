/**
 * law_chunks DB ingestion and search for Gesetze-RAG.
 *
 * upsertLawChunks(): Delete+re-insert law_chunks rows for changed Gesetze.
 * searchLawChunks(): pgvector cosine similarity search for ki-chat Chain D.
 * buildSourceUrl():  Construct canonical gesetze-im-internet.de URL.
 * loadShaCache():    Load SHA cache from SystemSetting for change detection.
 * saveShaCache():    Persist SHA cache to SystemSetting as JSON string.
 */

import pgvector from "pgvector";
import { prisma } from "@/lib/db";
import { generateEmbedding, MODEL_VERSION } from "@/lib/embedding/embedder";
import { getSetting, updateSetting } from "@/lib/settings/service";
import type { LawParagraph } from "@/lib/gesetze/markdown-parser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LawChunkResult {
  id: string;
  gesetzKuerzel: string;
  paragraphNr: string;
  titel: string;
  content: string;
  syncedAt: Date;
  sourceUrl: string | null;
  score: number;
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/**
 * Build canonical gesetze-im-internet.de URL for a paragraph.
 * Pattern: https://www.gesetze-im-internet.de/{slug}/__{nr}.html
 * Verified: https://www.gesetze-im-internet.de/bgb/__626.html returns 200.
 */
export function buildSourceUrl(slug: string, paragraphNr: string): string {
  const numMatch = paragraphNr.match(/§\s*(\w+)/);
  if (!numMatch) return `https://www.gesetze-im-internet.de/${slug}/`;
  return `https://www.gesetze-im-internet.de/${slug}/__${numMatch[1]}.html`;
}

// ---------------------------------------------------------------------------
// Ingestion
// ---------------------------------------------------------------------------

/**
 * Upsert law_chunks for a list of paragraphs from a single Gesetz.
 * Strategy: DELETE existing rows for each (gesetzKuerzel, paragraphNr) pair,
 * then INSERT with fresh embedding. Idempotent — safe to re-run on changed files.
 *
 * parentContent = content (§ paragraphs are atomic units; no further sub-chunking needed
 * for paragraphs < 4000 chars; for longer ones, truncate parentContent at 8000 chars).
 *
 * @returns { inserted, skipped } counts
 */
export async function upsertLawChunks(
  paragraphs: LawParagraph[],
  modelVersion: string = MODEL_VERSION
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const para of paragraphs) {
    if (!para.inhalt || para.inhalt.length < 10) {
      skipped++;
      continue;
    }

    try {
      const childContent = para.inhalt;
      // parentContent = same as content for Gesetze — § is the atomic unit.
      // Cap at 8000 chars if a rare long paragraph exceeds practical limit.
      const parentContent = para.inhalt.length > 8000
        ? para.inhalt.slice(0, 8000)
        : para.inhalt;

      const embedding = await generateEmbedding(childContent);
      const sourceUrl = buildSourceUrl(para.slug, para.paragraphNr);
      const vectorSql = pgvector.toSql(embedding);

      // Delete existing chunk for this law+paragraph (idempotent re-index)
      await prisma.$executeRaw`
        DELETE FROM law_chunks
        WHERE "gesetzKuerzel" = ${para.gesetzKuerzel}
          AND "paragraphNr" = ${para.paragraphNr}
      `;

      // Insert with embedding
      await prisma.$executeRaw`
        INSERT INTO law_chunks (
          id, "gesetzKuerzel", "paragraphNr", titel, content, "parentContent",
          embedding, "modelVersion", "syncedAt", "sourceUrl"
        )
        VALUES (
          gen_random_uuid(),
          ${para.gesetzKuerzel},
          ${para.paragraphNr},
          ${para.titel},
          ${childContent},
          ${parentContent},
          ${vectorSql}::vector,
          ${modelVersion},
          NOW(),
          ${sourceUrl}
        )
      `;

      inserted++;
    } catch (err) {
      console.error(`[gesetze-ingestion] Failed to upsert ${para.gesetzKuerzel} ${para.paragraphNr}:`, err);
      skipped++;
    }
  }

  return { inserted, skipped };
}

// ---------------------------------------------------------------------------
// Search (used by ki-chat Chain D)
// ---------------------------------------------------------------------------

/**
 * Search law_chunks by vector cosine similarity.
 * Returns top-N results sorted by descending cosine similarity (score = 1 - distance).
 * Only returns results where embedding IS NOT NULL (paranoia guard for first-run edge cases).
 *
 * Called from ki-chat/route.ts Chain D — reuses queryEmbedding from Chain B.
 */
export async function searchLawChunks(
  queryEmbedding: number[],
  opts: { limit?: number; minScore?: number } = {}
): Promise<LawChunkResult[]> {
  const { limit = 5, minScore = 0.0 } = opts;
  const vectorSql = pgvector.toSql(queryEmbedding);

  type RawRow = {
    id: string;
    gesetzKuerzel: string;
    paragraphNr: string;
    titel: string;
    content: string;
    syncedAt: Date;
    sourceUrl: string | null;
    score: number;
  };

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      id,
      "gesetzKuerzel",
      "paragraphNr",
      titel,
      content,
      "syncedAt",
      "sourceUrl",
      1 - (embedding <=> ${vectorSql}::vector) AS score
    FROM law_chunks
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorSql}::vector ASC
    LIMIT ${limit}
  `;

  return rows
    .map(r => ({ ...r, score: Number(r.score) }))
    .filter(r => r.score >= minScore);
}

// ---------------------------------------------------------------------------
// SHA cache (stored in SystemSetting as JSON string)
// ---------------------------------------------------------------------------

const SHA_CACHE_KEY = "gesetze.sha_cache";

/** Load SHA cache from Settings table. Returns {} if not yet set. */
export async function loadShaCache(): Promise<Record<string, string>> {
  try {
    const raw = await getSetting(SHA_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Persist SHA cache to Settings table as JSON string. */
export async function saveShaCache(cache: Record<string, string>): Promise<void> {
  await updateSetting(SHA_CACHE_KEY, JSON.stringify(cache));
}
