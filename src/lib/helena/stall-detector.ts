/**
 * Stall detection state machine for Helena agent runs.
 *
 * Detects two stall patterns:
 * 1. Duplicate call: Same toolName + params seen 2+ times
 * 2. No new info: Last 3 consecutive steps have identical result hashes
 *
 * When stalled, provides a German force-answer message to inject
 * as a system message, making the LLM summarize and respond.
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StallDetector {
  /** Record a tool call step for stall analysis */
  record(step: {
    toolName: string;
    params: Record<string, unknown>;
    resultHash: string;
  }): void;
  /** Check if a stall pattern has been detected */
  isStalled(): boolean;
  /** German message to inject as system message when stalled */
  getForceMessage(): string;
  /** Reset detector state (e.g., after forced answer) */
  reset(): void;
}

interface RecordedStep {
  toolName: string;
  paramKey: string; // deterministic JSON of sorted params
  resultHash: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sort object keys recursively for deterministic JSON serialization.
 */
function sortedStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return JSON.stringify(obj);
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map((item) => sortedStringify(item)).join(",") + "]";
  }

  const sorted = Object.keys(obj as Record<string, unknown>)
    .sort()
    .map((key) => {
      const val = (obj as Record<string, unknown>)[key];
      return JSON.stringify(key) + ":" + sortedStringify(val);
    });

  return "{" + sorted.join(",") + "}";
}

/**
 * Create a hash for a result value.
 * For small values (< 10KB stringified), compare directly.
 * For larger values, use MD5 hash.
 */
export function hashResult(result: unknown): string {
  const str = typeof result === "string" ? result : JSON.stringify(result ?? "");

  if (str.length < 10_240) {
    return str;
  }

  return createHash("md5").update(str).digest("hex");
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const FORCE_MESSAGE =
  "Du wiederholst dich. Gib jetzt deine beste Antwort mit dem, was du bisher weisst. Fasse zusammen und antworte dem Nutzer.";

/**
 * Create a new stall detector instance.
 *
 * Detection logic:
 * - Duplicate call: Same toolName + same sorted params seen 2+ times
 * - No new info: Last 3 consecutive steps have identical resultHash
 */
export function createStallDetector(): StallDetector {
  let steps: RecordedStep[] = [];

  return {
    record(step) {
      const paramKey = sortedStringify(step.params);
      steps.push({
        toolName: step.toolName,
        paramKey,
        resultHash: step.resultHash,
      });
    },

    isStalled(): boolean {
      if (steps.length < 2) return false;

      // Check 1: Duplicate call (same toolName + params seen 2+ times)
      const callSignatures = new Map<string, number>();
      for (const s of steps) {
        const sig = `${s.toolName}::${s.paramKey}`;
        const count = (callSignatures.get(sig) ?? 0) + 1;
        callSignatures.set(sig, count);
        if (count >= 2) return true;
      }

      // Check 2: No new info (last 3 consecutive steps have identical resultHash)
      if (steps.length >= 3) {
        const lastThree = steps.slice(-3);
        const allSame =
          lastThree[0].resultHash === lastThree[1].resultHash &&
          lastThree[1].resultHash === lastThree[2].resultHash;
        if (allSame) return true;
      }

      return false;
    },

    getForceMessage(): string {
      return FORCE_MESSAGE;
    },

    reset(): void {
      steps = [];
    },
  };
}
