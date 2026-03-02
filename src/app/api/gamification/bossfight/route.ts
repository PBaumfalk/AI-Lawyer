/**
 * GET /api/gamification/bossfight
 *
 * Returns the current boss state or a teaser with backlog count.
 *
 * Active boss: { active: true, boss, leaderboard, recentDamage }
 * No boss: { active: false, teaser: { backlogCount, threshold, remaining } }
 */

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveBoss, getBacklogCount } from "@/lib/gamification/boss-engine";
import { getSettingTyped } from "@/lib/settings/service";
import { DEFAULT_BOSS_THRESHOLD } from "@/lib/gamification/boss-constants";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 },
    );
  }

  const userId = session.user.id;

  // Get user's kanzleiId
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kanzleiId: true },
  });

  if (!user?.kanzleiId) {
    return NextResponse.json(
      { error: "Kein Kanzlei-Zuordnung" },
      { status: 404 },
    );
  }

  const kanzleiId = user.kanzleiId;
  const boss = await getActiveBoss(kanzleiId);

  if (boss) {
    // Active boss mode: leaderboard + recent damage feed
    const [topDealers, recentDamage] = await Promise.all([
      prisma.bossfightDamage.groupBy({
        by: ["userId"],
        where: { bossfightId: boss.id },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 3,
      }),
      prisma.bossfightDamage.findMany({
        where: { bossfightId: boss.id },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    // Resolve leaderboard user names
    const leaderboard = await Promise.all(
      topDealers.map(async (d) => {
        const dealerUser = await prisma.user.findUnique({
          where: { id: d.userId },
          select: { name: true },
        });
        return {
          userId: d.userId,
          userName: dealerUser?.name ?? "Unbekannt",
          totalDamage: d._sum.amount ?? 0,
        };
      }),
    );

    return NextResponse.json({
      active: true,
      boss: {
        id: boss.id,
        name: boss.name,
        spawnHp: boss.spawnHp,
        currentHp: boss.currentHp,
        phase: boss.phase,
        spawnedAt: boss.spawnedAt,
      },
      leaderboard,
      recentDamage: recentDamage.map((d) => ({
        userId: d.userId,
        userName: d.user.name,
        amount: d.amount,
        runenEarned: d.runenEarned,
        createdAt: d.createdAt,
      })),
    });
  }

  // Teaser mode: no active boss
  const [backlogCount, threshold] = await Promise.all([
    getBacklogCount(kanzleiId),
    getSettingTyped<number>("gamification.boss.threshold", DEFAULT_BOSS_THRESHOLD),
  ]);

  return NextResponse.json({
    active: false,
    teaser: {
      backlogCount,
      threshold,
      remaining: Math.max(0, threshold - backlogCount),
    },
  });
}
