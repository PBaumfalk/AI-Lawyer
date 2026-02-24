"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Search, Copy, X } from "lucide-react";
import { PLATZHALTER_GRUPPEN } from "@/lib/vorlagen";

/**
 * Placeholder sidebar for use inside OnlyOffice editor or template editing context.
 * Lists all available placeholder groups from PLATZHALTER_GRUPPEN.
 * Click to copy {{placeholder}} to clipboard.
 */
export function PlatzhalterSidebar({
  className,
  onClose,
}: {
  className?: string;
  onClose?: () => void;
}) {
  const [filter, setFilter] = useState("");

  // Filter placeholders by search query
  const filteredGruppen = useMemo(() => {
    if (!filter) return PLATZHALTER_GRUPPEN;
    const q = filter.toLowerCase();
    return PLATZHALTER_GRUPPEN.map((g) => ({
      ...g,
      felder: g.felder.filter(
        (f) =>
          f.key.toLowerCase().includes(q) ||
          f.label.toLowerCase().includes(q) ||
          f.beispiel.toLowerCase().includes(q)
      ),
    })).filter((g) => g.felder.length > 0);
  }, [filter]);

  // Copy placeholder to clipboard
  const handleCopy = async (key: string) => {
    try {
      await navigator.clipboard.writeText(`{{${key}}}`);
      toast.success("Platzhalter kopiert", {
        description: `{{${key}}}`,
        duration: 2000,
      });
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = `{{${key}}}`;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.success("Platzhalter kopiert");
    }
  };

  return (
    <div
      className={`w-72 border-l bg-background flex flex-col overflow-hidden ${className ?? ""}`}
    >
      {/* Header */}
      <div className="p-3 border-b flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-sm text-foreground">Platzhalter</h3>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Platzhalter suchen..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Placeholder list */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredGruppen.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Keine Platzhalter gefunden
          </p>
        ) : (
          filteredGruppen.map((gruppe) => (
            <div key={gruppe.prefix} className="mb-3">
              <h4 className="text-[11px] font-medium text-foreground/70 uppercase tracking-wider px-1 mb-1">
                {gruppe.label}
              </h4>
              <div className="space-y-0.5">
                {gruppe.felder.map((feld) => (
                  <button
                    key={feld.key}
                    onClick={() => handleCopy(feld.key)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-muted/50 transition-colors group"
                    title={`{{${feld.key}}} kopieren`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <code className="text-[10px] text-primary/80 bg-primary/5 px-1 py-0.5 rounded">
                          {`{{${feld.key}}}`}
                        </code>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground truncate">
                          {feld.label}
                        </span>
                        {feld.beispiel && (
                          <>
                            <span className="text-[10px] text-muted-foreground/40">-</span>
                            <span className="text-[10px] text-muted-foreground/60 truncate italic">
                              {feld.beispiel}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <Copy className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
