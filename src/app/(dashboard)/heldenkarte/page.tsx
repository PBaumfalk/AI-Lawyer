"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { HeroCard } from "@/components/gamification/hero-card";
import { BadgeShowcase } from "@/components/gamification/badge-showcase";
import { QuestHistoryTable } from "@/components/gamification/quest-history-table";

// ---- API response types (mirrors GET /api/gamification/heldenkarte) --------

interface HeldenkartResponse {
  profile: {
    klasse: string;
    level: number;
    levelTitle: string;
    xp: number;
    xpInLevel: number;
    xpNeeded: number;
    progress: number;
    runen: number;
    streakTage: number;
  };
  equippedCosmetics: {
    typ: string;
    name: string;
    rarity: string;
    metadata: Record<string, unknown>;
  }[];
  badges: {
    slug: string;
    name: string;
    beschreibung: string;
    icon: string;
    earned: boolean;
    earnedAt: string | null;
  }[];
  questHistory: {
    items: {
      id: string;
      questName: string;
      questTyp: string;
      xpVerdient: number;
      runenVerdient: number;
      completedAt: string;
    }[];
    total: number;
    page: number;
    pageSize: number;
  };
}

// ---- Page component --------------------------------------------------------

export default function HeldenkartePage() {
  const [data, setData] = useState<HeldenkartResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);

  // Fetch data from combined endpoint
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/gamification/heldenkarte?page=${page}`);
      if (res.status === 404) {
        // Opted-out user
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
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Heldenkarte</h1>

      <HeroCard
        {...data.profile}
        equippedCosmetics={data.equippedCosmetics}
      />

      <BadgeShowcase badges={data.badges} />

      <QuestHistoryTable
        items={data.questHistory.items}
        total={data.questHistory.total}
        page={data.questHistory.page}
        pageSize={data.questHistory.pageSize}
        onPageChange={setPage}
      />
    </div>
  );
}
