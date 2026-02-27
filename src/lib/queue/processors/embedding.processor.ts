/**
 * BullMQ embedding job processor.
 * Chunks document text, generates embeddings via Ollama, and stores
 * them in pgvector. Gracefully skips when Ollama is unavailable.
 */

import type { Job } from "bullmq";
import type { EmbeddingJobData } from "@/lib/ocr/types";
import { chunkDocumentParentChild } from "@/lib/embedding/chunker";
import {
  isOllamaAvailable,
  generateEmbedding,
  MODEL_VERSION,
} from "@/lib/embedding/embedder";
import { insertParentChildChunks } from "@/lib/embedding/vector-store";
import { aiScanQueue } from "@/lib/queue/queues";
import { getSettingTyped } from "@/lib/settings/service";
import { createLogger } from "@/lib/logger";

const log = createLogger("embedding-processor");

/**
 * Process an embedding job for a single document.
 *
 * Flow:
 * 1. Check Ollama availability (skip gracefully if down)
 * 2. Chunk the OCR text with German legal splitter
 * 3. Generate embedding for each chunk in sequential batches
 * 4. Store all chunks + embeddings in pgvector
 */
export async function processEmbeddingJob(
  job: Job<EmbeddingJobData>
): Promise<void> {
  const { dokumentId, ocrText } = job.data;

  // 1. Graceful skip when Ollama is unavailable
  const available = await isOllamaAvailable();
  if (!available) {
    log.warn(
      { dokumentId },
      "[Embedding] Ollama unavailable, skipping embedding for dokument"
    );
    return;
  }

  // 2. Chunk the text into parent-child groups
  const parentChildGroups = await chunkDocumentParentChild(ocrText);
  if (parentChildGroups.length === 0) {
    log.info({ dokumentId }, "[Embedding] No chunks produced (empty text), skipping");
    return;
  }

  // Count total children for progress tracking
  let totalChildCount = 0;
  for (const group of parentChildGroups) {
    totalChildCount += group.children.length;
  }

  log.info(
    { dokumentId, parentCount: parentChildGroups.length, childCount: totalChildCount },
    "[Embedding] Chunked document (parent-child), generating child embeddings..."
  );

  // 3. Generate embeddings for child chunks only (parents stored without embedding)
  const embeddedGroups: Array<{
    parent: { content: string; index: number };
    children: Array<{ content: string; index: number; embedding: number[] }>;
  }> = [];

  let processedChildren = 0;
  for (const group of parentChildGroups) {
    const embeddedChildren: Array<{ content: string; index: number; embedding: number[] }> = [];

    const BATCH_SIZE = 5;
    for (let i = 0; i < group.children.length; i += BATCH_SIZE) {
      const batch = group.children.slice(i, i + BATCH_SIZE);
      for (const child of batch) {
        const embedding = await generateEmbedding(child.content);
        embeddedChildren.push({ content: child.content, index: child.index, embedding });
        processedChildren++;
      }

      // Update job progress for UI feedback
      const progress = Math.round((processedChildren / totalChildCount) * 100);
      await job.updateProgress(progress);
    }

    embeddedGroups.push({ parent: group.parent, children: embeddedChildren });
  }

  // 4. Store parent-child chunks in pgvector
  await insertParentChildChunks(dokumentId, embeddedGroups, MODEL_VERSION);

  log.info(
    { dokumentId, parentCount: parentChildGroups.length, childCount: totalChildCount, modelVersion: MODEL_VERSION },
    "[Embedding] Successfully embedded and stored parent-child chunks"
  );

  // Trigger AI scan after successful embedding (if enabled)
  try {
    const scanEnabled = await getSettingTyped<boolean>("ai.scan_enabled", false);
    if (scanEnabled) {
      // Look up the document name for metadata
      const { prisma } = await import("@/lib/db");
      const dok = await prisma.dokument.findUnique({
        where: { id: dokumentId },
        select: { name: true },
      });

      // Concatenate all child texts for AI analysis (same total content as before)
      const fullText = embeddedGroups.flatMap(g => g.children.map(c => c.content)).join("\n\n");
      await aiScanQueue.add("scan-document", {
        type: "document",
        id: dokumentId,
        akteId: job.data.akteId,
        content: fullText,
        metadata: { dokumentName: dok?.name ?? dokumentId },
      });
      log.info({ dokumentId }, "[Embedding] AI scan job enqueued after embedding");
    }
  } catch (err) {
    // Non-fatal: don't fail the embedding job if AI scan enqueue fails
    log.warn({ err, dokumentId }, "[Embedding] Failed to enqueue AI scan (non-fatal)");
  }
}
