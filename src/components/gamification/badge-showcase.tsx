"use client";

import {
  Clock,
  FolderOpen,
  Flame,
  Swords,
  ScrollText,
  Zap,
  Gem,
  Shield,
  Lock,
  HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { format, parseISO } from "date-fns";

import { GlassCard } from "@/components/ui/glass-card";

// ---- Badge icon lookup -----------------------------------------------------

const BADGE_ICONS: Record<string, LucideIcon> = {
  Clock,
  FolderOpen,
  Flame,
  Swords,
  ScrollText,
  Zap,
  Gem,
  Shield,
};

// ---- Props -----------------------------------------------------------------

interface BadgeShowcaseProps {
  badges: {
    slug: string;
    name: string;
    beschreibung: string;
    icon: string;
    earned: boolean;
    earnedAt: string | null;
  }[];
}

// ---- Component -------------------------------------------------------------

export function BadgeShowcase({ badges }: BadgeShowcaseProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Abzeichen</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {badges.map((badge) => {
          const IconComponent = badge.earned
            ? BADGE_ICONS[badge.icon] ?? HelpCircle
            : Lock;

          return (
            <GlassCard
              key={badge.slug}
              className={`p-4 flex flex-col items-center text-center gap-2 transition-opacity ${
                badge.earned
                  ? "border border-emerald-500/20 dark:border-emerald-400/15"
                  : "opacity-40"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  badge.earned
                    ? "bg-emerald-500/10 dark:bg-emerald-400/10"
                    : "bg-white/5 dark:bg-white/[0.03]"
                }`}
              >
                <IconComponent
                  className={`w-5 h-5 ${
                    badge.earned
                      ? "text-emerald-500 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }`}
                />
              </div>
              <p className="text-sm font-medium leading-tight">{badge.name}</p>
              <p className="text-xs text-muted-foreground leading-tight">
                {badge.earned ? badge.beschreibung : "???"}
              </p>
              {badge.earned && badge.earnedAt && (
                <p className="text-[10px] text-muted-foreground">
                  {format(parseISO(badge.earnedAt), "dd.MM.yyyy")}
                </p>
              )}
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
