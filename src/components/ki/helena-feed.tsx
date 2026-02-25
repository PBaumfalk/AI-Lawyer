"use client";

import { useCallback, useEffect, useState } from "react";
import { SuggestionCard, type SuggestionData } from "@/components/ki/suggestion-card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Bot, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AkteOption {
  id: string;
  aktenzeichen: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HelenaFeed() {
  const [suggestions, setSuggestions] = useState<SuggestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("NEU");
  const [akteFilter, setAkteFilter] = useState("");
  const [typFilter, setTypFilter] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [akten, setAkten] = useState<AkteOption[]>([]);

  // Fetch Akten for filter dropdown
  useEffect(() => {
    fetch("/api/akten?limit=200&fields=id,aktenzeichen")
      .then((res) => res.ok ? res.json() : { akten: [] })
      .then((data) => {
        if (Array.isArray(data)) {
          setAkten(data.map((a: any) => ({ id: a.id, aktenzeichen: a.aktenzeichen })));
        } else if (data.akten) {
          setAkten(data.akten.map((a: any) => ({ id: a.id, aktenzeichen: a.aktenzeichen })));
        }
      })
      .catch(() => {});
  }, []);

  // Fetch suggestions
  const fetchSuggestions = useCallback(
    async (cursor?: string) => {
      const params = new URLSearchParams();
      params.set("status", activeStatus);
      if (akteFilter) params.set("akteId", akteFilter);
      if (typFilter) params.set("typ", typFilter);
      params.set("limit", "20");
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`/api/helena/suggestions?${params}`);
      if (!res.ok) return { suggestions: [], nextCursor: null };
      return res.json();
    },
    [activeStatus, akteFilter, typFilter]
  );

  // Initial load + filter changes
  useEffect(() => {
    setLoading(true);
    fetchSuggestions().then((data) => {
      setSuggestions(data.suggestions || []);
      setNextCursor(data.nextCursor || null);
      setLoading(false);
    });
  }, [fetchSuggestions]);

  // Load more
  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchSuggestions(nextCursor);
    setSuggestions((prev) => [...prev, ...(data.suggestions || [])]);
    setNextCursor(data.nextCursor || null);
    setLoadingMore(false);
  }

  // Handle status change from card
  function handleStatusChange(id: string, newStatus: string) {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
    );

    // If we're filtering by status, remove the card that no longer matches
    if (activeStatus !== "ALLE" && newStatus !== activeStatus) {
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    }
  }

  const statusTabs = [
    { value: "NEU", label: "Neu" },
    { value: "UEBERNOMMEN", label: "Uebernommen" },
    { value: "ABGELEHNT", label: "Abgelehnt" },
    { value: "ALLE", label: "Alle" },
  ];

  const typOptions = [
    { value: "", label: "Alle Typen" },
    { value: "FRIST_ERKANNT", label: "Fristen" },
    { value: "BETEILIGTE_ERKANNT", label: "Beteiligte" },
    { value: "ANTWORT_ENTWURF", label: "Antwort-Entwuerfe" },
    { value: "HINWEIS", label: "Hinweise" },
    { value: "BRIEFING", label: "Briefings" },
  ];

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status tabs */}
        <div className="flex rounded-lg border border-white/20 dark:border-white/[0.08] overflow-hidden">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveStatus(tab.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeStatus === tab.value
                  ? "bg-brand-600 text-white"
                  : "bg-white/50 dark:bg-white/[0.05] text-foreground/70 hover:bg-white/70 dark:hover:bg-white/[0.08]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <Select
          value={typFilter}
          onChange={(e) => setTypFilter(e.target.value)}
          className="h-8 text-xs w-40"
        >
          {typOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        {/* Akte filter */}
        {akten.length > 0 && (
          <Select
            value={akteFilter}
            onChange={(e) => setAkteFilter(e.target.value)}
            className="h-8 text-xs w-48"
          >
            <option value="">Alle Akten</option>
            {akten.map((akte) => (
              <option key={akte.id} value={akte.id}>
                {akte.aktenzeichen}
              </option>
            ))}
          </Select>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5 animate-pulse"
            >
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Bot className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">
            Helena hat noch keine Vorschlaege.
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Neue Dokumente und E-Mails werden automatisch analysiert.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onStatusChange={handleStatusChange}
            />
          ))}

          {/* Load more */}
          {nextCursor && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : null}
                Mehr laden
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
