"use client";

import { Swords, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface BossfightHistoryProps {
  history: Array<{
    id: string;
    name: string;
    spawnHp: number;
    currentHp: number;
    status: string;
    spawnedAt: string;
    defeatedAt: string | null;
    totalDamage: number;
  }>;
}

export function BossfightHistory({ history }: BossfightHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Shield className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Noch keine Bossfights</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((bf) => {
        const isActive = bf.status === "ACTIVE";
        const date = new Date(
          isActive ? bf.spawnedAt : (bf.defeatedAt ?? bf.spawnedAt),
        ).toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });

        return (
          <div
            key={bf.id}
            className="flex items-center gap-4 rounded-lg border border-border/50 p-3"
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                isActive
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
              )}
            >
              <Swords className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{bf.name}</p>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    isActive
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {isActive ? "Aktiv" : "Besiegt"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {date} &middot; HP: {bf.currentHp}/{bf.spawnHp}
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm font-semibold">{bf.totalDamage}</p>
              <p className="text-xs text-muted-foreground">Teamschaden</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
