/**
 * BullMQ embedding job processor.
 * Chunks document text, generates embeddings via Ollama, and stores
 * them in pgvector. Gracefully skips when Ollama is unavailable.
 */

import type { Job } from "bullmq";
import type { EmbeddingJobData } from "@/lib/ocr/types";
import { chunkDocument } from "@/lib/embedding/chunker";
import {
  isOllamaAvailable,
  generateEmbedding,
  MODEL_VERSION,
} from "@/lib/embedding/embedder";
import { insertChunks } from "@/lib/embedding/vector-store";
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

  // 2. Chunk the text
  const chunks = await chunkDocument(ocrText);
  if (chunks.length === 0) {
    log.info(
      { dokumentId },
      "[Embedding] No chunks produced (empty text), skipping"
    );
    return;
  }

  log.info(
    { dokumentId, chunkCount: chunks.length },
    "[Embedding] Chunked document, generating embeddings..."
  );

  // 3. Generate embeddings in batches of 5
  const embeddedChunks: {
    content: string;
    index: number;
    embedding: number[];
  }[] = [];

  const BATCH_SIZE = 5;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    for (const chunk of batch) {
      const embedding = await generateEmbedding(chunk.content);
      embeddedChunks.push({
        content: chunk.content,
        index: chunk.index,
        embedding,
      });
    }

    // Update job progress for UI feedback
    const progress = Math.round(
      ((i + batch.length) / chunks.length) * 100
    );
    await job.updateProgress(progress);
  }

  // 4. Store in pgvector
  await insertChunks(dokumentId, embeddedChunks, MODEL_VERSION);

  log.info(
    { dokumentId, chunkCount: embeddedChunks.length, modelVersion: MODEL_VERSION },
    "[Embedding] Successfully embedded and stored chunks"
  );
}
