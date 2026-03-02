import { Queue, type JobsOptions } from "bullmq";
import { getQueueConnection } from "@/lib/queue/connection";

// ─── Gamification Job Types ─────────────────────────────────────────────────

export interface GamificationJobData {
  userId?: string;     // For quest-check and boss-damage jobs
  kanzleiId?: string;  // For boss-damage, boss-heal, boss-check jobs
  userName?: string;    // For boss-damage jobs (display name)
  // For cron jobs (daily-reset, nightly-safety-net), all fields may be omitted
}

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

/** Akte-embedding queue for nightly summary embedding refresh (SCAN-05) */
export const akteEmbeddingQueue = new Queue("akte-embedding", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 86_400 },   // 24h
    removeOnFail: { age: 604_800 },      // 7 days
  },
});

/** Urteile-sync queue for daily BMJ federal courts RSS ingestion cron */
export const urteileSyncQueue = new Queue("urteile-sync", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "custom" },
    removeOnComplete: { age: 86_400 },   // 24h
    removeOnFail: { age: 604_800 },      // 7 days
  },
});

/**
 * Muster-ingestion queue for automatic chunk ingestion after NER gate passes.
 * attempts: 2 — retry once on transient embedding or MinIO failures.
 */
export const musterIngestionQueue = new Queue("muster-ingestion", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "custom" },
    removeOnComplete: { age: 86_400 },   // 24h
    removeOnFail: { age: 604_800 },      // 7 days
  },
});

/**
 * Helena-Task queue for @Helena agent runs.
 * attempts: 1 -- agent runs are NOT idempotent (no retry).
 * 7-day complete retention for audit trail, 30-day fail retention for debugging.
 */
export const helenaTaskQueue = new Queue("helena-task", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 86_400 * 7 },   // 7 days
    removeOnFail: { age: 86_400 * 30 },       // 30 days
  },
});

/**
 * Scanner queue for nightly deterministic Akten scanning.
 * attempts: 2 -- retry once on transient DB failures.
 * No LLM calls, fast deterministic checks only.
 */
export const scannerQueue = new Queue("scanner", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "custom" },
    removeOnComplete: { age: 86_400 }, // 24h
    removeOnFail: { age: 604_800 }, // 7 days
  },
});

/**
 * Gamification queue for async quest evaluation, daily reset, and nightly safety net.
 * attempts: 1 — quest evaluation is idempotent, no retry needed.
 */
export const gamificationQueue = new Queue<GamificationJobData>("gamification", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 1,              // Quest eval is idempotent, no retry needed
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
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
  urteileSyncQueue,
  musterIngestionQueue,
  helenaTaskQueue,
  scannerQueue,
  akteEmbeddingQueue,
  gamificationQueue,
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

/**
 * Register the daily Akte embedding refresh cron job (SCAN-05).
 * Runs at 02:30 Europe/Berlin — after Gesetze sync (02:00), before Urteile sync (03:00).
 *
 * @param cronPattern - Cron expression (default: "30 2 * * *" = 02:30 daily)
 */
export async function registerAkteEmbeddingJob(
  cronPattern = "30 2 * * *"
): Promise<void> {
  await akteEmbeddingQueue.upsertJobScheduler(
    "akte-embedding-daily",
    {
      pattern: cronPattern,
      tz: "Europe/Berlin",
    },
    {
      name: "refresh-akte-embeddings",
      data: {},
      opts: {
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 20 },
      },
    }
  );
}

/**
 * Register the daily Urteile sync cron job.
 * Uses upsertJobScheduler for idempotent (re)registration.
 * Runs at 03:00 Europe/Berlin — one hour after Gesetze sync at 02:00.
 *
 * @param cronPattern - Cron expression (default: "0 3 * * *" = 03:00 daily)
 */
export async function registerUrteileSyncJob(
  cronPattern = "0 3 * * *"
): Promise<void> {
  await urteileSyncQueue.upsertJobScheduler(
    "urteile-sync-daily",
    {
      pattern: cronPattern,
      tz: "Europe/Berlin",
    },
    {
      name: "sync-urteile",
      data: {},
      opts: {
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 20 },
      },
    }
  );
}

/**
 * Register the nightly scanner cron job.
 * Uses upsertJobScheduler for idempotent (re)registration.
 *
 * @param cronPattern - Cron expression (default: "0 1 * * *" = 01:00 daily)
 */
export async function registerScannerJob(
  cronPattern = "0 1 * * *"
): Promise<void> {
  await scannerQueue.upsertJobScheduler(
    "scanner-nightly",
    {
      pattern: cronPattern,
      tz: "Europe/Berlin",
    },
    {
      name: "nightly-scan",
      data: {},
      opts: {
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
      },
    }
  );
}

/**
 * Register gamification cron jobs:
 * 1. Daily reset at 00:05 -- placeholder for future daily quest rotation
 * 2. Nightly safety net at 23:55 -- catches missed quest completions, finalizes streaks
 */
export async function registerGamificationCrons(): Promise<void> {
  // Daily reset at 00:05 Europe/Berlin
  await gamificationQueue.upsertJobScheduler(
    "gamification-daily-reset",
    { pattern: "5 0 * * *", tz: "Europe/Berlin" },
    {
      name: "daily-reset",
      data: {},
      opts: { removeOnComplete: { count: 50 }, removeOnFail: { count: 20 } },
    }
  );

  // Nightly safety net at 23:55 Europe/Berlin
  await gamificationQueue.upsertJobScheduler(
    "gamification-nightly-safety-net",
    { pattern: "55 23 * * *", tz: "Europe/Berlin" },
    {
      name: "nightly-safety-net",
      data: {},
      opts: { removeOnComplete: { count: 50 }, removeOnFail: { count: 20 } },
    }
  );

  // Weekly snapshot at Monday 00:00 Europe/Berlin (baseline for delta quests)
  await gamificationQueue.upsertJobScheduler(
    "gamification-weekly-snapshot",
    { pattern: "0 0 * * 1", tz: "Europe/Berlin" },
    {
      name: "weekly-snapshot",
      data: {},
      opts: { removeOnComplete: { count: 10 }, removeOnFail: { count: 10 } },
    }
  );
}
