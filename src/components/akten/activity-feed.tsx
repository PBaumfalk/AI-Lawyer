"use client";

import { useState, useEffect, useCallback } from "react";
import { Filter, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ActivityFeedEntry, type FeedEntryData } from "./activity-feed-entry";
import { ActivityFeedSkeleton } from "./activity-feed-skeleton";

interface ActivityFeedProps {
  akteId: string;
}

// Filter chip definitions mapping to AktenActivityTyp values
const feedFilters = [
  { label: "Alle", types: null },
  { label: "Dokumente", types: ["DOKUMENT"] },
  { label: "Fristen", types: ["FRIST"] },
  { label: "E-Mails", types: ["EMAIL"] },
  { label: "Helena", types: ["HELENA_DRAFT", "HELENA_ALERT"] },
  { label: "Notizen", types: ["NOTIZ"] },
  { label: "Status", types: ["BETEILIGTE", "STATUS_CHANGE"] },
] as const;

export function ActivityFeed({ akteId }: ActivityFeedProps) {
  const [entries, setEntries] = useState<FeedEntryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState(0);

  const fetchFeed = useCallback(
    async (cursor?: string, types?: readonly string[] | null) => {
      const params = new URLSearchParams({ take: "20" });
      if (cursor) params.set("cursor", cursor);
      if (types && types.length > 0) params.set("typ", types.join(","));

      const res = await fetch(`/api/akten/${akteId}/feed?${params}`);
      if (!res.ok) throw new Error("Fehler beim Laden des Feeds");
      return res.json() as Promise<{
        items: FeedEntryData[];
        nextCursor: string | null;
        hasMore: boolean;
      }>;
    },
    [akteId]
  );

  // Initial load and filter change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const types = feedFilters[activeFilter]?.types ?? null;

    fetchFeed(undefined, types)
      .then((data) => {
        if (!cancelled) {
          setEntries(data.items);
          setNextCursor(data.nextCursor);
          setHasMore(data.hasMore);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEntries([]);
          setHasMore(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeFilter, fetchFeed]);

  // Load more handler
  async function loadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);
    try {
      const types = feedFilters[activeFilter]?.types ?? null;
      const data = await fetchFeed(nextCursor, types);
      setEntries((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      // Silently fail on load-more
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Filter chips bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-400" />
        {feedFilters.map((f, i) => (
          <button
            key={f.label}
            onClick={() => setActiveFilter(i)}
            className={cn(
              "px-3 py-1 text-xs rounded-full border transition-colors",
              activeFilter === i
                ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Entry list */}
      {loading && entries.length === 0 ? (
        <ActivityFeedSkeleton />
      ) : entries.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center text-sm text-slate-400">
          Keine Aktivitaeten vorhanden.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <ActivityFeedEntry key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ChevronDown className="w-4 h-4 mr-2" />
            )}
            Mehr laden
          </Button>
        </div>
      )}
    </div>
  );
}
