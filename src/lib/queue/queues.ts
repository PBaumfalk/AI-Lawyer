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

/** All queues for Bull Board auto-discovery and job retry lookup */
export const ALL_QUEUES: Queue[] = [testQueue];
