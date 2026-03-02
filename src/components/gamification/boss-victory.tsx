"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { Trophy, Crown } from "lucide-react";
import confetti from "canvas-confetti";

interface BossVictoryProps {
  bossName: string;
  mvpUserName: string;
  totalDamage: number;
  runenEarned: number;
  onDismiss: () => void;
}

/**
 * Victory celebration overlay displayed inline in the boss banner.
 * Fires confetti from both sides and auto-dismisses after 30 seconds.
 */
export function BossVictory({
  bossName,
  mvpUserName,
  totalDamage,
  runenEarned,
  onDismiss,
}: BossVictoryProps) {
  useEffect(() => {
    // Two confetti bursts from left and right
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 9999,
    };

    confetti({ ...defaults, particleCount: 80, origin: { x: 0.2, y: 0.6 } });
    setTimeout(() => {
      confetti({
        ...defaults,
        particleCount: 80,
        origin: { x: 0.8, y: 0.6 },
      });
    }, 200);

    // Auto-dismiss after 30 seconds
    const timer = setTimeout(onDismiss, 30_000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="px-5 py-6 text-center"
    >
      {/* Trophy icon */}
      <Trophy className="w-10 h-10 text-amber-500 mx-auto mb-2" />

      {/* Heading */}
      <h3 className="text-xl font-bold text-emerald-500 mb-1">
        Boss besiegt!
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        &ldquo;{bossName}&rdquo; wurde vernichtet
      </p>

      {/* MVP */}
      <div className="flex items-center justify-center gap-1.5 mb-3">
        <Crown className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-semibold text-foreground">
          MVP: {mvpUserName}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <span>
          Gesamtschaden:{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {totalDamage}
          </span>
        </span>
        <span>
          Runen verdient:{" "}
          <span className="font-semibold text-violet-500 tabular-nums">
            +{runenEarned}
          </span>
        </span>
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={onDismiss}
        className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Schliessen
      </button>
    </motion.div>
  );
}
