"use client";

import { useEffect, useState, useCallback } from "react";
import { Bug, Flame, Skull, Swords } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { useSocket } from "@/components/socket-provider";
import { BossHpBar } from "./boss-hp-bar";
import { BossDamageTicker } from "./boss-damage-ticker";
import { BossLeaderboard } from "./boss-leaderboard";
import { BossVictory } from "./boss-victory";

// ─── State types ────────────────────────────────────────────────────────────

interface BossState {
  id: string;
  name: string;
  spawnHp: number;
  currentHp: number;
  phase: number;
  spawnedAt: string;
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  totalDamage: number;
}

interface DamageEntry {
  id: string;
  userName: string;
  amount: number;
  createdAt: string;
}

interface TeaserState {
  backlogCount: number;
  threshold: number;
  remaining: number;
}

interface VictoryState {
  bossName: string;
  mvpUserName: string;
  totalDamage: number;
  runenEarned: number;
}

// ─── Phase icon helper ──────────────────────────────────────────────────────

function PhaseIcon({
  phase,
  className,
}: {
  phase: number;
  className?: string;
}) {
  switch (phase) {
    case 1:
      return <Bug className={className} />;
    case 2:
      return <Flame className={className} />;
    case 3:
      return <Skull className={className} />;
    case 4:
      return <Swords className={className} />;
    default:
      return <Bug className={className} />;
  }
}

// ─── BossfightBanner ────────────────────────────────────────────────────────

/**
 * Self-fetching dashboard banner for the team Bossfight mechanic.
 *
 * Renders one of three states:
 * - Active boss: HP bar, damage ticker, leaderboard
 * - Victory: confetti celebration with MVP callout
 * - Teaser: backlog count vs threshold progress
 *
 * Graceful degradation: returns null on error or if no kanzlei data.
 */
export function BossfightBanner() {
  const [boss, setBoss] = useState<BossState | null>(null);
  const [teaser, setTeaser] = useState<TeaserState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [recentDamage, setRecentDamage] = useState<DamageEntry[]>([]);
  const [victory, setVictory] = useState<VictoryState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { socket } = useSocket();

  // ─── Initial fetch ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function fetchBossState() {
      try {
        const res = await fetch("/api/gamification/bossfight");
        if (cancelled) return;
        if (!res.ok) {
          setLoaded(true);
          return;
        }
        const data = await res.json();
        if (data.active) {
          setBoss(data.boss);
          setLeaderboard(data.leaderboard ?? []);
          setRecentDamage(data.recentDamage ?? []);
          setTeaser(null);
        } else {
          setTeaser(data.teaser ?? null);
          setBoss(null);
        }
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    }

    fetchBossState();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Socket.IO event listeners ──────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    function onBossDamage(data: {
      bossfightId: string;
      userId: string;
      userName: string;
      currentHp: number;
      spawnHp: number;
      phase: number;
    }) {
      setBoss((prev) =>
        prev && prev.id === data.bossfightId
          ? { ...prev, currentHp: data.currentHp, phase: data.phase }
          : prev,
      );
      // Prepend to damage ticker
      setRecentDamage((prev) => [
        {
          id: crypto.randomUUID(),
          userName: data.userName,
          amount: 1,
          createdAt: new Date().toISOString(),
        },
        ...prev.slice(0, 9), // Keep max 10
      ]);
      // Update leaderboard optimistically
      setLeaderboard((prev) => {
        const existing = prev.find((e) => e.userId === data.userId);
        if (existing) {
          const updated = prev.map((e) =>
            e.userId === data.userId
              ? { ...e, totalDamage: e.totalDamage + 1 }
              : e,
          );
          return updated
            .sort((a, b) => b.totalDamage - a.totalDamage)
            .slice(0, 3);
        }
        const newEntry = {
          userId: data.userId,
          userName: data.userName,
          totalDamage: 1,
        };
        return [...prev, newEntry]
          .sort((a, b) => b.totalDamage - a.totalDamage)
          .slice(0, 3);
      });
    }

    function onBossPhaseChange(data: {
      bossfightId: string;
      newPhase: number;
    }) {
      setBoss((prev) =>
        prev && prev.id === data.bossfightId
          ? { ...prev, phase: data.newPhase }
          : prev,
      );
    }

    function onBossDefeated(data: {
      bossfightId: string;
      mvpUserId: string;
      mvpUserName: string;
      totalDamage: number;
      runenEarned: number;
    }) {
      setBoss((currentBoss) => {
        // Read boss name from current state before clearing
        setVictory({
          bossName: currentBoss?.name ?? "Boss",
          mvpUserName: data.mvpUserName ?? "Team",
          totalDamage: data.totalDamage ?? 0,
          runenEarned: data.runenEarned ?? 0,
        });
        return null;
      });
    }

    function onBossSpawned(data: {
      bossfightId: string;
      name: string;
      spawnHp: number;
      phase: number;
    }) {
      setBoss({
        id: data.bossfightId,
        name: data.name,
        spawnHp: data.spawnHp,
        currentHp: data.spawnHp,
        phase: 1,
        spawnedAt: new Date().toISOString(),
      });
      setTeaser(null);
      setLeaderboard([]);
      setRecentDamage([]);
      setVictory(null);
    }

    function onBossHeal(data: {
      bossfightId: string;
      currentHp: number;
      spawnHp: number;
    }) {
      setBoss((prev) =>
        prev && prev.id === data.bossfightId
          ? { ...prev, currentHp: data.currentHp }
          : prev,
      );
    }

    socket.on("boss:damage", onBossDamage);
    socket.on("boss:phase-change", onBossPhaseChange);
    socket.on("boss:defeated", onBossDefeated);
    socket.on("boss:spawned", onBossSpawned);
    socket.on("boss:heal", onBossHeal);

    return () => {
      socket.off("boss:damage", onBossDamage);
      socket.off("boss:phase-change", onBossPhaseChange);
      socket.off("boss:defeated", onBossDefeated);
      socket.off("boss:spawned", onBossSpawned);
      socket.off("boss:heal", onBossHeal);
    };
  }, [socket]);

  // ─── Victory dismiss handler ────────────────────────────────────────────

  const handleVictoryDismiss = useCallback(() => {
    setVictory(null);
    // Refetch to get teaser state
    fetch("/api/gamification/bossfight")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.active) {
          setBoss(data.boss);
          setLeaderboard(data.leaderboard ?? []);
          setRecentDamage(data.recentDamage ?? []);
          setTeaser(null);
        } else if (data?.teaser) {
          setTeaser(data.teaser);
        }
      })
      .catch(() => {});
  }, []);

  // ─── Rendering ──────────────────────────────────────────────────────────

  // Absent-until-loaded: no placeholder, no empty space
  if (!loaded || (!boss && !teaser && !victory)) {
    return null;
  }

  // Victory mode (takes priority)
  if (victory) {
    return (
      <GlassCard className="p-0 border-emerald-500/30">
        <BossVictory
          bossName={victory.bossName}
          mvpUserName={victory.mvpUserName}
          totalDamage={victory.totalDamage}
          runenEarned={victory.runenEarned}
          onDismiss={handleVictoryDismiss}
        />
      </GlassCard>
    );
  }

  // Active boss mode
  if (boss) {
    return (
      <GlassCard className="p-0 border-rose-500/20">
        <div className="px-5 py-4">
          {/* Header row: icon + name + phase badge */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PhaseIcon
                phase={boss.phase}
                className="w-5 h-5 text-rose-500"
              />
              <span className="text-base font-bold text-foreground">
                {boss.name}
              </span>
              <span className="text-xs text-muted-foreground bg-white/10 dark:bg-white/[0.06] px-2 py-0.5 rounded-full">
                Phase {boss.phase}/4
              </span>
            </div>
          </div>

          {/* HP Bar */}
          <BossHpBar currentHp={boss.currentHp} spawnHp={boss.spawnHp} />

          {/* Bottom row: damage ticker (left) + leaderboard (right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <BossDamageTicker entries={recentDamage} />
            <BossLeaderboard entries={leaderboard} />
          </div>
        </div>
      </GlassCard>
    );
  }

  // Teaser mode
  if (teaser) {
    return (
      <GlassCard className="p-0">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Noch{" "}
              <span className="font-semibold text-foreground">
                {teaser.remaining}
              </span>{" "}
              Wiedervorlagen bis zum naechsten Boss
            </span>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {teaser.backlogCount} / {teaser.threshold}
          </span>
        </div>
      </GlassCard>
    );
  }

  return null;
}
