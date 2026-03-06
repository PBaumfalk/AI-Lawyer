"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Scissors,
  RotateCw,
  Minimize2,
  Stamp,
  ShieldAlert,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { PdfPageThumbnails } from "./pdf-page-thumbnails";

interface PdfToolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dokument: { id: string; name: string; akteId: string };
  onComplete: () => void;
}

type Operation = "split" | "rotate" | "compress" | "watermark" | "redact";

const DSGVO_PATTERNS = [
  { id: "iban", label: "IBAN", pattern: "IBAN" },
  { id: "telefon", label: "Telefonnummer", pattern: "TELEFON" },
  { id: "email", label: "E-Mail-Adresse", pattern: "EMAIL" },
  { id: "steuernummer", label: "Steuernummer", pattern: "STEUERNUMMER" },
  { id: "svnummer", label: "Sozialversicherungsnummer", pattern: "SV_NUMMER" },
  { id: "geburtsdatum", label: "Geburtsdatum", pattern: "GEBURTSDATUM" },
];

export function PdfToolsDialog({
  open,
  onOpenChange,
  dokument,
  onComplete,
}: PdfToolsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saveAsNew, setSaveAsNew] = useState(true);

  // Split state
  const [pageCount, setPageCount] = useState(10);
  const [pageRange, setPageRange] = useState("");
  const [selectedSplitPages, setSelectedSplitPages] = useState<Set<number>>(new Set());

  // Rotate state
  const [angle, setAngle] = useState<90 | 180 | 270>(90);

  // Compress state
  const [compressLevel, setCompressLevel] = useState<1 | 2 | 3 | 4 | 5>(3);

  // Watermark state
  const [watermarkText, setWatermarkText] = useState("");
  const [fontSize, setFontSize] = useState(30);
  const [watermarkRotation, setWatermarkRotation] = useState(45);
  const [opacity, setOpacity] = useState(0.5);

  // Redact state
  const [useDsgvo, setUseDsgvo] = useState(true);
  const [dsgvoPatterns, setDsgvoPatterns] = useState<Set<string>>(
    new Set(DSGVO_PATTERNS.map((p) => p.pattern))
  );
  const [customRedactTerms, setCustomRedactTerms] = useState("");

  const handleSplitPageSelect = useCallback((page: number) => {
    setSelectedSplitPages((prev) => {
      const next = new Set(prev);
      if (next.has(page)) {
        next.delete(page);
      } else {
        next.add(page);
      }
      return next;
    });
  }, []);

  const toggleDsgvoPattern = useCallback((pattern: string) => {
    setDsgvoPatterns((prev) => {
      const next = new Set(prev);
      if (next.has(pattern)) {
        next.delete(pattern);
      } else {
        next.add(pattern);
      }
      return next;
    });
  }, []);

  const toggleUseDsgvo = useCallback(() => {
    setUseDsgvo((prev) => {
      const next = !prev;
      if (next) {
        setDsgvoPatterns(new Set(DSGVO_PATTERNS.map((p) => p.pattern)));
      } else {
        setDsgvoPatterns(new Set());
      }
      return next;
    });
  }, []);

  const handleSubmit = async (operation: Operation) => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        operation,
        saveAsNew,
      };

      switch (operation) {
        case "split": {
          // Build page range from selection or manual input
          const range =
            pageRange.trim() ||
            (selectedSplitPages.size > 0
              ? Array.from(selectedSplitPages).sort((a, b) => a - b).join(",")
              : "");
          if (!range) {
            toast.error("Bitte waehlen Sie Seiten aus oder geben Sie einen Seitenbereich ein");
            setLoading(false);
            return;
          }
          body.pages = range;
          break;
        }
        case "rotate":
          body.angle = angle;
          break;
        case "compress":
          body.level = compressLevel;
          break;
        case "watermark":
          if (!watermarkText.trim()) {
            toast.error("Bitte geben Sie einen Wasserzeichen-Text ein");
            setLoading(false);
            return;
          }
          body.text = watermarkText.trim();
          body.fontSize = fontSize;
          body.rotation = watermarkRotation;
          body.opacity = opacity;
          break;
        case "redact": {
          const patterns = Array.from(dsgvoPatterns);
          const customTerms = customRedactTerms
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          if (patterns.length === 0 && customTerms.length === 0) {
            toast.error("Bitte waehlen Sie mindestens ein Muster oder geben Sie Suchbegriffe ein");
            setLoading(false);
            return;
          }
          body.redactPatterns = [...patterns, ...customTerms];
          body.useDsgvo = useDsgvo;
          break;
        }
      }

      const res = await fetch(`/api/dokumente/${dokument.id}/pdf-tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Vorgang fehlgeschlagen");
      }

      const data = await res.json();
      toast.success(`Erfolgreich: ${data.name ?? dokument.name}`);
      onComplete();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ein Fehler ist aufgetreten";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const operationLabels: Record<Operation, string> = {
    split: "Aufteilen",
    rotate: "Drehen",
    compress: "Komprimieren",
    watermark: "Wasserzeichen anwenden",
    redact: "Schwaerzen",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PDF-Tools: {dokument.name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="split" className="mt-2">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="split" className="text-xs gap-1">
              <Scissors className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Aufteilen</span>
            </TabsTrigger>
            <TabsTrigger value="rotate" className="text-xs gap-1">
              <RotateCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Drehen</span>
            </TabsTrigger>
            <TabsTrigger value="compress" className="text-xs gap-1">
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Komprimieren</span>
            </TabsTrigger>
            <TabsTrigger value="watermark" className="text-xs gap-1">
              <Stamp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Wasserzeichen</span>
            </TabsTrigger>
            <TabsTrigger value="redact" className="text-xs gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Schwaerzen</span>
            </TabsTrigger>
          </TabsList>

          {/* === AUFTEILEN (Split) === */}
          <TabsContent value="split" className="space-y-4 mt-4">
            <div>
              <Label className="text-sm font-medium">Seitenanzahl</Label>
              <Input
                type="number"
                min={1}
                value={pageCount}
                onChange={(e) => setPageCount(Math.max(1, Number(e.target.value)))}
                className="w-24 mt-1"
                placeholder="z.B. 10"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Geben Sie die Gesamtseitenanzahl des PDFs ein
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">Seiten auswaehlen (klicken)</Label>
              <div className="mt-2 max-h-[200px] overflow-y-auto">
                <PdfPageThumbnails
                  pageCount={pageCount}
                  onReorder={() => {}}
                  selectedPages={selectedSplitPages}
                  onSelectPage={handleSplitPageSelect}
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Oder Seitenbereich eingeben</Label>
              <Input
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                placeholder="z.B. 1-3,5,7-9"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Komma-getrennte Seiten oder Bereiche (hat Vorrang vor Auswahl)
              </p>
            </div>

            <SharedFooter
              saveAsNew={saveAsNew}
              onSaveAsNewChange={setSaveAsNew}
              loading={loading}
              label={operationLabels.split}
              onSubmit={() => handleSubmit("split")}
            />
          </TabsContent>

          {/* === DREHEN (Rotate) === */}
          <TabsContent value="rotate" className="space-y-4 mt-4">
            <div>
              <Label className="text-sm font-medium">Drehwinkel</Label>
              <div className="flex gap-2 mt-2">
                {([90, 180, 270] as const).map((deg) => (
                  <button
                    key={deg}
                    onClick={() => setAngle(deg)}
                    className={`
                      flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all
                      ${angle === deg
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                      }
                    `}
                  >
                    <RotateCw
                      className="w-4 h-4"
                      style={{ transform: `rotate(${deg}deg)` }}
                    />
                    {deg} Grad
                  </button>
                ))}
              </div>
            </div>

            <SharedFooter
              saveAsNew={saveAsNew}
              onSaveAsNewChange={setSaveAsNew}
              loading={loading}
              label={operationLabels.rotate}
              onSubmit={() => handleSubmit("rotate")}
            />
          </TabsContent>

          {/* === KOMPRIMIEREN (Compress) === */}
          <TabsContent value="compress" className="space-y-4 mt-4">
            <div>
              <Label className="text-sm font-medium">Komprimierungsstufe</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {([
                  [1, "Niedrig"],
                  [2, "Mittel"],
                  [3, "Standard"],
                  [4, "Hoch"],
                  [5, "Maximal"],
                ] as const).map(([level, label]) => (
                  <button
                    key={level}
                    onClick={() => setCompressLevel(level)}
                    className={`
                      px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all
                      ${compressLevel === level
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                      }
                    `}
                  >
                    {label} ({level})
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Hoehere Komprimierung = kleinere Datei, aber moeglicher Qualitaetsverlust
              </p>
            </div>

            <SharedFooter
              saveAsNew={saveAsNew}
              onSaveAsNewChange={setSaveAsNew}
              loading={loading}
              label={operationLabels.compress}
              onSubmit={() => handleSubmit("compress")}
            />
          </TabsContent>

          {/* === WASSERZEICHEN (Watermark) === */}
          <TabsContent value="watermark" className="space-y-4 mt-4">
            <div>
              <Label className="text-sm font-medium">Schnellvorlagen</Label>
              <div className="flex gap-2 mt-2">
                {["ENTWURF", "VERTRAULICH", "KOPIE"].map((preset) => (
                  <Button
                    key={preset}
                    size="sm"
                    variant={watermarkText === preset ? "default" : "outline"}
                    onClick={() => setWatermarkText(preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Eigener Text</Label>
              <Input
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="Wasserzeichen-Text..."
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Schriftgroesse ({fontSize})</Label>
                <input
                  type="range"
                  min={20}
                  max={60}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full mt-1 accent-blue-500"
                />
              </div>
              <div>
                <Label className="text-xs">Drehung ({watermarkRotation} Grad)</Label>
                <input
                  type="range"
                  min={0}
                  max={90}
                  value={watermarkRotation}
                  onChange={(e) => setWatermarkRotation(Number(e.target.value))}
                  className="w-full mt-1 accent-blue-500"
                />
              </div>
              <div>
                <Label className="text-xs">Deckkraft ({Math.round(opacity * 100)}%)</Label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round(opacity * 100)}
                  onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                  className="w-full mt-1 accent-blue-500"
                />
              </div>
            </div>

            <SharedFooter
              saveAsNew={saveAsNew}
              onSaveAsNewChange={setSaveAsNew}
              loading={loading}
              label={operationLabels.watermark}
              onSubmit={() => handleSubmit("watermark")}
            />
          </TabsContent>

          {/* === SCHWAERZEN (Redact) === */}
          <TabsContent value="redact" className="space-y-4 mt-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Bitte pruefen Sie das Ergebnis vor dem Speichern. Geschwaerzte Bereiche koennen nicht wiederhergestellt werden.
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useDsgvo}
                  onChange={toggleUseDsgvo}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-500"
                />
                <span className="text-sm font-medium">DSGVO-Muster anwenden</span>
              </label>
            </div>

            {useDsgvo && (
              <div className="space-y-2 pl-6">
                {DSGVO_PATTERNS.map((pat) => (
                  <label key={pat.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dsgvoPatterns.has(pat.pattern)}
                      onChange={() => toggleDsgvoPattern(pat.pattern)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-500"
                    />
                    <span className="text-sm">{pat.label}</span>
                  </label>
                ))}
              </div>
            )}

            <div>
              <Label className="text-sm font-medium">Zusaetzliche Suchbegriffe</Label>
              <Input
                value={customRedactTerms}
                onChange={(e) => setCustomRedactTerms(e.target.value)}
                placeholder="Komma-getrennt, z.B. Max Mustermann, Firma GmbH"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optionale zusaetzliche Begriffe zum Schwaerzen
              </p>
            </div>

            <SharedFooter
              saveAsNew={saveAsNew}
              onSaveAsNewChange={setSaveAsNew}
              loading={loading}
              label={operationLabels.redact}
              onSubmit={() => handleSubmit("redact")}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Shared footer component for save-as-new toggle and submit button
function SharedFooter({
  saveAsNew,
  onSaveAsNewChange,
  loading,
  label,
  onSubmit,
}: {
  saveAsNew: boolean;
  onSaveAsNewChange: (v: boolean) => void;
  loading: boolean;
  label: string;
  onSubmit: () => void;
}) {
  return (
    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={saveAsNew}
          onChange={(e) => onSaveAsNewChange(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-500"
        />
        <span className="text-sm">Als neue Datei speichern</span>
      </label>
      <Button onClick={onSubmit} disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
        {label}
      </Button>
    </div>
  );
}
