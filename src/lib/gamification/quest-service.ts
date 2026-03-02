/**
 * Quest Service - Quest Check Orchestrator
 *
 * Evaluates all active daily quests for a user, awards XP+Runen for
 * newly completed ones (with dedup), and updates streak.
 *
 * Fire-and-forget pattern: enqueueQuestCheck() is the entry point for
 * business routes. It never blocks the business action.
 *
 * PITFALL AVOIDANCE:
 * - Always checks QuestCompletion before awarding to prevent double-counting (Pitfall 5)
 * - Uses atomic increment for XP/Runen (Pitfall 4)
 * - Uses return value of update() for level calculation (Pitfall 4)
 */

import { startOfDay } from "date-fns";

import { prisma } from "@/lib/db";
import type { QuestCondition } from "./types";
import { evaluateQuestCondition } from "./quest-evaluator";
import {
  getOrCreateGameProfile,
  getStreakMultiplier,
  awardRewards,
  updateStreak,
} from "./game-profile-service";

/**
 * Main entry point: evaluate all active DAILY quests for a user.
 *
 * 1. Check if user has gamificationOptIn enabled
 * 2. Load/create GameProfile
 * 3. Evaluate each active DAILY quest condition
 * 4. For completed quests, check for existing completion today (dedup)
 * 5. Award XP+Runen with streak multiplier for newly completed quests
 * 6. Update streak after processing all quests
 */
export async function checkQuestsForUser(userId: string): Promise<void> {
  // Check opt-in status
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gamificationOptIn: true, role: true },
  });

  if (!user?.gamificationOptIn) return;

  // Get or create GameProfile
  const profile = await getOrCreateGameProfile(userId, user.role);

  // Load all active DAILY quests
  const quests = await prisma.quest.findMany({
    where: { typ: "DAILY", aktiv: true },
    orderBy: { sortierung: "asc" },
  });

  const today = startOfDay(new Date());

  for (const quest of quests) {
    const condition = quest.bedingung as unknown as QuestCondition;

    // Evaluate quest condition against real data
    const result = await evaluateQuestCondition(condition, userId);

    if (!result.completed) continue;

    // Dedup: check if already awarded today
    const existing = await prisma.questCompletion.findFirst({
      where: {
        userId,
        questId: quest.id,
        completedAt: { gte: today },
      },
    });

    if (existing) continue; // Already awarded today

    // Calculate streak multiplier and award rewards
    const streakMultiplier = getStreakMultiplier(profile.streakTage);
    await awardRewards(
      userId,
      quest.xpBelohnung,
      quest.runenBelohnung,
      streakMultiplier,
    );

    // Record completion
    await prisma.questCompletion.create({
      data: {
        userId,
        questId: quest.id,
        xpVerdient: quest.xpBelohnung,
        runenVerdient: Math.round(quest.runenBelohnung * streakMultiplier),
      },
    });
  }

  // After processing all quests, update streak
  await updateStreak(userId);
}

/**
 * Fire-and-forget quest check entry point for business routes.
 *
 * Calls checkQuestsForUser and silently catches any errors.
 * NEVER blocks the calling business action.
 *
 * Will be replaced by BullMQ queue.add() in Plan 03 for better
 * isolation and retry semantics.
 */
export function enqueueQuestCheck(userId: string): void {
  // Will be replaced by BullMQ queue.add() in Plan 03
  checkQuestsForUser(userId).catch(() => {
    // Fire-and-forget: never block business logic
  });
}
