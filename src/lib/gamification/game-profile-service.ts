/**
 * GameProfile Service
 *
 * XP/Level progression, Runen tracking, streak calculation, and
 * GameProfile CRUD with opt-in creation.
 *
 * Pure functions (getRequiredXp, getLevelForXp, getLevelTitle, getStreakMultiplier)
 * have no DB dependency and are easily testable.
 *
 * DB functions use the extended Prisma client for atomic operations.
 */

import { isSaturday, isSunday, startOfDay, subDays } from "date-fns";
import type { UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { istFeiertag } from "@/lib/fristen/feiertage";
import type { BundeslandCode } from "@/lib/fristen/types";
import { getSettingTyped } from "@/lib/settings/service";
import {
  LEVEL_TIERS,
  LEVEL_TITLES,
  STREAK_BONUSES,
  roleToKlasse,
  type BossTrophy,
} from "./types";

// ─── Pure Functions ─────────────────────────────────────────────────────────

/**
 * Get cumulative XP required to reach a given level.
 *
 * Tiered progression:
 *   Level  1-10: 300 XP per level (9 transitions to reach L10 = 2700)
 *   Level 11-20: 500 XP per level
 *   Level 21+:   800 XP per level
 */
export function getRequiredXp(level: number): number {
  if (level <= 1) return 0;

  let totalXp = 0;
  let currentLevel = 1;

  for (const tier of LEVEL_TIERS) {
    const tierMax = tier.maxLevel === Infinity ? level : tier.maxLevel;
    const levelsInTier = Math.min(level - 1, tierMax) - (currentLevel - 1);
    if (levelsInTier <= 0) break;
    totalXp += levelsInTier * tier.xpPerLevel;
    currentLevel += levelsInTier;
    if (currentLevel >= level) break;
  }

  return totalXp;
}

/**
 * Get level for a given XP amount. Inverse of getRequiredXp, capped at 50.
 */
export function getLevelForXp(xp: number): number {
  let level = 1;
  while (level < 50 && getRequiredXp(level + 1) <= xp) {
    level++;
  }
  return level;
}

/**
 * Get sachlich level title for display.
 */
export function getLevelTitle(level: number): string {
  for (const entry of LEVEL_TITLES) {
    if (level <= entry.maxLevel) return entry.title;
  }
  // Fallback for levels beyond defined titles (shouldn't happen with Infinity)
  return LEVEL_TITLES[LEVEL_TITLES.length - 1].title;
}

/**
 * Get Runen streak multiplier. Higher streaks give higher bonuses.
 * STREAK_BONUSES is sorted descending by minDays, so first match wins.
 */
export function getStreakMultiplier(streakDays: number): number {
  for (const bonus of STREAK_BONUSES) {
    if (streakDays >= bonus.minDays) return bonus.multiplier;
  }
  return 1.0;
}

// ─── DB Functions ───────────────────────────────────────────────────────────

/**
 * Get or create a GameProfile for a user. Uses roleToKlasse for class
 * assignment at creation time.
 */
export async function getOrCreateGameProfile(userId: string, role: UserRole) {
  const existing = await prisma.userGameProfile.findUnique({
    where: { userId },
  });
  if (existing) return existing;

  return prisma.userGameProfile.create({
    data: {
      userId,
      klasse: roleToKlasse(role),
    },
  });
}

/**
 * Award XP and Runen atomically using Prisma increment.
 * Streak multiplier is applied to Runen only.
 * Returns the updated profile (use return value directly -- no separate read).
 */
export async function awardRewards(
  userId: string,
  xpReward: number,
  runenReward: number,
  streakMultiplier: number,
) {
  const updated = await prisma.userGameProfile.update({
    where: { userId },
    data: {
      xp: { increment: xpReward },
      runen: { increment: Math.round(runenReward * streakMultiplier) },
    },
  });
  // Use `updated.xp` directly for level calculation -- no separate read needed
  return updated;
}

/**
 * Award a boss victory trophy to a user's GameProfile.
 * Appends to the trophies JSON array.
 */
export async function awardTrophy(userId: string, trophy: BossTrophy): Promise<void> {
  const profile = await prisma.userGameProfile.findUnique({
    where: { userId },
    select: { trophies: true },
  });
  if (!profile) return;

  const existing = (profile.trophies as BossTrophy[] | null) ?? [];
  // Prevent duplicate trophy for the same bossfight
  if (existing.some((t) => t.bossfightId === trophy.bossfightId)) return;

  await prisma.userGameProfile.update({
    where: { userId },
    data: {
      trophies: [...existing, trophy],
    },
  });
}

/**
 * Check if a date is a workday (not weekend, not holiday, not vacation).
 */
async function isWorkday(
  date: Date,
  userId: string,
  bundesland: BundeslandCode,
): Promise<boolean> {
  if (isSaturday(date) || isSunday(date)) return false;
  if (istFeiertag(date, bundesland)) return false;

  // Check UrlaubZeitraum for vacation freeze
  const dayStart = startOfDay(date);
  const vacation = await prisma.urlaubZeitraum.findFirst({
    where: {
      userId,
      von: { lte: dayStart },
      bis: { gte: dayStart },
    },
  });
  return !vacation;
}

/**
 * Calculate current streak: consecutive workdays with at least one
 * QuestCompletion. Skips weekends, holidays (feiertagejs), and vacation
 * (UrlaubZeitraum). Max lookback: 365 days.
 */
export async function calculateStreak(userId: string): Promise<number> {
  const bundesland = await getSettingTyped<BundeslandCode>(
    "kanzlei.bundesland",
    "NW" as BundeslandCode,
  );

  let streak = 0;
  let checkDate = startOfDay(new Date());

  for (let i = 0; i < 365; i++) {
    const isWork = await isWorkday(checkDate, userId, bundesland);

    if (isWork) {
      const dayStart = startOfDay(checkDate);
      const dayEnd = new Date(dayStart.getTime() + 86_400_000);

      const completion = await prisma.questCompletion.findFirst({
        where: {
          userId,
          completedAt: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
      });

      if (completion) {
        streak++;
      } else {
        // Check for available streak-schutz perk (unused, activated, perkType match)
        const schutz = await prisma.userInventoryItem.findFirst({
          where: {
            userId,
            verbraucht: true,
            usedForDate: null, // Not yet consumed for a date
            shopItem: {
              metadata: {
                path: ["perkType"],
                equals: "streak-schutz",
              },
            },
          },
          orderBy: { activatedAt: "asc" }, // FIFO: consume oldest first
        });

        if (schutz) {
          // Mark as used for this specific date
          await prisma.userInventoryItem.update({
            where: { id: schutz.id },
            data: { usedForDate: startOfDay(checkDate) },
          });
          streak++; // Streak continues -- gap is protected

          // Notify user via Socket.IO (informational, not critical)
          try {
            const { getSocketEmitter } = await import("@/lib/socket/emitter");
            getSocketEmitter()
              .to(`user:${userId}`)
              .emit("gamification:streak-schutz-used", {
                savedDate: startOfDay(checkDate).toISOString(),
              });
          } catch {
            // Socket emit is best-effort -- don't break streak calculation
          }
        } else {
          break; // No protection available -- streak ends
        }
      }
    }
    // Non-workdays (weekend, holiday, vacation) are simply skipped

    checkDate = subDays(checkDate, 1);
  }

  return streak;
}

/**
 * Update the user's streak in their GameProfile.
 * Calls calculateStreak and persists the result.
 */
export async function updateStreak(userId: string): Promise<void> {
  const streakTage = await calculateStreak(userId);

  await prisma.userGameProfile.update({
    where: { userId },
    data: {
      streakTage,
      streakLetzte: new Date(),
    },
  });
}
