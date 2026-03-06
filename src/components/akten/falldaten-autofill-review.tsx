"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, CheckCheck, FileText } from "lucide-react";

// ---------------------------------------------------------------------------
// Types (re-defined locally to avoid server/client boundary issues)
// ---------------------------------------------------------------------------

interface FalldatenSuggestion {
  key: string;
  value: any;
  konfidenz: "HOCH" | "MITTEL" | "NIEDRIG";
  quellExcerpt: string;
  dokumentName: string;
}

interface TemplateField {
  key: string;
  label: string;
  typ: string;
  placeholder?: string | null;
  optionen?: { value: string; label: string }[] | null;
  required?: boolean;
  gruppe?: string | null;
}

interface FalldatenAutofillReviewProps {
  suggestions: FalldatenSuggestion[];
  felder: TemplateField[];
  currentData: Record<string, any>;
  onApply: (accepted: Record<string, any>) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatValue(value: any, feld: TemplateField | undefined): string {
  if (value === null || value === undefined) return "-";

  if (feld?.typ === "boolean") return value ? "Ja" : "Nein";
  if (feld?.typ === "currency") return `${Number(value).toFixed(2)} EUR`;
  if (feld?.typ === "select" && feld.optionen) {
    const opt = feld.optionen.find((o) => o.value === String(value));
    return opt?.label ?? String(value);
  }

  return String(value);
}

function konfidenzColor(k: "HOCH" | "MITTEL" | "NIEDRIG"): string {
  switch (k) {
    case "HOCH":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "MITTEL":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "NIEDRIG":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FalldatenAutofillReview({
  suggestions,
  felder,
  currentData,
  onApply,
  onClose,
}: FalldatenAutofillReviewProps) {
  // All suggestions pre-selected by default
  const [accepted, setAccepted] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const s of suggestions) {
      initial[s.key] = true;
    }
    return initial;
  });

  const feldMap = new Map(felder.map((f) => [f.key, f]));

  const acceptedCount = Object.values(accepted).filter(Boolean).length;
  const allAccepted = acceptedCount === suggestions.length;

  const toggleAll = useCallback(() => {
    const newVal = !allAccepted;
    setAccepted((prev) => {
      const next: Record<string, boolean> = {};
      for (const key of Object.keys(prev)) {
        next[key] = newVal;
      }
      return next;
    });
  }, [allAccepted]);

  const toggleField = useCallback((key: string) => {
    setAccepted((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleApply = useCallback(() => {
    const result: Record<string, any> = {};
    for (const s of suggestions) {
      if (accepted[s.key]) {
        result[s.key] = s.value;
      }
    }
    onApply(result);
  }, [suggestions, accepted, onApply]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/20 dark:border-white/[0.08] shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 dark:border-white/[0.08]">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              KI-Vorschlaege pruefen
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {suggestions.length} Vorschlaege gefunden --{" "}
              {acceptedCount} ausgewaehlt
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Suggestion list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {suggestions.map((suggestion) => {
            const feld = feldMap.get(suggestion.key);
            const isAccepted = accepted[suggestion.key];
            const currentValue = currentData?.[suggestion.key];
            const hasCurrentValue =
              currentValue !== null &&
              currentValue !== undefined &&
              currentValue !== "";

            return (
              <div
                key={suggestion.key}
                onClick={() => toggleField(suggestion.key)}
                className={`
                  bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl
                  border transition-all cursor-pointer
                  ${
                    isAccepted
                      ? "border-emerald-300/50 dark:border-emerald-500/20 ring-1 ring-emerald-200/30 dark:ring-emerald-500/10"
                      : "border-white/20 dark:border-white/[0.08] opacity-60"
                  }
                  p-4
                `}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <div
                    className={`
                      mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors
                      ${
                        isAccepted
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-slate-300 dark:border-slate-600"
                      }
                    `}
                  >
                    {isAccepted && <Check className="w-3 h-3" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">
                        {feld?.label ?? suggestion.key}
                      </span>
                      <Badge
                        className={`text-[10px] px-1.5 py-0 ${konfidenzColor(suggestion.konfidenz)}`}
                      >
                        {suggestion.konfidenz}
                      </Badge>
                    </div>

                    {/* Current vs. Suggested */}
                    <div className="text-xs space-y-0.5">
                      {hasCurrentValue && (
                        <div className="text-muted-foreground">
                          <span className="text-slate-400">Aktuell:</span>{" "}
                          <span className="line-through">
                            {formatValue(currentValue, feld)}
                          </span>
                        </div>
                      )}
                      <div className="text-foreground font-medium">
                        <span className="text-slate-400">Vorschlag:</span>{" "}
                        {formatValue(suggestion.value, feld)}
                      </div>
                    </div>

                    {/* Source excerpt */}
                    {suggestion.quellExcerpt && (
                      <div className="flex items-start gap-1.5 mt-2 text-[11px] text-muted-foreground">
                        <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">
                            {suggestion.dokumentName}:
                          </span>{" "}
                          &ldquo;{suggestion.quellExcerpt}&rdquo;
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/20 dark:border-white/[0.08]">
          <button
            onClick={toggleAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {allAccepted ? "Alle abwaehlen" : "Alle akzeptieren"}
          </button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Abbrechen
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={acceptedCount === 0}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              {acceptedCount} Vorschlaege uebernehmen
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
