"use client";

import { cn } from "@/lib/utils";
import type { ShopItemRarity } from "@/lib/gamification/types";

const RARITY_RINGS: Record<ShopItemRarity, string> = {
  COMMON: "ring-2 ring-[oklch(75%_0.05_250)]",
  RARE: "ring-2 ring-[oklch(60%_0.15_250)]",
  EPIC: "ring-2 ring-[oklch(55%_0.2_300)]",
  LEGENDARY:
    "ring-2 ring-[oklch(75%_0.18_85)] shadow-lg shadow-amber-500/20",
};

interface AvatarFrameProps {
  children: React.ReactNode;
  rarity: ShopItemRarity | null;
  className?: string;
}

export function AvatarFrame({ children, rarity, className }: AvatarFrameProps) {
  if (!rarity) {
    return <>{children}</>;
  }

  return (
    <div className={cn("rounded-full", RARITY_RINGS[rarity], className)}>
      {children}
    </div>
  );
}
