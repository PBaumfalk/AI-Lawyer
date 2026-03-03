"use client";

import { useState } from "react";
import {
  Frame,
  Image,
  Type,
  Sparkles,
  Zap,
  Gem,
  Loader2,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RarityBadge } from "./rarity-badge";
import {
  ITEM_TYP_LABELS,
  LEGENDARY_LEVEL_GATE,
  type ShopItemRarity,
  type ShopItemTyp,
} from "@/lib/gamification/types";
import { cn } from "@/lib/utils";

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

interface ShopItemCardProps {
  item: {
    id: string;
    name: string;
    beschreibung: string | null;
    typ: ShopItemTyp;
    rarity: ShopItemRarity;
    preis: number;
    metadata: Record<string, unknown>;
  };
  userLevel: number;
  userRunen: number;
  alreadyOwned: boolean;
  isPerk: boolean;
  onPurchase: (itemId: string) => Promise<void>;
  purchasing: boolean;
}

export function ShopItemCard({
  item,
  userLevel,
  userRunen,
  alreadyOwned,
  isPerk,
  onPurchase,
  purchasing,
}: ShopItemCardProps) {
  const [open, setOpen] = useState(false);
  const Icon = ITEM_TYPE_ICONS[item.typ];

  const isLevelGated =
    item.rarity === "LEGENDARY" && userLevel < LEGENDARY_LEVEL_GATE;
  const insufficientRunen = userRunen < item.preis;
  const canBuy = !alreadyOwned && !isLevelGated && !insufficientRunen;

  function renderButton() {
    // Already owned cosmetic (perks can be re-purchased)
    if (alreadyOwned && !isPerk) {
      return (
        <Button variant="outline" disabled className="w-full">
          Bereits erworben
        </Button>
      );
    }

    // Level gate for legendary items
    if (isLevelGated) {
      return (
        <Button variant="outline" disabled className="w-full text-xs">
          Level {LEGENDARY_LEVEL_GATE} erforderlich (Dein Level: {userLevel})
        </Button>
      );
    }

    // Insufficient balance
    if (insufficientRunen) {
      return (
        <Button variant="outline" disabled className="w-full">
          Nicht genuegend Runen
        </Button>
      );
    }

    // Can buy -- show with AlertDialog confirmation
    return (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button className="w-full" disabled={purchasing}>
            {purchasing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Kaufen
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{item.name} kaufen?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-1">
              <span className="block">
                Preis: {item.preis} Runen
              </span>
              <span className="block">
                Dein Guthaben: {userRunen} Runen
              </span>
              <span className="block font-medium">
                Nach Kauf: {userRunen - item.preis} Runen
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setOpen(false);
                await onPurchase(item.id);
              }}
            >
              Bestaetigen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <GlassCard
      className={cn(
        "flex flex-col p-4 gap-3 hover:border-foreground/10 transition-colors"
      )}
    >
      {/* Top row: type icon + rarity badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="w-4 h-4" />
          <span className="text-xs">{ITEM_TYP_LABELS[item.typ]}</span>
        </div>
        <RarityBadge rarity={item.rarity} />
      </div>

      {/* Name */}
      <h3 className="font-bold truncate">{item.name}</h3>

      {/* Description */}
      {item.beschreibung && (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {item.beschreibung}
        </p>
      )}

      {/* Spacer to push price + button to bottom */}
      <div className="flex-1" />

      {/* Price row */}
      <div className="flex items-center justify-end gap-1.5 text-sm">
        <Gem className="w-4 h-4 text-violet-400" />
        <span className="font-semibold">{item.preis} Runen</span>
      </div>

      {/* Buy button */}
      {renderButton()}
    </GlassCard>
  );
}
