"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  RARITY_LABELS,
  RARITY_COLORS,
  type ShopItemRarity,
} from "@/lib/gamification/types";

interface RarityBadgeProps {
  rarity: ShopItemRarity;
  className?: string;
}

export function RarityBadge({ rarity, className }: RarityBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-medium",
        RARITY_COLORS[rarity],
        className
      )}
    >
      {RARITY_LABELS[rarity]}
    </Badge>
  );
}
