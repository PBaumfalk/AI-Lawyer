"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Download, FileText, Table, Loader2, X } from "lucide-react";

interface AuditExportDialogProps {
  open: boolean;
  onClose: () => void;
  /** Current filter params to pass to export endpoint */
  filterParams?: URLSearchParams;
}

export function AuditExportDialog({ open, onClose, filterParams }: AuditExportDialogProps) {
  const [format, setFormat] = useState<"csv" | "pdf">("csv");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleExport() {
    setLoading(true);
    try {
      const params = new URLSearchParams(filterParams?.toString() ?? "");
      params.set("format", format);
      if (von) params.set("von", von);
      if (bis) params.set("bis", bis);

      const res = await fetch(`/api/admin/audit-trail/export?${params}`);
      if (!res.ok) throw new Error("Export fehlgeschlagen");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-trail-export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      // Silently handle export errors
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-heading font-semibold">Audit-Trail exportieren</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format selection */}
        <div className="space-y-2">
          <Label>Format</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setFormat("csv")}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                format === "csv"
                  ? "border-brand-600 bg-brand-50 dark:bg-brand-950 text-brand-700"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 hover:border-slate-400"
              }`}
            >
              <Table className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={() => setFormat("pdf")}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                format === "pdf"
                  ? "border-brand-600 bg-brand-50 dark:bg-brand-950 text-brand-700"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 hover:border-slate-400"
              }`}
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="export-von">Von</Label>
            <Input
              id="export-von"
              type="date"
              value={von}
              onChange={(e) => setVon(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="export-bis">Bis</Label>
            <Input
              id="export-bis"
              type="date"
              value={bis}
              onChange={(e) => setBis(e.target.value)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Abbrechen
          </Button>
          <Button size="sm" onClick={handleExport} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Exportieren
          </Button>
        </div>
      </div>
    </div>
  );
}
