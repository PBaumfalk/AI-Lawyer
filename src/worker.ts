import { Worker } from "bullmq";
import { createRedisConnection } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { calculateBackoff, registerFristReminderJob, registerAiProactiveJob, registerAiBriefingJob, registerGesetzeSyncJob, ocrQueue } from "@/lib/queue/queues";
import { testProcessor, type TestJobData } from "@/lib/queue/processors/test.processor";
import { processFristReminders } from "@/workers/processors/frist-reminder";
import { initializeDefaults, getSettingTyped } from "@/lib/settings/service";
import { getSocketEmitter } from "@/lib/socket/emitter";
import { startImapConnections, stopAllConnections } from "@/lib/email/imap/connection-manager";
import { emailSendProcessor, emailSyncProcessor } from "@/lib/email/smtp/send-processor";
import { closeAllTransports } from "@/lib/email/smtp/transport-factory";
import type { EmailSendJob, EmailSyncJob } from "@/lib/email/types";
import { processOcrJob } from "@/lib/queue/processors/ocr.processor";
import { processPreviewJob } from "@/lib/queue/processors/preview.processor";
import { processEmbeddingJob } from "@/lib/queue/processors/embedding.processor";
import type { OcrJobData, PreviewJobData, EmbeddingJobData } from "@/lib/ocr/types";
import { processScan, type AiScanJobData } from "@/lib/ai/scan-processor";
import { processBriefing, type BriefingJobData } from "@/lib/ai/briefing-processor";
import { processProactive, type ProactiveJobData } from "@/lib/ai/proactive-processor";
import { processGesetzeSyncJob } from "@/lib/queue/processors/gesetze-sync.processor";
import { prisma } from "@/lib/db";

const log = createLogger("worker");

// Redis connection for all workers (maxRetriesPerRequest: null is required by BullMQ)
const connection = createRedisConnection({ maxRetriesPerRequest: null });

// Socket.IO emitter for sending notifications to browser clients
const socketEmitter = getSocketEmitter();

// Track all workers for graceful shutdown
const workers: Worker[] = [];

// ─── Test Queue Worker ──────────────────────────────────────────────────────

const concurrency = parseInt(process.env.WORKER_CONCURRENCY || "5", 10);

const testWorker = new Worker<TestJobData>(
  "test",
  async (job) => testProcessor(job),
  {
    connection,
    concurrency,
    settings: {
      backoffStrategy: (attemptsMade: number) => calculateBackoff(attemptsMade),
    },
  }
);

testWorker.on("completed", (job) => {
  if (!job) return;
  log.info({ jobId: job.id, userId: job.data.userId }, "Job completed");

  // Notify the user that their job completed
  socketEmitter.to(`user:${job.data.userId}`).emit("notification", {
    type: "job:completed",
    title: "Vorgang abgeschlossen",
    message: job.data.message || "Ein Hintergrundvorgang wurde abgeschlossen.",
    data: { jobId: job.id, queue: "test" },
  });
});

testWorker.on("failed", (job, err) => {
  if (!job) return;
  log.error(
    { jobId: job.id, userId: job.data.userId, err: err.message, attemptsMade: job.attemptsMade },
    "Job failed"
  );

  // Only notify after all retries are exhausted
  if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
    // Notify the user with a friendly German message
    socketEmitter.to(`user:${job.data.userId}`).emit("notification", {
      type: "job:failed",
      title: "Vorgang fehlgeschlagen",
      message: "Vorgang fehlgeschlagen. Erneut versuchen?",
      data: { jobId: job.id, queue: "test" },
    });

    // Notify admins with error details
    socketEmitter.to("role:ADMIN").emit("notification", {
      type: "job:failed",
      title: "Job fehlgeschlagen",
      message: `Job ${job.id} in Queue "test" fehlgeschlagen: ${err.message}`,
      data: { jobId: job.id, queue: "test", error: err.message },
    });
  }
});

testWorker.on("error", (err) => {
  log.error({ err }, "Worker error");
});

workers.push(testWorker);

// ─── Frist-Reminder Queue Worker ────────────────────────────────────────────

const fristReminderWorker = new Worker(
  "frist-reminder",
  async () => {
    return processFristReminders();
  },
  {
    connection,
    concurrency: 1, // Only one scan at a time -- prevents duplicate notifications
    settings: {
      backoffStrategy: (attemptsMade: number) => calculateBackoff(attemptsMade),
    },
  }
);

fristReminderWorker.on("completed", (job) => {
  if (!job) return;
  log.info(
    { jobId: job.id, result: job.returnvalue },
    "Frist reminder run completed"
  );
});

fristReminderWorker.on("failed", (job, err) => {
  if (!job) return;
  log.error(
    { jobId: job.id, err: err.message, attemptsMade: job.attemptsMade },
    "Frist reminder run failed"
  );

  // Notify admins on final failure
  if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
    socketEmitter.to("role:ADMIN").emit("notification", {
      type: "job:failed",
      title: "Fristen-Erinnerung fehlgeschlagen",
      message: `Cron-Job fehlgeschlagen: ${err.message}`,
      data: { jobId: job.id, queue: "frist-reminder" },
    });
  }
});

fristReminderWorker.on("error", (err) => {
  log.error({ err }, "Frist reminder worker error");
});

workers.push(fristReminderWorker);

// ─── Email-Send Queue Worker ─────────────────────────────────────────────────

const emailSendWorker = new Worker<EmailSendJob>(
  "email-send",
  async (job) => emailSendProcessor(job),
  {
    connection,
    concurrency: 3, // Max 3 concurrent sends
    settings: {
      backoffStrategy: (attemptsMade: number) => calculateBackoff(attemptsMade),
    },
  }
);

emailSendWorker.on("completed", (job) => {
  if (!job) return;
  log.info(
    { jobId: job.id, emailNachrichtId: job.data.emailNachrichtId },
    "Email send job completed"
  );
});

emailSendWorker.on("failed", (job, err) => {
  if (!job) return;
  log.error(
    { jobId: job.id, emailNachrichtId: job.data.emailNachrichtId, err: err.message },
    "Email send job failed"
  );
});

emailSendWorker.on("error", (err) => {
  log.error({ err }, "Email send worker error");
});

workers.push(emailSendWorker);

// ─── Email-Sync Queue Worker ─────────────────────────────────────────────────

const emailSyncWorker = new Worker<{ kontoId: string; folder?: string }>(
  "email-sync",
  async (job) => emailSyncProcessor(job),
  {
    connection,
    concurrency: 2,
    settings: {
      backoffStrategy: (attemptsMade: number) => calculateBackoff(attemptsMade),
    },
  }
);

emailSyncWorker.on("completed", (job) => {
  if (!job) return;
  log.info(
    { jobId: job.id, kontoId: job.data.kontoId },
    "Email sync job completed"
  );
});

emailSyncWorker.on("failed", (job, err) => {
  if (!job) return;
  log.error(
    { jobId: job.id, kontoId: job.data.kontoId, err: err.message },
    "Email sync job failed"
  );
});

emailSyncWorker.on("error", (err) => {
  log.error({ err }, "Email sync worker error");
});

workers.push(emailSyncWorker);

// ─── Document OCR Queue Worker ──────────────────────────────────────────────

const ocrWorker = new Worker<OcrJobData>(
  "document-ocr",
  async (job) => processOcrJob(job),
  {
    connection,
    concurrency: 1, // Memory-heavy OCR: one at a time
    settings: {
      backoffStrategy: (attemptsMade: number) => calculateBackoff(attemptsMade),
    },
  }
);

ocrWorker.on("completed", (job) => {
  if (!job) return;
  log.info(
    { jobId: job.id, dokumentId: job.data.dokumentId },
    "OCR job completed"
  );

  const ocrPayload = {
    dokumentId: job.data.dokumentId,
    akteId: job.data.akteId,
    fileName: job.data.fileName,
    status: "ABGESCHLOSSEN",
  };

  // Notify via Socket.IO that OCR is done (akte room for upload panel)
  socketEmitter.to(`akte:${job.data.akteId}`).emit("document:ocr-complete", ocrPayload);

  // Also emit to user room for global toast (even when navigated away from Akte)
  prisma.dokument
    .findUnique({ where: { id: job.data.dokumentId }, select: { createdById: true } })
    .then((doc) => {
      if (doc?.createdById) {
        socketEmitter.to(`user:${doc.createdById}`).emit("document:ocr-complete", ocrPayload);
      }
    })
    .catch((err) => {
      log.warn({ err, dokumentId: job.data.dokumentId }, "Failed to look up user for OCR notification");
    });
});

ocrWorker.on("failed", (job, err) => {
  if (!job) return;
  log.error(
    { jobId: job.id, dokumentId: job.data.dokumentId, err: err.message, attemptsMade: job.attemptsMade },
    "OCR job failed"
  );

  // Notify on final failure
  if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
    const failPayload = {
      dokumentId: job.data.dokumentId,
      akteId: job.data.akteId,
      fileName: job.data.fileName,
      status: "FEHLGESCHLAGEN",
      error: err.message,
    };

    // Notify akte room (upload panel) and user room (global toast)
    socketEmitter.to(`akte:${job.data.akteId}`).emit("document:ocr-complete", failPayload);

    prisma.dokument
      .findUnique({ where: { id: job.data.dokumentId }, select: { createdById: true } })
      .then((doc) => {
        if (doc?.createdById) {
          socketEmitter.to(`user:${doc.createdById}`).emit("document:ocr-complete", failPayload);
        }
      })
      .catch((lookupErr) => {
        log.warn({ err: lookupErr, dokumentId: job.data.dokumentId }, "Failed to look up user for OCR failure notification");
      });

    socketEmitter.to("role:ADMIN").emit("notification", {
      type: "ocr:failed",
      title: "OCR fehlgeschlagen",
      message: `OCR fuer "${job.data.fileName}" fehlgeschlagen: ${err.message}`,
      data: { dokumentId: job.data.dokumentId, akteId: job.data.akteId },
    });
  }
});

ocrWorker.on("error", (err) => {
  log.error({ err }, "OCR worker error");
});

workers.push(ocrWorker);

// ─── Document Preview Queue Worker ─────────────────────────────────────────

const previewWorker = new Worker<PreviewJobData>(
  "document-preview",
  async (job) => processPreviewJob(job),
  {
    connection,
    concurrency: 2,
    settings: {
      backoffStrategy: (attemptsMade: number) => calculateBackoff(attemptsMade),
    },
  }
);

previewWorker.on("completed", (job) => {
  if (!job) return;
  log.info(
    { jobId: job.id, dokumentId: job.data.dokumentId },
    "Preview generation completed"
  );
});

previewWorker.on("failed", (job, err) => {
  if (!job) return;
  log.error(
    { jobId: job.id, dokumentId: job.data.dokumentId, err: err.message },
    "Preview generation failed"
  );
});

previewWorker.on("error", (err) => {
  log.error({ err }, "Preview worker error");
});

workers.push(previewWorker);

// ─── Document Embedding Queue Worker ────────────────────────────────────────

const embeddingWorker = new Worker<EmbeddingJobData>(
  "document-embedding",
  async (job) => processEmbeddingJob(job),
  {
    connection,
    concurrency: 1, // Memory-intensive embedding: one at a time
    settings: {
      backoffStrategy: (attemptsMade: number) => calculateBackoff(attemptsMade),
    },
  }
);

embeddingWorker.on("completed", (job) => {
  if (!job) return;
  log.info(
    { jobId: job.id, dokumentId: job.data.dokumentId },
    "Embedding job completed"
  );

  const embeddingPayload = {
    dokumentId: job.data.dokumentId,
    akteId: job.data.akteId,
    status: "ABGESCHLOSSEN",
  };

  socketEmitter
    .to(`akte:${job.data.akteId}`)
    .emit("document:embedding-complete", embeddingPayload);

  // Also emit to user room for global toast
  prisma.dokument
    .findUnique({
      where: { id: job.data.dokumentId },
      select: { createdById: true },
    })
    .then((doc) => {
      if (doc?.createdById) {
        socketEmitter
          .to(`user:${doc.createdById}`)
          .emit("document:embedding-complete", embeddingPayload);
      }
    })
    .catch((err) => {
      log.warn(
        { err, dokumentId: job.data.dokumentId },
        "Failed to look up user for embedding notification"
      );
    });
});

embeddingWorker.on("failed", (job, err) => {
  if (!job) return;
  log.error(
    { jobId: job.id, dokumentId: job.data.dokumentId, err: err.message, attemptsMade: job.attemptsMade },
    "Embedding job failed"
  );
});

embeddingWorker.on("error", (err) => {
  log.error({ err }, "Embedding worker error");
});

workers.push(embeddingWorker);
log.info("[Worker] document-embedding processor registered");

// ─── AI Scan Queue Worker ─────────────────────────────────────────────────

const aiScanWorker = new Worker<AiScanJobData>(
  "ai-scan",
  async (job) => processScan(job),
  {
    connection,
    concurrency: 1, // AI calls are sequential to avoid rate limiting
    settings: {
      backoffStrategy: (attemptsMade: number) => calculateBackoff(attemptsMade),
    },
  }
);

aiScanWorker.on("completed", (job) => {
  if (!job) return;
  log.info(
    { jobId: job.id, type: job.data.type, id: job.data.id },
    "AI scan job completed"
  );
});

aiScanWorker.on("failed", (job, err) => {
  if (!job) return;
  log.error(
    { jobId: job.id, type: job.data.type, id: job.data.id, err: err.message },
    "AI scan job failed"
  );
});

aiScanWorker.on("error", (err) => {
  log.error({ err }, "AI scan worker error");
});

workers.push(aiScanWorker);
log.info("[Worker] ai-scan processor registered");

// ─── AI Briefing Queue Worker ─────────────────────────────────────────────

const aiBriefingWorker = new Worker<BriefingJobData>(
  "ai-briefing",
  async (job) => {
    // For scheduler-triggered jobs (no userId), generate for all active ANWALTs
    if (!job.data.userId) {
      const anwaelte = await prisma.user.findMany({
        where: { role: "ANWALT", aktiv: true, isSystem: false },
        select: { id: true },
      });
      for (const anwalt of anwaelte) {
        await processBriefing({ ...job, data: { userId: anwalt.id } } as any);
      }
      return;
    }
    return processBriefing(job);
  },
  {
    connection,
    concurrency: 1,
    settings: {
      backoffStrategy: (attemptsMade: number) => calculateBackoff(attemptsMade),
    },
  }
);

aiBriefingWorker.on("completed", (job) => {
  if (!job) return;
  log.info({ jobId: job.id }, "AI briefing job completed");
});

aiBriefingWorker.on("failed", (job, err) => {
  if (!job) return;
  log.error({ jobId: job.id, err: err.message }, "AI briefing job failed");
});

aiBriefingWorker.on("error", (err) => {
  log.error({ err }, "AI briefing worker error");
});

workers.push(aiBriefingWorker);
log.info("[Worker] ai-briefing processor registered");

// ─── AI Proactive Queue Worker ────────────────────────────────────────────

const aiProactiveWorker = new Worker<ProactiveJobData>(
  "ai-proactive",
  async (job) => processProactive(job),
  {
    connection,
    concurrency: 1,
    settings: {
      backoffStrategy: (attemptsMade: number) => calculateBackoff(attemptsMade),
    },
  }
);

aiProactiveWorker.on("completed", (job) => {
  if (!job) return;
  log.info({ jobId: job.id }, "AI proactive scan job completed");
});

aiProactiveWorker.on("failed", (job, err) => {
  if (!job) return;
  log.error({ jobId: job.id, err: err.message }, "AI proactive scan job failed");
});

aiProactiveWorker.on("error", (err) => {
  log.error({ err }, "AI proactive worker error");
});

workers.push(aiProactiveWorker);
log.info("[Worker] ai-proactive processor registered");

// ─── Gesetze-Sync Queue Worker ──────────────────────────────────────────────

const gesetzeSyncWorker = new Worker(
  "gesetze-sync",
  async () => processGesetzeSyncJob(),
  {
    connection,
    concurrency: 1, // Sequential sync — avoids GitHub rate limit pressure and Ollama contention
    settings: {
      backoffStrategy: (attemptsMade: number) => calculateBackoff(attemptsMade),
    },
  }
);

gesetzeSyncWorker.on("completed", (job) => {
  if (!job) return;
  log.info(
    { jobId: job.id, result: job.returnvalue },
    "Gesetze sync completed"
  );
});

gesetzeSyncWorker.on("failed", (job, err) => {
  if (!job) return;
  log.error(
    { jobId: job.id, err: err.message, attemptsMade: job.attemptsMade },
    "Gesetze sync failed"
  );

  if (job.attemptsMade >= (job.opts.attempts ?? 2)) {
    socketEmitter.to("role:ADMIN").emit("notification", {
      type: "job:failed",
      title: "Gesetze-Sync fehlgeschlagen",
      message: `Täglicher Gesetze-Sync fehlgeschlagen: ${err.message}`,
      data: { jobId: job.id, queue: "gesetze-sync" },
    });
  }
});

gesetzeSyncWorker.on("error", (err) => {
  log.error({ err }, "Gesetze sync worker error");
});

workers.push(gesetzeSyncWorker);
log.info("[Worker] gesetze-sync processor registered");

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

async function gracefulShutdown(signal: string) {
  log.info({ signal }, "Received shutdown signal, closing workers...");

  try {
    // Stop all IMAP connections first (long-running)
    await stopAllConnections();
    // Close SMTP transport pool
    closeAllTransports();
    // Close BullMQ workers
    await Promise.all(workers.map((w) => w.close()));
    log.info("All workers and connections closed, exiting");
  } catch (err) {
    log.error({ err }, "Error during graceful shutdown");
  }

  process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// ─── Error Handlers ─────────────────────────────────────────────────────────

process.on("uncaughtException", (err) => {
  log.fatal({ err }, "Uncaught exception in worker process");
});

process.on("unhandledRejection", (reason) => {
  log.error({ reason }, "Unhandled rejection in worker process");
});

// ─── Settings Channel Subscription ──────────────────────────────────────────

const subscriber = createRedisConnection({ maxRetriesPerRequest: null });
subscriber.subscribe("settings:changed", (err) => {
  if (err) {
    log.error({ err }, "Failed to subscribe to settings:changed channel");
  }
});

subscriber.on("message", (channel, message) => {
  if (channel === "settings:changed") {
    try {
      const data = JSON.parse(message);
      if (data.key === "logLevel" && data.value) {
        log.info({ newLevel: data.value }, "Updating log level from settings");
        // pino log level update would go here in production
      }

      if (data.key === "fristen.scan_zeit" && data.value) {
        const [hours, minutes] = data.value.split(":").map(Number);
        const cronPattern = `${minutes} ${hours} * * *`;
        registerFristReminderJob(cronPattern)
          .then(() => {
            log.info(
              { scanZeit: data.value, cronPattern },
              "Frist reminder schedule updated"
            );
          })
          .catch((err: unknown) => {
            log.error({ err }, "Failed to update frist reminder schedule");
          });
      }
    } catch {
      // Ignore malformed messages
    }
  }
});

// ─── Startup ────────────────────────────────────────────────────────────────

async function startup() {
  // Initialize default settings for fresh installs (silent if already exist)
  await initializeDefaults();

  // Read configurable scan time from settings (default 06:00)
  const scanZeit = await getSettingTyped<string>("fristen.scan_zeit", "06:00");
  const [hours, minutes] = scanZeit.split(":").map(Number);
  const cronPattern = `${minutes} ${hours} * * *`;

  // Register repeatable frist-reminder cron job
  await registerFristReminderJob(cronPattern);

  // Ensure pgvector extension and HNSW index exist (idempotent)
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
      ON document_chunks USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
    log.info("pgvector extension and HNSW index ensured");
  } catch (err) {
    log.warn({ err }, "Failed to ensure pgvector extension/index (non-fatal)");
  }

  // Register AI repeatable jobs (if enabled)
  try {
    const scanEnabled = await getSettingTyped<boolean>("ai.scan_enabled", false);
    if (scanEnabled) {
      const scanInterval = await getSettingTyped<string>("ai.scan_interval", "0 */4 * * *");
      await registerAiProactiveJob(scanInterval);
      log.info({ scanInterval }, "AI proactive scan job registered");

      const briefingEnabled = await getSettingTyped<boolean>("ai.briefing_enabled", false);
      if (briefingEnabled) {
        const briefingTime = await getSettingTyped<string>("ai.briefing_time", "07:00");
        const [bHours, bMinutes] = briefingTime.split(":").map(Number);
        const briefingCron = `${bMinutes} ${bHours} * * *`;
        await registerAiBriefingJob(briefingCron);
        log.info({ briefingTime, briefingCron }, "AI briefing job registered");
      }
    }
  } catch (err) {
    log.warn({ err }, "Failed to register AI jobs (non-fatal)");
  }

  // Register daily Gesetze sync cron job
  try {
    await registerGesetzeSyncJob();
    log.info("Gesetze sync job registered (02:00 Europe/Berlin daily)");
  } catch (err) {
    log.warn({ err }, "Failed to register Gesetze sync job (non-fatal)");
  }

  // Re-queue documents that previously failed OCR (e.g. due to Stirling-PDF being unavailable).
  // Resets FEHLGESCHLAGEN → AUSSTEHEND and enqueues a fresh OCR job.
  try {
    const failedDocs = await prisma.dokument.findMany({
      where: { ocrStatus: "FEHLGESCHLAGEN" },
      select: { id: true, akteId: true, dateipfad: true, mimeType: true, name: true },
    });

    if (failedDocs.length > 0) {
      log.info({ count: failedDocs.length }, "Re-queuing previously failed OCR jobs");

      for (const doc of failedDocs) {
        await prisma.dokument.update({
          where: { id: doc.id },
          data: { ocrStatus: "AUSSTEHEND", ocrFehler: null },
        });

        await ocrQueue.add(
          "ocr-document",
          {
            dokumentId: doc.id,
            akteId: doc.akteId,
            storagePath: doc.dateipfad,
            mimeType: doc.mimeType,
            fileName: doc.name,
          },
          { attempts: 3, backoff: { type: "exponential", delay: 10000 } }
        );
      }

      log.info({ count: failedDocs.length }, "Failed OCR jobs re-queued successfully");
    }
  } catch (err) {
    log.warn({ err }, "Failed to re-queue failed OCR jobs (non-fatal)");
  }

  // Start IMAP connections for all active mailboxes
  try {
    await startImapConnections();
  } catch (err) {
    log.error({ err }, "Failed to start IMAP connections (non-fatal)");
  }

  log.info(
    {
      concurrency,
      queues: [
        "test", "frist-reminder", "email-send", "email-sync",
        "document-ocr", "document-preview", "document-embedding",
        "ai-scan", "ai-briefing", "ai-proactive", "gesetze-sync",
      ],
      fristScanZeit: scanZeit,
    },
    "Worker started"
  );
}

startup().catch((err) => {
  log.fatal({ err }, "Worker startup failed");
  process.exit(1);
});
