"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface BossHpBarProps {
  currentHp: number;
  spawnHp: number;
}

/**
 * Animated HP bar for the boss fight banner.
 * Color transitions: green (>50%) -> amber (>25%) -> rose (<=25%).
 * Uses spring animation for smooth width transitions.
 */
export function BossHpBar({ currentHp, spawnHp }: BossHpBarProps) {
  const fraction = Math.max(0, Math.min(1, spawnHp > 0 ? currentHp / spawnHp : 0));

  // Color gradient based on HP fraction
  const colorClass =
    fraction > 0.5
      ? "from-emerald-500 to-emerald-400"
      : fraction > 0.25
        ? "from-amber-500 to-amber-400"
        : "from-rose-500 to-rose-400";

  // Glow shadow matching color
  const glowClass =
    fraction > 0.5
      ? "shadow-emerald-500/20"
      : fraction > 0.25
        ? "shadow-amber-500/20"
        : "shadow-rose-500/20";

  return (
    <div>
      {/* Bar container */}
      <div
        className={cn(
          "h-3 rounded-full bg-white/10 dark:bg-white/[0.06] overflow-hidden shadow-sm",
          glowClass,
        )}
      >
        <motion.div
          className={cn("h-full rounded-full bg-gradient-to-r", colorClass)}
          initial={false}
          animate={{ width: `${fraction * 100}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        />
      </div>

      {/* HP label */}
      <p className="text-xs text-muted-foreground tabular-nums font-mono mt-1">
        {currentHp} / {spawnHp} HP
      </p>
    </div>
  );
}
