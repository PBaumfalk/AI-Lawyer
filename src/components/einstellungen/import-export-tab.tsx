"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Upload,
  FileJson,
  AlertTriangle,
  Check,
  Info,
} from "lucide-react";

interface ImportSummary {
  systemSettings: { imported: number; skipped: number };
  fristPresets: { imported: number; skipped: number };
  briefkoepfe: { imported: number; skipped: number };
  ordnerSchemata: { imported: number; skipped: number };
}

interface ImportPreview {
  version: string;
  exportedAt?: string;
  systemSettings?: unknown[];
  fristPresets?: unknown[];
  briefkoepfe?: unknown[];
  ordnerSchemata?: unknown[];
}

export function ImportExportTab() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importData, setImportData] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/einstellungen/export");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Export fehlgeschlagen");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition");
      const filename =
        disposition?.match(/filename="(.+)"/)?.[1] ??
        `kanzlei-einstellungen-${new Date().toISOString().split("T")[0]}.json`;
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Einstellungen exportiert");
    } catch (err: any) {
      toast.error(err.message || "Fehler beim Export");
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast.error("Bitte eine JSON-Datei auswaehlen");
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text) as ImportPreview;

      if (!data.version) {
        toast.error("Ungueltige Import-Datei: Fehlende Version");
        return;
      }

      setImportData(text);
      setPreview(data);
      setImportResult(null);
      setShowConfirm(false);
    } catch {
      toast.error("Fehler beim Lesen der Datei");
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (!importData) return;
    setImporting(true);
    try {
      const res = await fetch("/api/einstellungen/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: importData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import fehlgeschlagen");
      }

      const result = await res.json();
      setImportResult(result.summary);
      setShowConfirm(false);
      toast.success("Einstellungen importiert");
    } catch (err: any) {
      toast.error(err.message || "Fehler beim Import");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export section */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Download className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-heading text-foreground">
            Einstellungen exportieren
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Exportieren Sie alle Kanzlei-Einstellungen als JSON-Datei fuer Backup
          oder Uebertragung auf ein anderes System.
        </p>
        <Button onClick={handleExport} disabled={exporting}>
          <Download className="w-4 h-4 mr-2" />
          {exporting ? "Exportiere..." : "Einstellungen exportieren"}
        </Button>
      </div>

      {/* Import section */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-heading text-foreground">
            Einstellungen importieren
          </h3>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Importieren Sie Einstellungen aus einer zuvor exportierten JSON-Datei.
          Bestehende Einstellungen werden ueberschrieben.
        </p>

        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="block w-full text-sm text-muted-foreground
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-medium
              file:bg-primary file:text-primary-foreground
              hover:file:bg-primary/90
              file:cursor-pointer cursor-pointer"
          />
        </div>

        {/* Preview */}
        {preview && !importResult && (
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-muted/20 border border-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <FileJson className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Vorschau</span>
                {preview.exportedAt && (
                  <span className="text-xs text-muted-foreground">
                    Export vom{" "}
                    {new Date(preview.exportedAt).toLocaleDateString("de-DE")}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Einstellungen</span>
                  <Badge variant="muted">
                    {preview.systemSettings?.length ?? 0}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fristen-Presets</span>
                  <Badge variant="muted">
                    {preview.fristPresets?.length ?? 0}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Briefkoepfe</span>
                  <Badge variant="muted">
                    {preview.briefkoepfe?.length ?? 0}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ordner-Schemata</span>
                  <Badge variant="muted">
                    {preview.ordnerSchemata?.length ?? 0}
                  </Badge>
                </div>
              </div>
            </div>

            {!showConfirm ? (
              <Button
                onClick={() => setShowConfirm(true)}
                disabled={importing}
              >
                <Upload className="w-4 h-4 mr-2" />
                Importieren
              </Button>
            ) : (
              <div className="p-4 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Bestehende Einstellungen werden ueberschrieben
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Gleichnamige Einstellungen, Presets, Briefkoepfe und Schemata
                  werden durch die importierten Werte ersetzt.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleImport}
                    disabled={importing}
                  >
                    {importing ? "Importiere..." : "Jetzt importieren"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConfirm(false)}
                  >
                    Abbrechen
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Import result */}
        {importResult && (
          <div className="p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
            <div className="flex items-center gap-2 mb-3">
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Import abgeschlossen
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                Einstellungen: {importResult.systemSettings.imported} importiert
                {importResult.systemSettings.skipped > 0 &&
                  `, ${importResult.systemSettings.skipped} uebersprungen`}
              </div>
              <div>
                Presets: {importResult.fristPresets.imported} importiert
                {importResult.fristPresets.skipped > 0 &&
                  `, ${importResult.fristPresets.skipped} uebersprungen`}
              </div>
              <div>
                Briefkoepfe: {importResult.briefkoepfe.imported} importiert
                {importResult.briefkoepfe.skipped > 0 &&
                  `, ${importResult.briefkoepfe.skipped} uebersprungen`}
              </div>
              <div>
                Schemata: {importResult.ordnerSchemata.imported} importiert
                {importResult.ordnerSchemata.skipped > 0 &&
                  `, ${importResult.ordnerSchemata.skipped} uebersprungen`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">
              Was wird exportiert?
            </p>
            <p>
              Exportiert werden: Allgemeine Einstellungen, Fristen-Presets,
              Ordner-Schemata. Briefkopf-Dateien und Vorlagen-Dateien muessen
              separat uebertragen werden.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
