"use client";

import { Scale, FileText, Shield, Crown, Gem, Flame } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { AvatarFrame } from "@/components/gamification/avatar-frame";
import { XpProgressBar } from "@/components/gamification/xp-progress-bar";
import type { ShopItemRarity } from "@/lib/gamification/types";

// ---- Class icon / label mappings -------------------------------------------

const CLASS_ICONS: Record<string, LucideIcon> = {
  JURIST: Scale,
  SCHREIBER: FileText,
  WAECHTER: Shield,
  QUARTIERMEISTER: Crown,
};

const CLASS_LABELS: Record<string, string> = {
  JURIST: "Jurist",
  SCHREIBER: "Schreiber",
  WAECHTER: "Waechter",
  QUARTIERMEISTER: "Quartiermeister",
};

// ---- Rarity order for picking highest-rarity equipped cosmetic -------------

const RARITY_ORDER: Record<string, number> = {
  COMMON: 0,
  RARE: 1,
  EPIC: 2,
  LEGENDARY: 3,
};

// ---- Props -----------------------------------------------------------------

interface HeroCardProps {
  klasse: string;
  level: number;
  levelTitle: string;
  xp: number;
  xpInLevel: number;
  xpNeeded: number;
  progress: number;
  runen: number;
  streakTage: number;
  equippedCosmetics: {
    typ: string;
    name: string;
    rarity: string;
    metadata: Record<string, unknown>;
  }[];
}

// ---- Component -------------------------------------------------------------

export function HeroCard({
  klasse,
  level,
  levelTitle,
  xpInLevel,
  xpNeeded,
  progress,
  runen,
  streakTage,
  equippedCosmetics,
}: HeroCardProps) {
  // Determine highest rarity among equipped cosmetics for the avatar frame ring
  const highestRarity: ShopItemRarity =
    equippedCosmetics.length > 0
      ? (equippedCosmetics.reduce((best, c) => {
          const bestRank = RARITY_ORDER[best.rarity] ?? 0;
          const currentRank = RARITY_ORDER[c.rarity] ?? 0;
          return currentRank > bestRank ? c : best;
        }).rarity as ShopItemRarity)
      : "COMMON";

  const ClassIcon = CLASS_ICONS[klasse] ?? Scale;
  const classLabel = CLASS_LABELS[klasse] ?? klasse;

  return (
    <GlassCard className="p-6 md:p-8">
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start">
        {/* Left side: Avatar with class icon inside frame */}
        <div className="flex-shrink-0">
          <AvatarFrame rarity={highestRarity} className="p-1">
            <div className="w-24 h-24 rounded-full bg-[oklch(45%_0.2_260/0.15)] dark:bg-[oklch(45%_0.2_260/0.25)] flex items-center justify-center">
              <ClassIcon className="w-16 h-16 text-[oklch(45%_0.2_260)] dark:text-[oklch(70%_0.15_260)]" />
            </div>
          </AvatarFrame>
        </div>

        {/* Right side: Info */}
        <div className="flex-1 min-w-0 space-y-4 text-center md:text-left w-full">
          {/* Class + Level */}
          <div>
            <h2 className="text-xl font-bold">
              {classLabel} &ndash; Level {level}
            </h2>
            <p className="text-sm text-muted-foreground">{levelTitle}</p>
          </div>

          {/* XP Bar */}
          <XpProgressBar
            progress={progress}
            xpCurrent={xpInLevel}
            xpNeeded={xpNeeded}
          />

          {/* Stats row */}
          <div className="flex items-center justify-center md:justify-start gap-6">
            <div className="flex items-center gap-1.5">
              <Gem className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium">{runen} Runen</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium">
                {streakTage} {streakTage === 1 ? "Tag" : "Tage"} Streak
              </span>
            </div>
          </div>

          {/* Equipped cosmetics */}
          {equippedCosmetics.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">
                Ausgeruestet
              </p>
              <div className="flex flex-wrap gap-1.5">
                {equippedCosmetics.map((c) => (
                  <span
                    key={c.name}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-white/10 dark:bg-white/[0.06] text-muted-foreground"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
