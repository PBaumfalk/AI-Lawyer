/**
 * BullMQ processor for async NER-PII filtering of Muster documents (ARBW-03 compliance).
 *
 * State machine for Muster:
 *   PENDING_NER -> NER_RUNNING -> INDEXED           (no persons found)
 *   PENDING_NER -> NER_RUNNING -> REJECTED_PII_DETECTED  (persons found)
 *   NER_RUNNING -> PENDING_NER                      (any error — reset before re-throw)
 *
 * CRITICAL: On ANY error (including AbortError/timeout from Ollama), the Muster row
 * is reset to PENDING_NER before re-throwing. This prevents NER_RUNNING stuck states.
 *
 * Phase 18 Admin Upload UI will call nerPiiQueue.add() after upload.
 * Phase 17 Urteile-RAG uses processUrteilNer() directly (inline gate, no BullMQ).
 */

import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { runNerFilter } from "@/lib/pii/ner-filter";
import { getFileStream } from "@/lib/storage";
import { musterIngestionQueue } from "@/lib/queue/queues";

const log = createLogger("ner-pii-processor");

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Job data for the ner-pii BullMQ queue.
 * - musterId: set for async Muster NER (ARBW-03)
 * - urteilText + urteilId: set for Phase 17 inline Urteil NER (optional)
 */
export interface NerPiiJobData {
  musterId?: string;     // For Muster async NER (ARBW-03)
  urteilText?: string;   // For Urteil inline NER (URTEIL-03) — Phase 17
  urteilId?: string;
}

// ─── Text extraction helper ───────────────────────────────────────────────────

/**
 * Read a MinIO object stream to a UTF-8 string.
 * Used to extract raw text content from stored Muster files.
 */
async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Extract NER-relevant text from a Muster stored in MinIO.
 *
 * Windowing strategy per Plan 01 decision:
 * - Take first 6000 chars (Rubrum — party names in document header)
 * - Take last 2000 chars (signature block — names in footer)
 * - Combined with "\n...\n" separator to signal content gap to Ollama
 *
 * @param minioKey - The MinIO storage key for the Muster file
 * @returns Windowed text slice ready for NER analysis
 */
export async function extractMusterText(minioKey: string): Promise<string> {
  const stream = await getFileStream(minioKey);
  if (!stream) {
    throw new Error(`MinIO returned null stream for key: ${minioKey}`);
  }
  const text = await streamToString(stream as NodeJS.ReadableStream);
  // Window covers Rubrum (party names in header) and signature block (names in footer)
  return text.slice(0, 6000) + "\n...\n" + text.slice(-2000);
}

// ─── Muster NER processor ─────────────────────────────────────────────────────

/**
 * Process NER-PII check for a single Muster document.
 *
 * State transitions:
 * 1. PENDING_NER -> NER_RUNNING (before Ollama call)
 * 2a. NER_RUNNING -> INDEXED (no PII found)
 * 2b. NER_RUNNING -> REJECTED_PII_DETECTED (persons found)
 * On any error: NER_RUNNING -> PENDING_NER (reset, then re-throw)
 *
 * @param musterId - Muster row primary key
 */
async function processMusterNer(musterId: string): Promise<void> {
  // Step 1: Transition to NER_RUNNING (claim the job)
  await prisma.muster.update({
    where: { id: musterId },
    data: { nerStatus: "NER_RUNNING" },
  });

  try {
    // Fetch Muster record for MinIO key and display name
    const muster = await prisma.muster.findUnique({
      where: { id: musterId },
      select: { minioKey: true, name: true },
    });

    if (!muster) {
      throw new Error(`Muster not found: ${musterId}`);
    }

    // Extract windowed text from MinIO (Rubrum + signature block)
    const nerText = await extractMusterText(muster.minioKey);

    // Run NER filter (throws AbortError on 45s Ollama timeout — propagates up)
    const result = await runNerFilter(nerText);

    if (result.hasPii) {
      // PII detected — reject the Muster
      await prisma.muster.update({
        where: { id: musterId },
        data: { nerStatus: "REJECTED_PII_DETECTED" },
      });
      log.warn(
        { musterId, persons: result.persons, personCount: result.persons.length },
        "Muster rejected: PII detected"
      );
    } else {
      // No PII found — Muster is cleared for indexing
      await prisma.muster.update({
        where: { id: musterId },
        data: { nerStatus: "INDEXED" },
      });
      log.info({ musterId }, "Muster NER passed: no PII");
      // Phase 18: trigger chunk ingestion after NER passes
      await musterIngestionQueue.add("ingest-muster", { musterId });
    }
  } catch (err) {
    // CRITICAL: reset to PENDING_NER on ANY error (including AbortError/timeout)
    // Prevents NER_RUNNING stuck state if worker crashes or Ollama times out
    await prisma.muster.update({
      where: { id: musterId },
      data: { nerStatus: "PENDING_NER" },
    });
    throw err; // Re-throw so BullMQ marks job failed
  }
}

// ─── Urteil NER gate ──────────────────────────────────────────────────────────

/**
 * Inline NER check for a single Urteil text chunk.
 *
 * Used by Phase 17 Urteile-RAG as a synchronous gate before pgvector insertion.
 * Does NOT write to DB — caller (Phase 17) handles the DB write with piiFiltered:true.
 *
 * @param urteilText - Full text of the Urteil chunk (caller responsible for size)
 * @param urteilId - Urteil row ID (for logging only)
 * @throws Error if PII is detected — Phase 17 caller should skip this Urteil
 */
async function processUrteilNer(urteilText: string, urteilId: string): Promise<void> {
  const result = await runNerFilter(urteilText);

  if (result.hasPii) {
    log.warn(
      { urteilId, persons: result.persons, personCount: result.persons.length },
      "Urteil NER: PII detected — caller should skip ingestion"
    );
    throw new Error(
      `NER PII detected in Urteil ${urteilId}: ${result.persons.join(", ")}`
    );
  }

  log.info({ urteilId }, "Urteil NER passed: no PII — caller sets piiFiltered:true");
}

// ─── Startup recovery ─────────────────────────────────────────────────────────

/**
 * Reset any Muster rows stuck in NER_RUNNING state to PENDING_NER.
 *
 * Called once at worker boot before starting the BullMQ ner-pii worker.
 * Handles the case where a previous worker crashed while processing a job,
 * leaving rows in NER_RUNNING indefinitely.
 */
export async function recoverStuckNerJobs(): Promise<void> {
  const count = await prisma.muster.updateMany({
    where: { nerStatus: "NER_RUNNING" },
    data: { nerStatus: "PENDING_NER" },
  });
  if (count.count > 0) {
    log.warn(
      { count: count.count },
      "Recovered stuck NER_RUNNING Muster rows to PENDING_NER"
    );
  }
}

// ─── Main job dispatcher ──────────────────────────────────────────────────────

/**
 * BullMQ job processor for the ner-pii queue.
 * Routes to the appropriate handler based on job data.
 *
 * @param data - NerPiiJobData from nerPiiQueue.add()
 */
export async function processNerPiiJob(data: NerPiiJobData): Promise<void> {
  if (data.musterId) {
    return processMusterNer(data.musterId);
  }

  if (data.urteilText && data.urteilId) {
    return processUrteilNer(data.urteilText, data.urteilId);
  }

  throw new Error("NerPiiJob: neither musterId nor urteilText provided");
}
