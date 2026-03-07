"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Filter, ChevronDown, Loader2, RefreshCw, Mail, MessageSquare, Clock, MailOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ActivityFeedEntry, type FeedEntryData } from "./activity-feed-entry";
import { ActivityFeedSkeleton } from "./activity-feed-skeleton";
import { ActivityFeedComposer } from "./activity-feed-composer";
import { HelenaTaskProgress, type TaskProgress } from "./helena-task-progress";
import { useSocket } from "@/components/socket-provider";

interface ActivityFeedProps {
  akteId: string;
}

// Filter chip definitions mapping to AktenActivityTyp values
const feedFilters = [
  { label: "Alle", types: null },
  { label: "Fristen", types: ["FRIST"] },
  { label: "Dokumente", types: ["DOKUMENT"] },
  { label: "Kommunikation", types: ["EMAIL", "NOTIZ"] },
  { label: "Zeit", types: ["ZEITERFASSUNG"] },   // no DB entries yet — chip shows empty feed
  { label: "System", types: ["BETEILIGTE", "STATUS_CHANGE", "HELENA_ALERT", "HELENA_DRAFT"] },
] as const;

// Custom hook for Helena task progress tracking via Socket.IO
function useHelenaTaskProgress(akteId: string) {
  const { socket } = useSocket();
  const [activeTasks, setActiveTasks] = useState<Map<string, TaskProgress>>(
    () => new Map()
  );

  useEffect(() => {
    if (!socket) return;

    function handleTaskStarted(data: {
      taskId: string;
      akteId: string;
      auftrag: string;
    }) {
      if (data.akteId !== akteId) return;
      setActiveTasks((prev) => {
        const next = new Map(prev);
        next.set(data.taskId, {
          taskId: data.taskId,
          auftrag: data.auftrag,
          step: 0,
          maxSteps: 5,
          toolName: null,
        });
        return next;
      });
    }

    function handleTaskProgress(data: {
      taskId: string;
      akteId: string;
      stepNumber: number;
      maxSteps: number;
      toolName: string;
    }) {
      if (data.akteId !== akteId) return;
      setActiveTasks((prev) => {
        const existing = prev.get(data.taskId);
        if (!existing) return prev;
        const next = new Map(prev);
        next.set(data.taskId, {
          ...existing,
          step: data.stepNumber,
          maxSteps: data.maxSteps,
          toolName: data.toolName,
        });
        return next;
      });
    }

    function handleTaskDone(data: { taskId: string; akteId: string }) {
      if (data.akteId !== akteId) return;
      setActiveTasks((prev) => {
        const next = new Map(prev);
        next.delete(data.taskId);
        return next;
      });
    }

    socket.on("helena:task-started", handleTaskStarted);
    socket.on("helena:task-progress", handleTaskProgress);
    socket.on("helena:task-completed", handleTaskDone);
    socket.on("helena:task-failed", handleTaskDone);

    return () => {
      socket.off("helena:task-started", handleTaskStarted);
      socket.off("helena:task-progress", handleTaskProgress);
      socket.off("helena:task-completed", handleTaskDone);
      socket.off("helena:task-failed", handleTaskDone);
    };
  }, [socket, akteId]);

  return activeTasks;
}

// Contextual empty state based on active filter
function FeedEmptyState({ filterLabel, akteId }: { filterLabel: string; akteId: string }) {
  if (filterLabel === "Kommunikation") {
    return (
      <div className="glass-card rounded-xl p-10 text-center space-y-3">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <MailOpen className="w-6 h-6 text-slate-400" />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Noch keine E-Mails verknuepft</p>
          <p className="text-xs text-muted-foreground mt-1">
            E-Mails koennen direkt aus dem Posteingang zu dieser Akte hinzugefuegt werden.
          </p>
        </div>
        <div className="flex justify-center gap-2 flex-wrap">
          <a
            href="/posteingang"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Posteingang oeffnen
          </a>
          <a
            href={`/akten/${akteId}/emails`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted/50 transition-colors text-foreground"
          >
            Alle E-Mails anzeigen
          </a>
        </div>
      </div>
    );
  }

  if (filterLabel === "System") {
    return (
      <div className="glass-card rounded-xl p-10 text-center space-y-3">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-violet-400" />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Noch keine Helena-Aktivitaeten</p>
          <p className="text-xs text-muted-foreground mt-1">
            Starten Sie eine Anfrage an Helena, um KI-gestuetzte Entwuerfe und Analysen zu erhalten.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-12 text-center space-y-2">
      <div className="flex justify-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <Clock className="w-6 h-6 text-slate-400" />
        </div>
      </div>
      <p className="text-sm font-medium text-foreground">Keine Aktivitaeten vorhanden</p>
      <p className="text-xs text-muted-foreground">
        Neue Aktivitaeten erscheinen hier automatisch.
      </p>
    </div>
  );
}

export function ActivityFeed({ akteId }: ActivityFeedProps) {
  const [entries, setEntries] = useState<FeedEntryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState(0);
  const [hasNewEntries, setHasNewEntries] = useState(false);
  const { socket } = useSocket();
  const activeTasks = useHelenaTaskProgress(akteId);

  // Track current akteId for Socket.IO event filtering
  const akteIdRef = useRef(akteId);
  akteIdRef.current = akteId;

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
    setHasNewEntries(false);

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

  // Socket.IO: listen for new entries banner
  useEffect(() => {
    if (!socket) return;

    function handleNewActivity(data: { akteId: string }) {
      if (data.akteId !== akteIdRef.current) return;
      setHasNewEntries(true);
    }

    // Also refresh when Helena completes a task (new draft entry appears)
    function handleTaskCompleted(data: { akteId: string }) {
      if (data.akteId !== akteIdRef.current) return;
      setHasNewEntries(true);
    }

    socket.on("akten-activity:new", handleNewActivity);
    socket.on("helena:task-completed", handleTaskCompleted);

    return () => {
      socket.off("akten-activity:new", handleNewActivity);
      socket.off("helena:task-completed", handleTaskCompleted);
    };
  }, [socket]);

  // Refresh handler for the "new entries" banner
  const handleRefresh = useCallback(async () => {
    setHasNewEntries(false);
    setLoading(true);
    try {
      const types = feedFilters[activeFilter]?.types ?? null;
      const data = await fetchFeed(undefined, types);
      setEntries(data.items);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      // Keep existing entries on refresh failure
    } finally {
      setLoading(false);
    }
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
    <div className="flex flex-col h-[calc(100vh-280px)]">
      {/* Filter chips bar */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
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

      {/* New entries banner */}
      {hasNewEntries && (
        <button
          onClick={handleRefresh}
          className="w-full py-2 text-xs text-center text-brand-600 bg-brand-50 dark:bg-brand-950 hover:bg-brand-100 dark:hover:bg-brand-900 transition-colors rounded-lg mb-2 flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="w-3 h-3" />
          Neue Eintraege verfuegbar -- klicken zum Aktualisieren
        </button>
      )}

      {/* Scrollable feed entries */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {/* Active Helena tasks at the top */}
        <HelenaTaskProgress tasks={activeTasks} />

        {/* Feed entries */}
        {loading && entries.length === 0 ? (
          <ActivityFeedSkeleton />
        ) : entries.length === 0 ? (
          <FeedEmptyState filterLabel={feedFilters[activeFilter]?.label ?? "Alle"} akteId={akteId} />
        ) : (
          entries.map((entry) => (
            <ActivityFeedEntry key={entry.id} entry={entry} />
          ))
        )}

        {/* Load more button */}
        {hasMore && (
          <div className="flex justify-center pb-2">
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

      {/* Sticky composer at bottom */}
      <ActivityFeedComposer
        akteId={akteId}
        onNoteCreated={(entry) => {
          setEntries((prev) => [entry, ...prev]);
        }}
        onHelenaTaskStarted={() => {
          // Task progress will appear via Socket.IO events
        }}
      />
    </div>
  );
}
