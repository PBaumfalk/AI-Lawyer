/**
 * BullMQ processor for beA sync jobs.
 *
 * - job.data.userId set: fetch only that user's certificate (manual trigger)
 * - no userId (periodic job): fetch all certificates with status AKTIV
 *
 * Errors of individual certificates are collected; if any occurred the job
 * fails so BullMQ retries it with backoff. Certificates in FEHLER state are
 * skipped by rufeZertifikatAb without a login attempt.
 */

import type { Job } from "bullmq";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { rufeZertifikatAb } from "@/lib/bea/abruf";
import type { BeaSyncJobData } from "@/lib/queue/queues";

const log = createLogger("bea-sync-processor");

export async function processBeaSync(job: Job<BeaSyncJobData>): Promise<void> {
  const userIds = job.data.userId
    ? [job.data.userId]
    : (
        await prisma.beaZertifikat.findMany({
          where: { status: "AKTIV" },
          select: { userId: true },
        })
      ).map((z) => z.userId);

  const fehler: string[] = [];
  let neu = 0;

  for (const userId of userIds) {
    const r = await rufeZertifikatAb(userId);
    neu += r.neu;
    if (r.fehler.length > 0) {
      log.warn({ jobId: job.id, userId, anzahl: r.fehler.length }, "beA sync finished with errors");
      fehler.push(...r.fehler.map((f) => `${userId}: ${f}`));
    }
  }

  log.info({ jobId: job.id, zertifikate: userIds.length, neu, fehler: fehler.length }, "beA sync completed");

  if (fehler.length > 0) {
    throw new Error(`beA-Abruf mit ${fehler.length} Fehler(n): ${fehler.slice(0, 3).join("; ")}`);
  }
}
