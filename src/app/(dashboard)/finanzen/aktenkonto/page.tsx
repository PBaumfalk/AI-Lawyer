"use client";

import { useState, useCallback } from "react";
import { Search, BookOpen } from "lucide-react";
import { AktenkontoLedger } from "@/components/finanzen/aktenkonto-ledger";
import { GlassPanel } from "@/components/ui/glass-panel";

interface AkteSearchResult {
  id: string;
  aktenzeichen: string;
  rubrum: string | null;
}

export default function AktenkontoPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AkteSearchResult[]>([]);
  const [selectedAkte, setSelectedAkte] = useState<AkteSearchResult | null>(
    null
  );
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(
    async (q: string) => {
      setQuery(q);
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(
          `/api/akten?search=${encodeURIComponent(q.trim())}&limit=10`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.akten ?? []);
        }
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    []
  );

  const selectAkte = useCallback((akte: AkteSearchResult) => {
    setSelectedAkte(akte);
    setQuery("");
    setResults([]);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Aktenkonto</h1>
        <p className="text-muted-foreground mt-1">
          Buchungen, Salden und Fremdgeld-Compliance je Akte
        </p>
      </div>

      {/* Akte selector */}
      <GlassPanel elevation="panel" className="p-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          Akte auswaehlen
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={selectedAkte ? `${selectedAkte.aktenzeichen} - ${selectedAkte.rubrum ?? ""}` : query}
            onChange={(e) => {
              if (selectedAkte) {
                setSelectedAkte(null);
              }
              handleSearch(e.target.value);
            }}
            onFocus={() => {
              if (selectedAkte) {
                setSelectedAkte(null);
                setQuery("");
              }
            }}
            placeholder="Aktenzeichen oder Mandant suchen..."
            className="glass-input w-full h-12 pl-10 pr-4 text-sm rounded-lg focus:outline-none"
          />
        </div>

        {/* Search results dropdown */}
        {results.length > 0 && !selectedAkte && (
          <div className="mt-2 rounded-xl glass-panel max-h-64 overflow-y-auto">
            {results.map((akte) => (
              <button
                key={akte.id}
                type="button"
                onClick={() => selectAkte(akte)}
                className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
              >
                <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {akte.aktenzeichen}
                  </p>
                  {akte.rubrum && (
                    <p className="text-xs text-muted-foreground">
                      {akte.rubrum}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {searching && (
          <p className="mt-2 text-xs text-muted-foreground">Suche...</p>
        )}
      </GlassPanel>

      {/* Aktenkonto ledger */}
      {selectedAkte ? (
        <AktenkontoLedger
          akteId={selectedAkte.id}
          aktenzeichen={selectedAkte.aktenzeichen}
        />
      ) : (
        <GlassPanel elevation="panel" className="p-12 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">
            Bitte waehlen Sie eine Akte aus, um das Aktenkonto anzuzeigen.
          </p>
        </GlassPanel>
      )}
    </div>
  );
}
