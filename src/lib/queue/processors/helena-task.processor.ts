/**
 * BullMQ processor for Helena agent task execution.
 *
 * Bridges BullMQ jobs to runHelenaAgent() with:
 * - AbortController lifecycle (create -> store -> abort on signal -> delete in finally)
 * - Socket.IO progress events per step (helena:task-started/progress/completed/failed)
 * - job.updateProgress() on each step to reset BullMQ lock timer (anti-stall, AGNT-07)
 * - Full AgentStep[] trace stored in HelenaTask.steps on completion (TASK-03)
 * - HelenaMemory loaded from DB and passed to agent (if exists)
 *
 * Socket.IO Event Types:
 * - helena:task-started  -> { taskId, akteId, auftrag }
 * - helena:task-progress -> { taskId, akteId, stepNumber, maxSteps, toolName, resultSummary }
 * - helena:task-completed -> { taskId, akteId, status, ergebnis }
 * - helena:task-failed   -> { taskId, akteId, error }
 *
 * Anti-patterns avoided:
 * - attempts > 1 on queue (agent runs are not idempotent)
 * - Default lockDuration 30s (set on Worker in Plan 02, not here)
 * - AbortControllers in Redis (must be in-process)
 * - Enqueue before creating HelenaTask (race condition -- handled in task-service)
 */

import type { Job } from "bullmq";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runHelenaAgent } from "@/lib/helena";
import { getSocketEmitter } from "@/lib/socket/emitter";
import { loadOrRefresh } from "@/lib/helena/memory-service";
import { createLogger } from "@/lib/logger";
import type { MessageNewPayload } from "@/lib/messaging/types";

const log = createLogger("helena-task-processor");

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Job data payload for helena-task BullMQ jobs */
export interface HelenaTaskJobData {
  taskId: string;
  userId: string;
  userRole: string;
  userName: string;
  akteId: string;
  auftrag: string;
  prioritaet: number;
}

// ---------------------------------------------------------------------------
// AbortController management (in-process only -- NOT in Redis)
// ---------------------------------------------------------------------------

const abortControllers = new Map<string, AbortController>();

/**
 * Abort a running Helena task by taskId.
 * @returns true if the task was found and abort signal sent
 */
export function abortTask(taskId: string): boolean {
  const controller = abortControllers.get(taskId);
  if (!controller) return false;
  controller.abort("user-cancel");
  return true;
}

/**
 * Get IDs of currently running tasks (for startup recovery / health checks).
 */
export function getActiveTaskIds(): string[] {
  return Array.from(abortControllers.keys());
}

// ---------------------------------------------------------------------------
// Helena system user lookup (cached, idempotent upsert fallback)
// ---------------------------------------------------------------------------

let helenaUserIdPromise: Promise<string> | null = null;

/**
 * Get the system user ID for Helena.
 *
 * Uses a module-level cached promise so we only query once per process lifetime.
 * Falls back to creating a system user if none exists (idempotent via upsert).
 */
async function getHelenaUserId(): Promise<string> {
  if (!helenaUserIdPromise) {
    helenaUserIdPromise = (async () => {
      // Try to find existing system user
      const existing = await prisma.user.findFirst({
        where: { isSystem: true },
        select: { id: true },
      });
      if (existing) return existing.id;

      // Fallback: create a system user for Helena (idempotent via upsert)
      const helena = await prisma.user.upsert({
        where: { email: "helena@system.local" },
        update: {},
        create: {
          email: "helena@system.local",
          name: "Helena",
          passwordHash: "", // System user -- no login
          isSystem: true,
          role: "ADMIN",
          kanzleiId: (await prisma.kanzlei.findFirst({ select: { id: true } }))!.id,
        },
        select: { id: true },
      });
      return helena.id;
    })();
  }
  return helenaUserIdPromise;
}

/**
 * Post Helena's response back to the originating channel as a system message.
 *
 * Creates a Message record and emits `message:new` via Socket.IO.
 * Non-fatal: logs warning on failure but does not throw.
 */
async function postHelenaResponseToChannel(
  channelId: string,
  response: string,
): Promise<void> {
  try {
    const helenaUserId = await getHelenaUserId();

    const message = await prisma.message.create({
      data: {
        channelId,
        authorId: helenaUserId,
        body: response,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, isSystem: true } },
      },
    });

    const payload: MessageNewPayload = {
      id: message.id,
      channelId,
      authorId: message.authorId,
      authorName: message.author.name || "Helena",
      authorAvatarUrl: message.author.avatarUrl,
      body: message.body,
      mentions: null,
      attachments: null,
      parentId: null,
      createdAt: message.createdAt.toISOString(),
      isSystem: true,
    };

    getSocketEmitter()
      .to(`channel:${channelId}`)
      .emit("message:new", payload);

    log.info({ channelId, messageId: message.id }, "Helena response posted to channel");
  } catch (err) {
    log.warn({ err, channelId }, "Failed to post Helena response to channel (non-fatal)");
  }
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

/**
 * Process a Helena agent task BullMQ job.
 *
 * 1. Updates task status to RUNNING
 * 2. Emits helena:task-started via Socket.IO
 * 3. Loads HelenaMemory for the Akte (if exists)
 * 4. Runs the Helena agent with progress callbacks
 * 5. Stores complete AgentStep[] trace and result
 * 6. Emits helena:task-completed or helena:task-failed
 */
export async function processHelenaTask(
  job: Job<HelenaTaskJobData>,
): Promise<void> {
  const { taskId, userId, userRole, userName, akteId, auftrag } = job.data;

  const emitter = getSocketEmitter();
  const controller = new AbortController();
  abortControllers.set(taskId, controller);

  try {
    // 1. Mark task as RUNNING
    await prisma.helenaTask.update({
      where: { id: taskId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    // 2. Emit task started event
    emitter.to(`user:${userId}`).emit("helena:task-started", {
      taskId,
      akteId,
      auftrag,
    });

    // 3. Load HelenaMemory with staleness check + auto-refresh (MEM-02, MEM-03)
    const memoryResult = await loadOrRefresh(prisma, akteId);

    // 4. Run Helena agent
    const result = await runHelenaAgent({
      prisma,
      userId,
      userRole: userRole as UserRole,
      userName,
      akteId,
      message: auftrag,
      mode: "background",
      abortSignal: controller.signal,
      helenaMemory: memoryResult.content
        ? { ...memoryResult.content, _changes: memoryResult.changes }
        : null,
      onStepUpdate: (step) => {
        // Reset BullMQ lock timer on each step (anti-stall, AGNT-07)
        job.updateProgress({
          stepNumber: step.stepNumber,
          maxSteps: step.maxSteps,
          toolName: step.toolName,
          resultSummary: step.resultSummary,
        });

        // Emit progress via Socket.IO
        emitter.to(`user:${userId}`).emit("helena:task-progress", {
          taskId,
          akteId,
          stepNumber: step.stepNumber,
          maxSteps: step.maxSteps,
          toolName: step.toolName,
          resultSummary: step.resultSummary,
        });
      },
    });

    // 5. Determine final status
    const finalStatus =
      result.finishReason === "abort" ? "ABGEBROCHEN" : "DONE";

    // 6. Store result and trace
    await prisma.helenaTask.update({
      where: { id: taskId },
      data: {
        status: finalStatus,
        steps: JSON.parse(JSON.stringify(result.steps)),
        ergebnis: result.text,
        completedAt: new Date(),
      },
    });

    // 7. Emit completion
    emitter.to(`user:${userId}`).emit("helena:task-completed", {
      taskId,
      akteId,
      status: finalStatus,
      ergebnis: result.text.slice(0, 200),
    });

    log.info(
      {
        taskId,
        akteId,
        status: finalStatus,
        steps: result.steps.length,
        finishReason: result.finishReason,
      },
      "Helena task completed",
    );

    // 8. Post response back to channel if triggered from @Helena mention
    if (finalStatus === "DONE" && result.text) {
      const task = await prisma.helenaTask.findUnique({
        where: { id: taskId },
        select: { channelId: true },
      });
      if (task?.channelId) {
        await postHelenaResponseToChannel(task.channelId, result.text);
      }
    }
  } catch (error: unknown) {
    const errMsg =
      error instanceof Error ? error.message : String(error);

    log.error({ taskId, error: errMsg }, "Helena task failed");

    // Update task status to FAILED
    await prisma.helenaTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        fehler: errMsg,
        completedAt: new Date(),
      },
    });

    // Emit failure event
    emitter.to(`user:${userId}`).emit("helena:task-failed", {
      taskId,
      akteId,
      error: errMsg,
    });
  } finally {
    // Always clean up AbortController
    abortControllers.delete(taskId);
  }
}
