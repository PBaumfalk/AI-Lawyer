"use client";

import {
  Frame,
  Image,
  Type,
  Sparkles,
  Zap,
  Loader2,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { RarityBadge } from "./rarity-badge";
import {
  ITEM_TYP_LABELS,
  type ShopItemRarity,
  type ShopItemTyp,
} from "@/lib/gamification/types";

const ITEM_TYPE_ICONS: Record<
  ShopItemTyp,
  React.ComponentType<{ className?: string }>
> = {
  AVATAR_RAHMEN: Frame,
  BANNER: Image,
  PROFIL_TITEL: Type,
  ABSCHLUSS_ANIMATION: Sparkles,
  PERK: Zap,
};

interface InventoryItemProps {
  item: {
    id: string;
    ausgeruestet: boolean;
    verbraucht: boolean;
    shopItem: {
      name: string;
      typ: ShopItemTyp;
      rarity: ShopItemRarity;
      metadata: Record<string, unknown>;
    };
  };
  onEquipToggle: (inventoryItemId: string, equip: boolean) => Promise<void>;
  onActivate: (inventoryItemId: string) => Promise<void>;
  loading: boolean;
}

export function InventoryItem({
  item,
  onEquipToggle,
  onActivate,
  loading,
}: InventoryItemProps) {
  const Icon = ITEM_TYPE_ICONS[item.shopItem.typ];
  const isPerk = item.shopItem.typ === "PERK";

  function renderAction() {
    if (isPerk) {
      if (item.verbraucht) {
        return (
          <span className="text-sm text-muted-foreground">Verbraucht</span>
        );
      }
      return (
        <Button
          size="sm"
          disabled={loading}
          onClick={() => onActivate(item.id)}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : null}
          Aktivieren
        </Button>
      );
    }

    // Cosmetic item
    if (item.ausgeruestet) {
      return (
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => onEquipToggle(item.id, false)}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : null}
          Ablegen
        </Button>
      );
    }

    return (
      <Button
        size="sm"
        disabled={loading}
        onClick={() => onEquipToggle(item.id, true)}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-1" />
        ) : null}
        Ausruesten
      </Button>
    );
  }

  return (
    <GlassCard className="flex items-center justify-between p-3 gap-3">
      {/* Left: icon + name + rarity */}
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {item.shopItem.name}
            </span>
            <RarityBadge rarity={item.shopItem.rarity} />
          </div>
          <span className="text-xs text-muted-foreground">
            {ITEM_TYP_LABELS[item.shopItem.typ]}
          </span>
        </div>
      </div>

      {/* Right: action button */}
      {renderAction()}
    </GlassCard>
  );
}
