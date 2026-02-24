/**
 * BullMQ Queue Definitions
 *
 * Central registry for all background job queues.
 * Each queue is created lazily and reused across the application.
 */

import { Queue } from "bullmq";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

function parseRedisUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: parseInt(parsed.port || "6379", 10),
      password: parsed.password || undefined,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

const connection = parseRedisUrl(REDIS_URL);

// Lazy queue instances
let _fristReminderQueue: Queue | null = null;

/**
 * Queue for Frist (deadline) reminder notifications.
 * Checks for upcoming deadlines and sends notifications.
 */
export function getFristReminderQueue(): Queue {
  if (!_fristReminderQueue) {
    _fristReminderQueue = new Queue("frist-reminder", { connection });
  }
  return _fristReminderQueue;
}

/**
 * Register the repeatable frist reminder job.
 * Runs every 5 minutes Mon-Fri 7-19h (Kanzlei working hours).
 */
export async function registerFristReminderJob() {
  const queue = getFristReminderQueue();
  await queue.upsertJobScheduler(
    "frist-reminder-check",
    { pattern: "*/5 7-19 * * 1-5" },
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
