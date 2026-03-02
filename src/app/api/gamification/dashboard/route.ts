/**
 * GET /api/gamification/dashboard
 *
 * Combined endpoint returning GameProfile (level, XP, Runen, streak)
 * plus daily quest progress with real-time evaluation.
 *
 * Returns 401 if not authenticated, 404 if user has gamificationOptIn=false.
 * Widget uses 404 to know user is opted out and render nothing.
 */

import { NextResponse } from "next/server";
import { startOfDay } from "date-fns";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getOrCreateGameProfile,
  getLevelForXp,
  getLevelTitle,
  getRequiredXp,
} from "@/lib/gamification/game-profile-service";
import { evaluateQuestCondition } from "@/lib/gamification/quest-evaluator";
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

  // Compute level/XP progress (same math as profile route)
  const level = getLevelForXp(gameProfile.xp);
  const levelTitle = getLevelTitle(level);
  const xpForCurrentLevel = getRequiredXp(level);
  const xpForNextLevel = getRequiredXp(level + 1);
  const xpInLevel = gameProfile.xp - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;
  const progress =
    xpNeeded > 0 ? Math.round(Math.min(xpInLevel / xpNeeded, 1) * 100) / 100 : 1;

  // Load active daily quests ordered by sortierung
  const quests = await prisma.quest.findMany({
    where: { typ: "DAILY", aktiv: true },
    orderBy: { sortierung: "asc" },
  });

  // Evaluate all quests in parallel: real-time progress + completion check
  const todayStart = startOfDay(new Date());

  const questResults = await Promise.all(
    quests.map(async (quest) => {
      const condition = quest.bedingung as unknown as QuestCondition;

      // Run evaluation + completion check in parallel per quest
      const [evalResult, completion] = await Promise.all([
        evaluateQuestCondition(condition, userId),
        prisma.questCompletion.findFirst({
          where: {
            userId,
            questId: quest.id,
            completedAt: { gte: todayStart },
          },
        }),
      ]);

      return {
        id: quest.id,
        name: quest.name,
        beschreibung: quest.beschreibung ?? quest.name,
        bedingung: condition,
        xpBelohnung: quest.xpBelohnung,
        runenBelohnung: quest.runenBelohnung,
        current: evalResult.current,
        target: evalResult.target,
        completed: evalResult.completed,
        awarded: completion !== null,
      };
    }),
  );

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
    },
    quests: questResults,
  });
}
