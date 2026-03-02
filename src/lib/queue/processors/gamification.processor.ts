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
import { dealBossDamage, healBoss, checkAndSpawnBoss } from "@/lib/gamification/boss-engine";
import { createWeeklySnapshots } from "@/lib/gamification/weekly-snapshot";
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
    case "boss-damage":
      return handleBossDamage(job);
    case "boss-heal":
      return handleBossHeal(job);
    case "boss-check":
      return handleBossCheck(job);
    case "weekly-snapshot":
      return handleWeeklySnapshot();
    case "audit-auto-confirm":
      return handleAuditAutoConfirm(job);
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

async function handleBossDamage(job: Job<GamificationJobData>): Promise<void> {
  const { kanzleiId, userId, userName } = job.data;
  if (!kanzleiId || !userId) {
    log.warn("boss-damage job missing kanzleiId or userId");
    return;
  }
  const result = await dealBossDamage(kanzleiId, userId, userName ?? "Unbekannt");
  if (result) {
    log.debug({ userId, kanzleiId, ...result }, "Boss damage dealt");
  }
}

async function handleBossHeal(job: Job<GamificationJobData>): Promise<void> {
  const { kanzleiId } = job.data;
  if (!kanzleiId) {
    log.warn("boss-heal job missing kanzleiId");
    return;
  }
  await healBoss(kanzleiId);
  log.debug({ kanzleiId }, "Boss heal processed");
}

async function handleBossCheck(job: Job<GamificationJobData>): Promise<void> {
  const { kanzleiId } = job.data;
  if (!kanzleiId) {
    log.warn("boss-check job missing kanzleiId");
    return;
  }
  const boss = await checkAndSpawnBoss(kanzleiId);
  if (boss) {
    log.info({ kanzleiId, bossName: boss.name, hp: boss.spawnHp }, "Boss spawned");
  }
}

async function handleWeeklySnapshot(): Promise<void> {
  await createWeeklySnapshots();
  log.info("Weekly snapshot cron completed");
}

async function handleAuditAutoConfirm(job: Job<GamificationJobData>): Promise<void> {
  const { completionId } = job.data;
  if (!completionId) {
    log.warn("audit-auto-confirm job missing completionId");
    return;
  }

  const completion = await prisma.questCompletion.findUnique({
    where: { id: completionId },
  });

  if (!completion) {
    log.warn({ completionId }, "audit-auto-confirm: completion not found");
    return;
  }

  // Only auto-confirm if still PENDING (user may have already confirmed/declined)
  if (completion.auditStatus !== "PENDING") {
    log.debug({ completionId, status: completion.auditStatus }, "audit-auto-confirm: already resolved");
    return;
  }

  // Auto-confirm: credit the pending rewards
  await prisma.$transaction(async (tx) => {
    await tx.userGameProfile.update({
      where: { userId: completion.userId },
      data: {
        xp: { increment: completion.pendingXp },
        runen: { increment: completion.pendingRunen },
      },
    });
    await tx.questCompletion.update({
      where: { id: completionId },
      data: {
        auditStatus: "CONFIRMED",
        xpVerdient: completion.pendingXp,
        runenVerdient: completion.pendingRunen,
      },
    });
  });

  log.info({ completionId, userId: completion.userId }, "audit-auto-confirm: rewards credited");
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

  // Boss spawn check for all active kanzleien with opted-in users
  const kanzleien = await prisma.user.findMany({
    where: { gamificationOptIn: true, aktiv: true, kanzleiId: { not: null } },
    select: { kanzleiId: true },
    distinct: ["kanzleiId"],
  });

  for (const { kanzleiId } of kanzleien) {
    if (!kanzleiId) continue;
    checkAndSpawnBoss(kanzleiId).catch((err) => {
      log.warn({ kanzleiId, err }, "Nightly boss spawn check failed");
    });
  }

  log.info(
    { userCount: profiles.length, kanzleiCount: kanzleien.length },
    "Nightly safety net completed",
  );
}
