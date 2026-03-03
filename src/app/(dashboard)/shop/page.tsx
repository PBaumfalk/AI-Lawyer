"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Gem,
  Loader2,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";

import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShopItemCard } from "@/components/gamification/shop-item-card";
import { InventoryItem } from "@/components/gamification/inventory-item";
import {
  ITEM_TYP_LABELS,
  type ShopItemRarity,
  type ShopItemTyp,
} from "@/lib/gamification/types";

// ---- Response types (mirrors API shape) ------------------------------------

interface ShopItem {
  id: string;
  slug: string;
  name: string;
  beschreibung: string | null;
  typ: ShopItemTyp;
  rarity: ShopItemRarity;
  preis: number;
  aktiv: boolean;
  sortierung: number;
  metadata: Record<string, unknown>;
}

interface InventoryEntry {
  id: string;
  userId: string;
  shopItemId: string;
  ausgeruestet: boolean;
  verbraucht: boolean;
  purchasedAt: string;
  activatedAt: string | null;
  shopItem: {
    id: string;
    slug: string;
    name: string;
    beschreibung: string | null;
    typ: ShopItemTyp;
    rarity: ShopItemRarity;
    preis: number;
    metadata: Record<string, unknown>;
  };
}

interface ShopResponse {
  runen: number;
  level: number;
  items: ShopItem[];
  inventory: InventoryEntry[];
}

// ---- Category filter type --------------------------------------------------

type Category = "all" | "cosmetic" | "perk";

// ---- Page component --------------------------------------------------------

export default function ShopPage() {
  const [data, setData] = useState<ShopResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("shop");
  const [category, setCategory] = useState<Category>("all");
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // ---- Fetch ---------------------------------------------------------------

  const fetchShop = useCallback(async () => {
    try {
      const res = await fetch("/api/gamification/shop");
      if (res.status === 404) {
        setLoaded(true);
        return;
      }
      if (!res.ok) {
        setLoaded(true);
        return;
      }
      setData(await res.json());
    } catch {
      // silent -- absent-until-loaded
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchShop();
  }, [fetchShop]);

  // ---- Purchase handler ----------------------------------------------------

  const handlePurchase = useCallback(
    async (shopItemId: string) => {
      setPurchasingId(shopItemId);
      try {
        const res = await fetch("/api/gamification/shop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shopItemId }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || "Kauf fehlgeschlagen");
          return;
        }
        toast.success("Gegenstand erworben!");
        await fetchShop();
      } catch {
        toast.error("Kauf fehlgeschlagen");
      } finally {
        setPurchasingId(null);
      }
    },
    [fetchShop]
  );

  // ---- Equip handler -------------------------------------------------------

  const handleEquipToggle = useCallback(
    async (inventoryItemId: string, equip: boolean) => {
      setActionLoadingId(inventoryItemId);
      try {
        const res = await fetch("/api/gamification/shop/equip", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inventoryItemId, equip }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || "Aktion fehlgeschlagen");
          return;
        }
        toast.success(equip ? "Ausgeruestet!" : "Abgelegt!");
        await fetchShop();
      } catch {
        toast.error("Aktion fehlgeschlagen");
      } finally {
        setActionLoadingId(null);
      }
    },
    [fetchShop]
  );

  // ---- Activate handler ----------------------------------------------------

  const handleActivate = useCallback(
    async (inventoryItemId: string) => {
      setActionLoadingId(inventoryItemId);
      try {
        const res = await fetch("/api/gamification/shop/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inventoryItemId }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || "Aktivierung fehlgeschlagen");
          return;
        }
        toast.success("Perk aktiviert!");
        await fetchShop();
      } catch {
        toast.error("Aktivierung fehlgeschlagen");
      } finally {
        setActionLoadingId(null);
      }
    },
    [fetchShop]
  );

  // ---- Derived data --------------------------------------------------------

  const filteredItems = useMemo(() => {
    if (!data) return [];
    if (category === "cosmetic")
      return data.items.filter((i) => i.typ !== "PERK");
    if (category === "perk")
      return data.items.filter((i) => i.typ === "PERK");
    return data.items;
  }, [data, category]);

  // Owned cosmetic IDs (perks can be re-purchased)
  const ownedCosmeticIds = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(
      data.inventory
        .filter((i) => i.shopItem.typ !== "PERK")
        .map((i) => i.shopItemId)
    );
  }, [data]);

  // Group inventory items by type label for the Inventar tab
  const groupedInventory = useMemo(() => {
    if (!data) return new Map<string, InventoryEntry[]>();
    const groups = new Map<string, InventoryEntry[]>();

    // Cosmetics first, then perks
    const cosmetics = data.inventory.filter((i) => i.shopItem.typ !== "PERK");
    const perks = data.inventory.filter((i) => i.shopItem.typ === "PERK");

    for (const item of cosmetics) {
      const label = ITEM_TYP_LABELS[item.shopItem.typ];
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(item);
    }
    if (perks.length > 0) {
      groups.set("Perks", perks);
    }

    return groups;
  }, [data]);

  // ---- Loading state -------------------------------------------------------

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Absent-until-loaded: opted-out user (404 or no data)
  if (!data) return null;

  // ---- Render --------------------------------------------------------------

  const categories: { key: Category; label: string }[] = [
    { key: "all", label: "Alle" },
    { key: "cosmetic", label: "Kosmetik" },
    { key: "perk", label: "Perks" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Runen-Shop</h1>
        <GlassCard className="flex items-center gap-2 px-4 py-2">
          <Gem className="w-5 h-5 text-violet-400" />
          <span className="font-semibold">{data.runen} Runen</span>
        </GlassCard>
      </div>

      {/* Tabs: Shop + Inventar */}
      <Tabs
        defaultValue="shop"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList>
          <TabsTrigger value="shop">Shop</TabsTrigger>
          <TabsTrigger value="inventar">Inventar</TabsTrigger>
        </TabsList>

        {/* ---- Shop Tab ---- */}
        <TabsContent value="shop">
          {/* Category filter */}
          <div className="flex gap-2 mb-4">
            {categories.map((cat) => (
              <Button
                key={cat.key}
                variant={category === cat.key ? "default" : "outline"}
                size="sm"
                onClick={() => setCategory(cat.key)}
              >
                {cat.label}
              </Button>
            ))}
          </div>

          {/* Item grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
              <ShopItemCard
                key={item.id}
                item={item}
                userLevel={data.level}
                userRunen={data.runen}
                alreadyOwned={ownedCosmeticIds.has(item.id)}
                isPerk={item.typ === "PERK"}
                onPurchase={handlePurchase}
                purchasing={purchasingId === item.id}
              />
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShoppingBag className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">Keine Gegenstaende in dieser Kategorie.</p>
            </div>
          )}
        </TabsContent>

        {/* ---- Inventar Tab ---- */}
        <TabsContent value="inventar">
          {data.inventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShoppingBag className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm mb-2">
                Noch keine Gegenstaende erworben.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("shop")}
              >
                Besuche den Shop!
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(groupedInventory.entries()).map(
                ([groupLabel, items]) => (
                  <div key={groupLabel}>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      {groupLabel}
                    </h3>
                    <div className="space-y-2">
                      {items.map((entry) => (
                        <InventoryItem
                          key={entry.id}
                          item={entry}
                          onEquipToggle={handleEquipToggle}
                          onActivate={handleActivate}
                          loading={actionLoadingId === entry.id}
                        />
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
