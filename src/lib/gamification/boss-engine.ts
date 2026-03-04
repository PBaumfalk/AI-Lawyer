/**
 * Boss Engine
 *
 * Core state machine for the team bossfight mechanic.
 * Manages: spawn, damage, heal, phase transitions, defeat, and rewards.
 *
 * All HP mutations use atomic Prisma operations inside $transaction
 * to prevent race conditions from concurrent WV clears.
 *
 * Socket.IO events are emitted after successful state changes
 * via getSocketEmitter() (Redis-backed, works from worker processes).
 */

import type { Bossfight } from "@prisma/client";
import { differenceInHours } from "date-fns";

import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getSocketEmitter } from "@/lib/socket/emitter";
import { getSettingTyped } from "@/lib/settings/service";
import { awardRewards, awardTrophy } from "@/lib/gamification/game-profile-service";
import type { BossTrophy } from "@/lib/gamification/types";
import {
  BOSS_NAMES,
  BASE_HIT_RUNEN,
  PHASE_RUNEN_MULTIPLIER,
  PHASE_TRANSITION_BONUS,
  VICTORY_XP_BONUS,
  VICTORY_RUNEN_BONUS,
  DEFAULT_BOSS_THRESHOLD,
  DEFAULT_BOSS_COOLDOWN_HOURS,
  calculatePhase,
} from "./boss-constants";

const log = createLogger("boss-engine");

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DamageResult {
  currentHp: number;
  spawnHp: number;
  phase: number;
  phaseChanged: boolean;
  defeated: boolean;
  hitRunen: number;
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Count open Wiedervorlagen for a kanzlei.
 */
export async function getBacklogCount(kanzleiId: string): Promise<number> {
  return prisma.kalenderEintrag.count({
    where: {
      erledigt: false,
      typ: "WIEDERVORLAGE",
      verantwortlich: { kanzleiId },
    },
  });
}

/**
 * Get the currently active boss for a kanzlei (if any).
 */
export async function getActiveBoss(kanzleiId: string): Promise<Bossfight | null> {
  return prisma.bossfight.findFirst({
    where: { kanzleiId, status: "ACTIVE" },
  });
}

// ─── Spawn ──────────────────────────────────────────────────────────────────

/**
 * Check conditions and spawn a new boss if:
 * 1. No active boss exists
 * 2. Cooldown since last defeat has elapsed
 * 3. Open WV count exceeds threshold
 *
 * Uses $transaction with check-then-create to prevent duplicate active bosses.
 */
export async function checkAndSpawnBoss(kanzleiId: string): Promise<Bossfight | null> {
  const threshold = await getSettingTyped<number>(
    "gamification.boss.threshold",
    DEFAULT_BOSS_THRESHOLD,
  );
  const cooldown = await getSettingTyped<number>(
    "gamification.boss.cooldownHours",
    DEFAULT_BOSS_COOLDOWN_HOURS,
  );

  // Quick check: already an active boss?
  const existing = await getActiveBoss(kanzleiId);
  if (existing) return null;

  // Check cooldown from last defeated boss
  const lastDefeated = await prisma.bossfight.findFirst({
    where: { kanzleiId, status: "DEFEATED" },
    orderBy: { defeatedAt: "desc" },
  });
  if (lastDefeated?.defeatedAt) {
    const hoursSince = differenceInHours(new Date(), lastDefeated.defeatedAt);
    if (hoursSince < cooldown) return null;
  }

  // Check backlog count
  const backlogCount = await getBacklogCount(kanzleiId);
  if (backlogCount <= threshold) return null;

  // Spawn inside transaction (double-check no active boss exists)
  const boss = await prisma.$transaction(async (tx) => {
    const doubleCheck = await tx.bossfight.findFirst({
      where: { kanzleiId, status: "ACTIVE" },
    });
    if (doubleCheck) return null;

    const name = BOSS_NAMES[Math.floor(Math.random() * BOSS_NAMES.length)];
    return tx.bossfight.create({
      data: {
        kanzleiId,
        name,
        spawnHp: backlogCount,
        currentHp: backlogCount,
      },
    });
  });

  if (boss) {
    log.info({ kanzleiId, bossName: boss.name, hp: boss.spawnHp }, "Boss spawned");
    try {
      getSocketEmitter()
        .to(`kanzlei:${kanzleiId}`)
        .emit("boss:spawned", {
          bossfightId: boss.id,
          name: boss.name,
          spawnHp: boss.spawnHp,
          currentHp: boss.currentHp,
          phase: boss.phase,
        });
    } catch (err) {
      log.warn({ err }, "Failed to emit boss:spawned event");
    }
  }

  return boss;
}

// ─── Damage ─────────────────────────────────────────────────────────────────

/**
 * Deal 1 damage to the active boss for a kanzlei.
 *
 * Inside $transaction:
 * - Decrement HP
 * - Record damage entry with per-hit Runen
 * - Award per-hit Runen to attacker
 * - Check phase transition (award team-wide bonus if new phase)
 * - Check defeat (award victory rewards, trophies)
 * - Emit Socket.IO events
 */
export async function dealBossDamage(
  kanzleiId: string,
  userId: string,
  userName: string,
): Promise<DamageResult | null> {
  const boss = await getActiveBoss(kanzleiId);
  if (!boss) return null;

  const result = await prisma.$transaction(async (tx) => {
    // Re-read inside transaction to guard against post-defeat phantom damage
    const currentBoss = await tx.bossfight.findUnique({ where: { id: boss.id } });
    if (!currentBoss || currentBoss.status !== "ACTIVE") return null;

    // Decrement HP
    const updated = await tx.bossfight.update({
      where: { id: boss.id },
      data: { currentHp: { decrement: 1 } },
    });

    // Calculate per-hit Runen
    const hitRunen = Math.round(BASE_HIT_RUNEN * (PHASE_RUNEN_MULTIPLIER[currentBoss.phase] ?? 1));

    // Record damage
    await tx.bossfightDamage.create({
      data: {
        bossfightId: boss.id,
        userId,
        amount: 1,
        runenEarned: hitRunen,
      },
    });

    // Award per-hit Runen to attacker (XP=0, streakMul=1 for boss rewards)
    await awardRewards(userId, 0, hitRunen, 1);

    // Check phase transition
    const newPhase = calculatePhase(updated.currentHp, updated.spawnHp);
    let phaseChanged = false;

    if (newPhase > currentBoss.phase) {
      phaseChanged = true;
      const phaseBit = 1 << newPhase;
      const alreadyAwarded = (currentBoss.phaseRewardsGiven & phaseBit) !== 0;

      await tx.bossfight.update({
        where: { id: boss.id },
        data: {
          phase: newPhase,
          phaseRewardsGiven: { set: currentBoss.phaseRewardsGiven | phaseBit },
        },
      });

      // Award phase transition bonus to ALL participants (if not already awarded)
      if (!alreadyAwarded && PHASE_TRANSITION_BONUS[newPhase]) {
        const participants = await tx.bossfightDamage.findMany({
          where: { bossfightId: boss.id },
          select: { userId: true },
          distinct: ["userId"],
        });

        const bonus = PHASE_TRANSITION_BONUS[newPhase];
        for (const p of participants) {
          await awardRewards(p.userId, 0, bonus, 1);
        }

        log.info(
          { bossId: boss.id, newPhase, participantCount: participants.length, bonus },
          "Phase transition bonus awarded",
        );
      }

      try {
        getSocketEmitter()
          .to(`kanzlei:${kanzleiId}`)
          .emit("boss:phase-change", {
            bossfightId: boss.id,
            newPhase,
            currentHp: updated.currentHp,
            spawnHp: updated.spawnHp,
          });
      } catch (err) {
        log.warn({ err }, "Failed to emit boss:phase-change event");
      }
    }

    // Check defeat
    if (updated.currentHp <= 0) {
      await tx.bossfight.update({
        where: { id: boss.id },
        data: { status: "DEFEATED", defeatedAt: new Date(), currentHp: 0 },
      });

      await awardVictoryRewards(tx, boss.id, boss.name);

      // Get total damage across all participants
      const totalDamageResult = await tx.bossfightDamage.aggregate({
        where: { bossfightId: boss.id },
        _sum: { amount: true },
      });

      // Get MVP for the event
      const mvpGroup = await tx.bossfightDamage.groupBy({
        by: ["userId"],
        where: { bossfightId: boss.id },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 1,
      });

      const mvpUserId = mvpGroup[0]?.userId;
      let mvpName = "Unbekannt";
      if (mvpUserId) {
        const mvpUser = await tx.user.findUnique({
          where: { id: mvpUserId },
          select: { name: true },
        });
        mvpName = mvpUser?.name ?? "Unbekannt";
      }

      try {
        getSocketEmitter()
          .to(`kanzlei:${kanzleiId}`)
          .emit("boss:defeated", {
            bossfightId: boss.id,
            bossName: boss.name,
            mvpUserId: mvpUserId ?? "",
            mvpUserName: mvpName,
            totalDamage: totalDamageResult._sum?.amount ?? 0,
            runenEarned: VICTORY_RUNEN_BONUS,
          });
      } catch (err) {
        log.warn({ err }, "Failed to emit boss:defeated event");
      }

      return {
        currentHp: 0,
        spawnHp: updated.spawnHp,
        phase: newPhase > currentBoss.phase ? newPhase : currentBoss.phase,
        phaseChanged,
        defeated: true,
        hitRunen,
      };
    }

    // Emit damage event
    try {
      getSocketEmitter()
        .to(`kanzlei:${kanzleiId}`)
        .emit("boss:damage", {
          bossfightId: boss.id,
          userId,
          userName,
          currentHp: updated.currentHp,
          spawnHp: updated.spawnHp,
          phase: newPhase > currentBoss.phase ? newPhase : currentBoss.phase,
        });
    } catch (err) {
      log.warn({ err }, "Failed to emit boss:damage event");
    }

    return {
      currentHp: updated.currentHp,
      spawnHp: updated.spawnHp,
      phase: newPhase > currentBoss.phase ? newPhase : currentBoss.phase,
      phaseChanged,
      defeated: false,
      hitRunen,
    };
  });

  return result;
}

// ─── Heal ───────────────────────────────────────────────────────────────────

/**
 * Heal the active boss by 1 HP when a new Wiedervorlage is created.
 * Capped at spawnHp.
 */
export async function healBoss(kanzleiId: string): Promise<void> {
  const boss = await getActiveBoss(kanzleiId);
  if (!boss) return;

  await prisma.$transaction(async (tx) => {
    // Only heal if under spawnHp cap
    const current = await tx.bossfight.findUnique({ where: { id: boss.id } });
    if (!current || current.status !== "ACTIVE" || current.currentHp >= current.spawnHp) return;

    const updated = await tx.bossfight.update({
      where: { id: boss.id },
      data: { currentHp: { increment: 1 } },
    });

    try {
      getSocketEmitter()
        .to(`kanzlei:${kanzleiId}`)
        .emit("boss:heal", {
          bossfightId: boss.id,
          currentHp: updated.currentHp,
          spawnHp: updated.spawnHp,
        });
    } catch (err) {
      log.warn({ err }, "Failed to emit boss:heal event");
    }
  });
}

// ─── Victory Rewards ────────────────────────────────────────────────────────

/**
 * Award victory rewards to all participants of a defeated boss.
 * Called inside the defeat transaction.
 */
async function awardVictoryRewards(
  tx: any,
  bossfightId: string,
  bossName: string,
): Promise<void> {
  // Get all distinct participant userIds
  const participants = await tx.bossfightDamage.findMany({
    where: { bossfightId },
    select: { userId: true },
    distinct: ["userId"],
  });

  const trophy: BossTrophy = {
    type: "BOSS_VICTORY",
    bossName,
    date: new Date().toISOString(),
    bossfightId,
  };

  for (const p of participants) {
    // Award XP + Runen (no streak multiplier on boss rewards)
    await awardRewards(p.userId, VICTORY_XP_BONUS, VICTORY_RUNEN_BONUS, 1);
    // Award trophy
    await awardTrophy(p.userId, trophy);
  }

  log.info(
    { bossfightId, bossName, participantCount: participants.length },
    "Victory rewards awarded",
  );
}
