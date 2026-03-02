/**
 * Quest Condition DSL Evaluator
 *
 * Translates QuestCondition JSON into Prisma COUNT queries against real
 * business data. Each quest condition specifies a model, where-clause,
 * date field, user field, target count, and period.
 *
 * PITFALL AVOIDANCE:
 * - For Fristen: uses dateField="erledigtAm" (when completed), NOT "datum" (deadline date)
 * - For Rechnung: userField is null, scoped via Akte relation (anwaltId/sachbearbeiterId)
 * - Model dispatch uses explicit switch (NOT dynamic prisma[model]) for type safety
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
import type { QuestCondition, QuestModel, QuestPeriod } from "./types";

// ─── Date Range Calculation ─────────────────────────────────────────────────

/**
 * Calculate the date range for a given period relative to a reference date.
 * Uses date-fns for timezone-safe, DST-aware calculations.
 */
function getDateRange(
  period: QuestPeriod,
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
 * Builds a where-clause from the condition's fields, adds date-range filtering,
 * applies user scoping, and runs a COUNT query.
 *
 * @param condition - The QuestCondition DSL from Quest.bedingung
 * @param userId - The user to evaluate for
 * @param date - Reference date (defaults to now)
 * @returns { current, target, completed }
 */
export async function evaluateQuestCondition(
  condition: QuestCondition,
  userId: string,
  date: Date = new Date(),
): Promise<{ current: number; target: number; completed: boolean }> {
  const dateRange = getDateRange(condition.period, date);

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
