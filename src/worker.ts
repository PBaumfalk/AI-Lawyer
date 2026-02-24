import { Worker } from "bullmq";
import { createRedisConnection } from "@/lib/redis";
import { createLogger } from "@/lib/logger";
import { calculateBackoff } from "@/lib/queue/queues";
import { testProcessor, type TestJobData } from "@/lib/queue/processors/test.processor";
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
    } catch {
      // Ignore malformed messages
    }
  }
});

// ─── Startup ────────────────────────────────────────────────────────────────

log.info(
  { concurrency, queues: ["test"] },
  "Worker started"
);
