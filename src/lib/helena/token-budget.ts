/**
 * Token estimation and FIFO message truncation for Helena agent runs.
 *
 * Provides conservative token estimation (Math.ceil(text.length / 3.5))
 * and FIFO truncation of oldest tool results when approaching 75% of
 * the context window. System messages and the first user message are
 * never removed.
 */

import type { CoreMessage } from "ai";

// ---------------------------------------------------------------------------
// Context window lookup
// ---------------------------------------------------------------------------

/** Known context window sizes by model name (case-insensitive matching) */
const CONTEXT_WINDOWS: Record<string, number> = {
  "qwen3.5:35b": 32_768,
  "gpt-4o": 128_000,
  "claude-sonnet-4-20250514": 200_000,
};

const DEFAULT_CONTEXT_WINDOW = 32_768;

/**
 * Lookup context window size for a given model name.
 * Uses case-insensitive substring matching.
 * Models containing "lfm" get 32768.
 */
export function getContextWindow(modelName: string): number {
  const lower = modelName.toLowerCase();

  // LFM models
  if (lower.includes("lfm")) {
    return 32_768;
  }

  // Exact and substring matching
  for (const [key, value] of Object.entries(CONTEXT_WINDOWS)) {
    if (lower.includes(key.toLowerCase())) {
      return value;
    }
  }

  return DEFAULT_CONTEXT_WINDOW;
}

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/**
 * Approximate token count for a text string.
 * Conservative estimate: ~3.5 chars per token for mixed German/English text.
 * If input is not a string, JSON.stringify it first.
 */
export function estimateTokens(text: unknown): number {
  const str = typeof text === "string" ? text : JSON.stringify(text ?? "");
  return Math.ceil(str.length / 3.5);
}

/**
 * Extract text content from a CoreMessage for token estimation.
 */
function getMessageTextContent(message: CoreMessage): string {
  const { content } = message;

  // String content (most common for system/user/assistant)
  if (typeof content === "string") {
    return content;
  }

  // Array content (multi-part messages)
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "object" && part !== null) {
          if ("text" in part && typeof part.text === "string") {
            return part.text;
          }
          if ("toolName" in part) {
            // Tool call part
            return JSON.stringify(part);
          }
          if ("result" in part) {
            // Tool result part
            return typeof part.result === "string"
              ? part.result
              : JSON.stringify(part.result);
          }
          // Other structured content (image, etc.)
          return JSON.stringify(part);
        }
        return String(part);
      })
      .join(" ");
  }

  return JSON.stringify(content ?? "");
}

/**
 * Estimate total tokens across an array of CoreMessages.
 * Adds ~4 tokens per message for role/metadata overhead.
 */
export function estimateMessagesTokens(messages: CoreMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    const textContent = getMessageTextContent(msg);
    total += estimateTokens(textContent) + 4; // +4 for role/metadata overhead
  }
  return total;
}

// ---------------------------------------------------------------------------
// FIFO message truncation
// ---------------------------------------------------------------------------

/**
 * FIFO truncation of messages to stay within token budget.
 *
 * Strategy:
 * 1. Calculate threshold as contextWindow * budgetPercent (default 75%)
 * 2. If total tokens < threshold, return unchanged
 * 3. Keep: all system messages, first user message, last 3 messages
 * 4. Remove oldest tool-result messages first (largest), then oldest assistant messages
 * 5. Never remove system or the original user message
 *
 * @returns A new array of messages (does not mutate input)
 */
export function truncateMessages(
  messages: CoreMessage[],
  contextWindow: number,
  budgetPercent?: number,
): CoreMessage[] {
  const threshold = contextWindow * (budgetPercent ?? 0.75);
  const totalTokens = estimateMessagesTokens(messages);

  if (totalTokens <= threshold) {
    return messages;
  }

  // Identify protected messages
  const systemMessages: Array<{ index: number; msg: CoreMessage }> = [];
  let firstUserIndex = -1;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "system") {
      systemMessages.push({ index: i, msg });
    }
    if (msg.role === "user" && firstUserIndex === -1) {
      firstUserIndex = i;
    }
  }

  // Protected indices: system messages, first user message, last 3 messages
  const protectedIndices = new Set<number>();

  for (const { index } of systemMessages) {
    protectedIndices.add(index);
  }
  if (firstUserIndex >= 0) {
    protectedIndices.add(firstUserIndex);
  }

  // Protect last 3 messages
  const lastThreeStart = Math.max(0, messages.length - 3);
  for (let i = lastThreeStart; i < messages.length; i++) {
    protectedIndices.add(i);
  }

  // Build removal candidates, prioritizing tool results first, then assistant
  const toolResultCandidates: number[] = [];
  const assistantCandidates: number[] = [];
  const otherCandidates: number[] = [];

  for (let i = 0; i < messages.length; i++) {
    if (protectedIndices.has(i)) continue;

    const msg = messages[i];
    if (msg.role === "tool") {
      toolResultCandidates.push(i);
    } else if (msg.role === "assistant") {
      assistantCandidates.push(i);
    } else {
      otherCandidates.push(i);
    }
  }

  // Remove from oldest first: tool results, then assistants, then others
  const removalOrder = [
    ...toolResultCandidates,
    ...assistantCandidates,
    ...otherCandidates,
  ];
  const removedIndices = new Set<number>();

  // Iteratively remove until under threshold
  let currentTokens = totalTokens;

  for (const idx of removalOrder) {
    if (currentTokens <= threshold) break;

    const msgTokens =
      estimateTokens(getMessageTextContent(messages[idx])) + 4;
    removedIndices.add(idx);
    currentTokens -= msgTokens;
  }

  // Build result array
  return messages.filter((_, i) => !removedIndices.has(i));
}
