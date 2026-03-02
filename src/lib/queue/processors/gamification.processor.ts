/**
 * Gamification BullMQ Processor
 *
 * Handles three job types:
 * - quest-check: Evaluate all active daily quests for a single user
 * - daily-reset: Placeholder for future daily quest rotation (no-op in Phase 33)
 * - nightly-safety-net: Evaluates all opted-in users, catches missed completions, finalizes streaks
 *
 * The nightly safety net calls checkQuestsForUser which has built-in dedup
 * (checks existing QuestCompletion for today before awarding). So running it
 * after the fire-and-forget hooks during the day is safe -- it will skip
 * already-completed quests.
 */

import type { Job } from "bullmq";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { checkQuestsForUser } from "@/lib/gamification/quest-service";
import { updateStreak } from "@/lib/gamification/game-profile-service";
import type { GamificationJobData } from "@/lib/queue/queues";

const log = createLogger("gamification-processor");

export async function processGamificationJob(job: Job<GamificationJobData>): Promise<void> {
  switch (job.name) {
    case "quest-check":
      return handleQuestCheck(job);
    case "daily-reset":
      return handleDailyReset();
    case "nightly-safety-net":
      return handleNightlySafetyNet();
    default:
      log.warn({ jobName: job.name }, "Unknown gamification job type");
  }
}

async function handleQuestCheck(job: Job<GamificationJobData>): Promise<void> {
  const { userId } = job.data;
  if (!userId) {
    log.warn("quest-check job missing userId");
    return;
  }
  await checkQuestsForUser(userId);
  log.debug({ userId }, "Quest check completed");
}

async function handleDailyReset(): Promise<void> {
  // Phase 33: Daily reset is a placeholder for future quest rotation.
  // Currently, quests are static (5 hardcoded dailies).
  // This cron will be extended in Phase 37 (Weekly Quests) for weekly reset logic.
  log.info("Daily reset cron executed (no-op in Phase 33 -- static daily quests)");
}

async function handleNightlySafetyNet(): Promise<void> {
  // Find all users who opted in to gamification and have a GameProfile
  const profiles = await prisma.userGameProfile.findMany({
    select: { userId: true },
    where: {
      user: { gamificationOptIn: true, aktiv: true },
    },
  });

  log.info({ userCount: profiles.length }, "Nightly safety net: evaluating all opted-in users");

  for (const profile of profiles) {
    try {
      await checkQuestsForUser(profile.userId);
      await updateStreak(profile.userId);
    } catch (err) {
      log.warn({ userId: profile.userId, err }, "Nightly safety net: failed for user (continuing)");
    }
  }

  log.info({ userCount: profiles.length }, "Nightly safety net completed");
}
