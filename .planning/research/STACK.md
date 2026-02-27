# Stack Research

**Domain:** Helena Agent v2 — Autonomous agent capabilities for AI-Lawyer (ReAct loop, deterministic orchestrator, @-tagging, draft-approval, background scanner, memory, alerts, QA-gates, activity feed)
**Researched:** 2026-02-27
**Confidence:** HIGH for core decisions (verified against official AI SDK docs, BullMQ docs, npm registry); MEDIUM for QA-gate patterns (academic + emerging practice)

> This document covers ONLY libraries to ADD or decisions about what NOT to add for the Helena Agent v2 milestone.
> The existing validated stack (Next.js 14+, Prisma, PostgreSQL 16+pgvector, MinIO, Meilisearch, BullMQ+Redis, Socket.IO, Vercel AI SDK v4, LangChain textsplitters, Ollama qwen3.5:35b, Zod v3) is NOT repeated here.

---

## Critical Decision: AI SDK Version

### Stay on AI SDK v4 (`ai: ^4.3.19`) for this milestone

**Rationale:**

The current AI SDK npm version is 6.x (as of 2026-02-27: `6.0.103`). Migrating from v4 to v5/v6 requires the following breaking changes across 8 files already using the SDK:

| Breaking change | v4 | v5/v6 |
|----------------|-----|--------|
| Tool schema property | `parameters:` | `inputSchema:` |
| Message types | `CoreMessage` | `ModelMessage` |
| Message converter | `convertToCoreMessages()` | `convertToModelMessages()` |
| Multi-step limit | `maxSteps:` | `stopWhen: stepCountIs(n)` |
| Stream response helper | `toDataStreamResponse()` | `toUIMessageStreamResponse()` |
| `useChat` input state | automatic | manual |

Migrating this during a feature milestone introduces regression risk to the already-working RAG chat. The v4 API already supports everything needed for Helena Agent v2: `generateText` with `tools`, `generateObject` with Zod schemas, `streamText` for streaming. A separate tech-debt milestone (`v0.3-sdk-upgrade`) should handle this after v0.2 ships.

**What this means for tool-calling code:** In v4, tools are defined with `parameters:` (Zod schema) and `execute:`. Do NOT use the v5/v6 `tool()` helper or `inputSchema:`. All new tool-calling code in this milestone uses the v4 API.

---

## 1. ReAct Agent Loop — No New Framework

**Verdict: Build custom ReAct loop in TypeScript using existing `generateText` + `tools` from `ai@4.x`.**

Do not add LangChain agents, CrewAI, AutoGen, or any agent framework. Reasons:

- LangChain.js agents are a port of the Python library with incomplete coverage (e.g., `ParentDocumentRetriever` does not exist in JS)
- LangChain agent abstractions add indirection without value for a known, bounded use case
- The project already has `generateText` with tool-calling. A ReAct loop is 60–80 lines of TypeScript on top of it
- Self-hosted constraint makes cloud agent frameworks (LangSmith, CrewAI Cloud) non-starters

**Implementation pattern (write to `src/lib/helena/agent-loop.ts`):**

```typescript
import { generateText } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/provider";
import { wrapWithTracking } from "@/lib/ai/token-tracker";

const MAX_STEPS = 20; // hard ceiling, matches AI SDK v5+ default

export interface AgentTool {
  description: string;
  parameters: z.ZodSchema;
  execute: (args: unknown) => Promise<unknown>;
}

export async function runAgentLoop(
  systemPrompt: string,
  userMessage: string,
  tools: Record<string, AgentTool>,
  options: {
    akteId?: string;
    userId: string;
    onStep?: (step: number, toolName: string, result: unknown) => Promise<void>;
  }
): Promise<{ result: string; steps: number; toolCallHistory: Array<{ tool: string; args: unknown; result: unknown }> }> {
  const messages: CoreMessage[] = [{ role: "user", content: userMessage }];
  const history: Array<{ tool: string; args: unknown; result: unknown }> = [];
  let stepCount = 0;

  while (stepCount < MAX_STEPS) {
    const response = await wrapWithTracking(
      () => generateText({
        model: getModel(),
        system: systemPrompt,
        messages,
        tools: Object.fromEntries(
          Object.entries(tools).map(([name, t]) => [name, { description: t.description, parameters: t.parameters }])
        ),
        maxTokens: 2048,
        temperature: 0,
      }),
      { userId: options.userId, akteId: options.akteId, taskType: "agent-loop" }
    );

    // No tool calls — agent is done
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return { result: response.text, steps: stepCount, toolCallHistory: history };
    }

    // Execute tool calls and append results
    const toolResults: CoreMessage["content"] = [];
    for (const call of response.toolCalls) {
      const tool = tools[call.toolName];
      if (!tool) throw new Error(`Unknown tool: ${call.toolName}`);

      const result = await tool.execute(call.args);
      history.push({ tool: call.toolName, args: call.args, result });
      toolResults.push({ type: "tool-result", toolCallId: call.toolCallId, toolName: call.toolName, result: JSON.stringify(result) });

      if (options.onStep) {
        await options.onStep(stepCount, call.toolName, result);
      }
    }

    // Append assistant response + tool results to conversation
    messages.push({ role: "assistant", content: response.text + (response.toolCalls.length > 0 ? JSON.stringify(response.toolCalls) : "") });
    messages.push({ role: "tool", content: toolResults });
    stepCount++;
  }

  // Fallback: hit max steps, return last text
  const lastText = messages.filter(m => m.role === "assistant").pop();
  return {
    result: typeof lastText?.content === "string" ? lastText.content : "Agent loop reached maximum steps.",
    steps: stepCount,
    toolCallHistory: history,
  };
}
```

**Why this over AI SDK v5 `stopWhen`:** The codebase is on v4. This implementation gives identical semantics (stop on text without tool calls OR max steps) without requiring an SDK upgrade.

---

## 2. Structured Output — Existing `generateObject` + Zod v3

**No new library needed.** The project already uses `generateObject` with Zod schemas in `deadline-extractor.ts` and `party-extractor.ts`. The same pattern extends to all structured Helena outputs.

**Key schemas to define (write to `src/lib/helena/schemas/`):**

```typescript
// src/lib/helena/schemas/schriftsatz.schema.ts
export const schriftsatzSchema = z.object({
  titel: z.string().describe("Titel des Schriftsatzes"),
  adressat: z.string().describe("Empfänger (Gericht/Partei)"),
  einleitung: z.string().describe("Einleitungsabsatz"),
  abschnitte: z.array(z.object({
    ueberschrift: z.string(),
    text: z.string(),
    zitate: z.array(z.string()).describe("Gesetzeszitate und Urteilsverweise"),
  })),
  antrag: z.string().describe("Abschließender Antrag"),
  anlagen: z.array(z.string()).describe("Liste der Anlagen"),
  confidence: z.number().min(0).max(1),
});

// src/lib/helena/schemas/alert.schema.ts
export const alertSchema = z.object({
  type: z.enum(["FRIST_KRITISCH", "INAKTIVITAET", "ANOMALIE", "AUFGABE", "DOKUMENT", "SYSTEM"]),
  titel: z.string(),
  beschreibung: z.string(),
  prioritaet: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  akteId: z.string().nullable(),
  dueDate: z.string().nullable(),
});

// src/lib/helena/schemas/qa-gate.schema.ts
export const qaGateSchema = z.object({
  passed: z.boolean(),
  recallScore: z.number().min(0).max(1).describe("Recall@k: fraction of expected sources found"),
  hallucinationRisk: z.enum(["LOW", "MEDIUM", "HIGH"]),
  missingCitations: z.array(z.string()),
  unsupportedClaims: z.array(z.string()),
  verdict: z.string().describe("Short human-readable QA verdict"),
});
```

**Do NOT upgrade to Zod v4 in this milestone.** The `ai@4.x` SDK accepts Zod v3 schemas directly. Upgrading to Zod v4 while staying on AI SDK v4 risks peer-dependency conflicts (the AI SDK v5 migration guide explicitly requires `zod@4.1.8+`). Wait for the SDK upgrade milestone.

---

## 3. BullMQ — Existing `bullmq@^5.70.1` with Step-Job Pattern

**No library upgrade needed.** BullMQ 5.x already supports everything needed for agent background tasks.

**Patterns to use:**

### 3a. Agent Tasks as Step Jobs

Long-running agent loops (Schriftsatz generation, background scanner) use BullMQ's step-job pattern to survive worker restarts:

```typescript
// src/lib/queue/processors/helena-agent.processor.ts
enum AgentStep {
  INIT = "INIT",
  RETRIEVE = "RETRIEVE",
  GENERATE = "GENERATE",
  QA_GATE = "QA_GATE",
  STORE_DRAFT = "STORE_DRAFT",
  DONE = "DONE",
}

export async function helenaAgentProcessor(job: Job) {
  let step: AgentStep = job.data.step ?? AgentStep.INIT;

  while (step !== AgentStep.DONE) {
    switch (step) {
      case AgentStep.INIT: {
        await job.updateData({ ...job.data, step: AgentStep.RETRIEVE });
        step = AgentStep.RETRIEVE;
        break;
      }
      case AgentStep.RETRIEVE: {
        const chunks = await hybridSearch(job.data.query, job.data.akteId);
        await job.updateData({ ...job.data, chunks, step: AgentStep.GENERATE });
        step = AgentStep.GENERATE;
        break;
      }
      case AgentStep.GENERATE: {
        const draft = await runSchriftsatzOrchestrator(job.data);
        await job.updateData({ ...job.data, draft, step: AgentStep.QA_GATE });
        step = AgentStep.QA_GATE;
        break;
      }
      case AgentStep.QA_GATE: {
        const qa = await runQaGate(job.data.draft, job.data.chunks);
        if (qa.hallucinationRisk === "HIGH") {
          // Re-generate with explicit citation requirement
          await job.updateData({ ...job.data, step: AgentStep.GENERATE, qaFeedback: qa });
          step = AgentStep.GENERATE;
          break;
        }
        await job.updateData({ ...job.data, qa, step: AgentStep.STORE_DRAFT });
        step = AgentStep.STORE_DRAFT;
        break;
      }
      case AgentStep.STORE_DRAFT: {
        await storeDraftForApproval(job.data);
        // Emit Socket.IO event for real-time UI update
        await redisEmitter.emit("helena:draft-ready", { akteId: job.data.akteId, jobId: job.id });
        await job.updateData({ ...job.data, step: AgentStep.DONE });
        step = AgentStep.DONE;
        break;
      }
    }
  }
}
```

**Key BullMQ behavior:** `job.updateData()` persists step state in Redis. If the worker crashes during `GENERATE`, on retry the job resumes from `GENERATE`, not from `INIT`. This is critical for expensive LLM calls.

### 3b. @-Tagging as BullMQ Jobs

```typescript
// When user types "@Helena generate Abmahnung"
await helenaQueue.add("agent-task", {
  type: "SCHRIFTSATZ",
  akteId,
  userId,
  prompt: extractedPrompt,
  step: AgentStep.INIT,
}, {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 50,
});
```

### 3c. Nightly Background Scanner

```typescript
// Register in worker startup (src/lib/queue/worker.ts)
await scannerQueue.add(
  "nightly-scan",
  { type: "FULL_SCAN" },
  {
    repeat: { pattern: "0 2 * * *" }, // 2 AM every night
    jobId: "nightly-helena-scan",     // idempotent: only one scheduled job
  }
);
```

**Scanner checks to implement in `src/lib/queue/processors/scanner.processor.ts`:**
1. Fristen within 7 days with no Wiedervorlage — emit `FRIST_KRITISCH` alert
2. Akten with no activity for 30+ days — emit `INAKTIVITAET` alert
3. Dokumente uploaded in last 24h without OCR completion — emit system alert
4. RVG-Rechnungen overdue > 60 days — emit `ANOMALIE` alert
5. @-Task mentions assigned to Helena with no response within 4h — emit `AUFGABE` alert
6. New beA messages unprocessed for 24h — emit `DOKUMENT` alert

**Separate queues for separation of concerns:**

| Queue name | Purpose | Cron/Trigger |
|------------|---------|--------------|
| `helena-agent` | ReAct loop + Schriftsatz generation | On-demand (@-tag) |
| `helena-scanner` | Nightly background scan | `0 2 * * *` |
| `helena-pii` | Low-priority PII filtering (from v0.1) | After urteil-fetch |
| existing queues | Unchanged | Unchanged |

---

## 4. Helena Memory — PostgreSQL + Prisma (No New Library)

**No new library.** Implement memory as a Prisma table. Redis-based memory (e.g., `mem0`, `zep`) would require a new Docker service — violates self-hosted simplicity.

**Prisma schema additions:**

```prisma
// Per-case agent memory: Helena's working knowledge of an Akte
model HelenaMemory {
  id        String   @id @default(cuid())
  akteId    String
  akte      Akte     @relation(fields: [akteId], references: [id], onDelete: Cascade)
  key       String   // e.g. "sachverhalt_summary", "bekannte_fristen", "mandant_ziele"
  value     String   @db.Text
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())

  @@unique([akteId, key])
  @@index([akteId])
  @@map("helena_memory")
}

// @-Tagging task system
model HelenaTask {
  id          String          @id @default(cuid())
  akteId      String?
  akte        Akte?           @relation(fields: [akteId], references: [id])
  requestedBy String          // userId
  type        HelenaTaskType
  prompt      String          @db.Text
  status      HelenaTaskStatus @default(PENDING)
  jobId       String?         // BullMQ job ID
  result      Json?           // Stored agent output
  errorMsg    String?
  createdAt   DateTime        @default(now())
  completedAt DateTime?

  @@index([akteId])
  @@index([requestedBy])
  @@index([status])
  @@map("helena_tasks")
}

enum HelenaTaskType {
  SCHRIFTSATZ
  ANALYSE
  ZUSAMMENFASSUNG
  RECHERCHE
  ENTWURF_KORREKTUR
}

enum HelenaTaskStatus {
  PENDING
  RUNNING
  AWAITING_APPROVAL
  APPROVED
  REJECTED
  FAILED
}

// Alert system
model HelenaAlert {
  id          String      @id @default(cuid())
  akteId      String?
  akte        Akte?       @relation(fields: [akteId], references: [id])
  type        AlertType
  titel       String
  beschreibung String     @db.Text
  prioritaet  AlertPriority @default(MEDIUM)
  dismissed   Boolean     @default(false)
  dismissedBy String?
  dismissedAt DateTime?
  createdAt   DateTime    @default(now())

  @@index([akteId])
  @@index([dismissed])
  @@index([type, prioritaet])
  @@map("helena_alerts")
}

enum AlertType {
  FRIST_KRITISCH
  INAKTIVITAET
  ANOMALIE
  AUFGABE
  DOKUMENT
  SYSTEM
}

enum AlertPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

**Memory read/write pattern:**

```typescript
// src/lib/helena/memory.ts
export async function getMemory(akteId: string): Promise<Record<string, string>> {
  const entries = await prisma.helenaMemory.findMany({ where: { akteId } });
  return Object.fromEntries(entries.map(e => [e.key, e.value]));
}

export async function setMemory(akteId: string, key: string, value: string): Promise<void> {
  await prisma.helenaMemory.upsert({
    where: { akteId_key: { akteId, key } },
    update: { value },
    create: { akteId, key, value },
  });
}
```

**Memory keys (standardized):**

| Key | Content | Updated when |
|-----|---------|-------------|
| `sachverhalt_summary` | 2-3 sentence case summary | After each Schriftsatz generation |
| `bekannte_fristen` | JSON array of key dates | After scanner runs |
| `mandant_ziele` | Extracted client objectives | After initial document scan |
| `letzte_aktion` | Last action taken by Helena | After each agent task completes |
| `prozessstand` | Current procedural stage | After each Schriftsatz |

---

## 5. Deterministic Schriftsatz Orchestrator — No New Library

**Pattern: Sequential `generateObject` calls with Zod schemas for each section. No agent loop for Schriftsatz — determinism is more important than flexibility here.**

```typescript
// src/lib/helena/schriftsatz-orchestrator.ts

export async function orchestrateSchriftsatz(input: SchriftsatzInput): Promise<SchriftsatzDraft> {
  // Step 1: Analyze case and determine applicable law (structured)
  const rechtslage = await generateObject({
    model: getModel(),
    schema: rechtslageSchema,
    prompt: buildRechtslagePrompt(input),
  });

  // Step 2: Retrieve relevant Normen + Urteile for identified legal basis
  const quellen = await hybridSearch(rechtslage.object.hauptnormen.join(" "), input.akteId);

  // Step 3: Draft each section deterministically
  const abschnitte = await Promise.all(
    rechtslage.object.gliederungspunkte.map(punkt =>
      generateObject({
        model: getModel(),
        schema: abschnittSchema,
        prompt: buildAbschnittPrompt(punkt, quellen, input),
      })
    )
  );

  // Step 4: Generate Antrag
  const antrag = await generateObject({
    model: getModel(),
    schema: antragSchema,
    prompt: buildAntragPrompt(abschnitte.map(a => a.object), input),
  });

  return assembleSchriftsatz(rechtslage.object, abschnitte, antrag.object);
}
```

**Why not agent loop for Schriftsatz:** Legal briefs have a legally mandated structure (§ 253 ZPO, § 130 ZPO). Free-form agent exploration risks generating structurally invalid documents. Deterministic orchestration with defined sections guarantees format compliance. Use the agent loop only for open-ended research tasks.

---

## 6. QA-Gates — LLM-as-Judge + Citation Verification (No New Library)

**Approach:** Self-consistency check via `generateObject` on the produced draft. No external QA library needed — the existing Ollama model running `qwen3.5:35b` serves as judge.

**Three-gate pipeline (write to `src/lib/helena/qa-gate.ts`):**

### Gate 1: Citation Recall@k

Check whether the draft cites sources from the retrieved chunk set:

```typescript
export async function checkRecallAtK(
  draft: string,
  retrievedChunks: Array<{ id: string; content: string; gesetzKuerzel?: string; aktenzeichen?: string }>,
  k = 5
): Promise<{ recall: number; foundIds: string[]; missedIds: string[] }> {
  const topK = retrievedChunks.slice(0, k);
  const foundIds = topK.filter(chunk =>
    draft.includes(chunk.gesetzKuerzel ?? "") ||
    draft.includes(chunk.aktenzeichen ?? "") ||
    draft.includes(chunk.content.slice(0, 50)) // first 50 chars as fingerprint
  ).map(c => c.id);

  return {
    recall: foundIds.length / topK.length,
    foundIds,
    missedIds: topK.filter(c => !foundIds.includes(c.id)).map(c => c.id),
  };
}
```

### Gate 2: Hallucination Detection via LLM-as-Judge

```typescript
export async function checkHallucination(
  draft: string,
  sourceChunks: string[]
): Promise<{ risk: "LOW" | "MEDIUM" | "HIGH"; unsupportedClaims: string[] }> {
  const result = await generateObject({
    model: getModel(),
    schema: z.object({
      unsupportedClaims: z.array(z.string()).describe("Behauptungen ohne Quellengrundlage"),
      risk: z.enum(["LOW", "MEDIUM", "HIGH"]).describe("Gesamtrisiko für Halluzinationen"),
    }),
    system: `Du bist ein juristischer Qualitätsprüfer. Prüfe ob alle Behauptungen im Schriftsatz durch die bereitgestellten Quellen belegt sind.`,
    prompt: `Quellen:\n${sourceChunks.slice(0, 5).join("\n---\n")}\n\nSchriftsatz:\n${draft.slice(0, 3000)}`,
  });
  return { risk: result.object.risk, unsupportedClaims: result.object.unsupportedClaims };
}
```

### Gate 3: Format Compliance

```typescript
export async function checkFormatCompliance(draft: string, schriftsatzType: string): Promise<boolean> {
  // Deterministic checks — no LLM needed
  const hasAntrag = /^(Es wird beantragt|Ich beantrage|Wir beantragen)/m.test(draft);
  const hasParteien = /Kläger|Beklagter|Antragsteller|Antragsgegner/i.test(draft);
  const hasDatum = /\d{2}\.\d{2}\.\d{4}/.test(draft);
  return hasAntrag && hasParteien && hasDatum;
}
```

**Goldset evaluation (for QA regression testing):**

Store golden test cases in Prisma — no separate evaluation framework:

```prisma
model HelenaGoldset {
  id           String   @id @default(cuid())
  taskType     HelenaTaskType
  input        Json     // Prompt + context
  expectedKeys String[] // Expected citations, legal norms
  createdAt    DateTime @default(now())
  @@map("helena_goldset")
}
```

Run against goldset weekly via BullMQ cron. Compare `recall@k` over time. Alert via `HelenaAlert` if recall drops > 10% from baseline.

---

## 7. Draft-Approval Workflow — Existing Infrastructure

**No new library.** The existing `Dokumentstatus` enum (`ENTWURF → ZUR_PRUEFUNG → FREIGEGEBEN → VERSENDET`) already implements the concept. Helena drafts should use `HelenaTaskStatus.AWAITING_APPROVAL` to gate output.

**Pattern:**
1. Helena generates draft → `HelenaTask.status = AWAITING_APPROVAL`, `KiDraft.status = ZUR_PRUEFUNG`
2. Socket.IO event `helena:draft-ready` triggers real-time notification in UI
3. User reviews in existing KI-Entwürfe-Workspace
4. User approves → `KiDraft.status = FREIGEGEBEN`, `HelenaTask.status = APPROVED`
5. User rejects with comment → `HelenaTask.status = REJECTED`, feedback stored in `HelenaTask.result`

**Never auto-approve, never auto-send.** This is a hard constraint per BRAK 2025 + BRAO.

---

## 8. Activity Feed (Akte-Detail Feed-Umbau) — Existing Infrastructure

**No new library.** Use the existing `AuditLog` + Socket.IO + PostgreSQL pattern.

**New Prisma model for structured activity entries:**

```prisma
model AktenActivity {
  id          String       @id @default(cuid())
  akteId      String
  akte        Akte         @relation(fields: [akteId], references: [id], onDelete: Cascade)
  type        ActivityType
  actorId     String?      // userId or null for Helena/system
  actorName   String?      // denormalized for display
  description String       @db.Text
  metadata    Json?        // type-specific payload
  createdAt   DateTime     @default(now())

  @@index([akteId, createdAt(sort: Desc)])
  @@map("akten_activity")
}

enum ActivityType {
  DOKUMENT_HOCHGELADEN
  DOKUMENT_FREIGEGEBEN
  FRIST_ANGELEGT
  FRIST_ERREICHT
  EMAIL_EMPFANGEN
  EMAIL_VERSENDET
  HELENA_ENTWURF
  HELENA_ANALYSE
  HELENA_ALERT
  ZEITERFASSUNG
  NOTIZ
  STATUS_AENDERUNG
}
```

**Real-time delivery:** When a new `AktenActivity` is written, emit `akte:activity` Socket.IO event to the akte's room. Client subscribes on akte detail page mount. No polling.

---

## 9. Alert Delivery — Socket.IO + Prisma (No New Library)

**Pattern for the 6 alert types:**

```typescript
// src/lib/helena/alert-service.ts
export async function createAlert(alert: {
  akteId?: string;
  type: AlertType;
  titel: string;
  beschreibung: string;
  prioritaet: AlertPriority;
}): Promise<HelenaAlert> {
  const record = await prisma.helenaAlert.create({ data: alert });

  // Real-time delivery via Socket.IO
  if (alert.akteId) {
    await redisEmitter.emit(`akte:${alert.akteId}:alert`, record);
  }
  // Also emit to global notifications channel
  await redisEmitter.emit("helena:alert", record);

  return record;
}
```

Alerts are displayed in a dedicated **Helena Alerts** panel (new UI component) + as toast notifications via `sonner` (already in stack).

---

## 10. New Tool Definitions for Agent Loop

Helena's ReAct agent needs these tools (all call existing internal APIs — no new external dependencies):

| Tool name | Purpose | Calls |
|-----------|---------|-------|
| `search_law` | Retrieve relevant §§ from law_chunks | `hybridSearch()` on `law_chunks` |
| `search_cases` | Retrieve relevant Urteile from urteil_chunks | `hybridSearch()` on `urteil_chunks` |
| `search_templates` | Find Schriftsatz-Muster from muster_chunks | `hybridSearch()` on `muster_chunks` |
| `search_akte` | Search case documents for context | `hybridSearch()` on `document_chunks` |
| `calculate_deadline` | Compute BGB §§187-193 Frist | Existing `calculateFrist()` |
| `get_akte_info` | Fetch Akte metadata (parties, status, Sachgebiet) | Prisma query |
| `get_memory` | Read from HelenaMemory for this Akte | `getMemory()` |
| `set_memory` | Persist insight to HelenaMemory | `setMemory()` |
| `create_draft` | Store result as KI-Entwurf with ZUR_PRUEFUNG status | Prisma + MinIO |
| `create_alert` | Create a HelenaAlert | `createAlert()` |

---

## Complete Installation Summary

```bash
# Zero new production packages needed for Helena Agent v2 core features.
# All capabilities built on:
# - ai@^4.3.19 (existing — generateText + tools + generateObject)
# - bullmq@^5.70.1 (existing — step jobs + cron)
# - socket.io + @socket.io/redis-emitter (existing — real-time)
# - zod@^3.23.8 (existing — structured output schemas)
# - @prisma/client (existing — memory + alerts + activity feed)

# Only if adding Goldset evaluation UI (optional, post v0.2):
npm install @tanstack/react-table  # already in stack via @tanstack/react-virtual
```

**Total new npm packages: 0.**

---

## Recommended Stack (New Additions)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `ai` (Vercel AI SDK) | `^4.3.19` (STAY on v4) | `generateText` with tools for ReAct loop; `generateObject` for structured outputs | Already in stack. Upgrade to v5/v6 is a separate task — breaking changes risk existing RAG chat. v4 has full tool-calling and structured output needed for all agent features. |
| `bullmq` | `^5.70.1` (existing) | Step-job pattern for agent tasks; cron for nightly scanner | Already in stack. Step-job pattern with `job.updateData()` provides restart-safe long-running agent execution. |
| `zod` | `^3.23.8` (STAY on v3) | Structured output schemas for all Helena outputs | Already in stack. Do NOT upgrade to v4 — requires AI SDK v5+ peer dep. |
| PostgreSQL + Prisma | existing | HelenaMemory, HelenaTask, HelenaAlert, AktenActivity tables | Best choice for relational + queryable agent state. No Redis-based memory store needed. |
| Socket.IO + `@socket.io/redis-emitter` | existing | Real-time agent progress, draft-ready notifications, activity feed | Already configured. BullMQ worker emits; Next.js server delivers to client. Zero new setup. |

### Zero-Dependency Implementations (TypeScript Only)

| Feature | Approach | File to Create |
|---------|---------|----------------|
| ReAct agent loop | Custom `while` loop on `generateText` + tools | `src/lib/helena/agent-loop.ts` |
| Deterministic Schriftsatz orchestrator | Sequential `generateObject` calls | `src/lib/helena/schriftsatz-orchestrator.ts` |
| Helena memory | Prisma `HelenaMemory` upserts | `src/lib/helena/memory.ts` |
| Nightly scanner | BullMQ processor with cron `0 2 * * *` | `src/lib/queue/processors/scanner.processor.ts` |
| Alert service | Prisma write + Socket.IO emit | `src/lib/helena/alert-service.ts` |
| Citation Recall@k | String fingerprint matching | `src/lib/helena/qa-gate.ts` |
| Hallucination detection | `generateObject` LLM-as-judge | `src/lib/helena/qa-gate.ts` |
| Activity feed | Prisma `AktenActivity` + Socket.IO | `src/lib/helena/activity-service.ts` |
| @-tagging handler | BullMQ job enqueue in API route | `src/app/api/helena/task/route.ts` |

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Custom ReAct loop (`generateText` + tools) | LangChain.js agents | LangChain JS is incomplete port of Python. No `ParentDocumentRetriever`. Abstractions add indirection for marginal gain. 60–80 LOC TypeScript is simpler and auditable. |
| Custom ReAct loop | Vercel AI SDK v5/v6 `ToolLoopAgent` class | Requires AI SDK v5 migration (8 files, breaking changes). Not worth the risk mid-milestone. |
| Custom ReAct loop | CrewAI, AutoGen, LangGraph | Python-native. JS ports are experimental or cloud-dependent. Violates self-hosted constraint. |
| PostgreSQL + Prisma for memory | `mem0` (npm library) | mem0 adds a Python sidecar in practice. No stable self-hosted JS-native version. Overkill for per-case key-value store. |
| PostgreSQL + Prisma for memory | `zep` (memory service) | New Docker service. Adds operational complexity. Standard Postgres table is auditable and SQL-queryable. |
| LLM-as-judge for hallucination detection | HaluGate (Python) | Python-only, requires separate service. Our `generateObject` pattern achieves same result with existing Ollama. |
| LLM-as-judge for hallucination detection | Self-Consistency (multiple generations) | 3-5x more Ollama token cost per check. LLM-as-judge is more targeted and cheaper for domain-specific legal content. |
| Sequential `generateObject` for Schriftsatz | Free-form agent loop | Legal briefs have mandated structure (§ 253 ZPO). Agent loop risks structurally non-compliant output. Determinism > flexibility here. |
| BullMQ step-job pattern | Direct async call in API route | Agent tasks can take 2-10 minutes. API routes timeout. BullMQ provides retry, progress, and restart safety. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| LangChain.js agent classes | Incomplete JS port, adds LangChain complexity to a stack that only uses `@langchain/textsplitters` for one util function | Custom ReAct loop on Vercel AI SDK |
| AI SDK v5/v6 in this milestone | 8 files have breaking API changes (`parameters` → `inputSchema`, `CoreMessage` → `ModelMessage`, etc.). Regression risk to RAG chat. | Stay on v4, add dedicated "SDK Upgrade" milestone |
| Zod v4 in this milestone | Peer dep of AI SDK v5+. Upgrading Zod while staying on AI SDK v4 may cause type errors. | Stay on Zod v3 |
| `mem0`, `zep`, or vector-based memory | New services, operational complexity, overkill for structured per-case key-value storage | Prisma `HelenaMemory` table |
| OpenAI Assistants API | Cloud API, violates DSGVO self-hosted constraint | Local Ollama agent loop |
| Separate evaluation framework (deepeval, ragas) | Python-only, adds new service. Ragas requires Python. deepeval requires Python. | Custom Recall@k + LLM-as-judge in TypeScript |
| Separate activity-stream service | New Docker service for what is essentially a timestamped event table with Socket.IO delivery | Prisma `AktenActivity` + existing Socket.IO |
| Polling for agent progress | Wastes resources, degrades UX. | Socket.IO `akte:progress` events from BullMQ worker via `@socket.io/redis-emitter` |
| `node-schedule` or `node-cron` | Runs in app process, not worker. Doesn't survive worker restarts. | BullMQ repeatable jobs (already in use for `vorfristen-cron`) |

---

## Stack Patterns by Variant

**If Ollama GPU is overloaded during peak hours:**
- Agent loop runs in BullMQ worker (separate process from Next.js app)
- Scanner tasks are low-priority — set `priority: 10` (lower = lower priority in BullMQ)
- Helena tasks triggered by users are high-priority — set `priority: 1`
- This prevents background scans from starving user-facing agent requests

**If a generated Schriftsatz fails QA Gate (HIGH hallucination risk):**
- Re-run `GENERATE` step with explicit citation instruction in system prompt
- Add `qaFeedback` to job data so orchestrator knows to be more conservative
- After 2 failed QA gates, store draft as `ENTWURF` with warning flag — human must review
- Never silently discard; always give user visibility

**If Ollama times out during agent loop:**
- Catch error at tool-execution level in `runAgentLoop()`
- BullMQ retries job with exponential backoff (`attempts: 3, backoff: exponential`)
- After 3 failures, set `HelenaTask.status = FAILED`, create `HelenaAlert` of type `SYSTEM`

**If memory grows too large (many Akten, many keys):**
- Add soft limit: `getMemory()` returns only keys updated in last 90 days
- Add hard limit: max 20 key-value pairs per Akte (prune oldest on insert)
- Memory is optimization, not source of truth — Akte data in Prisma is always authoritative

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|----------------|-------|
| `ai@^4.3.19` | Zod `^3.x` | v4 uses `parameters:` for tools, `schema:` for `generateObject`. Do NOT mix with v5 patterns. |
| `bullmq@^5.70.1` | Redis 7 | `job.updateData()` requires BullMQ 5+. Already in use. |
| `zod@^3.23.8` | `ai@^4.x` | Stay on v3. v4 requires AI SDK v5+ peer dep. |
| `@socket.io/redis-emitter@^5.1.0` | `socket.io@^4.8.3`, Redis 7 | Already in use for IMAP IDLE notifications. Same pattern for agent progress. |

---

## Tech Debt: AI SDK Upgrade (Post v0.2)

When creating the `v0.3-sdk-upgrade` milestone, the following files need updates:

| File | Change required |
|------|----------------|
| `src/app/api/ki-chat/route.ts` | `CoreMessage` → `ModelMessage`, `toDataStreamResponse()` → `toUIMessageStreamResponse()` |
| `src/lib/ai/provider.ts` | `generateText` params unchanged, but check `maxTokens` → `maxOutputTokens` |
| `src/lib/helena/agent-loop.ts` | `parameters:` → `inputSchema:` in tool definitions, `maxSteps` → `stopWhen: stepCountIs(20)` |
| `src/lib/ai/deadline-extractor.ts` | `generateObject` — likely unchanged, `schema:` property is same in v5 |
| `src/lib/ai/party-extractor.ts` | Same as deadline-extractor |
| All new agent files in `src/lib/helena/` | Write v4-compatible now; codemod to v5 later with `npx @ai-sdk/codemod v5` |

Run `npx @ai-sdk/codemod v5` then `npx @ai-sdk/codemod v6` to automate most of the migration.

---

## Sources

- Vercel AI SDK tool calling documentation: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling — tool definition with `parameters:` (v4) vs `inputSchema:` (v5+) confirmed (HIGH confidence)
- AI SDK v4 to v5 migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0 — all breaking changes listed (HIGH confidence)
- AI SDK v5 to v6 migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0 — v5→v6 is low-risk, v4→v5 is high-risk (HIGH confidence)
- AI SDK 6 blog post: https://vercel.com/blog/ai-sdk-6 — `ToolLoopAgent` class, `stopWhen: stepCountIs(20)` default confirmed (HIGH confidence)
- AI SDK loop control docs: https://ai-sdk.dev/docs/agents/loop-control — `stopWhen`, `prepareStep` confirmed (HIGH confidence)
- npm `ai` version: `6.0.103` current (verified via `npm view ai version`, 2026-02-27) — project uses `^4.3.19` (HIGH confidence)
- BullMQ step-job pattern: https://docs.bullmq.io/patterns/process-step-jobs — `job.updateData()`, `moveToDelayed()`, step enum pattern (HIGH confidence)
- BullMQ long-running jobs: https://oneuptime.com/blog/post/2026-01-21-bullmq-long-running-jobs/view — checkpointing strategy (MEDIUM confidence)
- Zod v3 vs v4 compatibility: https://zod.dev/v4/versioning — peer dep chain makes v4 upgrade tied to AI SDK v5 (HIGH confidence)
- LangChain.js vs Vercel AI SDK comparison: https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide — confirmed LangChain JS is incomplete vs Python port (MEDIUM confidence)
- Hallucination detection via LLM-as-judge: https://www.datadoghq.com/blog/ai/llm-hallucination-detection/ — production-validated approach (MEDIUM confidence)
- Self-consistency detection (SelfCheckGPT): https://www.emergentmind.com/topics/self-consistency-based-hallucination-detection — academic basis for multi-pass checking (MEDIUM confidence; LLM-as-judge chosen for cost efficiency)

---

*Stack research for: Helena Agent v2 — AI-Lawyer autonomous agent capabilities*
*Researched: 2026-02-27*
