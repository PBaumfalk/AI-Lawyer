# Phase 21: @Helena Task-System - Research

**Researched:** 2026-02-27
**Domain:** BullMQ Task Queue, @-mention Parsing, Socket.IO Progress Events, Task Lifecycle, Agent Integration
**Confidence:** HIGH

## Summary

Phase 21 connects Phase 20's pure-library Helena agent engine to the production infrastructure: BullMQ queue, worker process, @-mention detection, real-time progress via Socket.IO, task lifecycle management, and abort support. The goal is to let users trigger Helena tasks by typing `@Helena [Aufgabe]` in any note or comment field, track progress in real-time, and abort running tasks.

The existing codebase provides all the building blocks. Phase 19 created the `HelenaTask` Prisma model with the full status enum (PENDING, RUNNING, DONE, FAILED, WAITING_APPROVAL, ABGEBROCHEN), JSON `steps[]` field, and priority field. Phase 20 built the complete `runHelenaAgent()` entry point with `onStepUpdate` callbacks, `abortSignal` support, and `AgentStep[]` trace capture. The worker process (`src/worker.ts`) already has 14 BullMQ workers with Socket.IO emitter integration and graceful shutdown. The queue infrastructure (`src/lib/queue/queues.ts`) provides the pattern for adding new queues with configurable job options.

The main new work is: (1) a new `helena-task` BullMQ queue with `lockDuration: 120_000`, (2) a processor that bridges BullMQ jobs to `runHelenaAgent()`, (3) an `@Helena` mention parser/detector, (4) an API route to create HelenaTask records and enqueue jobs, (5) Socket.IO progress events during agent execution, and (6) an abort API that sets task status to ABGEBROCHEN and signals the agent loop to stop.

**Primary recommendation:** Add a `helenaTaskQueue` to `src/lib/queue/queues.ts` with `lockDuration: 120_000` and a `helena-task.processor.ts` that calls `runHelenaAgent()` with the BullMQ job's `updateProgress()` wired to the `onStepUpdate` callback. Parse `@Helena` mentions via a simple regex in the API route that creates notes/comments. Priority 8 for manual @-tag tasks vs priority 3 for scanner-generated tasks.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TASK-01 | @Helena-Tagging in Notiz/Kommentar-Feldern wird als HelenaTask geparst und in die Queue eingestellt | Regex-based `@Helena` detection in API routes that create notes/activities. Creates HelenaTask record with PENDING status, enqueues BullMQ job. Pattern follows existing queue.add() patterns in worker.ts. |
| TASK-03 | HelenaTask speichert vollstaendigen Agent-Trace (Gedanken + Tool-Aufrufe als JSON steps[]) | Phase 20's `runHelenaAgent()` already returns `AgentStep[]` in `result.steps`. Processor writes this array to `HelenaTask.steps` JSON field via `prisma.helenaTask.update()` after agent run completes. |
| TASK-04 | Task-Prioritaeten (1-10) mit hoeherer Prioritaet fuer manuell zugewiesene Tasks vs Background-Scanner | BullMQ `Queue.add()` accepts `priority` option (lower number = higher priority). Manual @-tag tasks get priority 2, scanner tasks get priority 8. HelenaTask.prioritaet stores the value for UI display. |
| TASK-05 | Task-Abbruch via UI setzt Status auf ABGEBROCHEN -- Agent-Loop prueft zwischen Steps | Phase 20's `runAgent()` accepts `abortSignal`. Abort API sets task status to ABGEBROCHEN and stores an AbortController per job ID in a Map. The processor checks `abortSignal.aborted` between steps via the existing `onStepFinish` callback. |
| AGNT-07 | BullMQ Helena-Task-Queue mit lockDuration:120000 und job.updateProgress() pro Step (Anti-Stall) | New Queue with `lockDuration: 120_000` prevents BullMQ from considering the job stalled during long LLM calls (default 30s would cause duplicate runs). `job.updateProgress()` called in `onStepUpdate` callback resets the lock timer. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bullmq | ^5.70.1 | Helena task queue + worker with priority support | Already installed; provides lockDuration, priority, updateProgress, and job lifecycle |
| ai (Vercel AI SDK) | 4.3.19 | Agent execution via `runHelenaAgent()` from Phase 20 | Already installed; the agent engine that tasks invoke |
| @prisma/client | ^5.22.0 | HelenaTask CRUD (create, update status/steps/ergebnis) | Already installed; HelenaTask model exists from Phase 19 |
| socket.io / @socket.io/redis-emitter | ^4.8.3 / ^5.1.0 | Progress events emitted from worker to browser clients | Already installed; `getSocketEmitter()` pattern established in worker.ts |
| ioredis | ^5.9.3 | BullMQ connection (queue + worker) | Already installed; `getWorkerConnection()` and `getQueueConnection()` in connection.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^3.23.8 | API request body validation for task creation endpoint | Already installed; validate @Helena task input |
| vitest | ^4.0.18 | Unit tests for parser, processor, and abort flow | Already in devDependencies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Regex @Helena parser | Full mention/autocomplete library (e.g., tributejs) | Regex is sufficient for `@Helena [text]` pattern. Full autocomplete is a UI Phase 26 concern. |
| AbortController Map for cancel | Redis pub/sub cancel channel | In-process Map is simpler since worker runs in a single Node process. Redis pub/sub would be needed for multi-worker horizontal scaling, which is not the current architecture. |
| BullMQ priority field | Separate queues for manual vs scanner tasks | Single queue with priority is cleaner. BullMQ v5 supports priority natively via sorted sets. No need for separate queues. |

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/helena/
  task-service.ts          # HelenaTask CRUD: create, update status, attach trace
  at-mention-parser.ts     # @Helena mention detection and task text extraction

src/lib/queue/
  queues.ts                # ADD: helenaTaskQueue with lockDuration: 120_000
  processors/
    helena-task.processor.ts  # BullMQ processor: bridges job -> runHelenaAgent()

src/worker.ts              # ADD: helena-task worker registration + Socket.IO progress

src/app/api/
  helena/tasks/
    route.ts               # POST: create task manually (from @Helena mention or UI button)
  helena/tasks/[id]/
    route.ts               # GET: task detail, PATCH: abort task
  akten/[id]/notizen/
    route.ts               # POST: create note -- detect @Helena mention, create task
```

### Pattern 1: BullMQ Queue with Extended Lock Duration
**What:** Helena agent runs take 30s-3min. Default BullMQ lock (30s) would mark the job as stalled and re-queue it, causing duplicate agent runs.
**When to use:** Always for the helena-task queue.

```typescript
// src/lib/queue/queues.ts -- addition

/** Helena-Task queue for @Helena agent runs */
export const helenaTaskQueue = new Queue("helena-task", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 1,               // Agent tasks are NOT retryable (idempotency not guaranteed)
    removeOnComplete: { age: 86_400 * 7 },  // Keep 7 days for audit trail
    removeOnFail: { age: 86_400 * 30 },     // Keep 30 days for debugging
  },
});
```

### Pattern 2: Helena Task Processor with Progress + Abort
**What:** BullMQ processor that creates an AbortController, wires `onStepUpdate` to `job.updateProgress()` and Socket.IO emit, then calls `runHelenaAgent()`.
**When to use:** Every Helena background task.

```typescript
// src/lib/queue/processors/helena-task.processor.ts
import type { Job } from "bullmq";
import { prisma } from "@/lib/db";
import { runHelenaAgent } from "@/lib/helena";
import { getSocketEmitter } from "@/lib/socket/emitter";
import { createLogger } from "@/lib/logger";

const log = createLogger("helena-task-processor");

export interface HelenaTaskJobData {
  taskId: string;
  userId: string;
  userRole: string;
  userName: string;
  akteId: string;
  auftrag: string;
  prioritaet: number;
}

// In-process abort controllers -- keyed by taskId
const abortControllers = new Map<string, AbortController>();

export function abortTask(taskId: string): boolean {
  const controller = abortControllers.get(taskId);
  if (controller) {
    controller.abort("user-cancel");
    return true;
  }
  return false;
}

export async function processHelenaTask(job: Job<HelenaTaskJobData>): Promise<void> {
  const { taskId, userId, userRole, userName, akteId, auftrag } = job.data;
  const emitter = getSocketEmitter();

  // 1. Create AbortController for this task
  const controller = new AbortController();
  abortControllers.set(taskId, controller);

  try {
    // 2. Update task status to RUNNING
    await prisma.helenaTask.update({
      where: { id: taskId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    // Notify user: task started
    emitter.to(`user:${userId}`).emit("helena:task-started", {
      taskId,
      akteId,
      auftrag,
    });

    // 3. Run the Helena agent with progress callback
    const result = await runHelenaAgent({
      prisma,
      userId,
      userRole: userRole as any,
      userName,
      akteId,
      message: auftrag,
      mode: "background",
      abortSignal: controller.signal,
      onStepUpdate: (step) => {
        // a) Update BullMQ job progress (resets lock timer -- anti-stall)
        job.updateProgress({
          stepNumber: step.stepNumber,
          maxSteps: step.maxSteps,
          toolName: step.toolName,
          resultSummary: step.resultSummary,
        });

        // b) Emit Socket.IO progress to user
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

    // 4. Store result in HelenaTask
    const finalStatus = result.finishReason === "abort" ? "ABGEBROCHEN" : "DONE";

    await prisma.helenaTask.update({
      where: { id: taskId },
      data: {
        status: finalStatus,
        steps: result.steps as any,
        ergebnis: result.text,
        completedAt: new Date(),
      },
    });

    // 5. Notify user: task completed
    emitter.to(`user:${userId}`).emit("helena:task-completed", {
      taskId,
      akteId,
      status: finalStatus,
      ergebnis: result.text.slice(0, 200),
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error({ taskId, error: errMsg }, "Helena task failed");

    await prisma.helenaTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        fehler: errMsg,
        completedAt: new Date(),
      },
    });

    emitter.to(`user:${userId}`).emit("helena:task-failed", {
      taskId,
      akteId,
      error: errMsg,
    });
  } finally {
    abortControllers.delete(taskId);
  }
}
```

### Pattern 3: @Helena Mention Parser
**What:** Simple regex-based parser that extracts task text from `@Helena [aufgabe]` mentions in note/comment text.
**When to use:** In any API route that creates notes or comments (Akte notizen, AktenActivity, etc.).

```typescript
// src/lib/helena/at-mention-parser.ts

/**
 * Detect @Helena mentions in text and extract the task instruction.
 *
 * Patterns matched:
 *   "@Helena recherchiere BGH-Urteile zu 823 BGB"
 *   "@helena erstelle einen Schriftsatz"
 *   "@HELENA pruefe die Fristen"
 *
 * Returns null if no @Helena mention found.
 * Returns the instruction text after @Helena if found.
 */
export function parseHelenaMention(text: string): string | null {
  // Match @Helena (case-insensitive) followed by at least some text
  const match = text.match(/@helena\s+(.+)/i);
  if (!match || !match[1]?.trim()) return null;
  return match[1].trim();
}

/**
 * Check if text contains an @Helena mention.
 */
export function hasHelenaMention(text: string): boolean {
  return /@helena\b/i.test(text);
}
```

### Pattern 4: Task Service (HelenaTask CRUD)
**What:** Centralized service for creating and managing HelenaTask records, decoupled from API routes.
**When to use:** Called from API routes, the @-mention detector, and potentially the scanner (Phase 24).

```typescript
// src/lib/helena/task-service.ts

import { prisma } from "@/lib/db";
import { helenaTaskQueue } from "@/lib/queue/queues";
import type { HelenaTaskJobData } from "@/lib/queue/processors/helena-task.processor";

export interface CreateTaskOptions {
  userId: string;
  userRole: string;
  userName: string;
  akteId: string;
  auftrag: string;
  /** 1-10, higher = more urgent. Manual @-tag: 8, scanner: 3 */
  prioritaet?: number;
  /** Source of the task: "manual" | "at-mention" | "scanner" */
  quelle?: string;
}

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

  // 1. Create HelenaTask record with PENDING status
  const task = await prisma.helenaTask.create({
    data: {
      akteId,
      userId,
      auftrag,
      status: "PENDING",
      modus: "BACKGROUND",
      prioritaet,
    },
  });

  // 2. Enqueue BullMQ job with priority
  // BullMQ priority: lower number = higher priority
  // Manual: prioritaet 8 -> BullMQ priority 2 (10 - 8)
  // Scanner: prioritaet 3 -> BullMQ priority 7 (10 - 3)
  const bullmqPriority = Math.max(1, 10 - prioritaet);

  const jobData: HelenaTaskJobData = {
    taskId: task.id,
    userId,
    userRole,
    userName,
    akteId,
    auftrag,
    prioritaet,
  };

  await helenaTaskQueue.add("helena-task", jobData, {
    priority: bullmqPriority,
    jobId: `helena-task-${task.id}`,  // Idempotency key
  });

  return task;
}
```

### Pattern 5: Worker Registration (following existing patterns)
**What:** Register the helena-task worker in `src/worker.ts` following the exact pattern of all existing workers.
**When to use:** Added once during Phase 21 implementation.

```typescript
// In src/worker.ts -- addition following existing worker pattern

import { processHelenaTask, type HelenaTaskJobData } from "@/lib/queue/processors/helena-task.processor";

const helenaTaskWorker = new Worker<HelenaTaskJobData>(
  "helena-task",
  async (job) => processHelenaTask(job),
  {
    connection,
    concurrency: 2,         // Allow 2 concurrent agent runs
    lockDuration: 120_000,  // 2min lock -- LLM calls can take 30-120s per step
    settings: {
      backoffStrategy: (attemptsMade: number) => calculateBackoff(attemptsMade),
    },
  }
);

helenaTaskWorker.on("completed", (job) => {
  if (!job) return;
  log.info(
    { jobId: job.id, taskId: job.data.taskId },
    "Helena task job completed"
  );
});

helenaTaskWorker.on("failed", (job, err) => {
  if (!job) return;
  log.error(
    { jobId: job.id, taskId: job.data.taskId, err: err.message },
    "Helena task job failed"
  );
});

helenaTaskWorker.on("error", (err) => {
  log.error({ err }, "Helena task worker error");
});

workers.push(helenaTaskWorker);
log.info("[Worker] helena-task processor registered");
```

### Anti-Patterns to Avoid
- **Never set attempts > 1 for agent tasks:** Agent runs are not idempotent. Re-running could create duplicate drafts, send duplicate notifications, or produce inconsistent trace logs. Use `attempts: 1`.
- **Never use default lockDuration (30s) for agent tasks:** LLM calls routinely take 10-60s per step. BullMQ would mark the job as stalled after 30s and potentially re-queue it, causing duplicate agent runs. Use `lockDuration: 120_000`.
- **Never store AbortControllers in Redis:** AbortControllers are JavaScript objects that must live in the same process as the agent run. Use an in-process `Map<string, AbortController>`. This works because the worker is a single Node.js process.
- **Never enqueue without creating HelenaTask first:** The processor expects the task to exist in the database. Always create the Prisma record first, then enqueue the BullMQ job with the task ID.
- **Never emit progress without including taskId and akteId:** The frontend needs both to route the progress event to the correct UI component. The `taskId` identifies the task, `akteId` identifies the case context.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue with priority + progress | Custom Redis queue | BullMQ ^5.70.1 with `priority` option and `job.updateProgress()` | BullMQ handles lock renewal, retry, dead-letter, and priority sorting natively |
| Agent execution | Custom LLM loop in processor | `runHelenaAgent()` from Phase 20's `src/lib/helena/index.ts` | Complete agent engine with stall detection, token budget, Ollama guard, auto-escalation |
| Socket.IO emission from worker | Direct WebSocket management | `getSocketEmitter()` from `src/lib/socket/emitter.ts` | Redis-backed emitter pattern already works for all existing workers |
| RBAC access checking | Custom permission logic in task processor | `buildAkteAccessFilter()` from `src/lib/rbac.ts` (injected via `runHelenaAgent`) | Already handles all role combinations |
| Task status updates with audit | Custom status machine | Direct Prisma updates with `HelenaTaskStatus` enum | Prisma enforces valid status values via enum |

**Key insight:** Phase 21 is primarily a wiring phase. The agent engine (Phase 20) and data models (Phase 19) exist. The main work is connecting them through the BullMQ queue pattern already established by 14 existing workers.

## Common Pitfalls

### Pitfall 1: BullMQ Lock Expiry During Long LLM Calls
**What goes wrong:** A single LLM call to Ollama can take 30-120 seconds (especially qwen3.5:35b on large context). If `lockDuration` is less than this, BullMQ marks the job as stalled and re-queues it. The original job continues running, and now two agent runs execute in parallel for the same task.
**Why it happens:** BullMQ default lockDuration is 30s. Agent LLM calls routinely exceed this.
**How to avoid:**
1. Set `lockDuration: 120_000` (2 minutes) on the worker configuration
2. Call `job.updateProgress()` in every `onStepUpdate` callback -- this resets the lock timer
3. The `onStepUpdate` fires after every AI SDK step (every tool call + response), keeping the lock alive
**Warning signs:** Duplicate HelenaTask updates, duplicate draft creation, "stalled" jobs in Bull Board.

### Pitfall 2: Orphaned AbortControllers After Worker Restart
**What goes wrong:** Worker process restarts (deployment, crash). The in-memory `Map<string, AbortController>` is cleared. Any RUNNING tasks that were mid-execution cannot be aborted.
**Why it happens:** AbortControllers are in-process state that doesn't survive restart.
**How to avoid:**
1. On worker startup, find all HelenaTask records with status RUNNING
2. Update them to FAILED with fehler "Worker wurde neu gestartet" (or ABGEBROCHEN)
3. This is the same recovery pattern used by `recoverStuckNerJobs()` in the existing worker startup
**Warning signs:** Tasks stuck in RUNNING status indefinitely after a deployment.

### Pitfall 3: Race Condition Between Task Creation and Queue Job
**What goes wrong:** BullMQ job starts processing before the Prisma `helenaTask.create()` transaction commits. The processor tries to update a task that doesn't exist yet.
**Why it happens:** BullMQ uses Redis which is faster than PostgreSQL. The job can be picked up by the worker before the DB write completes.
**How to avoid:**
1. Always `await prisma.helenaTask.create()` first, THEN `await helenaTaskQueue.add()`
2. In the processor, add a retry/guard: if `helenaTask.findUnique()` returns null, throw an error (BullMQ will not retry since attempts=1, but the error is logged)
3. Alternative: use a small `delay` option on the BullMQ job (e.g., 500ms) to give Prisma time to commit
**Warning signs:** "Helena task not found" errors in worker logs.

### Pitfall 4: @Helena Mention in Rich Text / HTML
**What goes wrong:** If the note/comment field uses TipTap rich text editor, the `@Helena` text may be wrapped in HTML tags: `<span class="mention">@Helena</span> recherchiere...`. The regex `/@helena\s+(.+)/i` fails to match.
**Why it happens:** Rich text editors wrap mentions in markup.
**How to avoid:**
1. Parse the @Helena mention from the **plain text content** (strip HTML before regex)
2. Or, detect @Helena mentions at the editor component level (TipTap mention extension) and send a structured `helenaMention` field in the API request alongside the rich text
3. For Phase 21 MVP: detect from plain text (strip HTML with a simple regex or use the editor's getText() method). Phase 26 can add TipTap mention extension.
**Warning signs:** @Helena mentions in rich text fields not triggering tasks.

### Pitfall 5: Priority Inversion Between BullMQ and HelenaTask.prioritaet
**What goes wrong:** HelenaTask.prioritaet uses 1-10 where higher = more urgent. BullMQ uses priority where lower = higher priority. If the mapping is wrong, manual tasks execute after scanner tasks.
**Why it happens:** Opposite conventions between the domain model and the queue library.
**How to avoid:** Use explicit mapping: `bullmqPriority = Math.max(1, 10 - helenaTaskPrioritaet)`. Manual @-tag tasks: prioritaet=8 -> bullmq=2. Scanner tasks: prioritaet=3 -> bullmq=7. Document this mapping in a constant.
**Warning signs:** Scanner-generated tasks running before manually triggered ones.

### Pitfall 6: Socket.IO Events Not Reaching Disconnected Users
**What goes wrong:** User triggers @Helena task, navigates away or closes the tab. Progress events emit but no client receives them. When user returns, they see no progress history.
**Why it happens:** Socket.IO is fire-and-forget. Events emitted while client is disconnected are lost.
**How to avoid:**
1. Always persist progress in HelenaTask record (not just Socket.IO) -- write `steps[]` to DB on completion
2. The UI should fetch the task's current status via REST API when mounting, not rely solely on Socket.IO
3. Socket.IO events are a real-time enhancement, not the source of truth -- the HelenaTask record is the source of truth
**Warning signs:** Users seeing stale task status after reconnecting.

## Code Examples

### Complete @Helena Mention Detection in Note API
```typescript
// In a note creation API route (e.g., POST /api/akten/[id]/notizen)

import { parseHelenaMention } from "@/lib/helena/at-mention-parser";
import { createHelenaTask } from "@/lib/helena/task-service";

// After creating the note in DB:
const helenaInstruction = parseHelenaMention(noteText);
if (helenaInstruction) {
  await createHelenaTask({
    userId: session.user.id,
    userRole: session.user.role,
    userName: session.user.name ?? "Unknown",
    akteId,
    auftrag: helenaInstruction,
    prioritaet: 8,  // Manual @-tag: high priority
    quelle: "at-mention",
  });
}
```

### Task Abort API Route
```typescript
// src/app/api/helena/tasks/[id]/route.ts -- PATCH handler

import { abortTask } from "@/lib/queue/processors/helena-task.processor";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { action } = await req.json();

  if (action === "abort") {
    // 1. Update DB status
    await prisma.helenaTask.update({
      where: { id: params.id, userId: session.user.id },
      data: { status: "ABGEBROCHEN", completedAt: new Date() },
    });

    // 2. Signal the in-process abort controller
    const aborted = abortTask(params.id);

    return Response.json({
      success: true,
      abortedInProcess: aborted,  // false if task already completed or worker restarted
    });
  }

  return new Response("Unknown action", { status: 400 });
}
```

### Socket.IO Event Types for Task Progress
```typescript
// Event types for helena task progress

interface HelenaTaskStartedEvent {
  taskId: string;
  akteId: string;
  auftrag: string;
}

interface HelenaTaskProgressEvent {
  taskId: string;
  akteId: string;
  stepNumber: number;
  maxSteps: number;
  toolName: string | null;
  resultSummary: string;
}

interface HelenaTaskCompletedEvent {
  taskId: string;
  akteId: string;
  status: "DONE" | "ABGEBROCHEN";
  ergebnis: string;  // First 200 chars
}

interface HelenaTaskFailedEvent {
  taskId: string;
  akteId: string;
  error: string;
}

// Socket.IO event names:
// "helena:task-started"    -> HelenaTaskStartedEvent
// "helena:task-progress"   -> HelenaTaskProgressEvent
// "helena:task-completed"  -> HelenaTaskCompletedEvent
// "helena:task-failed"     -> HelenaTaskFailedEvent
```

### Worker Startup Recovery for Stuck Tasks
```typescript
// In src/worker.ts startup() function -- addition

// Recover any HelenaTask stuck in RUNNING from a previous crashed worker
try {
  const stuckTasks = await prisma.helenaTask.findMany({
    where: { status: "RUNNING" },
  });
  if (stuckTasks.length > 0) {
    log.info({ count: stuckTasks.length }, "Recovering stuck Helena tasks");
    await prisma.helenaTask.updateMany({
      where: { status: "RUNNING" },
      data: {
        status: "FAILED",
        fehler: "Worker wurde neu gestartet -- Task war noch in Bearbeitung",
        completedAt: new Date(),
      },
    });
  }
} catch (err) {
  log.warn({ err }, "Failed to recover stuck Helena tasks (non-fatal)");
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BullMQ v4 `Queue.add({ priority })` | BullMQ v5 `Queue.add(name, data, { priority })` | BullMQ 5.0 | v5 uses sorted sets for priority, more efficient. API signature unchanged for basic usage. |
| Manual lock extension via `job.extendLock()` | `job.updateProgress()` implicitly extends lock | BullMQ ~4.x | `updateProgress` is the idiomatic way to signal liveness and extend lock. |
| `lockDuration` on Worker constructor | `lockDuration` still on Worker constructor in v5 | Stable | No change -- set in Worker options, not Queue options. |

**Deprecated/outdated:**
- BullMQ v3's `stalledInterval` configuration -- in v5, configure `lockDuration` on the Worker instead.
- Bull (non-MQ) -- legacy library, fully replaced by BullMQ in this project.

## Open Questions

1. **Concurrency Limit for Helena Tasks**
   - What we know: The worker currently runs all LLM-related jobs at concurrency 1 (ai-scan, ai-proactive, ai-briefing) to avoid GPU contention on Ollama.
   - What's unclear: Should helena-task also be concurrency 1 to avoid Ollama contention, or can we allow concurrency 2 since users expect faster response times for manual tasks?
   - Recommendation: Start with concurrency 2. If Ollama becomes a bottleneck (timeouts, OOM), reduce to 1. The lockDuration of 120s provides buffer for queuing.

2. **Where Exactly to Detect @Helena Mentions**
   - What we know: Phase description says "Notiz/Kommentar-Felder". The codebase has `Akte.notizen` (string field), `Beteiligter.notizen`, `KycEintrag.notizen`, and AktenActivity (the activity feed model).
   - What's unclear: Which specific fields/endpoints should detect @Helena? All of them, or only a new dedicated "Akte notes" endpoint?
   - Recommendation: For Phase 21, implement detection in a new `POST /api/akten/[id]/notizen` API route that creates an AktenActivity with typ NOTIZ. This is the "composer in the feed" endpoint that Phase 26 (UI) will consume. Also detect in the existing `POST /api/ki-chat` route as a secondary trigger. Do not add detection to all `notizen` string fields -- those are simple text fields not intended for interactive commands.

3. **HelenaMemory Loading for @Helena Tasks**
   - What we know: `runHelenaAgent()` accepts `helenaMemory` option. Phase 25 is Helena Memory.
   - What's unclear: Should Phase 21 load HelenaMemory when executing tasks, or defer to Phase 25?
   - Recommendation: Phase 21 should load the HelenaMemory if it exists (simple findUnique query), since the Prisma model already exists from Phase 19. This gives immediate benefit even before Phase 25 implements auto-refresh. If no memory exists, pass null.

## Validation Architecture

> Skipped per config.json -- workflow.nyquist_validation is not enabled.

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/worker.ts` -- 14 existing BullMQ workers with consistent registration pattern, Socket.IO emitter usage, graceful shutdown, and startup recovery
- Project codebase: `src/lib/queue/queues.ts` -- Queue creation pattern with connection, defaultJobOptions, and cron job registration
- Project codebase: `src/lib/queue/connection.ts` -- `getWorkerConnection()` with `maxRetriesPerRequest: null` for BullMQ workers
- Project codebase: `src/lib/helena/index.ts` -- `runHelenaAgent()` public API with `onStepUpdate`, `abortSignal`, mode selection
- Project codebase: `src/lib/helena/orchestrator.ts` -- `runAgent()` with `AgentStep[]` trace capture, abort handling, step callbacks
- Project codebase: `prisma/schema.prisma` -- HelenaTask model with HelenaTaskStatus enum (PENDING, RUNNING, DONE, FAILED, WAITING_APPROVAL, ABGEBROCHEN), steps Json, prioritaet Int
- Project codebase: `src/lib/socket/emitter.ts` -- `getSocketEmitter()` singleton for worker-to-browser events
- BullMQ v5.70.1 -- `package.json` confirms version; Worker lockDuration, job.updateProgress(), priority support verified in project usage

### Secondary (MEDIUM confidence)
- BullMQ documentation on lockDuration: "The lock duration for each job determines the time the job will remain locked. If the lock expires, the job will be moved back to the waiting state" -- confirmed by existing `embedding.processor.ts` using `job.updateProgress()` for progress tracking
- Socket.IO Redis emitter pattern: confirmed working in production via OCR/embedding/email workers that already emit events from worker process to browser clients

### Tertiary (LOW confidence)
- None -- all findings verified from existing codebase patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new packages needed, all libraries already installed and used extensively
- Architecture: HIGH -- all patterns derived from existing codebase (14 existing workers, queue infrastructure, Socket.IO emitter)
- Pitfalls: HIGH -- lockDuration issue documented in project decisions (STATE.md: "lockDuration:120000 on helena-agent queue"), other pitfalls from production experience with existing workers
- Integration: HIGH -- Phase 20 agent engine is complete and tested, Phase 19 models migrated

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable -- all infrastructure patterns are production-proven in this codebase)
