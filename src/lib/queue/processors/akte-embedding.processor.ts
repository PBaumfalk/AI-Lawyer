/**
 * BullMQ processor for Akte summary embedding refresh.
 * Delegates to refreshAkteEmbeddings for the actual work.
 */

import { createLogger } from "@/lib/logger";
import { refreshAkteEmbeddings } from "@/lib/scanner/akte-embedding";

const log = createLogger("akte-embedding-processor");

export async function processAkteEmbeddingJob(): Promise<{
  refreshed: number;
  failed: number;
  total: number;
}> {
  const result = await refreshAkteEmbeddings();
  log.info(result, "Akte embedding refresh completed");
  return result;
}
