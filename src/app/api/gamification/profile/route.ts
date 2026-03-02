/**
 * GET /api/gamification/profile
 *
 * Returns the requesting user's own GameProfile with computed level,
 * title, and XP progress. DSGVO-compliant: self-only access, no userId
 * parameter accepted.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getOrCreateGameProfile,
  getLevelForXp,
  getLevelTitle,
  getRequiredXp,
} from "@/lib/gamification/game-profile-service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 },
    );
  }

  // Check opt-in status from DB (not in session token)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { gamificationOptIn: true },
  });

  if (!user?.gamificationOptIn) {
    return NextResponse.json(
      { error: "Gamification nicht aktiviert" },
      { status: 404 },
    );
  }

  const profile = await getOrCreateGameProfile(
    session.user.id,
    session.user.role,
  );

  const level = getLevelForXp(profile.xp);
  const levelTitle = getLevelTitle(level);
  const xpForCurrentLevel = getRequiredXp(level);
  const xpForNextLevel = getRequiredXp(level + 1);
  const xpInLevel = profile.xp - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;
  const progress = xpNeeded > 0 ? Math.min(xpInLevel / xpNeeded, 1) : 1;

  return NextResponse.json({
    id: profile.id,
    klasse: profile.klasse,
    xp: profile.xp,
    level,
    levelTitle,
    runen: profile.runen,
    streakTage: profile.streakTage,
    xpForCurrentLevel,
    xpForNextLevel,
    progress: Math.round(progress * 100) / 100, // 2 decimal places
  });
}
