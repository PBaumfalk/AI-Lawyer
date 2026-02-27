import { Queue, type JobsOptions } from "bullmq";
import { getQueueConnection } from "@/lib/queue/connection";

/** Custom backoff intervals: 10s, 60s, 5min (per user decision) */
const BACKOFF_DELAYS = [10_000, 60_000, 300_000];

/**
 * Calculate custom backoff delay based on attempt number.
 * Returns: attempt 1 -> 10s, attempt 2 -> 60s, attempt 3+ -> 5min
 */
export function calculateBackoff(attemptsMade: number): number {
  const index = Math.min(attemptsMade - 1, BACKOFF_DELAYS.length - 1);
  return BACKOFF_DELAYS[index];
}

/** Default job options shared across all queues */
const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: "custom" },
  removeOnComplete: { age: 86_400 },   // 24h
  removeOnFail: { age: 604_800 },      // 7 days
};

/** Test queue for verifying BullMQ pipeline */
export const testQueue = new Queue("test", {
  connection: getQueueConnection(),
  defaultJobOptions,
});

/** Frist-Reminder queue for daily deadline reminder scans */
export const fristReminderQueue = new Queue("frist-reminder", {
  connection: getQueueConnection(),
  defaultJobOptions,
});

/** Email-Send queue for outgoing emails via SMTP */
export const emailSendQueue = new Queue("email-send", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 3,
    removeOnComplete: { age: 86_400 },   // 1 day
    removeOnFail: { age: 604_800 },      // 7 days
  },
});

/** Email-Sync queue for on-demand IMAP sync requests */
export const emailSyncQueue = new Queue("email-sync", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,
    removeOnComplete: { age: 3_600 },    // 1 hour
    removeOnFail: { age: 86_400 },       // 1 day
  },
});

/** OCR queue for document OCR processing via Stirling-PDF */
export const ocrQueue = new Queue("document-ocr", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 3,
    removeOnComplete: { age: 86_400 },   // 1 day
    removeOnFail: { age: 604_800 },      // 7 days
  },
});

/** Embedding queue for generating document chunk embeddings */
export const embeddingQueue = new Queue("document-embedding", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
  },
});

/** Preview queue for generating PDF previews of non-PDF documents */
export const previewQueue = new Queue("document-preview", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
  },
});

/** AI Scan queue for Helena document/email analysis */
export const aiScanQueue = new Queue("ai-scan", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
  },
});

/** AI Briefing queue for daily morning briefings */
export const aiBriefingQueue = new Queue("ai-briefing", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 86_400 },
  },
});

/** AI Proactive queue for periodic Akten scanning */
export const aiProactiveQueue = new Queue("ai-proactive", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 1,
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 86_400 },
  },
});

/** Gesetze-sync queue for daily bundestag/gesetze ingestion cron */
export const gesetzeSyncQueue = new Queue("gesetze-sync", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "custom" },
    removeOnComplete: { age: 86_400 },   // 24h
    removeOnFail: { age: 604_800 },      // 7 days
  },
});

/**
 * NER-PII queue for async Muster NER processing (ARBW-03 compliance).
 * attempts: 1 — NER timeout is a permanent fail (no retry), processor resets nerStatus to PENDING_NER.
 */
export const nerPiiQueue = new Queue("ner-pii", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 1,           // NER is non-retryable by design — timeout = permanent fail
    backoff: { type: "custom" },
    removeOnComplete: { age: 86_400 },   // 24h
    removeOnFail: { age: 604_800 },      // 7 days
  },
});

/** All queues for Bull Board auto-discovery and job retry lookup */
export const ALL_QUEUES: Queue[] = [
  testQueue,
  fristReminderQueue,
  emailSendQueue,
  emailSyncQueue,
  ocrQueue,
  embeddingQueue,
  previewQueue,
  aiScanQueue,
  aiBriefingQueue,
  aiProactiveQueue,
  gesetzeSyncQueue,
  nerPiiQueue,
];

/**
 * Register the repeatable frist-reminder cron job.
 * Uses upsertJobScheduler for idempotent (re)registration.
 *
 * @param cronPattern - Cron expression (default: "0 6 * * *" = 6:00 AM daily)
 */
export async function registerFristReminderJob(
  cronPattern = "0 6 * * *"
): Promise<void> {
  await fristReminderQueue.upsertJobScheduler(
    "frist-reminder-daily",
    {
      pattern: cronPattern,
      tz: "Europe/Berlin",
    },
    {
      name: "check-fristen",
      data: {},
      opts: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    }
  );
}

/**
 * Register the repeatable AI proactive scanning job.
 *
 * @param cronPattern - Cron expression (default: every 4 hours)
 */
export async function registerAiProactiveJob(
  cronPattern = "0 */4 * * *"
): Promise<void> {
  await aiProactiveQueue.upsertJobScheduler(
    "ai-proactive-scan",
    {
      pattern: cronPattern,
      tz: "Europe/Berlin",
    },
    {
      name: "proactive-scan",
      data: {},
      opts: {
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
      },
    }
  );
}

/**
 * Register the repeatable AI briefing job.
 * Creates briefings for all active ANWALT users.
 *
 * @param cronPattern - Cron expression (default: 07:00 daily)
 */
export async function registerAiBriefingJob(
  cronPattern = "0 7 * * *"
): Promise<void> {
  await aiBriefingQueue.upsertJobScheduler(
    "ai-briefing-daily",
    {
      pattern: cronPattern,
      tz: "Europe/Berlin",
    },
    {
      name: "daily-briefing",
      data: {},
      opts: {
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
      },
    }
  );
}

/**
 * Register the daily Gesetze sync cron job.
 * Uses upsertJobScheduler for idempotent (re)registration.
 *
 * @param cronPattern - Cron expression (default: "0 2 * * *" = 02:00 daily)
 */
export async function registerGesetzeSyncJob(
  cronPattern = "0 2 * * *"
): Promise<void> {
  await gesetzeSyncQueue.upsertJobScheduler(
    "gesetze-sync-daily",
    {
      pattern: cronPattern,
      tz: "Europe/Berlin",
    },
    {
      name: "sync-gesetze",
      data: {},
      opts: {
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 20 },
      },
    }
  );
}
