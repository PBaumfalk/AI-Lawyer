"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, animate, useReducedMotion } from "motion/react";

interface XpProgressBarProps {
  /** Progress fraction 0-1 */
  progress: number;
  /** Current XP within current level */
  xpCurrent: number;
  /** XP needed for next level */
  xpNeeded: number;
}

/**
 * Animated XP progress bar matching glass aesthetic.
 * Uses motion/react for smooth width animation (same pattern as GlassKpiCard).
 */
export function XpProgressBar({ progress, xpCurrent, xpNeeded }: XpProgressBarProps) {
  const prefersReducedMotion = useReducedMotion();
  const motionProgress = useMotionValue(0);
  const [displayWidth, setDisplayWidth] = useState(0);

  useEffect(() => {
    const targetPercent = Math.round(progress * 100);

    if (prefersReducedMotion) {
      setDisplayWidth(targetPercent);
      return;
    }

    const controls = animate(motionProgress, targetPercent, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayWidth(Math.round(latest)),
    });

    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, prefersReducedMotion]);

  return (
    <div className="flex items-center gap-2">
      {/* Bar container */}
      <div className="flex-1 h-2 rounded-full bg-white/10 dark:bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
          style={{ width: `${displayWidth}%` }}
        />
      </div>
      {/* XP label */}
      <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
        {xpCurrent}/{xpNeeded} XP
      </span>
    </div>
  );
}
