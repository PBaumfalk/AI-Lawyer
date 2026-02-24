"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Loader2, Info, AlertTriangle, Printer } from "lucide-react";
import { toast } from "sonner";

// Bundesland options
const BUNDESLAENDER = [
  { code: "BW", name: "Baden-Wuerttemberg" },
  { code: "BY", name: "Bayern" },
  { code: "BE", name: "Berlin" },
  { code: "BB", name: "Brandenburg" },
  { code: "HB", name: "Bremen" },
  { code: "HH", name: "Hamburg" },
  { code: "HE", name: "Hessen" },
  { code: "MV", name: "Mecklenburg-Vorpommern" },
  { code: "NI", name: "Niedersachsen" },
  { code: "NW", name: "Nordrhein-Westfalen" },
  { code: "RP", name: "Rheinland-Pfalz" },
  { code: "SL", name: "Saarland" },
  { code: "SN", name: "Sachsen" },
  { code: "ST", name: "Sachsen-Anhalt" },
  { code: "SH", name: "Schleswig-Holstein" },
  { code: "TH", name: "Thueringen" },
];

interface FristPreset {
  id: string;
  name: string;
  fristArt: string;
  dauerWochen: number | null;
  dauerMonate: number | null;
  dauerTage: number | null;
  istNotfrist: boolean;
  kategorie: string;
  rechtsgrundlage: string | null;
  defaultVorfristen: number[];
}

export interface RechnerFormData {
  zustellungsdatum: string;
  fristArt: "EREIGNISFRIST" | "BEGINNFRIST";
  dauer: { tage?: number; wochen?: number; monate?: number; jahre?: number };
  bundesland: string;
  section193: boolean;
  richtung: "vorwaerts" | "rueckwaerts";
  presetId?: string;
  sonderfall: string | null;
}

interface FristenRechnerFormProps {
  onResult: (result: any) => void;
  onLoading: (loading: boolean) => void;
}

/**
 * FristenRechner input form with presets, dual direction, Sonderfaelle, and Bundesland support.
 */
export function FristenRechnerForm({ onResult, onLoading }: FristenRechnerFormProps) {
  const [presets, setPresets] = useState<FristPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<FristPreset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [richtung, setRichtung] = useState<"vorwaerts" | "rueckwaerts">("vorwaerts");
  const [zustellungsdatum, setZustellungsdatum] = useState("");
  const [fristArt, setFristArt] = useState<"EREIGNISFRIST" | "BEGINNFRIST">("EREIGNISFRIST");
  const [wochen, setWochen] = useState<number | "">("");
  const [monate, setMonate] = useState<number | "">("");
  const [tage, setTage] = useState<number | "">("");
  const [bundesland, setBundesland] = useState("NW");
  const [section193, setSection193] = useState(true);
  const [istNotfrist, setIstNotfrist] = useState(false);
  const [sonderfall, setSonderfall] = useState<string | null>(null);
  const [presetWarning, setPresetWarning] = useState<string | null>(null);

  // Load presets
  useEffect(() => {
    fetch("/api/fristen/presets")
      .then((r) => r.json())
      .then((data) => setPresets(Array.isArray(data) ? data : []))
      .catch(() => setPresets([]))
      .finally(() => setPresetsLoading(false));
  }, []);

  // Handle preset selection
  const handlePresetChange = useCallback(
    (presetId: string) => {
      const preset = presets.find((p) => p.id === presetId) ?? null;
      setSelectedPreset(preset);
      if (preset) {
        setFristArt(preset.fristArt as "EREIGNISFRIST" | "BEGINNFRIST");
        setWochen(preset.dauerWochen ?? "");
        setMonate(preset.dauerMonate ?? "");
        setTage(preset.dauerTage ?? "");
        setIstNotfrist(preset.istNotfrist);
        setPresetWarning(null);
      }
    },
    [presets]
  );

  // Check for deviation from preset default
  useEffect(() => {
    if (!selectedPreset) {
      setPresetWarning(null);
      return;
    }
    const pw = selectedPreset.dauerWochen ?? 0;
    const pm = selectedPreset.dauerMonate ?? 0;
    const pt = selectedPreset.dauerTage ?? 0;
    const cw = typeof wochen === "number" ? wochen : 0;
    const cm = typeof monate === "number" ? monate : 0;
    const ct = typeof tage === "number" ? tage : 0;

    if (cw !== pw || cm !== pm || ct !== pt) {
      const presetDauerStr = [
        pw ? `${pw} Wo.` : "",
        pm ? `${pm} Mon.` : "",
        pt ? `${pt} Tg.` : "",
      ]
        .filter(Boolean)
        .join(", ");
      const currentDauerStr = [
        cw ? `${cw} Wo.` : "",
        cm ? `${cm} Mon.` : "",
        ct ? `${ct} Tg.` : "",
      ]
        .filter(Boolean)
        .join(", ");
      setPresetWarning(
        `Die uebliche Dauer fuer ${selectedPreset.name} ist ${presetDauerStr}. Sie haben ${currentDauerStr} eingetragen.`
      );
    } else {
      setPresetWarning(null);
    }
  }, [selectedPreset, wochen, monate, tage]);

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!zustellungsdatum) {
      toast.error("Bitte ein Datum eingeben");
      return;
    }

    const dauerObj: Record<string, number> = {};
    if (typeof tage === "number" && tage > 0) dauerObj.tage = tage;
    if (typeof wochen === "number" && wochen > 0) dauerObj.wochen = wochen;
    if (typeof monate === "number" && monate > 0) dauerObj.monate = monate;

    if (Object.keys(dauerObj).length === 0) {
      toast.error("Bitte mindestens eine Dauer angeben (Tage, Wochen oder Monate)");
      return;
    }

    setSubmitting(true);
    onLoading(true);

    try {
      const payload = {
        zustellungsdatum: new Date(zustellungsdatum).toISOString(),
        fristArt,
        dauer: dauerObj,
        bundesland,
        section193,
        richtung,
        presetId: selectedPreset?.id,
        sonderfall: sonderfall || null,
      };

      const res = await fetch("/api/fristen/rechner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Berechnung fehlgeschlagen");
      }

      const result = await res.json();
      onResult({
        ...result,
        istNotfrist,
        formData: payload,
      });
    } catch (err: any) {
      toast.error(err.message ?? "Fehler bei der Berechnung");
    } finally {
      setSubmitting(false);
      onLoading(false);
    }
  };

  // Fristenzettel drucken
  const handleFristenzettel = () => {
    const today = new Date().toISOString().split("T")[0];
    window.open(`/api/fristen/fristenzettel?format=daily&datum=${today}`, "_blank");
  };

  // Group presets by kategorie
  const groupedPresets = presets.reduce<Record<string, FristPreset[]>>((acc, p) => {
    if (!acc[p.kategorie]) acc[p.kategorie] = [];
    acc[p.kategorie].push(p);
    return acc;
  }, {});

  const kategorieLabels: Record<string, string> = {
    zivilprozess: "Zivilprozess",
    verwaltungsrecht: "Verwaltungsrecht",
    strafrecht: "Strafrecht",
    arbeitsrecht: "Arbeitsrecht",
    allgemein: "Allgemein",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header with Fristenzettel button */}
      <div className="flex items-center justify-between">
        <div />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleFristenzettel}
          className="text-xs"
        >
          <Printer className="w-3.5 h-3.5 mr-1.5" />
          Fristenzettel drucken
        </Button>
      </div>

      {/* Direction toggle */}
      <div className="space-y-2">
        <Label>Berechnungsrichtung</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRichtung("vorwaerts")}
            className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              richtung === "vorwaerts"
                ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-700"
                : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400"
            }`}
          >
            Vorwaerts
            <span className="block text-[10px] mt-0.5 opacity-70">
              Zustellung → Fristende
            </span>
          </button>
          <button
            type="button"
            onClick={() => setRichtung("rueckwaerts")}
            className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              richtung === "rueckwaerts"
                ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-700"
                : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400"
            }`}
          >
            Rueckwaerts
            <span className="block text-[10px] mt-0.5 opacity-70">
              Fristende → Zustellung
            </span>
          </button>
        </div>
      </div>

      {/* Preset selector */}
      <div className="space-y-2">
        <Label>Frist-Vorlage (optional)</Label>
        <Select
          value={selectedPreset?.id ?? ""}
          onChange={(e) => handlePresetChange(e.target.value)}
          disabled={presetsLoading}
        >
          <option value="">
            {presetsLoading ? "Lade Vorlagen..." : "-- Keine Vorlage --"}
          </option>
          {Object.entries(groupedPresets).map(([kategorie, items]) => (
            <optgroup key={kategorie} label={kategorieLabels[kategorie] ?? kategorie}>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.rechtsgrundlage ? ` (${p.rechtsgrundlage})` : ""}
                  {p.istNotfrist ? " [NOTFRIST]" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </div>

      {/* Datum */}
      <div className="space-y-2">
        <Label>
          {richtung === "vorwaerts" ? "Zustellungsdatum" : "Fristende"}
          <span className="text-rose-500 ml-1">*</span>
        </Label>
        <Input
          type="date"
          value={zustellungsdatum}
          onChange={(e) => setZustellungsdatum(e.target.value)}
          required
        />
      </div>

      {/* FristArt */}
      <div className="space-y-2">
        <Label>Fristtyp</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFristArt("EREIGNISFRIST")}
            className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
              fristArt === "EREIGNISFRIST"
                ? "border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-700"
                : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400"
            }`}
          >
            Ereignisfrist
          </button>
          <button
            type="button"
            onClick={() => setFristArt("BEGINNFRIST")}
            className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
              fristArt === "BEGINNFRIST"
                ? "border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400 dark:border-violet-700"
                : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400"
            }`}
          >
            Beginnfrist
          </button>
        </div>
      </div>

      {/* Duration fields */}
      <div className="space-y-2">
        <Label>Fristdauer</Label>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Monate</label>
            <Input
              type="number"
              min={0}
              value={monate}
              onChange={(e) => setMonate(e.target.value ? parseInt(e.target.value) : "")}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Wochen</label>
            <Input
              type="number"
              min={0}
              value={wochen}
              onChange={(e) => setWochen(e.target.value ? parseInt(e.target.value) : "")}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Tage</label>
            <Input
              type="number"
              min={0}
              value={tage}
              onChange={(e) => setTage(e.target.value ? parseInt(e.target.value) : "")}
              placeholder="0"
            />
          </div>
        </div>
        {presetWarning && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span className="text-xs text-amber-700 dark:text-amber-400">
              {presetWarning}
            </span>
          </div>
        )}
      </div>

      {/* Bundesland */}
      <div className="space-y-2">
        <Label>Bundesland</Label>
        <Select
          value={bundesland}
          onChange={(e) => setBundesland(e.target.value)}
        >
          {BUNDESLAENDER.map((bl) => (
            <option key={bl.code} value={bl.code}>
              {bl.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Section 193 + Notfrist */}
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={section193}
            onChange={(e) => setSection193(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
          />
          <span className="text-sm text-foreground/80">Section 193 ZPO</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={istNotfrist}
            onChange={(e) => setIstNotfrist(e.target.checked)}
            className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 dark:border-rose-600"
          />
          <span className="text-sm text-foreground/80">Notfrist</span>
        </label>
      </div>

      {/* Notfrist warning */}
      {istNotfrist && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white">
            NOTFRIST
          </span>
          <span className="text-xs text-rose-700 dark:text-rose-400">
            Diese Frist ist nicht verlaengerbar.
          </span>
        </div>
      )}

      {/* Sonderfaelle */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label>Sonderfaelle</Label>
          <Info className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <Select
          value={sonderfall ?? ""}
          onChange={(e) => setSonderfall(e.target.value || null)}
        >
          <option value="">Normale Zustellung</option>
          <option value="OEFFENTLICHE_ZUSTELLUNG">
            Oeffentliche Zustellung (Section 188 ZPO)
          </option>
          <option value="AUSLANDSZUSTELLUNG_EU">
            Auslandszustellung (EU-ZustVO)
          </option>
        </Select>
        {sonderfall === "OEFFENTLICHE_ZUSTELLUNG" && (
          <p className="text-[11px] text-muted-foreground italic">
            Fristbeginn 1 Monat nach Aushang. Zustellungsdatum ist der Aushang-Tag.
          </p>
        )}
        {sonderfall === "AUSLANDSZUSTELLUNG_EU" && (
          <p className="text-[11px] text-muted-foreground italic">
            Verlaengerte Zustellungsdauer (+14 Tage EU) vor Fristbeginn.
          </p>
        )}
      </div>

      {/* Submit */}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Frist berechnen
      </Button>
    </form>
  );
}
