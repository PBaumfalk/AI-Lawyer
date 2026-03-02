/**
 * Quest Service - Quest Check Orchestrator
 *
 * Evaluates all active quests (DAILY, WEEKLY, SPECIAL) for a user,
 * awards XP+Runen for newly completed ones (with type-aware dedup),
 * and updates streak.
 *
 * Fire-and-forget pattern: enqueueQuestCheck() is the entry point for
 * business routes. It never blocks the business action.
 *
 * PITFALL AVOIDANCE:
 * - Always checks QuestCompletion before awarding to prevent double-counting (Pitfall 5)
 * - Uses atomic increment for XP/Runen (Pitfall 4)
 * - Uses return value of update() for level calculation (Pitfall 4)
 * - Weekly quests use startOfWeek dedup (not startOfDay) to prevent 7x awards (Pitfall 1)
 * - SPECIAL quests use startDatum dedup (one completion per campaign)
 */

import { startOfDay, startOfWeek } from "date-fns";

import { prisma } from "@/lib/db";
import { gamificationQueue } from "@/lib/queue/queues";
import type { QuestCondition } from "./types";
import { evaluateQuestCondition } from "./quest-evaluator";
import {
  getOrCreateGameProfile,
  getStreakMultiplier,
  awardRewards,
  updateStreak,
} from "./game-profile-service";

/**
 * Main entry point: evaluate all active quests for a user.
 *
 * 1. Check if user has gamificationOptIn enabled
 * 2. Load/create GameProfile
 * 3. Load all active quests filtered by user's SpielKlasse
 * 4. Evaluate each quest condition (DAILY, WEEKLY, SPECIAL)
 * 5. For completed quests, check for existing completion (type-aware dedup)
 * 6. Award XP+Runen with streak multiplier for newly completed quests
 * 7. Update streak after processing all quests
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
  const userKlasse = profile.klasse;
  const now = new Date();

  // Load all active quests matching user's class
  const quests = await prisma.quest.findMany({
    where: {
      aktiv: true,
      OR: [
        { klasse: null }, // Universal quests
        { klasse: userKlasse }, // Class-specific quests
      ],
    },
    orderBy: { sortierung: "asc" },
  });

  for (const quest of quests) {
    // Skip SPECIAL quests outside their date range
    if (quest.typ === "SPECIAL") {
      if (quest.startDatum && quest.startDatum > now) continue;
      if (quest.endDatum && quest.endDatum < now) continue;
    }

    const condition = quest.bedingung as unknown as QuestCondition;

    // Build campaign date range for SPECIAL quests
    const questDateRange =
      quest.typ === "SPECIAL" && quest.startDatum && quest.endDatum
        ? { start: quest.startDatum, end: quest.endDatum }
        : undefined;

    // Evaluate quest condition against real data
    const result = await evaluateQuestCondition(
      condition,
      userId,
      now,
      questDateRange,
    );
    if (!result.completed) continue;

    // Type-aware dedup window
    const dedupeStart =
      quest.typ === "WEEKLY"
        ? startOfWeek(now, { weekStartsOn: 1 })
        : quest.typ === "SPECIAL" && quest.startDatum
          ? quest.startDatum // One completion per campaign
          : startOfDay(now); // DAILY: one per day

    const existing = await prisma.questCompletion.findFirst({
      where: {
        userId,
        questId: quest.id,
        completedAt: { gte: dedupeStart },
      },
    });

    if (existing) continue;

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
 * Enqueue a quest check for a user via BullMQ.
 * Fire-and-forget: never blocks calling code, never throws.
 *
 * The jobId dedup ensures that multiple business actions by the same user
 * within the same hour don't create redundant queue jobs. The nightly
 * safety-net cron handles the rest.
 */
export function enqueueQuestCheck(userId: string): void {
  gamificationQueue
    .add("quest-check", { userId }, {
      // Deduplicate: if same user already in queue, don't add again
      jobId: `quest-check-${userId}-${new Date().toISOString().slice(0, 13)}`, // Dedup per hour
    })
    .catch(() => {
      // Fire-and-forget: silently ignore queue failures
    });
}
