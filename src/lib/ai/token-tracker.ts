/**
 * Token usage tracking and budget enforcement.
 *
 * Tracks AI token consumption per request (function, user, model)
 * and aggregates data for the admin dashboard.
 */

import { prisma } from "@/lib/db";
import { getSettingTyped } from "@/lib/settings/service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AiFunktion = "CHAT" | "SCAN" | "ENTWURF" | "BRIEFING";

interface TrackTokenUsageInput {
  userId: string;
  akteId?: string | null;
  funktion: AiFunktion;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export interface TokenUsageSummary {
  period: "day" | "week" | "month";
  totalTokensIn: number;
  totalTokensOut: number;
  totalTokens: number;
  byFunktion: Record<string, { tokensIn: number; tokensOut: number }>;
  byUser: { userId: string; userName: string; total: number }[];
}

export interface BudgetInfo {
  used: number;
  limit: number;
  percentage: number;
  paused: boolean;
}

// ---------------------------------------------------------------------------
// trackTokenUsage — Insert a usage record
// ---------------------------------------------------------------------------

/**
 * Record token usage after an AI call.
 */
export async function trackTokenUsage(
  input: TrackTokenUsageInput
): Promise<void> {
  await prisma.tokenUsage.create({
    data: {
      userId: input.userId,
      akteId: input.akteId ?? null,
      funktion: input.funktion,
      provider: input.provider,
      model: input.model,
      tokensIn: input.tokensIn,
      tokensOut: input.tokensOut,
    },
  });
}

// ---------------------------------------------------------------------------
// getTokenUsageSummary — Aggregate usage for admin dashboard
// ---------------------------------------------------------------------------

/**
 * Get aggregated token usage for a given period.
 */
export async function getTokenUsageSummary(opts: {
  period: "day" | "week" | "month";
  userId?: string;
}): Promise<TokenUsageSummary> {
  const now = new Date();
  let since: Date;

  switch (opts.period) {
    case "day":
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week": {
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday-based
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
      break;
    }
    case "month":
    default:
      since = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  const where: any = { createdAt: { gte: since } };
  if (opts.userId) where.userId = opts.userId;

  // Fetch all records in the period (grouped queries not great in Prisma, so raw aggregate)
  const records = await prisma.tokenUsage.findMany({
    where,
    include: { user: { select: { id: true, name: true } } },
  });

  let totalTokensIn = 0;
  let totalTokensOut = 0;
  const byFunktion: Record<string, { tokensIn: number; tokensOut: number }> =
    {};
  const userMap: Record<string, { userName: string; total: number }> = {};

  for (const r of records) {
    totalTokensIn += r.tokensIn;
    totalTokensOut += r.tokensOut;

    if (!byFunktion[r.funktion]) {
      byFunktion[r.funktion] = { tokensIn: 0, tokensOut: 0 };
    }
    byFunktion[r.funktion].tokensIn += r.tokensIn;
    byFunktion[r.funktion].tokensOut += r.tokensOut;

    if (!userMap[r.userId]) {
      userMap[r.userId] = { userName: r.user.name, total: 0 };
    }
    userMap[r.userId].total += r.tokensIn + r.tokensOut;
  }

  const byUser = Object.entries(userMap).map(([userId, data]) => ({
    userId,
    userName: data.userName,
    total: data.total,
  }));

  return {
    period: opts.period,
    totalTokensIn,
    totalTokensOut,
    totalTokens: totalTokensIn + totalTokensOut,
    byFunktion,
    byUser,
  };
}

// ---------------------------------------------------------------------------
// checkBudget — Monthly budget enforcement
// ---------------------------------------------------------------------------

/**
 * Check current month's token usage against the monthly budget.
 * Budget of 0 means unlimited.
 */
export async function checkBudget(): Promise<BudgetInfo> {
  const limit = await getSettingTyped<number>("ai.monthly_budget", 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const result = await prisma.tokenUsage.aggregate({
    where: { createdAt: { gte: monthStart } },
    _sum: { tokensIn: true, tokensOut: true },
  });

  const used = (result._sum.tokensIn ?? 0) + (result._sum.tokensOut ?? 0);
  const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0;

  return {
    used,
    limit,
    percentage,
    paused: limit > 0 && percentage >= 100,
  };
}

// ---------------------------------------------------------------------------
// wrapWithTracking — Higher-order function for AI SDK calls
// ---------------------------------------------------------------------------

/**
 * Wraps an AI SDK call result and records token usage.
 * Works with generateText/generateObject results that have usage info.
 */
export async function wrapWithTracking<
  T extends { usage?: { promptTokens?: number; completionTokens?: number } },
>(
  result: T,
  metadata: {
    userId: string;
    akteId?: string | null;
    funktion: AiFunktion;
    provider: string;
    model: string;
  }
): Promise<T> {
  const tokensIn = result.usage?.promptTokens ?? 0;
  const tokensOut = result.usage?.completionTokens ?? 0;

  if (tokensIn > 0 || tokensOut > 0) {
    await trackTokenUsage({
      ...metadata,
      tokensIn,
      tokensOut,
    });
  }

  return result;
}
