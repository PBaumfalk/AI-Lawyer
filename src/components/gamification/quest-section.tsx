"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { differenceInDays } from "date-fns";

import { cn } from "@/lib/utils";
import { buildQuestDeepLink } from "./quest-deep-link";
import type { QuestCondition } from "@/lib/gamification/types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SectionQuest {
  id: string;
  name: string;
  beschreibung: string;
  bedingung: QuestCondition;
  xpBelohnung: number;
  runenBelohnung: number;
  current: number;
  target: number;
  completed: boolean;
  awarded: boolean;
  endDatum?: string;
}

interface QuestSectionProps {
  title: string;
  quests: SectionQuest[];
  /** Show countdown badge with remaining days (for SPECIAL quests) */
  showCountdown?: boolean;
}

/**
 * QuestSection -- Reusable section renderer for grouped quests.
 *
 * Displays a section header (e.g. "Tagesquests", "Wochenquests", "Special"),
 * quest rows with deep-link navigation, and optional countdown badge.
 */
export function QuestSection({ title, quests, showCountdown }: QuestSectionProps) {
  const router = useRouter();

  return (
    <div className="px-2 py-2">
      {/* Section header */}
      <div className="px-3 py-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </span>
      </div>

      {/* Quest rows */}
      {quests.map((quest) => {
        const daysLeft =
          showCountdown && quest.endDatum
            ? Math.max(0, differenceInDays(new Date(quest.endDatum), new Date()))
            : null;

        return (
          <button
            key={quest.id}
            type="button"
            onClick={() => router.push(buildQuestDeepLink(quest.bedingung))}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left hover:bg-white/30 dark:hover:bg-white/[0.05] transition-colors group"
          >
            {/* Completion indicator */}
            {quest.awarded ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
            )}

            {/* Quest description */}
            <span
              className={cn(
                "text-sm flex-1 min-w-0 truncate",
                quest.awarded && "line-through text-muted-foreground",
              )}
            >
              {quest.beschreibung}
            </span>

            {/* Countdown badge for special quests */}
            {daysLeft !== null && (
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded whitespace-nowrap">
                {daysLeft === 0 ? "Letzter Tag" : `${daysLeft}d`}
              </span>
            )}

            {/* Progress fraction */}
            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              {quest.current}/{quest.target}
            </span>

            {/* Reward */}
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {quest.xpBelohnung} XP
              {quest.runenBelohnung > 0 && ` + ${quest.runenBelohnung} R`}
            </span>

            {/* Chevron (visible on hover) */}
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
