/**
 * BullMQ processor for automatic Muster chunk ingestion after NER gate passes.
 *
 * Triggered automatically by ner-pii.processor.ts when a Muster transitions
 * to INDEXED status. Calls insertMusterChunks() which fetches the file from
 * MinIO, extracts text, chunks, embeds, and stores in muster_chunks.
 *
 * Guard: if Muster is not found or nerStatus !== INDEXED, logs a warning and
 * returns without error (idempotent — avoids duplicate ingestion).
 *
 * Also exports processMusterIngestPending() for startup recovery sweep —
 * re-enqueues any INDEXED Muster that somehow has zero chunks.
 */

import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { insertMusterChunks } from "@/lib/muster/ingestion";
import { musterIngestionQueue } from "@/lib/queue/queues";

const log = createLogger("muster-ingestion-processor");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MusterIngestionJobData {
  musterId: string;
}

// ─── Main processor ───────────────────────────────────────────────────────────

/**
 * Process a single Muster ingestion job.
 *
 * Steps:
 * 1. Load Muster from DB to confirm nerStatus === INDEXED
 * 2. Guard: if not found or not INDEXED, warn and return (idempotent)
 * 3. Call insertMusterChunks(musterId) — no content param (real uploaded file,
 *    fetched from MinIO via extractMusterFullText)
 * 4. Log result
 *
 * @param data - Job data with musterId
 */
export async function processMusterIngestionJob(
  data: MusterIngestionJobData
): Promise<void> {
  const { musterId } = data;

  // Load Muster to confirm NER gate was passed
  const muster = await prisma.muster.findUnique({
    where: { id: musterId },
    select: { nerStatus: true, name: true },
  });

  if (!muster) {
    log.warn({ musterId }, "Muster not found — skipping ingestion (may have been deleted)");
    return;
  }

  if (muster.nerStatus !== "INDEXED") {
    log.warn(
      { musterId, nerStatus: muster.nerStatus },
      "Muster nerStatus is not INDEXED — skipping ingestion (idempotent guard)"
    );
    return;
  }

  log.info({ musterId, name: muster.name }, "Starting Muster chunk ingestion");

  // No content param — real uploaded file, must fetch from MinIO
  const { inserted } = await insertMusterChunks(musterId);

  log.info({ musterId, inserted }, "Muster ingestion complete");
}

// ─── Startup recovery sweep ───────────────────────────────────────────────────

/**
 * Re-enqueue any INDEXED Muster that has zero chunks in muster_chunks.
 *
 * Called once at worker startup (non-fatal) to recover from:
 * - Worker crash between INDEXED transition and musterIngestionQueue.add()
 * - Failed ingestion jobs that left Muster with 0 chunks
 *
 * Uses muster._count.chunks to avoid a separate COUNT query per Muster.
 */
export async function processMusterIngestPending(): Promise<void> {
  const stuck = await prisma.muster.findMany({
    where: { nerStatus: "INDEXED" },
    include: { _count: { select: { chunks: true } } },
  });

  let recoveryCount = 0;

  for (const m of stuck) {
    if (m._count.chunks === 0) {
      await musterIngestionQueue.add("ingest-muster-recovery", { musterId: m.id });
      recoveryCount++;
      log.info(
        { musterId: m.id, name: m.name },
        "Re-enqueued INDEXED Muster with 0 chunks for recovery ingestion"
      );
    }
  }

  if (recoveryCount > 0) {
    log.warn(
      { recoveryCount },
      "Startup sweep: re-enqueued Muster with missing chunks"
    );
  }
}
