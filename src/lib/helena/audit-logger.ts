/**
 * Tool call audit trail logging.
 *
 * Logs structured JSON entries for every Helena tool invocation.
 * NEVER logs full tool results (could contain PII) -- only a
 * truncated summary.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("helena-audit");

export interface LogToolCallInput {
  toolName: string;
  params: Record<string, unknown>;
  resultSummary: string;
  userId: string;
  akteId: string | null;
  durationMs: number;
}

/**
 * Log a Helena tool call for audit trail.
 * Result summary is truncated to 200 chars to avoid PII leakage.
 */
export function logToolCall(input: LogToolCallInput): void {
  const summary =
    input.resultSummary.length > 200
      ? input.resultSummary.slice(0, 200) + "..."
      : input.resultSummary;

  log.info(
    {
      toolName: input.toolName,
      params: input.params,
      resultSummary: summary,
      userId: input.userId,
      akteId: input.akteId,
      durationMs: input.durationMs,
    },
    `helena tool call: ${input.toolName}`,
  );
}
