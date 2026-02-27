"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Scale, Plus, X, Loader2, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface PinnedNorm {
  id: string;
  gesetzKuerzel: string;
  paragraphNr: string;
  anmerkung: string | null;
  addedBy: { name: string | null };
  createdAt: string;
}

interface SearchResult {
  id: string;
  gesetzKuerzel: string;
  paragraphNr: string;
  titel: string;
  content: string;
  sourceUrl: string | null;
  syncedAt: string;
}

interface NormenSectionProps {
  akteId: string;
  initialNormen: PinnedNorm[];
}

export function NormenSection({ akteId, initialNormen }: NormenSectionProps) {
  const router = useRouter();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [anmerkung, setAnmerkung] = useState("");
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  // Remove state
  const [removing, setRemoving] = useState<string | null>(null);

  // Detail sheet state
  const [detailNorm, setDetailNorm] = useState<SearchResult | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  // Debounced search — identical to BeteiligteAddDialog pattern
  useEffect(() => {
    if (!modalOpen) return;
    const timer = setTimeout(() => {
      if (search.length >= 2) {
        setSearching(true);
        fetch(`/api/akten/${akteId}/normen/search?q=${encodeURIComponent(search)}`)
          .then((r) => r.json())
          .then(setResults)
          .catch(() => {})
          .finally(() => setSearching(false));
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, modalOpen, akteId]);

  // Reset modal state when closed
  function handleModalClose() {
    setModalOpen(false);
    setSearch("");
    setResults([]);
    setSearching(false);
    setAdding(false);
    setAnmerkung("");
    setSelectedResult(null);
  }

  async function handleAdd() {
    if (!selectedResult) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/akten/${akteId}/normen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gesetzKuerzel: selectedResult.gesetzKuerzel,
          paragraphNr: selectedResult.paragraphNr,
          anmerkung: anmerkung.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler beim Hinzufügen");
      }
      toast.success(
        `§ ${selectedResult.paragraphNr} ${selectedResult.gesetzKuerzel} verknüpft`
      );
      handleModalClose();
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(normId: string) {
    setRemoving(normId);
    try {
      const res = await fetch(`/api/akten/${akteId}/normen/${normId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Fehler beim Entfernen");
      }
      toast.success("Norm entfernt");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setRemoving(null);
    }
  }

  async function handleChipClick(norm: PinnedNorm) {
    setDetailLoading(norm.id);
    try {
      const q = encodeURIComponent(`${norm.paragraphNr} ${norm.gesetzKuerzel}`);
      const res = await fetch(`/api/akten/${akteId}/normen/search?q=${q}`);
      const data: SearchResult[] = await res.json();
      // Find best match: same gesetzKuerzel + paragraphNr
      const match =
        data.find(
          (r) =>
            r.gesetzKuerzel === norm.gesetzKuerzel &&
            r.paragraphNr === norm.paragraphNr
        ) ?? data[0] ?? null;
      setDetailNorm(match);
      setDetailOpen(true);
    } catch {
      toast.error("Normtext konnte nicht geladen werden");
    } finally {
      setDetailLoading(null);
    }
  }

  return (
    <div className="glass-card rounded-xl p-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Verknüpfte Normen
          </span>
          {initialNormen.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({initialNormen.length})
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setModalOpen(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Norm hinzufügen
        </Button>
      </div>

      {/* Chip list OR empty state */}
      {initialNormen.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Noch keine Normen verknüpft. Normen fließen automatisch in Helenas
          Kontext ein.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {initialNormen.map((norm) => (
            <span
              key={norm.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-background text-xs font-medium"
            >
              {/* Clickable label opens detail sheet */}
              <button
                onClick={() => handleChipClick(norm)}
                className="hover:text-brand-600 transition-colors flex items-center gap-1"
                disabled={detailLoading === norm.id}
              >
                {detailLoading === norm.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : null}
                {norm.gesetzKuerzel} § {norm.paragraphNr}
              </button>
              {norm.anmerkung && (
                <span className="text-muted-foreground">
                  &mdash;{" "}
                  {norm.anmerkung.length > 30
                    ? norm.anmerkung.slice(0, 30) + "…"
                    : norm.anmerkung}
                </span>
              )}
              {/* Remove button */}
              <button
                onClick={() => handleRemove(norm.id)}
                disabled={removing === norm.id}
                className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Norm entfernen"
              >
                {removing === norm.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add Norm Modal — Radix Dialog primitive */}
      <Dialog.Root open={modalOpen} onOpenChange={(open) => !open && handleModalClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-950 rounded-xl p-6 shadow-xl z-50 w-full max-w-md border border-white/20 dark:border-white/[0.08]">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-heading text-foreground">
                Norm hinzufügen
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Schließen"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </Dialog.Close>
            </div>

            {/* Search input */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedResult(null);
                }}
                placeholder="§ Nummer oder Gesetzesname (z.B. BGB 242)..."
                className="pl-10"
                autoFocus
              />
            </div>

            {/* Selected result preview */}
            {selectedResult && (
              <div className="mb-3 p-3 rounded-lg bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800">
                <p className="text-sm font-medium text-brand-700 dark:text-brand-300">
                  § {selectedResult.paragraphNr} {selectedResult.gesetzKuerzel}
                </p>
                <p className="text-xs text-brand-500 line-clamp-2 mt-0.5">
                  {selectedResult.titel}
                </p>
              </div>
            )}

            {/* Results list */}
            {!selectedResult && (
              <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-white/[0.08] rounded-lg mb-3">
                {searching ? (
                  <div className="p-4 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Suche...
                  </div>
                ) : search.length < 2 ? (
                  <div className="p-4 text-center text-sm text-slate-400">
                    Mindestens 2 Zeichen eingeben
                  </div>
                ) : results.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">
                    Keine Normen gefunden
                  </div>
                ) : (
                  results.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedResult(r)}
                      className="w-full flex flex-col items-start px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-white/[0.06] last:border-b-0"
                    >
                      <span className="text-sm font-medium text-foreground">
                        § {r.paragraphNr} {r.gesetzKuerzel}
                      </span>
                      <span className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                        {r.titel}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Optional Anmerkung textarea */}
            {selectedResult && (
              <div className="mb-4">
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Anmerkung (optional)
                </label>
                <textarea
                  value={anmerkung}
                  onChange={(e) => setAnmerkung(e.target.value)}
                  placeholder="Relevanz für diesen Fall..."
                  rows={2}
                  className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>
            )}

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleModalClose}
                disabled={adding}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleAdd}
                disabled={!selectedResult || adding}
              >
                {adding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Hinzufügen
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Detail Sheet — full § text side panel */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-6">
          <SheetHeader>
            <SheetTitle>
              {detailNorm
                ? `§ ${detailNorm.paragraphNr} ${detailNorm.gesetzKuerzel}`
                : "Normtext"}
            </SheetTitle>
            <SheetDescription>
              {detailNorm?.titel ?? ""}
            </SheetDescription>
          </SheetHeader>

          {detailNorm ? (
            <div className="mt-4 space-y-4">
              {/* Full content */}
              <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
                {detailNorm.content}
              </pre>

              {/* Disclaimer */}
              <p className="text-xs text-muted-foreground border-t pt-3">
                Nicht amtlich — Stand:{" "}
                {new Date(detailNorm.syncedAt).toLocaleDateString("de-DE")}
              </p>

              {/* Source link */}
              {detailNorm.sourceUrl && (
                <a
                  href={detailNorm.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Zur amtlichen Quelle
                </a>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Normtext nicht verfügbar.
            </p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
