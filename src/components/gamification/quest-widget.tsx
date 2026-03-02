"use client";

import { useEffect, useState } from "react";
import { Flame, Gem } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { XpProgressBar } from "./xp-progress-bar";
import { QuestSection } from "./quest-section";
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
  dailyRunenUsed: number;
  dailyRunenCap: number;
}

interface DashboardQuest {
  id: string;
  name: string;
  typ: "DAILY" | "WEEKLY" | "SPECIAL";
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
 * Shows grouped quest sections (daily, weekly, special), XP progress bar,
 * level title, streak count, and Runen balance.
 * Each quest row is clickable and navigates to the filtered view via deep-link.
 *
 * Graceful degradation:
 * - Returns null if user is opted out (404 from API)
 * - Returns null on API error (rest of dashboard renders normally)
 * - Returns null until first fetch completes (absent-until-loaded, no flicker)
 */
export function QuestWidget() {
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

  const hasDaily = quests.daily.length > 0;
  const hasWeekly = quests.weekly.length > 0;
  const hasSpecial = quests.special.length > 0;

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

        {/* Daily Runen cap indicator (shown at 80%+ usage) */}
        {profile.dailyRunenUsed >= profile.dailyRunenCap * 0.8 && (
          <div className="mt-1 text-[10px] text-foreground/50">
            {profile.dailyRunenUsed >= profile.dailyRunenCap
              ? "Runen-Limit erreicht — XP wird weiterhin vergeben"
              : `Runen ${profile.dailyRunenUsed}/${profile.dailyRunenCap}`}
          </div>
        )}

        {/* XP progress bar */}
        <div className="mt-2">
          <XpProgressBar
            progress={profile.progress}
            xpCurrent={profile.xpInLevel}
            xpNeeded={profile.xpNeeded}
          />
        </div>
      </div>

      {/* Grouped quest sections */}

      {/* Daily quests section */}
      {hasDaily && (
        <QuestSection title="Tagesquests" quests={quests.daily} />
      )}

      {/* Divider between daily and weekly (only if both exist) */}
      {hasDaily && hasWeekly && (
        <div className="mx-5 border-t border-[var(--glass-border-color)]" />
      )}

      {/* Weekly quests section */}
      {hasWeekly && (
        <QuestSection title="Wochenquests" quests={quests.weekly} />
      )}

      {/* Divider before special (if special exists and something is above it) */}
      {hasSpecial && (hasDaily || hasWeekly) && (
        <div className="mx-5 border-t border-[var(--glass-border-color)]" />
      )}

      {/* Special quests section with amber accent border */}
      {hasSpecial && (
        <div className="border-l-2 border-amber-500/60 ml-2">
          <QuestSection
            title="Special"
            quests={quests.special}
            showCountdown
          />
        </div>
      )}
    </GlassCard>
  );
}
