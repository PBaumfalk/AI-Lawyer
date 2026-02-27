/**
 * Core ReAct agent loop for Helena.
 *
 * Wraps AI SDK v4.3.19's `generateText({ maxSteps })` with:
 * - Bounded step limits (5 inline / 20 background)
 * - Timeout (30s inline / 3min background)
 * - Stall detection (duplicate calls, no-new-info)
 * - Token budget management (FIFO truncation at 75% context window)
 * - Step progress callbacks
 * - Audit logging of every tool call
 * - Abort signal support
 * - Full agent trace capture for HelenaTask.steps JSON
 *
 * AI SDK v4.3.19's generateText with maxSteps already executes
 * multiple tool_calls in a single LLM response concurrently via
 * internal Promise.all -- no additional wrapping needed.
 */

import {
  generateText,
  type CoreMessage,
  type CoreTool,
  type LanguageModel,
  type ToolCallRepairFunction,
  type ToolSet,
} from "ai";
import { createLogger } from "@/lib/logger";
import { logToolCall } from "@/lib/helena/audit-logger";
import { createStallDetector, hashResult } from "@/lib/helena/stall-detector";
import {
  estimateMessagesTokens,
  getContextWindow,
  truncateMessages,
} from "@/lib/helena/token-budget";
import { trackTokenUsage, type AiFunktion } from "@/lib/ai/token-tracker";

const log = createLogger("helena-orchestrator");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentRunOptions {
  model: LanguageModel;
  /** For token budget context window lookup */
  modelName: string;
  tools: Record<string, CoreTool>;
  systemPrompt: string;
  messages: CoreMessage[];
  mode: "inline" | "background";
  userId: string;
  akteId: string | null;
  /** Callback fired after every step with progress info */
  onStepUpdate?: (step: StepUpdate) => void;
  /** For cooperative cancellation */
  abortSignal?: AbortSignal;
  /** Optional experimental_repairToolCall hook (from Plan 03) */
  repairToolCall?: ToolCallRepairFunction<ToolSet>;
}

export interface StepUpdate {
  stepNumber: number;
  maxSteps: number;
  /** null for text-only steps */
  toolName: string | null;
  toolParams?: Record<string, unknown>;
  /** First 200 chars of result */
  resultSummary: string;
  /** Running total token estimate */
  tokenEstimate: number;
}

export interface AgentRunResult {
  /** Final agent response text */
  text: string;
  /** Complete trace for HelenaTask.steps */
  steps: AgentStep[];
  totalTokens: { prompt: number; completion: number };
  /** "stop" | "length" | "tool-calls" | "stall" | "abort" | "timeout" | "error" */
  finishReason: string;
  stalled: boolean;
  /** Whether token budget caused truncation */
  truncated: boolean;
}

export interface AgentStep {
  type: "thought" | "toolCall" | "toolResult" | "error";
  content: string;
  toolName?: string;
  toolParams?: Record<string, unknown>;
  /** ISO string */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Run the Helena ReAct agent loop.
 *
 * Wraps AI SDK generateText with bounded steps, stall detection,
 * token budget truncation, audit logging, and progress callbacks.
 */
export async function runAgent(
  options: AgentRunOptions,
): Promise<AgentRunResult> {
  const {
    model,
    modelName,
    tools,
    systemPrompt,
    messages,
    mode,
    userId,
    akteId,
    onStepUpdate,
    repairToolCall,
  } = options;

  // 1. Determine caps based on mode
  const maxSteps = mode === "inline" ? 5 : 20;
  const timeout = mode === "inline" ? 30_000 : 180_000;

  // 2. Create AbortController combining external signal with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), timeout);

  if (options.abortSignal) {
    if (options.abortSignal.aborted) {
      controller.abort("user-cancel");
    } else {
      options.abortSignal.addEventListener(
        "abort",
        () => controller.abort("user-cancel"),
        { once: true },
      );
    }
  }

  // 3. Create stall detector
  const stallDetector = createStallDetector();

  // 4. Tracking state
  const agentSteps: AgentStep[] = [];
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let stepCounter = 0;
  let stallDetected = false;
  let truncated = false;
  let abortReason: string | null = null;

  // Mutable copy for truncation
  const workingMessages: CoreMessage[] = [...messages];

  // Context window for token budget
  const contextWindow = getContextWindow(modelName);

  try {
    // 6. Call generateText with maxSteps
    const result = await generateText({
      model,
      tools: tools as ToolSet,
      system: systemPrompt,
      messages: workingMessages,
      maxSteps,
      abortSignal: controller.signal,
      experimental_repairToolCall: repairToolCall,
      onStepFinish: async ({
        text,
        toolCalls,
        toolResults,
        usage,
        finishReason,
      }) => {
        stepCounter++;
        const stepTimestamp = new Date().toISOString();

        // a) Aggregate token usage
        totalPromptTokens += usage.promptTokens;
        totalCompletionTokens += usage.completionTokens;

        // b) Record thought step (if LLM produced text)
        if (text) {
          agentSteps.push({
            type: "thought",
            content: text,
            timestamp: stepTimestamp,
          });
        }

        // c) Record tool call steps and audit log
        if (toolCalls && toolCalls.length > 0) {
          for (const tc of toolCalls) {
            const toolParams = (tc.args ?? {}) as Record<string, unknown>;

            agentSteps.push({
              type: "toolCall",
              content: `Calling ${tc.toolName}`,
              toolName: tc.toolName,
              toolParams,
              timestamp: stepTimestamp,
            });

            // Find matching tool result
            // Type assertion needed because ToolSet generic resolves execute return to never
            const typedResults = (toolResults ?? []) as Array<{
              toolCallId: string;
              toolName: string;
              result: unknown;
            }>;
            const matchingResult = typedResults.find(
              (tr) => tr.toolCallId === tc.toolCallId,
            );
            const resultContent = matchingResult
              ? typeof matchingResult.result === "string"
                ? matchingResult.result
                : JSON.stringify(matchingResult.result)
              : "";

            agentSteps.push({
              type: "toolResult",
              content: resultContent.slice(0, 500),
              toolName: tc.toolName,
              timestamp: new Date().toISOString(),
            });

            // Audit log
            const resultSummary = resultContent.slice(0, 200);
            logToolCall({
              toolName: tc.toolName,
              params: toolParams,
              resultSummary,
              userId,
              akteId,
              durationMs: 0, // Duration tracked at tool level, not here
            });

            // Record in stall detector
            const resultHashValue = hashResult(resultContent);
            stallDetector.record({
              toolName: tc.toolName,
              params: toolParams,
              resultHash: resultHashValue,
            });
          }
        }

        // d) Token budget: estimate total, truncate if > 75% window
        const currentTokens = estimateMessagesTokens(workingMessages);
        if (currentTokens > contextWindow * 0.75) {
          const truncatedMsgs = truncateMessages(
            workingMessages,
            contextWindow,
          );
          if (truncatedMsgs.length < workingMessages.length) {
            truncated = true;
            workingMessages.length = 0;
            workingMessages.push(...truncatedMsgs);
            log.info(
              {
                step: stepCounter,
                before: currentTokens,
                after: estimateMessagesTokens(workingMessages),
              },
              "Token budget: truncated messages",
            );
          }
        }

        // e) Fire onStepUpdate callback
        if (onStepUpdate) {
          const firstToolName =
            toolCalls && toolCalls.length > 0 ? toolCalls[0].toolName : null;
          const firstToolParams =
            toolCalls && toolCalls.length > 0
              ? ((toolCalls[0].args ?? {}) as Record<string, unknown>)
              : undefined;
          const summary = text
            ? text.slice(0, 200)
            : toolCalls && toolCalls.length > 0
              ? `Tool: ${toolCalls.map((tc) => tc.toolName).join(", ")}`
              : "Processing...";

          onStepUpdate({
            stepNumber: stepCounter,
            maxSteps,
            toolName: firstToolName,
            toolParams: firstToolParams,
            resultSummary: summary,
            tokenEstimate: totalPromptTokens + totalCompletionTokens,
          });
        }

        // f) Check stall
        if (stallDetector.isStalled() && !stallDetected) {
          stallDetected = true;
          log.warn(
            { step: stepCounter },
            "Stall detected -- injecting force message",
          );

          // Inject force message into working messages so the LLM
          // sees it in the next step and provides a final answer
          workingMessages.push({
            role: "user",
            content: stallDetector.getForceMessage(),
          });
        }
      },
    });

    // 7. Post-processing
    clearTimeout(timeoutId);

    let finalText = result.text;
    let finalFinishReason = stallDetected
      ? "stall"
      : result.finishReason;

    // If maxSteps hit with tool calls still pending
    if (
      result.finishReason === "tool-calls" ||
      (stepCounter >= maxSteps && !finalText)
    ) {
      finalText =
        finalText ||
        "Ich habe die maximale Anzahl an Schritten erreicht. Hier ist meine bisherige Zusammenfassung: " +
          (result.text || "Leider konnte ich keine vollstaendige Antwort generieren.");
      if (!stallDetected) {
        finalFinishReason = "length";
      }
    }

    // 10. Token tracking integration
    if (totalPromptTokens > 0 || totalCompletionTokens > 0) {
      try {
        await trackTokenUsage({
          userId,
          akteId,
          funktion: "CHAT" as AiFunktion,
          provider: modelName.includes("/")
            ? modelName.split("/")[0]
            : "ollama",
          model: modelName,
          tokensIn: totalPromptTokens,
          tokensOut: totalCompletionTokens,
        });
      } catch (trackError) {
        // Non-critical -- log but don't fail the agent run
        log.error(
          { error: trackError },
          "Failed to track token usage",
        );
      }
    }

    return {
      text: finalText,
      steps: agentSteps,
      totalTokens: {
        prompt: totalPromptTokens,
        completion: totalCompletionTokens,
      },
      finishReason: finalFinishReason,
      stalled: stallDetected,
      truncated,
    };
  } catch (error: unknown) {
    // 9. Error handling
    clearTimeout(timeoutId);

    // Determine error type
    const isAbortError =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("abort"));

    if (isAbortError) {
      // Check if it was timeout or user cancel
      abortReason =
        controller.signal.reason === "timeout" ? "timeout" : "abort";
    }

    const errorMessage =
      error instanceof Error ? error.message : String(error);

    log.error(
      {
        error: errorMessage,
        step: stepCounter,
        reason: abortReason,
      },
      "Agent run error",
    );

    // Record error step
    agentSteps.push({
      type: "error",
      content: errorMessage,
      timestamp: new Date().toISOString(),
    });

    // Build partial text from any previous steps
    const partialText = agentSteps
      .filter((s) => s.type === "thought")
      .map((s) => s.content)
      .join("\n\n");

    const fallbackText =
      abortReason === "timeout"
        ? "Die Anfrage hat das Zeitlimit ueberschritten. Hier ist, was ich bisher erarbeitet habe: " +
          (partialText || "Leider konnte ich noch keine Antwort generieren.")
        : abortReason === "abort"
          ? "Die Anfrage wurde abgebrochen."
          : "Ein Fehler ist aufgetreten: " + errorMessage;

    return {
      text: fallbackText,
      steps: agentSteps,
      totalTokens: {
        prompt: totalPromptTokens,
        completion: totalCompletionTokens,
      },
      finishReason: abortReason ?? "error",
      stalled: stallDetected,
      truncated,
    };
  }
}
