"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FolderInput,
  Search,
  CheckCircle2,
  Loader2,
  Paperclip,
  FolderOpen,
  Zap,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AkteSuggestion {
  akteId: string;
  aktenzeichen: string;
  kurzrubrum: string;
  confidence: "hoch" | "mittel" | "niedrig";
  reason: string;
}

interface EmailAnhang {
  id: string;
  dateiname: string;
  mimeType: string;
  groesse: number;
}

interface AkteSearchResult {
  id: string;
  aktenzeichen: string;
  kurzrubrum: string;
}

interface VeraktungPanelProps {
  open: boolean;
  onClose: () => void;
  emailIds: string[];
  onVeraktungComplete?: () => void;
}

// ─── Confidence color map ───────────────────────────────────────────────────

const confidenceColors: Record<string, string> = {
  hoch: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  mittel: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  niedrig: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const confidenceLabels: Record<string, string> = {
  hoch: "Hoch",
  mittel: "Mittel",
  niedrig: "Niedrig",
};

// ─── Component ──────────────────────────────────────────────────────────────

export function VeraktungPanel({
  open,
  onClose,
  emailIds,
  onVeraktungComplete,
}: VeraktungPanelProps) {
  const [suggestions, setSuggestions] = useState<AkteSuggestion[]>([]);
  const [anhaenge, setAnhaenge] = useState<EmailAnhang[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Selected Akte
  const [selectedAkte, setSelectedAkte] = useState<AkteSearchResult | null>(null);

  // Attachment selection (all checked by default)
  const [selectedAnhangIds, setSelectedAnhangIds] = useState<Set<string>>(
    new Set()
  );

  // DMS folder
  const [dmsOrdner, setDmsOrdner] = useState("Korrespondenz");
  const [ordnerOptions, setOrdnerOptions] = useState<string[]>([
    "Korrespondenz",
    "Schriftsaetze",
    "Rechnungen",
    "Sonstiges",
  ]);

  // Note
  const [notiz, setNotiz] = useState("");

  // Akte search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AkteSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Multi-Akte: after first veraktung, allow adding more
  const [completedVeraktungen, setCompletedVeraktungen] = useState<
    Array<{ aktenzeichen: string }>
  >([]);

  // Load suggestions and attachments when panel opens
  useEffect(() => {
    if (!open || emailIds.length === 0) {
      setSuggestions([]);
      setAnhaenge([]);
      setSelectedAkte(null);
      setSelectedAnhangIds(new Set());
      setDmsOrdner("Korrespondenz");
      setNotiz("");
      setCompletedVeraktungen([]);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        // Use the first email for suggestions (bulk uses same suggestions)
        const res = await fetch(
          `/api/emails/${emailIds[0]}/veraktung?suggest=true`
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSuggestions(data.suggestions ?? []);
          setAnhaenge(data.anhaenge ?? []);
          // Default: all attachments selected
          const allIds = new Set<string>();
          for (const a of data.anhaenge ?? []) {
            allIds.add(a.id);
          }
          setSelectedAnhangIds(allIds);
        }
      } catch {
        // Silently fail -- user can still search manually
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [open, emailIds]);

  // Load OrdnerSchema when Akte is selected
  useEffect(() => {
    if (!selectedAkte) return;
    // Fetch Akte-specific folder structure
    async function fetchOrdner() {
      try {
        const res = await fetch(`/api/akten/${selectedAkte!.id}`);
        if (res.ok) {
          const data = await res.json();
          // Extract unique folder names from documents
          const folders = new Set<string>(["Korrespondenz"]);
          if (data.dokumente) {
            for (const doc of data.dokumente) {
              if (doc.ordner) folders.add(doc.ordner);
            }
          }
          // Add common defaults
          folders.add("Schriftsaetze");
          folders.add("Rechnungen");
          folders.add("Sonstiges");
          setOrdnerOptions(Array.from(folders).sort());
        }
      } catch {
        // Keep defaults
      }
    }
    fetchOrdner();
  }, [selectedAkte]);

  // Search Akten
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/akten?q=${encodeURIComponent(searchQuery)}&take=10`
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSearchResults(
            (data.akten ?? []).map((a: any) => ({
              id: a.id,
              aktenzeichen: a.aktenzeichen,
              kurzrubrum: a.kurzrubrum,
            }))
          );
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Toggle attachment selection
  const toggleAnhang = useCallback((anhangId: string) => {
    setSelectedAnhangIds((prev) => {
      const next = new Set(prev);
      if (next.has(anhangId)) {
        next.delete(anhangId);
      } else {
        next.add(anhangId);
      }
      return next;
    });
  }, []);

  // Select Akte from suggestion
  const selectAkteFromSuggestion = useCallback((suggestion: AkteSuggestion) => {
    setSelectedAkte({
      id: suggestion.akteId,
      aktenzeichen: suggestion.aktenzeichen,
      kurzrubrum: suggestion.kurzrubrum,
    });
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  // Select Akte from search result
  const selectAkteFromSearch = useCallback((result: AkteSearchResult) => {
    setSelectedAkte(result);
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  // Submit Veraktung
  const handleSubmit = useCallback(async () => {
    if (!selectedAkte) return;

    setSubmitting(true);
    try {
      // Verakten each email (for bulk veraktung)
      for (const emailId of emailIds) {
        const res = await fetch(`/api/emails/${emailId}/veraktung`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            akteId: selectedAkte.id,
            anhangIds: Array.from(selectedAnhangIds),
            dmsOrdner,
            notiz: notiz.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Fehler beim Verakten");
        }
      }

      const count = emailIds.length;
      toast.success(
        count > 1
          ? `${count} E-Mails an Akte ${selectedAkte.aktenzeichen} veraktet`
          : `E-Mail an Akte ${selectedAkte.aktenzeichen} veraktet`
      );

      setCompletedVeraktungen((prev) => [
        ...prev,
        { aktenzeichen: selectedAkte.aktenzeichen },
      ]);

      // Reset for another veraktung
      setSelectedAkte(null);
      setNotiz("");

      onVeraktungComplete?.();
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Verakten");
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedAkte,
    emailIds,
    selectedAnhangIds,
    dmsOrdner,
    notiz,
    onVeraktungComplete,
  ]);

  // Quick veraktung for high-confidence suggestion
  const handleQuickVeraktung = useCallback(
    async (suggestion: AkteSuggestion) => {
      setSubmitting(true);
      try {
        const allAnhangIds = anhaenge.map((a) => a.id);
        for (const emailId of emailIds) {
          const res = await fetch(`/api/emails/${emailId}/veraktung`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              akteId: suggestion.akteId,
              anhangIds: allAnhangIds,
              dmsOrdner: "Korrespondenz",
            }),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Fehler beim Verakten");
          }
        }

        toast.success(
          `E-Mail an Akte ${suggestion.aktenzeichen} veraktet`
        );
        onVeraktungComplete?.();
        onClose();
      } catch (error: any) {
        toast.error(error.message || "Fehler beim Verakten");
      } finally {
        setSubmitting(false);
      }
    },
    [anhaenge, emailIds, onVeraktungComplete, onClose]
  );

  const highConfidenceSuggestion = suggestions.find(
    (s) => s.confidence === "hoch"
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FolderInput className="w-5 h-5" />
            E-Mail verakten
          </SheetTitle>
          <SheetDescription>
            {emailIds.length > 1
              ? `${emailIds.length} E-Mails einer Akte zuordnen`
              : "E-Mail einer Akte zuordnen"}
          </SheetDescription>
        </SheetHeader>

        <div className="p-6 space-y-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {/* Completed veraktungen */}
              {completedVeraktungen.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Bereits zugeordnet
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {completedVeraktungen.map((v, i) => (
                      <Badge key={i} variant="default" className="gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {v.aktenzeichen}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick veraktung for high-confidence */}
              {highConfidenceSuggestion && !selectedAkte && completedVeraktungen.length === 0 && (
                <div className="rounded-lg border-2 border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-600" />
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                      Mit einem Klick verakten
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-mono font-semibold text-foreground">
                        {highConfidenceSuggestion.aktenzeichen}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {highConfidenceSuggestion.kurzrubrum}
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {highConfidenceSuggestion.reason}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        handleQuickVeraktung(highConfidenceSuggestion)
                      }
                      disabled={submitting}
                      className="whitespace-nowrap"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Zap className="w-4 h-4 mr-1" />
                      )}
                      Verakten
                    </Button>
                  </div>
                </div>
              )}

              {/* Section 1: Suggested Akten */}
              {suggestions.length > 0 && !selectedAkte && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Vorgeschlagene Akten
                  </p>
                  <div className="space-y-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.akteId}
                        onClick={() =>
                          selectAkteFromSuggestion(suggestion)
                        }
                        className="w-full text-left rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-mono font-semibold text-foreground">
                              {suggestion.aktenzeichen}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {suggestion.kurzrubrum}
                            </p>
                          </div>
                          <Badge
                            className={cn(
                              "text-[10px] flex-shrink-0",
                              confidenceColors[suggestion.confidence]
                            )}
                          >
                            {confidenceLabels[suggestion.confidence]}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {suggestion.reason}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 2: Akte search */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {selectedAkte ? "Ausgewaehlte Akte" : "Akte suchen"}
                </p>
                {selectedAkte ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-300 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-950/20 p-3">
                    <div>
                      <p className="text-sm font-mono font-semibold text-foreground">
                        {selectedAkte.aktenzeichen}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedAkte.kurzrubrum}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedAkte(null)}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <X className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Aktenzeichen oder Kurzrubrum..."
                      className="pl-9"
                    />
                    {searching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                    )}

                    {/* Search results dropdown */}
                    {searchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-lg max-h-48 overflow-y-auto">
                        {searchResults.map((result) => (
                          <button
                            key={result.id}
                            onClick={() => selectAkteFromSearch(result)}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                          >
                            <span className="font-mono font-medium">
                              {result.aktenzeichen}
                            </span>
                            <span className="text-muted-foreground ml-2">
                              {result.kurzrubrum}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 3: Attachments */}
              {anhaenge.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-slate-400" />
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Anhaenge ({selectedAnhangIds.size}/{anhaenge.length})
                    </p>
                  </div>
                  <div className="space-y-1">
                    {anhaenge.map((anhang) => (
                      <label
                        key={anhang.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAnhangIds.has(anhang.id)}
                          onChange={() => toggleAnhang(anhang.id)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">
                            {anhang.dateiname}
                          </p>
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {formatFileSize(anhang.groesse)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 4: DMS folder */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-slate-400" />
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    DMS-Ordner
                  </p>
                </div>
                <select
                  value={dmsOrdner}
                  onChange={(e) => setDmsOrdner(e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                >
                  {ordnerOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section 5: Note */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Notiz (optional)
                </p>
                <Textarea
                  value={notiz}
                  onChange={(e) => setNotiz(e.target.value)}
                  placeholder="z.B. Vergleichsvorschlag eingegangen..."
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Section 6: Submit */}
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedAkte || submitting}
                  className="w-full"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <FolderInput className="w-4 h-4 mr-2" />
                  )}
                  Verakten bestaetigen
                </Button>

                {completedVeraktungen.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="w-full"
                  >
                    Fertig
                  </Button>
                )}

                {completedVeraktungen.length > 0 && !selectedAkte && (
                  <p className="text-xs text-center text-slate-400">
                    <Plus className="w-3 h-3 inline mr-1" />
                    Weitere Akte zuordnen oder &quot;Fertig&quot; klicken
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
