# Phase 20: Agent Tools + ReAct Loop - Research

**Researched:** 2026-02-27
**Domain:** AI Agent Tool Calling, ReAct Loop, Vercel AI SDK v4, Ollama Integration
**Confidence:** HIGH

## Summary

Phase 20 builds the core agent engine for Helena: a pure TypeScript library containing 14+ tool factory functions, a ReAct loop orchestrator with dual-mode execution (inline/background), an Ollama tool-call response guard, and a token budget manager. The library is self-contained and testable in isolation -- downstream phases (Task-System, Schriftsatz Orchestrator, Scanner, Memory) consume it.

The existing codebase already provides strong foundations: AI SDK v4.3.19 with `generateText` and `maxSteps` for multi-step tool calling, `experimental_repairToolCall` for Ollama response repair, `ollama-ai-provider@^1.2.0` for Ollama integration, comprehensive Prisma models from Phase 19 (HelenaTask, HelenaDraft, HelenaAlert, HelenaMemory), RBAC with `buildAkteAccessFilter()`, and existing RAG search functions (`searchLawChunks`, `searchUrteilChunks`, `searchMusterChunks`, `hybridSearch`). The RVG calculator library provides fee computation that tools can expose directly.

**Primary recommendation:** Use AI SDK v4.3.19's built-in `generateText({ tools, maxSteps })` loop as the ReAct orchestrator backbone, with `experimental_repairToolCall` as the primary Ollama response guard mechanism, supplemented by a content-parsing fallback for JSON-as-content detection. Implement tools as individual modules auto-discovered from a directory, each exporting a `tool()` definition with Zod schemas.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Tiered data access:** Summary tools return compact key fields (ID, title, status, dates, short summary). Separate `_detail` variants return full records. Two separate tool definitions per entity.
- **Tool format:** Vercel AI SDK `tool()` format with Zod schemas for runtime parameter validation
- **Single factory API:** `createHelenaTools({ prisma, userId, akteId })` returns all tool instances with shared context
- **Plugin pattern:** Each tool is a self-contained module (schema + handler + description). Auto-discovered from directory. Adding a tool = create a file.
- **English descriptions:** Tool names and descriptions in English for best LLM comprehension. German domain terms (Akte, Frist, Rechtsgebiet) kept as-is.
- **No tool cap:** Expose all tools to the LLM. No pre-filtering by context.
- **Parallel tool calls:** If the LLM returns multiple tool_calls in one response, execute them concurrently.
- **In-run caching:** Cache tool results by (tool_name, params_hash) for one agent run duration.
- **Read Tools (9 + detail variants):** read_akte, read_dokumente, read_fristen, read_zeiterfassung, search_gesetze, search_urteile, search_muster, get_kosten_rules, search_alle_akten, search_web
- **Write Tools (5 + 1):** create_draft_dokument, create_draft_frist, create_notiz, create_alert, update_akte_rag, create_draft_zeiterfassung -- all create drafts/proposals, never final records
- **Source attribution:** Every tool result carries source metadata
- **Error handling:** Tool failures return structured error messages as observations, never crash the loop
- **PII filtering:** Applied at a higher layer before tool results enter ReAct loop context
- **Audit trail:** Every tool call logged: tool name, parameters, result summary, user, timestamp
- **Rate limiting:** Admin-configurable rate limits per user per hour
- **Role-based tool filtering:** ADMIN/ANWALT get all tools. SACHBEARBEITER: all read + limited write. SEKRETARIAT: read-only + create_notiz. PRAKTIKANT: read-only.
- **Stall detection:** Same tool with same params 2+ times, or 3 consecutive steps produce no new information
- **Stall action:** Force final answer via injected system message
- **Token budget:** Truncate oldest tool results first when approaching 75% of context window. Keep system prompt, recent results, and user message intact. FIFO.
- **Streaming:** Tool call results streamed to chat as they come in
- **Global timeouts:** 30s for inline mode, 3min for background mode
- **Mode selection:** Lightweight LLM classifier determines complexity before main agent run
- **Inline cap behavior:** When 5-step cap hit, offer to continue in background mode
- **Background progress:** Live progress updates in chat
- **Cancel button:** User can abort background tasks
- **Multi-tier local:** Tier 1 (small ~2B), Tier 2 (big 20B+), Tier 3 (cloud)
- **Auto-escalation:** If tier 1 stalls, automatically retry with tier 2
- **Ollama response guard:** Applied to ALL local model responses, detects and corrects JSON-as-content
- **Helena persona:** Friendly professional, Du-Form, always German
- **Unit tests per tool factory function with mocked Prisma**
- **Integration tests for ReAct loop with mock LLM responses**

### Claude's Discretion
- Exact plugin directory structure and auto-discovery mechanism
- Token counting implementation details (tiktoken vs approximation)
- Complexity classifier prompt design
- Exact progress update format and Socket.IO event structure
- LLM response parsing internals
- Cache invalidation strategy within a run

### Deferred Ideas (OUT OF SCOPE)
- Conversation memory across sessions -- Phase 25 (Helena Memory)
- BullMQ task queue integration -- Phase 21 (@Helena Task-System)
- Cost tracking dashboard for LLM token usage -- future admin feature
- Model health monitoring -- operational concern, not core library
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGNT-01 | Helena kann autonom ueber einen ReAct-Loop (Reason->Act->Observe) mehrstufige Aufgaben ausfuehren (max 20 Steps, dann Fallback-Meldung) | AI SDK v4.3.19 `generateText({ tools, maxSteps: 20 })` with `onStepFinish` callback provides the loop. Stall detection via step history analysis. |
| AGNT-02 | Helena hat 9 Read-Only-Tools | Each tool as a module in `src/lib/helena/tools/` using `tool()` from AI SDK + Zod schemas. Data access via existing Prisma models + search functions (`searchLawChunks`, `searchUrteilChunks`, `searchMusterChunks`, `hybridSearch`). RBAC via `buildAkteAccessFilter()`. |
| AGNT-03 | Helena hat 5 Write-Tools die immer als Draft/Vorschlag erzeugt werden | Write tools create `HelenaDraft` records with appropriate `HelenaDraftTyp`. Draft status always starts as `PENDING`. |
| AGNT-04 | Helena-Agent laeuft in zwei Modi: Inline (5-Step-Cap) und Background (20-Step-Cap) | Orchestrator wraps `generateText` with mode-specific `maxSteps` and `AbortSignal.timeout()`. Complexity classifier as a lightweight `generateText` call before main run. |
| AGNT-05 | Ollama-Tool-Call-Response-Guard | AI SDK v4.3.19 has `experimental_repairToolCall` hook for parse failures. Supplemental content-scanning guard for JSON-as-content responses that the SDK doesn't catch. |
| AGNT-06 | Token-Budget-Manager begrenzt LLM-Kontextverbrauch pro Agent-Run | Custom token estimator (char-based approximation: ~4 chars/token for English, ~3 for German/mixed). Truncate oldest tool results in message history when approaching 75% of model's context window. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ai (Vercel AI SDK) | 4.3.19 | `generateText`, `tool()`, `maxSteps`, `onStepFinish`, `experimental_repairToolCall` | Already installed; provides the entire multi-step tool-calling loop with repair hooks |
| zod | ^3.23.8 | Tool input schema validation | Already installed; AI SDK requires Zod for `tool()` inputSchema |
| @prisma/client | ^5.22.0 | Database access for all tool handlers | Already installed; all Helena models defined |
| ollama-ai-provider | ^1.2.0 | Ollama <-> AI SDK bridge | Already installed; provides `createOllama()` used in `src/lib/ai/provider.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ioredis | ^5.9.3 | In-run cache storage (optional), rate limiting counters | Already installed; use for rate limiting per-user counters |
| socket.io / socket.io-client | ^4.8.3 | Progress updates and streaming to frontend | Already installed; for background mode progress events |
| pino | ^10.3.1 | Structured logging in tool handlers and orchestrator | Already installed; use `createLogger()` from `src/lib/logger` |
| vitest | ^4.0.18 | Unit and integration tests | Already in devDependencies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AI SDK `maxSteps` loop | Manual while-loop around `generateText` | Manual loop gives more control over stall detection and token budget, but loses SDK's built-in step tracking, response message accumulation, and `onStepFinish`. Recommend using `maxSteps` with `experimental_prepareStep` for per-step control. |
| Char-based token estimation | tiktoken / js-tiktoken | tiktoken is accurate but adds ~2MB dependency and only works for OpenAI tokenizers. Char approximation (1 token ~ 4 chars) is sufficient for 75% budget threshold. |
| In-memory Map for run cache | Redis per-run cache | In-memory Map is simpler and sufficient since each agent run is a single process. No need for Redis here. |

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/helena/
  tools/
    index.ts              # Auto-discovery: reads directory, exports createHelenaTools()
    types.ts              # Shared types: ToolContext, ToolResult, SourceAttribution
    _read/
      read-akte.ts        # read_akte tool
      read-akte-detail.ts # read_akte_detail tool
      read-dokumente.ts
      read-dokumente-detail.ts
      read-fristen.ts
      read-zeiterfassung.ts
      search-gesetze.ts
      search-urteile.ts
      search-muster.ts
      get-kosten-rules.ts
      search-alle-akten.ts
      search-web.ts
    _write/
      create-draft-dokument.ts
      create-draft-frist.ts
      create-notiz.ts
      create-alert.ts
      update-akte-rag.ts
      create-draft-zeiterfassung.ts
  orchestrator.ts         # ReAct loop: wraps generateText with stall detection + token budget
  token-budget.ts         # Token estimation and FIFO truncation logic
  response-guard.ts       # Ollama JSON-as-content detection and repair
  complexity-classifier.ts # Lightweight LLM call to determine mode + tier
  tool-cache.ts           # In-run result cache (Map-based)
  audit-logger.ts         # Tool call audit trail logging
  role-filter.ts          # Role-based tool filtering
  system-prompt.ts        # Helena persona system prompt builder
```

### Pattern 1: Tool Module Pattern
**What:** Each tool is a self-contained file exporting a factory function
**When to use:** Every tool follows this pattern

```typescript
// Source: AI SDK v4.3.19 docs + project conventions
// src/lib/helena/tools/_read/read-akte.ts

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";

export function createReadAkteTool(ctx: ToolContext) {
  return tool({
    description:
      "Read summary info about the current Akte (case file): Aktenzeichen, status, Sachgebiet, Kurzrubrum, Gegenstandswert, assigned Anwalt/Sachbearbeiter, and counts of Dokumente/Fristen/Beteiligte. Use read_akte_detail for full data.",
    parameters: z.object({
      akteId: z.string().optional().describe("Akte ID. Defaults to current Akte context if omitted."),
    }),
    execute: async ({ akteId: inputAkteId }) => {
      const targetId = inputAkteId ?? ctx.akteId;
      if (!targetId) {
        return { error: "Keine Akte angegeben und kein Akte-Kontext vorhanden." };
      }

      // RBAC check: user must have access to this Akte
      const akte = await ctx.prisma.akte.findFirst({
        where: {
          id: targetId,
          ...ctx.akteAccessFilter,
        },
        select: {
          id: true,
          aktenzeichen: true,
          kurzrubrum: true,
          sachgebiet: true,
          status: true,
          gegenstandswert: true,
          anwalt: { select: { name: true } },
          sachbearbeiter: { select: { name: true } },
          _count: {
            select: { dokumente: true, kalenderEintraege: true, beteiligte: true },
          },
        },
      });

      if (!akte) {
        return { error: "Akte nicht gefunden oder kein Zugriff.", source: { table: "akte" } };
      }

      return {
        data: {
          id: akte.id,
          aktenzeichen: akte.aktenzeichen,
          kurzrubrum: akte.kurzrubrum,
          sachgebiet: akte.sachgebiet,
          status: akte.status,
          gegenstandswert: akte.gegenstandswert?.toString() ?? null,
          anwalt: akte.anwalt?.name ?? null,
          sachbearbeiter: akte.sachbearbeiter?.name ?? null,
          dokumenteCount: akte._count.dokumente,
          fristenCount: akte._count.kalenderEintraege,
          beteiligteCount: akte._count.beteiligte,
        },
        source: { table: "akte", id: akte.id },
      };
    },
  });
}
```

### Pattern 2: Tool Context Injection
**What:** Shared context injected into all tools via factory pattern
**When to use:** Always -- replaces global state with explicit dependency injection

```typescript
// src/lib/helena/tools/types.ts
import type { PrismaClient, UserRole } from "@prisma/client";

export interface ToolContext {
  prisma: PrismaClient;
  userId: string;
  userRole: UserRole;
  akteId: string | null;
  /** Pre-computed Prisma WHERE filter for RBAC-scoped Akte access */
  akteAccessFilter: Record<string, any>;
  /** Helena system user ID for audit */
  helenaUserId: string;
}

export interface ToolResult<T = unknown> {
  data?: T;
  error?: string;
  source?: {
    table: string;
    id?: string;
    query?: string;
    chunkIds?: string[];
  };
}
```

### Pattern 3: ReAct Orchestrator with AI SDK maxSteps
**What:** Wraps `generateText` with stall detection, token budget, and timeout
**When to use:** Every agent invocation

```typescript
// src/lib/helena/orchestrator.ts (conceptual structure)
import { generateText, type CoreMessage } from "ai";
import type { LanguageModel } from "ai";

export interface AgentRunOptions {
  model: LanguageModel;
  tools: Record<string, any>;
  systemPrompt: string;
  messages: CoreMessage[];
  mode: "inline" | "background";
  onStepUpdate?: (step: StepUpdate) => void;
  abortSignal?: AbortSignal;
}

export async function runAgent(options: AgentRunOptions) {
  const maxSteps = options.mode === "inline" ? 5 : 20;
  const timeout = options.mode === "inline" ? 30_000 : 180_000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Combine external abort with timeout
  if (options.abortSignal) {
    options.abortSignal.addEventListener("abort", () => controller.abort());
  }

  const result = await generateText({
    model: options.model,
    tools: options.tools,
    system: options.systemPrompt,
    messages: options.messages,
    maxSteps,
    abortSignal: controller.signal,
    experimental_repairToolCall: ollamaResponseGuard,
    onStepFinish: async ({ text, toolCalls, toolResults, usage, finishReason }) => {
      // 1. Token budget check + FIFO truncation
      // 2. Stall detection
      // 3. Progress update callback
      // 4. Audit log
    },
  });

  clearTimeout(timeoutId);
  return result;
}
```

### Pattern 4: Ollama Response Guard using experimental_repairToolCall
**What:** Catches JSON-as-content responses from Ollama models
**When to use:** Always passed to `generateText` when using Ollama provider

```typescript
// src/lib/helena/response-guard.ts
import type { LanguageModelV1FunctionToolCall } from "ai";

/**
 * AI SDK v4.3.19 experimental_repairToolCall hook.
 *
 * Called when the SDK fails to parse a tool call from the LLM response.
 * This handles qwen3.5:35b's tendency to emit tool calls as JSON content
 * instead of proper tool_call format.
 */
export async function ollamaResponseGuard(options: {
  system: string | undefined;
  messages: any[];
  toolCall: LanguageModelV1FunctionToolCall;
  tools: any;
  parameterSchema: (options: { toolName: string }) => any;
  error: Error;
}): Promise<LanguageModelV1FunctionToolCall | null> {
  const { toolCall, error } = options;

  // Try to fix common Ollama JSON issues:
  // 1. Invalid JSON in arguments
  // 2. Missing quotes around keys
  // 3. Trailing commas
  try {
    const fixedArgs = JSON.parse(
      toolCall.args
        .replace(/,\s*}/g, "}") // trailing commas
        .replace(/,\s*]/g, "]") // trailing commas in arrays
        .replace(/'/g, '"')     // single to double quotes
    );
    return { ...toolCall, args: JSON.stringify(fixedArgs) };
  } catch {
    // Could not repair -- return null to skip this tool call
    return null;
  }
}
```

### Pattern 5: Token Budget Manager
**What:** Estimates token count and truncates old results when approaching context limit
**When to use:** In `onStepFinish` callback before each new step

```typescript
// src/lib/helena/token-budget.ts

/** Approximate token count: ~4 chars per token (conservative for mixed German/English) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

/** Context windows by model family */
const CONTEXT_WINDOWS: Record<string, number> = {
  "qwen3.5:35b": 32_768,
  "gpt-4o": 128_000,
  "claude-sonnet-4-20250514": 200_000,
  default: 32_768,
};

export function getContextWindow(modelName: string): number {
  for (const [key, value] of Object.entries(CONTEXT_WINDOWS)) {
    if (modelName.includes(key)) return value;
  }
  return CONTEXT_WINDOWS.default;
}
```

### Anti-Patterns to Avoid
- **Never build a custom while-loop when AI SDK provides `maxSteps`:** The SDK handles message accumulation, step tracking, and response construction. A custom loop would lose all of this.
- **Never allow tools to throw unhandled exceptions:** Tool errors must be caught and returned as structured error objects in the tool result. Unhandled throws crash the entire loop.
- **Never query the database without RBAC filtering:** Every read tool must use `ctx.akteAccessFilter` in its Prisma WHERE clause. Helena should only see what the logged-in user can see.
- **Never create non-draft records in write tools:** All write tools create `HelenaDraft` records or equivalent draft/proposal entities. This is a legal compliance requirement (BRAK 2025 / BRAO 43).
- **Never pass raw Prisma models to LLM context:** Tool results must be serialized to plain objects with only relevant fields. Prisma models contain relations and metadata that waste tokens.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-step tool calling loop | Custom while-loop with prompt accumulation | AI SDK `generateText({ maxSteps })` | Handles message threading, step result accumulation, finish reason detection |
| Tool call parse failure repair | Custom JSON parser for LLM responses | AI SDK `experimental_repairToolCall` | Built into the SDK, called automatically on parse failures |
| Tool schema validation | Manual param checking in tool handlers | Zod schemas in `tool({ parameters: z.object({...}) })` | AI SDK validates automatically, provides type inference |
| RBAC-scoped Akte queries | Custom access check in every tool | `buildAkteAccessFilter()` from `src/lib/rbac.ts` | Already handles ADMIN/ANWALT/SACHBEARBEITER/SEKRETARIAT + Dezernat membership |
| Law/Urteil/Muster search | New pgvector search functions | Existing `searchLawChunks`, `searchUrteilChunks`, `searchMusterChunks` | Already optimized with scoring, PII filtering (Urteile), parent-child chunks |
| Fee calculation | New RVG lookup table | Existing `computeRvgFee`, `buildCalculation` from `src/lib/finance/rvg/calculator.ts` | Complete RVG 2025 implementation with Anrechnung, VV catalog, GKG tables |
| Token tracking | Custom counter | Existing `trackTokenUsage` + `wrapWithTracking` from `src/lib/ai/token-tracker.ts` | Already integrated with Prisma TokenUsage model |
| Provider model factory | New Ollama/OpenAI setup | Existing `getModel()` from `src/lib/ai/provider.ts` | Handles all providers, caches instances, LFM2 sampling params |

**Key insight:** The existing codebase provides 80%+ of what the tools need. The main work is wiring existing services into the AI SDK `tool()` format and building the orchestrator layer on top.

## Common Pitfalls

### Pitfall 1: Ollama JSON-as-Content Responses
**What goes wrong:** Ollama models (especially qwen3.5:35b) sometimes emit tool call JSON as regular text content instead of structured tool_call objects. The AI SDK sees this as a normal text response and stops the loop.
**Why it happens:** Non-deterministic model behavior -- the same prompt can produce correct tool calls or JSON-as-content depending on seed, temperature, and response structure.
**How to avoid:**
1. Use `experimental_repairToolCall` for parse failures the SDK catches
2. Add a secondary content-scanning guard in `onStepFinish` that checks if the response text contains tool-call-shaped JSON (regex pattern for `{"name": "...", "arguments": {...}}`)
3. Set `temperature: 0` and explicit seed for reproducibility
4. If content-scanning guard detects JSON tool call, re-parse and manually construct the next step
**Warning signs:** Agent loop ending after 1 step with text that looks like `{"name": "read_akte", "arguments": {"akteId": "..."}}`

### Pitfall 2: Context Window Overflow with Many Tool Results
**What goes wrong:** Each tool result adds content to the message history. With 20 steps and verbose tool results, the context window fills up, causing the LLM to error or produce garbage.
**Why it happens:** Tool results (especially document searches, law chunk searches) can be 500-2000 tokens each. 20 steps * 1000 tokens = 20K tokens of tool results alone.
**How to avoid:** Implement FIFO truncation in `onStepFinish` -- estimate total token count of messages array, and if above 75% of context window, remove the oldest tool result messages (keep system prompt, user message, and last 3 tool results).
**Warning signs:** LLM errors with "context_length_exceeded" or similar, or increasingly degraded response quality in later steps.

### Pitfall 3: PRAKTIKANT Role Not in Schema
**What goes wrong:** CONTEXT.md mentions PRAKTIKANT role for role-based tool filtering, but the `UserRole` enum in the Prisma schema only has ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT.
**Why it happens:** The discussion added a future role that doesn't exist yet.
**How to avoid:** Implement role-based tool filtering with the 4 existing roles only. If PRAKTIKANT is added later, the filter function can be extended. Map SEKRETARIAT to the "read-only + create_notiz" tier described for PRAKTIKANT.
**Warning signs:** TypeScript errors referencing PRAKTIKANT enum value.

### Pitfall 4: Stall Detection False Positives
**What goes wrong:** Agent legitimately calls the same tool twice with different contexts (e.g., `read_akte` for two different Akten), but the stall detector triggers because tool names match.
**Why it happens:** Stall detection that only checks tool names without parameter comparison.
**How to avoid:** Stall detection must compare `(tool_name, JSON.stringify(sorted_params))` tuples. Only trigger on truly identical calls. For the "no new information" check, compare tool result content hashes.
**Warning signs:** Agent being forced to give final answer prematurely when legitimately exploring multiple entities.

### Pitfall 5: AbortSignal Handling in Nested Async
**What goes wrong:** User cancels a background task, but the abort signal doesn't propagate to nested Prisma queries or LLM calls, causing the process to hang.
**Why it happens:** AbortSignal must be explicitly passed to each cancellable operation. Prisma doesn't natively support AbortSignal.
**How to avoid:** Check `signal.aborted` at the beginning of each tool execute function. For the LLM call itself, AI SDK's `generateText` accepts `abortSignal` directly.
**Warning signs:** Background tasks that don't respond to cancel within 5 seconds.

### Pitfall 6: Search Tools Need Embeddings
**What goes wrong:** `search_gesetze`, `search_urteile`, `search_muster` tools fail because they require embedding vectors, but generating embeddings needs an Ollama call that adds latency and could fail.
**Why it happens:** The existing search functions (`searchLawChunks`, `searchUrteilChunks`, `searchMusterChunks`) take `queryEmbedding: number[]` as input, requiring `generateQueryEmbedding()` call first.
**How to avoid:** Each search tool should call `generateQueryEmbedding()` internally, handle failures gracefully (return "Embedding-Dienst nicht verfuegbar" error), and cache the embedding for the run if the same query is used multiple times.
**Warning signs:** Search tools returning empty results when the embedding service is slow or down.

## Code Examples

### Complete Tool Factory with Auto-Discovery
```typescript
// src/lib/helena/tools/index.ts
import { readdirSync } from "fs";
import { join } from "path";
import type { ToolContext } from "./types";
import { buildAkteAccessFilter } from "@/lib/rbac";
import type { PrismaClient, UserRole } from "@prisma/client";

export interface CreateHelenaToolsOptions {
  prisma: PrismaClient;
  userId: string;
  userRole: UserRole;
  akteId: string | null;
  helenaUserId: string;
}

export function createHelenaTools(options: CreateHelenaToolsOptions) {
  const ctx: ToolContext = {
    ...options,
    akteAccessFilter: buildAkteAccessFilter(options.userId, options.userRole),
  };

  // Auto-discover tool files from _read/ and _write/ directories
  const toolDirs = ["_read", "_write"];
  const tools: Record<string, any> = {};

  for (const dir of toolDirs) {
    const dirPath = join(__dirname, dir);
    const files = readdirSync(dirPath).filter(
      (f) => f.endsWith(".ts") || f.endsWith(".js")
    );
    for (const file of files) {
      const mod = require(join(dirPath, file));
      // Convention: each module exports a single create*Tool function
      const createFn = Object.values(mod).find(
        (v) => typeof v === "function" && (v as Function).name.startsWith("create")
      ) as ((ctx: ToolContext) => any) | undefined;
      if (createFn) {
        const toolInstance = createFn(ctx);
        // Tool name from filename: read-akte.ts -> read_akte
        const toolName = file.replace(/\.(ts|js)$/, "").replace(/-/g, "_");
        tools[toolName] = toolInstance;
      }
    }
  }

  return tools;
}
```

### Write Tool Creating HelenaDraft
```typescript
// src/lib/helena/tools/_write/create-draft-dokument.ts
import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";

export function createCreateDraftDokumentTool(ctx: ToolContext) {
  return tool({
    description:
      "Create a draft document (Entwurf) for the current Akte. Content is stored as markdown. The draft requires user approval before becoming a real Dokument. Returns the draft ID for reference.",
    parameters: z.object({
      akteId: z.string().optional().describe("Akte ID. Defaults to current context."),
      titel: z.string().describe("Document title in German"),
      inhalt: z.string().describe("Document content as markdown"),
      meta: z.record(z.unknown()).optional().describe("Additional metadata"),
    }),
    execute: async ({ akteId: inputAkteId, titel, inhalt, meta }) => {
      const targetAkteId = inputAkteId ?? ctx.akteId;
      if (!targetAkteId) {
        return { error: "Keine Akte angegeben." };
      }

      const draft = await ctx.prisma.helenaDraft.create({
        data: {
          akteId: targetAkteId,
          userId: ctx.userId,
          typ: "DOKUMENT",
          status: "PENDING",
          titel,
          inhalt,
          meta: meta ?? undefined,
        },
      });

      return {
        data: { draftId: draft.id, typ: "DOKUMENT", titel, status: "PENDING" },
        source: { table: "helena_drafts", id: draft.id },
      };
    },
  });
}
```

### Stall Detection Logic
```typescript
// Inside onStepFinish callback
interface StepRecord {
  toolName: string;
  paramsHash: string;
  resultHash: string;
}

function detectStall(history: StepRecord[]): boolean {
  if (history.length < 2) return false;

  const last = history[history.length - 1];

  // Check: same tool + same params called 2+ times
  const duplicateCount = history.filter(
    (h) => h.toolName === last.toolName && h.paramsHash === last.paramsHash
  ).length;
  if (duplicateCount >= 2) return true;

  // Check: 3 consecutive steps with no new information
  if (history.length >= 3) {
    const lastThree = history.slice(-3);
    const uniqueResults = new Set(lastThree.map((h) => h.resultHash));
    if (uniqueResults.size === 1) return true;
  }

  return false;
}
```

### Role-Based Tool Filtering
```typescript
// src/lib/helena/role-filter.ts
import type { UserRole } from "@prisma/client";

const READ_TOOLS = [
  "read_akte", "read_akte_detail",
  "read_dokumente", "read_dokumente_detail",
  "read_fristen", "read_zeiterfassung",
  "search_gesetze", "search_urteile", "search_muster",
  "get_kosten_rules", "search_alle_akten", "search_web",
];

const WRITE_TOOLS = [
  "create_draft_dokument", "create_draft_frist",
  "create_notiz", "create_alert",
  "update_akte_rag", "create_draft_zeiterfassung",
];

export function filterToolsByRole(
  tools: Record<string, any>,
  role: UserRole
): Record<string, any> {
  let allowedNames: string[];

  switch (role) {
    case "ADMIN":
    case "ANWALT":
      // Full access
      allowedNames = [...READ_TOOLS, ...WRITE_TOOLS];
      break;
    case "SACHBEARBEITER":
      // All read + limited write (no update_akte_rag)
      allowedNames = [...READ_TOOLS, "create_draft_dokument", "create_draft_frist", "create_notiz", "create_alert", "create_draft_zeiterfassung"];
      break;
    case "SEKRETARIAT":
      // Read-only + create_notiz
      allowedNames = [...READ_TOOLS, "create_notiz"];
      break;
    default:
      allowedNames = READ_TOOLS;
  }

  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => allowedNames.includes(name))
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI SDK `maxToolRoundtrips` | `maxSteps` | AI SDK 3.4 -> 4.0 | `maxSteps` is the current parameter name in v4.3.19 |
| Manual tool loop with prompt threading | `generateText({ maxSteps })` | AI SDK 4.0 | SDK handles message accumulation and step tracking automatically |
| `maxSteps` (v4) | `stopWhen: stepCountIs(N)` (v5+) | AI SDK 5.0 (Oct 2025) | v5 provides richer stop conditions, but we stay on v4.3.19 |
| No tool call repair | `experimental_repairToolCall` | AI SDK ~4.2 | Crucial for Ollama compatibility -- repairs broken tool call JSON |
| `experimental_prepareStep` | `prepareStep` (v5+) | AI SDK 5.0 | In v4.3.19 it's still `experimental_prepareStep` -- use this name |

**Deprecated/outdated:**
- `maxToolRoundtrips` -- replaced by `maxSteps` in AI SDK 4.0
- `experimental_continueSteps` -- removed in AI SDK 5.0, still available in 4.3.19 but not needed
- `ollama-ai-provider` v1 by sgomez -- community reports it as unmaintained (5 months stale), but the project already uses it and it works for the use case. If tool calling issues arise, consider switching to `ai-sdk-ollama` by jagreehal or `ollama-ai-provider-v2`.

## Open Questions

1. **search_web Tool Data Source**
   - What we know: CONTEXT.md lists `search_web` as a read tool for "General web search via search API for current legal info, BGH decisions"
   - What's unclear: No web search API is currently integrated. Would need a search API (Brave Search, SerpAPI, etc.) or Ollama's web search capability.
   - Recommendation: Implement as a stub/placeholder in Phase 20 that returns "Web search not yet configured". Full implementation can be added when a search API is selected. This keeps the tool registry complete without blocking.

2. **Complexity Classifier Training Data**
   - What we know: A lightweight LLM call determines inline vs. background mode and model tier
   - What's unclear: What makes a good classifier prompt? Need examples of simple vs. complex queries.
   - Recommendation: Start with a simple rule-based heuristic (query length, keyword detection for multi-entity queries, presence of "Schriftsatz"/"Entwurf"/"recherchiere") and upgrade to LLM classifier once real usage patterns emerge. Avoids an extra LLM call for every request.

3. **Parallel Tool Call Execution**
   - What we know: AI SDK v4.3.19's `generateText` with `maxSteps` executes tools sequentially by default.
   - What's unclear: Whether the SDK supports parallel execution when the LLM returns multiple tool_calls in one response, or if this needs custom implementation.
   - Recommendation: Check if multiple tool calls in a single step are already executed concurrently by the SDK. If not, wrap tool execute functions with `Promise.all()` in a custom tool middleware. This is a Claude's discretion item.

4. **Token Budget Accuracy for Ollama**
   - What we know: Ollama models report token usage in API responses, but accuracy varies by model.
   - What's unclear: Whether `result.usage.promptTokens` from ollama-ai-provider accurately reflects the actual token count, especially for multi-step runs.
   - Recommendation: Use the SDK's reported `usage` values when available, fall back to character-based estimation. The 75% threshold is conservative enough to handle inaccuracy.

## Sources

### Primary (HIGH confidence)
- AI SDK v4.3.19 TypeScript definitions (`node_modules/ai/dist/index.d.ts`) -- verified `maxSteps`, `experimental_repairToolCall`, `onStepFinish`, `experimental_prepareStep` existence and signatures
- Project codebase: `src/lib/ai/provider.ts`, `src/lib/ai/token-tracker.ts`, `src/lib/rbac.ts`, `prisma/schema.prisma` -- verified all existing infrastructure
- [AI SDK Tool Calling docs](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) -- `tool()` API, multi-step patterns
- [AI SDK generateText reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text) -- complete parameter and return type documentation
- [AI SDK Agent Loop Control](https://ai-sdk.dev/docs/agents/loop-control) -- `stopWhen`, `stepCountIs` (v5+ only, confirmed not in v4)

### Secondary (MEDIUM confidence)
- [AI SDK v4 to v5 Migration Guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0) -- confirmed `maxSteps` is v4, `stopWhen` is v5
- [Ollama qwen3 tool calling issue #11662](https://github.com/ollama/ollama/issues/11662) -- JSON-as-content behavior documented with workarounds
- [AI SDK Agent Building Guide](https://ai-sdk.dev/docs/agents/building-agents) -- recommended patterns for agent construction

### Tertiary (LOW confidence)
- `ai-sdk-ollama` by jagreehal as alternative provider -- reported as more actively maintained, but unverified for this project's specific setup
- Qwen3-coder tool calling regression with many tools (>5) -- reported in Goose issue #6883, may affect qwen3.5:35b but unverified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- verified all libraries exist in package.json and confirmed API shapes via TypeScript definitions
- Architecture: HIGH -- patterns derived directly from AI SDK v4.3.19 type definitions and existing codebase conventions
- Pitfalls: HIGH -- Ollama JSON-as-content issue confirmed via GitHub issue with reproduction steps; other pitfalls derived from codebase analysis
- Tool data sources: HIGH -- all Prisma models and search functions verified in codebase

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable -- AI SDK v4.3.19 is pinned, Prisma schema from Phase 19 is complete)
