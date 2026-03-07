/**
 * BullMQ processor for CalDAV sync jobs.
 *
 * - If job.data.kontoId is provided: sync only that specific account (manual trigger)
 * - If no kontoId (cron job): sync all active CalDavKonten
 */

import type { Job } from "bullmq";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { syncCalDavKonto } from "@/lib/caldav/sync-engine";
import type { CalDavSyncJobData } from "@/lib/queue/queues";

const log = createLogger("caldav-sync-processor");

export async function processCalDavSync(job: Job<CalDavSyncJobData>): Promise<void> {
  const { kontoId } = job.data;

  if (kontoId) {
    // Manual sync -- single konto
    log.info({ kontoId, jobId: job.id }, "Manual CalDAV sync started");

    await (prisma as any).calDavKonto.update({
      where: { id: kontoId },
      data: { syncStatus: "SYNCHRONISIEREND" },
    });

    try {
      const result = await syncCalDavKonto(kontoId);
      log.info(
        { kontoId, jobId: job.id, ...result },
        "Manual CalDAV sync completed"
      );
    } catch (err) {
      log.error({ kontoId, jobId: job.id, err }, "Manual CalDAV sync failed");

      await (prisma as any).calDavKonto.update({
        where: { id: kontoId },
        data: { syncStatus: "FEHLER" },
      }).catch(() => {});

      throw err;
    }

    return;
  }

  // Cron job -- sync all active konten
  log.info({ jobId: job.id }, "Periodic CalDAV sync started");

  const konten = await (prisma as any).calDavKonto.findMany({
    where: {
      aktiv: true,
      syncStatus: { not: "SYNCHRONISIEREND" },
    },
    select: { id: true, name: true },
  });

  log.info({ count: konten.length, jobId: job.id }, "Found active CalDAV accounts to sync");

  let totalPushed = 0;
  let totalPulled = 0;
  let totalDeleted = 0;
  let totalErrors = 0;

  for (const konto of konten) {
    try {
      await (prisma as any).calDavKonto.update({
        where: { id: konto.id },
        data: { syncStatus: "SYNCHRONISIEREND" },
      });

      const result = await syncCalDavKonto(konto.id);
      totalPushed += result.pushed;
      totalPulled += result.pulled;
      totalDeleted += result.deleted;
      totalErrors += result.errors.length;

      log.info(
        { kontoId: konto.id, kontoName: konto.name, ...result },
        "CalDAV konto sync completed"
      );
    } catch (err) {
      totalErrors++;
      log.error(
        { kontoId: konto.id, kontoName: konto.name, err },
        "CalDAV konto sync failed"
      );

      await (prisma as any).calDavKonto.update({
        where: { id: konto.id },
        data: { syncStatus: "FEHLER" },
      }).catch(() => {});
    }
  }

  log.info(
    { jobId: job.id, konten: konten.length, totalPushed, totalPulled, totalDeleted, totalErrors },
    "Periodic CalDAV sync completed"
  );
}
