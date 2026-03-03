/**
 * Badge Evaluation Service
 *
 * Evaluates badge thresholds against real DB data on page load (lazy).
 * Newly earned badges are persisted atomically to the UserGameProfile
 * badges JSON array. Badges are never revoked.
 */

import { prisma } from "@/lib/db";
import { BADGE_CATALOG, type BadgeDefinition } from "./badge-catalog";
import type { BossTrophy } from "./types";

export interface EarnedBadge {
  slug: string;
  earnedAt: string; // ISO date string
}

/**
 * Evaluate all badge thresholds for a user. Lazy evaluation on page load.
 * Newly earned badges are persisted atomically.
 * Returns the full list of earned badges.
 */
export async function evaluateBadges(userId: string): Promise<EarnedBadge[]> {
  const profile = await prisma.userGameProfile.findUnique({
    where: { userId },
    select: { badges: true, trophies: true, streakTage: true },
  });
  if (!profile) return [];

  const existingBadges = (profile.badges as EarnedBadge[] | null) ?? [];
  const newBadges: EarnedBadge[] = [];

  // Evaluate each badge in parallel using Promise.all to avoid N+1
  const results = await Promise.all(
    BADGE_CATALOG.map(async (def) => {
      // Skip already earned badges
      if (existingBadges.some((b) => b.slug === def.slug)) return null;
      const earned = await checkThreshold(def, userId, profile);
      if (earned) {
        return { slug: def.slug, earnedAt: new Date().toISOString() };
      }
      return null;
    }),
  );

  for (const result of results) {
    if (result) newBadges.push(result);
  }

  // Persist newly earned badges atomically
  if (newBadges.length > 0) {
    const allBadges = [...existingBadges, ...newBadges];
    await prisma.userGameProfile.update({
      where: { userId },
      data: { badges: allBadges },
    });
  }

  return [...existingBadges, ...newBadges];
}

async function checkThreshold(
  def: BadgeDefinition,
  userId: string,
  profile: { trophies: unknown; streakTage: number },
): Promise<boolean> {
  switch (def.type) {
    case "streak":
      return profile.streakTage >= def.threshold;

    case "trophy": {
      const trophies = (profile.trophies as BossTrophy[] | null) ?? [];
      const trophyCount = trophies.filter(
        (t) => t.type === "BOSS_VICTORY",
      ).length;
      return trophyCount >= def.threshold;
    }

    case "count":
    default:
      return await checkCountThreshold(def, userId);
  }
}

async function checkCountThreshold(
  def: BadgeDefinition,
  userId: string,
): Promise<boolean> {
  if (!def.model) return false;

  // Special case: aggregate sum (runensammler)
  if (def.where?._aggregate === "runenVerdient" && def.where?._sum) {
    const result = await prisma.questCompletion.aggregate({
      where: { userId },
      _sum: { runenVerdient: true },
    });
    return (result._sum.runenVerdient ?? 0) >= def.threshold;
  }

  // Special case: distinct count (teamkaempfer)
  if (def.where?._distinct) {
    const field = def.where._distinct as string;
    const result = await prisma.bossfightDamage.findMany({
      where: { userId },
      distinct: [field as "bossfightId"],
      select: { bossfightId: true },
    });
    return result.length >= def.threshold;
  }

  // Standard count: use the model name to build a dynamic count query
  // Since Prisma does not support dynamic model access, use a switch
  const count = await getModelCount(def.model, userId, def.where ?? {});
  return count >= def.threshold;
}

async function getModelCount(
  model: string,
  userId: string,
  where: Record<string, unknown>,
): Promise<number> {
  // Filter out special marker keys
  const cleanWhere = Object.fromEntries(
    Object.entries(where).filter(([k]) => !k.startsWith("_")),
  );

  switch (model) {
    case "KalenderEintrag":
      return prisma.kalenderEintrag.count({
        where: { ...cleanWhere, verantwortlichId: userId },
      });
    case "AktenActivity":
      return prisma.aktenActivity.count({
        where: { ...cleanWhere, userId },
      });
    case "QuestCompletion":
      return prisma.questCompletion.count({
        where: { ...cleanWhere, userId },
      });
    default:
      return 0;
  }
}
