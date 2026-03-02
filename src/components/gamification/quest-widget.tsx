"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Gem, CheckCircle2, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/glass-card";
import { XpProgressBar } from "./xp-progress-bar";
import { buildQuestDeepLink } from "./quest-deep-link";
import type { QuestCondition } from "@/lib/gamification/types";

// ─── Response types (mirrors API shape) ────────────────────────────────────

interface DashboardProfile {
  level: number;
  levelTitle: string;
  xp: number;
  xpInLevel: number;
  xpNeeded: number;
  progress: number;
  runen: number;
  streakTage: number;
}

interface DashboardQuest {
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
}

interface GroupedQuests {
  daily: DashboardQuest[];
  weekly: DashboardQuest[];
  special: DashboardQuest[];
}

interface DashboardData {
  profile: DashboardProfile;
  quests: GroupedQuests;
}

/**
 * QuestWidget -- Self-fetching client component for the dashboard.
 *
 * Shows daily quests, XP progress bar, level title, streak count, and Runen balance.
 * Each quest row is clickable and navigates to the filtered view via deep-link.
 *
 * Graceful degradation:
 * - Returns null if user is opted out (404 from API)
 * - Returns null on API error (rest of dashboard renders normally)
 * - Returns null until first fetch completes (absent-until-loaded, no flicker)
 */
export function QuestWidget() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboard() {
      try {
        const res = await fetch("/api/gamification/dashboard");

        if (cancelled) return;

        // 404 = user opted out, render nothing
        if (res.status === 404) {
          setData(null);
          setLoaded(true);
          return;
        }

        if (!res.ok) {
          console.error("QuestWidget: failed to load gamification data");
          setError(true);
          setLoaded(true);
          return;
        }

        const json: DashboardData = await res.json();
        setData(json);
        setLoaded(true);
      } catch {
        if (!cancelled) {
          console.error("QuestWidget: failed to load gamification data");
          setError(true);
          setLoaded(true);
        }
      }
    }

    fetchDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  // Absent-until-loaded: no placeholder, no empty space
  if (!loaded || error || data === null) {
    return null;
  }

  const { profile, quests } = data;

  // Flatten grouped quests for rendering (Plan 02 adds proper section headers)
  const allQuests = [
    ...quests.daily,
    ...quests.weekly,
    ...quests.special,
  ];

  return (
    <GlassCard className="p-0">
      {/* Header: Level info + badges + XP bar */}
      <div className="px-5 py-4 border-b border-[var(--glass-border-color)]">
        <div className="flex items-center justify-between">
          {/* Left: level title + level number */}
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-foreground">
              {profile.levelTitle}
            </span>
            <span className="text-xs text-foreground/70">
              Lv. {profile.level}
            </span>
          </div>

          {/* Right: streak + Runen badges */}
          <div className="flex items-center gap-2">
            {profile.streakTage > 0 && (
              <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full text-[11px] font-medium">
                <Flame className="w-3 h-3" />
                {profile.streakTage}
              </span>
            )}
            <span className="inline-flex items-center gap-1 bg-violet-500/15 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full text-[11px] font-medium">
              <Gem className="w-3 h-3" />
              {profile.runen}
            </span>
          </div>
        </div>

        {/* XP progress bar */}
        <div className="mt-2">
          <XpProgressBar
            progress={profile.progress}
            xpCurrent={profile.xpInLevel}
            xpNeeded={profile.xpNeeded}
          />
        </div>
      </div>

      {/* Quest list */}
      <div className="px-2 py-2">
        {allQuests.map((quest) => (
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
        ))}
      </div>
    </GlassCard>
  );
}
