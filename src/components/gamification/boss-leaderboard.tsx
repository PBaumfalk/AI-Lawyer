"use client";

import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  userId: string;
  userName: string;
  totalDamage: number;
}

interface BossLeaderboardProps {
  entries: LeaderboardEntry[];
}

const RANK_COLORS: Record<number, string> = {
  1: "text-amber-500",   // gold
  2: "text-zinc-400",    // silver
  3: "text-amber-700",   // bronze
};

/**
 * Top 3 damage dealers during the active boss fight.
 * Compact list with rank badges and damage counts.
 */
export function BossLeaderboard({ entries }: BossLeaderboardProps) {
  const top3 = entries.slice(0, 3);

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">
        Top Angreifer
      </p>
      {top3.length === 0 ? (
        <p className="text-xs text-muted-foreground/50 py-1">
          Noch keine Treffer
        </p>
      ) : (
        <div className="space-y-0.5">
          {top3.map((entry, i) => {
            const rank = i + 1;
            return (
              <div
                key={entry.userId}
                className="flex items-center gap-2 text-xs py-0.5"
              >
                {/* Rank badge */}
                <span
                  className={cn(
                    "w-4 text-center font-bold tabular-nums",
                    RANK_COLORS[rank] ?? "text-muted-foreground",
                  )}
                >
                  {rank}
                </span>

                {/* Name */}
                <span className="flex-1 truncate text-foreground">
                  {entry.userName}
                </span>

                {/* Damage */}
                <span className="text-muted-foreground tabular-nums font-mono">
                  {entry.totalDamage}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
