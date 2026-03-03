/**
 * GET /api/gamification/heldenkarte
 *
 * Combined endpoint returning profile data, equipped cosmetics,
 * badges (earned + locked), and paginated quest history.
 * Self-only access (DSGVO). Returns 404 for opted-out users.
 *
 * Query params:
 *   ?page=N  (quest history page, default 1, 20 per page)
 */

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getLevelForXp,
  getLevelTitle,
  getOrCreateGameProfile,
  getRequiredXp,
} from "@/lib/gamification/game-profile-service";
import { BADGE_CATALOG } from "@/lib/gamification/badge-catalog";
import { evaluateBadges } from "@/lib/gamification/badge-service";

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 },
    );
  }

  const userId = session.user.id;

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

  // Get or create profile
  const profile = await getOrCreateGameProfile(userId, user.role);

  // Parse page param
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  // Compute level/XP data
  const level = getLevelForXp(profile.xp);
  const levelTitle = getLevelTitle(level);
  const xpForCurrentLevel = getRequiredXp(level);
  const xpForNextLevel = getRequiredXp(level + 1);
  const xpInLevel = profile.xp - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;
  const progress = xpNeeded > 0 ? Math.min(xpInLevel / xpNeeded, 1) : 1;

  // Parallel data fetch: badges, equipped cosmetics, quest history + count
  const [earnedBadges, equippedItems, completions, totalCompletions] =
    await Promise.all([
      evaluateBadges(userId),
      prisma.userInventoryItem.findMany({
        where: { userId, ausgeruestet: true },
        include: {
          shopItem: {
            select: { typ: true, name: true, rarity: true, metadata: true },
          },
        },
      }),
      prisma.questCompletion.findMany({
        where: { userId },
        include: { quest: { select: { name: true, typ: true } } },
        orderBy: { completedAt: "desc" },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.questCompletion.count({ where: { userId } }),
    ]);

  // Map badges: full catalog with earned/locked status
  const badgeResponse = BADGE_CATALOG.map((def) => {
    const earned = earnedBadges.find((b) => b.slug === def.slug);
    return {
      slug: def.slug,
      name: def.name,
      beschreibung: def.beschreibung,
      icon: def.icon,
      earned: !!earned,
      earnedAt: earned?.earnedAt ?? null,
    };
  });

  // Map equipped cosmetics
  const equippedCosmetics = equippedItems.map((item) => ({
    typ: item.shopItem.typ,
    name: item.shopItem.name,
    rarity: item.shopItem.rarity,
    metadata: item.shopItem.metadata as Record<string, unknown>,
  }));

  // Map quest history
  const questItems = completions.map((c) => ({
    id: c.id,
    questName: c.quest.name,
    questTyp: c.quest.typ,
    xpVerdient: c.xpVerdient,
    runenVerdient: c.runenVerdient,
    completedAt: c.completedAt.toISOString(),
  }));

  return NextResponse.json({
    profile: {
      klasse: profile.klasse,
      level,
      levelTitle,
      xp: profile.xp,
      xpInLevel,
      xpNeeded,
      progress: Math.round(progress * 100) / 100,
      runen: profile.runen,
      streakTage: profile.streakTage,
    },
    equippedCosmetics,
    badges: badgeResponse,
    questHistory: {
      items: questItems,
      total: totalCompletions,
      page,
      pageSize: PAGE_SIZE,
    },
  });
}
