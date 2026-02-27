/**
 * Helena Agent -- Public API
 *
 * Unified entry point that wires together all Helena agent components:
 * - Rate limiting (per-user per-hour)
 * - Complexity classification (mode + tier selection)
 * - Tool creation with role-based filtering
 * - System prompt construction
 * - ReAct orchestrator with stall detection and token budget
 * - Ollama response guard for broken JSON repair
 * - Auto-escalation on stall (retry with higher tier model)
 *
 * Usage:
 * ```typescript
 * import { runHelenaAgent } from "@/lib/helena";
 *
 * const result = await runHelenaAgent({
 *   prisma, userId, userRole, userName,
 *   akteId: "abc123",
 *   message: "Erstelle einen Schriftsatz fuer die Klage",
 * });
 * ```
 */

import type { PrismaClient, UserRole } from "@prisma/client";
import type { CoreMessage } from "ai";
import { createLogger } from "@/lib/logger";
import { getProviderName, getHelenaUserId } from "@/lib/ai/provider";

// Internal modules
import { createHelenaTools } from "./tools";
import { buildSystemPrompt } from "./system-prompt";
import { runAgent, type AgentRunResult, type StepUpdate, type AgentStep } from "./orchestrator";
import { classifyComplexity, getModelForTier, escalateTier } from "./complexity-classifier";
import { checkRateLimit } from "./rate-limiter";
import { ollamaResponseGuard, contentScanGuard } from "./response-guard";
import {
  runSchriftsatzPipeline,
  isSchriftsatzIntent,
  renderSchriftsatzMarkdown,
} from "./schriftsatz";

const log = createLogger("helena");

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface HelenaAgentOptions {
  prisma: PrismaClient;
  userId: string;
  userRole: UserRole;
  userName: string;
  akteId: string | null;
  /** User's input message */
  message: string;
  /** Prior messages in this conversation */
  conversationHistory?: CoreMessage[];
  /** "auto" = use classifier (default), or explicitly set mode */
  mode?: "inline" | "background" | "auto";
  /** Callback fired after every step with progress info */
  onStepUpdate?: (step: StepUpdate) => void;
  /** For cooperative cancellation */
  abortSignal?: AbortSignal;
  /** HelenaMemory.content if available */
  helenaMemory?: Record<string, unknown> | null;
}

export interface HelenaAgentResult {
  /** Helena's response text */
  text: string;
  /** Actual mode used (resolved from "auto") */
  mode: "inline" | "background";
  /** Model tier used */
  tier: 1 | 2 | 3;
  /** Full trace for HelenaTask.steps */
  steps: AgentStep[];
  totalTokens: { prompt: number; completion: number };
  finishReason: string;
  /** true if inline 5-step cap was hit */
  capReached: boolean;
  /** true if Helena suggests continuing in background */
  continueInBackground?: boolean;
  /** true if rate limit was hit (no agent run performed) */
  rateLimited?: boolean;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run the Helena agent with a user message.
 *
 * This is the primary public API. It handles:
 * 1. Rate limit check (before any other work)
 * 2. Complexity classification (mode + tier)
 * 3. Tool creation with role filtering
 * 4. System prompt construction
 * 5. Model selection for tier
 * 6. ReAct agent execution with Ollama guard
 * 7. Inline cap detection with background continuation offer
 * 8. Auto-escalation on stall (max 1 retry)
 */
export async function runHelenaAgent(
  options: HelenaAgentOptions,
): Promise<HelenaAgentResult> {
  const {
    prisma,
    userId,
    userRole,
    userName,
    akteId,
    message,
    conversationHistory,
    onStepUpdate,
    abortSignal,
    helenaMemory,
  } = options;

  const requestedMode = options.mode ?? "auto";

  // -----------------------------------------------------------------------
  // 1. Rate limit check -- BEFORE any other work
  // -----------------------------------------------------------------------

  const rateLimitResult = await checkRateLimit({ userId, prisma });

  if (!rateLimitResult.allowed) {
    log.info(
      { userId, remaining: rateLimitResult.remaining, limit: rateLimitResult.limit },
      "Rate limit exceeded",
    );

    return {
      text: rateLimitResult.message ?? "Rate limit erreicht.",
      mode: "inline",
      tier: 1,
      steps: [],
      totalTokens: { prompt: 0, completion: 0 },
      finishReason: "rate-limited",
      capReached: false,
      rateLimited: true,
    };
  }

  // -----------------------------------------------------------------------
  // 2. Get Helena system user ID
  // -----------------------------------------------------------------------

  const helenaUserId = (await getHelenaUserId()) ?? "system";

  // -----------------------------------------------------------------------
  // 3. Classify complexity (mode + tier selection)
  // -----------------------------------------------------------------------

  const classification = classifyComplexity(message);

  let actualMode: "inline" | "background";
  let tier = classification.tier;

  if (requestedMode === "auto") {
    actualMode = classification.mode;
  } else {
    // Explicit mode override, but keep tier from classifier
    actualMode = requestedMode;
  }

  log.info(
    {
      mode: actualMode,
      tier,
      reason: classification.reason,
      queryLength: message.length,
    },
    "Complexity classification",
  );

  // -----------------------------------------------------------------------
  // 3b. Check for Schriftsatz intent -- route to deterministic pipeline
  // -----------------------------------------------------------------------

  if (
    akteId &&
    classification.tier === 3 &&
    isSchriftsatzIntent(message)
  ) {
    log.info(
      { akteId, tier: classification.tier },
      "Schriftsatz intent detected -- routing to deterministic pipeline",
    );

    const pipelineResult = await runSchriftsatzPipeline({
      prisma,
      userId,
      userRole,
      userName,
      akteId,
      message,
      abortSignal,
      onStepUpdate: onStepUpdate
        ? (step) => onStepUpdate({
            stepNumber: 0,
            toolName: step.stage,
            description: step.detail,
          })
        : undefined,
    });

    // Map pipeline result to HelenaAgentResult
    if (pipelineResult.status === "needs_input") {
      return {
        text: pipelineResult.rueckfrage ?? "Ich brauche weitere Informationen.",
        mode: actualMode,
        tier: 3,
        steps: [{ type: "thought", content: "Schriftsatz-Pipeline: Rueckfrage", timestamp: Date.now() }],
        totalTokens: pipelineResult.totalTokens,
        finishReason: "needs-input",
        capReached: false,
      };
    }

    if (pipelineResult.status === "error") {
      return {
        text: "Beim Erstellen des Schriftsatzes ist ein Fehler aufgetreten. " +
          (pipelineResult.warnungen[0]?.text ?? "Bitte versuche es erneut."),
        mode: actualMode,
        tier: 3,
        steps: [{ type: "error", content: pipelineResult.warnungen[0]?.text ?? "Pipeline error", timestamp: Date.now() }],
        totalTokens: pipelineResult.totalTokens,
        finishReason: "error",
        capReached: false,
      };
    }

    // Success -- render markdown and return
    const markdown = pipelineResult.schriftsatz
      ? renderSchriftsatzMarkdown(pipelineResult.schriftsatz)
      : "Schriftsatz erstellt.";

    return {
      text: markdown,
      mode: actualMode,
      tier: 3,
      steps: [
        { type: "thought", content: `Schriftsatz-Pipeline: ${pipelineResult.schriftsatz?.klageart} erstellt`, timestamp: Date.now() },
        { type: "toolResult", content: JSON.stringify({ draftId: pipelineResult.draftId, belege: pipelineResult.retrieval_belege.length }), timestamp: Date.now() },
      ],
      totalTokens: pipelineResult.totalTokens,
      finishReason: "complete",
      capReached: false,
    };
  }

  // -----------------------------------------------------------------------
  // 4. Get model for tier
  // -----------------------------------------------------------------------

  let { model, modelName } = await getModelForTier(tier);

  // -----------------------------------------------------------------------
  // 5. Create tools with role-based filtering
  // -----------------------------------------------------------------------

  const tools = createHelenaTools({
    prisma,
    userId,
    userRole,
    akteId,
    helenaUserId,
    abortSignal,
  });

  // -----------------------------------------------------------------------
  // 6. Build system prompt
  // -----------------------------------------------------------------------

  const systemPrompt = buildSystemPrompt({
    tools: Object.keys(tools),
    akteId,
    userName,
    helenaMemory,
  });

  // -----------------------------------------------------------------------
  // 7. Build messages array
  // -----------------------------------------------------------------------

  const messages: CoreMessage[] = [
    ...(conversationHistory ?? []),
    { role: "user", content: message },
  ];

  // -----------------------------------------------------------------------
  // 8. Determine if Ollama guard should be applied
  // -----------------------------------------------------------------------

  const providerName = await getProviderName();
  const repairToolCall =
    providerName === "ollama" ? ollamaResponseGuard : undefined;

  // -----------------------------------------------------------------------
  // 9. Run agent
  // -----------------------------------------------------------------------

  let result = await runAgent({
    model,
    modelName,
    tools,
    systemPrompt,
    messages,
    mode: actualMode,
    userId,
    akteId,
    onStepUpdate,
    abortSignal,
    repairToolCall,
  });

  // -----------------------------------------------------------------------
  // 10. Handle inline cap reached
  // -----------------------------------------------------------------------

  let capReached = false;
  let continueInBackground = false;

  if (
    actualMode === "inline" &&
    (result.finishReason === "length" || result.finishReason === "tool-calls")
  ) {
    capReached = true;
    continueInBackground = true;

    // Append continuation offer in German
    result = {
      ...result,
      text:
        result.text +
        "\n\nIch bin noch nicht fertig. Moechtest du, dass ich im Hintergrund weitermache?",
    };

    log.info(
      { userId, akteId, steps: result.steps.length },
      "Inline cap reached -- offering background continuation",
    );
  }

  // -----------------------------------------------------------------------
  // 11. Auto-escalation on stall
  // -----------------------------------------------------------------------

  if (result.stalled && tier < 3) {
    const nextTier = escalateTier(tier);

    log.info(
      { currentTier: tier, nextTier, userId },
      "Stall detected -- escalating to higher tier model",
    );

    try {
      const escalated = await getModelForTier(nextTier);

      const escalatedResult = await runAgent({
        model: escalated.model,
        modelName: escalated.modelName,
        tools,
        systemPrompt,
        messages: [
          ...messages,
          {
            role: "user",
            content:
              "Der vorherige Versuch war nicht erfolgreich. Bitte versuche es erneut mit einer anderen Herangehensweise.",
          },
        ],
        mode: actualMode,
        userId,
        akteId,
        onStepUpdate,
        abortSignal,
        repairToolCall:
          providerName === "ollama" ? ollamaResponseGuard : undefined,
      });

      if (!escalatedResult.stalled) {
        // Escalation succeeded
        log.info(
          { originalTier: tier, escalatedTier: nextTier },
          "Escalation succeeded",
        );

        return {
          text: escalatedResult.text,
          mode: actualMode,
          tier: nextTier,
          steps: [...result.steps, ...escalatedResult.steps],
          totalTokens: {
            prompt:
              result.totalTokens.prompt + escalatedResult.totalTokens.prompt,
            completion:
              result.totalTokens.completion +
              escalatedResult.totalTokens.completion,
          },
          finishReason: escalatedResult.finishReason,
          capReached: false,
          continueInBackground: false,
        };
      }

      log.warn(
        { originalTier: tier, escalatedTier: nextTier },
        "Escalation also stalled -- returning original result",
      );
    } catch (escalationError: unknown) {
      const errMsg =
        escalationError instanceof Error
          ? escalationError.message
          : String(escalationError);
      log.error(
        { error: errMsg, tier: nextTier },
        "Escalation failed with error",
      );
    }

    // Return original stalled result if escalation failed
    tier = tier; // Keep original tier in result
  }

  // -----------------------------------------------------------------------
  // 12. Return result
  // -----------------------------------------------------------------------

  return {
    text: result.text,
    mode: actualMode,
    tier,
    steps: result.steps,
    totalTokens: result.totalTokens,
    finishReason: result.finishReason,
    capReached,
    continueInBackground: continueInBackground || undefined,
    rateLimited: false,
  };
}

// ---------------------------------------------------------------------------
// Re-exports for public API convenience
// ---------------------------------------------------------------------------

export { createHelenaTools } from "./tools";
export { runAgent } from "./orchestrator";
export { classifyComplexity } from "./complexity-classifier";
export { ollamaResponseGuard } from "./response-guard";
export { checkRateLimit } from "./rate-limiter";

export type { AgentRunOptions, AgentRunResult, StepUpdate, AgentStep } from "./orchestrator";
export type { ToolContext, ToolResult } from "./tools/types";
export type { ComplexityResult } from "./complexity-classifier";
export type { RateLimitResult } from "./rate-limiter";

// Schriftsatz pipeline re-exports
export { runSchriftsatzPipeline, isSchriftsatzIntent } from "./schriftsatz";
export type { SchriftsatzPipelineResult, SchriftsatzPipelineOptions } from "./schriftsatz";
