/**
 * Urteile ingestion pipeline: PII-gated ingestion, GUID cache, pgvector search.
 *
 * Mirrors src/lib/gesetze/ingestion.ts structure. Key differences:
 * - runNerFilter() is called inline as synchronous DSGVO gate before any INSERT
 * - GUID cache (not SHA cache) stored in SystemSetting for deduplication
 * - DELETE+INSERT idempotency keyed on sourceUrl (same pattern as law_chunks)
 * - searchUrteilChunks() filters empty/null aktenzeichen per URTEIL-04 compliance
 *
 * CRITICAL — error handling:
 * - ingestUrteilItem() NEVER throws — all errors are caught and return "error"
 * - runNerFilter AbortError (Ollama unreachable/timeout) propagates through outer catch
 *   and returns "error" — telling the processor NOT to mark the GUID as seen,
 *   so the item retries on the next cron. This is correct per Pitfall 5 in research.
 * - hasPii: true → "pii_rejected" (no INSERT, GUID can be marked seen to skip permanently)
 */

import pgvector from "pgvector";
import { prisma } from "@/lib/db";
import { generateEmbedding, MODEL_VERSION } from "@/lib/embedding/embedder";
import { runNerFilter } from "@/lib/pii/ner-filter";
import { getSetting, updateSetting } from "@/lib/settings/service";
import type { UrteilRssItem } from "./rss-client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GUID_CACHE_KEY = "urteile.seen_guids";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A result row from searchUrteilChunks() — pgvector cosine similarity search.
 */
export interface UrteilChunkResult {
  id: string;
  aktenzeichen: string;
  gericht: string;
  datum: Date;
  rechtsgebiet: string | null;
  content: string;
  sourceUrl: string;
  /** Cosine similarity score: 1.0 = identical, 0.0 = orthogonal */
  score: number;
}

// ---------------------------------------------------------------------------
// GUID cache (stored in SystemSetting as JSON string)
// ---------------------------------------------------------------------------

/**
 * Load the GUID cache from the Settings table.
 * Returns an empty Set if the setting does not exist yet.
 */
export async function loadGuidCache(): Promise<Set<string>> {
  const raw = await getSetting(GUID_CACHE_KEY);
  if (!raw) return new Set();
  return new Set(JSON.parse(raw) as string[]);
}

/**
 * Persist the GUID cache to the Settings table as a JSON string.
 */
export async function saveGuidCache(guids: Set<string>): Promise<void> {
  await updateSetting(GUID_CACHE_KEY, JSON.stringify(Array.from(guids)));
}

// ---------------------------------------------------------------------------
// Ingestion (PII-gated, idempotent)
// ---------------------------------------------------------------------------

/**
 * Ingest a single UrteilRssItem into urteil_chunks with inline NER gate.
 *
 * Flow:
 *  1. Build NER text (leitsatz preferred; structured fallback for empty leitsatz)
 *  2. runNerFilter() — if hasPii: true → return "pii_rejected" immediately (no INSERT)
 *  3. Generate embedding for the content
 *  4. DELETE existing row for this sourceUrl (idempotent)
 *  5. INSERT new row with piiFiltered: true
 *  6. Return "inserted"
 *
 * On any error (including Ollama AbortError/timeout): return "error".
 * The caller (BullMQ processor) must NOT mark the GUID as seen on "error",
 * so the item retries on the next cron run.
 *
 * @returns "inserted" | "pii_rejected" | "error"
 */
export async function ingestUrteilItem(
  item: UrteilRssItem
): Promise<"inserted" | "pii_rejected" | "error"> {
  try {
    // Build text for NER analysis — prefer leitsatz, fall back to structured string
    const nerText =
      item.leitsatz.trim().length > 0
        ? item.leitsatz
        : `${item.entscheidungstyp} des ${item.gericht} vom ${item.datum.toLocaleDateString("de-DE")} (${item.aktenzeichen})`;

    // DSGVO gate: run NER PII filter inline
    const nerResult = await runNerFilter(nerText);
    if (nerResult.hasPii) {
      console.warn(
        `[urteile-ingestion] PII detected in ${item.gericht} ${item.aktenzeichen} — skipping`
      );
      return "pii_rejected";
    }

    // Content to store — same as NER text
    const content = nerText;

    // Generate embedding
    const embedding = await generateEmbedding(content);
    const vectorSql = pgvector.toSql(embedding);

    // DELETE existing row for this sourceUrl (idempotent re-index)
    await prisma.$executeRaw`
      DELETE FROM urteil_chunks WHERE "sourceUrl" = ${item.sourceUrl}
    `;

    // INSERT with embedding — piiFiltered=true confirms NER gate was passed
    await prisma.$executeRaw`
      INSERT INTO urteil_chunks (
        id,
        aktenzeichen,
        gericht,
        datum,
        rechtsgebiet,
        content,
        "parentContent",
        embedding,
        "modelVersion",
        "sourceUrl",
        "piiFiltered",
        "ingestedAt"
      )
      VALUES (
        gen_random_uuid(),
        ${item.aktenzeichen},
        ${item.gericht},
        ${item.datum},
        ${item.rechtsgebiet ?? null},
        ${content},
        ${content},
        ${vectorSql}::vector,
        ${MODEL_VERSION},
        ${item.sourceUrl},
        true,
        NOW()
      )
    `;

    return "inserted";
  } catch (err) {
    console.error(
      `[urteile-ingestion] Failed to ingest ${item.gericht} ${item.aktenzeichen}:`,
      err
    );
    return "error";
  }
}

// ---------------------------------------------------------------------------
// Search (used by ki-chat Chain E)
// ---------------------------------------------------------------------------

/**
 * Search urteil_chunks by vector cosine similarity (pgvector).
 *
 * Filters:
 * - embedding IS NOT NULL (skip rows without embeddings)
 * - piiFiltered = true (only NER-cleared items, per DSGVO gate)
 * - aktenzeichen not empty/null (URTEIL-04 compliance)
 * - score >= minScore (post-filter, default 0.0)
 *
 * Results are sorted by cosine similarity descending (closest first).
 *
 * @param queryEmbedding - Pre-computed query embedding (reuse from Chain B)
 * @param opts.limit - Maximum number of results (default 5)
 * @param opts.minScore - Minimum cosine similarity threshold (default 0.0)
 */
export async function searchUrteilChunks(
  queryEmbedding: number[],
  opts: { limit?: number; minScore?: number } = {}
): Promise<UrteilChunkResult[]> {
  const { limit = 5, minScore = 0.0 } = opts;
  const vectorSql = pgvector.toSql(queryEmbedding);

  type RawRow = {
    id: string;
    aktenzeichen: string;
    gericht: string;
    datum: Date;
    rechtsgebiet: string | null;
    content: string;
    sourceUrl: string;
    score: number;
  };

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      id,
      aktenzeichen,
      gericht,
      datum,
      rechtsgebiet,
      content,
      "sourceUrl",
      1 - (embedding <=> ${vectorSql}::vector) AS score
    FROM urteil_chunks
    WHERE embedding IS NOT NULL
      AND "piiFiltered" = true
    ORDER BY embedding <=> ${vectorSql}::vector ASC
    LIMIT ${limit}
  `;

  return rows
    // URTEIL-04 compliance: filter out rows with empty or null aktenzeichen
    .filter((r) => r.aktenzeichen && r.aktenzeichen.trim().length > 0)
    // Map score to number (BigDecimal from Postgres raw query)
    .map((r) => ({ ...r, score: Number(r.score) }))
    // Apply minimum score threshold
    .filter((r) => r.score >= minScore);
}
