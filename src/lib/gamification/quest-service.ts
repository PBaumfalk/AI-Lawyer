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
 * - Uses prisma.$transaction for atomic XP/Runen + completion recording (ABUSE-04)
 * - Catches P2002 unique constraint violations as idempotent no-op (concurrent safety)
 * - Daily Runen cap enforced via Redis for WV quests only (ABUSE-02)
 * - WV quest completion requires 30+ char erledigungsgrund (ABUSE-01, via evaluator)
 * - Weekly quests use startOfWeek dedup (not startOfDay) to prevent 7x awards (Pitfall 1)
 * - SPECIAL quests use startDatum dedup (one completion per campaign)
 */

import { startOfDay, startOfWeek } from "date-fns";

import { prisma } from "@/lib/db";
import { gamificationQueue } from "@/lib/queue/queues";
import { getSocketEmitter } from "@/lib/socket/emitter";
import type { QuestCondition, CountCondition } from "./types";
import { FOLLOW_UP_WV_BONUS_RUNEN } from "./types";
import { evaluateQuestCondition } from "./quest-evaluator";
import {
  getOrCreateGameProfile,
  getStreakMultiplier,
  updateStreak,
} from "./game-profile-service";
import { checkAndRecordRunenCap } from "./runen-cap";

/**
 * Main entry point: evaluate all active quests for a user.
 *
 * 1. Check if user has gamificationOptIn enabled
 * 2. Load/create GameProfile
 * 3. Load all active quests filtered by user's SpielKlasse
 * 4. Evaluate each quest condition (DAILY, WEEKLY, SPECIAL)
 * 5. For completed quests, check for existing completion (type-aware dedup via completedDate)
 * 6. Award XP+Runen atomically with cap enforcement for WV quests
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

  // Check for active doppel-runen perk (activatedAt within last 2 hours)
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const activeDoppelRunen = await prisma.userInventoryItem.findFirst({
    where: {
      userId,
      verbraucht: true,
      activatedAt: { gte: twoHoursAgo },
      shopItem: {
        metadata: {
          path: ["perkType"],
          equals: "doppel-runen",
        },
      },
    },
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

    // Type-aware dedup using completedDate (DATE-only field)
    // DAILY: exact date match; WEEKLY: >= week start; SPECIAL: >= campaign start
    const dedupeDate =
      quest.typ === "WEEKLY"
        ? startOfWeek(now, { weekStartsOn: 1 })
        : quest.typ === "SPECIAL" && quest.startDatum
          ? quest.startDatum // One completion per campaign
          : startOfDay(now); // DAILY: exact date match

    const existing = await prisma.questCompletion.findFirst({
      where: {
        userId,
        questId: quest.id,
        completedDate: quest.typ === "DAILY"
          ? startOfDay(now)  // Exact date match for DAILY
          : { gte: dedupeDate },
      },
    });

    if (existing) continue;

    // Determine if quest is a WV quest (for cap enforcement + follow-up bonus)
    const isWvQuest =
      (condition as CountCondition).model === "KalenderEintrag" &&
      ((condition as CountCondition).where as Record<string, unknown>).typ === "WIEDERVORLAGE";

    // Calculate rewards
    const streakMultiplier = getStreakMultiplier(profile.streakTage);
    let runenToCredit = Math.round(quest.runenBelohnung * streakMultiplier);

    // Check for follow-up WV bonus (user created a new open WV today)
    if (isWvQuest) {
      const todayStart = startOfDay(now);
      const todayEnd = new Date(todayStart.getTime() + 86_400_000);
      const followUpCount = await prisma.kalenderEintrag.count({
        where: {
          typ: "WIEDERVORLAGE",
          verantwortlichId: userId,
          createdAt: { gte: todayStart, lt: todayEnd },
          erledigtAm: null, // Still open = newly created follow-up
        },
      });
      if (followUpCount > 0) {
        runenToCredit += FOLLOW_UP_WV_BONUS_RUNEN;
      }
    }

    // Apply daily Runen cap for WV quests only (ABUSE-02)
    if (isWvQuest) {
      const capResult = await checkAndRecordRunenCap(userId, runenToCredit);
      runenToCredit = capResult.runenToCredit;
    }

    // Apply doppel-runen doubling: cap first, then double (per CONTEXT.md locked decision)
    // Doubles Runen from ALL quest types (daily, weekly, special), not just WV
    if (activeDoppelRunen) {
      runenToCredit *= 2;
    }

    // Random audit sampling: ~2% of completions (midpoint of 1-3% per CONTEXT.md)
    const needsAudit = Math.random() < 0.02;

    // Atomic: award rewards + record completion in single transaction (ABUSE-04)
    const today = startOfDay(now);
    try {
      await prisma.$transaction(async (tx) => {
        if (!needsAudit) {
          // Credit immediately
          await tx.userGameProfile.update({
            where: { userId },
            data: {
              xp: { increment: quest.xpBelohnung },
              runen: { increment: runenToCredit },
            },
          });
        }

        await tx.questCompletion.create({
          data: {
            userId,
            questId: quest.id,
            xpVerdient: needsAudit ? 0 : quest.xpBelohnung,
            runenVerdient: needsAudit ? 0 : runenToCredit,
            completedDate: today,
            pendingXp: needsAudit ? quest.xpBelohnung : 0,
            pendingRunen: needsAudit ? runenToCredit : 0,
            auditStatus: needsAudit ? "PENDING" : "NONE",
          },
        });
      });
    } catch (err: unknown) {
      // P2002: Unique constraint violation = concurrent completion, no-op (idempotent)
      if (
        err !== null &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        continue;
      }
      throw err;
    }

    // If audit needed, emit Socket.IO event and schedule auto-confirm (ABUSE-03)
    if (needsAudit) {
      const completion = await prisma.questCompletion.findFirst({
        where: { userId, questId: quest.id, completedDate: startOfDay(now) },
        orderBy: { completedAt: "desc" },
      });
      if (completion) {
        // Emit to user's browser room
        getSocketEmitter()
          .to(`user:${userId}`)
          .emit("gamification:audit-needed", {
            completionId: completion.id,
            questName: quest.name,
          });

        // Schedule auto-confirm after 24 hours
        gamificationQueue
          .add(
            "audit-auto-confirm",
            { completionId: completion.id },
            {
              delay: 24 * 60 * 60 * 1000, // 24 hours
              jobId: `audit-auto-confirm-${completion.id}`,
            },
          )
          .catch(() => {}); // Fire-and-forget
      }
    }
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
