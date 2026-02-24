import { Worker } from "bullmq";
import { createRedisConnection } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { calculateBackoff, registerFristReminderJob } from "@/lib/queue/queues";
import { testProcessor, type TestJobData } from "@/lib/queue/processors/test.processor";
import { processFristReminders } from "@/workers/processors/frist-reminder";
import { initializeDefaults, getSettingTyped } from "@/lib/settings/service";
import { getSocketEmitter } from "@/lib/socket/emitter";

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

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

async function gracefulShutdown(signal: string) {
  log.info({ signal }, "Received shutdown signal, closing workers...");

  try {
    await Promise.all(workers.map((w) => w.close()));
    log.info("All workers closed, exiting");
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

  log.info(
    { concurrency, queues: ["test", "frist-reminder"], fristScanZeit: scanZeit },
    "Worker started"
  );
}

startup().catch((err) => {
  log.fatal({ err }, "Worker startup failed");
  process.exit(1);
});
