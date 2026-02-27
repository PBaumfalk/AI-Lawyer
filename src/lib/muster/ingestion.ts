/**
 * Muster ingestion pipeline: text extraction, parent-child chunking,
 * pgvector embedding, and semantic search with kanzleiEigen boost.
 *
 * Three public functions:
 * - extractMusterFullText: fetch from MinIO, extract text (PDF/DOCX/plain)
 * - insertMusterChunks: chunk + embed + store in muster_chunks (optional content param skips MinIO)
 * - searchMusterChunks: cosine similarity search with 1.3x boost for kanzleiEigen results
 *
 * The optional `content` parameter on insertMusterChunks is critical for
 * seedAmtlicheFormulare() — it bypasses MinIO entirely for hardcoded templates.
 */

import pgvector from "pgvector";
import { prisma } from "@/lib/db";
import { generateEmbedding, MODEL_VERSION } from "@/lib/embedding/embedder";
import { chunkDocumentParentChild } from "@/lib/embedding/chunker";
import { getFileStream } from "@/lib/storage";
import { convertToPdf } from "@/lib/ocr/stirling-client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Score multiplier applied to kanzleiEigen=true results in searchMusterChunks */
const KANZLEI_BOOST = 1.3;

/** Fetch factor: retrieve limit*3 candidates for post-query filtering */
const FETCH_FACTOR = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single result from searchMusterChunks with boost-adjusted score.
 */
export interface MusterChunkResult {
  id: string;
  musterId: string;
  content: string;
  parentContent: string | null;
  musterName: string;
  kategorie: string;
  /** True when chunk originates from a kanzlei-uploaded Muster (not amtlich seeded) */
  kanzleiEigen: boolean;
  /** Cosine similarity score with 1.3x multiplier applied for kanzleiEigen=true */
  score: number;
}

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

/**
 * Convert a readable stream (from MinIO / S3) to a Buffer.
 * Handles AWS SDK SdkStreamMixin, Blob, Web ReadableStream, and Node.js Readable.
 */
async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (!stream) throw new Error("No stream data received from storage");

  // Handle AWS SDK SdkStreamMixin (has transformToByteArray)
  if (typeof (stream as Record<string, unknown>).transformToByteArray === "function") {
    const bytes = await (stream as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }

  // Handle Blob (from newer AWS SDK versions)
  if (stream instanceof Blob) {
    const arrayBuffer = await stream.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Handle Web ReadableStream
  if (typeof (stream as Record<string, unknown>).getReader === "function") {
    const reader = (stream as ReadableStream).getReader();
    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) chunks.push(result.value);
    }
    return Buffer.concat(chunks);
  }

  // Handle Node.js Readable / AsyncIterable<Buffer>
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Extract the full text content of a Muster file from MinIO.
 *
 * MIME type routing:
 * - DOCX / DOC: convert to PDF via Stirling, then parse with pdf-parse
 * - PDF: parse directly with pdf-parse
 * - Fallback: read as UTF-8 string
 *
 * @throws When extracted text is shorter than 10 chars (indicates extraction failure)
 */
export async function extractMusterFullText(
  minioKey: string,
  mimeType: string
): Promise<string> {
  const stream = await getFileStream(minioKey);
  const buffer = await streamToBuffer(stream);

  let text: string;

  const isDocx =
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword";
  const isPdf = mimeType === "application/pdf";

  if (isDocx) {
    // Convert DOCX → PDF via Stirling, then extract text
    const pdfBuffer = await convertToPdf(buffer, "muster.docx");
    text = await parsePdfBuffer(pdfBuffer);
  } else if (isPdf) {
    text = await parsePdfBuffer(buffer);
  } else {
    // Plain text fallback
    text = buffer.toString("utf-8");
  }

  if (text.trim().length < 10) {
    throw new Error(
      `[muster-ingestion] Extracted text too short (${text.trim().length} chars) for key ${minioKey}`
    );
  }

  return text;
}

/**
 * Parse text from a PDF buffer using pdf-parse v2 (PDFParse class).
 */
async function parsePdfBuffer(pdfBuffer: Buffer): Promise<string> {
  // pdf-parse v2 exports { PDFParse } class instead of a default function
  const { PDFParse } = require("pdf-parse") as {
    PDFParse: new (opts: { data: Buffer }) => {
      getText: () => Promise<{ text: string }>;
      destroy: () => Promise<void>;
    };
  };
  const parser = new PDFParse({ data: pdfBuffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Chunk insertion
// ---------------------------------------------------------------------------

/**
 * Chunk, embed, and insert a Muster's content into muster_chunks.
 *
 * Two paths based on the optional `content` parameter:
 * - content provided: use directly — skip extractMusterFullText + MinIO entirely.
 *   Used by seedAmtlicheFormulare() for hardcoded template content.
 * - content not provided (or empty): call extractMusterFullText(minioKey, mimeType).
 *   Used by processMusterIngestionJob() for uploaded files.
 *
 * kanzleiEigen is propagated from the parent Muster.isKanzleiEigen field.
 * Existing chunks for this musterId are deleted before insert (idempotent).
 *
 * @param musterId - ID of the parent Muster record
 * @param content - Optional pre-extracted text (skips MinIO when provided)
 * @returns Number of child chunks inserted
 */
export async function insertMusterChunks(
  musterId: string,
  content?: string
): Promise<{ inserted: number }> {
  // Load parent Muster for minioKey, mimeType, isKanzleiEigen
  const muster = await prisma.muster.findUniqueOrThrow({
    where: { id: musterId },
    select: { minioKey: true, mimeType: true, isKanzleiEigen: true },
  });

  // Text extraction: use provided content or fetch from MinIO
  const text =
    content && content.trim().length > 0
      ? content
      : await extractMusterFullText(muster.minioKey, muster.mimeType);

  // Split into parent-child chunk groups
  const groups = await chunkDocumentParentChild(text);

  // Delete existing chunks for idempotency
  await prisma.$executeRaw`
    DELETE FROM muster_chunks WHERE "musterId" = ${musterId}
  `;

  let inserted = 0;

  for (const group of groups) {
    const parentContent = group.parent.content;

    for (const child of group.children) {
      // Generate embedding for child chunk
      const embedding = await generateEmbedding(child.content);
      const vectorSql = pgvector.toSql(embedding);

      await prisma.$executeRaw`
        INSERT INTO muster_chunks (
          id,
          "musterId",
          "chunkIndex",
          content,
          "parentContent",
          embedding,
          "modelVersion",
          "kanzleiEigen",
          "createdAt"
        )
        VALUES (
          gen_random_uuid(),
          ${musterId},
          ${child.index},
          ${child.content},
          ${parentContent},
          ${vectorSql}::vector,
          ${MODEL_VERSION},
          ${muster.isKanzleiEigen},
          NOW()
        )
      `;
      inserted++;
    }
  }

  return { inserted };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search muster_chunks by cosine similarity (pgvector).
 *
 * Retrieves limit*3 candidates from DB, then applies:
 * - 1.3x score multiplier to kanzleiEigen=true results (kanzlei-uploaded preferred)
 * - minScore filter
 * - Descending sort by boosted score
 * - Slice to limit
 *
 * Only searches chunks where nerStatus = 'INDEXED' to ensure NER gate was passed.
 *
 * @param queryEmbedding - Pre-computed query embedding vector
 * @param opts.limit - Maximum results to return (default 5)
 * @param opts.minScore - Minimum score threshold after boost (default 0.0)
 */
export async function searchMusterChunks(
  queryEmbedding: number[],
  opts: { limit?: number; minScore?: number } = {}
): Promise<MusterChunkResult[]> {
  const { limit = 5, minScore = 0.0 } = opts;
  const fetchLimit = limit * FETCH_FACTOR;
  const vectorSql = pgvector.toSql(queryEmbedding);

  type RawRow = {
    id: string;
    musterId: string;
    content: string;
    parentContent: string | null;
    musterName: string;
    kategorie: string;
    kanzleiEigen: boolean;
    rawScore: number;
  };

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      mc.id,
      mc."musterId",
      mc.content,
      mc."parentContent",
      m.name AS "musterName",
      m.kategorie,
      mc."kanzleiEigen",
      1 - (mc.embedding <=> ${vectorSql}::vector) AS "rawScore"
    FROM muster_chunks mc
    JOIN muster m ON m.id = mc."musterId"
    WHERE mc.embedding IS NOT NULL
      AND m."nerStatus" = 'INDEXED'
    ORDER BY mc.embedding <=> ${vectorSql}::vector ASC
    LIMIT ${fetchLimit}
  `;

  return rows
    // Apply 1.3x boost for kanzleiEigen results
    .map((r) => ({
      id: r.id,
      musterId: r.musterId,
      content: r.content,
      parentContent: r.parentContent,
      musterName: r.musterName,
      kategorie: r.kategorie,
      kanzleiEigen: r.kanzleiEigen,
      score: Number(r.rawScore) * (r.kanzleiEigen ? KANZLEI_BOOST : 1.0),
    }))
    // Filter by minimum score (after boost)
    .filter((r) => r.score >= minScore)
    // Sort by boosted score descending (highest first)
    .sort((a, b) => b.score - a.score)
    // Limit results
    .slice(0, limit);
}
