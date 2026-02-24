"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Download,
  FileText,
  X,
  Loader2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BriefkopfOption {
  id: string;
  name: string;
  istStandard: boolean;
}

interface PdfExportDialogProps {
  dokumentId: string;
  open: boolean;
  onClose: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * PDF export dialog with Briefkopf selection, PDF/A option, and watermark.
 * Calls POST /api/onlyoffice/convert to generate PDF from DOCX.
 * Reusable: can be opened from document detail, OnlyOffice editor, or Akte documents tab.
 */
export function PdfExportDialog({
  dokumentId,
  open,
  onClose,
}: PdfExportDialogProps) {
  const [briefkoepfe, setBriefkoepfe] = useState<BriefkopfOption[]>([]);
  const [selectedBriefkopfId, setSelectedBriefkopfId] = useState<string | null>(null);
  const [pdfA, setPdfA] = useState(false);
  const [watermark, setWatermark] = useState("");
  const [exporting, setExporting] = useState(false);
  const [loadingBriefkoepfe, setLoadingBriefkoepfe] = useState(true);

  // Fetch available Briefkoepfe
  const fetchBriefkoepfe = useCallback(async () => {
    setLoadingBriefkoepfe(true);
    try {
      const res = await fetch("/api/briefkopf");
      if (!res.ok) return;
      const data = await res.json();
      const items = data.briefkoepfe ?? [];
      setBriefkoepfe(items);
      // Auto-select default
      const def = items.find((b: BriefkopfOption) => b.istStandard);
      if (def) setSelectedBriefkopfId(def.id);
      else if (items.length > 0) setSelectedBriefkopfId(items[0].id);
    } catch {
      // Non-blocking
    } finally {
      setLoadingBriefkoepfe(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchBriefkoepfe();
  }, [open, fetchBriefkoepfe]);

  // Export PDF
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/onlyoffice/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dokumentId,
          outputType: "pdf",
          briefkopfId: selectedBriefkopfId || undefined,
          pdfA,
          watermark: watermark.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "PDF-Export fehlgeschlagen");
      }

      // Trigger download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+?)"/)?.[1] ??
        "dokument.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("PDF erfolgreich exportiert");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "PDF-Export fehlgeschlagen");
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="glass rounded-xl p-6 w-full max-w-md space-y-5 relative">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-rose-500" />
              <h2 className="text-lg font-heading text-foreground">
                Als PDF exportieren
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Briefkopf selection (only if multiple) */}
          {!loadingBriefkoepfe && briefkoepfe.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="pdf-briefkopf">Briefkopf</Label>
              <select
                id="pdf-briefkopf"
                value={selectedBriefkopfId ?? ""}
                onChange={(e) => setSelectedBriefkopfId(e.target.value || null)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Kein Briefkopf</option>
                {briefkoepfe.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.istStandard ? "(Standard)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {briefkoepfe.length === 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Briefkopf</span>
              <span className="font-medium">{briefkoepfe[0].name}</span>
            </div>
          )}

          {/* PDF/A option */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pdfA}
              onChange={(e) => setPdfA(e.target.checked)}
              className="rounded border-input"
            />
            <div>
              <span className="text-sm text-foreground">PDF/A-Format</span>
              <p className="text-xs text-muted-foreground">
                Fuer Langzeitarchivierung geeignet
              </p>
            </div>
          </label>

          {/* Watermark */}
          <div className="space-y-1.5">
            <Label htmlFor="pdf-watermark">Wasserzeichen (optional)</Label>
            <Input
              id="pdf-watermark"
              value={watermark}
              onChange={(e) => setWatermark(e.target.value)}
              placeholder="z.B. ENTWURF"
            />
            <p className="text-xs text-muted-foreground">
              Text wird als diagonales Wasserzeichen auf jeder Seite angezeigt
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={exporting}>
              Abbrechen
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-1.5" />
              )}
              Exportieren
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
