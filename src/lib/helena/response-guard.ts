/**
 * Ollama response guard for Helena agent.
 *
 * Two-layer guard that handles common Ollama model issues:
 * 1. ollamaResponseGuard -- AI SDK experimental_repairToolCall hook
 *    that repairs broken JSON in tool call arguments
 * 2. contentScanGuard -- Detects tool-call-shaped JSON embedded
 *    in plain text responses (Ollama sometimes emits tool calls as content)
 */

import type { ToolCallRepairFunction, ToolSet } from "ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("helena-guard");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ContentScanResult {
  detected: boolean;
  toolCalls?: ParsedToolCall[];
}

// ---------------------------------------------------------------------------
// Layer 1: experimental_repairToolCall hook
// ---------------------------------------------------------------------------

/**
 * AI SDK experimental_repairToolCall hook for Ollama models.
 *
 * Attempts to repair common JSON issues in tool call arguments:
 * - Trailing commas before } or ]
 * - Single quotes instead of double quotes
 * - Unquoted keys
 *
 * Returns the repaired tool call or null if repair fails.
 */
export const ollamaResponseGuard: ToolCallRepairFunction<ToolSet> = async ({
  toolCall,
  error,
}) => {
  const rawArgs = toolCall.args;

  log.info(
    { toolName: toolCall.toolName, error: error.message },
    "Attempting tool call repair",
  );

  try {
    // Step 1: Fix trailing commas
    let fixed = rawArgs.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");

    // Step 2: Replace single quotes with double quotes
    // Only if there are no double quotes present (avoid corrupting already valid JSON)
    if (fixed.includes("'") && !fixed.includes('"')) {
      fixed = fixed.replace(/'/g, '"');
    }

    // Step 3: Try to parse the fixed string
    const parsed = JSON.parse(fixed);

    log.info(
      { toolName: toolCall.toolName },
      "Tool call repair succeeded",
    );

    return {
      ...toolCall,
      args: JSON.stringify(parsed),
    };
  } catch {
    // If repair fails, try more aggressive fixes

    try {
      // Attempt: wrap unquoted keys with double quotes
      let aggressive = rawArgs;
      // Remove trailing commas
      aggressive = aggressive.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      // Replace single quotes
      aggressive = aggressive.replace(/'/g, '"');
      // Try to fix unquoted keys: match word chars before colon
      aggressive = aggressive.replace(
        /(\{|,)\s*([a-zA-Z_]\w*)\s*:/g,
        '$1"$2":',
      );

      const parsed = JSON.parse(aggressive);

      log.info(
        { toolName: toolCall.toolName },
        "Tool call repair succeeded (aggressive)",
      );

      return {
        ...toolCall,
        args: JSON.stringify(parsed),
      };
    } catch {
      log.warn(
        { toolName: toolCall.toolName, rawArgs: rawArgs.slice(0, 200) },
        "Tool call repair failed -- skipping this tool call",
      );

      return null;
    }
  }
};

// ---------------------------------------------------------------------------
// Layer 2: Content scan guard
// ---------------------------------------------------------------------------

/**
 * Regex patterns to detect tool-call-shaped JSON in text content.
 *
 * Ollama sometimes emits tool calls as plain text instead of
 * using the proper tool_call format. This scanner detects that.
 */
const TOOL_CALL_PATTERNS = [
  // Single tool call: {"name": "...", "arguments": {...}}
  /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[^}]*\})\s*\}/g,
  // Array of tool calls: [{"name": "...", ...}]
  /\[\s*\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[^}]*\})\s*\}\s*\]/g,
  // Alternative format: {"tool": "...", "input": {...}}
  /\{\s*"tool"\s*:\s*"([^"]+)"\s*,\s*"input"\s*:\s*(\{[^}]*\})\s*\}/g,
];

/**
 * Scan plain text response for tool-call-shaped JSON.
 *
 * When detected, the orchestrator can log a warning. Full re-injection
 * of parsed tool calls is complex and deferred to a future iteration.
 *
 * @param text - The text content to scan
 * @returns Object indicating whether tool calls were detected
 */
export function contentScanGuard(text: string): ContentScanResult {
  if (!text || text.length < 10) {
    return { detected: false };
  }

  const foundCalls: ParsedToolCall[] = [];

  for (const pattern of TOOL_CALL_PATTERNS) {
    // Reset regex state (global flag)
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1];
      const argsStr = match[2];

      try {
        const args = JSON.parse(argsStr);
        foundCalls.push({ name, arguments: args });
      } catch {
        // Could not parse arguments -- still flag as detected
        // but don't include malformed args
        log.debug(
          { name, argsStr: argsStr.slice(0, 100) },
          "Detected tool call in content but failed to parse arguments",
        );
      }
    }
  }

  if (foundCalls.length > 0) {
    log.warn(
      { count: foundCalls.length, toolNames: foundCalls.map((tc) => tc.name) },
      "Detected tool-call-shaped JSON in text content",
    );

    return { detected: true, toolCalls: foundCalls };
  }

  return { detected: false };
}
