"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Calendar,
  ArrowRightLeft,
  Clock,
  Loader2,
} from "lucide-react";

// Map AktenActivityTyp to icons
const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> =
  {
    DOKUMENT: FileText,
    FRIST: Calendar,
    STATUS_CHANGE: ArrowRightLeft,
  };

// German date formatter
const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

interface TimelineEvent {
  id: string;
  typ: string;
  titel: string;
  inhalt: string | null;
  createdAt: string;
}

interface TimelineResponse {
  items: TimelineEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function SachstandTimeline({ akteId }: { akteId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTimeline = useCallback(
    async (cursor?: string | null) => {
      const params = new URLSearchParams({ take: "20" });
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(
        `/api/portal/akten/${akteId}/timeline?${params.toString()}`
      );

      if (!res.ok) {
        console.error("Failed to fetch timeline:", res.status);
        return null;
      }

      return (await res.json()) as TimelineResponse;
    },
    [akteId]
  );

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const data = await fetchTimeline();
      if (!cancelled && data) {
        setEvents(data.items);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [fetchTimeline]);

  // Load more handler
  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);

    const data = await fetchTimeline(nextCursor);
    if (data) {
      setEvents((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    }
    setLoadingMore(false);
  }

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Sachstand wird geladen...
        </span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Noch keine Eintraege vorhanden.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-5 border border-[var(--glass-border-color)]">
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
        Sachstand
      </h2>

      {/* Timeline list with left border line */}
      <div className="relative pl-6">
        {/* Vertical connector line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--glass-border-color)]" />

        <div className="space-y-4">
          {events.map((event) => {
            const Icon = TYPE_ICONS[event.typ] ?? Clock;
            const date = dateFormatter.format(new Date(event.createdAt));

            return (
              <div key={event.id} className="relative flex gap-3">
                {/* Timeline dot/icon */}
                <div className="absolute -left-6 top-0.5 flex items-center justify-center w-[15px] h-[15px] rounded-full bg-[var(--glass-card-bg)] border border-[var(--glass-border-color)]">
                  <Icon className="w-2.5 h-2.5 text-muted-foreground" />
                </div>

                {/* Event content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {date}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {event.titel}
                  </p>
                  {event.inhalt && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3 leading-relaxed">
                      {event.inhalt}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Laden...
              </>
            ) : (
              "Mehr laden"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
