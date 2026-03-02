/**
 * Quest Condition DSL Evaluator
 *
 * Translates QuestCondition JSON into Prisma COUNT queries against real
 * business data. Each quest condition specifies a model, where-clause,
 * date field, user field, target count, and period.
 *
 * Supports two condition types:
 * - "count" (default): Absolute count within a date range
 * - "delta": Compares current count against WeeklySnapshot baseline
 *
 * PITFALL AVOIDANCE:
 * - For Fristen: uses dateField="erledigtAm" (when completed), NOT "datum" (deadline date)
 * - For Rechnung: userField is null, scoped via Akte relation (anwaltId/sachbearbeiterId)
 * - Model dispatch uses explicit switch (NOT dynamic prisma[model]) for type safety
 * - Existing quests without `type` field are treated as "count" (backward compat)
 */

import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";

import { prisma } from "@/lib/db";
import type {
  QuestCondition,
  CountCondition,
  DeltaCondition,
  QuestModel,
  QuestPeriod,
} from "./types";

// ─── Date Range Calculation ─────────────────────────────────────────────────

/**
 * Calculate the date range for a given period relative to a reference date.
 * Uses date-fns for timezone-safe, DST-aware calculations.
 */
function getDateRange(
  period: Exclude<QuestPeriod, "campaign">,
  date: Date,
): { gte: Date; lte: Date } {
  switch (period) {
    case "today":
      return { gte: startOfDay(date), lte: endOfDay(date) };
    case "thisWeek":
      return {
        gte: startOfWeek(date, { weekStartsOn: 1 }),
        lte: endOfWeek(date, { weekStartsOn: 1 }),
      };
    case "thisMonth":
      return { gte: startOfMonth(date), lte: endOfMonth(date) };
    default:
      throw new Error(`Unknown quest period: ${period}`);
  }
}

// ─── Model Dispatch ─────────────────────────────────────────────────────────

/**
 * Count records for a given model using an explicit switch dispatch.
 * ANTI-PATTERN: Never use dynamic prisma[model] -- TypeScript cannot type-check it.
 */
async function countForModel(
  model: QuestModel,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  where: Record<string, any>,
): Promise<number> {
  switch (model) {
    case "KalenderEintrag":
      return prisma.kalenderEintrag.count({ where });
    case "Ticket":
      return prisma.ticket.count({ where });
    case "Rechnung":
      return prisma.rechnung.count({ where });
    case "AktenActivity":
      return prisma.aktenActivity.count({ where });
    default:
      throw new Error(`Unknown quest model: ${model}`);
  }
}

// ─── Evaluator ──────────────────────────────────────────────────────────────

/**
 * Evaluate a quest condition against real Prisma data.
 *
 * Branches on condition type:
 * - "count" (default): Counts records within a date range
 * - "delta": Compares against WeeklySnapshot baseline
 *
 * @param condition - The QuestCondition DSL from Quest.bedingung
 * @param userId - The user to evaluate for
 * @param date - Reference date (defaults to now)
 * @param questDateRange - Custom date range for SPECIAL quest campaign period
 * @returns { current, target, completed }
 */
export async function evaluateQuestCondition(
  condition: QuestCondition,
  userId: string,
  date: Date = new Date(),
  questDateRange?: { start: Date; end: Date },
): Promise<{ current: number; target: number; completed: boolean }> {
  const conditionType = condition.type ?? "count";

  if (conditionType === "delta") {
    return evaluateDeltaCondition(condition as DeltaCondition, userId);
  }

  return evaluateCountCondition(
    condition as CountCondition,
    userId,
    date,
    questDateRange,
  );
}

// ─── Count Condition Evaluator ──────────────────────────────────────────────

/**
 * Evaluate a standard count-based condition.
 * Counts records matching the condition within a date range.
 */
async function evaluateCountCondition(
  condition: CountCondition,
  userId: string,
  date: Date,
  questDateRange?: { start: Date; end: Date },
): Promise<{ current: number; target: number; completed: boolean }> {
  let dateRange: { gte: Date; lte: Date };

  if (condition.period === "campaign" && questDateRange) {
    dateRange = { gte: questDateRange.start, lte: questDateRange.end };
  } else {
    dateRange = getDateRange(
      condition.period as Exclude<QuestPeriod, "campaign">,
      date,
    );
  }

  // Build where clause: merge static condition + date range + user scope
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    ...condition.where,
    [condition.dateField]: { gte: dateRange.gte, lte: dateRange.lte },
  };

  // Apply user scoping
  if (condition.userField) {
    where[condition.userField] = userId;
  }

  // Special case: Rechnung has no direct userField, scope via Akte relation
  if (condition.model === "Rechnung" && !condition.userField) {
    where.akte = {
      OR: [{ anwaltId: userId }, { sachbearbeiterId: userId }],
    };
  }

  const current = await countForModel(condition.model, where);

  return {
    current,
    target: condition.count,
    completed: current >= condition.count,
  };
}

// ─── Delta Condition Evaluator ──────────────────────────────────────────────

/**
 * Evaluate a delta/ratio condition for weekly aggregate goals.
 * Compares current count against a WeeklySnapshot baseline taken at week start.
 *
 * Example: "reduce open tickets by 20%" compares current open tickets
 * against the snapshot from Monday 00:00.
 */
async function evaluateDeltaCondition(
  condition: DeltaCondition,
  userId: string,
): Promise<{ current: number; target: number; completed: boolean }> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  // Get baseline from WeeklySnapshot
  const snapshot = await prisma.weeklySnapshot.findFirst({
    where: {
      model: condition.model,
      weekStart,
      userId: condition.userField ? userId : null,
    },
  });

  if (!snapshot) {
    // No baseline yet -- cannot evaluate (cron hasn't run yet)
    return { current: 0, target: 0, completed: false };
  }

  const baseline = snapshot.count;

  // Build where for current count (open items, NOT date-scoped)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentWhere: Record<string, any> = { ...condition.where };
  if (condition.userField) {
    currentWhere[condition.userField] = userId;
  }
  if (condition.model === "Rechnung" && !condition.userField) {
    currentWhere.akte = {
      OR: [{ anwaltId: userId }, { sachbearbeiterId: userId }],
    };
  }

  const currentCount = await countForModel(condition.model, currentWhere);

  if (condition.direction === "decrease") {
    const targetReduction = Math.ceil((baseline * condition.percent) / 100);
    const actualReduction = Math.max(0, baseline - currentCount);
    return {
      current: actualReduction,
      target: targetReduction,
      completed: actualReduction >= targetReduction,
    };
  }

  // "increase" direction
  const targetIncrease = Math.ceil((baseline * condition.percent) / 100);
  const actualIncrease = Math.max(0, currentCount - baseline);
  return {
    current: actualIncrease,
    target: targetIncrease,
    completed: actualIncrease >= targetIncrease,
  };
}
