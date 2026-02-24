"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Clock,
  RotateCcw,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface FristPreset {
  id: string;
  name: string;
  dauer: number;
  einheit: string;
  fristArt: string;
}

interface FristenSettings {
  vorfristen: number[];
  defaultBundesland: string;
  eskalationVertreterStunden: number;
  eskalationAdminStunden: number;
  arbeitszeitStart: string;
  arbeitszeitEnde: string;
}

const BUNDESLAENDER: Record<string, string> = {
  BW: "Baden-Wuerttemberg",
  BY: "Bayern",
  BE: "Berlin",
  BB: "Brandenburg",
  HB: "Bremen",
  HH: "Hamburg",
  HE: "Hessen",
  MV: "Mecklenburg-Vorpommern",
  NI: "Niedersachsen",
  NW: "Nordrhein-Westfalen",
  RP: "Rheinland-Pfalz",
  SL: "Saarland",
  SN: "Sachsen",
  ST: "Sachsen-Anhalt",
  SH: "Schleswig-Holstein",
  TH: "Thueringen",
};

const DEFAULT_SETTINGS: FristenSettings = {
  vorfristen: [7, 3, 1],
  defaultBundesland: "NW",
  eskalationVertreterStunden: 4,
  eskalationAdminStunden: 8,
  arbeitszeitStart: "08:00",
  arbeitszeitEnde: "18:00",
};

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Fristen settings tab: Vorfristen, Bundesland, presets, escalation, Arbeitszeiten.
 * All settings auto-save on change (VS Code style). Audit-Trail logged.
 */
export function FristenTab() {
  const [settings, setSettings] = useState<FristenSettings>(DEFAULT_SETTINGS);
  const [presets, setPresets] = useState<FristPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetDauer, setNewPresetDauer] = useState("14");
  const [newPresetEinheit, setNewPresetEinheit] = useState("TAGE");

  // Load settings from API
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/einstellungen/export");
      if (!res.ok) throw new Error("Fehler");
      const data = await res.json();

      // Extract fristen-related settings
      const ss = data.systemSettings ?? [];
      const get = (key: string, def: string) =>
        ss.find((s: any) => s.key === key)?.value ?? def;

      setSettings({
        vorfristen: JSON.parse(get("fristen_vorfristen", "[7,3,1]")),
        defaultBundesland: get("fristen_default_bundesland", "NW"),
        eskalationVertreterStunden: parseInt(get("fristen_eskalation_vertreter_stunden", "4")),
        eskalationAdminStunden: parseInt(get("fristen_eskalation_admin_stunden", "8")),
        arbeitszeitStart: get("fristen_arbeitszeit_start", "08:00"),
        arbeitszeitEnde: get("fristen_arbeitszeit_ende", "18:00"),
      });

      // Load fristen presets
      try {
        const presetsRes = await fetch("/api/kalender?typ=FRIST&limit=100");
        if (presetsRes.ok) {
          const presetsData = await presetsRes.json();
          // Extract unique presets based on name pattern
          setPresets(presetsData.presets ?? []);
        }
      } catch {
        // Presets may not be available yet
      }
    } catch {
      toast.error("Fristen-Einstellungen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Auto-save a setting change
  const saveSetting = async (key: string, value: string, label: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/einstellungen/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemSettings: [
            { key, value, type: "string", category: "fristen", label },
          ],
        }),
      });
      if (!res.ok) throw new Error("Fehler");
      // Auto-save toast is subtle
      toast.success("Gespeichert", { duration: 1500 });
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  // Update vorfristen
  const handleVorfristChange = (index: number, value: string) => {
    const newVorfristen = [...settings.vorfristen];
    newVorfristen[index] = parseInt(value) || 0;
    setSettings((prev) => ({ ...prev, vorfristen: newVorfristen }));
    saveSetting("fristen_vorfristen", JSON.stringify(newVorfristen), "Vorfristen");
  };

  // Update Bundesland
  const handleBundeslandChange = (value: string) => {
    setSettings((prev) => ({ ...prev, defaultBundesland: value }));
    saveSetting("fristen_default_bundesland", value, "Standard-Bundesland");
  };

  // Update escalation
  const handleEskalationChange = (field: "eskalationVertreterStunden" | "eskalationAdminStunden", value: string) => {
    const num = parseInt(value) || 0;
    setSettings((prev) => ({ ...prev, [field]: num }));
    const key = field === "eskalationVertreterStunden"
      ? "fristen_eskalation_vertreter_stunden"
      : "fristen_eskalation_admin_stunden";
    const label = field === "eskalationVertreterStunden"
      ? "Eskalation Vertreter (Stunden)"
      : "Eskalation Admin (Stunden)";
    saveSetting(key, String(num), label);
  };

  // Update Arbeitszeiten
  const handleArbeitszeitChange = (field: "arbeitszeitStart" | "arbeitszeitEnde", value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    const key = field === "arbeitszeitStart" ? "fristen_arbeitszeit_start" : "fristen_arbeitszeit_ende";
    const label = field === "arbeitszeitStart" ? "Arbeitszeit Beginn" : "Arbeitszeit Ende";
    saveSetting(key, value, label);
  };

  // Add preset
  const handleAddPreset = async () => {
    if (!newPresetName.trim()) return;
    // For now presets are stored as system settings
    const newPreset: FristPreset = {
      id: `preset_${Date.now()}`,
      name: newPresetName.trim(),
      dauer: parseInt(newPresetDauer) || 14,
      einheit: newPresetEinheit,
      fristArt: "EREIGNISFRIST",
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    setNewPresetName("");
    setNewPresetDauer("14");
    await saveSetting("fristen_presets", JSON.stringify(updated), "Fristen-Presets");
    toast.success("Preset hinzugefuegt");
  };

  // Delete preset
  const handleDeletePreset = async (id: string) => {
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    await saveSetting("fristen_presets", JSON.stringify(updated), "Fristen-Presets");
    toast.success("Preset entfernt");
  };

  // Reset to defaults
  const handleReset = async () => {
    setSettings(DEFAULT_SETTINGS);
    setShowResetConfirm(false);
    // Save all defaults
    const keys = [
      { key: "fristen_vorfristen", value: JSON.stringify(DEFAULT_SETTINGS.vorfristen), label: "Vorfristen" },
      { key: "fristen_default_bundesland", value: DEFAULT_SETTINGS.defaultBundesland, label: "Standard-Bundesland" },
      { key: "fristen_eskalation_vertreter_stunden", value: String(DEFAULT_SETTINGS.eskalationVertreterStunden), label: "Eskalation Vertreter" },
      { key: "fristen_eskalation_admin_stunden", value: String(DEFAULT_SETTINGS.eskalationAdminStunden), label: "Eskalation Admin" },
      { key: "fristen_arbeitszeit_start", value: DEFAULT_SETTINGS.arbeitszeitStart, label: "Arbeitszeit Beginn" },
      { key: "fristen_arbeitszeit_ende", value: DEFAULT_SETTINGS.arbeitszeitEnde, label: "Arbeitszeit Ende" },
    ];
    try {
      await fetch("/api/einstellungen/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemSettings: keys.map((k) => ({
            ...k,
            type: "string",
            category: "fristen",
          })),
        }),
      });
      toast.success("Fristen-Einstellungen zurueckgesetzt");
    } catch {
      toast.error("Fehler beim Zuruecksetzen");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Vorfristen */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-heading text-foreground">Vorfristen</h3>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Erinnerungen vor Fristablauf (in Tagen). Standardmaessig 7, 3 und 1 Tag vorher.
        </p>
        <div className="flex items-center gap-3">
          {settings.vorfristen.map((tage, i) => (
            <div key={i} className="space-y-1">
              <Label className="text-xs">Erinnerung {i + 1}</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={tage}
                  onChange={(e) => handleVorfristChange(i, e.target.value)}
                  className="w-20 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">Tage</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Default Bundesland */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-heading text-foreground mb-4">
          Standard-Bundesland
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          Fuer die Berechnung von Feiertagen bei Fristenberechnung.
        </p>
        <select
          value={settings.defaultBundesland}
          onChange={(e) => handleBundeslandChange(e.target.value)}
          className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {Object.entries(BUNDESLAENDER).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Fristen-Presets */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-heading text-foreground mb-4">
          Fristen-Presets
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Haeufig verwendete Fristen fuer schnelle Auswahl.
        </p>

        {presets.length > 0 && (
          <div className="space-y-2 mb-4">
            {presets.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30"
              >
                <div>
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {p.dauer} {p.einheit === "TAGE" ? "Tage" : p.einheit === "WOCHEN" ? "Wochen" : "Monate"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeletePreset(p.id)}
                >
                  <Trash2 className="w-4 h-4 text-rose-500" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Name</Label>
            <Input
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="z.B. Berufungsfrist"
              className="h-8 text-sm"
            />
          </div>
          <div className="w-20 space-y-1">
            <Label className="text-xs">Dauer</Label>
            <Input
              type="number"
              min={1}
              value={newPresetDauer}
              onChange={(e) => setNewPresetDauer(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="w-28 space-y-1">
            <Label className="text-xs">Einheit</Label>
            <select
              value={newPresetEinheit}
              onChange={(e) => setNewPresetEinheit(e.target.value)}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="TAGE">Tage</option>
              <option value="WOCHEN">Wochen</option>
              <option value="MONATE">Monate</option>
            </select>
          </div>
          <Button size="sm" onClick={handleAddPreset} disabled={!newPresetName.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Eskalation */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-rose-500" />
          <h3 className="text-lg font-heading text-foreground">Eskalation</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Automatische Benachrichtigung bei ueberfaelligen Fristen.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Vertreter benachrichtigen nach</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={settings.eskalationVertreterStunden}
                onChange={(e) => handleEskalationChange("eskalationVertreterStunden", e.target.value)}
                className="w-20 h-8 text-sm"
              />
              <span className="text-sm text-muted-foreground">Stunden</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Admin benachrichtigen nach</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={settings.eskalationAdminStunden}
                onChange={(e) => handleEskalationChange("eskalationAdminStunden", e.target.value)}
                className="w-20 h-8 text-sm"
              />
              <span className="text-sm text-muted-foreground">Stunden</span>
            </div>
          </div>
        </div>
      </div>

      {/* Arbeitszeiten */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-heading text-foreground mb-4">
          Kanzlei-Arbeitszeiten
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Montag bis Freitag. Relevant fuer Fristenberechnung und Benachrichtigungen.
        </p>
        <div className="flex items-center gap-4">
          <div className="space-y-1.5">
            <Label>Beginn</Label>
            <Input
              type="time"
              value={settings.arbeitszeitStart}
              onChange={(e) => handleArbeitszeitChange("arbeitszeitStart", e.target.value)}
              className="w-32 h-8 text-sm"
            />
          </div>
          <span className="text-muted-foreground mt-6">bis</span>
          <div className="space-y-1.5">
            <Label>Ende</Label>
            <Input
              type="time"
              value={settings.arbeitszeitEnde}
              onChange={(e) => handleArbeitszeitChange("arbeitszeitEnde", e.target.value)}
              className="w-32 h-8 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Reset button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => setShowResetConfirm(true)}
          className="text-muted-foreground"
        >
          <RotateCcw className="w-4 h-4 mr-1.5" />
          Auf Standard zuruecksetzen
        </Button>
      </div>

      {/* Reset confirmation dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h3 className="text-lg font-heading text-foreground">
              Einstellungen zuruecksetzen?
            </h3>
            <p className="text-sm text-muted-foreground">
              Moechten Sie die Einstellungen in diesem Bereich auf die Standardwerte
              zuruecksetzen? Diese Aktion kann nicht rueckgaengig gemacht werden.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowResetConfirm(false)}
              >
                Abbrechen
              </Button>
              <Button variant="destructive" onClick={handleReset}>
                Zuruecksetzen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
