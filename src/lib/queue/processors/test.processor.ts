import type { Job } from "bullmq";
import { createLogger } from "@/lib/logger";

const log = createLogger("test-processor");

export interface TestJobData {
  userId: string;
  message: string;
}

/**
 * Test processor — logs job data, simulates 1s of work, returns success.
 * Used to verify the full BullMQ pipeline (enqueue -> Redis -> worker -> process).
 */
export async function testProcessor(
  job: Job<TestJobData>
): Promise<{ success: boolean }> {
  log.info(
    { jobId: job.id, userId: job.data.userId, message: job.data.message },
    "Processing test job"
  );

  // Simulate work
  await new Promise((resolve) => setTimeout(resolve, 1000));

  log.info({ jobId: job.id }, "Test job completed");
  return { success: true };
}
