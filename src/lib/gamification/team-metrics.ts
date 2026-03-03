/**
 * Team Metrics Service
 *
 * Provides aggregated team-level KPIs for the admin Team Dashboard.
 * All data is team-aggregated (no per-user breakdowns) for DSGVO compliance.
 *
 * Used by: /admin/team-dashboard page (server component) and API route.
 */

import { startOfDay, startOfWeek, subWeeks, format } from "date-fns";
import { de } from "date-fns/locale";

import { prisma } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────────────

export interface BacklogData {
  dataPoints: Array<{ week: string; count: number }>;
  currentCount: number;
  trend: "steigend" | "fallend" | "stabil";
}

export interface BossfightEntry {
  id: string;
  name: string;
  spawnHp: number;
  currentHp: number;
  status: string;
  spawnedAt: string;
  defeatedAt: string | null;
  totalDamage: number;
}

export interface BossfightData {
  activeDamage: number;
  history: BossfightEntry[];
}

export interface TeamMetrics {
  questRate: number;
  backlog: BacklogData;
  bossfight: BossfightData;
}

// ── Quest Fulfillment Rate ─────────────────────────────────────────────────

/**
 * Calculate team-wide quest fulfillment rate for today's daily quests.
 * Returns percentage (0-100) averaged across all opted-in users.
 */
export async function getTeamQuestFulfillmentRate(
  kanzleiId: string,
): Promise<number> {
  // Get opted-in active users with their game profile (class)
  const users = await prisma.user.findMany({
    where: { kanzleiId, gamificationOptIn: true, aktiv: true },
    select: {
      id: true,
      gameProfile: { select: { klasse: true } },
    },
  });

  if (users.length === 0) return 0;

  // Get active daily quests
  const dailyQuests = await prisma.quest.findMany({
    where: { typ: "DAILY", aktiv: true },
    select: { id: true, klasse: true },
  });

  if (dailyQuests.length === 0) return 0;

  // Get today's completions for these users
  const today = startOfDay(new Date());
  const userIds = users.map((u) => u.id);
  const completions = await prisma.questCompletion.findMany({
    where: {
      completedDate: today,
      quest: { typ: "DAILY" },
      userId: { in: userIds },
    },
    select: { userId: true, questId: true },
  });

  // Build completion set for fast lookup
  const completionSet = new Set(
    completions.map((c) => `${c.userId}:${c.questId}`),
  );

  // Calculate per-user fulfillment rate
  let totalRate = 0;

  for (const user of users) {
    const userKlasse = user.gameProfile?.klasse;
    // Available quests: those with no class restriction OR matching user's class
    const available = dailyQuests.filter(
      (q) => q.klasse === null || q.klasse === userKlasse,
    );

    if (available.length === 0) continue;

    const completed = available.filter((q) =>
      completionSet.has(`${user.id}:${q.id}`),
    ).length;

    totalRate += completed / available.length;
  }

  return Math.round((totalRate / users.length) * 100);
}

// ── Backlog Delta History ──────────────────────────────────────────────────

/**
 * Get backlog (open Wiedervorlagen) history for the last N weeks.
 * Includes live current count and trend indicator.
 */
export async function getBacklogDeltaHistory(
  kanzleiId: string,
  weeks: number = 8,
): Promise<BacklogData> {
  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const rangeStart = subWeeks(currentWeekStart, weeks - 1);

  // Current live count
  const currentCount = await prisma.kalenderEintrag.count({
    where: {
      typ: "WIEDERVORLAGE",
      erledigt: false,
      akte: { kanzleiId },
    },
  });

  // Historical snapshots
  const snapshots = await prisma.weeklySnapshot.findMany({
    where: {
      model: "Wiedervorlage",
      weekStart: { gte: rangeStart },
      userId: null,
    },
    orderBy: { weekStart: "asc" },
  });

  // Build data points from snapshots
  const dataPoints: Array<{ week: string; count: number }> = snapshots.map(
    (s) => ({
      week: format(s.weekStart, "dd.MM.", { locale: de }),
      count: s.count,
    }),
  );

  // Append current week as live data point
  dataPoints.push({
    week: format(currentWeekStart, "dd.MM.", { locale: de }),
    count: currentCount,
  });

  // Compute trend from last 2 data points
  let trend: "steigend" | "fallend" | "stabil" = "stabil";
  if (dataPoints.length >= 2) {
    const prev = dataPoints[dataPoints.length - 2].count;
    const curr = dataPoints[dataPoints.length - 1].count;
    const diff = curr - prev;
    if (diff > 0) trend = "steigend";
    else if (diff < 0) trend = "fallend";
  }

  return { dataPoints, currentCount, trend };
}

// ── Bossfight History ──────────────────────────────────────────────────────

/**
 * Get bossfight history for a kanzlei with team damage aggregates.
 * Returns the last 10 bossfights and total active damage.
 */
export async function getBossfightHistory(
  kanzleiId: string,
): Promise<BossfightData> {
  const bossfights = await prisma.bossfight.findMany({
    where: { kanzleiId },
    orderBy: { spawnedAt: "desc" },
    take: 10,
  });

  const history: BossfightEntry[] = [];
  let activeDamage = 0;

  for (const bf of bossfights) {
    const damageAgg = await prisma.bossfightDamage.aggregate({
      where: { bossfightId: bf.id },
      _sum: { amount: true },
    });

    const totalDamage = damageAgg._sum?.amount ?? 0;

    if (bf.status === "ACTIVE") {
      activeDamage += totalDamage;
    }

    history.push({
      id: bf.id,
      name: bf.name,
      spawnHp: bf.spawnHp,
      currentHp: bf.currentHp,
      status: bf.status,
      spawnedAt: bf.spawnedAt.toISOString(),
      defeatedAt: bf.defeatedAt?.toISOString() ?? null,
      totalDamage,
    });
  }

  return { activeDamage, history };
}

// ── Combined ───────────────────────────────────────────────────────────────

/**
 * Fetch all team metrics in parallel.
 */
export async function getTeamMetrics(kanzleiId: string): Promise<TeamMetrics> {
  const [questRate, backlog, bossfight] = await Promise.all([
    getTeamQuestFulfillmentRate(kanzleiId),
    getBacklogDeltaHistory(kanzleiId, 8),
    getBossfightHistory(kanzleiId),
  ]);

  return { questRate, backlog, bossfight };
}
