"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  X,
  SlidersHorizontal,
  Loader2,
  FileSearch,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchResultCard, type SearchResult } from "./search-result-card";

// ─── Filter types ────────────────────────────────────────────────────────────

interface Akte {
  id: string;
  aktenzeichen: string;
  kurzrubrum: string;
}

interface UserOption {
  id: string;
  name: string;
}

interface TagKategorie {
  id: string;
  name: string;
  farbe: string;
}

// ─── MIME type filter categories ─────────────────────────────────────────────

const MIME_CATEGORIES: { label: string; value: string }[] = [
  { label: "Alle Typen", value: "" },
  { label: "PDF", value: "application/pdf" },
  {
    label: "Word (DOCX)",
    value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  { label: "Bilder", value: "image/" },
  { label: "Text", value: "text/" },
];

const OCR_STATUS_OPTIONS = [
  { label: "Alle", value: "" },
  { label: "Abgeschlossen", value: "ABGESCHLOSSEN" },
  { label: "Ausstehend", value: "AUSSTEHEND" },
  { label: "In Bearbeitung", value: "IN_BEARBEITUNG" },
  { label: "Fehlgeschlagen", value: "FEHLGESCHLAGEN" },
  { label: "Nicht noetig", value: "NICHT_NOETIG" },
];

const DOKUMENT_STATUS_OPTIONS = [
  { label: "Alle", value: "" },
  { label: "Entwurf", value: "ENTWURF" },
  { label: "Zur Pruefung", value: "ZUR_PRUEFUNG" },
  { label: "Freigegeben", value: "FREIGEGEBEN" },
  { label: "Versendet", value: "VERSENDET" },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search state from URL params
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [akteId, setAkteId] = useState(searchParams.get("akteId") ?? "");
  const [mimeType, setMimeType] = useState(
    searchParams.get("mimeType") ?? ""
  );
  const [ocrStatus, setOcrStatus] = useState(
    searchParams.get("ocrStatus") ?? ""
  );
  const [dokumentStatus, setDokumentStatus] = useState(
    searchParams.get("dokumentStatus") ?? ""
  );
  const [createdById, setCreatedById] = useState(
    searchParams.get("createdById") ?? ""
  );
  const [dateFrom, setDateFrom] = useState(
    searchParams.get("dateFrom") ?? ""
  );
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(
    searchParams.get("tags")?.split(",").filter(Boolean) ?? []
  );
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Results state
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [processingTime, setProcessingTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Options for filter selects
  const [akten, setAkten] = useState<Akte[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [tagKategorien, setTagKategorien] = useState<TagKategorie[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const LIMIT = 20;

  // Load filter options on mount
  useEffect(() => {
    // Fetch cases for filter
    fetch("/api/akten?take=100")
      .then((r) => r.json())
      .then((d) => setAkten(d.akten ?? []))
      .catch(() => {});

    // Fetch users for filter
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? d ?? []))
      .catch(() => {});

    // Fetch tag categories
    fetch("/api/dokumente/tags")
      .then((r) => r.json())
      .then((d) => setTagKategorien(d.kategorien ?? d ?? []))
      .catch(() => {});
  }, []);

  // Build search URL params
  const buildParams = useCallback(
    (overrideOffset = 0) => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (akteId) params.set("akteId", akteId);
      if (mimeType) params.set("mimeType", mimeType);
      if (ocrStatus) params.set("ocrStatus", ocrStatus);
      if (dokumentStatus) params.set("dokumentStatus", dokumentStatus);
      if (createdById) params.set("createdById", createdById);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (selectedTags.length > 0)
        params.set("tags", selectedTags.join(","));
      params.set("limit", String(LIMIT));
      params.set("offset", String(overrideOffset));
      return params;
    },
    [
      query,
      akteId,
      mimeType,
      ocrStatus,
      dokumentStatus,
      createdById,
      dateFrom,
      dateTo,
      selectedTags,
    ]
  );

  // Perform search
  const performSearch = useCallback(
    async (append = false) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const currentOffset = append ? offset + LIMIT : 0;
      const params = buildParams(currentOffset);

      // Update URL (without triggering navigation)
      const urlParams = new URLSearchParams(params);
      urlParams.delete("limit");
      urlParams.delete("offset");
      router.replace(`/suche?${urlParams.toString()}`, { scroll: false });

      setIsLoading(true);

      try {
        const res = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Search failed");

        const data = await res.json();

        if (controller.signal.aborted) return;

        if (append) {
          setResults((prev) => [...prev, ...data.hits]);
        } else {
          setResults(data.hits);
        }
        setTotalHits(data.estimatedTotalHits ?? 0);
        setProcessingTime(data.processingTimeMs ?? 0);
        setOffset(currentOffset);
        setHasMore(
          (data.hits?.length ?? 0) >= LIMIT &&
            currentOffset + LIMIT < (data.estimatedTotalHits ?? 0)
        );
      } catch {
        if (!controller.signal.aborted) {
          setResults(append ? results : []);
          setTotalHits(0);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [buildParams, offset, results, router]
  );

  // Debounced search on query/filter change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    query,
    akteId,
    mimeType,
    ocrStatus,
    dokumentStatus,
    createdById,
    dateFrom,
    dateTo,
    selectedTags,
  ]);

  // Reset all filters
  function resetFilters() {
    setAkteId("");
    setMimeType("");
    setOcrStatus("");
    setDokumentStatus("");
    setCreatedById("");
    setDateFrom("");
    setDateTo("");
    setSelectedTags([]);
  }

  const hasActiveFilters =
    akteId ||
    mimeType ||
    ocrStatus ||
    dokumentStatus ||
    createdById ||
    dateFrom ||
    dateTo ||
    selectedTags.length > 0;

  return (
    <div className="space-y-6">
      {/* Search header */}
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">
          Dokumentensuche
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Durchsuchen Sie alle Dokumente nach Inhalt, Name und Metadaten
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Dokumente durchsuchen..."
          className="w-full h-12 pl-12 pr-20 rounded-xl border border-input bg-background text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          autoFocus
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded-md hover:bg-accent text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`p-1.5 rounded-md transition-colors ${
              filtersOpen || hasActiveFilters
                ? "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
                : "hover:bg-accent text-muted-foreground"
            }`}
            title="Filter ein-/ausblenden"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter bar (collapsible) */}
      {filtersOpen && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Akte filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Akte
              </label>
              <Select
                value={akteId}
                onChange={(e) => setAkteId(e.target.value)}
              >
                <option value="">Alle Akten</option>
                {akten.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.aktenzeichen} -- {a.kurzrubrum}
                  </option>
                ))}
              </Select>
            </div>

            {/* Document type filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Dokumenttyp
              </label>
              <Select
                value={mimeType}
                onChange={(e) => setMimeType(e.target.value)}
              >
                {MIME_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* OCR Status filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                OCR Status
              </label>
              <Select
                value={ocrStatus}
                onChange={(e) => setOcrStatus(e.target.value)}
              >
                {OCR_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Document status filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Dokumentstatus
              </label>
              <Select
                value={dokumentStatus}
                onChange={(e) => setDokumentStatus(e.target.value)}
              >
                {DOKUMENT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Date range from */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Von
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            {/* Date range to */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Bis
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {/* Uploader filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Hochgeladen von
              </label>
              <Select
                value={createdById}
                onChange={(e) => setCreatedById(e.target.value)}
              >
                <option value="">Alle Benutzer</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Tags filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Tags
              </label>
              <Select
                value=""
                onChange={(e) => {
                  const tag = e.target.value;
                  if (tag && !selectedTags.includes(tag)) {
                    setSelectedTags([...selectedTags, tag]);
                  }
                  e.target.value = "";
                }}
              >
                <option value="">Tag hinzufuegen...</option>
                {tagKategorien
                  .filter((t) => !selectedTags.includes(t.name))
                  .map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
              </Select>
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {selectedTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() =>
                        setSelectedTags(selectedTags.filter((t) => t !== tag))
                      }
                      className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border border-brand-200 text-brand-600 dark:border-brand-800 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950 transition-colors"
                    >
                      {tag}
                      <X className="w-2.5 h-2.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex justify-end">
              <button
                onClick={resetFilters}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Filter zuruecksetzen
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stats bar */}
      {(results.length > 0 || isLoading) && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Suche...
              </span>
            ) : (
              `${totalHits} Ergebnis${totalHits !== 1 ? "se" : ""} in ${processingTime}ms`
            )}
          </span>
        </div>
      )}

      {/* Results area */}
      <div className="space-y-3">
        {/* Loading skeleton */}
        {isLoading && results.length === 0 && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 animate-pulse"
              >
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/3" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-4/5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && results.length === 0 && query.trim() && (
          <div className="text-center py-12">
            <FileSearch className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Keine Dokumente gefunden
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Versuchen Sie andere Suchbegriffe oder passen Sie die Filter an
            </p>
          </div>
        )}

        {/* Initial state (no query) */}
        {!isLoading && results.length === 0 && !query.trim() && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Suchbegriff eingeben
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Durchsuchen Sie Dokumentnamen, OCR-Text und Metadaten
            </p>
          </div>
        )}

        {/* Results list */}
        {results.map((result) => (
          <SearchResultCard key={result.id} result={result} />
        ))}

        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center pt-4">
            <button
              onClick={() => performSearch(true)}
              disabled={isLoading}
              className="px-4 py-2 text-sm rounded-lg border border-input hover:bg-accent transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Laden...
                </span>
              ) : (
                "Mehr laden"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
