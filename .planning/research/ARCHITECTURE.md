# Architecture Research

**Domain:** Helena Agent v2 — Autonomous agent capabilities integrated into AI-Lawyer (existing Next.js/Prisma/BullMQ/Vercel AI SDK v4 stack)
**Researched:** 2026-02-27
**Confidence:** HIGH (codebase directly inspected; agent patterns verified against Vercel AI SDK v4 docs and existing BullMQ conventions in worker.ts)

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          USER-FACING LAYER                                    │
│                                                                               │
│  /ki-chat page (existing)          /akten/[id] (existing)                    │
│  ┌───────────────────────┐         ┌────────────────────┐                    │
│  │  Chat tab (existing)  │         │  Akte Detail Tabs  │                    │
│  │  Vorschlaege tab      │         │  + Activity Feed   │  ← NEW tab         │
│  │  (existing)           │         │    (HelenaTask,     │                   │
│  └───────────────────────┘         │     HelenaDraft,    │                   │
│                                    │     HelenaAlert)    │                   │
│  /ki-chat?tab=tasks (NEW)          └────────────────────┘                   │
│  ┌───────────────────────┐                                                   │
│  │  Task Dashboard tab   │                                                   │
│  │  (HelenaTask list)    │                                                   │
│  └───────────────────────┘                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                        STREAMING CHAT LAYER (existing)                        │
│                                                                               │
│  POST /api/ki-chat/route.ts                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐         │
│  │  Chain A: Akte context   Chain D: law_chunks                    │         │
│  │  Chain B: hybridSearch   Chain E: urteil_chunks                 │         │
│  │  Chain C: model config   Chain F: muster_chunks                 │         │
│  │                                                                 │         │
│  │  streamText() with tools + stopWhen  ← MODIFIED for Agent v2   │         │
│  │  └── tools: { searchAkte, searchLaw, createTask, createAlert }  │         │
│  └─────────────────────────────────────────────────────────────────┘         │
│                          ↓ (onFinish)                                         │
│                  Task / Draft / Alert creation                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                        ORCHESTRATOR LAYER (NEW)                               │
│                                                                               │
│  src/lib/ai/orchestrator.ts                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐         │
│  │  HelenaOrchestrator                                             │         │
│  │  - executeTask(helenaTaskId)  → ReAct loop                      │         │
│  │  - planSteps(task)            → step list                        │         │
│  │  - runStep(step, context)     → tool call + result              │         │
│  │  - handleStepResult(result)   → update HelenaTask.steps JSON    │         │
│  └────────────────┬────────────────────────────────────────────────┘         │
│                   │ (called by)                                               │
│  BullMQ Worker: "helena-task" queue                                           │
│  ┌─────────────────────────────────────────────────────────────────┐         │
│  │  src/lib/queue/processors/helena-task.processor.ts              │         │
│  │  - Picks up HelenaTask jobs from Redis                          │         │
│  │  - Calls orchestrator.executeTask(taskId)                       │         │
│  │  - Emits Socket.IO progress events                              │         │
│  └─────────────────────────────────────────────────────────────────┘         │
│                                                                               │
│  BullMQ Cron: "helena-scanner" queue                                          │
│  ┌─────────────────────────────────────────────────────────────────┐         │
│  │  src/lib/queue/processors/helena-scanner.processor.ts (MODIFY)  │         │
│  │  Currently: proactive-processor.ts scans for stale Akten        │         │
│  │  New: also scans for Frist deadlines approaching + creates      │         │
│  │       HelenaAlert records + enqueues helena-task jobs           │         │
│  └─────────────────────────────────────────────────────────────────┘         │
├──────────────────────────────────────────────────────────────────────────────┤
│                           DATA LAYER                                           │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ PostgreSQL 16  │  │    Redis 7     │  │   MinIO S3   │  │  Meilisearch│  │
│  │                │  │                │  │              │  │             │  │
│  │ HelenaTask NEW │  │ helena-task Q  │  │ draft        │  │ tasks idx   │  │
│  │ HelenaDraft NEW│  │ helena-scanner │  │ attachments  │  │ (optional)  │  │
│  │ HelenaAlert NEW│  │ BullMQ Q       │  │ (MinIO)      │  │             │  │
│  │ HelenaSugg     │  │                │  │              │  │             │  │
│  │ (existing)     │  │                │  │              │  │             │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  └─────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status | File Location |
|-----------|---------------|--------|---------------|
| `POST /api/ki-chat/route.ts` | Streaming chat with optional tool-calling (ReAct in chat mode) | MODIFY | `src/app/api/ki-chat/route.ts` |
| `HelenaOrchestrator` | Multi-step ReAct loop for background tasks | NEW | `src/lib/ai/orchestrator.ts` |
| `helena-task.processor.ts` | BullMQ processor: picks up HelenaTask jobs, runs orchestrator | NEW | `src/lib/queue/processors/helena-task.processor.ts` |
| `helena-scanner.processor.ts` | BullMQ cron: replaces/extends proactive-processor.ts | MODIFY | `src/lib/queue/processors/proactive-processor.ts` |
| `helenaTaskQueue` | BullMQ queue for autonomous task execution | NEW | `src/lib/queue/queues.ts` (add export) |
| `HelenaTask` | Prisma model: tracks multi-step agent tasks with step log | NEW | `prisma/schema.prisma` |
| `HelenaDraft` | Prisma model: structured AI draft output (richer than HelenaSuggestion) | NEW | `prisma/schema.prisma` |
| `HelenaAlert` | Prisma model: time-critical proactive alerts | NEW | `prisma/schema.prisma` |
| `ActivityFeed` component | UI: per-Akte or global feed of HelenaTask + Alert + Draft | NEW | `src/components/ki/activity-feed.tsx` |
| `TaskDashboard` component | UI: list of all HelenaTask for current user | NEW | `src/components/ki/task-dashboard.tsx` |
| `HelenaSuggestion` | Existing proactive suggestions model | UNCHANGED | `prisma/schema.prisma` |

---

## Recommended Project Structure

Changes are additive. Existing files noted with MODIFY; new files with NEW.

```
src/
├── lib/
│   ├── ai/
│   │   ├── orchestrator.ts          # NEW: HelenaOrchestrator (ReAct loop)
│   │   ├── agent-tools.ts           # NEW: tool definitions for streamText + orchestrator
│   │   ├── proactive-processor.ts   # MODIFY: extend scanner to create HelenaAlert
│   │   ├── scan-processor.ts        # UNCHANGED: doc/email scanning
│   │   ├── briefing-processor.ts    # UNCHANGED: morning briefing
│   │   └── ...                      # All other ai/ files UNCHANGED
│   └── queue/
│       ├── queues.ts                # MODIFY: add helenaTaskQueue export
│       └── processors/
│           ├── helena-task.processor.ts  # NEW: orchestrator entry point
│           └── ...                       # All others UNCHANGED
├── app/
│   ├── api/
│   │   ├── ki-chat/
│   │   │   └── route.ts             # MODIFY: add tools to streamText call
│   │   ├── helena/
│   │   │   ├── tasks/
│   │   │   │   └── route.ts         # NEW: GET/POST HelenaTask
│   │   │   ├── tasks/[id]/
│   │   │   │   └── route.ts         # NEW: GET/PATCH single task (cancel, retry)
│   │   │   ├── drafts/
│   │   │   │   └── route.ts         # NEW: GET HelenaDraft list
│   │   │   └── alerts/
│   │   │       └── route.ts         # NEW: GET HelenaAlert, PATCH dismiss
│   │   └── ...
│   └── (dashboard)/
│       ├── ki-chat/
│       │   ├── helena-tab.tsx        # MODIFY: add Tasks tab
│       │   └── page.tsx             # UNCHANGED
│       └── akten/[id]/
│           └── (tabs)/
│               └── activity/        # NEW: Activity Feed tab
│                   └── page.tsx
└── components/
    └── ki/
        ├── activity-feed.tsx         # NEW: real-time task/alert/draft feed
        ├── task-dashboard.tsx        # NEW: paginated HelenaTask list
        ├── task-card.tsx             # NEW: single HelenaTask with step log
        ├── alert-card.tsx            # NEW: HelenaAlert with dismiss action
        ├── draft-card.tsx            # NEW: HelenaDraft with approve/reject
        └── ...                      # Existing components UNCHANGED
```

### Structure Rationale

- **`src/lib/ai/orchestrator.ts` separate from ki-chat route:** The ReAct agent loop for background tasks runs in the BullMQ worker process (not the Next.js app). Placing it in `src/lib/ai/` makes it importable by both the ki-chat route (for inline agent steps in streaming) and the worker process (for background task execution). Avoids duplication.
- **`agent-tools.ts` shared definition file:** Both the ki-chat streaming route and the orchestrator use the same tool schemas. A single source of truth prevents drift between what the LLM can do in chat vs. background. Tools are defined once with `tool()` from the AI SDK, then passed to both `streamText()` and `generateText()`.
- **`helenaTaskQueue` added to existing `queues.ts`:** Follows the existing pattern (aiScanQueue, aiBriefingQueue, aiProactiveQueue are all in queues.ts). One file = one place to see all queues.
- **Activity Feed as Akte tab:** Matches existing pattern (Dokumente, E-Mails, Termine are tabs). Keeps per-Akte context localized. Global feed on `/ki-chat?tab=tasks` for cross-Akte view.

---

## Architectural Patterns

### Pattern 1: Two Agent Modes — Inline (Chat) vs. Background (Task)

**What:** Helena Agent v2 operates in two distinct modes. In **inline mode**, the ki-chat route uses `streamText()` with tools and `stopWhen: stepCountIs(5)` — the user waits for the result. In **background mode**, the user (or cron) triggers a `HelenaTask`, which is enqueued to BullMQ and executed by the orchestrator using `generateText()` with a longer step budget.

**When to use:** Inline mode for interactive requests ("Helena, suche den Streitwert in diesen Dokumenten"). Background mode for multi-document drafting, lengthy research chains, or scanner-triggered autonomous work.

**Trade-offs:** Inline mode has a hard ~30s limit before streaming response must start. Background mode is unlimited but the user gets no immediate feedback — they check the Activity Feed later. The split avoids infrastructure pressure: inline reuses the HTTP request lifecycle; background reuses the existing BullMQ worker process.

**Example — inline mode (ki-chat route modification):**
```typescript
// src/app/api/ki-chat/route.ts
import { searchAkteDocumentsTool, createHelenaTaskTool, createHelenaAlertTool } from "@/lib/ai/agent-tools";

const result = streamText({
  model,
  system: systemPrompt,
  messages,
  // Agent v2: allow up to 5 tool-call steps before streaming final answer
  tools: {
    searchAkteDokumente: searchAkteDocumentsTool(akteId, userId),
    createTask: createHelenaTaskTool(userId, akteId),
    createAlert: createHelenaAlertTool(userId, akteId),
  },
  stopWhen: stepCountIs(5),
  onStepFinish({ stepNumber, toolCalls, toolResults }) {
    // Emit Socket.IO event so UI can show "Helena ist dabei..."
    socketEmitter.to(`user:${userId}`).emit("helena:step", { stepNumber, toolCalls });
  },
  onFinish: async ({ text, usage, steps }) => {
    // Existing token tracking + conversation save — UNCHANGED
    // NEW: if any tool created a HelenaTask, emit activity:new event
  },
});
```

**Example — background mode (orchestrator):**
```typescript
// src/lib/ai/orchestrator.ts
export async function executeTask(helenaTaskId: string): Promise<void> {
  const task = await prisma.helenaTask.findUniqueOrThrow({ where: { id: helenaTaskId } });

  // Update status to RUNNING
  await prisma.helenaTask.update({ where: { id: helenaTaskId }, data: { status: "RUNNING" } });

  const result = await generateText({
    model: await getModel(),
    system: buildOrchestratorSystemPrompt(task),
    messages: buildInitialMessages(task),
    tools: {
      searchAkteDokumente: searchAkteDocumentsTool(task.akteId, task.userId),
      searchLaw: searchLawTool(),
      draftSchriftsatz: draftSchriftsatzTool(task.akteId, task.userId),
      createAlert: createHelenaAlertTool(task.userId, task.akteId),
    },
    stopWhen: stepCountIs(20), // Background tasks can run longer
    onStepFinish: async ({ stepNumber, toolCalls, toolResults }) => {
      // Persist each step to HelenaTask.steps JSON for audit trail
      await appendTaskStep(helenaTaskId, { stepNumber, toolCalls, toolResults });
      // Real-time update via Socket.IO
      socketEmitter.to(`user:${task.userId}`).emit("helena:task-progress", { taskId: helenaTaskId, stepNumber });
    },
  });

  // Save final result as HelenaDraft
  if (result.text) {
    await prisma.helenaDraft.create({
      data: { taskId: helenaTaskId, userId: task.userId, akteId: task.akteId, inhalt: result.text, status: "NEU" },
    });
  }

  await prisma.helenaTask.update({ where: { id: helenaTaskId }, data: { status: "ABGESCHLOSSEN" } });
}
```

---

### Pattern 2: HelenaTask as the Central Audit Record

**What:** Every autonomous action Helena takes is anchored to a `HelenaTask` row. This is the observable unit for the Activity Feed. A task has a `status` machine (AUSSTEHEND → RUNNING → ABGESCHLOSSEN | FEHLGESCHLAGEN | ABGEBROCHEN) and a `steps` JSON column that stores the full step log (each ReAct loop iteration with tool calls and results).

**When to use:** Any time Helena does more than one LLM call to accomplish something. Even if triggered from inline chat mode, if the user accepts a tool's suggestion to "run a background research task," a HelenaTask is created.

**Trade-offs:** Adds a DB write per step during background execution (inside `onStepFinish`). At kanzlei scale (<100 tasks/day), this is negligible. The JSON `steps` column avoids a separate join table and keeps the schema additive.

**New Prisma models:**
```prisma
// helena_tasks — tracks multi-step agent jobs
model HelenaTask {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  akteId      String?
  akte        Akte?     @relation(fields: [akteId], references: [id])
  typ         String    // RESEARCH | ENTWURF | SCAN | ANALYSE
  titel       String
  beschreibung String?  @db.Text
  status      String    @default("AUSSTEHEND") // AUSSTEHEND | RUNNING | ABGESCHLOSSEN | FEHLGESCHLAGEN | ABGEBROCHEN
  steps       Json?     // Array of { stepNumber, toolCalls, toolResults, timestamp }
  triggerTyp  String    @default("USER")  // USER | SCANNER | CHAT
  bulletMqJobId String?  // for cancel/retry via BullMQ API
  errorMsg    String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  drafts      HelenaDraft[]

  @@index([userId, status, createdAt])
  @@index([akteId, status])
  @@map("helena_tasks")
}

// helena_drafts — structured output from agent tasks (richer than HelenaSuggestion)
model HelenaDraft {
  id          String    @id @default(cuid())
  taskId      String?
  task        HelenaTask? @relation(fields: [taskId], references: [id], onDelete: SetNull)
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  akteId      String?
  akte        Akte?     @relation(fields: [akteId], references: [id])
  typ         String    // SCHRIFTSATZ | EMAIL | ZUSAMMENFASSUNG | RECHERCHE | MEMO
  titel       String
  inhalt      String    @db.Text
  quellen     Json?     // [{dokumentId, name, passage}] or [{gesetzKuerzel, paragraphNr}]
  status      String    @default("NEU")  // NEU | UEBERNOMMEN | ABGELEHNT
  feedback    String?   // POSITIV | NEGATIV
  linkedId    String?   // ID of created entity when accepted
  createdAt   DateTime  @default(now())
  readAt      DateTime?

  @@index([userId, status, createdAt])
  @@index([akteId, typ, createdAt])
  @@map("helena_drafts")
}

// helena_alerts — time-critical proactive notifications (distinct from suggestions)
model HelenaAlert {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  akteId      String?
  akte        Akte?     @relation(fields: [akteId], references: [id])
  schwere     String    @default("INFO")  // INFO | WARNUNG | KRITISCH
  titel       String
  inhalt      String    @db.Text
  fristDatum  DateTime?  // If alert is about a deadline
  dismissed   Boolean   @default(false)
  dismissedAt DateTime?
  createdAt   DateTime  @default(now())

  @@index([userId, dismissed, createdAt])
  @@index([akteId, schwere])
  @@map("helena_alerts")
}
```

**Relationship to existing HelenaSuggestion:** HelenaSuggestion handles reactive scan results (single LLM call, one extracted item). HelenaDraft handles the *output* of multi-step agent tasks. HelenaSuggestion is NOT replaced — it still receives deadline/party extraction results from the ai-scan processor.

---

### Pattern 3: Background Scanner as Cron Job That Creates Tasks and Alerts

**What:** The existing `proactive-processor.ts` (registered as `ai-proactive` BullMQ worker) scans for stale cases and missing Fristen. It is extended — not replaced — to also:
1. Detect approaching Fristen (<7 days) and create `HelenaAlert` records with `schwere: KRITISCH`.
2. Detect cases that need a Schriftsatz-Entwurf (based on upcoming deadline type) and enqueue a `HelenaTask` of type `ENTWURF`.
3. Detect unanswered e-mails >48h and create `HelenaAlert`.

**When to use:** The scanner runs on the existing `ai-proactive` cron schedule (configured in Settings). No new cron queue is needed — it reuses the same BullMQ Worker.

**Trade-offs:** Extending `proactive-processor.ts` keeps the cron footprint to one job. The risk is the file grows large. Mitigate by extracting sub-checks into separate helper functions inside `src/lib/ai/proactive-helpers.ts` and importing them.

**Integration point (proactive-processor.ts modification):**
```typescript
// src/lib/ai/proactive-processor.ts — new checks added below existing ones

// Check for approaching Fristen (< 7 days, not already alerted this week)
const urgentFristen = await prisma.kalenderEintrag.findMany({
  where: {
    typ: "FRIST",
    erledigt: false,
    datum: { gte: now, lte: sevenDaysFromNow },
    akteId: { in: akten.map(a => a.id) },
  },
});

for (const frist of urgentFristen) {
  const alreadyAlerted = await prisma.helenaAlert.findFirst({
    where: { akteId: frist.akteId, fristDatum: frist.datum, dismissed: false },
  });
  if (!alreadyAlerted) {
    await prisma.helenaAlert.create({
      data: {
        userId: frist.verantwortlichId ?? targetUserId,
        akteId: frist.akteId,
        schwere: "KRITISCH",
        titel: `Frist in ${daysUntil(frist.datum)} Tagen: ${frist.titel}`,
        inhalt: `Die Frist "${frist.titel}" läuft am ${formatDate(frist.datum)} ab.`,
        fristDatum: frist.datum,
      },
    });
    // Optionally enqueue HelenaTask for draft
    await helenaTaskQueue.add("prepare-entwurf", {
      akteId: frist.akteId,
      userId: frist.verantwortlichId,
      typ: "ENTWURF",
      titel: `Entwurf für Frist: ${frist.titel}`,
      triggerTyp: "SCANNER",
    });
  }
}
```

---

### Pattern 4: Tool Definitions as Shared Library

**What:** Both the inline streaming chat (`streamText`) and the background orchestrator (`generateText`) need the same tool set. Tools are defined in `src/lib/ai/agent-tools.ts` as factory functions that accept runtime context (userId, akteId) and return AI SDK `tool()` objects.

**When to use:** Every time Helena needs to take an action that is not pure text generation. Tools include: `searchAkteDokumente`, `searchLaw`, `searchUrteile`, `createHelenaTask`, `createHelenaAlert`, `draftSchriftsatz`, `queryAkte`.

**Trade-offs:** Factory functions instead of static tool objects allow runtime context injection (userId, akteId) without global state. The overhead is negligible — tool definitions are lightweight objects.

**Key tool definitions:**
```typescript
// src/lib/ai/agent-tools.ts
import { tool } from "ai";
import { z } from "zod";

export function createHelenaTaskTool(userId: string, akteId: string | null) {
  return tool({
    description: "Erstelle einen Hintergrund-Task für Helena (z.B. Schriftsatz-Entwurf, Recherche).",
    inputSchema: z.object({
      typ: z.enum(["RESEARCH", "ENTWURF", "ANALYSE"]),
      titel: z.string().max(200),
      beschreibung: z.string().optional(),
    }),
    execute: async ({ typ, titel, beschreibung }) => {
      const task = await prisma.helenaTask.create({
        data: { userId, akteId, typ, titel, beschreibung, status: "AUSSTEHEND", triggerTyp: "CHAT" },
      });
      const job = await helenaTaskQueue.add("execute-task", { taskId: task.id });
      await prisma.helenaTask.update({ where: { id: task.id }, data: { bulletMqJobId: job.id } });
      return { taskId: task.id, status: "AUSSTEHEND", message: `Task "${titel}" erstellt und eingeplant.` };
    },
  });
}

export function createHelenaAlertTool(userId: string, akteId: string | null) {
  return tool({
    description: "Erstelle einen dringenden Alert für den Anwalt.",
    inputSchema: z.object({
      schwere: z.enum(["INFO", "WARNUNG", "KRITISCH"]),
      titel: z.string().max(200),
      inhalt: z.string(),
      fristDatum: z.string().optional(), // ISO date string
    }),
    execute: async ({ schwere, titel, inhalt, fristDatum }) => {
      await prisma.helenaAlert.create({
        data: {
          userId, akteId, schwere, titel, inhalt,
          fristDatum: fristDatum ? new Date(fristDatum) : null,
        },
      });
      // Emit real-time Socket.IO event
      socketEmitter.to(`user:${userId}`).emit("helena:alert", { schwere, titel });
      return { created: true };
    },
  });
}
```

---

### Pattern 5: Activity Feed via Existing Socket.IO Infrastructure

**What:** The Activity Feed UI component polls the REST API initially, then subscribes to Socket.IO room `user:{userId}` for real-time updates. New HelenaTask, HelenaDraft, and HelenaAlert records emit Socket.IO events from the worker process. The existing `socketEmitter` singleton is already used by embedding, OCR, and email workers — no new infrastructure needed.

**When to use:** For all Activity Feed real-time updates: task status changes, draft ready, new alert.

**Event contract:**
```typescript
// Events emitted by helena-task.processor.ts and proactive-processor.ts
socketEmitter.to(`user:${userId}`).emit("helena:task-progress", {
  taskId: string, stepNumber: number, status: string
});
socketEmitter.to(`user:${userId}`).emit("helena:draft-ready", {
  draftId: string, titel: string, typ: string, akteId: string | null
});
socketEmitter.to(`user:${userId}`).emit("helena:alert", {
  alertId: string, schwere: "INFO" | "WARNUNG" | "KRITISCH", titel: string, fristDatum: string | null
});
socketEmitter.to(`akte:${akteId}`).emit("helena:activity", {
  type: "task" | "draft" | "alert", id: string, titel: string
});
```

**Client-side pattern (Activity Feed component):**
```typescript
// src/components/ki/activity-feed.tsx
"use client";
import { useEffect, useState } from "react";
import { socket } from "@/lib/socket/client"; // existing socket client

export function ActivityFeed({ akteId }: { akteId?: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // Initial load via REST
    fetch(`/api/helena/activity?akteId=${akteId ?? ""}&limit=20`)
      .then(r => r.json())
      .then(data => setItems(data.items));

    // Real-time updates
    const onActivity = (item: ActivityItem) => {
      setItems(prev => [item, ...prev].slice(0, 50));
    };
    socket.on("helena:activity", onActivity);
    socket.on("helena:alert", onActivity);
    socket.on("helena:draft-ready", onActivity);
    return () => {
      socket.off("helena:activity", onActivity);
      socket.off("helena:alert", onActivity);
      socket.off("helena:draft-ready", onActivity);
    };
  }, [akteId]);

  // Renders Task/Draft/Alert cards based on item type
}
```

---

## New Prisma Models vs. Existing Models

### What Changes in Existing Models

| Model | Change |
|-------|--------|
| `HelenaSuggestion` | UNCHANGED. Still used for scan-triggered single-call extractions (deadlines, parties, email drafts). |
| `Akte` | Add relations: `helenaTasks HelenaTask[]`, `helenaAlerts HelenaAlert[]`, `helenaDrafts HelenaDraft[]` |
| `User` | Add relations: `helenaTasks HelenaTask[]`, `helenaAlerts HelenaAlert[]`, `helenaDrafts HelenaDraft[]` |
| `AiConversation` | UNCHANGED. Chat history storage is unaffected. |

### What Is New

| Model | Purpose | Trigger |
|-------|---------|---------|
| `HelenaTask` | Multi-step agent job with audit trail | User chat tool call OR scanner cron |
| `HelenaDraft` | Structured output from completed task | Orchestrator `onFinish` |
| `HelenaAlert` | Time-critical proactive alert (distinct UX from suggestions) | Scanner cron OR inline chat tool |

### HelenaSuggestion vs. HelenaDraft — why both

HelenaSuggestion is created from a single `generateText` call that scans a document and extracts structured data (e.g., a deadline date, a list of party names). It is a lightweight, high-frequency record.

HelenaDraft is the output of a multi-step ReAct loop that may take 1-5 minutes to produce (e.g., a full Schriftsatz draft with research chains). It references a HelenaTask and carries richer source attribution. Merging them would require either polluting HelenaSuggestion with task-tracking fields or making HelenaDraft heavyweight for simple scan results. Keeping them separate maintains single responsibility.

---

## Data Flow

### Flow 1: User-Triggered Background Research Task

```
User in Chat: "Erstelle einen Entwurf für die Berufungserwiderung"
  ↓
POST /api/ki-chat (existing route, MODIFIED)
  streamText() with tools
    LLM decides: call createHelenaTaskTool({ typ: "ENTWURF", titel: "Berufungserwiderung" })
    Tool execute():
      prisma.helenaTask.create({ status: "AUSSTEHEND" })
      helenaTaskQueue.add("execute-task", { taskId })
      Returns: { taskId, status: "AUSSTEHEND" }
    LLM continues: streams "Ich habe einen Task erstellt. Du findest den Entwurf im Aktivitäts-Feed."
  ↓ (BullMQ picks up job in worker process)
helena-task.processor.ts
  orchestrator.executeTask(taskId)
    generateText() with full tool set, stopWhen: stepCountIs(20)
      Step 1: searchAkteDokumente() → finds relevant docs
      Step 2: searchLaw("Berufung ZPO") → finds §§ 511-522 ZPO
      Step 3: draftSchriftsatz(context) → produces draft text
    onStepFinish: appendTaskStep(taskId, step) + socketEmitter.emit("helena:task-progress")
    onFinish:
      prisma.helenaDraft.create({ inhalt: result.text, status: "NEU" })
      socketEmitter.to(`user:${userId}`).emit("helena:draft-ready", { draftId, titel })
      prisma.helenaTask.update({ status: "ABGESCHLOSSEN" })
  ↓
Activity Feed (client)
  Socket event "helena:draft-ready" received
  New HelenaDraft card appears in feed
  User clicks "Übernehmen" → HelenaDraft.status = "UEBERNOMMEN"
                           → Creates Dokument or KiEntwurf record
```

### Flow 2: Scanner-Triggered Alert and Auto-Task

```
BullMQ cron: ai-proactive (daily, existing schedule)
  proactive-processor.ts (MODIFIED)
    Scans active Akten (existing logic — UNCHANGED)
    NEW: queries kalenderEintrag WHERE datum BETWEEN now AND +7 days AND typ = FRIST
      For each urgent Frist without existing alert:
        prisma.helenaAlert.create({ schwere: "KRITISCH", fristDatum })
        socketEmitter.to(`user:${userId}`).emit("helena:alert", { schwere: "KRITISCH" })
        IF frist.typ in ["BERUFUNG", "REVISIONSFRIST"]:
          helenaTaskQueue.add("execute-task", { typ: "ENTWURF", triggerTyp: "SCANNER" })
  ↓
Activity Feed (client)
  "helena:alert" event received
  HelenaAlert card with RED border appears in feed
  HelenaTask card with AUSSTEHEND badge appears
```

### Flow 3: Inline Chat Tool Call (Lightweight)

```
User in Chat: "Was sind die offenen Fristen in dieser Akte?"
  ↓
POST /api/ki-chat
  streamText() with tools
    LLM decides: call queryAkte({ scope: "fristen" })  ← existing Chain A is reused
    Tool execute(): queries KalenderEintrag, returns list
    LLM continues streaming: "Die folgenden Fristen sind offen: ..."
  ↓ (no BullMQ job — tool result fed back to LLM in same HTTP request)
Response streams to client
```

---

## Integration Points

### New vs. Modified Components Summary

**MODIFIED (minimal targeted changes to existing files):**

| File | Change |
|------|--------|
| `src/app/api/ki-chat/route.ts` | Add `tools`, `stopWhen: stepCountIs(5)`, and `onStepFinish` to `streamText()` call. Import tool factories from `agent-tools.ts`. No logic removed. |
| `src/lib/ai/proactive-processor.ts` | Add Frist-alert scanning logic below existing stale-case checks. Import `helenaTaskQueue` and `prisma.helenaAlert.create`. ~+80 lines. |
| `src/lib/queue/queues.ts` | Add `helenaTaskQueue` export. Add `registerHelenaTaskQueue()` cron registration (for retry scheduling). ~+15 lines. |
| `src/worker.ts` | Register `helena-task.processor.ts` as a new BullMQ worker (`helena-task` queue). Follow existing pattern for aiScanWorker registration. ~+30 lines. |
| `prisma/schema.prisma` | Add 3 new models. Add 3 new relations to `Akte` and `User`. Run `prisma migrate dev`. |

**NEW (created from scratch):**

| File | Purpose |
|------|---------|
| `src/lib/ai/orchestrator.ts` | HelenaOrchestrator class: `executeTask()`, `buildOrchestratorSystemPrompt()`, `appendTaskStep()` |
| `src/lib/ai/agent-tools.ts` | Tool factory functions for all Helena tools (shared by chat route and orchestrator) |
| `src/lib/queue/processors/helena-task.processor.ts` | BullMQ processor: validates task, calls orchestrator, handles errors |
| `src/app/api/helena/tasks/route.ts` | GET (list, paginated) + POST (create task manually) |
| `src/app/api/helena/tasks/[id]/route.ts` | GET (single task + steps) + PATCH (cancel, retry) |
| `src/app/api/helena/drafts/route.ts` | GET (list) + PATCH (accept/reject) |
| `src/app/api/helena/alerts/route.ts` | GET (list, filtered by akteId/dismissed) + PATCH (dismiss) |
| `src/app/api/helena/activity/route.ts` | GET unified feed: tasks + drafts + alerts merged, sorted by createdAt |
| `src/components/ki/activity-feed.tsx` | Feed component: real-time via Socket.IO, initial load via REST |
| `src/components/ki/task-card.tsx` | Single HelenaTask card with step log accordion, cancel button |
| `src/components/ki/draft-card.tsx` | HelenaDraft card: preview + accept/reject buttons |
| `src/components/ki/alert-card.tsx` | HelenaAlert card: severity badge + dismiss |
| `src/components/ki/task-dashboard.tsx` | Global task list for `/ki-chat?tab=tasks` |
| `src/app/(dashboard)/akten/[id]/(tabs)/activity/page.tsx` | Akte-scoped Activity Feed tab |

### Internal Module Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `ki-chat route` → `agent-tools.ts` | Import + tool factory call | Tools are constructed per-request with userId/akteId injected |
| `orchestrator.ts` → `agent-tools.ts` | Import + tool factory call | Same tools, same factories, different context (background vs. interactive) |
| `helena-task.processor.ts` → `orchestrator.ts` | Direct function call | Processor is thin wrapper: validates job data, calls `executeTask()`, handles BullMQ retry |
| `proactive-processor.ts` → `helenaTaskQueue` | `Queue.add()` | Scanner enqueues tasks; processor executes them asynchronously |
| `orchestrator.ts` → `socketEmitter` | Import singleton | Emitter is already used in existing worker context (embedding, OCR workers) |
| `activity-feed.tsx` → REST + Socket.IO | REST for initial load, Socket.IO for updates | Follows same pattern as existing real-time document pipeline notifications |

### External Service Integrations

No new external services. Helena Agent v2 reuses:
- Ollama/OpenAI/Anthropic via existing `getModel()` factory
- Redis/BullMQ via existing `getQueueConnection()`
- Socket.IO via existing `socketEmitter` singleton
- PostgreSQL via existing `prisma` client

---

## Build Order

Rationale: database schema must exist before any API routes or workers. Shared tool library before both ki-chat route and orchestrator changes. Orchestrator and worker before Activity Feed (UI needs data to display). Scanner changes last (can be toggled off without breaking anything).

```
Step 1 — Prisma Schema (enables everything, no risk to existing data)
  1a. Add HelenaTask, HelenaDraft, HelenaAlert models to prisma/schema.prisma
  1b. Add relation arrays to Akte and User models
  1c. prisma migrate dev (additive — no existing tables affected)
  1d. prisma generate

Step 2 — Shared Agent Tools Library
  2a. Create src/lib/ai/agent-tools.ts with all tool factory functions
  2b. Tools can reference new Prisma models (Step 1 must be done)
  2c. No routing or UI changes yet — pure business logic

Step 3 — Orchestrator + BullMQ Worker
  3a. Create src/lib/ai/orchestrator.ts (executeTask, appendTaskStep)
  3b. Create src/lib/queue/processors/helena-task.processor.ts
  3c. Add helenaTaskQueue to src/lib/queue/queues.ts
  3d. Register processor in src/worker.ts
  3e. Verify: manually POST a HelenaTask to DB, confirm BullMQ picks it up and runs

Step 4 — Task/Draft/Alert API Routes
  4a. GET/POST /api/helena/tasks (list + create)
  4b. GET/PATCH /api/helena/tasks/[id] (detail + cancel/retry)
  4c. GET/PATCH /api/helena/drafts (list + accept/reject)
  4d. GET/PATCH /api/helena/alerts (list + dismiss)
  4e. GET /api/helena/activity (unified feed endpoint)

Step 5 — ki-chat Route Modification (inline tools)
  5a. Add tools + stopWhen to streamText() call in ki-chat route
  5b. Wire onStepFinish Socket.IO emit
  5c. Test: chat triggers createHelenaTask tool → verify HelenaTask created in DB

Step 6 — Activity Feed UI
  6a. Create src/components/ki/task-card.tsx, draft-card.tsx, alert-card.tsx
  6b. Create src/components/ki/activity-feed.tsx (REST init + Socket.IO updates)
  6c. Create src/components/ki/task-dashboard.tsx
  6d. Add "Tasks" tab to HelenaTab in /ki-chat
  6e. Add "Aktivitäten" tab to Akte detail tabs (reuse ActivityFeed with akteId)

Step 7 — Background Scanner Extension (lowest risk, toggleable)
  7a. Extend proactive-processor.ts with Frist-alert logic
  7b. Add optional task enqueueing for KRITISCH deadlines
  7c. Test with a Frist 3 days in future — confirm HelenaAlert created + Socket.IO event fires
```

**Why this order:** Steps 1-3 (schema, tools, orchestrator) are pure backend and have no user-visible effect — safe to ship incrementally. Steps 4-5 expose the API and modify chat behaviour — test before shipping the UI. Step 6 is additive UI only. Step 7 extends the existing scanner which already has idempotency guards.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Kanzlei (1-5 lawyers, <50 tasks/day) | Current approach fine. Single BullMQ worker process. concurrency: 1 for helena-task (sequential Ollama calls). |
| Mid (20+ users, 200+ tasks/day) | Increase helena-task worker concurrency to 2. Add BullMQ job priority (KRITISCH alerts = priority 1, background research = priority 10). |
| Large (100+ users) | Dedicated worker process for helena-task separate from doc pipeline workers. Add rate limiting per-user to prevent task flooding. |

### Scaling Priorities

1. **First bottleneck:** Ollama GPU contention between background HelenaTask orchestration and existing embedding/reranking. Mitigate by giving helena-task jobs lower priority than embedding jobs via BullMQ job priority field. Embedding must complete before RAG degrades.
2. **Second bottleneck:** HelenaTask steps JSON column growing large for long-running tasks. Cap steps at 20 (stopWhen default). Truncate toolResult content to 2000 chars in the step log (full content is in the LLM context only).

---

## Anti-Patterns

### Anti-Pattern 1: Running the Full ReAct Loop Inside the ki-chat HTTP Request

**What people do:** Set `stopWhen: stepCountIs(20)` in the streaming chat route and allow Helena to run 20 tool-calling loops while the user waits for a streaming response.

**Why it's wrong:** A 20-step ReAct loop can take 5-30+ minutes with a large Ollama model. HTTP connections time out (Next.js default: 30s, Vercel: 10s). The user stares at a spinner. If the server restarts mid-loop, the entire task is lost.

**Do this instead:** In the ki-chat route, use `stopWhen: stepCountIs(5)` — enough for simple tool lookups and creating a HelenaTask. Complex multi-step work is handed off to BullMQ. The LLM response tells the user "Ich habe einen Task erstellt — du findest das Ergebnis im Aktivitäts-Feed." This is the same pattern used by Notion AI, Linear's AI features, and GitHub Copilot Workspace.

### Anti-Pattern 2: One Big Table for Tasks, Drafts, Suggestions, and Alerts

**What people do:** Extend `HelenaSuggestion` with extra columns (`taskSteps`, `schwere`, `taskStatus`) to avoid adding new tables.

**Why it's wrong:** HelenaSuggestion is a high-frequency table (one row per document scanned). Adding task-tracking and alert fields bloats every row with NULL columns. The `@@index([userId, status, createdAt])` index serves three completely different query patterns inefficiently. The Activity Feed query becomes a single-table horror with a WHERE typ IN (...) clause across vastly different record shapes.

**Do this instead:** Three narrow tables (HelenaTask, HelenaDraft, HelenaAlert) with focused indexes. The Activity Feed API joins them with a UNION query or queries them in parallel and merges in-memory at kanzlei scale. Each table has exactly the columns it needs.

### Anti-Pattern 3: Emitting Socket.IO Events Directly from Next.js API Routes

**What people do:** Import `socketEmitter` into the ki-chat route and emit `helena:alert` events from inside the API route handler when a tool creates an alert.

**Why it's wrong:** The Next.js app process and the worker process have separate `socketEmitter` singleton instances. Emitting from the app process only reaches clients connected to that process — in a multi-replica setup, 50% of users miss the event. The existing pattern uses `socketEmitter` only from the worker process, which connects to the Socket.IO adapter directly.

**Do this instead:** After tool execution creates a HelenaAlert/HelenaDraft/HelenaTask, the tool's `execute()` function publishes to a Redis channel (`helena:events`). The worker process subscribes to that channel (already subscribes to `settings:changed`) and emits Socket.IO events. Alternatively: use the existing Redis pub/sub pattern already established in the codebase's `src/lib/socket/` module.

### Anti-Pattern 4: Letting the Orchestrator Silently Swallow Step Failures

**What people do:** Wrap the entire `generateText()` call in a try-catch in the processor. If any step fails (Ollama timeout, DB error), the entire task is marked FEHLGESCHLAGEN and no partial results are saved.

**Why it's wrong:** A 15-step research task that fails on step 14 has produced 13 steps of valuable context. The user gets nothing.

**Do this instead:** Use `onStepFinish` to persist each step to `HelenaTask.steps` immediately. If the orchestrator throws after step 13, the task is FEHLGESCHLAGEN but the `steps` JSON contains 13 valid results. The API exposes these partial steps. The UI shows a "Teilweise abgeschlossen" state with the completed step log. The user can review what was found and manually continue.

---

## Sources

- Direct codebase inspection: `src/app/api/ki-chat/route.ts` (full file), `src/worker.ts` (full file), `src/lib/ai/proactive-processor.ts`, `src/lib/ai/scan-processor.ts`, `src/lib/queue/queues.ts`, `prisma/schema.prisma` (models 1456-1820)
- Vercel AI SDK v4 tool-calling and agent loop: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling, https://ai-sdk.dev/docs/agents/loop-control — `stopWhen: stepCountIs(N)` is the correct parameter (not `maxSteps`); `onStepFinish` fires after each iteration
- BullMQ job priorities: https://docs.bullmq.io — lower number = higher priority; existing codebase uses default priority for all queues
- Socket.IO room-based broadcast: matches existing pattern in worker.ts (`socketEmitter.to("akte:${akteId}").emit(...)`) and embedding.processor.ts
- Confidence: HIGH for integration patterns (all verified against live codebase); MEDIUM for Ollama step latency estimates (hardware-dependent, qwen3.5:35b on GPU)

---

*Architecture research for: Helena Agent v2 — autonomous agent integration into AI-Lawyer*
*Researched: 2026-02-27*
