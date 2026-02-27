/**
 * Helena Task Service -- creates HelenaTask records and enqueues BullMQ jobs.
 *
 * Ensures correct ordering: Prisma record created BEFORE BullMQ job enqueue
 * to prevent race conditions (processor might start before DB record exists).
 *
 * Priority mapping: domain priority (1-10, higher = more urgent) is inverted
 * for BullMQ (lower number = processed first):
 *   Manual @-tag: prioritaet 8 -> BullMQ priority 2
 *   Scanner:      prioritaet 3 -> BullMQ priority 7
 */

import { prisma } from "@/lib/db";
import { helenaTaskQueue } from "@/lib/queue/queues";
import { createLogger } from "@/lib/logger";
import type { HelenaTaskJobData } from "@/lib/queue/processors/helena-task.processor";

const log = createLogger("helena-task-service");

/** Options for creating a new Helena task */
export interface CreateTaskOptions {
  userId: string;
  userRole: string;
  userName: string;
  akteId: string;
  auftrag: string;
  /** 1-10, higher = more urgent. Manual @-tag: 8, scanner: 3 */
  prioritaet?: number;
  /** Source: "at-mention" | "manual" | "scanner" | "chat" */
  quelle?: string;
}

/**
 * Create a HelenaTask record and enqueue a BullMQ job for processing.
 *
 * IMPORTANT: Always creates the Prisma record BEFORE enqueuing the BullMQ job
 * to prevent the race condition where the processor starts before the DB record exists.
 *
 * @returns The created HelenaTask Prisma record
 */
export async function createHelenaTask(options: CreateTaskOptions) {
  const {
    userId,
    userRole,
    userName,
    akteId,
    auftrag,
    prioritaet = 5,
    quelle = "manual",
  } = options;

  // 1. Create HelenaTask record in DB (BEFORE enqueue -- no race condition)
  const task = await prisma.helenaTask.create({
    data: {
      userId,
      akteId,
      auftrag,
      status: "PENDING",
      modus: "BACKGROUND",
      prioritaet,
    },
  });

  // 2. Invert priority for BullMQ (higher domain priority -> lower BullMQ number -> processed first)
  const bullmqPriority = Math.max(1, 10 - prioritaet);

  // 3. Build job data matching HelenaTaskJobData interface
  const jobData: HelenaTaskJobData = {
    taskId: task.id,
    userId,
    userRole,
    userName,
    akteId,
    auftrag,
    prioritaet,
  };

  // 4. Enqueue BullMQ job
  await helenaTaskQueue.add("helena-task", jobData, {
    priority: bullmqPriority,
    jobId: `helena-task-${task.id}`,
  });

  log.info(
    { taskId: task.id, akteId, prioritaet, bullmqPriority, quelle },
    "Helena task created and enqueued",
  );

  return task;
}
