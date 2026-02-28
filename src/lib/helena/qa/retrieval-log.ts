import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import type { RetrievalBeleg } from "@/lib/helena/schriftsatz/schemas";

/**
 * SHA-256 hash of query text for PII-safe storage (QA-07).
 * Same query always produces the same hash, enabling correlation
 * without storing raw Mandantendaten in metric logs.
 */
export function hashQuery(queryText: string): string {
  return createHash("sha256").update(queryText).digest("hex");
}

/**
 * Log a retrieval result for a Schriftsatz draft (QA-04).
 */
export async function logRetrieval(params: {
  schriftsatzId: string;
  queryText: string;
  retrievalBelege: RetrievalBeleg[];
  promptVersion: string;
  modell: string;
  recallAt5?: number;
}): Promise<void> {
  const {
    schriftsatzId,
    queryText,
    retrievalBelege,
    promptVersion,
    modell,
    recallAt5,
  } = params;

  await prisma.schriftsatzRetrievalLog.create({
    data: {
      schriftsatzId,
      queryHash: hashQuery(queryText),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      retrievalBelege: retrievalBelege as any, // JSON field
      promptVersion,
      modell,
      recallAt5: recallAt5 ?? null,
    },
  });
}

/**
 * Get retrieval logs for a specific draft.
 */
export async function getRetrievalLogs(schriftsatzId: string) {
  return prisma.schriftsatzRetrievalLog.findMany({
    where: { schriftsatzId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get aggregated retrieval metrics for admin dashboard.
 */
export async function getRetrievalMetricsSummary(opts?: { since?: Date }) {
  const where = opts?.since ? { createdAt: { gte: opts.since } } : {};

  const logs = await prisma.schriftsatzRetrievalLog.findMany({
    where,
    select: { recallAt5: true, retrievalBelege: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const withRecall = logs.filter((l) => l.recallAt5 !== null);
  const avgRecall =
    withRecall.length > 0
      ? withRecall.reduce((sum, l) => sum + (l.recallAt5 ?? 0), 0) /
        withRecall.length
      : 0;

  const noResultCount = logs.filter((l) => {
    const belege = l.retrievalBelege as unknown[];
    return !belege || !Array.isArray(belege) || belege.length === 0;
  }).length;

  return {
    totalLogs: logs.length,
    avgRecallAt5: avgRecall,
    noResultRate: logs.length > 0 ? noResultCount / logs.length : 0,
    logsWithRecall: withRecall.length,
  };
}
