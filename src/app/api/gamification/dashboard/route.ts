/**
 * GET /api/gamification/dashboard
 *
 * Combined endpoint returning GameProfile (level, XP, Runen, streak)
 * plus quest progress grouped by type (daily, weekly, special).
 *
 * Returns 401 if not authenticated, 404 if user has gamificationOptIn=false.
 * Widget uses 404 to know user is opted out and render nothing.
 *
 * Quest filtering:
 * - Only universal (klasse=null) and user's class quests are returned
 * - SPECIAL quests filtered by startDatum/endDatum date range
 * - Type-aware dedup: DAILY=startOfDay, WEEKLY=startOfWeek, SPECIAL=startDatum
 */

import { NextResponse } from "next/server";
import { startOfDay, startOfWeek } from "date-fns";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getOrCreateGameProfile,
  getLevelForXp,
  getLevelTitle,
  getRequiredXp,
} from "@/lib/gamification/game-profile-service";
import { evaluateQuestCondition } from "@/lib/gamification/quest-evaluator";
import { getDailyRunenUsed } from "@/lib/gamification/runen-cap";
import { getSettingTyped } from "@/lib/settings/service";
import type { QuestCondition } from "@/lib/gamification/types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 },
    );
  }

  const userId = session.user.id;

  // Check opt-in status from DB (not session token) -- same pattern as profile route
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gamificationOptIn: true, role: true },
  });

  if (!user?.gamificationOptIn) {
    return NextResponse.json(
      { error: "Gamification nicht aktiviert" },
      { status: 404 },
    );
  }

  // Get profile data
  const gameProfile = await getOrCreateGameProfile(userId, user.role);
  const userKlasse = gameProfile.klasse;

  // Compute level/XP progress (same math as profile route)
  const level = getLevelForXp(gameProfile.xp);
  const levelTitle = getLevelTitle(level);
  const xpForCurrentLevel = getRequiredXp(level);
  const xpForNextLevel = getRequiredXp(level + 1);
  const xpInLevel = gameProfile.xp - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;
  const progress =
    xpNeeded > 0 ? Math.round(Math.min(xpInLevel / xpNeeded, 1) * 100) / 100 : 1;

  const now = new Date();

  // Load active quests filtered by user's klasse (universal + class-specific)
  const quests = await prisma.quest.findMany({
    where: {
      aktiv: true,
      OR: [
        { klasse: null },
        { klasse: userKlasse },
      ],
    },
    orderBy: [{ typ: "asc" }, { sortierung: "asc" }],
  });

  // Filter SPECIAL quests by date range
  const activeQuests = quests.filter((q) => {
    if (q.typ === "SPECIAL") {
      if (q.startDatum && q.startDatum > now) return false;
      if (q.endDatum && q.endDatum < now) return false;
    }
    return true;
  });

  // Evaluate all quests in parallel: real-time progress + completion check
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });

  const questResults = await Promise.all(
    activeQuests.map(async (quest) => {
      const condition = quest.bedingung as unknown as QuestCondition;

      // Build campaign date range for SPECIAL quests
      const questDateRange =
        quest.typ === "SPECIAL" && quest.startDatum && quest.endDatum
          ? { start: quest.startDatum, end: quest.endDatum }
          : undefined;

      // Type-aware dedup window
      const dedupeStart =
        quest.typ === "WEEKLY"
          ? weekStart
          : quest.typ === "SPECIAL" && quest.startDatum
            ? quest.startDatum
            : todayStart;

      // Run evaluation + completion check in parallel per quest
      const [evalResult, completion] = await Promise.all([
        evaluateQuestCondition(condition, userId, now, questDateRange),
        prisma.questCompletion.findFirst({
          where: {
            userId,
            questId: quest.id,
            completedDate: quest.typ === "DAILY"
              ? todayStart  // Exact date match for DAILY
              : quest.typ === "WEEKLY"
                ? { gte: weekStart }
                : quest.typ === "SPECIAL" && quest.startDatum
                  ? { gte: quest.startDatum }
                  : todayStart,
          },
        }),
      ]);

      return {
        id: quest.id,
        name: quest.name,
        typ: quest.typ,
        beschreibung: quest.beschreibung ?? quest.name,
        bedingung: condition,
        xpBelohnung: quest.xpBelohnung,
        runenBelohnung: quest.runenBelohnung,
        current: evalResult.current,
        target: evalResult.target,
        completed: evalResult.completed,
        awarded: completion !== null,
        // For SPECIAL quests: include end date for countdown display
        ...(quest.typ === "SPECIAL" && quest.endDatum
          ? { endDatum: quest.endDatum.toISOString() }
          : {}),
      };
    }),
  );

  // Fetch daily Runen cap data for cap indicator
  const [dailyRunenUsed, dailyRunenCap] = await Promise.all([
    getDailyRunenUsed(userId),
    getSettingTyped<number>("gamification.daily_runen_cap", 40),
  ]);

  // Group by type
  return NextResponse.json({
    profile: {
      level,
      levelTitle,
      xp: gameProfile.xp,
      xpInLevel,
      xpNeeded,
      progress,
      runen: gameProfile.runen,
      streakTage: gameProfile.streakTage,
      dailyRunenUsed,
      dailyRunenCap,
    },
    quests: {
      daily: questResults.filter((q) => q.typ === "DAILY"),
      weekly: questResults.filter((q) => q.typ === "WEEKLY"),
      special: questResults.filter((q) => q.typ === "SPECIAL"),
    },
  });
}
